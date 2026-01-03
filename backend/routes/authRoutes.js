const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// JWT secret (in production, use environment variable)
const JWT_SECRET = 'rakshakavach-secret-key-2024';
const JWT_EXPIRES_IN = '7d';

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;

        if (!username || !password || !displayName) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, and display name are required',
            });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists',
            });
        }

        // Generate unique userId
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create user
        const user = await User.create({
            userId,
            username,
            password,
            displayName,
            role: 'user',
        });

        // Generate token
        const token = generateToken(user.userId);

        res.status(201).json({
            success: true,
            token,
            user: {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message,
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        // Find user with password
        const user = await User.findOne({ username }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password',
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password',
            });
        }

        // Generate token
        const token = generateToken(user.userId);

        res.json({
            success: true,
            token,
            user: {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message,
        });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findOne({ userId: decoded.userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.json({
            success: true,
            user: {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token',
        });
    }
});

// Update user display name
router.put('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        const { displayName } = req.body;
        if (!displayName) {
            return res.status(400).json({
                success: false,
                message: 'Display name is required',
            });
        }

        const user = await User.findOneAndUpdate(
            { userId: decoded.userId },
            { displayName },
            { new: true }
        );

        res.json({
            success: true,
            user: {
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profile update failed',
        });
    }
});

// Create admin user (one-time setup)
router.post('/create-admin', async (req, res) => {
    try {
        const { username, password, displayName, adminSecret } = req.body;

        // Simple admin creation secret
        if (adminSecret !== 'rakshakavach-admin-2024') {
            return res.status(403).json({
                success: false,
                message: 'Invalid admin secret',
            });
        }

        const userId = `admin_${Date.now()}`;

        const admin = await User.create({
            userId,
            username,
            password,
            displayName,
            role: 'admin',
        });

        const token = generateToken(admin.userId);

        res.status(201).json({
            success: true,
            token,
            user: {
                userId: admin.userId,
                username: admin.username,
                displayName: admin.displayName,
                role: admin.role,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Admin creation failed',
            error: error.message,
        });
    }
});

module.exports = router;
