/**
 * MeshRouter — Core mesh routing logic.
 *
 * Orchestrates message routing through the BLE mesh:
 * - Direct delivery to connected peers
 * - Store-and-forward relay for unreachable peers
 * - TTL management and deduplication
 * - Identity exchange on new connections
 */
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../Logger';

const log = createLogger('Mesh');
import { Buffer } from 'buffer';
import { bleManager } from '../ble/BleManager';
import { bleAdvertiser } from '../ble/BleAdvertiser';
import { peerManager } from './PeerManager';
import { messageQueue } from './MessageQueue';
import {
    encryptMessage,
    decryptMessage,
} from '../crypto/CryptoService';
import {
    getOrCreateIdentity,
    getSecretKey,
    getCachedIdentity,
} from '../crypto/IdentityService';
import {
    saveMessage,
    updateMessageStatus,
    upsertConversation,
    addToRelayCache,
    getRelayCache,
    removeFromRelayCache,
    getPeer as dbGetPeer,
} from '../storage/Database';
import { getSettings } from '../storage/AppState';
import {
    DEFAULT_TTL,
    DEDUP_CACHE_SIZE,
    DEDUP_EXPIRY_MS,
} from '../../constants';
import {
    type MeshMessage,
    type SerializedMessage,
    type Peer,
    MessageType,
    MessageStatus,
    PeerConnectionState,
} from '../../types';

// ─── Callbacks ───────────────────────────────────────────────────
export type OnMessageReceivedCallback = (
    message: MeshMessage,
    decryptedContent: string,
    senderPeer: Peer | undefined
) => void;

// ─── Deduplication ───────────────────────────────────────────────
interface DedupEntry {
    timestamp: number;
}

class MeshRouterService {
    private seenMessages: Map<string, DedupEntry> = new Map();
    private onMessageReceived: OnMessageReceivedCallback | null = null;
    private isRunning = false;
    private dedupInterval: ReturnType<typeof setInterval> | null = null;

    // ─── Initialise ─────────────────────────────────────────────

    async start(): Promise<void> {
        if (this.isRunning) return;

        const identity = await getOrCreateIdentity();

        // Configure BLE callbacks
        bleManager.setOnPeerDiscovered((device) => {
            peerManager.upsertFromScan(device.id, device.rssi ?? -100);
        });

        bleManager.setOnPeerConnected(async (deviceId) => {
            peerManager.setConnectionState(deviceId, PeerConnectionState.CONNECTED);
            // Perform identity exchange
            await this.exchangeIdentity(deviceId);
            // Flush relay cache for any messages destined for this peer
            this.flushRelayCache();
        });

        bleManager.setOnPeerDisconnected((deviceId) => {
            peerManager.setConnectionState(deviceId, PeerConnectionState.DISCONNECTED);
        });

        bleManager.setOnDataReceived((deviceId, data) => {
            this.handleIncomingData(deviceId, data);
        });

        // Configure message queue
        messageQueue.configure(
            (deviceId, msgId, data, isRelay) =>
                bleManager.sendData(deviceId, msgId, data, isRelay),
            (msg) => new Uint8Array(Buffer.from(JSON.stringify(msg), 'utf-8')),
            () => peerManager.getConnectedPeerDeviceIds()
        );

        // Start services
        peerManager.startStaleCheck();
        messageQueue.startProcessing();

        // Start BLE advertising so other Meshlink devices can discover us
        await bleAdvertiser.start(identity);

        // Start dedup cleanup
        if (this.dedupInterval) clearInterval(this.dedupInterval);
        this.dedupInterval = setInterval(() => this.cleanupDedup(), DEDUP_EXPIRY_MS);

        this.isRunning = true;
    }

    stop(): void {
        bleManager.stopScan();
        bleAdvertiser.stop();
        bleManager.setOnPeerDiscovered(null);
        bleManager.setOnPeerConnected(null);
        bleManager.setOnPeerDisconnected(null);
        bleManager.setOnDataReceived(null);
        peerManager.stopStaleCheck();
        messageQueue.stopProcessing();
        if (this.dedupInterval) {
            clearInterval(this.dedupInterval);
            this.dedupInterval = null;
        }
        this.isRunning = false;
    }

    // ─── Send Message ───────────────────────────────────────────

    async sendTextMessage(
        recipientId: string,
        recipientPublicKey: string,
        text: string
    ): Promise<MeshMessage> {
        const identity = getCachedIdentity();
        if (!identity) throw new Error('Identity not initialised');

        const secretKey = await getSecretKey();

        // Encrypt the message
        const { ciphertext, nonce } = encryptMessage(
            text,
            recipientPublicKey,
            secretKey
        );

        // Note: Signing is disabled because the identity system only generates
        // X25519 box keypairs, not Ed25519 signing keypairs. nacl.sign.detached()
        // requires an Ed25519 secret key. TODO: Generate a separate signing keypair.
        const signature = '';

        const message: MeshMessage = {
            id: uuidv4(),
            type: MessageType.TEXT,
            senderId: identity.id,
            recipientId,
            content: ciphertext,
            timestamp: Date.now(),
            ttl: DEFAULT_TTL,
            hopCount: 0,
            signature,
            nonce,
        };

        // Save locally with plaintext for display (we can't decrypt our own NaCl box messages)
        const serialized: SerializedMessage = {
            ...message,
            type: message.type,
            plaintextContent: text,
            status: MessageStatus.QUEUED,
        };
        saveMessage(serialized);

        // Update conversation
        upsertConversation({
            peerId: recipientId,
            peerName: peerManager.getPeer(recipientId)?.displayName ?? 'Unknown',
            peerPublicKey: recipientPublicKey,
            lastMessage: text,
            lastMessageTimestamp: message.timestamp,
            unreadCount: 0,
            updatedAt: message.timestamp,
        });

        // Find the peer and try direct send
        const peer = peerManager.getPeer(recipientId);
        if (peer && peer.connectionState === PeerConnectionState.CONNECTED) {
            messageQueue.enqueue(message, peer.deviceId);
        } else {
            // No direct connection — relay via all connected peers
            messageQueue.enqueue(message, null);
            // Also store in relay cache
            addToRelayCache(serialized);
        }

        return message;
    }

    // ─── Receive & Route ───────────────────────────────────────

    private async handleIncomingData(
        deviceId: string,
        data: Uint8Array
    ): Promise<void> {
        try {
            const text = Buffer.from(data).toString('utf-8');
            const message: MeshMessage = JSON.parse(text);

            // Deduplication check
            if (this.seenMessages.has(message.id)) return;
            this.seenMessages.set(message.id, { timestamp: Date.now() });
            this.enforceDeduPSize();

            const identity = getCachedIdentity();
            if (!identity) return;

            // Handle ACK messages — update the original message's status
            if (message.type === MessageType.ACK) {
                if (message.recipientId === identity.id) {
                    // ACK is for us — mark the original message as delivered
                    updateMessageStatus(message.content, MessageStatus.DELIVERED);
                    this.onMessageReceived?.(message, '', undefined);
                } else {
                    // ACK for someone else — relay it
                    await this.relayMessage(message, deviceId);
                }
                return;
            }

            // Handle IDENTITY messages (no encryption)
            if (message.type === MessageType.IDENTITY) {
                return;
            }

            if (message.recipientId === identity.id) {
                // Message is for us — decrypt and deliver
                await this.deliverMessage(message, deviceId);
            } else {
                // Message is not for us — relay if enabled
                await this.relayMessage(message, deviceId);
            }
        } catch (error) {
            log.warn('Failed to process incoming data:', error);
        }
    }

    private async deliverMessage(
        message: MeshMessage,
        fromDeviceId: string
    ): Promise<void> {
        try {
            const secretKey = await getSecretKey();
            const senderPeer = peerManager.findByDeviceId(fromDeviceId);
            const senderPublicKey =
                senderPeer?.publicKey ?? dbGetPeer(message.senderId)?.publicKey;

            if (!senderPublicKey) {
                log.warn('Cannot decrypt — unknown sender public key');
                return;
            }

            const decryptedContent = decryptMessage(
                message.content,
                message.nonce,
                senderPublicKey,
                secretKey
            );

            // Save to DB
            const serialized: SerializedMessage = {
                ...message,
                type: message.type,
                content: message.content, // stored encrypted
                status: MessageStatus.DELIVERED,
            };
            saveMessage(serialized);

            // Update conversation
            upsertConversation({
                peerId: message.senderId,
                peerName: senderPeer?.displayName ?? 'Unknown',
                peerPublicKey: senderPublicKey,
                lastMessage: decryptedContent,
                lastMessageTimestamp: message.timestamp,
                unreadCount: 1, // will be accumulated by Database.upsertConversation
                updatedAt: Date.now(),
            });

            // Notify UI
            this.onMessageReceived?.(message, decryptedContent, senderPeer);

            // Send ACK
            this.sendAck(message.id, message.senderId, fromDeviceId);
        } catch (error) {
            log.warn('Failed to deliver message:', error);
        }
    }

    private async relayMessage(message: MeshMessage, fromDeviceId?: string): Promise<void> {
        const settings = getSettings();
        if (!settings.relayEnabled) return;

        // Decrement TTL
        if (message.ttl <= 0) return;

        const relayMessage: MeshMessage = {
            ...message,
            ttl: message.ttl - 1,
            hopCount: message.hopCount + 1,
        };

        // Store in relay cache
        const serialized: SerializedMessage = {
            ...relayMessage,
            type: relayMessage.type,
            status: MessageStatus.QUEUED,
        };
        addToRelayCache(serialized);

        // Forward to all connected peers, excluding the sender to prevent echo
        messageQueue.enqueue(relayMessage, null, fromDeviceId ?? null);
    }

    private sendAck(
        messageId: string,
        senderId: string,
        senderDeviceId: string
    ): void {
        const identity = getCachedIdentity();
        if (!identity) return;

        const ack: MeshMessage = {
            id: uuidv4(),
            type: MessageType.ACK,
            senderId: identity.id,
            recipientId: senderId,
            content: messageId, // the message being acknowledged
            timestamp: Date.now(),
            ttl: DEFAULT_TTL,
            hopCount: 0,
            signature: '',
            nonce: '',
        };

        const data = Buffer.from(JSON.stringify(ack), 'utf-8');
        bleManager.sendData(senderDeviceId, ack.id, new Uint8Array(data), false);
    }

    // ─── Identity Exchange ──────────────────────────────────────

    private async exchangeIdentity(deviceId: string): Promise<void> {
        try {
            const remoteIdentityJson = await Promise.race([
                bleManager.readIdentity(deviceId),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000))
            ]);
            if (remoteIdentityJson) {
                const remote = JSON.parse(remoteIdentityJson);
                peerManager.updateIdentity(
                    deviceId,
                    remote.id,
                    remote.publicKey,
                    remote.displayName
                );
            }
        } catch (error) {
            log.warn('Identity exchange failed:', error);
        }
    }

    // ─── Relay Cache Flush ──────────────────────────────────────

    private flushRelayCache(): void {
        const cache = getRelayCache();
        for (const msg of cache) {
            const peer = peerManager.getPeer(msg.recipientId);
            if (peer && peer.connectionState === PeerConnectionState.CONNECTED) {
                const meshMsg: MeshMessage = {
                    id: msg.id,
                    type: msg.type as MessageType,
                    senderId: msg.senderId,
                    recipientId: msg.recipientId,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    ttl: msg.ttl,
                    hopCount: msg.hopCount,
                    signature: msg.signature,
                    nonce: msg.nonce,
                };
                messageQueue.enqueue(meshMsg, peer.deviceId);
                removeFromRelayCache(msg.id);
            }
        }
    }

    // ─── Deduplication ──────────────────────────────────────────

    private cleanupDedup(): void {
        const now = Date.now();
        for (const [id, entry] of this.seenMessages.entries()) {
            if (now - entry.timestamp > DEDUP_EXPIRY_MS) {
                this.seenMessages.delete(id);
            }
        }
    }

    private enforceDeduPSize(): void {
        if (this.seenMessages.size > DEDUP_CACHE_SIZE) {
            // Remove oldest entries
            const entries = Array.from(this.seenMessages.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, entries.length - DEDUP_CACHE_SIZE);
            for (const [id] of toRemove) {
                this.seenMessages.delete(id);
            }
        }
    }

    // ─── Scanning Control ──────────────────────────────────────

    async startScanning(): Promise<void> {
        await bleManager.startScan();
    }

    stopScanning(): void {
        bleManager.stopScan();
    }

    // ─── Events ─────────────────────────────────────────────────

    setOnMessageReceived(cb: OnMessageReceivedCallback | null): void {
        this.onMessageReceived = cb;
    }

    // ─── State ──────────────────────────────────────────────────

    getIsRunning(): boolean {
        return this.isRunning;
    }
}

export const meshRouter = new MeshRouterService();
