// Socket.IO client service for real-time communication
import { io, Socket } from 'socket.io-client';

// Server URL - your laptop's WiFi IP
const SERVER_URL = 'http://10.20.3.243:3000';

class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();

    connect(): Socket {
        if (this.socket?.connected) {
            return this.socket;
        }

        this.socket = io(SERVER_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket?.id);
            this.emit('_connected', { socketId: this.socket?.id });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.emit('_disconnected', { reason });
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        // Re-emit all registered events
        this.listeners.forEach((callbacks, event) => {
            if (!event.startsWith('_')) {
                this.socket?.on(event, (data) => {
                    callbacks.forEach((callback) => callback(data));
                });
            }
        });

        return this.socket;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    // Register user with the server
    registerUser(userId: string, name: string): void {
        this.socket?.emit('user:register', { userId, name });
    }

    // Send location update
    updateLocation(latitude: number, longitude: number, accuracy?: number): void {
        this.socket?.emit('location:update', { latitude, longitude, accuracy });
    }

    // Create geofence
    createGeofence(data: {
        name: string;
        centerLat: number;
        centerLng: number;
        radius: number;
        type: 'restricted' | 'safe';
    }): void {
        this.socket?.emit('geofence:create', data);
    }

    // Delete geofence
    deleteGeofence(geofenceId: string): void {
        this.socket?.emit('geofence:delete', { geofenceId });
    }

    // Request all locations
    getAllLocations(): void {
        this.socket?.emit('locations:getAll');
    }

    // Subscribe to events
    on(event: string, callback: (data: any) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback);

        // If socket is already connected, register the listener
        if (this.socket && !event.startsWith('_')) {
            this.socket.on(event, callback);
        }

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
            if (this.socket && !event.startsWith('_')) {
                this.socket.off(event, callback);
            }
        };
    }

    // Emit custom event
    emit(event: string, data?: any): void {
        if (event.startsWith('_')) {
            // Internal event
            this.listeners.get(event)?.forEach((callback) => callback(data));
        } else {
            this.socket?.emit(event, data);
        }
    }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
