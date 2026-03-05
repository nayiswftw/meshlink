/**
 * Settings tab — Profile, relay toggle, theme, and about.
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Switch,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../../context/MeshContext';

function SettingsSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View className="mb-6">
            <Text className="text-[#A0977D] text-xs font-semibold uppercase tracking-wider mb-2 px-1">
                {title}
            </Text>
            <View className="bg-white rounded-2xl border border-[#E8E2D9] overflow-hidden"
                style={{
                    shadowColor: '#8B7D6B',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    elevation: 2,
                }}
            >
                {children}
            </View>
        </View>
    );
}

function SettingsRow({
    icon,
    iconColor = '#A0977D',
    label,
    children,
    last = false,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    label: string;
    children: React.ReactNode;
    last?: boolean;
}) {
    return (
        <View
            className={`flex-row items-center px-4 py-3.5 ${!last ? 'border-b border-[#E8E2D9]' : ''
                }`}
        >
            <Ionicons name={icon} size={20} color={iconColor} />
            <Text className="text-[#2C2C2C] text-base flex-1 ml-3">{label}</Text>
            {children}
        </View>
    );
}

export default function SettingsScreen() {
    const { identity, settings, updateSettings, bleReady, requestEnableBle } = useMesh();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(settings.displayName);

    const handleSaveName = () => {
        if (nameInput.trim()) {
            updateSettings({ displayName: nameInput.trim() });
        }
        setEditingName(false);
    };

    const publicKeyShort = identity?.publicKey
        ? `${identity.publicKey.slice(0, 8)}…${identity.publicKey.slice(-6)}`
        : '—';

    return (
        <View className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
            >
                {/* Profile Header */}
                <View className="items-center py-6 mb-4">
                    <View className="w-20 h-20 rounded-full bg-[#E8EDDF] items-center justify-center mb-4">
                        <Text className="text-3xl font-bold text-[#5C6B3C]">
                            {(settings.displayName || identity?.displayName || '?')
                                .charAt(0)
                                .toUpperCase()}
                        </Text>
                    </View>
                    <Text className="text-[#2C2C2C] text-xl font-bold">
                        {settings.displayName || identity?.displayName || 'Unknown'}
                    </Text>
                    <Text className="text-[#A0977D] text-xs mt-1 font-mono">
                        {publicKeyShort}
                    </Text>
                </View>

                {/* Profile */}
                <SettingsSection title="Profile">
                    <SettingsRow icon="person-outline" iconColor="#5C6B3C" label="Display Name" last>
                        {editingName ? (
                            <View className="flex-row items-center">
                                <TextInput
                                    className="bg-[#FAF6F1] text-[#2C2C2C] text-sm rounded-lg px-3 py-1.5 w-28 mr-2 border border-[#E8E2D9]"
                                    value={nameInput}
                                    onChangeText={setNameInput}
                                    maxLength={20}
                                    autoFocus
                                    onSubmitEditing={handleSaveName}
                                />
                                <TouchableOpacity onPress={handleSaveName}>
                                    <Ionicons name="checkmark-circle" size={24} color="#4A7C59" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    setNameInput(settings.displayName || identity?.displayName || '');
                                    setEditingName(true);
                                }}
                                className="flex-row items-center"
                            >
                                <Text className="text-[#7A7A7A] text-sm mr-1">
                                    {settings.displayName || identity?.displayName}
                                </Text>
                                <Ionicons name="pencil-outline" size={14} color="#A0977D" />
                            </TouchableOpacity>
                        )}
                    </SettingsRow>
                </SettingsSection>

                {/* Bluetooth */}
                <SettingsSection title="Bluetooth">
                    <SettingsRow
                        icon="bluetooth-outline"
                        iconColor={bleReady ? '#4A7C59' : '#B85C4A'}
                        label="Bluetooth"
                        last
                    >
                        {bleReady ? (
                            <View className="flex-row items-center">
                                <View className="w-2 h-2 rounded-full bg-[#4A7C59] mr-2" />
                                <Text className="text-[#4A7C59] text-sm font-medium">Ready</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={requestEnableBle}
                                className="bg-[#5C6B3C] rounded-lg px-3 py-1.5"
                            >
                                <Text className="text-white text-xs font-semibold">Enable</Text>
                            </TouchableOpacity>
                        )}
                    </SettingsRow>
                </SettingsSection>

                {/* Mesh Network */}
                <SettingsSection title="Mesh Network">
                    <SettingsRow icon="git-network-outline" iconColor="#5C6B3C" label="Relay Messages">
                        <Switch
                            value={settings.relayEnabled}
                            onValueChange={(v) => updateSettings({ relayEnabled: v })}
                            trackColor={{ false: '#D9D2C7', true: '#5C6B3C' }}
                            thumbColor={settings.relayEnabled ? '#A8B89C' : '#B8B0A0'}
                        />
                    </SettingsRow>
                    <SettingsRow icon="notifications-outline" iconColor="#C4903D" label="Notifications" last>
                        <Switch
                            value={settings.notificationsEnabled}
                            onValueChange={(v) =>
                                updateSettings({ notificationsEnabled: v })
                            }
                            trackColor={{ false: '#D9D2C7', true: '#5C6B3C' }}
                            thumbColor={settings.notificationsEnabled ? '#A8B89C' : '#B8B0A0'}
                        />
                    </SettingsRow>
                </SettingsSection>

                {/* About */}
                <SettingsSection title="About">
                    <SettingsRow icon="information-circle-outline" iconColor="#6B8FA3" label="Version" last>
                        <Text className="text-[#A0977D] text-sm">1.0.0</Text>
                    </SettingsRow>
                </SettingsSection>

                {/* Device ID */}
                <View className="items-center mt-4">
                    <Text className="text-[#C4BAA8] text-[10px] font-mono">
                        Device ID: {identity?.id?.slice(0, 12) ?? '—'}…
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
