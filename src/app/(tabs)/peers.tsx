/**
 * Network tab — Real-time list of nearby BLE peers with mesh status.
 * expo-bitchat handles scanning/discovery automatically.
 */
import React, { useCallback, useMemo } from 'react';
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

export default function PeersScreen() {
    const { peers, isRunning, startMesh, connectedPeerCount } = useMesh();

    const peerEntries = useMemo(
        () => Object.entries(peers).map(([id, nick]) => ({ id, nickname: nick })),
        [peers]
    );

    const handlePeerPress = useCallback((peerID: string, _nickname: string) => {
        router.push(`/chat/${peerID}`);
    }, []);

    return (
        <View className="flex-1 bg-[#F9FAFB]" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* ── Header ─────────────────────────────────── */}
            <View className="px-4 pt-2 pb-3">
                <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-[#111827] text-[28px] font-bold">Network</Text>
                    <View className="flex-row items-center">
                        <View
                            className={`flex-row items-center rounded-full px-3 py-1.5 ${isRunning ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]'}`}
                        >
                            <View
                                className={`w-2 h-2 rounded-full mr-1.5 ${isRunning ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
                            />
                            <Text
                                className={`text-xs font-semibold ${isRunning ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
                            >
                                {isRunning ? 'Active' : 'Offline'}
                            </Text>
                        </View>
                    </View>
                </View>
                {peerEntries.length > 0 && (
                    <Text className="text-[#6B7280] text-sm">
                        {peerEntries.length} device{peerEntries.length !== 1 ? 's' : ''} nearby
                    </Text>
                )}
            </View>

            {peerEntries.length === 0 ? (
                <View className="flex-1 items-center justify-center px-8">
                    {isRunning ? (
                        <>
                            <RadarAnimation isActive size={160} />
                            <Text className="text-[#111827] text-lg font-bold mt-8 mb-1">
                                Searching…
                            </Text>
                            <Text className="text-[#9CA3AF] text-sm text-center max-w-[260px]">
                                Looking for nearby Meshlink devices via Bluetooth
                            </Text>
                        </>
                    ) : (
                        <>
                            <View className="w-20 h-20 rounded-full bg-[#FFFFFF] items-center justify-center mb-5" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <Ionicons name="radio-outline" size={36} color="#4B5563" />
                            </View>
                            <Text className="text-[#111827] text-lg font-bold mb-1">
                                Mesh is offline
                            </Text>
                            <Text className="text-[#9CA3AF] text-sm text-center max-w-[260px] mb-6">
                                Start the mesh service to discover nearby peers
                            </Text>
                            <TouchableOpacity
                                onPress={() => startMesh().catch(() => {})}
                                className="bg-[#059669] rounded-full px-8 py-3.5 flex-row items-center"
                                accessibilityRole="button"
                                accessibilityLabel="Start mesh service"
                            >
                                <Ionicons name="power" size={16} color="#FFFFFF" />
                                <Text className="text-white font-bold text-sm ml-2">
                                    Start Mesh
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            ) : (
                <FlatList
                    data={peerEntries}
                    keyExtractor={(p) => p.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                    ListHeaderComponent={
                        isRunning ? (
                            <View className="items-center py-8 mb-4">
                                <RadarAnimation 
                                    isActive 
                                    size={180} 
                                    peers={peerEntries} 
                                    onPeerPress={handlePeerPress} 
                                />
                                <Text className="text-[#9CA3AF] text-sm mt-6 font-medium">
                                    Scanning for more devices...
                                </Text>
                            </View>
                        ) : null
                    }
                    ItemSeparatorComponent={() => (
                        <View className="h-px bg-[#F3F4F6] ml-[60px]" />
                    )}
                    renderItem={({ item }) => (
                        <PeerCard
                            peerID={item.id}
                            nickname={item.nickname}
                            onPress={handlePeerPress}
                        />
                    )}
                />
            )}
        </View>
    );
}
