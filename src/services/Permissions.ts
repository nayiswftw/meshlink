/**
 * Permissions — Runtime BLE permission handling for Android & iOS.
 *
 * iOS: Permissions are triggered by the system when BLE APIs are first used.
 *      Info.plist keys (NSBluetoothAlwaysUsageDescription etc.) must be set.
 * Android 12+: Requires BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE.
 * Android <12: Requires ACCESS_FINE_LOCATION for BLE scanning.
 */
import { Platform, PermissionsAndroid } from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'blocked';

/**
 * Request BLE-related permissions. Returns the aggregate status.
 */
export async function requestBluetoothPermissions(): Promise<PermissionStatus> {
    if (Platform.OS === 'ios') {
        // iOS handles via Info.plist + system prompt on first CBCentralManager use
        return 'granted';
    }

    if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;

        if (typeof apiLevel === 'number' && apiLevel >= 31) {
            // Android 12+
            // Note: ACCESS_FINE_LOCATION is also required because the native
            // BLE module checks for it on all API levels (and BLUETOOTH_SCAN
            // is declared without neverForLocation).
            const results = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);

            const allGranted = Object.values(results).every(
                (r) => r === PermissionsAndroid.RESULTS.GRANTED
            );
            if (allGranted) return 'granted';

            const anyBlocked = Object.values(results).some(
                (r) => r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
            );
            return anyBlocked ? 'blocked' : 'denied';
        } else {
            // Android < 12: Fine location required for BLE scanning
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );

            if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
            if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
            return 'denied';
        }
    }

    return 'granted';
}

/**
 * Check current BLE permission status without requesting.
 */
export async function checkBluetoothPermissions(): Promise<PermissionStatus> {
    if (Platform.OS === 'ios') return 'granted';

    if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;

        if (typeof apiLevel === 'number' && apiLevel >= 31) {
            const results = await Promise.all([
                PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
                PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
                PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE),
                PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
            ]);
            return results.every(Boolean) ? 'granted' : 'denied';
        } else {
            const granted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            return granted ? 'granted' : 'denied';
        }
    }

    return 'granted';
}
