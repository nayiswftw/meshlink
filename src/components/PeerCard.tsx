/**
 * PeerCard — Flat row peer list item showing avatar, nickname, and status.
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
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${nickname}, connected`}
            accessibilityHint="Opens a conversation with this peer"
            className="flex-row items-center py-3.5"
        >
            {/* Avatar with online dot */}
            <View className="relative mr-3">
                <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: color + '22' }}
                >
                    <Text className="text-sm font-bold" style={{ color }}>
                        {initials}
                    </Text>
                </View>
                <View className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-[#F9FAFB]" />
            </View>

            {/* Info */}
            <View className="flex-1">
                <Text className="text-[#111827] font-semibold text-[15px]" numberOfLines={1}>
                    {nickname}
                </Text>
                <Text className="text-[#6B7280] text-xs mt-0.5">Connected via BLE</Text>
            </View>

            <TouchableOpacity
                onPress={() => onPress(peerID, nickname)}
                className="w-9 h-9 rounded-full bg-[#ECFDF5] items-center justify-center"
                accessibilityLabel={`Message ${nickname}`}
            >
                <Ionicons name="chatbubble" size={14} color="#059669" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

export default React.memo(PeerCardInner);
