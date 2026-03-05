/**
 * Database — Local storage for messages, peers, and conversations.
 *
 * Uses AsyncStorage for persistence. Data is JSON-serialised.
 * Keeps an in-memory cache for synchronous reads with async persistence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../Logger';
import type { SerializedMessage, PeerRecord, Conversation } from '../../types';

const log = createLogger('DB');

// ─── Keys ────────────────────────────────────────────────────────
const MESSAGES_KEY = '@meshlink/messages';
const PEERS_KEY = '@meshlink/peers';
const CONVERSATIONS_KEY = '@meshlink/conversations';
const RELAY_CACHE_KEY = '@meshlink/relay_cache';

// ─── In-memory cache (sync access, async persistence) ────────────
let messagesCache: SerializedMessage[] = [];
let peersCache: PeerRecord[] = [];
let conversationsCache: Conversation[] = [];
let relayCacheData: SerializedMessage[] = [];
let isHydrated = false;

// ─── Hydration ───────────────────────────────────────────────────

export async function hydrateDatabase(): Promise<void> {
    if (isHydrated) return;
    try {
        const [msgs, peers, convs, relay] = await Promise.all([
            AsyncStorage.getItem(MESSAGES_KEY),
            AsyncStorage.getItem(PEERS_KEY),
            AsyncStorage.getItem(CONVERSATIONS_KEY),
            AsyncStorage.getItem(RELAY_CACHE_KEY),
        ]);
        messagesCache = msgs ? JSON.parse(msgs) : [];
        peersCache = peers ? JSON.parse(peers) : [];
        conversationsCache = convs ? JSON.parse(convs) : [];
        relayCacheData = relay ? JSON.parse(relay) : [];
    } catch (e) {
        log.warn('Hydration error:', e);
    }
    isHydrated = true;
}

// ─── Persist helpers (fire-and-forget) ───────────────────────────

function persistMessages() {
    AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messagesCache)).catch((e) => {
        log.error('Failed to persist messages:', e);
    });
}

function persistPeers() {
    AsyncStorage.setItem(PEERS_KEY, JSON.stringify(peersCache)).catch((e) => {
        log.error('Failed to persist peers:', e);
    });
}

function persistConversations() {
    AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversationsCache)).catch((e) => {
        log.error('Failed to persist conversations:', e);
    });
}

function persistRelayCache() {
    AsyncStorage.setItem(RELAY_CACHE_KEY, JSON.stringify(relayCacheData)).catch((e) => {
        log.error('Failed to persist relay cache:', e);
    });
}

// ─── Messages ────────────────────────────────────────────────────

export function saveMessage(msg: SerializedMessage): void {
    const idx = messagesCache.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
        messagesCache[idx] = msg;
    } else {
        messagesCache.push(msg);
    }
    persistMessages();
}

export function getMessages(peerId: string, myId: string): SerializedMessage[] {
    return messagesCache
        .filter(
            (m) =>
                (m.senderId === myId && m.recipientId === peerId) ||
                (m.senderId === peerId && m.recipientId === myId)
        )
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function getMessageById(id: string): SerializedMessage | null {
    return messagesCache.find((m) => m.id === id) ?? null;
}

export function updateMessageStatus(id: string, status: string): void {
    const idx = messagesCache.findIndex((m) => m.id === id);
    if (idx >= 0) {
        messagesCache[idx] = { ...messagesCache[idx], status };
        persistMessages();
    }
}

export function deleteConversationMessages(peerId: string, myId: string): void {
    messagesCache = messagesCache.filter(
        (m) =>
            !(
                (m.senderId === myId && m.recipientId === peerId) ||
                (m.senderId === peerId && m.recipientId === myId)
            )
    );
    persistMessages();
}

// ─── Peers ───────────────────────────────────────────────────────

export function savePeer(peer: PeerRecord): void {
    const idx = peersCache.findIndex((p) => p.id === peer.id);
    if (idx >= 0) {
        peersCache[idx] = peer;
    } else {
        peersCache.push(peer);
    }
    persistPeers();
}

export function getPeer(id: string): PeerRecord | null {
    return peersCache.find((p) => p.id === id) ?? null;
}

export function getAllPeers(): PeerRecord[] {
    return [...peersCache];
}

export function updatePeerLastSeen(id: string): void {
    const idx = peersCache.findIndex((p) => p.id === id);
    if (idx >= 0) {
        peersCache[idx] = { ...peersCache[idx], lastSeen: Date.now() };
        persistPeers();
    }
}

// ─── Conversations ───────────────────────────────────────────────

export function upsertConversation(conv: Conversation): void {
    const idx = conversationsCache.findIndex((c) => c.peerId === conv.peerId);
    if (idx >= 0) {
        // Increment unread count instead of replacing it
        const existing = conversationsCache[idx];
        conversationsCache[idx] = {
            ...conv,
            unreadCount: conv.unreadCount > 0
                ? existing.unreadCount + conv.unreadCount
                : conv.unreadCount, // allow explicit reset to 0
        };
    } else {
        conversationsCache.push(conv);
    }
    persistConversations();
}

export function getConversations(): Conversation[] {
    return [...conversationsCache].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(peerId: string): Conversation | null {
    return conversationsCache.find((c) => c.peerId === peerId) ?? null;
}

export function markConversationRead(peerId: string): void {
    const idx = conversationsCache.findIndex((c) => c.peerId === peerId);
    if (idx >= 0) {
        conversationsCache[idx] = { ...conversationsCache[idx], unreadCount: 0 };
        persistConversations();
    }
}

export function deleteConversation(peerId: string): void {
    conversationsCache = conversationsCache.filter((c) => c.peerId !== peerId);
    persistConversations();
}

// ─── Relay Cache ─────────────────────────────────────────────────

const RELAY_CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const RELAY_CACHE_MAX_SIZE = 200;

export function addToRelayCache(msg: SerializedMessage): void {
    if (!relayCacheData.find((m) => m.id === msg.id)) {
        relayCacheData.push(msg);
        // Enforce size limit — remove oldest entries
        if (relayCacheData.length > RELAY_CACHE_MAX_SIZE) {
            relayCacheData = relayCacheData.slice(-RELAY_CACHE_MAX_SIZE);
        }
        persistRelayCache();
    }
}

export function getRelayCache(): SerializedMessage[] {
    // Evict expired entries on read
    const now = Date.now();
    const before = relayCacheData.length;
    relayCacheData = relayCacheData.filter(
        (m) => now - m.timestamp < RELAY_CACHE_EXPIRY_MS
    );
    if (relayCacheData.length !== before) persistRelayCache();
    return [...relayCacheData];
}

export function removeFromRelayCache(messageId: string): void {
    relayCacheData = relayCacheData.filter((m) => m.id !== messageId);
    persistRelayCache();
}

export function clearRelayCache(): void {
    relayCacheData = [];
    persistRelayCache();
}
