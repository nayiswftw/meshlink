/**
 * Core type definitions for Meshlink
 */

// ─── Message Types ───────────────────────────────────────────────

export enum MessageStatus {
    QUEUED = 'queued',
    SENDING = 'sending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
}

export enum MessageType {
    TEXT = 'text',
    ACK = 'ack',
    IDENTITY = 'identity',
    PING = 'ping',
}

export interface MeshMessage {
    id: string;
    type: MessageType;
    senderId: string;
    recipientId: string;
    content: string;
    timestamp: number;
    ttl: number;
    hopCount: number;
    signature: string;
    nonce: string;
}

export interface SerializedMessage {
    id: string;
    type: string;
    senderId: string;
    recipientId: string;
    content: string;
    plaintextContent?: string; // plaintext for our own sent messages (can't decrypt NaCl box with own key)
    timestamp: number;
    status: string;
    ttl: number;
    hopCount: number;
    signature: string;
    nonce: string;
}

// ─── Peer Types ──────────────────────────────────────────────────

export enum PeerConnectionState {
    DISCOVERED = 'discovered',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
}

export interface Peer {
    id: string;
    publicKey: string;
    displayName: string;
    rssi: number;
    lastSeen: number;
    connectionState: PeerConnectionState;
    isRelay: boolean;
    deviceId: string; // BLE device id
}

export interface PeerRecord {
    id: string;
    publicKey: string;
    displayName: string;
    lastSeen: number;
    trustLevel: number;
}

// ─── Conversation Types ──────────────────────────────────────────

export interface Conversation {
    peerId: string;
    peerName: string;
    peerPublicKey: string;
    lastMessage: string;
    lastMessageTimestamp: number;
    unreadCount: number;
    updatedAt: number;
}

// ─── Identity Types ──────────────────────────────────────────────

export interface DeviceIdentity {
    id: string;
    displayName: string;
    publicKey: string; // base64
    createdAt: number;
}

// ─── BLE Types ───────────────────────────────────────────────────

export interface BlePacket {
    messageId: string;
    chunkIndex: number;
    totalChunks: number;
    payload: Uint8Array;
    flags: PacketFlags;
}

export enum PacketFlags {
    NONE = 0,
    FIRST = 1 << 0,
    LAST = 1 << 1,
    ACK_REQUESTED = 1 << 2,
    IS_RELAY = 1 << 3,
}

// ─── App State Types ─────────────────────────────────────────────

export interface AppSettings {
    displayName: string;
    relayEnabled: boolean;
    theme: 'light' | 'dark' | 'system';
    notificationsEnabled: boolean;
    onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
    displayName: '',
    relayEnabled: true,
    theme: 'system',
    notificationsEnabled: true,
    onboardingComplete: false,
};
