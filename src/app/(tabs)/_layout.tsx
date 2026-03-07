/**
 * Tab layout — Bottom navigation with Home, Chats, +, and Profile.
 * Active tab gets a pill with icon + label; inactive tabs show icon only.
 */
import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConnectionBanner from '../../components/ConnectionBanner';
import CreateChannelModal from '../../components/CreateChannelModal';
import SOSAlert from '../../components/SOSAlert';
import SOSButton from '../../components/SOSButton';
import { useMesh } from '../../context/MeshContext';
import { View, Text, TouchableOpacity } from 'react-native';
import { getCurrentLocation, requestLocationPermissions } from '../../services/LocationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
    peers: { icon: 'home-outline', label: 'Home' },
    chats: { icon: 'chatbubble-outline', label: 'Chats' },
    settings: { icon: 'person-outline', label: 'Profile' },
};

function CustomTabBar({ state, navigation, onPlusPress, onTripleTapHome }: any) {
    const insets = useSafeAreaInsets();
    const [tapCount, setTapCount] = React.useState(0);
    const [tapTimer, setTapTimer] = React.useState<ReturnType<typeof setTimeout> | null>(null);

    const renderItem = (route: any, index: number) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        const isFocused = state.index === index;
        const onPress = () => {
            if (route.name === 'peers') {
                if (tapTimer) clearTimeout(tapTimer);
                const newCount = tapCount + 1;
                if (newCount >= 3) {
                    if (onTripleTapHome) onTripleTapHome();
                    setTapCount(0);
                } else {
                    setTapCount(newCount);
                    setTapTimer(setTimeout(() => setTapCount(0), 400));
                }
            }

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
    const { connectedPeerCount, isRunning, joinChannel, settings, activeSOSAlert, dismissSOS, sendSOS } = useMesh();
    const [sosVisible, setSOSVisible] = useState(false);
    const insets = useSafeAreaInsets();
    const [showCreateChannel, setShowCreateChannel] = useState(false);

    // Pre-request location permissions so GPS is ready for SOS
    useEffect(() => {
        requestLocationPermissions();
    }, []);

    const handleSOS = async (message?: string) => {
        if (sendSOS) {
            // Fetch GPS with timeout — never block the SOS send
            const coords = await getCurrentLocation();
            await sendSOS(message, coords);
        }
        setSOSVisible(false);
    };

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
                        onTripleTapHome={() => setSOSVisible(true)}
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
            <SOSAlert sos={activeSOSAlert} onDismiss={dismissSOS} />

            {sosVisible && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                    }}
                >
                    <View style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        padding: 28,
                        alignItems: 'center',
                        width: '80%',
                        maxWidth: 300,
                    }}>
                        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 20, textAlign: 'center' }}>
                            Hold the button for 3 seconds to send an emergency broadcast.
                        </Text>
                        <SOSButton onSOS={handleSOS} disabled={!isRunning} />
                        <TouchableOpacity
                            onPress={() => setSOSVisible(false)}
                            style={{ marginTop: 20, paddingVertical: 8, paddingHorizontal: 24 }}
                        >
                            <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
