/**
 * PeerCard — Peer list item showing nickname and peer ID.
 * expo-bitchat manages connection state natively.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { peerColor } from '../constants';

interface PeerCardProps {
    peerID: string;
    nickname: string;
    onPress: (peerID: string, nickname: string) => void;
}

function PeerCardInner({ peerID, nickname, onPress }: PeerCardProps) {
    const color = peerColor(peerID);
    const initials = nickname.slice(0, 2).toUpperCase() || '??';

    return (
        <TouchableOpacity
            onPress={() => onPress(peerID, nickname)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${nickname}, connected`}
            accessibilityHint="Opens a conversation with this peer"
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
                <Text className="text-base font-bold" style={{ color }}>
                    {initials}
                </Text>
            </View>

            {/* Info */}
            <View className="flex-1">
                <Text className="text-[#2C2C2C] font-semibold text-base" numberOfLines={1}>
                    {nickname}
                </Text>
                <View className="flex-row items-center mt-1">
                    <View className="w-2 h-2 rounded-full mr-1.5 bg-[#4A7C59]" />
                    <Text className="text-[#7A7A7A] text-xs">Connected</Text>
                </View>
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
