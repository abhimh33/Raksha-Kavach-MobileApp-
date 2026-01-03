const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    centerLat: {
        type: Number,
        required: true,
    },
    centerLng: {
        type: Number,
        required: true,
    },
    radius: {
        type: Number,
        required: true,
        min: 10, // Minimum 10 meters
    },
    type: {
        type: String,
        enum: ['restricted', 'safe', 'home'],
        default: 'restricted',
    },
    color: {
        type: String,
        default: '#FF5722', // Default orange-red
    },
    isHome: {
        type: Boolean,
        default: false,
    },
    assignedUsers: [{
        type: String,
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Geofence', geofenceSchema);
