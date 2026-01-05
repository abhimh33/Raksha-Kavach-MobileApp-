// Notification service using Notifee
import notifee, {
    AndroidImportance,
    AndroidColor,
    EventType,
} from '@notifee/react-native';

class NotificationService {
    private channelId: string = 'rakshakavach-alerts';

    async initialize(): Promise<void> {
        // Create notification channel for Android
        await notifee.createChannel({
            id: this.channelId,
            name: 'RakshaKavach Alerts',
            description: 'Geofence enter/exit alerts',
            importance: AndroidImportance.HIGH,
            vibration: true,
            vibrationPattern: [300, 500],
            lights: true,
            lightColor: AndroidColor.RED,
        });

        // Request notification permissions
        await notifee.requestPermission();

        // Handle notification events
        notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.PRESS) {
                console.log('Notification pressed:', detail.notification);
            }
        });

        notifee.onBackgroundEvent(async ({ type, detail }) => {
            if (type === EventType.PRESS) {
                console.log('Background notification pressed:', detail.notification);
            }
        });

        console.log('Notification service initialized');
    }

    // Show geofence alert notification
    async showGeofenceAlert(
        title: string,
        body: string,
        isSelf: boolean = true,
    ): Promise<void> {
        try {
            await notifee.displayNotification({
                title: title,
                body: body,
                android: {
                    channelId: this.channelId,
                    importance: AndroidImportance.HIGH,
                    pressAction: {
                        id: 'default',
                    },
                    color: isSelf ? '#FF5722' : '#4CAF50',
                    // Use default app icon (ic_launcher)
                    smallIcon: 'ic_launcher',
                    vibrationPattern: [300, 500],
                    timestamp: Date.now(),
                    showTimestamp: true,
                },
            });
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    // Show self enter/exit notification
    async showSelfAlert(eventType: 'ENTER' | 'EXIT', zoneName: string): Promise<void> {
        const action = eventType === 'ENTER' ? 'entered' : 'exited';
        await this.showGeofenceAlert(
            '⚠️ Geofence Alert',
            `You have ${action} the restricted zone: ${zoneName}`,
            true,
        );
    }

    // Show friend enter/exit notification
    async showFriendAlert(
        userName: string,
        eventType: 'ENTER' | 'EXIT',
        zoneName: string,
    ): Promise<void> {
        const action = eventType === 'ENTER' ? 'entered' : 'exited';
        await this.showGeofenceAlert(
            '👥 Friend Alert',
            `${userName} has ${action} the restricted zone: ${zoneName}`,
            false,
        );
    }

    // Cancel all notifications
    async cancelAll(): Promise<void> {
        await notifee.cancelAllNotifications();
    }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
