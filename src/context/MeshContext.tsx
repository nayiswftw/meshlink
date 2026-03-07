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
    getQueuedMessagesForPeer,
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
    clearChatHistory as dbClearChatHistory,
} from '../services/storage/Database';
import {
    getSettings,
    saveSettings,
    hydrateAppState,
} from '../services/storage/AppState';
import { requestBluetoothPermissions } from '../services/Permissions';
import { notifyIncomingMessage, requestNotificationPermissions } from '../services/Notifications';
import RelayService from '../services/RelayService';
import type { SOSPayload } from '../services/RelayService';
import TopologyService from '../services/TopologyService';
import { getAppDisplayName } from '../utils';
import type { AppSettings, Conversation, StoredMessage, Channel, TopologyNode, TopologyEdge } from '../types';

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
    clearHistory: (id: string, isChannel: boolean) => void;

    // SOS
    sendSOS: (message?: string, coordinates?: { lat: number; lon: number } | null) => Promise<void>;
    activeSOSAlert: SOSPayload | null;
    dismissSOS: () => void;

    // Topology
    topologyNodes: TopologyNode[];
    topologyEdges: TopologyEdge[];

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

    // Helpers to prevent ghost peer duplication
    const deduplicatePeers = (inputPeers: PeerInfo): PeerInfo => {
        const nicknameToId = new Map<string, string>();
        for (const [id, nick] of Object.entries(inputPeers)) {
            // Deduplicating by the raw nickname (which now includes deviceId string) naturally handles device deduplication!
            nicknameToId.set(nick, id);
        }
        const finalPeers: PeerInfo = {};
        for (const [nick, id] of nicknameToId.entries()) {
            finalPeers[id] = nick;
        }
        return finalPeers;
    };

    const updatePeersFromMap = (peerMap: PeerInfo) => {
        setPeers(deduplicatePeers(peerMap));
    };

    const [activeSOSAlert, setActiveSOSAlert] = useState<SOSPayload | null>(null);
    const [topologyNodes, setTopologyNodes] = useState<TopologyNode[]>([]);
    const [topologyEdges, setTopologyEdges] = useState<TopologyEdge[]>([]);

    const subscriptionsRef = useRef<Subscription[]>([]);
    const appStateRef = useRef<AppStateStatus>(RNAppState.currentState);
    const notificationsEnabledRef = useRef(settings.notificationsEnabled);
    const isStartingRef = useRef(false);

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

    const refreshTopology = useCallback(() => {
        const topo = TopologyService.getTopology();
        setTopologyNodes(topo.nodes);
        setTopologyEdges(topo.edges);
    }, []);

    // ─── Mesh Service Lifecycle ──────────────────────────────

    const setupListeners = useCallback(() => {
        // Clear previous subscriptions
        subscriptionsRef.current.forEach((s) => s.remove());
        subscriptionsRef.current = [];

        // Get current display name for relay checks
        const myDisplayName = getAppDisplayName(settings);

        // Incoming messages
        const msgSub = BitchatAPI.addMessageListener(async (message: BitchatMessage) => {
            log.info(`Message from ${message.sender}: ${message.content.slice(0, 50)}`);

            // Deduplicate — mesh networks may deliver the same message twice
            if (hasMessage(message.id)) return;

            const isBackgrounded = appStateRef.current !== 'active';

            // ── SOS Detection ─────────────────────────────
            if (RelayService.isSOSMessage(message.content)) {
                const sosPayload = RelayService.parseSOSMessage(message.content);
                if (sosPayload && sosPayload.senderPeerID !== myDisplayName) {
                    log.info(`SOS received from ${sosPayload.senderNickname}`);
                    setActiveSOSAlert(sosPayload);
                    // Force-notify regardless of notification settings
                    notifyIncomingMessage(
                        sosPayload.senderNickname,
                        `🚨 SOS: ${sosPayload.message || 'Emergency alert!'}`
                    );
                    // Relay SOS to other peers (always, even if relay disabled)
                    RelayService.relaySOSMessage(
                        message.id,
                        sosPayload,
                        peers,
                        message.senderPeerID
                    ).catch((e) => log.error('SOS relay failed:', e));
                }
                return;
            }

            // Parse relay metadata if present
            const { metadata: relayMetadata, actualContent } = RelayService.parseRelayMetadata(message.content);

            // Feed relay path into topology graph
            if (relayMetadata) {
                TopologyService.ingestRelayPath(relayMetadata);
                refreshTopology();
            }

            // Determine if this message is for us
            // For private messages, check if we're the destination (if specified in metadata)
            // For broadcast/channel messages, they're always for everyone
            const isForMe = message.isPrivate
                ? !relayMetadata
                    || !relayMetadata.destinationNickname
                    || relayMetadata.destinationNickname === myDisplayName
                : true;

            // Process relay logic (forward if not for us)
            if (relayMetadata && !isForMe) {
                try {
                    const wasRelayed = await RelayService.processIncomingMessage(
                        message,
                        peers,
                        isForMe
                    );
                    if (wasRelayed) {
                        log.info(`Relayed message ${message.id} from ${relayMetadata.originNickname}`);
                    }
                } catch (error) {
                    log.error('Relay processing failed:', error);
                }
                // Don't store forwarded messages that aren't for us
                return;
            }

            // Use actual content (without relay metadata) for display and storage
            const displayContent = actualContent;
            const displaySender = relayMetadata ? relayMetadata.originNickname : message.sender;
            const displaySenderPeerID = relayMetadata ? relayMetadata.originPeerID : message.senderPeerID;

            if (message.isPrivate && displaySenderPeerID) {
                const stored: StoredMessage = {
                    id: message.id,
                    sender: displaySender,
                    content: displayContent,
                    timestamp: message.timestamp,
                    isPrivate: true,
                    senderPeerID: displaySenderPeerID,
                    isMine: false,
                    status: 'delivered',
                };
                saveMessage(stored);

                upsertConversation({
                    peerId: displaySenderPeerID,
                    peerName: displaySender,
                    lastMessage: displayContent,
                    lastMessageTimestamp: message.timestamp,
                    unreadCount: 1,
                    updatedAt: Date.now(),
                });

                setConversations(dbGetConversations());
                setMessageVersion((v) => v + 1);

                if (isBackgrounded && notificationsEnabledRef.current) {
                    notifyIncomingMessage(displaySender, displayContent);
                }
            } else if (!message.isPrivate && message.channel) {
                // Channel message
                const stored: StoredMessage = {
                    id: message.id,
                    sender: displaySender,
                    content: displayContent,
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
                    lastMessage: displayContent,
                    lastMessageSender: displaySender,
                    lastMessageTimestamp: message.timestamp,
                    unreadCount: 1,
                    updatedAt: Date.now(),
                });

                setChannels(dbGetChannels());
                setMessageVersion((v) => v + 1);

                if (isBackgrounded && notificationsEnabledRef.current) {
                    notifyIncomingMessage(displaySender, displayContent, message.channel);
                }
            }
        });

        // Peer connected
        const peerConnSub = BitchatAPI.addPeerConnectedListener(({ peerID, nickname: peerNick }) => {
            setPeers((prev) => {
                if (prev[peerID] === peerNick) return prev; // already tracked
                log.info(`Peer connected: ${peerNick} (${peerID})`);
                const next = { ...prev, [peerID]: peerNick };
                return deduplicatePeers(next);
            });

            // Flush offline queued messages
            const queued = getQueuedMessagesForPeer(peerNick);
            queued.forEach(async (msg) => {
                try {
                    await BitchatAPI.sendPrivateMessage(msg.content, peerID, peerNick);
                    updateMessageStatus(msg.id, 'sent');
                    setMessageVersion((v) => v + 1);
                } catch (e) {
                    log.error(`Failed to flush message ${msg.id}:`, e);
                }
            });

            // Flush store-and-forward messages for this peer
            RelayService.flushStoreForward(peerNick, peerID)
                .then((count) => {
                    if (count > 0) {
                        log.info(`Forwarded ${count} stored messages to ${peerNick}`);
                    }
                })
                .catch((e) => log.error('Store-forward flush failed:', e));
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
                updatePeersFromMap(peerMap);
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
    }, [peers, settings, nickname]);

    const startMesh = useCallback(async () => {
        if (isStartingRef.current) return;
        isStartingRef.current = true;

        const name = getAppDisplayName({ ...settings, displayName: settings.displayName || nickname });
        if (!name || name === '::' || !settings.displayName && !nickname) {
            isStartingRef.current = false;
            throw new Error('No display name set. Please set your name in Settings.');
        }

        const permStatus = await requestBluetoothPermissions();
        if (permStatus !== 'granted') {
            isStartingRef.current = false;
            throw new Error(
                permStatus === 'blocked'
                    ? 'Bluetooth permission blocked. Enable in device Settings.'
                    : 'Bluetooth permission is required for mesh networking.',
            );
        }

        // Request notification permissions (non-blocking)
        requestNotificationPermissions().catch(() => {});

        try {
            const started = await BitchatAPI.startServices(name);
            if (!started) {
                throw new Error('Mesh service failed to start. Make sure Bluetooth is enabled on your device.');
            }
            setupListeners();
            setIsRunning(true);
            log.info(`Mesh started as "${name}"`);
            const peerMap = await BitchatAPI.getConnectedPeers();
            updatePeersFromMap(peerMap);

            // Fetch stored forwards & queued messages for pre-existing connected peers
            for (const [pID, pNick] of Object.entries(peerMap)) {
                RelayService.flushStoreForward(pNick, pID)
                    .then((count) => {
                        if (count > 0) log.info(`Forwarded ${count} stored messages to ${pNick}`);
                    })
                    .catch((e) => log.error('Store-forward flush failed:', e));
                
                // Flush offline queued messages
                const queued = getQueuedMessagesForPeer(pNick);
                queued.forEach(async (msg) => {
                    try {
                        await BitchatAPI.sendPrivateMessage(msg.content, pID, pNick);
                        updateMessageStatus(msg.id, 'sent');
                        setMessageVersion((v) => v + 1);
                    } catch (e) {}
                });
            }

            // Initialize relay service
            RelayService.setIdentity(name, name); // Use nickname as peer ID for now
            RelayService.setEnabled(settings.relayEnabled);
            RelayService.setStoreForwardEnabled(settings.storeForwardEnabled);
            TopologyService.setIdentity(name, name);
            log.info(`Relay service ${settings.relayEnabled ? 'enabled' : 'disabled'}`);
            log.info(`Store-and-forward ${settings.storeForwardEnabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            log.error('Failed to start mesh:', error);
            throw error instanceof Error ? error : new Error('Failed to start mesh.');
        } finally {
            isStartingRef.current = false;
        }
    }, [nickname, settings.displayName, settings.relayEnabled, setupListeners]);

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
        if (isInitialised && settings.displayName && !isRunning && !isStartingRef.current) {
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

    // Sync topology whenever peers change
    useEffect(() => {
        if (isRunning) {
            TopologyService.updateDirectPeers(peers);
            refreshTopology();
        }
    }, [peers, isRunning, refreshTopology]);

    // ─── Messaging ───────────────────────────────────────────

    const sendPrivateMessage = useCallback(
        async (recipientPeerID: string, recipientNickname: string, text: string) => {
            const activePeerId = Object.keys(peers).find(id => peers[id] === recipientNickname);
            const isConnected = !!activePeerId;
            const targetPeerId = activePeerId || recipientPeerID;

            const stored: StoredMessage = {
                id: generateId(),
                sender: getAppDisplayName(settings),
                content: text,
                timestamp: Date.now(),
                isPrivate: true,
                recipientPeerID: targetPeerId,
                recipientName: recipientNickname,
                isMine: true,
                status: isConnected ? 'sent' : 'queued',
            };
            saveMessage(stored);

            upsertConversation({
                peerId: targetPeerId,
                peerName: recipientNickname,
                lastMessage: text,
                lastMessageTimestamp: stored.timestamp,
                unreadCount: 0,
                updatedAt: Date.now(),
            });

            refreshConversations();
            setMessageVersion((v) => v + 1);

            if (isConnected) {
                try {
                    await RelayService.sendWithRelay(
                        text,
                        true, // isPrivate
                        targetPeerId,
                        recipientNickname
                    );
                } catch (error) {
                    log.error('Failed to send message:', error);
                    updateMessageStatus(stored.id, 'failed');
                    setMessageVersion((v) => v + 1);
                }
            }
        },
        [peers, nickname, settings, refreshConversations]
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
                await RelayService.sendWithRelay(
                    text,
                    false, // not private
                    undefined,
                    undefined,
                    channelName,
                    mentions
                );

                const senderName = getAppDisplayName(settings);
                const stored: StoredMessage = {
                    id: generateId(),
                    sender: senderName,
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
                    lastMessageSender: senderName,
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
        [nickname, settings, refreshConversations]
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

    // ─── SOS ─────────────────────────────────────────────────

    const sendSOS = useCallback(async (message: string = '', coordinates?: { lat: number; lon: number } | null) => {
        if (!isRunning) throw new Error('Mesh is not running');
        await RelayService.sendSOS(message, peers, coordinates);
    }, [isRunning, peers]);

    const dismissSOS = useCallback(() => {
        setActiveSOSAlert(null);
    }, []);

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
                // Update relay service identity if running
                if (isRunning) {
                    RelayService.setIdentity(update.displayName, update.displayName);
                }
            }
            if (update.relayEnabled !== undefined) {
                RelayService.setEnabled(update.relayEnabled);
                log.info(`Relay service ${update.relayEnabled ? 'enabled' : 'disabled'}`);
            }
            if (update.storeForwardEnabled !== undefined) {
                RelayService.setStoreForwardEnabled(update.storeForwardEnabled);
                log.info(`Store-and-forward ${update.storeForwardEnabled ? 'enabled' : 'disabled'}`);
            }
        },
        [isRunning]
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
                        updatePeersFromMap(peerMap);
                        
                        // Also flush when returning to active in case we reconnected
                        for (const [pID, pNick] of Object.entries(peerMap)) {
                            RelayService.flushStoreForward(pNick, pID)
                                .then((count) => {
                                    if (count > 0) log.info(`Forwarded ${count} stored messages to ${pNick} on resume`);
                                })
                                .catch((e) => log.error('Store-forward flush failed:', e));
                            
                            const queued = getQueuedMessagesForPeer(pNick);
                            queued.forEach(async (msg) => {
                                try {
                                    await BitchatAPI.sendPrivateMessage(msg.content, pID, pNick);
                                    updateMessageStatus(msg.id, 'sent');
                                    setMessageVersion((v) => v + 1);
                                } catch (e) {}
                            });
                        }
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

    const clearHistoryHandler = useCallback((id: string, isChannel: boolean) => {
        const cleared = dbClearChatHistory(id, isChannel);
        if (cleared) {
            setMessageVersion((v) => v + 1);
            if (isChannel) {
                setChannels(dbGetChannels());
            } else {
                setConversations(dbGetConversations());
            }
        }
    }, []);

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
        clearHistory: clearHistoryHandler,
        sendSOS,
        activeSOSAlert,
        dismissSOS,
        topologyNodes,
        topologyEdges,
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
        clearHistoryHandler,
        sendSOS,
        activeSOSAlert,
        dismissSOS,
        topologyNodes,
        topologyEdges,
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
