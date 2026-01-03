const User = require('../models/User');
const Location = require('../models/Location');
const Geofence = require('../models/Geofence');
const GeofenceLog = require('../models/GeofenceLog');
const Message = require('../models/Message');
const { checkGeofences } = require('../services/geofenceService');

// Store active users: userId -> { socketId, name, geofenceStates, currentGeofences }
const activeUsers = new Map();

// Store socket to user mapping: socketId -> userId
const socketToUser = new Map();

/**
 * Initialize Socket.IO handlers
 * @param {Object} io - Socket.IO server instance
 */
const initializeSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`New connection: ${socket.id}`);

        // Handle user registration
        socket.on('user:register', async (data) => {
            try {
                const { userId, name, role } = data;
                console.log(`User registering: ${userId} (${name})`);

                // Update or create user in database
                let user = await User.findOne({ userId });
                if (user) {
                    user.socketId = socket.id;
                    user.isOnline = true;
                    user.lastSeen = new Date();
                    if (name) user.displayName = name;
                    await user.save();
                } else {
                    user = await User.create({
                        userId,
                        displayName: name || `User_${userId.substring(0, 6)}`,
                        socketId: socket.id,
                        isOnline: true,
                        role: role || 'user',
                    });
                }

                // Store in active users map
                activeUsers.set(userId, {
                    socketId: socket.id,
                    name: user.displayName,
                    role: user.role,
                    geofenceStates: {},
                    currentGeofences: [],
                });
                socketToUser.set(socket.id, userId);

                // Notify the user of successful registration
                socket.emit('user:registered', {
                    success: true,
                    userId,
                    name: user.displayName,
                    role: user.role,
                });

                // Broadcast updated user list to all clients
                broadcastUserList(io);

                // Send all geofences to new user
                const geofences = await Geofence.find({ isActive: true });
                socket.emit('geofences:list', geofences);

                console.log(`User registered: ${userId} (${user.displayName}) - Role: ${user.role}`);
            } catch (error) {
                console.error('Error registering user:', error);
                socket.emit('error', { message: 'Failed to register user' });
            }
        });

        // Handle location updates
        socket.on('location:update', async (data) => {
            try {
                const userId = socketToUser.get(socket.id);
                if (!userId) {
                    console.log('Location update from unregistered socket');
                    return;
                }

                const { latitude, longitude, accuracy } = data;
                const userInfo = activeUsers.get(userId);

                // Save location to database
                await Location.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        latitude,
                        longitude,
                        accuracy: accuracy || 0,
                        timestamp: new Date(),
                    },
                    { upsert: true, new: true }
                );

                // Check geofences for this user
                const geofences = await Geofence.find({ isActive: true });
                const { events, newStates } = checkGeofences(
                    userId,
                    latitude,
                    longitude,
                    geofences,
                    userInfo?.geofenceStates || {}
                );

                // Update user's geofence states and current geofences
                if (userInfo) {
                    userInfo.geofenceStates = newStates;
                    // Track which geofences the user is currently inside
                    userInfo.currentGeofences = Object.entries(newStates)
                        .filter(([_, isInside]) => isInside)
                        .map(([id, _]) => id);
                    activeUsers.set(userId, userInfo);
                }

                // Process geofence events
                for (const event of events) {
                    await handleGeofenceEvent(io, socket, userId, userInfo?.name || 'Unknown', event);
                }

                // Broadcast location to all users
                io.emit('location:broadcast', {
                    userId,
                    name: userInfo?.name || 'Unknown',
                    latitude,
                    longitude,
                    timestamp: new Date(),
                });

            } catch (error) {
                console.error('Error updating location:', error);
            }
        });

        // Handle geofence creation (ADMIN ONLY)
        socket.on('geofence:create', async (data) => {
            try {
                const userId = socketToUser.get(socket.id);
                if (!userId) return;

                const userInfo = activeUsers.get(userId);

                // Check if user is admin
                if (userInfo?.role !== 'admin') {
                    socket.emit('error', {
                        code: 403,
                        message: 'Forbidden: Only admins can create zones'
                    });
                    return;
                }

                const { name, centerLat, centerLng, radius, type } = data;

                const geofence = await Geofence.create({
                    name,
                    centerLat,
                    centerLng,
                    radius: radius || 100,
                    type: type || 'restricted',
                    createdBy: userId,
                    isActive: true,
                });

                // Broadcast new geofence to all users
                io.emit('geofence:created', geofence);

                console.log(`Geofence created: ${name} by admin ${userId}`);
            } catch (error) {
                console.error('Error creating geofence:', error);
                socket.emit('error', { message: 'Failed to create geofence' });
            }
        });

        // Handle geofence update/edit (ADMIN ONLY)
        socket.on('geofence:update', async (data) => {
            try {
                const userId = socketToUser.get(socket.id);
                if (!userId) return;

                const userInfo = activeUsers.get(userId);

                // Check if user is admin
                if (userInfo?.role !== 'admin') {
                    socket.emit('error', {
                        code: 403,
                        message: 'Forbidden: Only admins can edit zones'
                    });
                    return;
                }

                const { geofenceId, name, centerLat, centerLng, radius, type } = data;

                const updateData = {};
                if (name !== undefined) updateData.name = name;
                if (centerLat !== undefined) updateData.centerLat = centerLat;
                if (centerLng !== undefined) updateData.centerLng = centerLng;
                if (radius !== undefined) updateData.radius = radius;
                if (type !== undefined) updateData.type = type;

                const geofence = await Geofence.findByIdAndUpdate(
                    geofenceId,
                    updateData,
                    { new: true }
                );

                if (geofence) {
                    // Broadcast updated geofence to all users
                    io.emit('geofence:updated', geofence);
                    console.log(`Geofence updated: ${geofence.name} by admin ${userId}`);
                }
            } catch (error) {
                console.error('Error updating geofence:', error);
                socket.emit('error', { message: 'Failed to update geofence' });
            }
        });

        // Handle geofence deletion (ADMIN ONLY)
        socket.on('geofence:delete', async (data) => {
            try {
                const userId = socketToUser.get(socket.id);
                if (!userId) return;

                const userInfo = activeUsers.get(userId);

                // Check if user is admin
                if (userInfo?.role !== 'admin') {
                    socket.emit('error', {
                        code: 403,
                        message: 'Forbidden: Only admins can delete zones'
                    });
                    return;
                }

                const { geofenceId } = data;

                await Geofence.findByIdAndUpdate(geofenceId, { isActive: false });

                // Broadcast deletion to all users
                io.emit('geofence:deleted', { geofenceId });

                console.log(`Geofence deleted: ${geofenceId} by admin ${userId}`);
            } catch (error) {
                console.error('Error deleting geofence:', error);
            }
        });

        // Handle admin message to geofence group
        socket.on('message:send', async (data) => {
            try {
                const userId = socketToUser.get(socket.id);
                if (!userId) return;

                const userInfo = activeUsers.get(userId);
                const { title, content, targetGeofenceId } = data;

                let targetGeofenceName = null;
                if (targetGeofenceId) {
                    const geofence = await Geofence.findById(targetGeofenceId);
                    targetGeofenceName = geofence?.name;
                }

                // Save message to database
                const message = await Message.create({
                    title: title || 'Admin Message',
                    content,
                    targetGeofenceId,
                    targetGeofenceName,
                    sentBy: userId,
                    sentByName: userInfo?.name || 'Admin',
                    recipients: [],
                });

                // Find recipients based on target
                let recipientSocketIds = [];

                if (targetGeofenceId) {
                    // Send to users inside specific geofence
                    for (const [uid, user] of activeUsers) {
                        if (user.currentGeofences?.includes(targetGeofenceId)) {
                            recipientSocketIds.push(user.socketId);
                            message.recipients.push({
                                userId: uid,
                                receivedAt: new Date(),
                                read: false,
                            });
                        }
                    }
                } else {
                    // Broadcast to all users
                    for (const [uid, user] of activeUsers) {
                        if (uid !== userId) { // Don't send to sender
                            recipientSocketIds.push(user.socketId);
                            message.recipients.push({
                                userId: uid,
                                receivedAt: new Date(),
                                read: false,
                            });
                        }
                    }
                }

                await message.save();

                // Send message to recipients
                for (const socketId of recipientSocketIds) {
                    io.to(socketId).emit('message:received', {
                        id: message._id,
                        title: message.title,
                        content: message.content,
                        sentByName: message.sentByName,
                        targetGeofenceName: message.targetGeofenceName,
                        timestamp: message.timestamp,
                    });
                }

                // Confirm to sender
                socket.emit('message:sent', {
                    success: true,
                    recipientCount: recipientSocketIds.length,
                    message: {
                        id: message._id,
                        title: message.title,
                        content: message.content,
                        targetGeofenceName: message.targetGeofenceName,
                    },
                });

                console.log(`Message sent by ${userId} to ${recipientSocketIds.length} recipients`);
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle SOS emergency trigger
        socket.on('sos:trigger', async (data) => {
            try {
                const userId = socketToUser.get(socket.id);
                if (!userId) return;

                const userInfo = activeUsers.get(userId);
                const { latitude, longitude } = data;

                console.log(`🚨 SOS TRIGGERED by ${userInfo?.name || userId}`);

                // Broadcast SOS to ALL connected users
                io.emit('sos:alert', {
                    userId,
                    userName: userInfo?.name || 'Unknown User',
                    latitude,
                    longitude,
                    timestamp: new Date(),
                    message: `🚨 EMERGENCY! ${userInfo?.name || 'A user'} needs help!`,
                });

                // Confirm to sender
                socket.emit('sos:sent', {
                    success: true,
                    message: 'SOS alert sent to all users',
                });

            } catch (error) {
                console.error('Error triggering SOS:', error);
                socket.emit('error', { message: 'Failed to send SOS' });
            }
        });

        // Handle getting all active locations
        socket.on('locations:getAll', async () => {
            try {
                const locations = [];
                for (const [userId, userInfo] of activeUsers) {
                    const location = await Location.findOne({ userId }).sort({ timestamp: -1 });
                    if (location) {
                        locations.push({
                            userId,
                            name: userInfo.name,
                            latitude: location.latitude,
                            longitude: location.longitude,
                            timestamp: location.timestamp,
                        });
                    }
                }
                socket.emit('locations:all', locations);
            } catch (error) {
                console.error('Error getting all locations:', error);
            }
        });

        // Handle disconnect
        socket.on('disconnect', async () => {
            try {
                const userId = socketToUser.get(socket.id);
                if (userId) {
                    // Update user status in database
                    await User.findOneAndUpdate(
                        { userId },
                        { isOnline: false, lastSeen: new Date(), socketId: null }
                    );

                    // Remove from active users
                    activeUsers.delete(userId);
                    socketToUser.delete(socket.id);

                    // Broadcast updated user list
                    broadcastUserList(io);

                    console.log(`User disconnected: ${userId}`);
                }
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
};

/**
 * Handle geofence enter/exit events
 */
const handleGeofenceEvent = async (io, socket, userId, userName, event) => {
    try {
        // Log the event to database
        await GeofenceLog.create({
            userId,
            userName,
            geofenceId: event.geofenceId,
            geofenceName: event.geofenceName,
            eventType: event.type,
            latitude: event.latitude,
            longitude: event.longitude,
        });

        const zoneType = event.geofenceType === 'restricted' ? 'restricted zone' : 'safe zone';
        const action = event.type === 'ENTER' ? 'entered' : 'exited';

        // Notify the user themselves (self notification)
        socket.emit('geofence:alert', {
            type: event.type,
            isSelf: true,
            message: `You have ${action} the ${zoneType}: ${event.geofenceName}`,
            geofenceName: event.geofenceName,
            geofenceType: event.geofenceType,
            timestamp: event.timestamp,
        });

        // Notify all other connected users (friends notification)
        socket.broadcast.emit('geofence:alert', {
            type: event.type,
            isSelf: false,
            userId,
            userName,
            message: `${userName} has ${action} the ${zoneType}: ${event.geofenceName}`,
            geofenceName: event.geofenceName,
            geofenceType: event.geofenceType,
            timestamp: event.timestamp,
        });

        console.log(`Geofence ${event.type}: ${userName} - ${event.geofenceName}`);
    } catch (error) {
        console.error('Error handling geofence event:', error);
    }
};

/**
 * Broadcast current user list to all clients
 */
const broadcastUserList = (io) => {
    const users = [];
    for (const [userId, userInfo] of activeUsers) {
        users.push({
            userId,
            name: userInfo.name,
            role: userInfo.role,
            isOnline: true,
        });
    }
    io.emit('users:list', users);
};

module.exports = { initializeSocketHandlers };
