// GPS Location tracking service
import Geolocation, {
    GeoPosition,
    GeoError,
    GeoOptions,
} from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

class LocationService {
    private watchId: number | null = null;
    private lastLocation: LocationData | null = null;

    // Request location permissions for Android
    async requestPermissions(): Promise<boolean> {
        if (Platform.OS === 'android') {
            try {
                // Request fine location
                const fineLocation = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'RakshaKavach Location Permission',
                        message:
                            'RakshaKavach needs access to your location for real-time tracking and geofence alerts.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );

                if (fineLocation !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert(
                        'Permission Denied',
                        'Location permission is required for this app to work properly.',
                    );
                    return false;
                }

                // Request background location for Android 10+
                if (Platform.Version >= 29) {
                    const backgroundLocation = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                        {
                            title: 'Background Location Permission',
                            message:
                                'RakshaKavach needs background location access to send alerts when you enter or exit geofence zones.',
                            buttonNeutral: 'Ask Me Later',
                            buttonNegative: 'Cancel',
                            buttonPositive: 'OK',
                        },
                    );

                    if (backgroundLocation !== PermissionsAndroid.RESULTS.GRANTED) {
                        console.log('Background location permission denied');
                    }
                }

                return true;
            } catch (error) {
                console.error('Error requesting permissions:', error);
                return false;
            }
        }
        return true;
    }

    // Get current location once
    getCurrentLocation(): Promise<LocationData> {
        return new Promise((resolve, reject) => {
            const options: GeoOptions = {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000,
            };

            Geolocation.getCurrentPosition(
                (position: GeoPosition) => {
                    const location: LocationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                    };
                    this.lastLocation = location;
                    resolve(location);
                },
                (error: GeoError) => {
                    console.error('Get current location error:', error);
                    reject(error);
                },
                options,
            );
        });
    }

    // Start watching location updates
    startWatching(
        onLocationUpdate: (location: LocationData) => void,
        onError?: (error: GeoError) => void,
        intervalMs: number = 5000,
    ): void {
        if (this.watchId !== null) {
            this.stopWatching();
        }

        const options: GeoOptions = {
            enableHighAccuracy: true,
            distanceFilter: 5, // Minimum distance (meters) to trigger update
            interval: intervalMs, // Android only
            fastestInterval: intervalMs / 2, // Android only
        };

        this.watchId = Geolocation.watchPosition(
            (position: GeoPosition) => {
                const location: LocationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                };
                this.lastLocation = location;
                onLocationUpdate(location);
            },
            (error: GeoError) => {
                console.error('Watch location error:', error);
                onError?.(error);
            },
            options,
        );

        console.log('Location watching started with watchId:', this.watchId);
    }

    // Stop watching location
    stopWatching(): void {
        if (this.watchId !== null) {
            Geolocation.clearWatch(this.watchId);
            this.watchId = null;
            console.log('Location watching stopped');
        }
    }

    // Get last known location
    getLastLocation(): LocationData | null {
        return this.lastLocation;
    }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;
