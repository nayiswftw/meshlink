/**
 * Meshlink constants — UI config and defaults.
 * BLE/mesh/crypto constants are handled natively by expo-bitchat.
 */

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
 * Derive a deterministic colour from a peer ID or name.
 */
export function peerColor(identifier: string): string {
    if (!identifier) return PEER_CARD_COLORS[0];
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
        hash = (hash * 31 + identifier.charCodeAt(i)) | 0;
    }
    return PEER_CARD_COLORS[Math.abs(hash) % PEER_CARD_COLORS.length];
}
