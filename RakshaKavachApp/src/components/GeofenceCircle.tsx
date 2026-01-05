// Geofence Circle component for displaying geofence zones on the map
import React from 'react';
import Mapbox from '@rnmapbox/maps';

interface GeofenceCircleProps {
    id: string;
    name: string;
    centerLat: number;
    centerLng: number;
    radius: number;
    type: 'restricted' | 'safe' | 'home';
    color?: string;
}

// Generate circle coordinates from center point and radius
const generateCircleCoordinates = (
    centerLng: number,
    centerLat: number,
    radiusInMeters: number,
    points: number = 64,
): [number, number][] => {
    const coordinates: [number, number][] = [];
    const earthRadius = 6371000; // Earth's radius in meters

    for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const latOffset =
            (radiusInMeters / earthRadius) * (180 / Math.PI) * Math.cos(angle);
        const lngOffset =
            ((radiusInMeters / earthRadius) * (180 / Math.PI) * Math.sin(angle)) /
            Math.cos((centerLat * Math.PI) / 180);

        coordinates.push([centerLng + lngOffset, centerLat + latOffset]);
    }

    // Close the circle
    coordinates.push(coordinates[0]);

    return coordinates;
};

// Color presets for zones
const getZoneColors = (type: string, customColor?: string) => {
    if (customColor) {
        // Convert hex to rgba for fill
        const r = parseInt(customColor.slice(1, 3), 16);
        const g = parseInt(customColor.slice(3, 5), 16);
        const b = parseInt(customColor.slice(5, 7), 16);
        return {
            fill: `rgba(${r}, ${g}, ${b}, 0.25)`,
            stroke: customColor,
        };
    }

    switch (type) {
        case 'home':
            return { fill: 'rgba(33, 150, 243, 0.25)', stroke: '#2196F3' }; // Blue for home
        case 'safe':
            return { fill: 'rgba(76, 175, 80, 0.25)', stroke: '#4CAF50' }; // Green for safe
        default:
            return { fill: 'rgba(244, 67, 54, 0.25)', stroke: '#F44336' }; // Red for restricted
    }
};

const GeofenceCircle: React.FC<GeofenceCircleProps> = ({
    id,
    name,
    centerLat,
    centerLng,
    radius,
    type,
    color,
}) => {
    const circleCoordinates = generateCircleCoordinates(
        centerLng,
        centerLat,
        radius,
    );

    const colors = getZoneColors(type, color);

    const circleShape: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        properties: {
            id,
            name,
            type,
        },
        geometry: {
            type: 'Polygon',
            coordinates: [circleCoordinates],
        },
    };

    return (
        <>
            {/* Fill */}
            <Mapbox.ShapeSource id={`geofence-fill-${id}`} shape={circleShape}>
                <Mapbox.FillLayer
                    id={`geofence-fill-layer-${id}`}
                    style={{
                        fillColor: colors.fill,
                        fillOpacity: 0.6,
                    }}
                />
            </Mapbox.ShapeSource>

            {/* Outline */}
            <Mapbox.ShapeSource id={`geofence-line-${id}`} shape={circleShape}>
                <Mapbox.LineLayer
                    id={`geofence-line-layer-${id}`}
                    style={{
                        lineColor: colors.stroke,
                        lineWidth: 3,
                        lineDasharray: type === 'restricted' ? [2, 2] : [1, 0],
                    }}
                />
            </Mapbox.ShapeSource>

            {/* Center marker with name */}
            <Mapbox.MarkerView
                id={`geofence-marker-${id}`}
                coordinate={[centerLng, centerLat]}
            >
                <Mapbox.Callout title={`${type === 'home' ? '🏠 ' : ''}${name}`} />
            </Mapbox.MarkerView>
        </>
    );
};

export default GeofenceCircle;
