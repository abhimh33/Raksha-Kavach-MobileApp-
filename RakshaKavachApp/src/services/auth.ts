// Authentication API service
import AsyncStorage from '@react-native-async-storage/async-storage';

// Server URL - your laptop's WiFi IP
const API_URL = 'http://10.20.3.243:3000/api';

interface AuthResponse {
    success: boolean;
    token?: string;
    user?: {
        userId: string;
        username: string;
        displayName: string;
        role: string;
    };
    message?: string;
}

class AuthService {
    private token: string | null = null;

    // Initialize - load token from storage
    async initialize(): Promise<boolean> {
        try {
            this.token = await AsyncStorage.getItem('authToken');
            return !!this.token;
        } catch (error) {
            console.error('Error loading auth token:', error);
            return false;
        }
    }

    // Register new user
    async register(username: string, password: string, displayName: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, displayName }),
            });

            const data = await response.json();

            if (data.success && data.token) {
                this.token = data.token;
                await AsyncStorage.setItem('authToken', data.token);
                await AsyncStorage.setItem('userId', data.user.userId);
                await AsyncStorage.setItem('userName', data.user.displayName);
                await AsyncStorage.setItem('userRole', data.user.role);
            }

            return data;
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Login user
    async login(username: string, password: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (data.success && data.token) {
                this.token = data.token;
                await AsyncStorage.setItem('authToken', data.token);
                await AsyncStorage.setItem('userId', data.user.userId);
                await AsyncStorage.setItem('userName', data.user.displayName);
                await AsyncStorage.setItem('userRole', data.user.role);
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Get current user
    async getCurrentUser(): Promise<AuthResponse> {
        try {
            if (!this.token) {
                return { success: false, message: 'Not logged in' };
            }

            const response = await fetch(`${API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            return response.json();
        } catch (error) {
            console.error('Get user error:', error);
            return { success: false, message: 'Network error' };
        }
    }

    // Update display name
    async updateDisplayName(displayName: string): Promise<AuthResponse> {
        try {
            if (!this.token) {
                return { success: false, message: 'Not logged in' };
            }

            const response = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({ displayName }),
            });

            const data = await response.json();

            if (data.success) {
                await AsyncStorage.setItem('userName', data.user.displayName);
            }

            return data;
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, message: 'Network error' };
        }
    }

    // Logout
    async logout(): Promise<void> {
        this.token = null;
        await AsyncStorage.multiRemove(['authToken', 'userId', 'userName', 'userRole']);
    }

    // Check if logged in
    async isLoggedIn(): Promise<boolean> {
        const token = await AsyncStorage.getItem('authToken');
        return !!token;
    }

    // Get stored user info
    async getStoredUser() {
        const userId = await AsyncStorage.getItem('userId');
        const userName = await AsyncStorage.getItem('userName');
        const userRole = await AsyncStorage.getItem('userRole');
        return { userId, userName, userRole };
    }

    // Get auth token
    getToken(): string | null {
        return this.token;
    }
}

export const authService = new AuthService();
export default authService;
