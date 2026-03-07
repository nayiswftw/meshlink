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
    isMine: boolean;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

// ─── App Settings ────────────────────────────────────────────────

export interface AppSettings {
    displayName: string;
    notificationsEnabled: boolean;
    onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
    displayName: '',
    notificationsEnabled: true,
    onboardingComplete: false,
};
