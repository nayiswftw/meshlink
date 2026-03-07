/**
 * Settings tab — Profile, notifications, and about.
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
import { useToast } from '../../context/ToastContext';

function SettingsSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View className="mb-6">
            <Text className="text-[#6B7280] text-xs font-semibold uppercase tracking-wider mb-2 px-1">
                {title}
            </Text>
            <View className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] overflow-hidden">
                {children}
            </View>
        </View>
    );
}

function SettingsRow({
    icon,
    iconColor = '#6B7280',
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
            className={`flex-row items-center px-4 py-3.5 ${!last ? 'border-b border-[#F3F4F6]' : ''
                }`}
        >
            <Ionicons name={icon} size={20} color={iconColor} />
            <Text className="text-[#111827] text-base flex-1 ml-3">{label}</Text>
            {children}
        </View>
    );
}

export default function SettingsScreen() {
    const { nickname, settings, updateSettings } = useMesh();
    const { showToast } = useToast();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(settings.displayName);


    const handleSaveName = () => {
        if (nameInput.trim()) {
            updateSettings({ displayName: nameInput.trim() });
            showToast('Display name updated', 'success');
        }
        setEditingName(false);
    };

    return (
        <View className="flex-1 bg-[#F9FAFB]" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
                <View className="items-center py-6 mb-4">
                    <View className="w-20 h-20 rounded-full bg-[#ECFDF5] items-center justify-center mb-4">
                        <Text className="text-3xl font-bold text-[#059669]">
                            {(settings.displayName || nickname || '?')
                                .charAt(0)
                                .toUpperCase()}
                        </Text>
                    </View>
                    <Text className="text-[#111827] text-xl font-bold">
                        {settings.displayName || nickname || 'Unknown'}
                    </Text>
                </View>

                {/* Profile */}
                <SettingsSection title="Profile">
                    <SettingsRow icon="person-outline" iconColor="#059669" label="Display Name" last>
                        {editingName ? (
                            <View className="flex-row items-center">
                                <TextInput
                                    className="bg-[#F9FAFB] text-[#111827] text-sm rounded-lg px-3 py-1.5 w-28 mr-2 border border-[#E5E7EB]"
                                    value={nameInput}
                                    onChangeText={setNameInput}
                                    maxLength={20}
                                    autoFocus
                                    onSubmitEditing={handleSaveName}
                                />
                                <TouchableOpacity onPress={handleSaveName}>
                                    <Ionicons name="checkmark-circle" size={24} color="#059669" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    setNameInput(settings.displayName || nickname || '');
                                    setEditingName(true);
                                }}
                                className="flex-row items-center"
                            >
                                <Text className="text-[#6B7280] text-sm mr-1">
                                    {settings.displayName || nickname}
                                </Text>
                                <Ionicons name="pencil-outline" size={14} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </SettingsRow>
                </SettingsSection>

                {/* Notifications */}
                <SettingsSection title="Notifications">
                    <SettingsRow icon="notifications-outline" iconColor="#F59E0B" label="Notifications" last>
                        <Switch
                            value={settings.notificationsEnabled}
                            onValueChange={(v) =>
                                updateSettings({ notificationsEnabled: v })
                            }
                            trackColor={{ false: '#E5E7EB', true: '#059669' }}
                            thumbColor="#FFFFFF"
                        />
                    </SettingsRow>
                </SettingsSection>

                {/* Relay Settings */}
                <SettingsSection title="Mesh Network">
                    <SettingsRow icon="git-network-outline" iconColor="#8B5CF6" label="Message Relay">
                        <Switch
                            value={settings.relayEnabled}
                            onValueChange={(v) =>
                                updateSettings({ relayEnabled: v })
                            }
                            trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
                            thumbColor="#FFFFFF"
                        />
                    </SettingsRow>
                    <View className="px-4 py-2 bg-[#F9FAFB]">
                        <Text className="text-[#6B7280] text-xs leading-relaxed">
                            Forwards messages through your device to help them reach peers
                            beyond direct Bluetooth range.
                        </Text>
                    </View>
                    <SettingsRow icon="archive-outline" iconColor="#8B5CF6" label="Store & Forward" last>
                        <Switch
                            value={settings.storeForwardEnabled}
                            onValueChange={(v) =>
                                updateSettings({ storeForwardEnabled: v })
                            }
                            trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
                            thumbColor="#FFFFFF"
                        />
                    </SettingsRow>
                    <View className="px-4 py-2 bg-[#F9FAFB]">
                        <Text className="text-[#6B7280] text-xs leading-relaxed">
                            Holds messages for offline peers and delivers them when they
                            reconnect (up to 24 hours).
                        </Text>
                    </View>
                </SettingsSection>

                {/* About */}
                <SettingsSection title="About">
                    <SettingsRow icon="information-circle-outline" iconColor="#3B82F6" label="Version" last>
                        <Text className="text-[#6B7280] text-sm">1.0.0</Text>
                    </SettingsRow>
                </SettingsSection>
            </ScrollView>
        </View>
    );
}
