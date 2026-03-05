/**
 * Chat screen — Full conversation view with a specific peer.
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
import ChatBubble from '../../components/ChatBubble';
import { peerColor } from '../../constants';
import { decryptMessage } from '../../services/crypto/CryptoService';
import { getSecretKey } from '../../services/crypto/IdentityService';
import { getPeer } from '../../services/storage/Database';
import type { SerializedMessage } from '../../types';

export default function ChatScreen() {
    const { peerId } = useLocalSearchParams<{ peerId: string }>();
    const {
        identity,
        getMessagesForPeer,
        sendMessage,
        markRead,
        peers,
        refreshConversations,
    } = useMesh();

    const [messages, setMessages] = useState<SerializedMessage[]>([]);
    const [decryptedMap, setDecryptedMap] = useState<Map<string, string>>(new Map());
    const decryptedMapRef = useRef<Map<string, string>>(new Map());
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Get peer info
    const livePeer = peers.find((p) => p.id === peerId);
    const dbPeerRecord = getPeer(peerId ?? '');
    const peerName = livePeer?.displayName ?? dbPeerRecord?.displayName ?? 'Unknown';
    const peerPubKey = livePeer?.publicKey ?? dbPeerRecord?.publicKey ?? '';
    const color = peerColor(peerPubKey || peerId || '');
    const isConnected = livePeer?.connectionState === 'connected';

    // Load and decrypt messages
    const loadMessages = useCallback(async () => {
        if (!peerId) return;
        const msgs = getMessagesForPeer(peerId);
        setMessages(msgs);

        // Decrypt messages we haven't decrypted yet
        const secretKey = await getSecretKey().catch(() => null);
        if (!secretKey) return;

        const currentMap = decryptedMapRef.current;
        let hasNew = false;
        for (const msg of msgs) {
            if (!currentMap.has(msg.id)) {
                hasNew = true;
                try {
                    if (msg.senderId === identity?.id) {
                        // We sent this — use stored plaintext (NaCl box can't be decrypted with own key)
                        currentMap.set(msg.id, msg.plaintextContent ?? '[Sent message]');
                    } else {
                        const decrypted = decryptMessage(
                            msg.content,
                            msg.nonce,
                            peerPubKey,
                            secretKey
                        );
                        currentMap.set(msg.id, decrypted);
                    }
                } catch {
                    currentMap.set(msg.id, '[Unable to decrypt]');
                }
            }
        }
        if (hasNew) {
            setDecryptedMap(new Map(currentMap));
        }
    }, [peerId, identity, peerPubKey, getMessagesForPeer]);

    useEffect(() => {
        loadMessages();
        if (peerId) markRead(peerId);
    }, [peerId, loadMessages, markRead]);

    // Refresh periodically
    useEffect(() => {
        const interval = setInterval(loadMessages, 3000);
        return () => clearInterval(interval);
    }, [loadMessages]);

    const handleSend = async () => {
        if (!input.trim() || !peerId || !peerPubKey || isSending) return;

        const text = input.trim();
        setInput('');
        setIsSending(true);

        try {
            await sendMessage(peerId, peerPubKey, text);
            // Store the plaintext locally for display
            const msgs = getMessagesForPeer(peerId);
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg) {
                decryptedMapRef.current.set(lastMsg.id, text);
                setDecryptedMap(new Map(decryptedMapRef.current));
            }
            loadMessages();
        } catch (error) {
            console.warn('[Chat] Send failed:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAF6F1]">
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View className="flex-row items-center">
                            <View
                                className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                                style={{ backgroundColor: color + '20' }}
                            >
                                <Text className="text-xs font-bold" style={{ color }}>
                                    {peerName.split('-').pop()?.slice(0, 2).toUpperCase() ?? '??'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-[#2C2C2C] font-semibold text-base">
                                    {peerName}
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
                            content={decryptedMap.get(item.id) ?? item.content}
                            timestamp={item.timestamp}
                            isMine={item.senderId === identity?.id}
                            status={item.senderId === identity?.id ? item.status : undefined}
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
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!input.trim() || isSending}
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
