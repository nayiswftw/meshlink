import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import { AppState as RNAppState, type AppStateStatus } from 'react-native';
import { createLogger } from '../services/Logger';
import { bleManager } from '../services/ble/BleManager';
import { meshRouter, type OnMessageReceivedCallback } from '../services/mesh/MeshRouter';
import { peerManager } from '../services/mesh/PeerManager';
import {
    getOrCreateIdentity,
    getCachedIdentity,
    updateDisplayName,
} from '../services/crypto/IdentityService';
import {
    getMessages,
    getConversations as dbGetConversations,
    markConversationRead,
    upsertConversation,
    hydrateDatabase,
} from '../services/storage/Database';
import {
    getSettings,
    saveSettings,
    isOnboardingComplete,
    hydrateAppState,
} from '../services/storage/AppState';
import type {
    DeviceIdentity,
    Peer,
    MeshMessage,
    Conversation,
    SerializedMessage,
    AppSettings,
} from '../types';

const log = createLogger('MeshContext');

// ─── Context Shape ───────────────────────────────────────────────

interface MeshContextType {
    // Identity
    identity: DeviceIdentity | null;
    isInitialised: boolean;

    // Peers
    peers: Peer[];
    connectedPeerCount: number;

    // Scanning
    isScanning: boolean;
    startScanning: () => Promise<void>;
    stopScanning: () => void;

    // Messaging
    sendMessage: (recipientId: string, recipientPublicKey: string, text: string) => Promise<void>;
    getMessagesForPeer: (peerId: string) => SerializedMessage[];
    markRead: (peerId: string) => void;

    // Conversations
    conversations: Conversation[];
    refreshConversations: () => void;

    // Settings
    settings: AppSettings;
    updateSettings: (update: Partial<AppSettings>) => void;

    // Connection
    connectToPeer: (deviceId: string) => Promise<boolean>;

    // BLE
    initBle: () => Promise<boolean>;
    requestEnableBle: () => Promise<void>;
    bleReady: boolean;
}

const MeshContext = createContext<MeshContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────

export function MeshProvider({ children }: { children: ReactNode }) {
    const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
    const [isInitialised, setIsInitialised] = useState(false);
    const [peers, setPeers] = useState<Peer[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [bleReady, setBleReady] = useState(false);

    // ─── Initialise Identity ─────────────────────────────────

    useEffect(() => {
        (async () => {
            try {
                // Hydrate AsyncStorage into memory caches first
                await hydrateAppState();
                await hydrateDatabase();
                setSettings(getSettings());

                const id = await getOrCreateIdentity();
                setIdentity(id);
                setIsInitialised(true);

                // Auto-initialize BLE after identity is ready.
                // The onBleStateChanged listener (set up below) will
                // handle starting meshRouter when BLE comes on.
                const powered = await bleManager.init();
                setBleReady(powered);
                if (powered && !meshRouter.getIsRunning()) {
                    await meshRouter.start();
                }
            } catch (error) {
                log.error('Init failed:', error);
            }
        })();
    }, []);

    // ─── BLE Init & Reactive State ─────────────────────────────

    const initBle = useCallback(async (): Promise<boolean> => {
        const ready = await bleManager.init();
        setBleReady(ready);
        if (ready) {
            if (!meshRouter.getIsRunning()) {
                await meshRouter.start();
            }
        }
        return ready;
    }, []);

    const requestEnableBle = useCallback(async (): Promise<void> => {
        await bleManager.requestEnable();
        // The persistent state listener will update bleReady reactively
    }, []);

    // Subscribe to BLE adapter state changes (Bluetooth toggled in system settings).
    // This is what makes bleReady reactive — no button tap needed.
    useEffect(() => {
        bleManager.setOnBleStateChanged((powered: boolean) => {
            log.info(`BLE state change received: ${powered ? 'ON' : 'OFF'}`);
            setBleReady(powered);

            if (powered) {
                // BLE just came back on — start mesh router if not already running
                if (!meshRouter.getIsRunning()) {
                    meshRouter.start().catch((err) => {
                        log.error('Failed to restart mesh router:', err);
                    });
                }
            } else {
                // BLE just turned off — clean up
                meshRouter.stop();
                setIsScanning(false);
                setPeers([]);
            }
        });

        return () => {
            bleManager.setOnBleStateChanged(null);
        };
    }, []);

    // ─── Peer Updates ────────────────────────────────────────

    useEffect(() => {
        peerManager.setOnChange((updatedPeers) => {
            setPeers([...updatedPeers]);
        });

        return () => {
            peerManager.setOnChange(null);
        };
    }, []);

    // ─── Message Received ────────────────────────────────────

    useEffect(() => {
        const handler: OnMessageReceivedCallback = (msg, decrypted, sender) => {
            // Refresh conversations when a message arrives
            refreshConversations();
        };

        meshRouter.setOnMessageReceived(handler);
        return () => meshRouter.setOnMessageReceived(null);
    }, []);

    // ─── Scanning ────────────────────────────────────────────

    const startScanning = useCallback(async () => {
        // Ensure BLE and mesh router are initialized before scanning
        if (!bleManager.isBleAvailable()) {
            const ready = await initBle();
            if (!ready) {
                log.warn('Cannot scan: BLE not available');
                return;
            }
        }
        if (!meshRouter.getIsRunning()) {
            await meshRouter.start();
        }
        setIsScanning(true);
        await meshRouter.startScanning();
    }, [initBle]);

    const stopScanning = useCallback(() => {
        meshRouter.stopScanning();
        setIsScanning(false);
    }, []);

    // ─── Conversations ──────────────────────────────────────

    const refreshConversations = useCallback(() => {
        setConversations(dbGetConversations());
    }, []);

    // ─── Messaging ───────────────────────────────────────────

    const sendMessage = useCallback(
        async (recipientId: string, recipientPublicKey: string, text: string) => {
            try {
                await meshRouter.sendTextMessage(recipientId, recipientPublicKey, text);
                refreshConversations();
            } catch (error) {
                log.error('Failed to send message:', error);
                throw error; // Re-throw so caller (UI) can handle it, but it won't crash unhandled
            }
        },
        [refreshConversations]
    );

    const getMessagesForPeer = useCallback(
        (peerId: string): SerializedMessage[] => {
            const id = getCachedIdentity();
            if (!id) return [];
            return getMessages(peerId, id.id);
        },
        [identity]
    );

    const markRead = useCallback((peerId: string) => {
        markConversationRead(peerId);
        refreshConversations();
    }, [refreshConversations]);

    useEffect(() => {
        if (isInitialised) {
            refreshConversations();
        }
    }, [isInitialised, refreshConversations]);

    // ─── Settings ────────────────────────────────────────────

    const updateSettingsHandler = useCallback(
        (update: Partial<AppSettings>) => {
            saveSettings(update);
            setSettings(getSettings());
            if (update.displayName && identity) {
                updateDisplayName(update.displayName);
                setIdentity({ ...identity, displayName: update.displayName });
            }
        },
        [identity]
    );

    // ─── Connect ─────────────────────────────────────────────

    const connectToPeer = useCallback(async (deviceId: string): Promise<boolean> => {
        return bleManager.connectToDevice(deviceId);
    }, []);

    // ─── AppState Lifecycle ──────────────────────────────────

    const appStateRef = useRef<AppStateStatus>(RNAppState.currentState);

    useEffect(() => {
        const subscription = RNAppState.addEventListener('change', (nextState) => {
            if (
                appStateRef.current.match(/active/) &&
                nextState.match(/inactive|background/)
            ) {
                // Going to background — stop scanning to save battery
                log.info('App backgrounded, pausing scan');
                meshRouter.stopScanning();
                setIsScanning(false);
            } else if (
                appStateRef.current.match(/inactive|background/) &&
                nextState === 'active'
            ) {
                // Coming back to foreground — force check BLE state in case 
                // the persistent listener missed it while backgrounded.
                log.info('App foregrounded, syncing BLE state');
                bleManager.checkState().catch((err) => log.warn('checkState failed:', err));
            }
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, []);

    // ─── Cleanup ─────────────────────────────────────────────

    useEffect(() => {
        return () => {
            meshRouter.stop();
            bleManager.destroy();
            peerManager.clear();
        };
    }, []);

    // ─── Provide ─────────────────────────────────────────────

    const value: MeshContextType = React.useMemo(() => ({
        identity,
        isInitialised,
        peers,
        connectedPeerCount: peers.filter((p) => p.connectionState === 'connected').length,
        isScanning,
        startScanning,
        stopScanning,
        sendMessage,
        getMessagesForPeer,
        markRead,
        conversations,
        refreshConversations,
        settings,
        updateSettings: updateSettingsHandler,
        connectToPeer,
        initBle,
        requestEnableBle,
        bleReady,
    }), [
        identity,
        isInitialised,
        peers,
        isScanning,
        startScanning,
        stopScanning,
        sendMessage,
        getMessagesForPeer,
        markRead,
        conversations,
        refreshConversations,
        settings,
        updateSettingsHandler,
        connectToPeer,
        initBle,
        requestEnableBle,
        bleReady
    ]);

    return (
        <MeshContext.Provider value={value}>
            {children}
        </MeshContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────

export function useMesh(): MeshContextType {
    const ctx = useContext(MeshContext);
    if (!ctx) {
        throw new Error('useMesh must be used within a MeshProvider');
    }
    return ctx;
}
