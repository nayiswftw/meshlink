/**
 * CreateChannelModal — Bottom sheet modal for creating or joining a channel.
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CreateChannelModalProps {
    visible: boolean;
    onClose: () => void;
    onCreateOrJoin: (channelName: string, password?: string) => void;
}

export default function CreateChannelModal({
    visible,
    onClose,
    onCreateOrJoin,
}: CreateChannelModalProps) {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = () => {
        const channelName = name.trim().startsWith('#')
            ? name.trim()
            : `#${name.trim()}`;

        if (channelName.length < 2) return;

        onCreateOrJoin(channelName, password.trim() || undefined);
        setName('');
        setPassword('');
        setShowPassword(false);
        onClose();
    };

    const isValid = name.trim().length > 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                className="flex-1 bg-black/40"
                onPress={onClose}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
            >
                <View
                    className="bg-[#FAF6F1] rounded-t-3xl px-6 pt-6 pb-10"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 8,
                    }}
                >
                    {/* Handle */}
                    <View className="w-10 h-1 bg-[#D9D2C7] rounded-full self-center mb-6" />

                    <Text className="text-[#2C2C2C] text-xl font-bold mb-1">
                        Join or Create Channel
                    </Text>
                    <Text className="text-[#7A7A7A] text-sm mb-6">
                        Enter a channel name to join. If it doesn't exist, it will be created.
                    </Text>

                    {/* Channel Name */}
                    <Text className="text-[#A0977D] text-xs font-semibold uppercase tracking-wider mb-2">
                        Channel Name
                    </Text>
                    <View className="flex-row items-center bg-white rounded-xl border border-[#E8E2D9] px-4 mb-4">
                        <Text className="text-[#5C6B3C] text-lg font-bold mr-1">#</Text>
                        <TextInput
                            className="flex-1 text-[#2C2C2C] text-base py-3"
                            placeholder="general"
                            placeholderTextColor="#B8B0A0"
                            value={name.startsWith('#') ? name.slice(1) : name}
                            onChangeText={(t) => setName(t.replace(/[^a-z0-9\-_]/gi, '').toLowerCase())}
                            maxLength={24}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                            accessibilityLabel="Channel name"
                        />
                    </View>

                    {/* Password (optional) */}
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        className="flex-row items-center mb-3"
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Hide password field' : 'Add a password'}
                    >
                        <Ionicons
                            name={showPassword ? 'lock-open-outline' : 'lock-closed-outline'}
                            size={14}
                            color="#A0977D"
                        />
                        <Text className="text-[#A0977D] text-xs font-medium ml-1.5">
                            {showPassword ? 'Remove password' : 'Add password (optional)'}
                        </Text>
                    </TouchableOpacity>

                    {showPassword && (
                        <TextInput
                            className="bg-white text-[#2C2C2C] text-base rounded-xl border border-[#E8E2D9] px-4 py-3 mb-4"
                            placeholder="Channel password"
                            placeholderTextColor="#B8B0A0"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            maxLength={32}
                            accessibilityLabel="Channel password"
                        />
                    )}

                    {/* Actions */}
                    <View className="flex-row gap-3 mt-2" style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 border border-[#E8E2D9] rounded-xl py-3.5 items-center"
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                        >
                            <Text className="text-[#7A7A7A] font-semibold text-base">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={!isValid}
                            className={`flex-1 rounded-xl py-3.5 items-center ${isValid ? 'bg-[#5C6B3C]' : 'bg-[#D9D2C7]'
                                }`}
                            style={isValid ? {
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            } : undefined}
                            accessibilityRole="button"
                            accessibilityLabel="Join channel"
                        >
                            <Text
                                className={`font-semibold text-base ${isValid ? 'text-white' : 'text-[#A0977D]'
                                    }`}
                            >
                                Join
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
