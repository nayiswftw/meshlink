/**
 * Tab layout — Bottom navigation with Home, Chats, +, and Profile.
 * Active tab gets a pill with icon + label; inactive tabs show icon only.
 */
import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConnectionBanner from '../../components/ConnectionBanner';
import CreateChannelModal from '../../components/CreateChannelModal';
import { useMesh } from '../../context/MeshContext';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
    peers: { icon: 'home-outline', label: 'Home' },
    chats: { icon: 'chatbubble-outline', label: 'Chats' },
    settings: { icon: 'person-outline', label: 'Profile' },
};

function CustomTabBar({ state, navigation, onPlusPress }: any) {
    const insets = useSafeAreaInsets();

    const renderItem = (route: any, index: number) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        const isFocused = state.index === index;
        const onPress = () => {
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
            }
        };

        if (isFocused) {
            return (
                <TouchableOpacity
                    key={route.key}
                    onPress={onPress}
                    activeOpacity={0.8}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 26,
                        paddingHorizontal: 18,
                        height: 52,
                        gap: 6,
                    }}
                >
                    <Ionicons name={config.icon as any} size={22} color="#000000" />
                    <Text
                        style={{
                            fontWeight: '500',
                            color: '#000000',
                            fontSize: 15,
                        }}
                    >
                        {config.label}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Ionicons name={config.icon as any} size={22} color="#000000" />
            </TouchableOpacity>
        );
    };

    const homeRoute = state.routes.find((r: any) => r.name === 'peers');
    const chatsRoute = state.routes.find((r: any) => r.name === 'chats');
    const profileRoute = state.routes.find((r: any) => r.name === 'settings');
    const homeIndex = state.routes.findIndex((r: any) => r.name === 'peers');
    const chatsIndex = state.routes.findIndex((r: any) => r.name === 'chats');
    const profileIndex = state.routes.findIndex((r: any) => r.name === 'settings');

    return (
        <View
            style={{
                position: 'absolute',
                bottom: Math.max(insets.bottom, 20),
                left: 0,
                right: 0,
                alignItems: 'center',
            }}
        >
            <View
                style={{
                    width: '100%',
                    maxWidth: 420,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                {homeRoute && renderItem(homeRoute, homeIndex)}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {chatsRoute && renderItem(chatsRoute, chatsIndex)}
                    
                    <TouchableOpacity
                        onPress={onPlusPress}
                        activeOpacity={0.8}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Ionicons name="add" size={26} color="#000000" />
                    </TouchableOpacity>
                </View>

                {profileRoute && renderItem(profileRoute, profileIndex)}
            </View>
        </View>
    );
}

export default function TabLayout() {
    const { connectedPeerCount, isRunning, joinChannel, settings } = useMesh();
    const insets = useSafeAreaInsets();
    const [showCreateChannel, setShowCreateChannel] = useState(false);

    return (
        <View className="flex-1 bg-[#F9FAFB]" style={{ paddingTop: insets.top }}>
            <ConnectionBanner
                connectedPeers={connectedPeerCount}
                isRunning={isRunning}
                relayEnabled={settings.relayEnabled}
            />
            <Tabs
                tabBar={(props) => (
                    <CustomTabBar
                        {...props}
                        onPlusPress={() => setShowCreateChannel(true)}
                    />
                )}
                screenOptions={{
                    sceneStyle: { backgroundColor: '#F9FAFB' },
                    headerShown: false,
                }}
            >
                <Tabs.Screen name="peers" />
                <Tabs.Screen name="chats" />
                <Tabs.Screen name="settings" />
            </Tabs>
            <CreateChannelModal
                visible={showCreateChannel}
                onClose={() => setShowCreateChannel(false)}
                onCreateOrJoin={(name, password) => {
                    joinChannel(name, password);
                    setShowCreateChannel(false);
                }}
            />
        </View>
    );
}
