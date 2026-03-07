/**
 * Channel chat screen — Group conversation in a named channel.
 * Uses expo-bitchat sendMessage for public channel messaging.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../../context/MeshContext';
import { useToast } from '../../context/ToastContext';
import ChatBubble from '../../components/ChatBubble';
import { peerColor } from '../../constants';
import type { StoredMessage } from '../../types';

export default function ChannelChatScreen() {
    const { channelName } = useLocalSearchParams<{ channelName: string }>();
    const decodedName = channelName ? decodeURIComponent(channelName) : '';

    const {
        nickname,
        getChannelMessages,
        sendChannelMessage,
        markChannelRead: markRead,
        connectedPeerCount,
        messageVersion,
        deleteMessage,
    } = useMesh();
    const { showToast } = useToast();

    const [messages, setMessages] = useState<StoredMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const loadMessages = useCallback(() => {
        if (!decodedName) return;
        const msgs = getChannelMessages(decodedName);
        setMessages(msgs);
    }, [decodedName, getChannelMessages]);

    useEffect(() => {
        loadMessages();
        if (decodedName) markRead(decodedName);
    }, [decodedName, loadMessages, markRead]);

    // Refresh when new messages arrive via context
    useEffect(() => {
        loadMessages();
    }, [messageVersion, loadMessages]);

    const handleDelete = useCallback((messageId: string) => {
        deleteMessage(messageId);
        loadMessages();
    }, [deleteMessage, loadMessages]);

    const handleSend = async () => {
        if (!input.trim() || !decodedName || isSending) return;

        const text = input.trim();
        setInput('');
        setIsSending(true);

        try {
            await sendChannelMessage(decodedName, text);
            loadMessages();
        } catch {
            showToast('Failed to send message', 'error');
        } finally {
            setIsSending(false);
        }
    };

    const channelColor = peerColor(decodedName);

    return (
        <SafeAreaView className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View className="flex-row items-center">
                            <View
                                className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                                style={{ backgroundColor: channelColor + '20' }}
                            >
                                <Ionicons name="chatbubbles" size={16} color={channelColor} />
                            </View>
                            <View>
                                <Text className="text-[#2C2C2C] font-semibold text-base">
                                    {decodedName}
                                </Text>
                                <Text className="text-[11px] text-[#A0977D]">
                                    {connectedPeerCount} peer{connectedPeerCount !== 1 ? 's' : ''} in mesh
                                </Text>
                            </View>
                        </View>
                    ),
                    headerStyle: { backgroundColor: '#FAF6F1' },
                    headerTintColor: '#2C2C2C',
                    headerShadowVisible: false,
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                style={{ flex: 1 }}
                keyboardVerticalOffset={90}
            >
                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(m) => m.id}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 8,
                        flexGrow: 1,
                        justifyContent: messages.length === 0 ? 'center' : 'flex-end',
                    }}
                    onContentSizeChange={() =>
                        flatListRef.current?.scrollToEnd({ animated: true })
                    }
                    ListEmptyComponent={
                        <View className="items-center">
                            <Ionicons
                                name="chatbubbles-outline"
                                size={48}
                                color="#D9D2C7"
                            />
                            <Text className="text-[#A0977D] text-sm mt-3">
                                Start the conversation in {decodedName}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View>
                            {/* Show sender name for group messages */}
                            {!item.isMine && (
                                <Text
                                    className="text-xs font-medium ml-1 mb-0.5"
                                    style={{ color: peerColor(item.sender) }}
                                >
                                    {item.sender}
                                </Text>
                            )}
                            <ChatBubble
                                content={item.content}
                                timestamp={item.timestamp}
                                isMine={item.isMine}
                                status={item.isMine ? item.status : undefined}
                                messageId={item.id}
                                onDelete={handleDelete}
                            />
                        </View>
                    )}
                />

                {/* Input Bar */}
                <View className="flex-row items-end px-4 py-3 border-t border-[#E8E2D9] bg-[#FAF6F1]">
                    <TextInput
                        className="flex-1 bg-white text-[#2C2C2C] rounded-2xl px-4 py-2.5 text-[15px] border border-[#E8E2D9] max-h-24"
                        placeholder={`Message ${decodedName}…`}
                        placeholderTextColor="#A0977D"
                        value={input}
                        onChangeText={setInput}
                        multiline
                        returnKeyType="default"
                        accessibilityLabel="Channel message input"
                        accessibilityHint="Type your message for this channel"
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!input.trim() || isSending}
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        accessibilityState={{ disabled: !input.trim() || isSending }}
                        className={`ml-2.5 w-10 h-10 rounded-full items-center justify-center ${input.trim() ? 'bg-[#5C6B3C]' : 'bg-[#E8E2D9]'
                            }`}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={20}
                            color={input.trim() ? '#FFFFFF' : '#A0977D'}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
