/**
 * BlePermissions — Platform-specific BLE permission requests.
 */
import { Platform, PermissionsAndroid, Alert } from 'react-native';

/**
 * Request all BLE-related permissions.
 * Returns true if all permissions were granted.
 */
export async function requestBlePermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
        return requestAndroidPermissions();
    }
    // iOS permissions are handled declaratively via Info.plist
    return true;
}

async function requestAndroidPermissions(): Promise<boolean> {
    const apiLevel = Platform.Version;

    if (typeof apiLevel === 'number' && apiLevel >= 31) {
        // Android 12+ (API 31)
        const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(results).every(
            (r) => r === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
            Alert.alert(
                'Permissions Required',
                'Meshlink needs Bluetooth and Location permissions to discover and communicate with nearby devices.',
                [{ text: 'OK' }]
            );
        }

        return allGranted;
    } else {
        // Android < 12
        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: 'Location Permission',
                message:
                    'Meshlink needs location access to discover nearby Bluetooth devices.',
                buttonPositive: 'Grant',
            }
        );

        return result === PermissionsAndroid.RESULTS.GRANTED;
    }
}
