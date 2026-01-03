const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        default: 'Admin Message',
    },
    targetGeofenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Geofence',
        default: null, // null means broadcast to all
    },
    targetGeofenceName: {
        type: String,
        default: null,
    },
    sentBy: {
        type: String,
        required: true,
    },
    sentByName: {
        type: String,
        required: true,
    },
    recipients: [{
        userId: String,
        receivedAt: Date,
        read: Boolean,
    }],
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Message', messageSchema);
