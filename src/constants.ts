/**
 * Meshlink constants — BLE UUIDs, protocol config, and defaults.
 */

// ─── BLE Service & Characteristic UUIDs ──────────────────────────
// Custom UUIDs generated for Meshlink (v4 UUID format)
export const MESHLINK_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const IDENTITY_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const MESSAGE_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const ACK_CHAR_UUID = '6e400004-b5a3-f393-e0a9-e50e24dcca9e';

// ─── BLE Scan Configuration ─────────────────────────────────────
export const BLE_SCAN_DURATION_MS = 10_000;     // Scan for 10s
export const BLE_SCAN_INTERVAL_MS = 15_000;     // Pause 15s between scans
export const BLE_CONNECTION_TIMEOUT_MS = 10_000; // Connection attempt timeout
export const BLE_MTU_SIZE = 512;                 // Negotiated MTU
export const BLE_PACKET_HEADER_SIZE = 20;        // Header bytes per chunk
export const BLE_MAX_PAYLOAD_SIZE = BLE_MTU_SIZE - BLE_PACKET_HEADER_SIZE;

// ─── Mesh Protocol ───────────────────────────────────────────────
export const DEFAULT_TTL = 5;                    // Max relay hops
export const MAX_MESSAGE_SIZE = 4096;            // Max message bytes (text)
export const DEDUP_CACHE_SIZE = 1000;            // Rolling set of seen msg IDs
export const DEDUP_EXPIRY_MS = 5 * 60 * 1000;   // 5 minutes
export const MESSAGE_RETRY_COUNT = 3;
export const MESSAGE_RETRY_DELAY_MS = 2_000;

// ─── Identity ────────────────────────────────────────────────────
export const IDENTITY_KEY_STORAGE_KEY = 'meshlink_identity_private_key';
export const IDENTITY_PUBLIC_STORAGE_KEY = 'meshlink_identity_public_key';
export const IDENTITY_ID_STORAGE_KEY = 'meshlink_identity_id';
export const IDENTITY_DISPLAY_NAME_KEY = 'meshlink_identity_display_name';

// ─── Storage Keys (MMKV) ────────────────────────────────────────
export const MMKV_SETTINGS_KEY = 'meshlink_settings';
export const MMKV_ONBOARDING_KEY = 'meshlink_onboarding_complete';

// ─── Database ────────────────────────────────────────────────────
export const DB_NAME = 'meshlink.db';
export const DB_VERSION = 1;

// ─── UI ──────────────────────────────────────────────────────────
export const PEER_CARD_COLORS = [
    '#7B8C56', // sage
    '#C4903D', // amber
    '#8B6D4F', // earth
    '#B85C4A', // terracotta
    '#5E8B7E', // teal-sage
    '#9B7B9F', // dusty plum
    '#6B8FA3', // steel blue
    '#C47E5A', // copper
] as const;

/**
 * Derive a deterministic colour from a peer's public key.
 */
export function peerColor(publicKey: string): string {
    let hash = 0;
    for (let i = 0; i < publicKey.length; i++) {
        hash = (hash * 31 + publicKey.charCodeAt(i)) | 0;
    }
    return PEER_CARD_COLORS[Math.abs(hash) % PEER_CARD_COLORS.length];
}
