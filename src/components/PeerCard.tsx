/**
 * PeerCard — Peer list item with avatar, name, signal strength, and status.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Peer } from '../types';
import { peerColor } from '../constants';

interface PeerCardProps {
    peer: Peer;
    onPress: (peer: Peer) => void;
}

function getSignalBars(rssi: number): number {
    if (rssi >= -50) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -80) return 2;
    if (rssi >= -90) return 1;
    return 0;
}

function getStatusLabel(state: string): { label: string; colour: string } {
    switch (state) {
        case 'connected':
            return { label: 'Connected', colour: '#4A7C59' };
        case 'connecting':
            return { label: 'Connecting…', colour: '#C4903D' };
        case 'discovered':
            return { label: 'Nearby', colour: '#5C6B3C' };
        default:
            return { label: 'Offline', colour: '#A0977D' };
    }
}

function PeerCardInner({ peer, onPress }: PeerCardProps) {
    const color = peerColor(peer.publicKey || peer.id);
    const bars = getSignalBars(peer.rssi);
    const status = getStatusLabel(peer.connectionState);
    const initials = peer.displayName
        .split('-')
        .pop()
        ?.slice(0, 2)
        .toUpperCase() ?? '??';

    return (
        <TouchableOpacity
            onPress={() => onPress(peer)}
            activeOpacity={0.7}
            className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 mb-3 border border-[#E8E2D9]"
            style={{
                shadowColor: '#8B7D6B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
            }}
        >
            {/* Avatar */}
            <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3.5"
                style={{ backgroundColor: color + '20' }}
            >
                <Text
                    className="text-base font-bold"
                    style={{ color }}
                >
                    {initials}
                </Text>
            </View>

            {/* Info */}
            <View className="flex-1">
                <Text className="text-[#2C2C2C] font-semibold text-base" numberOfLines={1}>
                    {peer.displayName}
                </Text>
                <View className="flex-row items-center mt-1">
                    <View
                        className="w-2 h-2 rounded-full mr-1.5"
                        style={{ backgroundColor: status.colour }}
                    />
                    <Text className="text-[#7A7A7A] text-xs">{status.label}</Text>
                    {peer.isRelay && (
                        <View className="flex-row items-center ml-2">
                            <Ionicons name="git-network-outline" size={12} color="#5C6B3C" />
                            <Text className="text-[#5C6B3C] text-xs ml-0.5">Relay</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Signal Strength */}
            <View className="flex-row items-end h-5 gap-0.5">
                {[1, 2, 3, 4].map((level) => (
                    <View
                        key={level}
                        className="w-1 rounded-full"
                        style={{
                            height: 4 + level * 3,
                            backgroundColor: level <= bars ? '#5C6B3C' : '#D9D2C7',
                        }}
                    />
                ))}
            </View>

            <Ionicons
                name="chevron-forward"
                size={16}
                color="#B8B0A0"
                style={{ marginLeft: 8 }}
            />
        </TouchableOpacity>
    );
}

export default React.memo(PeerCardInner);
