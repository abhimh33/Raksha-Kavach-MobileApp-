const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    latitude: {
        type: Number,
        required: true,
    },
    longitude: {
        type: Number,
        required: true,
    },
    accuracy: {
        type: Number,
        default: 0,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Index for efficient querying
locationSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);
