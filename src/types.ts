/**
 * Core type definitions for Meshlink.
 * Maps to expo-bitchat native types where applicable.
 */

// Re-export expo-bitchat types we use directly
export type {
    BitchatMessage,
    DeliveryAck,
    ReadReceipt,
    PeerInfo,
    DeliveryStatus,
} from 'expo-bitchat';

// ─── Conversation (local-only, stored in AsyncStorage) ───────────

export interface Conversation {
    peerId: string;
    peerName: string;
    lastMessage: string;
    lastMessageTimestamp: number;
    unreadCount: number;
    updatedAt: number;
}

// ─── Channel (group chat, stored in AsyncStorage) ────────────────

export interface Channel {
    name: string;          // e.g. "#general" — always starts with #
    isPasswordProtected: boolean;
    createdAt: number;
    lastMessage: string;
    lastMessageSender: string;
    lastMessageTimestamp: number;
    unreadCount: number;
    updatedAt: number;
}

// ─── Stored Message (local persistence) ──────────────────────────

export interface StoredMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    isPrivate: boolean;
    channel?: string;
    senderPeerID?: string;
    recipientPeerID?: string;
    recipientName?: string;
    isMine: boolean;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'queued';
}

// ─── Store-and-Forward (DTN) ─────────────────────────────────────

export interface StoreForwardMessage {
    id: string;               // Original message ID
    encodedContent: string;   // Full relay-encoded message content
    destinationNickname: string;
    destinationPeerID?: string;
    originNickname: string;
    originPeerID: string;
    isPrivate: boolean;
    channel?: string;
    mentions?: string[];
    storedAt: number;         // When we stored this message
    expiresAt: number;        // TTL — auto-prune after this
    hopCount: number;
}

// ─── Topology (Network Map) ───────────────────────────────────────

export interface TopologyNode {
    id: string;           // peerID or own ID
    nickname: string;
    isMe: boolean;
    isConnected: boolean;
    lastSeen: number;
}

export interface TopologyEdge {
    from: string;         // peerID
    to: string;           // peerID
    lastSeen: number;
    hopCount?: number;
}

// ─── App Settings ────────────────────────────────────────────────

export interface AppSettings {
    displayName: string;
    deviceId: string;
    notificationsEnabled: boolean;
    onboardingComplete: boolean;
    relayEnabled: boolean;       // Enable message relay/forwarding
    storeForwardEnabled: boolean; // Store messages for offline peers and forward when they connect
}

export const DEFAULT_SETTINGS: AppSettings = {
    displayName: '',
    deviceId: '',
    notificationsEnabled: true,
    onboardingComplete: false,
    relayEnabled: true,
    storeForwardEnabled: true,
};
