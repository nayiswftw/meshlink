/**
 * Peers tab — Real-time list of nearby BLE peers with radar animation.
 */
import React, { useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../../context/MeshContext';
import PeerCard from '../../components/PeerCard';
import RadarAnimation from '../../components/RadarAnimation';
import type { Peer } from '../../types';

export default function PeersScreen() {
    const { peers, isScanning, startScanning, connectToPeer, bleReady, requestEnableBle } =
        useMesh();

    const handlePeerPress = useCallback(
        async (peer: Peer) => {
            if (peer.connectionState !== 'connected') {
                await connectToPeer(peer.deviceId);
            }
            if (peer.publicKey) {
                router.push(`/chat/${peer.id}`);
            }
        },
        [connectToPeer]
    );

    const handleScan = useCallback(async () => {
        if (!bleReady) {
            await requestEnableBle();
            return;
        }
        await startScanning();
    }, [bleReady, requestEnableBle, startScanning]);

    const sortedPeers = [...peers].sort((a, b) => {
        // Connected first, then by signal strength
        if (a.connectionState === 'connected' && b.connectionState !== 'connected')
            return -1;
        if (b.connectionState === 'connected' && a.connectionState !== 'connected')
            return 1;
        return b.rssi - a.rssi;
    });

    return (
        <View className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            {!bleReady ? (
                <View className="flex-1 items-center justify-center px-8">
                    <View className="w-20 h-20 rounded-full bg-[#F5E6D3] items-center justify-center mb-6">
                        <Ionicons name="bluetooth-outline" size={36} color="#B85C4A" />
                    </View>
                    <Text className="text-[#2C2C2C] text-xl font-bold mb-2">
                        Bluetooth is Off
                    </Text>
                    <Text className="text-[#7A7A7A] text-sm text-center mb-8 max-w-xs">
                        Meshlink needs Bluetooth to discover and communicate with nearby devices.
                        Please enable Bluetooth and tap below.
                    </Text>
                    <TouchableOpacity
                        onPress={requestEnableBle}
                        className="bg-[#5C6B3C] flex-row items-center rounded-xl px-6 py-3.5"
                        style={{
                            shadowColor: '#5C6B3C',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                    >
                        <Ionicons name="bluetooth-outline" size={18} color="#FFFFFF" />
                        <Text className="text-white font-semibold text-base ml-2">
                            Enable Bluetooth
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : peers.length === 0 ? (
                <View className="flex-1 items-center justify-center px-8">
                    <RadarAnimation isActive={isScanning} size={180} />
                    <Text className="text-[#2C2C2C] text-xl font-bold mt-8 mb-2">
                        {isScanning ? 'Scanning…' : 'No Peers Found'}
                    </Text>
                    <Text className="text-[#7A7A7A] text-sm text-center mb-8 max-w-xs">
                        {isScanning
                            ? 'Looking for nearby Meshlink devices'
                            : 'Tap the button below to scan for nearby devices using Bluetooth'}
                    </Text>
                    {!isScanning && (
                        <TouchableOpacity
                            onPress={handleScan}
                            className="bg-[#5C6B3C] flex-row items-center rounded-xl px-6 py-3.5"
                            style={{
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                        >
                            <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
                            <Text className="text-white font-semibold text-base ml-2">
                                Start Scanning
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <View className="flex-1">
                    {/* Scan Button */}
                    <View className="px-4 pt-2 pb-3">
                        <TouchableOpacity
                            onPress={handleScan}
                            disabled={isScanning}
                            className={`flex-row items-center justify-center rounded-xl py-3 ${isScanning ? 'bg-[#E8EDDF]' : 'bg-[#5C6B3C]'
                                }`}
                            style={!isScanning ? {
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 6,
                                elevation: 3,
                            } : undefined}
                        >
                            <Ionicons
                                name={isScanning ? 'radio-outline' : 'scan-outline'}
                                size={16}
                                color={isScanning ? '#5C6B3C' : '#FFFFFF'}
                            />
                            <Text className={`font-semibold text-sm ml-2 ${isScanning ? 'text-[#5C6B3C]' : 'text-white'}`}>
                                {isScanning ? 'Scanning…' : 'Scan Again'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Peer count */}
                    <View className="px-4 pb-2">
                        <Text className="text-[#A0977D] text-xs font-medium uppercase tracking-wider">
                            {sortedPeers.length} device{sortedPeers.length !== 1 ? 's' : ''}{' '}
                            found
                        </Text>
                    </View>

                    {/* Peer List */}
                    <FlatList
                        data={sortedPeers}
                        keyExtractor={(p) => p.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <PeerCard peer={item} onPress={handlePeerPress} />
                        )}
                    />
                </View>
            )}
        </View>
    );
}
