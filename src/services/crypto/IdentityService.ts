/**
 * IdentityService — Device identity lifecycle.
 *
 * Generates, stores, and retrieves the device's cryptographic identity.
 * Uses expo-secure-store when available, falls back to in-memory storage.
 */
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../Logger';
import {
    generateEncryptionKeyPair,
    deriveDisplayName,
    type KeyPair,
} from './CryptoService';
import {
    IDENTITY_KEY_STORAGE_KEY,
    IDENTITY_PUBLIC_STORAGE_KEY,
    IDENTITY_ID_STORAGE_KEY,
    IDENTITY_DISPLAY_NAME_KEY,
} from '../../constants';
import type { DeviceIdentity } from '../../types';

const log = createLogger('Identity');

// ─── Secure Store Abstraction ────────────────────────────────────

interface SecureKV {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
}

// In-memory fallback
class MemorySecureStore implements SecureKV {
    private data = new Map<string, string>();
    async getItemAsync(key: string): Promise<string | null> {
        return this.data.get(key) ?? null;
    }
    async setItemAsync(key: string, value: string): Promise<void> {
        this.data.set(key, value);
    }
}

function getSecureStore(): SecureKV {
    try {
        return require('expo-secure-store') as SecureKV;
    } catch {
        log.warn('expo-secure-store not available, using in-memory store');
        return new MemorySecureStore();
    }
}

const secureStore = getSecureStore();

// ─── In-memory cache ─────────────────────────────────────────────
let cachedIdentity: DeviceIdentity | null = null;
let cachedSecretKey: string | null = null;

/**
 * Get the current device identity, creating one if it doesn't exist.
 */
export async function getOrCreateIdentity(): Promise<DeviceIdentity> {
    if (cachedIdentity) return cachedIdentity;

    const existing = await loadIdentity();
    if (existing) {
        cachedIdentity = existing;
        return existing;
    }

    const keyPair = generateEncryptionKeyPair();
    const id = uuidv4();
    const displayName = deriveDisplayName(keyPair.publicKey);

    const identity: DeviceIdentity = {
        id,
        displayName,
        publicKey: keyPair.publicKey,
        createdAt: Date.now(),
    };

    await secureStore.setItemAsync(IDENTITY_KEY_STORAGE_KEY, keyPair.secretKey);
    await secureStore.setItemAsync(IDENTITY_PUBLIC_STORAGE_KEY, keyPair.publicKey);
    await secureStore.setItemAsync(IDENTITY_ID_STORAGE_KEY, id);

    cachedIdentity = identity;
    cachedSecretKey = keyPair.secretKey;

    return identity;
}

/**
 * Load an existing identity from secure store.
 */
async function loadIdentity(): Promise<DeviceIdentity | null> {
    try {
        const secretKey = await secureStore.getItemAsync(IDENTITY_KEY_STORAGE_KEY);
        const publicKey = await secureStore.getItemAsync(IDENTITY_PUBLIC_STORAGE_KEY);
        const id = await secureStore.getItemAsync(IDENTITY_ID_STORAGE_KEY);
        const savedDisplayName = await secureStore.getItemAsync(IDENTITY_DISPLAY_NAME_KEY);

        if (!secretKey || !publicKey || !id) return null;

        cachedSecretKey = secretKey;

        return {
            id,
            displayName: savedDisplayName || deriveDisplayName(publicKey),
            publicKey,
            createdAt: 0,
        };
    } catch {
        return null;
    }
}

/**
 * Get the device's secret key.
 */
export async function getSecretKey(): Promise<string> {
    if (cachedSecretKey) return cachedSecretKey;

    const secretKey = await secureStore.getItemAsync(IDENTITY_KEY_STORAGE_KEY);
    if (!secretKey) throw new Error('No identity found — call getOrCreateIdentity first');

    cachedSecretKey = secretKey;
    return secretKey;
}

/**
 * Update the device display name.
 */
export function updateDisplayName(name: string): void {
    if (cachedIdentity) {
        cachedIdentity = { ...cachedIdentity, displayName: name };
    }
    // Persist to SecureStore so it survives app restarts
    secureStore.setItemAsync(IDENTITY_DISPLAY_NAME_KEY, name).catch(() => { });
}

/**
 * Check if device has an existing identity.
 */
export async function hasIdentity(): Promise<boolean> {
    const id = await secureStore.getItemAsync(IDENTITY_ID_STORAGE_KEY);
    return !!id;
}

/**
 * Get the cached identity synchronously.
 */
export function getCachedIdentity(): DeviceIdentity | null {
    return cachedIdentity;
}
