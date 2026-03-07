/**
 * Peers tab — Real-time list of nearby BLE peers with radar animation.
 * expo-bitchat handles scanning/discovery automatically.
 */
import React, { useCallback, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useMesh } from '../../context/MeshContext';
import PeerCard from '../../components/PeerCard';
import RadarAnimation from '../../components/RadarAnimation';

export default function PeersScreen() {
    const { peers, isRunning } = useMesh();

    const peerEntries = useMemo(
        () => Object.entries(peers).map(([id, nick]) => ({ id, nickname: nick })),
        [peers]
    );

    const handlePeerPress = useCallback((peerID: string, _nickname: string) => {
        router.push(`/chat/${peerID}`);
    }, []);

    return (
        <View className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            {peerEntries.length === 0 ? (
                <View className="flex-1 items-center justify-center px-8">
                    <RadarAnimation isActive={isRunning} size={180} />
                    <Text className="text-[#2C2C2C] text-xl font-bold mt-8 mb-2">
                        {isRunning ? 'Scanning…' : 'Not Running'}
                    </Text>
                    <Text className="text-[#7A7A7A] text-sm text-center mb-8 max-w-xs">
                        {isRunning
                            ? 'Looking for nearby Meshlink devices'
                            : 'Mesh service is not running'}
                    </Text>
                </View>
            ) : (
                <View className="flex-1">
                    {/* Peer count */}
                    <View className="px-4 pt-4 pb-2">
                        <Text className="text-[#A0977D] text-xs font-medium uppercase tracking-wider">
                            {peerEntries.length} device{peerEntries.length !== 1 ? 's' : ''}{' '}
                            connected
                        </Text>
                    </View>

                    {/* Peer List */}
                    <FlatList
                        data={peerEntries}
                        keyExtractor={(p) => p.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <PeerCard
                                peerID={item.id}
                                nickname={item.nickname}
                                onPress={handlePeerPress}
                            />
                        )}
                    />
                </View>
            )}
        </View>
    );
}
