const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const { initializeSocketHandlers } = require('./socket/handlers');
const Geofence = require('./models/Geofence');
const authRoutes = require('./routes/authRoutes');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Initialize Socket.IO handlers
initializeSocketHandlers(io);

// REST API Routes

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'RakshaKavach Server Running',
        timestamp: new Date().toISOString(),
    });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Get all active geofences
app.get('/api/geofences', async (req, res) => {
    try {
        const geofences = await Geofence.find({ isActive: true });
        res.json(geofences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new geofence
app.post('/api/geofences', async (req, res) => {
    try {
        const { name, centerLat, centerLng, radius, type, createdBy } = req.body;
        const geofence = await Geofence.create({
            name,
            centerLat,
            centerLng,
            radius: radius || 100,
            type: type || 'restricted',
            createdBy: createdBy || 'system',
            isActive: true,
        });

        // Broadcast to all connected clients
        io.emit('geofence:created', geofence);

        res.status(201).json(geofence);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a geofence
app.put('/api/geofences/:id', async (req, res) => {
    try {
        const { name, centerLat, centerLng, radius, type } = req.body;
        const geofence = await Geofence.findByIdAndUpdate(
            req.params.id,
            { name, centerLat, centerLng, radius, type },
            { new: true }
        );

        // Broadcast to all connected clients
        io.emit('geofence:updated', geofence);

        res.json(geofence);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a geofence
app.delete('/api/geofences/:id', async (req, res) => {
    try {
        await Geofence.findByIdAndUpdate(req.params.id, { isActive: false });

        // Broadcast to all connected clients
        io.emit('geofence:deleted', { geofenceId: req.params.id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🛡️  RakshaKavach Server Started                         ║
║                                                           ║
║   Server running on port: ${PORT}                            ║
║   Auth API: /api/auth (register, login, me, profile)      ║
║   Socket.IO enabled for real-time communication           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
