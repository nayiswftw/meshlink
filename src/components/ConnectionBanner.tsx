/**
 * ConnectionBanner — Top banner showing mesh network status.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConnectionBannerProps {
    connectedPeers: number;
    isScanning: boolean;
    bleReady: boolean;
}

function ConnectionBannerInner({
    connectedPeers,
    isScanning,
    bleReady,
}: ConnectionBannerProps) {
    if (!bleReady) {
        return (
            <View className="bg-[#F5E6D3] px-4 py-2 flex-row items-center">
                <Ionicons name="bluetooth-outline" size={14} color="#B85C4A" />
                <Text className="text-[#8B4513] text-xs ml-2 font-medium">
                    Bluetooth not ready
                </Text>
            </View>
        );
    }

    if (isScanning) {
        return (
            <View className="bg-[#E8EDDF] px-4 py-2 flex-row items-center">
                <Ionicons name="radio-outline" size={14} color="#5C6B3C" />
                <Text className="text-[#4A5530] text-xs ml-2 font-medium">
                    Scanning for nearby devices…
                </Text>
            </View>
        );
    }

    if (connectedPeers > 0) {
        return (
            <View className="bg-[#E2EDD5] px-4 py-2 flex-row items-center">
                <Ionicons name="link-outline" size={14} color="#4A7C59" />
                <Text className="text-[#3D6B4A] text-xs ml-2 font-medium">
                    {connectedPeers} peer{connectedPeers !== 1 ? 's' : ''} connected
                </Text>
            </View>
        );
    }

    return (
        <View className="bg-[#EDEAD7] px-4 py-2 flex-row items-center">
            <Ionicons name="cloud-offline-outline" size={14} color="#A0977D" />
            <Text className="text-[#7A7A7A] text-xs ml-2 font-medium">
                No peers connected — tap Scan to discover
            </Text>
        </View>
    );
}

export default React.memo(ConnectionBannerInner);
