/**
 * LocationService — GPS location for SOS alerts.
 * Uses expo-location to get the device's current coordinates.
 */
import * as Location from 'expo-location';
import { createLogger } from './Logger';

const log = createLogger('Location');

let permissionGranted: boolean | null = null;

export async function requestLocationPermissions(): Promise<boolean> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        permissionGranted = status === 'granted';
        return permissionGranted;
    } catch (e) {
        log.error('Failed to request location permissions:', e);
        return false;
    }
}

export async function getCurrentLocation(): Promise<{ lat: number; lon: number } | null> {
    try {
        if (permissionGranted === null) {
            await requestLocationPermissions();
        }
        if (!permissionGranted) return null;

        // Use balanced accuracy for faster lock; add a 5s timeout so SOS is never blocked
        const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 5000)
        );

        const location = await Promise.race([locationPromise, timeoutPromise]);
        if (!location) {
            log.warn('GPS timed out after 5s');
            return null;
        }

        return {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
        };
    } catch (e) {
        log.error('Failed to get current location:', e);
        return null;
    }
}

/**
 * Calculate distance in meters between two GPS coordinates (Haversine formula).
 */
export function distanceBetween(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Format distance for display (e.g. "120m", "1.3km").
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}
