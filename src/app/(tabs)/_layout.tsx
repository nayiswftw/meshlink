/**
 * Tab layout — Bottom navigation with Peers, Chats, and Settings tabs.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConnectionBanner from '../../components/ConnectionBanner';
import { useMesh } from '../../context/MeshContext';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { connectedPeerCount, isRunning } = useMesh();
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-[#FAF6F1]" style={{ paddingTop: insets.top }}>
            <ConnectionBanner
                connectedPeers={connectedPeerCount}
                isRunning={isRunning}
            />
            <Tabs
                screenOptions={{
                    sceneStyle: { backgroundColor: '#FAF6F1' },
                    headerStyle: {
                        backgroundColor: '#FAF6F1',
                        shadowColor: 'transparent',
                        elevation: 0,
                    },
                    headerTintColor: '#2C2C2C',
                    headerTitleStyle: {
                        fontWeight: '700',
                        fontSize: 18,
                    },
                    tabBarStyle: {
                        backgroundColor: '#FAF6F1',
                        borderTopColor: '#E8E2D9',
                        borderTopWidth: 1,
                        height: 60,
                        paddingBottom: 8,
                        paddingTop: 4,
                    },
                    tabBarActiveTintColor: '#5C6B3C',
                    tabBarInactiveTintColor: '#B8B0A0',
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '600',
                    },
                }}
            >
                <Tabs.Screen
                    name="peers"
                    options={{
                        title: 'Peers',
                        headerTitle: 'Nearby Devices',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="radio-outline" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="chats"
                    options={{
                        title: 'Chats',
                        headerTitle: 'Messages',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons
                                name="chatbubbles-outline"
                                size={size}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        title: 'Settings',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="cog-outline" size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </View>
    );
}
