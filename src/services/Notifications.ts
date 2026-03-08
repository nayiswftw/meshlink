/**
 * Notifications — Local push notification service.
 *
 * Sends local notifications for incoming messages when the app
 * is backgrounded. Uses expo-notifications.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createLogger } from './Logger';
import { formatName } from '../utils';

const log = createLogger('Notifications');

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        // Always show SOS notifications even in foreground
        const isSOS = notification.request.content.body?.includes('🚨 SOS:') ?? false;
        return {
            shouldShowAlert: isSOS,
            shouldShowBanner: isSOS,
            shouldShowList: isSOS,
            shouldPlaySound: isSOS,
            shouldSetBadge: false,
        };
    },
});

/**
 * Request notification permissions.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    // Always ensure Android notification channel exists (required for Android 8+)
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#C4903D',
        }).catch(() => {});
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
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
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const title = channelName ? `${formatName(sender)} in ${channelName}` : formatName(sender);
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
