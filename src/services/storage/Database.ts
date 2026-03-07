/**
 * Database — Local storage for messages and conversations.
 *
 * Uses AsyncStorage for persistence with in-memory cache for sync reads.
 * expo-bitchat handles peer management and relay natively.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../Logger';
import type { StoredMessage, Conversation, Channel } from '../../types';

const log = createLogger('DB');

// ─── Keys ────────────────────────────────────────────────────────
const MESSAGES_KEY = '@meshlink/messages';
const CONVERSATIONS_KEY = '@meshlink/conversations';
const CHANNELS_KEY = '@meshlink/channels';

// ─── In-memory cache ─────────────────────────────────────────────
let messagesCache: StoredMessage[] = [];
let conversationsCache: Conversation[] = [];
let channelsCache: Channel[] = [];
let isHydrated = false;

// ─── Hydration ───────────────────────────────────────────────────

export async function hydrateDatabase(): Promise<void> {
    if (isHydrated) return;
    try {
        const [msgs, convs, chans] = await Promise.all([
            AsyncStorage.getItem(MESSAGES_KEY),
            AsyncStorage.getItem(CONVERSATIONS_KEY),
            AsyncStorage.getItem(CHANNELS_KEY),
        ]);
        messagesCache = msgs ? JSON.parse(msgs) : [];
        conversationsCache = convs ? JSON.parse(convs) : [];
        channelsCache = chans ? JSON.parse(chans) : [];
    } catch (e) {
        log.warn('Hydration error:', e);
    }
    isHydrated = true;
}

// ─── Persist helpers ─────────────────────────────────────────────

function persistMessages() {
    AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messagesCache)).catch((e) => {
        log.error('Failed to persist messages:', e);
    });
}

function persistConversations() {
    AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversationsCache)).catch((e) => {
        log.error('Failed to persist conversations:', e);
    });
}

// ─── Messages ────────────────────────────────────────────────────

export function saveMessage(msg: StoredMessage): void {
    const idx = messagesCache.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
        messagesCache[idx] = msg;
    } else {
        messagesCache.push(msg);
    }
    persistMessages();
}

export function getMessagesForPeer(peerId: string): StoredMessage[] {
    return messagesCache
        .filter((m) => m.senderPeerID === peerId || (m.isMine && m.channel === peerId))
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function getPrivateMessages(peerNickname: string, myNickname: string): StoredMessage[] {
    return messagesCache
        .filter(
            (m) =>
                m.isPrivate &&
                ((m.sender === peerNickname && !m.isMine) || (m.sender === myNickname && m.isMine && m.channel === peerNickname))
        )
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function updateMessageStatus(id: string, status: StoredMessage['status']): void {
    const idx = messagesCache.findIndex((m) => m.id === id);
    if (idx >= 0) {
        messagesCache[idx] = { ...messagesCache[idx], status };
        persistMessages();
    }
}

// ─── Conversations ───────────────────────────────────────────────

export function upsertConversation(conv: Conversation): void {
    const idx = conversationsCache.findIndex((c) => c.peerId === conv.peerId);
    if (idx >= 0) {
        const existing = conversationsCache[idx];
        conversationsCache[idx] = {
            ...conv,
            unreadCount: conv.unreadCount > 0
                ? existing.unreadCount + conv.unreadCount
                : conv.unreadCount,
        };
    } else {
        conversationsCache.push(conv);
    }
    persistConversations();
}

export function getConversations(): Conversation[] {
    return [...conversationsCache].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function markConversationRead(peerId: string): void {
    const idx = conversationsCache.findIndex((c) => c.peerId === peerId);
    if (idx >= 0) {
        conversationsCache[idx] = { ...conversationsCache[idx], unreadCount: 0 };
        persistConversations();
    }
}

// ─── Channels ────────────────────────────────────────────────────

function persistChannels() {
    AsyncStorage.setItem(CHANNELS_KEY, JSON.stringify(channelsCache)).catch((e) => {
        log.error('Failed to persist channels:', e);
    });
}

export function upsertChannel(channel: Channel): void {
    const idx = channelsCache.findIndex((c) => c.name === channel.name);
    if (idx >= 0) {
        const existing = channelsCache[idx];
        channelsCache[idx] = {
            ...channel,
            createdAt: existing.createdAt,
            unreadCount: channel.unreadCount > 0
                ? existing.unreadCount + channel.unreadCount
                : channel.unreadCount,
        };
    } else {
        channelsCache.push(channel);
    }
    persistChannels();
}

export function getChannels(): Channel[] {
    return [...channelsCache].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChannel(name: string): Channel | undefined {
    return channelsCache.find((c) => c.name === name);
}

export function markChannelRead(channelName: string): void {
    const idx = channelsCache.findIndex((c) => c.name === channelName);
    if (idx >= 0) {
        channelsCache[idx] = { ...channelsCache[idx], unreadCount: 0 };
        persistChannels();
    }
}

export function deleteChannel(channelName: string): void {
    channelsCache = channelsCache.filter((c) => c.name !== channelName);
    persistChannels();
}

export function getChannelMessages(channelName: string): StoredMessage[] {
    return messagesCache
        .filter((m) => !m.isPrivate && m.channel === channelName)
        .sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Search ──────────────────────────────────────────────────────

export function searchMessages(query: string): StoredMessage[] {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return messagesCache
        .filter((m) => m.content.toLowerCase().includes(lower))
        .sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Delete ──────────────────────────────────────────────────────

export function deleteMessage(messageId: string): boolean {
    const idx = messagesCache.findIndex((m) => m.id === messageId);
    if (idx < 0) return false;
    messagesCache.splice(idx, 1);
    persistMessages();
    return true;
}
