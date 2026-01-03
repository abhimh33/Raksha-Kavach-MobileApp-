/**
 * Geofence Detection Service
 * Uses Haversine formula to calculate distance between two points
 */

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Convert degrees to radians
 */
const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS * c;
};

/**
 * Check if a point is inside a geofence
 * @param {number} lat - User's latitude
 * @param {number} lng - User's longitude
 * @param {Object} geofence - Geofence object with centerLat, centerLng, radius
 * @returns {boolean} True if inside the geofence
 */
const isInsideGeofence = (lat, lng, geofence) => {
    const distance = calculateDistance(
        lat,
        lng,
        geofence.centerLat,
        geofence.centerLng
    );
    return distance <= geofence.radius;
};

/**
 * Check all geofences for a user and detect enter/exit events
 * @param {string} userId - User's ID
 * @param {number} lat - Current latitude
 * @param {number} lng - Current longitude
 * @param {Array} geofences - Array of geofence objects
 * @param {Object} previousStates - Previous geofence states for the user
 * @returns {Object} { events: Array, newStates: Object }
 */
const checkGeofences = (userId, lat, lng, geofences, previousStates = {}) => {
    const events = [];
    const newStates = {};

    geofences.forEach(geofence => {
        const geofenceId = geofence._id.toString();
        const isInside = isInsideGeofence(lat, lng, geofence);
        const wasInside = previousStates[geofenceId] || false;

        newStates[geofenceId] = isInside;

        // Detect ENTER event (was outside, now inside)
        if (!wasInside && isInside) {
            events.push({
                type: 'ENTER',
                geofenceId: geofence._id,
                geofenceName: geofence.name,
                geofenceType: geofence.type,
                userId,
                latitude: lat,
                longitude: lng,
                timestamp: new Date(),
            });
        }

        // Detect EXIT event (was inside, now outside)
        if (wasInside && !isInside) {
            events.push({
                type: 'EXIT',
                geofenceId: geofence._id,
                geofenceName: geofence.name,
                geofenceType: geofence.type,
                userId,
                latitude: lat,
                longitude: lng,
                timestamp: new Date(),
            });
        }
    });

    return { events, newStates };
};

module.exports = {
    calculateDistance,
    isInsideGeofence,
    checkGeofences,
};
