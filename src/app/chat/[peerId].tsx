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
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
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
        conversations,
        refreshConversations,
        messageVersion,
        deleteMessage,
        clearHistory,
    } = useMesh();
    const { showToast } = useToast();

    const [messages, setMessages] = useState<StoredMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Get peer info — try active peers first, then fall back to stored conversation name
    const conv = peerId ? conversations.find((c) => c.peerId === peerId || c.peerName === peerId) : undefined;
    const peerNickname = peerId ? (peers[peerId] ?? conv?.peerName ?? 'Unknown') : 'Unknown';
    const color = peerColor(peerId || '');
    const activePeerId = Object.keys(peers).find(id => peers[id] === peerNickname);
    const isConnected = !!activePeerId;

    // Load messages
    const loadMessages = useCallback(() => {
        if (!peerId) return;
        const aliases = Array.from(
            new Set(
                [peerId, peerNickname, conv?.peerName]
                    .map((v) => (v ?? '').trim())
                    .filter((v) => v.length > 0 && v !== 'Unknown')
            )
        );

        const merged = new Map<string, StoredMessage>();
        aliases.forEach((alias) => {
            getMessagesForPeer(alias).forEach((msg) => {
                merged.set(msg.id, msg);
            });
        });

        const msgs = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
        setMessages(msgs);
    }, [peerId, peerNickname, conv?.peerName, getMessagesForPeer]);

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
            await sendPrivateMessage(activePeerId || peerId, peerNickname, text);
            loadMessages();
        } catch (error) {
            showToast('Failed to send message', 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            className="flex-row items-center"
                        >
                            <View
                                className="w-9 h-9 rounded-full items-center justify-center mr-3"
                                style={{ backgroundColor: color + '22' }}
                            >
                                <Text className="text-xs font-bold" style={{ color }}>
                                    {peerNickname.slice(0, 2).toUpperCase() || '??'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-[#111827] font-bold text-[16px]">
                                    {peerNickname}
                                </Text>
                                <View className="flex-row items-center mt-0.5">
                                    <View
                                        className={`w-2 h-2 rounded-full mr-1.5 ${isConnected ? 'bg-[#22C55E]' : 'bg-[#4B5563]'}`}
                                    />
                                    <Text className="text-[11px] text-[#6B7280]">
                                        {isConnected ? 'Connected' : 'Offline'}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View className="flex-row items-center mr-2">
                            <TouchableOpacity 
                                onPress={() => {
                                    Alert.alert(
                                        'Chat Options',
                                        'What would you like to do?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Clear Chat History',
                                                style: 'destructive',
                                                onPress: () => {
                                                    if (peerId) {
                                                        clearHistory(peerId, false);
                                                        loadMessages();
                                                    }
                                                },
                                            },
                                        ]
                                    );
                                }}
                                className="w-8 h-8 rounded-full bg-[#FFFFFF] items-center justify-center" 
                                style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
                            >
                                <Ionicons name="ellipsis-vertical" size={16} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    ),
                    headerStyle: { backgroundColor: '#F9FAFB' },
                    headerTintColor: '#111827',
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
                            <View className="w-16 h-16 rounded-full bg-[#FFFFFF] items-center justify-center mb-4" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <Ionicons
                                    name="chatbubble-ellipses-outline"
                                    size={28}
                                    color="#4B5563"
                                />
                            </View>
                            <Text className="text-[#111827] text-base font-semibold mb-1">
                                No messages yet
                            </Text>
                            <Text className="text-[#6B7280] text-sm">
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
                            senderName={!item.isMine ? peerNickname : undefined}
                            senderColor={!item.isMine ? color : undefined}
                        />
                    )}
                />

                {/* Input Bar */}
                <View className="flex-row items-end px-3 py-2.5 bg-[#F9FAFB] border-t border-[#E5E7EB]">
                    <TouchableOpacity
                        className="w-10 h-10 rounded-full items-center justify-center mr-1"
                        accessibilityLabel="Attach file"
                    >
                        <Ionicons name="add-circle-outline" size={24} color="#9CA3AF" />
                    </TouchableOpacity>
                    <View className="flex-1 flex-row items-end bg-[#FFFFFF] rounded-2xl px-4 py-0.5" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <TextInput
                            className="flex-1 text-[#111827] text-[15px] py-2.5 max-h-24"
                            placeholder="Send a message…"
                            placeholderTextColor="#9CA3AF"
                            value={input}
                            onChangeText={setInput}
                            multiline
                            returnKeyType="default"
                            accessibilityLabel="Message input"
                            accessibilityHint="Type your message here"
                        />
                    </View>
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!input.trim() || isSending}
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        accessibilityState={{ disabled: !input.trim() || isSending }}
                        className={`ml-1.5 w-10 h-10 rounded-full items-center justify-center ${input.trim() ? 'bg-[#059669]' : 'bg-[#E5E7EB]'
                            }`}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={20}
                            color={input.trim() ? '#FFFFFF' : '#4B5563'}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
