// User Marker component for displaying users on the map
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Mapbox from '@rnmapbox/maps';

interface UserMarkerProps {
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    isCurrentUser?: boolean;
}

const UserMarker: React.FC<UserMarkerProps> = ({
    userId,
    name,
    latitude,
    longitude,
    isCurrentUser = false,
}) => {
    return (
        <Mapbox.MarkerView
            id={`marker-${userId}`}
            coordinate={[longitude, latitude]}
            anchor={{ x: 0.5, y: 1 }}
        >
            <View style={styles.markerContainer}>
                <View
                    style={[
                        styles.marker,
                        isCurrentUser ? styles.currentUserMarker : styles.friendMarker,
                    ]}
                >
                    <Text style={styles.markerEmoji}>
                        {isCurrentUser ? '📍' : '👤'}
                    </Text>
                </View>
                <View
                    style={[
                        styles.nameTag,
                        isCurrentUser ? styles.currentUserTag : styles.friendTag,
                    ]}
                >
                    <Text style={styles.nameText} numberOfLines={1}>
                        {isCurrentUser ? 'You' : name}
                    </Text>
                </View>
                <View
                    style={[
                        styles.markerTail,
                        isCurrentUser ? styles.currentUserTail : styles.friendTail,
                    ]}
                />
            </View>
        </Mapbox.MarkerView>
    );
};

const styles = StyleSheet.create({
    markerContainer: {
        alignItems: 'center',
    },
    marker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    currentUserMarker: {
        backgroundColor: '#4CAF50',
        borderWidth: 3,
        borderColor: '#fff',
    },
    friendMarker: {
        backgroundColor: '#2196F3',
        borderWidth: 3,
        borderColor: '#fff',
    },
    markerEmoji: {
        fontSize: 18,
    },
    nameTag: {
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        maxWidth: 100,
    },
    currentUserTag: {
        backgroundColor: '#4CAF50',
    },
    friendTag: {
        backgroundColor: '#2196F3',
    },
    nameText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    markerTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    currentUserTail: {
        borderTopColor: '#4CAF50',
    },
    friendTail: {
        borderTopColor: '#2196F3',
    },
});

export default UserMarker;
