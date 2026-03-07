/**
 * TopologyService — Builds and maintains a graph model of the mesh network.
 *
 * Tracks direct peer connections and inferred relay-path edges to visualise
 * the network topology as an interactive map.
 */

import type { PeerInfo } from 'expo-bitchat';
import type { RelayMetadata } from './RelayService';
import type { TopologyNode, TopologyEdge } from '../types';
import { createLogger } from './Logger';

const log = createLogger('TopologyService');

/** Edges older than this are pruned automatically. */
const EDGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class TopologyService {
    private static instance: TopologyService | null = null;

    /** Nodes keyed by peerID. */
    private nodes = new Map<string, TopologyNode>();
    /** Edges keyed by a canonical "from|to" string (sorted). */
    private edges = new Map<string, TopologyEdge>();
    /** Own identity. */
    private myId = '';
    private myNickname = '';

    private constructor() {}

    static getInstance(): TopologyService {
        if (!TopologyService.instance) {
            TopologyService.instance = new TopologyService();
        }
        return TopologyService.instance;
    }

    // ─── Identity ────────────────────────────────────────────

    setIdentity(id: string, nickname: string): void {
        this.myId = id;
        this.myNickname = nickname;
        this.upsertNode(id, nickname, true, true);
    }

    // ─── Node helpers ────────────────────────────────────────

    private upsertNode(id: string, nickname: string, isMe: boolean, isConnected: boolean): void {
        this.nodes.set(id, {
            id,
            nickname,
            isMe,
            isConnected,
            lastSeen: Date.now(),
        });
    }

    // ─── Edge helpers ────────────────────────────────────────

    private edgeKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    private upsertEdge(from: string, to: string, hopCount?: number): void {
        const key = this.edgeKey(from, to);
        this.edges.set(key, { from, to, lastSeen: Date.now(), hopCount });
    }

    // ─── Public API ──────────────────────────────────────────

    /**
     * Call whenever the connected-peer map changes (connect/disconnect events).
     * Syncs direct-connection edges and marks nodes connected/disconnected.
     */
    updateDirectPeers(peerMap: PeerInfo): void {
        const now = Date.now();

        // Mark all non-me nodes as disconnected first
        for (const node of this.nodes.values()) {
            if (!node.isMe) node.isConnected = false;
        }

        // Delete direct edges to peers we are no longer connected to
        for (const [key, edge] of this.edges) {
            if (edge.from === this.myId || edge.to === this.myId) {
                const otherID = edge.from === this.myId ? edge.to : edge.from;
                if (!peerMap[otherID]) {
                    this.edges.delete(key);
                }
            }
        }

        // Upsert nodes + edges for each connected peer
        for (const [peerID, nickname] of Object.entries(peerMap)) {
            this.upsertNode(peerID, nickname, false, true);
            this.upsertEdge(this.myId, peerID, 1);
        }
    }

    /**
     * Ingest a relay-path from incoming message metadata to discover
     * multi-hop edges between peers we don't directly see.
     */
    ingestRelayPath(metadata: RelayMetadata): void {
        const path = metadata.relayPath;
        if (!path || path.length < 2) return;

        // Each consecutive pair in the path is an edge
        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];

            // Upsert nodes with whatever info we have
            if (!this.nodes.has(from)) {
                const nick = from === metadata.originPeerID ? metadata.originNickname : from;
                this.upsertNode(from, nick, from === this.myId, false);
            }
            if (!this.nodes.has(to)) {
                this.upsertNode(to, to, to === this.myId, false);
            }

            this.upsertEdge(from, to, i + 1);
        }

        // Also connect the origin to the first relay hop
        if (metadata.originPeerID && path[0] !== metadata.originPeerID) {
            if (!this.nodes.has(metadata.originPeerID)) {
                this.upsertNode(metadata.originPeerID, metadata.originNickname, false, false);
            }
            this.upsertEdge(metadata.originPeerID, path[0], 0);
        }

        log.debug(`Ingested relay path: ${path.join(' → ')}`);
    }

    /**
     * Return current topology snapshot, pruning stale edges.
     */
    getTopology(): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
        const now = Date.now();

        // Prune old edges
        for (const [key, edge] of this.edges) {
            if (now - edge.lastSeen > EDGE_TTL_MS) {
                this.edges.delete(key);
            }
        }

        // Prune orphaned nodes
        const nodesWithEdges = new Set<string>();
        for (const edge of this.edges.values()) {
            nodesWithEdges.add(edge.from);
            nodesWithEdges.add(edge.to);
        }

        for (const [nodeId, node] of this.nodes) {
            if (!node.isMe && !nodesWithEdges.has(nodeId)) {
                this.nodes.delete(nodeId);
            }
        }

        return {
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
        };
    }

    /** Clear all topology data. */
    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        if (this.myId) {
            this.upsertNode(this.myId, this.myNickname, true, true);
        }
    }
}

export default TopologyService.getInstance();
