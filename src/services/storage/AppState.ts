/**
 * AppState — Settings and onboarding state.
 *
 * Uses AsyncStorage for persistence with in-memory cache for sync reads.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppSettings, DEFAULT_SETTINGS } from '../../types';

// ─── Keys ────────────────────────────────────────────────────────
const SETTINGS_KEY = '@meshlink/settings';
const ONBOARDING_KEY = '@meshlink/onboarding_complete';

// ─── In-memory cache ─────────────────────────────────────────────
let settingsCache: AppSettings = { ...DEFAULT_SETTINGS };
let onboardingComplete = false;
let isHydrated = false;

// ─── Hydration ───────────────────────────────────────────────────

export async function hydrateAppState(): Promise<void> {
    if (isHydrated) return;
    try {
        const [settingsRaw, onboardingRaw] = await Promise.all([
            AsyncStorage.getItem(SETTINGS_KEY),
            AsyncStorage.getItem(ONBOARDING_KEY),
        ]);
        if (settingsRaw) {
            settingsCache = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) };
        }
        onboardingComplete = onboardingRaw === 'true';
    } catch (e) {
        console.warn('[AppState] Hydration error:', e);
    }
    isHydrated = true;
}

// ─── Settings ────────────────────────────────────────────────────

export function getSettings(): AppSettings {
    return { ...settingsCache };
}

export function saveSettings(settings: Partial<AppSettings>): void {
    settingsCache = { ...settingsCache, ...settings };
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache)).catch(() => { });
}

// ─── Onboarding ──────────────────────────────────────────────────

export function isOnboardingComplete(): boolean {
    return onboardingComplete;
}

export function setOnboardingComplete(): void {
    onboardingComplete = true;
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => { });
}
