/**
 * PeerManager — Tracks the lifecycle of peer connections.
 *
 * Maintains a live registry of discovered and connected peers,
 * with signal strength tracking and auto-cleanup of stale entries.
 */
import { PeerConnectionState, type Peer, type PeerRecord } from '../../types';
import { savePeer as dbSavePeer, updatePeerLastSeen } from '../storage/Database';

type PeerChangeCallback = (peers: Peer[]) => void;

class PeerManagerService {
    private peers: Map<string, Peer> = new Map();
    private onChange: PeerChangeCallback | null = null;
    private staleCheckInterval: ReturnType<typeof setInterval> | null = null;

    private static STALE_TIMEOUT_MS = 60_000; // 60 seconds without signal → stale

    // ─── Peer Lifecycle ─────────────────────────────────────────

    /**
     * Register or update a discovered peer from a BLE scan result.
     */
    upsertFromScan(
        deviceId: string,
        rssi: number,
        existingPeerId?: string,
        displayName?: string,
        publicKey?: string
    ): Peer {
        const existing = this.findByDeviceId(deviceId);

        if (existing) {
            const updated: Peer = {
                ...existing,
                rssi,
                lastSeen: Date.now(),
            };
            this.peers.set(existing.id, updated);
            this.notifyChange();
            return updated;
        }

        // New peer — create a placeholder until identity exchange
        const peer: Peer = {
            id: existingPeerId ?? deviceId, // will be replaced after identity exchange
            publicKey: publicKey ?? '',
            displayName: displayName ?? 'Unknown Device',
            rssi,
            lastSeen: Date.now(),
            connectionState: PeerConnectionState.DISCOVERED,
            isRelay: false,
            deviceId,
        };

        this.peers.set(peer.id, peer);
        this.notifyChange();
        return peer;
    }

    /**
     * Update a peer after identity exchange (we now know their real ID and public key).
     */
    updateIdentity(
        deviceId: string,
        peerId: string,
        publicKey: string,
        displayName: string
    ): void {
        // Remove placeholder entry if exists
        const placeholder = this.findByDeviceId(deviceId);
        if (placeholder && placeholder.id !== peerId) {
            this.peers.delete(placeholder.id);
        }

        const existing = this.peers.get(peerId);
        const peer: Peer = {
            ...(existing ?? {
                rssi: -100,
                lastSeen: Date.now(),
                connectionState: PeerConnectionState.DISCOVERED,
                isRelay: false,
            }),
            id: peerId,
            publicKey,
            displayName,
            deviceId,
            lastSeen: Date.now(),
        };

        this.peers.set(peerId, peer);

        // Also persist to DB
        const record: PeerRecord = {
            id: peerId,
            publicKey,
            displayName,
            lastSeen: Date.now(),
            trustLevel: 1,
        };
        dbSavePeer(record);

        this.notifyChange();
    }

    /**
     * Update connection state of a peer.
     */
    setConnectionState(
        identifier: string,
        state: PeerConnectionState
    ): void {
        // Try by peer ID first, then by device ID
        let peer = this.peers.get(identifier);
        if (!peer) {
            peer = this.findByDeviceId(identifier);
        }
        if (!peer) return;

        this.peers.set(peer.id, { ...peer, connectionState: state });
        this.notifyChange();
    }

    /**
     * Remove a peer from the live registry.
     */
    removePeer(identifier: string): void {
        if (this.peers.has(identifier)) {
            this.peers.delete(identifier);
        } else {
            const peer = this.findByDeviceId(identifier);
            if (peer) this.peers.delete(peer.id);
        }
        this.notifyChange();
    }

    // ─── Queries ────────────────────────────────────────────────

    getPeer(id: string): Peer | undefined {
        return this.peers.get(id);
    }

    findByDeviceId(deviceId: string): Peer | undefined {
        for (const peer of this.peers.values()) {
            if (peer.deviceId === deviceId) return peer;
        }
        return undefined;
    }

    getAllPeers(): Peer[] {
        return Array.from(this.peers.values());
    }

    getConnectedPeers(): Peer[] {
        return this.getAllPeers().filter(
            (p) => p.connectionState === PeerConnectionState.CONNECTED
        );
    }

    getConnectedPeerDeviceIds(): string[] {
        return this.getConnectedPeers().map((p) => p.deviceId);
    }

    // ─── Stale Cleanup ─────────────────────────────────────────

    startStaleCheck(): void {
        if (this.staleCheckInterval) clearInterval(this.staleCheckInterval);
        this.staleCheckInterval = setInterval(() => {
            const now = Date.now();
            let changed = false;
            for (const [id, peer] of this.peers.entries()) {
                if (
                    (peer.connectionState === PeerConnectionState.DISCOVERED ||
                     peer.connectionState === PeerConnectionState.DISCONNECTED) &&
                    now - peer.lastSeen > PeerManagerService.STALE_TIMEOUT_MS
                ) {
                    this.peers.delete(id);
                    changed = true;
                }
            }
            if (changed) this.notifyChange();
        }, 30_000);
    }

    stopStaleCheck(): void {
        if (this.staleCheckInterval) {
            clearInterval(this.staleCheckInterval);
            this.staleCheckInterval = null;
        }
    }

    // ─── Events ─────────────────────────────────────────────────

    setOnChange(cb: PeerChangeCallback | null): void {
        this.onChange = cb;
    }

    private notifyChange(): void {
        this.onChange?.(this.getAllPeers());
    }

    // ─── Cleanup ────────────────────────────────────────────────

    clear(): void {
        this.peers.clear();
        this.stopStaleCheck();
    }
}

export const peerManager = new PeerManagerService();
