/**
 * Notifications — Local push notification service.
 *
 * Sends local notifications for incoming messages when the app
 * is backgrounded. Uses expo-notifications.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createLogger } from './Logger';

const log = createLogger('Notifications');

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

/**
 * Request notification permissions.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#C4903D',
        });
    }

    return status === 'granted';
}

/**
 * Send a local notification for an incoming message.
 */
export async function notifyIncomingMessage(
    sender: string,
    content: string,
    channelName?: string,
): Promise<void> {
    try {
        const title = channelName ? `${sender} in ${channelName}` : sender;
        const body = content.length > 100 ? content.slice(0, 100) + '…' : content;

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: 'default',
                ...(Platform.OS === 'android' && { channelId: 'messages' }),
            },
            trigger: null, // Immediate
        });
    } catch (e) {
        log.error('Failed to send notification:', e);
    }
}
