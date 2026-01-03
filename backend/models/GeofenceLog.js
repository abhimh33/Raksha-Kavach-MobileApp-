const mongoose = require('mongoose');

const geofenceLogSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    userName: {
        type: String,
        required: true,
    },
    geofenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Geofence',
        required: true,
    },
    geofenceName: {
        type: String,
        required: true,
    },
    eventType: {
        type: String,
        enum: ['ENTER', 'EXIT'],
        required: true,
    },
    latitude: {
        type: Number,
        required: true,
    },
    longitude: {
        type: Number,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Index for efficient querying
geofenceLogSchema.index({ userId: 1, timestamp: -1 });
geofenceLogSchema.index({ geofenceId: 1, timestamp: -1 });

module.exports = mongoose.model('GeofenceLog', geofenceLogSchema);
