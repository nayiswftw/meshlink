/**
 * MeshMap — Force-directed network topology visualisation.
 *
 * Renders nodes (peers) and edges (connections) in a canvas-style view
 * using simple spring-force simulation on each render tick.
 */
import React, { useMemo } from 'react';
import { View, Text, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { peerColor } from '../constants';
import type { TopologyNode, TopologyEdge } from '../types';
import { formatName } from '../utils';

interface MeshMapProps {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    onPeerPress?: (peerId: string, nickname: string) => void;
}

interface LayoutNode {
    id: string;
    nickname: string;
    isMe: boolean;
    isConnected: boolean;
    x: number;
    y: number;
}

// ─── Simple force-directed layout ────────────────────────────────

function layoutGraph(nodes: TopologyNode[], edges: TopologyEdge[], width: number, height: number): LayoutNode[] {
    if (nodes.length === 0) return [];

    const cx = width / 2;
    const cy = height / 2;

    // Initialise positions in a circle
    const laid: LayoutNode[] = nodes.map((n, i) => {
        if (n.isMe) {
            return { ...n, x: cx, y: cy };
        }
        const angle = (2 * Math.PI * i) / Math.max(nodes.length - 1, 1);
        const r = Math.min(width, height) * 0.3;
        return {
            ...n,
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r,
        };
    });

    // Build index
    const idx = new Map<string, number>();
    laid.forEach((n, i) => idx.set(n.id, i));

    // Simple force iterations
    const ITERATIONS = 60;
    const REPULSION = 3000;
    const ATTRACTION = 0.05;
    const IDEAL_LEN = 90;
    const DAMPING = 0.85;

    const vx = new Float64Array(laid.length);
    const vy = new Float64Array(laid.length);

    for (let iter = 0; iter < ITERATIONS; iter++) {
        // Repulsion between all node pairs
        for (let i = 0; i < laid.length; i++) {
            for (let j = i + 1; j < laid.length; j++) {
                let dx = laid[i].x - laid[j].x;
                let dy = laid[i].y - laid[j].y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = REPULSION / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                vx[i] += fx;
                vy[i] += fy;
                vx[j] -= fx;
                vy[j] -= fy;
            }
        }

        // Attraction along edges
        for (const edge of edges) {
            const ai = idx.get(edge.from);
            const bi = idx.get(edge.to);
            if (ai === undefined || bi === undefined) continue;
            const dx = laid[bi].x - laid[ai].x;
            const dy = laid[bi].y - laid[ai].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = ATTRACTION * (dist - IDEAL_LEN);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            vx[ai] += fx;
            vy[ai] += fy;
            vx[bi] -= fx;
            vy[bi] -= fy;
        }

        // Apply velocities with damping, pin "me" to center
        for (let i = 0; i < laid.length; i++) {
            if (laid[i].isMe) {
                vx[i] = 0;
                vy[i] = 0;
                continue;
            }
            vx[i] *= DAMPING;
            vy[i] *= DAMPING;
            laid[i].x += vx[i];
            laid[i].y += vy[i];

            // Clamp to bounds
            const pad = 30;
            laid[i].x = Math.max(pad, Math.min(width - pad, laid[i].x));
            laid[i].y = Math.max(pad, Math.min(height - pad, laid[i].y));
        }
    }

    return laid;
}

// ─── Component ───────────────────────────────────────────────────

export default function MeshMap({ nodes, edges, onPeerPress }: MeshMapProps) {
    const { width: screenW } = Dimensions.get('window');
    const mapW = screenW - 32; // 16px padding each side
    const mapH = 340;

    const layout = useMemo(() => layoutGraph(nodes, edges, mapW, mapH), [nodes, edges, mapW, mapH]);

    const nodeIdx = useMemo(() => {
        const m = new Map<string, LayoutNode>();
        layout.forEach((n) => m.set(n.id, n));
        return m;
    }, [layout]);

    if (nodes.length === 0) {
        return (
            <View style={{ height: mapH, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="git-network-outline" size={48} color="#D1D5DB" />
                <Text style={{ color: '#9CA3AF', marginTop: 8, fontSize: 14 }}>
                    No topology data yet
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{
                width: mapW,
                height: mapH,
                alignSelf: 'center',
                borderRadius: 16,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                overflow: 'hidden',
            }}
        >
            {/* Edges as lines (pure View divs rotated) */}
            {edges.map((edge) => {
                const a = nodeIdx.get(edge.from);
                const b = nodeIdx.get(edge.to);
                if (!a || !b) return null;

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                return (
                    <View
                        key={`${edge.from}-${edge.to}`}
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: a.x,
                            top: a.y,
                            width: len,
                            height: 2,
                            backgroundColor: '#D1D5DB',
                            transformOrigin: 'left center',
                            transform: [{ rotate: `${angle}deg` }],
                        }}
                    />
                );
            })}

            {/* Nodes */}
            {layout.map((node) => {
                const color = node.isMe ? '#059669' : peerColor(node.id);
                const size = node.isMe ? 44 : 36;

                return (
                    <TouchableOpacity
                        key={node.id}
                        disabled={node.isMe}
                        onPress={() => onPeerPress?.(node.id, node.nickname)}
                        activeOpacity={0.7}
                        style={{
                            position: 'absolute',
                            left: node.x - size / 2,
                            top: node.y - size / 2,
                            alignItems: 'center',
                        }}
                    >
                        <View
                            style={{
                                width: size,
                                height: size,
                                borderRadius: size / 2,
                                backgroundColor: color + (node.isConnected ? '33' : '15'),
                                borderWidth: 2,
                                borderColor: node.isConnected ? color : '#D1D5DB',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {node.isMe ? (
                                <Ionicons name="person" size={18} color={color} />
                            ) : (
                                <Text style={{ fontSize: 11, fontWeight: '700', color }}>
                                    {formatName(node.nickname).slice(0, 2).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text
                            numberOfLines={1}
                            style={{
                                fontSize: 9,
                                fontWeight: '600',
                                color: node.isMe ? '#059669' : '#6B7280',
                                marginTop: 2,
                                maxWidth: 60,
                                textAlign: 'center',
                            }}
                        >
                            {node.isMe ? 'You' : formatName(node.nickname)}
                        </Text>
                        {!node.isConnected && !node.isMe && (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: -2,
                                    right: -2,
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: '#EF4444',
                                    borderWidth: 1,
                                    borderColor: '#FFFFFF',
                                }}
                            />
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
