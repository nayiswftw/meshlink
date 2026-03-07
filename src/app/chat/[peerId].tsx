/**
 * Chat screen — Full conversation view with a specific peer.
 * expo-bitchat handles encryption/decryption natively.
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

export default function ChatScreen() {
    const { peerId } = useLocalSearchParams<{ peerId: string }>();
    const {
        nickname,
        getMessagesForPeer,
        sendPrivateMessage,
        markRead,
        peers,
        refreshConversations,
        messageVersion,
        deleteMessage,
    } = useMesh();
    const { showToast } = useToast();

    const [messages, setMessages] = useState<StoredMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Get peer info from the PeerInfo map
    const peerNickname = peerId ? (peers[peerId] ?? 'Unknown') : 'Unknown';
    const color = peerColor(peerId || '');
    const isConnected = peerId ? peerId in peers : false;

    // Load messages
    const loadMessages = useCallback(() => {
        if (!peerId) return;
        const msgs = getMessagesForPeer(peerId);
        setMessages(msgs);
    }, [peerId, getMessagesForPeer]);

    useEffect(() => {
        loadMessages();
        if (peerId) markRead(peerId);
    }, [peerId, loadMessages, markRead]);

    // Refresh when new messages arrive via context
    useEffect(() => {
        loadMessages();
    }, [messageVersion, loadMessages]);

    const handleDelete = useCallback((messageId: string) => {
        deleteMessage(messageId);
        loadMessages();
    }, [deleteMessage, loadMessages]);

    const handleSend = async () => {
        if (!input.trim() || !peerId || isSending) return;

        const text = input.trim();
        setInput('');
        setIsSending(true);

        try {
            await sendPrivateMessage(peerId, peerNickname, text);
            loadMessages();
        } catch (error) {
            showToast('Failed to send message', 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View className="flex-row items-center">
                            <View
                                className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                                style={{ backgroundColor: color + '20' }}
                            >
                                <Text className="text-xs font-bold" style={{ color }}>
                                    {peerNickname.slice(0, 2).toUpperCase() || '??'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-[#2C2C2C] font-semibold text-base">
                                    {peerNickname}
                                </Text>
                                <Text
                                    className={`text-[11px] ${isConnected ? 'text-[#4A7C59]' : 'text-[#A0977D]'
                                        }`}
                                >
                                    {isConnected ? 'Connected' : 'Offline'}
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
                    initialNumToRender={20}
                    maxToRenderPerBatch={15}
                    windowSize={10}
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
                                name="chatbubble-ellipses-outline"
                                size={48}
                                color="#D9D2C7"
                            />
                            <Text className="text-[#A0977D] text-sm mt-3">
                                Send the first message!
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <ChatBubble
                            content={item.content}
                            timestamp={item.timestamp}
                            isMine={item.isMine}
                            status={item.isMine ? item.status : undefined}
                            messageId={item.id}
                            onDelete={handleDelete}
                        />
                    )}
                />

                {/* Input Bar */}
                <View className="flex-row items-end px-4 py-3 border-t border-[#E8E2D9] bg-[#FAF6F1]">
                    <TextInput
                        className="flex-1 bg-white text-[#2C2C2C] rounded-2xl px-4 py-2.5 text-[15px] border border-[#E8E2D9] max-h-24"
                        placeholder="Type a message…"
                        placeholderTextColor="#A0977D"
                        value={input}
                        onChangeText={setInput}
                        multiline
                        returnKeyType="default"
                        accessibilityLabel="Message input"
                        accessibilityHint="Type your message here"
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
