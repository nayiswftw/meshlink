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
const MAX_MESSAGES = 5000;

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

// ─── Persist helpers (debounced to coalesce rapid writes) ────────

let msgPersistTimer: ReturnType<typeof setTimeout> | null = null;
let convPersistTimer: ReturnType<typeof setTimeout> | null = null;
let chanPersistTimer: ReturnType<typeof setTimeout> | null = null;

function persistMessages() {
    if (msgPersistTimer) clearTimeout(msgPersistTimer);
    msgPersistTimer = setTimeout(() => {
        AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messagesCache)).catch((e) => {
            log.error('Failed to persist messages:', e);
        });
    }, 300);
}

function persistConversations() {
    if (convPersistTimer) clearTimeout(convPersistTimer);
    convPersistTimer = setTimeout(() => {
        AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversationsCache)).catch((e) => {
            log.error('Failed to persist conversations:', e);
        });
    }, 300);
}

function persistChannels() {
    if (chanPersistTimer) clearTimeout(chanPersistTimer);
    chanPersistTimer = setTimeout(() => {
        AsyncStorage.setItem(CHANNELS_KEY, JSON.stringify(channelsCache)).catch((e) => {
            log.error('Failed to persist channels:', e);
        });
    }, 300);
}

// ─── Messages ────────────────────────────────────────────────────

export function saveMessage(msg: StoredMessage): void {
    const idx = messagesCache.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
        messagesCache[idx] = msg;
    } else {
        messagesCache.push(msg);
        // Prune oldest messages when over cap
        if (messagesCache.length > MAX_MESSAGES) {
            messagesCache.sort((a, b) => a.timestamp - b.timestamp);
            messagesCache = messagesCache.slice(-MAX_MESSAGES);
        }
    }
    persistMessages();
}

/** Check whether a message ID already exists (for dedup). */
export function hasMessage(id: string): boolean {
    return messagesCache.some((m) => m.id === id);
}

export function getPrivateMessagesForPeer(peerId: string): StoredMessage[] {
    const conv = conversationsCache.find((c) => c.peerId === peerId || c.peerName === peerId);
    const targetName = conv ? conv.peerName : peerId;
    return messagesCache
        .filter((m) => m.isPrivate && (!m.isMine ? m.sender === targetName : m.recipientName === targetName))
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function getQueuedMessagesForPeer(peerName: string): StoredMessage[] {
    return messagesCache.filter((m) => m.isPrivate && m.isMine && m.recipientName === peerName && m.status === 'queued');
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
    const idx = conversationsCache.findIndex((c) => c.peerName === conv.peerName);
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
    const idx = conversationsCache.findIndex((c) => c.peerId === peerId || c.peerName === peerId);
    if (idx >= 0) {
        conversationsCache[idx] = { ...conversationsCache[idx], unreadCount: 0 };
        persistConversations();
    }
}

// ─── Channels ────────────────────────────────────────────────────

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
    const deleted = messagesCache[idx];
    messagesCache.splice(idx, 1);
    persistMessages();

    // Update parent conversation/channel lastMessage
    if (deleted.isPrivate) {
        // Find the peer name we are talking to
        const peerName = deleted.isMine ? deleted.recipientName : deleted.sender;
        const remaining = peerName ? messagesCache
            .filter((m) => m.isPrivate && (!m.isMine ? m.sender === peerName : m.recipientName === peerName))
            .sort((a, b) => b.timestamp - a.timestamp) : [];
        const convIdx = conversationsCache.findIndex((c) => c.peerName === peerName);
        if (convIdx >= 0) {
            conversationsCache[convIdx] = {
                ...conversationsCache[convIdx],
                lastMessage: remaining[0]?.content ?? '',
                lastMessageTimestamp: remaining[0]?.timestamp ?? 0,
            };
            persistConversations();
        }
    } else if (!deleted.isPrivate && deleted.channel) {
        const remaining = messagesCache
            .filter((m) => !m.isPrivate && m.channel === deleted.channel)
            .sort((a, b) => b.timestamp - a.timestamp);
        const chanIdx = channelsCache.findIndex((c) => c.name === deleted.channel);
        if (chanIdx >= 0) {
            channelsCache[chanIdx] = {
                ...channelsCache[chanIdx],
                lastMessage: remaining[0]?.content ?? '',
                lastMessageSender: remaining[0]?.sender ?? '',
                lastMessageTimestamp: remaining[0]?.timestamp ?? 0,
            };
            persistChannels();
        }
    }

    return true;
}

export function clearChatHistory(id: string, isChannel: boolean): boolean {
    const originalLength = messagesCache.length;
    if (isChannel) {
        messagesCache = messagesCache.filter((m) => m.isPrivate || m.channel !== id);
        const chanIdx = channelsCache.findIndex((c) => c.name === id);
        if (chanIdx >= 0) {
            channelsCache[chanIdx] = {
                ...channelsCache[chanIdx],
                lastMessage: '',
                lastMessageTimestamp: 0,
            };
            persistChannels();
        }
    } else {
        // Look up conversation by peerId or peerName to find the stable name
        const conv = conversationsCache.find((c) => c.peerId === id || c.peerName === id);
        const targetName = conv ? conv.peerName : id;
        messagesCache = messagesCache.filter(
            (m) => !m.isPrivate || (!m.isMine ? m.sender !== targetName : m.recipientName !== targetName)
        );
        const convIdx = conv ? conversationsCache.indexOf(conv) : -1;
        if (convIdx >= 0) {
            conversationsCache[convIdx] = {
                ...conversationsCache[convIdx],
                lastMessage: '',
                lastMessageTimestamp: 0,
            };
            persistConversations();
        }
    }
    
    if (messagesCache.length !== originalLength) {
        persistMessages();
        return true;
    }
    return false;
}
