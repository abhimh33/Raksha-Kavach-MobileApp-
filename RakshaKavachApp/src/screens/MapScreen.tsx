// Main Map Screen with real-time location sharing, geofence visualization, and admin features
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    TextInput,
    ScrollView,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

import socketService from '../services/socket';
import locationService, { LocationData } from '../services/location';
import notificationService from '../services/notification';
import UserMarker from '../components/UserMarker';
import GeofenceCircle from '../components/GeofenceCircle';

// Simple random ID generator (React Native compatible)
const generateId = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Initialize Mapbox
Mapbox.setAccessToken('pk.eyJ1IjoiYWJoaW1oMzMiLCJhIjoiY21qd244bzI3NXo4bzNocXh0dnJyNWYxcyJ9.SMaJ5RT8lzuy9oQShQI5OA');

interface UserLocation {
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    timestamp: Date;
}

interface Geofence {
    _id: string;
    name: string;
    centerLat: number;
    centerLng: number;
    radius: number;
    type: 'restricted' | 'safe' | 'home';
    color?: string;
    isHome?: boolean;
}

interface AdminMessage {
    title: string;
    content: string;
    sentByName: string;
    timestamp: Date;
}

interface MapScreenProps {
    navigation?: any;
}

const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [currentUserRole, setCurrentUserRole] = useState<string>('user');
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
    const [friendLocations, setFriendLocations] = useState<Map<string, UserLocation>>(new Map());
    const [geofences, setGeofences] = useState<Geofence[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [showSendMessageModal, setShowSendMessageModal] = useState(false);
    const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);
    const [editName, setEditName] = useState('');
    const [editRadius, setEditRadius] = useState('');
    const [newGeofenceName, setNewGeofenceName] = useState('');
    const [newGeofenceRadius, setNewGeofenceRadius] = useState('100');
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [alerts, setAlerts] = useState<string[]>([]);
    const [receivedMessage, setReceivedMessage] = useState<AdminMessage | null>(null);
    const [messageTitle, setMessageTitle] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [targetGeofenceId, setTargetGeofenceId] = useState<string | null>(null);

    // New feature states
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [newZoneColor, setNewZoneColor] = useState('#FF5722');
    const [newZoneIsHome, setNewZoneIsHome] = useState(false);
    const [editColor, setEditColor] = useState('#FF5722');
    const [editIsHome, setEditIsHome] = useState(false);
    const [showSOSModal, setShowSOSModal] = useState(false);
    const [sosAlert, setSOSAlert] = useState<{ userName: string; latitude: number; longitude: number } | null>(null);

    const cameraRef = useRef<Mapbox.Camera>(null);

    // Initialize user
    useEffect(() => {
        const initUser = async () => {
            try {
                let userId = await AsyncStorage.getItem('userId');
                let userName = await AsyncStorage.getItem('userName');
                let userRole = await AsyncStorage.getItem('userRole');

                if (!userId) {
                    userId = generateId();
                    await AsyncStorage.setItem('userId', userId);
                }

                if (!userName) {
                    userName = `User_${userId.substring(0, 6)}`;
                    await AsyncStorage.setItem('userName', userName);
                }

                setCurrentUserId(userId);
                setCurrentUserName(userName);
                setCurrentUserRole(userRole || 'user');
            } catch (error) {
                console.error('Error initializing user:', error);
            }
        };

        initUser();
    }, []);

    // Initialize services
    useEffect(() => {
        const initialize = async () => {
            if (!currentUserId) return;

            try {
                await notificationService.initialize();

                const hasPermission = await locationService.requestPermissions();
                if (!hasPermission) {
                    Alert.alert('Permission Required', 'Location permission is required.');
                    setIsLoading(false);
                    return;
                }

                const location = await locationService.getCurrentLocation();
                setCurrentLocation(location);

                socketService.connect();

                setIsLoading(false);
            } catch (error) {
                console.error('Initialization error:', error);
                setIsLoading(false);
            }
        };

        initialize();

        return () => {
            locationService.stopWatching();
            socketService.disconnect();
        };
    }, [currentUserId]);

    // Socket event listeners
    useEffect(() => {
        if (!currentUserId) return;

        const unsubConnect = socketService.on('_connected', () => {
            setIsConnected(true);
            socketService.registerUser(currentUserId, currentUserName);
        });

        const unsubDisconnect = socketService.on('_disconnected', () => {
            setIsConnected(false);
        });

        const unsubRegistered = socketService.on('user:registered', (data) => {
            locationService.startWatching(
                (location) => {
                    setCurrentLocation(location);
                    socketService.updateLocation(location.latitude, location.longitude, location.accuracy);
                },
                (error) => console.error('Location error:', error),
                5000,
            );
            socketService.getAllLocations();
        });

        const unsubLocation = socketService.on('location:broadcast', (data: UserLocation) => {
            if (data.userId !== currentUserId) {
                setFriendLocations((prev) => {
                    const updated = new Map(prev);
                    updated.set(data.userId, data);
                    return updated;
                });
            }
        });

        const unsubAllLocations = socketService.on('locations:all', (locations: UserLocation[]) => {
            const newMap = new Map<string, UserLocation>();
            locations.forEach((loc) => {
                if (loc.userId !== currentUserId) {
                    newMap.set(loc.userId, loc);
                }
            });
            setFriendLocations(newMap);
        });

        const unsubGeofences = socketService.on('geofences:list', (data: Geofence[]) => {
            setGeofences(data);
        });

        const unsubCreated = socketService.on('geofence:created', (geofence: Geofence) => {
            setGeofences((prev) => [...prev, geofence]);
        });

        const unsubUpdated = socketService.on('geofence:updated', (geofence: Geofence) => {
            setGeofences((prev) => prev.map((g) => (g._id === geofence._id ? geofence : g)));
        });

        const unsubDeleted = socketService.on('geofence:deleted', ({ geofenceId }) => {
            setGeofences((prev) => prev.filter((g) => g._id !== geofenceId));
        });

        const unsubAlert = socketService.on('geofence:alert', async (data) => {
            setAlerts((prev) => [data.message, ...prev.slice(0, 9)]);
            if (data.isSelf) {
                await notificationService.showSelfAlert(data.type, data.geofenceName);
            } else {
                await notificationService.showFriendAlert(data.userName, data.type, data.geofenceName);
            }
        });

        const unsubMessage = socketService.on('message:received', async (data: AdminMessage) => {
            setReceivedMessage(data);
            setShowMessageModal(true);
            await notificationService.showGeofenceAlert(
                data.title || 'Message',
                data.content,
                false
            );
        });

        // SOS alert listener
        const unsubSOS = socketService.on('sos:alert', async (data: any) => {
            setSOSAlert({ userName: data.userName, latitude: data.latitude, longitude: data.longitude });
            setShowSOSModal(true);
            await notificationService.showGeofenceAlert(
                '🚨 SOS EMERGENCY',
                `${data.userName} needs help! Tap to see location.`,
                true
            );
        });

        return () => {
            unsubConnect();
            unsubDisconnect();
            unsubRegistered();
            unsubLocation();
            unsubAllLocations();
            unsubGeofences();
            unsubCreated();
            unsubUpdated();
            unsubDeleted();
            unsubAlert();
            unsubMessage();
            unsubSOS();
        };
    }, [currentUserId, currentUserName]);

    // Map long press handler (ADMIN ONLY)
    const handleMapLongPress = useCallback((event: any) => {
        // Only allow admins to create zones
        if (currentUserRole !== 'admin') {
            return;
        }
        const { geometry } = event;
        if (geometry && geometry.coordinates) {
            setSelectedLocation({
                lng: geometry.coordinates[0],
                lat: geometry.coordinates[1],
            });
            setShowCreateModal(true);
        }
    }, [currentUserRole]);

    // Create geofence
    const createGeofence = () => {
        if (!selectedLocation || !newGeofenceName.trim()) {
            Alert.alert('Error', 'Please enter a name for the geofence');
            return;
        }

        const radius = parseInt(newGeofenceRadius, 10) || 100;

        socketService.createGeofence({
            name: newGeofenceName.trim(),
            centerLat: selectedLocation.lat,
            centerLng: selectedLocation.lng,
            radius,
            type: 'restricted',
        });

        setShowCreateModal(false);
        setNewGeofenceName('');
        setNewGeofenceRadius('100');
        setSelectedLocation(null);
    };

    // Open edit modal
    const openEditModal = (geofence: Geofence) => {
        setSelectedGeofence(geofence);
        setEditName(geofence.name);
        setEditRadius(geofence.radius.toString());
        setShowEditModal(true);
    };

    // Save geofence edit
    const saveGeofenceEdit = () => {
        if (!selectedGeofence || !editName.trim()) {
            Alert.alert('Error', 'Please enter a name');
            return;
        }

        socketService.emit('geofence:update', {
            geofenceId: selectedGeofence._id,
            name: editName.trim(),
            radius: parseInt(editRadius, 10) || selectedGeofence.radius,
        });

        setShowEditModal(false);
        setSelectedGeofence(null);
    };

    // Delete geofence
    const deleteGeofence = (geofenceId: string, geofenceName: string) => {
        Alert.alert(
            'Delete Geofence',
            `Are you sure you want to delete "${geofenceName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => socketService.deleteGeofence(geofenceId),
                },
            ],
        );
    };

    // Send admin message
    const sendAdminMessage = () => {
        if (!messageContent.trim()) {
            Alert.alert('Error', 'Please enter a message');
            return;
        }

        socketService.emit('message:send', {
            title: messageTitle.trim() || 'Admin Message',
            content: messageContent.trim(),
            targetGeofenceId: targetGeofenceId,
        });

        setShowSendMessageModal(false);
        setMessageTitle('');
        setMessageContent('');
        setTargetGeofenceId(null);
        Alert.alert('Success', 'Message sent!');
    };

    // Logout with confirmation
    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.multiRemove(['authToken', 'userId', 'userName', 'userRole']);
                        navigation?.replace('Login');
                    },
                },
            ]
        );
    };

    // Center map
    const centerOnUser = () => {
        if (currentLocation && cameraRef.current) {
            cameraRef.current.setCamera({
                centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
                zoomLevel: 15,
                animationDuration: 1000,
            });
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Initializing RakshaKavach...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Status Bar */}
            <View style={styles.statusBar}>
                <View style={styles.statusLeft}>
                    <View style={[styles.connectionDot, isConnected ? styles.connected : styles.disconnected]} />
                    <Text style={styles.statusText}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
                    <TouchableOpacity
                        style={styles.darkModeToggle}
                        onPress={() => setIsDarkMode(!isDarkMode)}
                    >
                        <Text style={styles.darkModeToggleIcon}>{isDarkMode ? '🌙' : '☀️'}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.statusRight}>
                    <Text style={styles.userNameText}>👤 {currentUserName}</Text>
                    {currentUserRole === 'admin' && <Text style={styles.adminBadge}>ADMIN</Text>}
                </View>
            </View>

            {/* Map */}
            <Mapbox.MapView
                style={styles.map}
                styleURL={isDarkMode ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
                onLongPress={handleMapLongPress}
            >
                <Mapbox.Camera
                    ref={cameraRef}
                    zoomLevel={14}
                    centerCoordinate={currentLocation ? [currentLocation.longitude, currentLocation.latitude] : [0, 0]}
                />

                {geofences.map((geofence) => (
                    <GeofenceCircle
                        key={geofence._id}
                        id={geofence._id}
                        name={geofence.name}
                        centerLat={geofence.centerLat}
                        centerLng={geofence.centerLng}
                        radius={geofence.radius}
                        type={geofence.type}
                        color={geofence.color}
                    />
                ))}

                {currentLocation && (
                    <UserMarker
                        userId={currentUserId}
                        name={currentUserName}
                        latitude={currentLocation.latitude}
                        longitude={currentLocation.longitude}
                        isCurrentUser
                    />
                )}

                {Array.from(friendLocations.values()).map((friend) => (
                    <UserMarker
                        key={friend.userId}
                        userId={friend.userId}
                        name={friend.name}
                        latitude={friend.latitude}
                        longitude={friend.longitude}
                    />
                ))}
            </Mapbox.MapView>

            {/* SOS Button - Always visible, prominent */}
            <TouchableOpacity
                style={styles.sosButton}
                onPress={() => {
                    Alert.alert(
                        '🚨 Send SOS Alert?',
                        'This will notify ALL connected users of your emergency and share your location.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'SEND SOS',
                                style: 'destructive',
                                onPress: () => {
                                    if (currentLocation) {
                                        socketService.emit('sos:trigger', {
                                            latitude: currentLocation.latitude,
                                            longitude: currentLocation.longitude,
                                        });
                                        Alert.alert('SOS Sent', 'Emergency alert sent to all users!');
                                    }
                                },
                            },
                        ]
                    );
                }}
            >
                <Text style={styles.sosButtonText}>SOS</Text>
            </TouchableOpacity>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.controlButton, isDarkMode && styles.controlButtonDark]}
                    onPress={centerOnUser}
                >
                    <Text style={[styles.controlIcon, isDarkMode && styles.controlIconDark]}>📍</Text>
                </TouchableOpacity>
                {currentUserRole === 'admin' && (
                    <TouchableOpacity
                        style={[styles.controlButton, isDarkMode && styles.controlButtonDark]}
                        onPress={() => setShowSendMessageModal(true)}
                    >
                        <Text style={[styles.controlIcon, isDarkMode && styles.controlIconDark]}>📢</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutIcon}>↪</Text>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            {/* Users online */}
            <View style={styles.usersOnline}>
                <Text style={styles.usersOnlineText}>👥 {friendLocations.size + 1} online</Text>
            </View>

            {/* Recent alerts */}
            {alerts.length > 0 && (
                <View style={styles.alertsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {alerts.slice(0, 3).map((alert, index) => (
                            <View key={index} style={styles.alertItem}>
                                <Text style={styles.alertText} numberOfLines={1}>{alert}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Geofence list */}
            <View style={styles.geofenceList}>
                <Text style={styles.geofenceListTitle}>
                    {currentUserRole === 'admin'
                        ? 'Geofences — Tap to Edit, Hold to Delete (Admin)'
                        : 'Zones (View Only) — Managed by Admin'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {geofences.map((geofence) => (
                        currentUserRole === 'admin' ? (
                            <TouchableOpacity
                                key={geofence._id}
                                style={styles.geofenceItem}
                                onPress={() => openEditModal(geofence)}
                                onLongPress={() => deleteGeofence(geofence._id, geofence.name)}
                            >
                                <Text style={styles.geofenceIcon}>{geofence.type === 'restricted' ? '🚫' : '✅'}</Text>
                                <Text style={styles.geofenceName} numberOfLines={1}>{geofence.name}</Text>
                                <Text style={styles.geofenceRadius}>{geofence.radius}m</Text>
                            </TouchableOpacity>
                        ) : (
                            <View key={geofence._id} style={styles.geofenceItemReadOnly}>
                                <Text style={styles.geofenceIcon}>{geofence.type === 'restricted' ? '🚫' : '✅'}</Text>
                                <Text style={styles.geofenceName} numberOfLines={1}>{geofence.name}</Text>
                                <Text style={styles.geofenceRadius}>{geofence.radius}m</Text>
                            </View>
                        )
                    ))}
                    {geofences.length === 0 && (
                        <Text style={styles.noGeofences}>
                            {currentUserRole === 'admin' ? 'Long press on map to create' : 'No zones configured'}
                        </Text>
                    )}
                </ScrollView>
            </View>

            {/* Create Modal */}
            <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Restricted Zone</Text>
                        <TextInput style={styles.input} placeholder="Zone Name" value={newGeofenceName} onChangeText={setNewGeofenceName} placeholderTextColor="#999" />
                        <TextInput style={styles.input} placeholder="Radius (meters)" value={newGeofenceRadius} onChangeText={setNewGeofenceRadius} keyboardType="numeric" placeholderTextColor="#999" />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowCreateModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.createButton]} onPress={createGeofence}>
                                <Text style={styles.createButtonText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Modal */}
            <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Zone</Text>
                        <TextInput style={styles.input} placeholder="Zone Name" value={editName} onChangeText={setEditName} placeholderTextColor="#999" />
                        <TextInput style={styles.input} placeholder="Radius (meters)" value={editRadius} onChangeText={setEditRadius} keyboardType="numeric" placeholderTextColor="#999" />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowEditModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.createButton]} onPress={saveGeofenceEdit}>
                                <Text style={styles.createButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Received Message Modal */}
            <Modal visible={showMessageModal} transparent animationType="fade" onRequestClose={() => setShowMessageModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.messageModalContent}>
                        <Text style={styles.messageTitle}>{receivedMessage?.title || 'Message'}</Text>
                        <Text style={styles.messageContent}>{receivedMessage?.content}</Text>
                        <Text style={styles.messageSender}>From: {receivedMessage?.sentByName}</Text>
                        <TouchableOpacity style={styles.messageButton} onPress={() => setShowMessageModal(false)}>
                            <Text style={styles.messageButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Send Message Modal (Admin) */}
            <Modal visible={showSendMessageModal} transparent animationType="slide" onRequestClose={() => setShowSendMessageModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Send Message</Text>
                        <TextInput style={styles.input} placeholder="Title" value={messageTitle} onChangeText={setMessageTitle} placeholderTextColor="#999" />
                        <TextInput style={[styles.input, styles.textArea]} placeholder="Message content" value={messageContent} onChangeText={setMessageContent} placeholderTextColor="#999" multiline numberOfLines={3} />
                        <Text style={styles.label}>Target Zone (optional)</Text>
                        <ScrollView horizontal style={styles.zoneSelector}>
                            <TouchableOpacity style={[styles.zoneOption, !targetGeofenceId && styles.zoneSelected]} onPress={() => setTargetGeofenceId(null)}>
                                <Text style={styles.zoneOptionText}>All Users</Text>
                            </TouchableOpacity>
                            {geofences.map((g) => (
                                <TouchableOpacity key={g._id} style={[styles.zoneOption, targetGeofenceId === g._id && styles.zoneSelected]} onPress={() => setTargetGeofenceId(g._id)}>
                                    <Text style={styles.zoneOptionText}>{g.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowSendMessageModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.createButton]} onPress={sendAdminMessage}>
                                <Text style={styles.createButtonText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* SOS Alert Received Modal */}
            <Modal visible={showSOSModal} transparent animationType="fade" onRequestClose={() => setShowSOSModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.sosModalContent}>
                        <Text style={styles.sosTitle}>🚨 SOS EMERGENCY</Text>
                        <Text style={styles.sosMessage}>{sosAlert?.userName} needs help!</Text>
                        <Text style={styles.sosCoords}>
                            Location: {sosAlert?.latitude?.toFixed(6)}, {sosAlert?.longitude?.toFixed(6)}
                        </Text>
                        <View style={styles.sosButtons}>
                            <TouchableOpacity
                                style={styles.sosViewButton}
                                onPress={() => {
                                    if (sosAlert && cameraRef.current) {
                                        cameraRef.current.setCamera({
                                            centerCoordinate: [sosAlert.longitude, sosAlert.latitude],
                                            zoomLevel: 16,
                                            animationDuration: 1000,
                                        });
                                    }
                                    setShowSOSModal(false);
                                }}
                            >
                                <Text style={styles.createButtonText}>View Location</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sosDismissButton}
                                onPress={() => setShowSOSModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Dismiss</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#fff' },
    statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 40 },
    statusLeft: { flexDirection: 'row', alignItems: 'center' },
    statusRight: { flexDirection: 'row', alignItems: 'center' },
    connectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    connected: { backgroundColor: '#4CAF50' },
    disconnected: { backgroundColor: '#F44336' },
    statusText: { color: '#fff', fontSize: 14 },
    userNameText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    adminBadge: { marginLeft: 8, backgroundColor: '#FF9800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 10, color: '#fff', fontWeight: '700' },
    darkModeToggle: { marginLeft: 12, padding: 6 },
    darkModeToggleIcon: { fontSize: 18 },
    map: { flex: 1 },
    controls: { position: 'absolute', right: 16, top: 120 },
    controlButton: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, marginBottom: 10 },
    controlButtonDark: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
    controlIcon: { fontSize: 24 },
    controlIconDark: { opacity: 0.9 },
    darkModeButton: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, marginBottom: 10 },
    darkModeButtonActive: { backgroundColor: '#2a2a3e' },
    darkModeIcon: { fontSize: 22 },
    darkModeIconActive: {},
    logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F44336', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, marginTop: 10 },
    logoutIcon: { fontSize: 16, color: '#fff', marginRight: 4 },
    logoutText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    sosButton: { position: 'absolute', left: 16, bottom: 150, width: 70, height: 70, backgroundColor: '#F44336', borderRadius: 35, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, borderWidth: 3, borderColor: '#fff' },
    sosButtonText: { color: '#fff', fontSize: 18, fontWeight: '900' },
    sosModalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400, alignItems: 'center', borderWidth: 2, borderColor: '#F44336' },
    sosTitle: { color: '#F44336', fontSize: 24, fontWeight: '700', marginBottom: 16 },
    sosMessage: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 12 },
    sosCoords: { color: '#888', fontSize: 12, marginBottom: 16 },
    sosButtons: { flexDirection: 'row', gap: 12 },
    sosViewButton: { backgroundColor: '#4CAF50', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
    sosDismissButton: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
    usersOnline: { position: 'absolute', left: 16, top: 120, backgroundColor: 'rgba(26, 26, 46, 0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    usersOnlineText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    alertsContainer: { position: 'absolute', top: 180, left: 16, right: 16 },
    alertItem: { backgroundColor: 'rgba(244, 67, 54, 0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, maxWidth: 250 },
    alertText: { color: '#fff', fontSize: 12 },
    geofenceList: { position: 'absolute', bottom: 30, left: 0, right: 0, backgroundColor: 'rgba(26, 26, 46, 0.95)', paddingVertical: 12, paddingHorizontal: 16 },
    geofenceListTitle: { color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 8, opacity: 0.7 },
    geofenceItem: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 10, alignItems: 'center', minWidth: 80 },
    geofenceItemReadOnly: { backgroundColor: 'rgba(100, 100, 100, 0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 10, alignItems: 'center', minWidth: 80, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
    geofenceIcon: { fontSize: 20, marginBottom: 4 },
    geofenceName: { color: '#fff', fontSize: 12, fontWeight: '500' },
    geofenceRadius: { color: '#888', fontSize: 10, marginTop: 2 },
    noGeofences: { color: '#888', fontSize: 12, fontStyle: 'italic' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
    input: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 16, marginBottom: 12 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    label: { color: '#aaa', fontSize: 14, marginBottom: 8 },
    zoneSelector: { marginBottom: 16 },
    zoneOption: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
    zoneSelected: { backgroundColor: '#4CAF50' },
    zoneOptionText: { color: '#fff', fontSize: 12 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    modalButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    cancelButton: { backgroundColor: 'rgba(255, 255, 255, 0.1)', marginRight: 8 },
    cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    createButton: { backgroundColor: '#4CAF50', marginLeft: 8 },
    createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    messageModalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400, alignItems: 'center' },
    messageTitle: { color: '#FF9800', fontSize: 20, fontWeight: '700', marginBottom: 16 },
    messageContent: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16, lineHeight: 24 },
    messageSender: { color: '#888', fontSize: 12, marginBottom: 16 },
    messageButton: { backgroundColor: '#4CAF50', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
    messageButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default MapScreen;
