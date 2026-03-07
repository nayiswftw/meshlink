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
    const { nickname, settings, updateSettings, isRunning, startMesh, stopMesh } = useMesh();
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

    const handleStartMesh = async () => {
        try {
            await startMesh();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to start mesh service', 'error');
        }
    };

    const handleStopMesh = async () => {
        try {
            await stopMesh();
        } catch {
            showToast('Failed to stop mesh service', 'error');
        }
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

                {/* Mesh Network */}
                <SettingsSection title="Mesh Network">
                    <SettingsRow
                        icon="radio-outline"
                        iconColor={isRunning ? '#059669' : '#EF4444'}
                        label="Mesh Service"
                    >
                        {isRunning ? (
                            <TouchableOpacity
                                onPress={handleStopMesh}
                                accessibilityRole="button"
                                accessibilityLabel="Stop mesh service"
                                className="bg-[#FEF2F2] rounded-lg px-3 py-1.5"
                            >
                                <Text className="text-[#EF4444] text-xs font-semibold">Stop</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={handleStartMesh}
                                accessibilityRole="button"
                                accessibilityLabel="Start mesh service"
                                className="bg-[#059669] rounded-lg px-3 py-1.5"
                            >
                                <Text className="text-white text-xs font-semibold">Start</Text>
                            </TouchableOpacity>
                        )}
                    </SettingsRow>
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
