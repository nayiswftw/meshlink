/**
 * RelayService — Implements message relay/forwarding to extend mesh network reach.
 * 
 * Enables multi-hop messaging by forwarding messages through intermediate nodes.
 * Prevents infinite loops using message ID tracking and TTL (hop count).
 */

import BitchatAPI from 'expo-bitchat';
import type { BitchatMessage, PeerInfo } from 'expo-bitchat';
import { createLogger } from './Logger';
import {
    storeForwardMessage,
    getStoreForwardForPeer,
    removeStoreForwardMessages,
    getStoreForwardCount,
} from './storage/Database';
import type { StoreForwardMessage } from '../types';

const log = createLogger('RelayService');

// ─── Configuration ───────────────────────────────────────────

const MAX_HOPS = 5; // Maximum number of times a message can be relayed
const MAX_SOS_HOPS = 10; // SOS messages get extended relay range
const SEEN_MESSAGE_CACHE_SIZE = 1000; // Number of message IDs to track
const SEEN_MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORE_FORWARD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const SOS_PREFIX = '__SOS__';
const SOS_DELIMITER = '__SOSDATA__';

// ─── Relay Message Metadata ──────────────────────────────────

export interface RelayMetadata {
    hopCount: number;
    originPeerID: string;
    originNickname: string;
    destinationPeerID?: string; // Optional: specific destination for private messages
    destinationNickname?: string; // Preferred destination key for app-level matching
    relayPath?: string[]; // Track the path the message took
}

// ─── SOS Metadata ───────────────────────────────────────────

export interface SOSPayload {
    senderNickname: string;
    senderPeerID: string;
    message: string;
    timestamp: number;
    coordinates?: { lat: number; lon: number } | null;
    hopCount: number;
    relayPath: string[];
}

// ─── Seen Message Tracking ───────────────────────────────────

interface SeenMessageEntry {
    id: string;
    timestamp: number;
}

class SeenMessageTracker {
    private seenMessages: Map<string, number> = new Map();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Periodic cleanup of old entries
        this.cleanupTimer = setInterval(() => this.cleanup(), 60000); // Every minute
    }

    /**
     * Check if we've seen this message before
     */
    hasSeen(messageId: string): boolean {
        return this.seenMessages.has(messageId);
    }

    /**
     * Mark a message as seen
     */
    markSeen(messageId: string): void {
        this.seenMessages.set(messageId, Date.now());
        
        // If cache is too large, remove oldest entries
        if (this.seenMessages.size > SEEN_MESSAGE_CACHE_SIZE) {
            this.cleanup();
        }
    }

    /**
     * Remove old entries from the cache
     */
    private cleanup(): void {
        const now = Date.now();
        const entriesToDelete: string[] = [];

        for (const [id, timestamp] of this.seenMessages.entries()) {
            if (now - timestamp > SEEN_MESSAGE_TTL_MS) {
                entriesToDelete.push(id);
            }
        }

        entriesToDelete.forEach(id => this.seenMessages.delete(id));
        
        if (entriesToDelete.length > 0) {
            log.debug(`Cleaned up ${entriesToDelete.length} old message IDs`);
        }
    }

    /**
     * Clear all tracked messages
     */
    clear(): void {
        this.seenMessages.clear();
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }
}

// ─── Relay Service ───────────────────────────────────────────

export class RelayService {
    private static instance: RelayService | null = null;
    private seenTracker: SeenMessageTracker;
    private isEnabled: boolean = true;
    private storeForwardEnabled: boolean = true;
    private myPeerID: string = '';
    private myNickname: string = '';

    private constructor() {
        this.seenTracker = new SeenMessageTracker();
    }

    static getInstance(): RelayService {
        if (!RelayService.instance) {
            RelayService.instance = new RelayService();
        }
        return RelayService.instance;
    }

    /**
     * Set the current user's identity
     */
    setIdentity(peerID: string, nickname: string): void {
        this.myPeerID = peerID;
        this.myNickname = nickname;
        log.info(`Relay identity set: ${nickname} (${peerID})`);
    }

    /**
     * Enable or disable relay functionality
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        log.info(`Relay ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Enable or disable store-and-forward
     */
    setStoreForwardEnabled(enabled: boolean): void {
        this.storeForwardEnabled = enabled;
        log.info(`Store-and-forward ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if store-and-forward is enabled
     */
    isStoreForwardEnabled(): boolean {
        return this.storeForwardEnabled;
    }

    /**
     * Check if relay is enabled
     */
    isRelayEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Parse relay metadata from message content
     * Metadata is encoded as: __RELAY__{json}__MSG__actual_content
     */
    parseRelayMetadata(content: string): { metadata: RelayMetadata | null; actualContent: string } {
        const relayPrefix = '__RELAY__';
        const msgDelimiter = '__MSG__';
        
        if (!content.startsWith(relayPrefix)) {
            return { metadata: null, actualContent: content };
        }

        try {
            const delimiterIndex = content.indexOf(msgDelimiter);
            if (delimiterIndex === -1) {
                return { metadata: null, actualContent: content };
            }

            const metadataJson = content.substring(relayPrefix.length, delimiterIndex);
            const actualContent = content.substring(delimiterIndex + msgDelimiter.length);
            const metadata = JSON.parse(metadataJson) as RelayMetadata;

            return { metadata, actualContent };
        } catch (error) {
            log.warn('Failed to parse relay metadata:', error);
            return { metadata: null, actualContent: content };
        }
    }

    /**
     * Encode message with relay metadata
     */
    encodeRelayMessage(content: string, metadata: RelayMetadata): string {
        const relayPrefix = '__RELAY__';
        const msgDelimiter = '__MSG__';
        return `${relayPrefix}${JSON.stringify(metadata)}${msgDelimiter}${content}`;
    }

    /**
     * Create initial relay metadata for a new message
     */
    createInitialMetadata(destinationPeerID?: string, destinationNickname?: string): RelayMetadata {
        return {
            hopCount: 0,
            originPeerID: this.myPeerID,
            originNickname: this.myNickname,
            destinationPeerID,
            destinationNickname,
            relayPath: [this.myPeerID],
        };
    }

    /**
     * Process an incoming message and determine if it should be relayed
     * Returns true if the message was relayed
     */
    async processIncomingMessage(
        message: BitchatMessage,
        connectedPeers: PeerInfo,
        isForMe: boolean
    ): Promise<boolean> {
        // If relay is disabled, don't process
        if (!this.isEnabled) {
            return false;
        }

        // Parse relay metadata
        const { metadata, actualContent } = this.parseRelayMetadata(message.content);

        // If message doesn't have relay metadata, it's not a relay message
        if (!metadata) {
            return false;
        }

        // Check if we've already seen this message
        if (this.seenTracker.hasSeen(message.id)) {
            log.debug(`Ignoring duplicate relay message ${message.id}`);
            return false;
        }

        // Mark message as seen
        this.seenTracker.markSeen(message.id);

        // If this message is for me, don't relay it (destination reached)
        if (isForMe) {
            log.info(`Relay message ${message.id} reached destination`);
            return false;
        }

        // Check hop count
        if (metadata.hopCount >= MAX_HOPS) {
            log.debug(`Message ${message.id} exceeded max hops (${MAX_HOPS})`);
            return false;
        }

        // Check if we're in the relay path (loop prevention)
        if (metadata.relayPath && metadata.relayPath.includes(this.myPeerID)) {
            log.debug(`Message ${message.id} already passed through this node`);
            return false;
        }

        // Relay the message
        await this.relayMessage(message, metadata, actualContent, connectedPeers);

        // Store-and-forward: if this is a private message for someone not currently
        // connected, store it locally so we can forward when they connect later.
        if (this.storeForwardEnabled && metadata.destinationNickname) {
            const destinationConnected = Object.values(connectedPeers).includes(
                metadata.destinationNickname
            );
            if (!destinationConnected) {
                const sfMsg: StoreForwardMessage = {
                    id: message.id,
                    encodedContent: message.content, // Keep full relay-encoded content
                    destinationNickname: metadata.destinationNickname,
                    destinationPeerID: metadata.destinationPeerID,
                    originNickname: metadata.originNickname,
                    originPeerID: metadata.originPeerID,
                    isPrivate: message.isPrivate,
                    channel: message.channel,
                    mentions: message.mentions,
                    storedAt: Date.now(),
                    expiresAt: Date.now() + STORE_FORWARD_TTL_MS,
                    hopCount: metadata.hopCount,
                };
                storeForwardMessage(sfMsg);
                log.info(
                    `Stored message ${message.id} for offline peer ${metadata.destinationNickname}`
                );
            }
        }

        return true;
    }

    /**
     * Relay a message to connected peers
     */
    private async relayMessage(
        originalMessage: BitchatMessage,
        metadata: RelayMetadata,
        actualContent: string,
        connectedPeers: PeerInfo
    ): Promise<void> {
        // Increment hop count and update relay path
        const newMetadata: RelayMetadata = {
            ...metadata,
            hopCount: metadata.hopCount + 1,
            relayPath: [...(metadata.relayPath || []), this.myPeerID],
        };

        const relayContent = this.encodeRelayMessage(actualContent, newMetadata);

        // Get list of peers to relay to (exclude the sender)
        const peersToRelay = Object.keys(connectedPeers).filter(
            peerID => peerID !== originalMessage.senderPeerID
        );

        if (peersToRelay.length === 0) {
            log.debug(`No peers available to relay message ${originalMessage.id}`);
            return;
        }

        log.info(
            `Relaying message ${originalMessage.id} (hop ${newMetadata.hopCount}/${MAX_HOPS}) ` +
            `from ${metadata.originNickname} to ${peersToRelay.length} peers`
        );

        // Relay to all connected peers
        const relayPromises = peersToRelay.map(async (peerID) => {
            const peerNickname = connectedPeers[peerID];
            try {
                if (originalMessage.isPrivate) {
                    await BitchatAPI.sendPrivateMessage(relayContent, peerID, peerNickname);
                } else if (originalMessage.channel) {
                    // For channel messages, just re-broadcast to the channel
                    await BitchatAPI.sendMessage(relayContent, originalMessage.mentions || [], originalMessage.channel);
                }
                log.debug(`Relayed to ${peerNickname} (${peerID})`);
            } catch (error) {
                log.error(`Failed to relay to ${peerNickname}:`, error);
            }
        });

        await Promise.allSettled(relayPromises);
    }

    /**
     * Send a message with relay support
     */
    async sendWithRelay(
        content: string,
        isPrivate: boolean,
        recipientPeerID?: string,
        recipientNickname?: string,
        channel?: string,
        mentions?: string[]
    ): Promise<void> {
        if (!this.isEnabled) {
            // If relay is disabled, send normally
            if (isPrivate && recipientPeerID && recipientNickname) {
                await BitchatAPI.sendPrivateMessage(content, recipientPeerID, recipientNickname);
            } else if (channel) {
                await BitchatAPI.sendMessage(content, mentions || [], channel);
            }
            return;
        }

        // Create relay metadata
        const metadata = this.createInitialMetadata(recipientPeerID, recipientNickname);
        const relayContent = this.encodeRelayMessage(content, metadata);

        // Mark our own message as seen to prevent loops
        // Note: We don't have the message ID yet, so we'll track based on content hash
        // This is handled by the message listener

        // Send the message with relay metadata
        if (isPrivate && recipientPeerID && recipientNickname) {
            const connected = await BitchatAPI.getConnectedPeers();
            if (connected[recipientPeerID]) {
                await BitchatAPI.sendPrivateMessage(relayContent, recipientPeerID, recipientNickname);
            } else {
                // DTN/Store & Forward: The destination is offline, inject into the mesh
                // so connected nodes act as data mules.
                const peerPromises = Object.keys(connected).map(pid =>
                    BitchatAPI.sendPrivateMessage(relayContent, pid, connected[pid])
                        .catch(e => log.error('Failed to inject S&F message to ' + connected[pid], e))
                );
                await Promise.allSettled(peerPromises);
            }
        } else if (channel) {
            await BitchatAPI.sendMessage(relayContent, mentions || [], channel);
        }

        log.info(`Sent message with relay support (destination: ${recipientNickname || channel || 'broadcast'})`);
    }

    // ─── SOS Broadcasting ────────────────────────────────────────

    /**
     * Encode an SOS message payload
     */
    encodeSOSMessage(payload: SOSPayload): string {
        return `${SOS_PREFIX}${JSON.stringify(payload)}${SOS_DELIMITER}`;
    }

    /**
     * Check if a message content is an SOS broadcast
     */
    isSOSMessage(content: string): boolean {
        return content.startsWith(SOS_PREFIX);
    }

    /**
     * Parse SOS payload from message content
     */
    parseSOSMessage(content: string): SOSPayload | null {
        if (!content.startsWith(SOS_PREFIX)) return null;
        try {
            const delimIdx = content.indexOf(SOS_DELIMITER);
            const json = delimIdx >= 0
                ? content.substring(SOS_PREFIX.length, delimIdx)
                : content.substring(SOS_PREFIX.length);
            return JSON.parse(json) as SOSPayload;
        } catch {
            log.warn('Failed to parse SOS payload');
            return null;
        }
    }

    /**
     * Broadcast an SOS alert to all connected peers.
     * SOS messages get extended hop limit and bypass relay-enabled check.
     */
    async sendSOS(
        message: string,
        connectedPeers: PeerInfo,
        coordinates?: { lat: number; lon: number } | null,
    ): Promise<void> {
        const payload: SOSPayload = {
            senderNickname: this.myNickname,
            senderPeerID: this.myPeerID,
            message,
            timestamp: Date.now(),
            coordinates: coordinates ?? null,
            hopCount: 0,
            relayPath: [this.myPeerID],
        };

        const encoded = this.encodeSOSMessage(payload);

        log.info(`Broadcasting SOS to mesh`);

        // Send as unencrypted broadcast so SOS reaches all peers
        // without requiring completed key exchange
        try {
            await BitchatAPI.sendMessage(encoded, []);
        } catch (error) {
            log.error('SOS broadcast failed:', error);
        }

        log.info('SOS broadcast complete');
    }

    /**
     * Relay a received SOS message if under hop limit.
     * Returns true if relayed.
     */
    async relaySOSMessage(
        messageId: string,
        sosPayload: SOSPayload,
        connectedPeers: PeerInfo,
        senderPeerID?: string,
    ): Promise<boolean> {
        if (this.seenTracker.hasSeen(messageId)) return false;
        this.seenTracker.markSeen(messageId);

        if (sosPayload.hopCount >= MAX_SOS_HOPS) {
            log.debug(`SOS ${messageId} exceeded max SOS hops (${MAX_SOS_HOPS})`);
            return false;
        }

        if (sosPayload.relayPath.includes(this.myPeerID)) {
            log.debug(`SOS ${messageId} already passed through this node`);
            return false;
        }

        const relayed: SOSPayload = {
            ...sosPayload,
            hopCount: sosPayload.hopCount + 1,
            relayPath: [...sosPayload.relayPath, this.myPeerID],
        };

        const encoded = this.encodeSOSMessage(relayed);

        const peersToRelay = Object.keys(connectedPeers).filter(
            (id) => id !== senderPeerID && !sosPayload.relayPath.includes(id)
        );

        if (peersToRelay.length === 0) return false;

        log.info(`Relaying SOS from ${sosPayload.senderNickname} (hop ${relayed.hopCount}/${MAX_SOS_HOPS}) to ${peersToRelay.length} peers`);

        const promises = peersToRelay.map(async (peerID) => {
            try {
                await BitchatAPI.sendPrivateMessage(encoded, peerID, connectedPeers[peerID]);
            } catch (error) {
                log.error(`Failed to relay SOS to ${connectedPeers[peerID]}:`, error);
            }
        });

        await Promise.allSettled(promises);
        return true;
    }

    /**
     * Get relay statistics
     */
    getStats(): { seenMessages: number; enabled: boolean; maxHops: number; storeForwardCount: number; storeForwardEnabled: boolean } {
        return {
            seenMessages: this.seenTracker['seenMessages'].size,
            enabled: this.isEnabled,
            maxHops: MAX_HOPS,
            storeForwardCount: getStoreForwardCount(),
            storeForwardEnabled: this.storeForwardEnabled,
        };
    }

    /**
     * Clear the seen message cache
     */
    clearCache(): void {
        this.seenTracker.clear();
        log.info('Relay cache cleared');
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.seenTracker.destroy();
        RelayService.instance = null;
    }

    // ─── Store-and-Forward (DTN) ───────────────────────────────

    /**
     * Flush stored messages for a newly-connected peer.
     * Called when a peer connects — sends any held messages and removes them.
     */
    async flushStoreForward(peerNickname: string, peerID: string): Promise<number> {
        if (!this.storeForwardEnabled) return 0;

        const held = getStoreForwardForPeer(peerNickname);
        if (held.length === 0) return 0;

        log.info(`Flushing ${held.length} stored messages for ${peerNickname}`);

        const delivered: string[] = [];

        for (const msg of held) {
            try {
                if (msg.isPrivate) {
                    await BitchatAPI.sendPrivateMessage(msg.encodedContent, peerID, peerNickname);
                } else if (msg.channel) {
                    await BitchatAPI.sendMessage(
                        msg.encodedContent,
                        msg.mentions || [],
                        msg.channel
                    );
                }
                delivered.push(msg.id);
                log.debug(`Forwarded stored message ${msg.id} to ${peerNickname}`);
            } catch (error) {
                log.error(`Failed to forward stored message ${msg.id}:`, error);
            }
        }

        if (delivered.length > 0) {
            removeStoreForwardMessages(delivered);
            log.info(`Delivered ${delivered.length}/${held.length} stored messages to ${peerNickname}`);
        }

        return delivered.length;
    }
}

export default RelayService.getInstance();
