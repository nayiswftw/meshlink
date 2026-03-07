/**
 * ConnectionBanner — Top banner showing mesh network status.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConnectionBannerProps {
    connectedPeers: number;
    isRunning: boolean;
    relayEnabled?: boolean;
}

function ConnectionBannerInner({
    connectedPeers,
    isRunning,
    relayEnabled = false,
}: ConnectionBannerProps) {
    if (!isRunning) {
        return (
            <View
                className="mx-4 mt-1 mb-0.5 px-3 py-1.5 rounded-full flex-row items-center self-start"
                style={{ backgroundColor: '#FEF2F2' }}
                accessibilityRole="alert"
                accessibilityLabel="Mesh service is not running"
            >
                <View className="w-1.5 h-1.5 rounded-full bg-[#EF4444] mr-2" />
                <Text className="text-[#EF4444] text-xs font-medium">
                    Mesh offline
                </Text>
            </View>
        );
    }

    if (connectedPeers > 0) {
        return (
            <View
                className="mx-4 mt-1 mb-0.5 px-3 py-1.5 rounded-full flex-row items-center self-start"
                style={{ backgroundColor: '#ECFDF5' }}
                accessibilityRole="alert"
                accessibilityLabel={`${connectedPeers} peer${connectedPeers !== 1 ? 's' : ''} connected${relayEnabled ? ', relay enabled' : ''}`}
            >
                <View className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mr-2" />
                <Text className="text-[#059669] text-xs font-medium">
                    {connectedPeers} peer{connectedPeers !== 1 ? 's' : ''} online
                </Text>
                {relayEnabled && (
                    <>
                        <View className="w-0.5 h-3 bg-[#059669]/20 mx-2" />
                        <Ionicons name="git-network-outline" size={12} color="#059669" />
                        <Text className="text-[#059669] text-xs font-medium ml-1">
                            Relay
                        </Text>
                    </>
                )}
            </View>
        );
    }

    return (
        <View
            className="mx-4 mt-1 mb-0.5 px-3 py-1.5 rounded-full flex-row items-center self-start"
            style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }}
            accessibilityRole="alert"
            accessibilityLabel="Scanning for nearby devices"
        >
            <View className="w-1.5 h-1.5 rounded-full bg-[#6B7280] mr-2" />
            <Text className="text-[#9CA3AF] text-xs font-medium">
                Scanning…
            </Text>
        </View>
    );
}

export default React.memo(ConnectionBannerInner);
