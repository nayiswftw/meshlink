/**
 * MeshContext — Central app state powered by expo-bitchat.
 *
 * expo-bitchat handles all BLE mesh networking, encryption, peer discovery,
 * and message routing natively. This context manages the React state layer
 * and local message/conversation persistence.
 */
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
import BitchatAPI from 'expo-bitchat';
import type { BitchatMessage, PeerInfo, Subscription } from 'expo-bitchat';
import { createLogger } from '../services/Logger';
import {
    saveMessage,
    hasMessage,
    getPrivateMessagesForPeer,
    upsertConversation,
    getConversations as dbGetConversations,
    markConversationRead,
    updateMessageStatus,
    hydrateDatabase,
    upsertChannel,
    getChannels as dbGetChannels,
    getChannelMessages as dbGetChannelMessages,
    markChannelRead,
    deleteChannel as dbDeleteChannel,
    searchMessages as dbSearchMessages,
    deleteMessage as dbDeleteMessage,
} from '../services/storage/Database';
import {
    getSettings,
    saveSettings,
    hydrateAppState,
} from '../services/storage/AppState';
import { requestBluetoothPermissions } from '../services/Permissions';
import { notifyIncomingMessage, requestNotificationPermissions } from '../services/Notifications';
import type { AppSettings, Conversation, StoredMessage, Channel } from '../types';

const log = createLogger('MeshContext');

/** Cryptographically-secure message ID. */
function generateId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return `${Date.now()}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Strip control characters and zero-width unicode from display names. */
function sanitizeDisplayName(raw: string): string {
    return raw.replace(/[\x00-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').trim();
}

// ─── Context Shape ───────────────────────────────────────────────

interface MeshContextType {
    // Identity
    nickname: string;
    isInitialised: boolean;

    // Peers (map of peerID → nickname)
    peers: PeerInfo;
    connectedPeerCount: number;

    // Mesh service state
    isRunning: boolean;
    startMesh: () => Promise<void>;
    stopMesh: () => Promise<void>;

    // Messaging
    sendPrivateMessage: (recipientPeerID: string, recipientNickname: string, text: string) => Promise<void>;
    getMessagesForPeer: (peerId: string) => StoredMessage[];
    markRead: (peerId: string) => void;

    // Conversations
    conversations: Conversation[];
    refreshConversations: () => void;

    // Channels
    channels: Channel[];
    sendChannelMessage: (channelName: string, text: string, mentions?: string[]) => Promise<void>;
    getChannelMessages: (channelName: string) => StoredMessage[];
    joinChannel: (channelName: string, password?: string) => Promise<void>;
    leaveChannel: (channelName: string) => void;
    setChannelPassword: (channelName: string, password?: string) => Promise<void>;
    markChannelRead: (channelName: string) => void;

    // Real-time message update trigger
    messageVersion: number;

    // Search & deletion
    searchMessages: (query: string) => StoredMessage[];
    deleteMessage: (messageId: string) => boolean;

    // Settings
    settings: AppSettings;
    updateSettings: (update: Partial<AppSettings>) => void;
}

const MeshContext = createContext<MeshContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────

export function MeshProvider({ children }: { children: ReactNode }) {
    const [nickname, setNickname] = useState('');
    const [isInitialised, setIsInitialised] = useState(false);
    const [peers, setPeers] = useState<PeerInfo>({});
    const [isRunning, setIsRunning] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [messageVersion, setMessageVersion] = useState(0);

    const subscriptionsRef = useRef<Subscription[]>([]);
    const appStateRef = useRef<AppStateStatus>(RNAppState.currentState);
    const notificationsEnabledRef = useRef(settings.notificationsEnabled);

    // Keep the ref in sync
    useEffect(() => {
        notificationsEnabledRef.current = settings.notificationsEnabled;
    }, [settings.notificationsEnabled]);

    // ─── Initialise ──────────────────────────────────────────

    useEffect(() => {
        (async () => {
            try {
                await hydrateAppState();
                await hydrateDatabase();
                const s = getSettings();
                setSettings(s);
                setNickname(s.displayName || '');
                setIsInitialised(true);
            } catch (error) {
                log.error('Init failed:', error);
            }
        })();
    }, []);

    // ─── Mesh Service Lifecycle ──────────────────────────────

    const setupListeners = useCallback(() => {
        // Clear previous subscriptions
        subscriptionsRef.current.forEach((s) => s.remove());
        subscriptionsRef.current = [];

        // Incoming messages
        const msgSub = BitchatAPI.addMessageListener((message: BitchatMessage) => {
            log.info(`Message from ${message.sender}: ${message.content.slice(0, 50)}`);

            // Deduplicate — mesh networks may deliver the same message twice
            if (hasMessage(message.id)) return;

            const isBackgrounded = appStateRef.current !== 'active';

            if (message.isPrivate && message.senderPeerID) {
                const stored: StoredMessage = {
                    id: message.id,
                    sender: message.sender,
                    content: message.content,
                    timestamp: message.timestamp,
                    isPrivate: true,
                    senderPeerID: message.senderPeerID,
                    isMine: false,
                    status: 'delivered',
                };
                saveMessage(stored);

                upsertConversation({
                    peerId: message.senderPeerID,
                    peerName: message.sender,
                    lastMessage: message.content,
                    lastMessageTimestamp: message.timestamp,
                    unreadCount: 1,
                    updatedAt: Date.now(),
                });

                setConversations(dbGetConversations());
                setMessageVersion((v) => v + 1);

                if (isBackgrounded && notificationsEnabledRef.current) {
                    notifyIncomingMessage(message.sender, message.content);
                }
            } else if (!message.isPrivate && message.channel) {
                // Channel message
                const stored: StoredMessage = {
                    id: message.id,
                    sender: message.sender,
                    content: message.content,
                    timestamp: message.timestamp,
                    isPrivate: false,
                    channel: message.channel,
                    senderPeerID: message.senderPeerID,
                    isMine: false,
                    status: 'delivered',
                };
                saveMessage(stored);

                upsertChannel({
                    name: message.channel,
                    isPasswordProtected: false,
                    createdAt: Date.now(),
                    lastMessage: message.content,
                    lastMessageSender: message.sender,
                    lastMessageTimestamp: message.timestamp,
                    unreadCount: 1,
                    updatedAt: Date.now(),
                });

                setChannels(dbGetChannels());
                setMessageVersion((v) => v + 1);

                if (isBackgrounded && notificationsEnabledRef.current) {
                    notifyIncomingMessage(message.sender, message.content, message.channel);
                }
            }
        });

        // Peer connected
        const peerConnSub = BitchatAPI.addPeerConnectedListener(({ peerID, nickname: peerNick }) => {
            log.info(`Peer connected: ${peerNick} (${peerID})`);
            setPeers((prev) => ({ ...prev, [peerID]: peerNick }));
        });

        // Peer disconnected
        const peerDiscSub = BitchatAPI.addPeerDisconnectedListener(({ peerID, nickname: peerNick }) => {
            log.info(`Peer disconnected: ${peerNick} (${peerID})`);
            setPeers((prev) => {
                const next = { ...prev };
                delete next[peerID];
                return next;
            });
        });

        // Peer list updated (full sync)
        const peerListSub = BitchatAPI.addPeerListUpdatedListener(() => {
            BitchatAPI.getConnectedPeers().then((peerMap) => {
                setPeers(peerMap);
            }).catch(() => {});
        });

        // Delivery ack
        const ackSub = BitchatAPI.addDeliveryAckListener((ack) => {
            log.info(`Delivery ack for ${ack.originalMessageID}`);
            updateMessageStatus(ack.originalMessageID, 'delivered');
            setMessageVersion((v) => v + 1);
        });

        // Delivery status updates
        const statusSub = BitchatAPI.addDeliveryStatusUpdateListener(({ messageID, status }) => {
            if (status.type === 'delivered' || status.type === 'read' || status.type === 'failed' || status.type === 'sent') {
                updateMessageStatus(messageID, status.type);
                setMessageVersion((v) => v + 1);
            }
        });

        subscriptionsRef.current = [msgSub, peerConnSub, peerDiscSub, peerListSub, ackSub, statusSub];
    }, []);

    const startMesh = useCallback(async () => {
        const name = settings.displayName || nickname;
        if (!name) {
            throw new Error('No display name set. Please set your name in Settings.');
        }

        const permStatus = await requestBluetoothPermissions();
        if (permStatus !== 'granted') {
            throw new Error(
                permStatus === 'blocked'
                    ? 'Bluetooth permission blocked. Enable in device Settings.'
                    : 'Bluetooth permission is required for mesh networking.',
            );
        }

        // Request notification permissions (non-blocking)
        requestNotificationPermissions().catch(() => {});

        try {
            setupListeners();
            const started = await BitchatAPI.startServices(name);
            if (!started) {
                throw new Error('Mesh service failed to start. Please try again.');
            }
            setIsRunning(true);
            log.info(`Mesh started as "${name}"`);
            const peerMap = await BitchatAPI.getConnectedPeers();
            setPeers(peerMap);
        } catch (error) {
            log.error('Failed to start mesh:', error);
            throw error instanceof Error ? error : new Error('Failed to start mesh.');
        }
    }, [nickname, settings.displayName, setupListeners]);

    const stopMesh = useCallback(async () => {
        try {
            await BitchatAPI.stopServices();
            subscriptionsRef.current.forEach((s) => s.remove());
            subscriptionsRef.current = [];
            setIsRunning(false);
            setPeers({});
            log.info('Mesh stopped');
        } catch (error) {
            log.error('Failed to stop mesh:', error);
        }
    }, []);

    // Auto-start mesh once initialized and we have a display name
    useEffect(() => {
        if (isInitialised && settings.displayName && !isRunning) {
            startMesh().catch((e) => log.warn('Auto-start failed:', e));
        }
    }, [isInitialised, settings.displayName, isRunning, startMesh]);

    // ─── Conversations ──────────────────────────────────────

    const refreshConversations = useCallback(() => {
        setConversations(dbGetConversations());
        setChannels(dbGetChannels());
    }, []);

    useEffect(() => {
        if (isInitialised) {
            refreshConversations();
        }
    }, [isInitialised, refreshConversations]);

    // ─── Messaging ───────────────────────────────────────────

    const sendPrivateMessage = useCallback(
        async (recipientPeerID: string, recipientNickname: string, text: string) => {
            try {
                await BitchatAPI.sendPrivateMessage(text, recipientPeerID, recipientNickname);

                const stored: StoredMessage = {
                    id: generateId(),
                    sender: settings.displayName || nickname,
                    content: text,
                    timestamp: Date.now(),
                    isPrivate: true,
                    senderPeerID: recipientPeerID,
                    isMine: true,
                    status: 'sent',
                };
                saveMessage(stored);

                upsertConversation({
                    peerId: recipientPeerID,
                    peerName: recipientNickname,
                    lastMessage: text,
                    lastMessageTimestamp: stored.timestamp,
                    unreadCount: 0,
                    updatedAt: Date.now(),
                });

                refreshConversations();
                setMessageVersion((v) => v + 1);
            } catch (error) {
                log.error('Failed to send message:', error);
                throw error;
            }
        },
        [nickname, settings.displayName, refreshConversations]
    );

    const getMessagesForPeer = useCallback(
        (peerId: string): StoredMessage[] => {
            return getPrivateMessagesForPeer(peerId);
        },
        []
    );

    const markRead = useCallback((peerId: string) => {
        markConversationRead(peerId);
        refreshConversations();
    }, [refreshConversations]);

    // ─── Channels ────────────────────────────────────────────

    const sendChannelMessage = useCallback(
        async (channelName: string, text: string, mentions: string[] = []) => {
            try {
                await BitchatAPI.sendMessage(text, mentions, channelName);

                const stored: StoredMessage = {
                    id: generateId(),
                    sender: settings.displayName || nickname,
                    content: text,
                    timestamp: Date.now(),
                    isPrivate: false,
                    channel: channelName,
                    isMine: true,
                    status: 'sent',
                };
                saveMessage(stored);

                upsertChannel({
                    name: channelName,
                    isPasswordProtected: false,
                    createdAt: Date.now(),
                    lastMessage: text,
                    lastMessageSender: settings.displayName || nickname,
                    lastMessageTimestamp: stored.timestamp,
                    unreadCount: 0,
                    updatedAt: Date.now(),
                });

                refreshConversations();
                setMessageVersion((v) => v + 1);
            } catch (error) {
                log.error('Failed to send channel message:', error);
                throw error;
            }
        },
        [nickname, settings.displayName, refreshConversations]
    );

    const getChannelMessagesHandler = useCallback(
        (channelName: string): StoredMessage[] => {
            return dbGetChannelMessages(channelName);
        },
        []
    );

    const joinChannel = useCallback(async (channelName: string, password?: string) => {
        let isProtected = false;
        if (password) {
            try {
                await BitchatAPI.setChannelPassword(channelName, password);
                isProtected = true;
            } catch (e) {
                log.error('Failed to set channel password:', e);
            }
        }
        upsertChannel({
            name: channelName,
            isPasswordProtected: isProtected,
            createdAt: Date.now(),
            lastMessage: '',
            lastMessageSender: '',
            lastMessageTimestamp: 0,
            unreadCount: 0,
            updatedAt: Date.now(),
        });
        refreshConversations();
    }, [refreshConversations]);

    const leaveChannel = useCallback((channelName: string) => {
        dbDeleteChannel(channelName);
        refreshConversations();
    }, [refreshConversations]);

    const setChannelPasswordHandler = useCallback(
        async (channelName: string, password?: string) => {
            await BitchatAPI.setChannelPassword(channelName, password);
        },
        []
    );

    const markChannelReadHandler = useCallback((channelName: string) => {
        markChannelRead(channelName);
        refreshConversations();
    }, [refreshConversations]);

    // ─── Search & Delete ─────────────────────────────────────

    const searchMessagesHandler = useCallback(
        (query: string): StoredMessage[] => dbSearchMessages(query),
        []
    );

    const deleteMessageHandler = useCallback(
        (messageId: string): boolean => {
            const deleted = dbDeleteMessage(messageId);
            if (deleted) {
                refreshConversations();
                setMessageVersion((v) => v + 1);
            }
            return deleted;
        },
        [refreshConversations]
    );

    // ─── Settings ────────────────────────────────────────────

    const updateSettingsHandler = useCallback(
        (update: Partial<AppSettings>) => {
            if (update.displayName !== undefined) {
                update = { ...update, displayName: sanitizeDisplayName(update.displayName) };
            }
            saveSettings(update);
            const newSettings = getSettings();
            setSettings(newSettings);
            if (update.displayName) {
                setNickname(update.displayName);
            }
        },
        []
    );

    // ─── AppState Lifecycle ──────────────────────────────────


    useEffect(() => {
        const subscription = RNAppState.addEventListener('change', (nextState) => {
            if (
                appStateRef.current.match(/active/) &&
                nextState.match(/inactive|background/)
            ) {
                log.info('App backgrounded');
            } else if (
                appStateRef.current.match(/inactive|background/) &&
                nextState === 'active'
            ) {
                log.info('App foregrounded, syncing peers');
                if (isRunning) {
                    BitchatAPI.getConnectedPeers().then((peerMap) => {
                        setPeers(peerMap);
                    }).catch(() => {});
                }
            }
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, [isRunning]);

    // ─── Cleanup ─────────────────────────────────────────────

    useEffect(() => {
        return () => {
            subscriptionsRef.current.forEach((s) => s.remove());
            BitchatAPI.stopServices().catch(() => {});
        };
    }, []);

    // ─── Provide ─────────────────────────────────────────────

    const value: MeshContextType = React.useMemo(() => ({
        nickname,
        isInitialised,
        peers,
        connectedPeerCount: Object.keys(peers).length,
        isRunning,
        startMesh,
        stopMesh,
        sendPrivateMessage,
        getMessagesForPeer,
        markRead,
        conversations,
        refreshConversations,
        channels,
        sendChannelMessage,
        getChannelMessages: getChannelMessagesHandler,
        joinChannel,
        leaveChannel,
        setChannelPassword: setChannelPasswordHandler,
        markChannelRead: markChannelReadHandler,
        messageVersion,
        searchMessages: searchMessagesHandler,
        deleteMessage: deleteMessageHandler,
        settings,
        updateSettings: updateSettingsHandler,
    }), [
        nickname,
        isInitialised,
        peers,
        isRunning,
        startMesh,
        stopMesh,
        sendPrivateMessage,
        getMessagesForPeer,
        markRead,
        conversations,
        refreshConversations,
        channels,
        sendChannelMessage,
        getChannelMessagesHandler,
        joinChannel,
        leaveChannel,
        setChannelPasswordHandler,
        markChannelReadHandler,
        messageVersion,
        searchMessagesHandler,
        deleteMessageHandler,
        settings,
        updateSettingsHandler,
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
