// Mock AsyncStorage before importing AppState
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, val: string) => {
        mockStore[key] = val;
        return Promise.resolve();
    }),
}));

import { DEFAULT_SETTINGS } from '../../../types';

describe('AppState', () => {
    let AppState: typeof import('../../storage/AppState');

    beforeEach(() => {
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);
        jest.resetModules();
    });

    async function loadAppState() {
        AppState = await import('../../storage/AppState');
        await AppState.hydrateAppState();
        return AppState;
    }

    // ── Hydration ────────────────────────────────────

    describe('hydrateAppState', () => {
        it('loads default settings when storage is empty', async () => {
            const state = await loadAppState();
            expect(state.getSettings()).toEqual(DEFAULT_SETTINGS);
        });

        it('loads saved settings from storage', async () => {
            mockStore['@meshlink/settings'] = JSON.stringify({
                displayName: 'Bob',
                notificationsEnabled: false,
            });
            const state = await loadAppState();
            const settings = state.getSettings();
            expect(settings.displayName).toBe('Bob');
            expect(settings.notificationsEnabled).toBe(false);
        });

        it('merges partial saved settings with defaults', async () => {
            mockStore['@meshlink/settings'] = JSON.stringify({
                displayName: 'Alice',
            });
            const state = await loadAppState();
            const settings = state.getSettings();
            expect(settings.displayName).toBe('Alice');
            expect(settings.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);
        });

        it('loads onboarding state', async () => {
            mockStore['@meshlink/onboarding_complete'] = 'true';
            const state = await loadAppState();
            expect(state.isOnboardingComplete()).toBe(true);
        });

        it('defaults onboarding to false', async () => {
            const state = await loadAppState();
            expect(state.isOnboardingComplete()).toBe(false);
        });

        it('only hydrates once', async () => {
            const state = await loadAppState();
            // Modify storage after hydration
            mockStore['@meshlink/onboarding_complete'] = 'true';
            await state.hydrateAppState();
            // Should still be false since hydration is idempotent
            expect(state.isOnboardingComplete()).toBe(false);
        });
    });

    // ── Settings ─────────────────────────────────────

    describe('getSettings', () => {
        it('returns a copy of settings', async () => {
            const state = await loadAppState();
            const a = state.getSettings();
            const b = state.getSettings();
            expect(a).toEqual(b);
            expect(a).not.toBe(b);
        });
    });

    describe('saveSettings', () => {
        it('merges partial settings', async () => {
            const state = await loadAppState();
            state.saveSettings({ displayName: 'NewName' });

            const settings = state.getSettings();
            expect(settings.displayName).toBe('NewName');
            expect(settings.notificationsEnabled).toBe(DEFAULT_SETTINGS.notificationsEnabled);
        });

        it('persists to AsyncStorage', async () => {
            const state = await loadAppState();
            state.saveSettings({ displayName: 'Test' });

            // Check that setItem was called
            const AsyncStorage = require('@react-native-async-storage/async-storage');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                '@meshlink/settings',
                expect.stringContaining('Test'),
            );
        });
    });

    // ── Onboarding ───────────────────────────────────

    describe('setOnboardingComplete', () => {
        it('sets onboarding to true', async () => {
            const state = await loadAppState();
            expect(state.isOnboardingComplete()).toBe(false);

            state.setOnboardingComplete();
            expect(state.isOnboardingComplete()).toBe(true);
        });

        it('persists to AsyncStorage', async () => {
            const state = await loadAppState();
            state.setOnboardingComplete();

            const AsyncStorage = require('@react-native-async-storage/async-storage');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                '@meshlink/onboarding_complete',
                'true',
            );
        });
    });
});
