/**
 * Chats tab — Conversation list with private chats and channels.
 */
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    SectionList,
    TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../../context/MeshContext';
import { peerColor } from '../../constants';
import CreateChannelModal from '../../components/CreateChannelModal';
import type { Conversation, Channel } from '../../types';

function formatTimestamp(ts: number): string {
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationItem({ conv }: { conv: Conversation }) {
    const color = peerColor(conv.peerId);
    const initials = conv.peerName
        .slice(0, 2)
        .toUpperCase() || '??';

    return (
        <TouchableOpacity
            onPress={() => router.push(`/chat/${conv.peerId}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${conv.peerName}${conv.unreadCount > 0 ? `, ${conv.unreadCount} unread` : ''}`}
            className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 mb-3 border border-[#E8E2D9]"
            style={{
                shadowColor: '#8B7D6B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
            }}
        >
            {/* Avatar */}
            <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3.5"
                style={{ backgroundColor: color + '20' }}
            >
                <Text className="text-base font-bold" style={{ color }}>
                    {initials}
                </Text>
            </View>

            {/* Content */}
            <View className="flex-1 mr-3">
                <Text className="text-[#2C2C2C] font-semibold text-base" numberOfLines={1}>
                    {conv.peerName}
                </Text>
                <Text className="text-[#7A7A7A] text-sm mt-0.5" numberOfLines={1}>
                    {conv.lastMessage}
                </Text>
            </View>

            {/* Meta */}
            <View className="items-end">
                <Text className="text-[#A0977D] text-xs mb-1">
                    {formatTimestamp(conv.lastMessageTimestamp)}
                </Text>
                {conv.unreadCount > 0 && (
                    <View className="bg-[#5C6B3C] rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
                        <Text className="text-white text-[11px] font-bold">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

function ChannelItem({ channel }: { channel: Channel }) {
    const color = peerColor(channel.name);

    return (
        <TouchableOpacity
            onPress={() => router.push(`/channel/${encodeURIComponent(channel.name)}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Channel ${channel.name}${channel.unreadCount > 0 ? `, ${channel.unreadCount} unread` : ''}`}
            className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 mb-3 border border-[#E8E2D9]"
            style={{
                shadowColor: '#8B7D6B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
            }}
        >
            {/* Channel icon */}
            <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3.5"
                style={{ backgroundColor: color + '20' }}
            >
                <Ionicons name="chatbubbles" size={20} color={color} />
            </View>

            {/* Content */}
            <View className="flex-1 mr-3">
                <View className="flex-row items-center">
                    <Text className="text-[#2C2C2C] font-semibold text-base" numberOfLines={1}>
                        {channel.name}
                    </Text>
                    {channel.isPasswordProtected && (
                        <Ionicons name="lock-closed" size={12} color="#A0977D" style={{ marginLeft: 4 }} />
                    )}
                </View>
                {channel.lastMessage ? (
                    <Text className="text-[#7A7A7A] text-sm mt-0.5" numberOfLines={1}>
                        {channel.lastMessageSender ? `${channel.lastMessageSender}: ` : ''}
                        {channel.lastMessage}
                    </Text>
                ) : (
                    <Text className="text-[#A0977D] text-sm mt-0.5 italic">
                        No messages yet
                    </Text>
                )}
            </View>

            {/* Meta */}
            <View className="items-end">
                {channel.lastMessageTimestamp > 0 && (
                    <Text className="text-[#A0977D] text-xs mb-1">
                        {formatTimestamp(channel.lastMessageTimestamp)}
                    </Text>
                )}
                {channel.unreadCount > 0 && (
                    <View className="bg-[#5C6B3C] rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
                        <Text className="text-white text-[11px] font-bold">
                            {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

export default function ChatsScreen() {
    const { conversations, channels, joinChannel, searchMessages } = useMesh();
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const hasContent = conversations.length > 0 || channels.length > 0;

    // Filter conversations and channels by search query
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            (c) =>
                c.peerName.toLowerCase().includes(q) ||
                c.lastMessage.toLowerCase().includes(q)
        );
    }, [conversations, searchQuery]);

    const filteredChannels = useMemo(() => {
        if (!searchQuery.trim()) return channels;
        const q = searchQuery.toLowerCase();
        return channels.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.lastMessage.toLowerCase().includes(q)
        );
    }, [channels, searchQuery]);

    const handleCreateOrJoin = async (channelName: string, password?: string) => {
        await joinChannel(channelName, password);
        router.push(`/channel/${encodeURIComponent(channelName)}`);
    };

    type SectionItem = { type: 'conversation'; data: Conversation } | { type: 'channel'; data: Channel };

    const sections: { title: string; data: SectionItem[] }[] = [];

    if (filteredChannels.length > 0) {
        sections.push({
            title: 'Channels',
            data: filteredChannels.map((c) => ({ type: 'channel' as const, data: c })),
        });
    }

    if (filteredConversations.length > 0) {
        sections.push({
            title: 'Direct Messages',
            data: filteredConversations.map((c) => ({ type: 'conversation' as const, data: c })),
        });
    }

    return (
        <View className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            {!hasContent ? (
                <View className="flex-1 items-center justify-center px-8">
                    <View className="w-20 h-20 rounded-full bg-[#E8EDDF] items-center justify-center mb-6">
                        <Ionicons
                            name="chatbubbles-outline"
                            size={36}
                            color="#A0977D"
                        />
                    </View>
                    <Text className="text-[#2C2C2C] text-xl font-bold mb-2">
                        No Conversations Yet
                    </Text>
                    <Text className="text-[#7A7A7A] text-sm text-center max-w-xs">
                        Connect to a nearby peer or join a channel to start chatting
                    </Text>
                    <View className="flex-row gap-3 mt-8" style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/peers')}
                            className="bg-[#5C6B3C] flex-row items-center rounded-xl px-5 py-3.5"
                            style={{
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Find Peers"
                        >
                            <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
                            <Text className="text-white font-semibold text-sm ml-2">
                                Find Peers
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateChannel(true)}
                            className="border border-[#5C6B3C] flex-row items-center rounded-xl px-5 py-3.5"
                            accessibilityRole="button"
                            accessibilityLabel="Join Channel"
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#5C6B3C" />
                            <Text className="text-[#5C6B3C] font-semibold text-sm ml-2">
                                Join Channel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View className="flex-1">
                    {/* Search Bar */}
                    <View className="px-4 pt-2 pb-1">
                        <View className="flex-row items-center bg-white rounded-xl px-3 py-2.5 border border-[#E8E2D9]">
                            <Ionicons name="search-outline" size={18} color="#A0977D" />
                            <TextInput
                                className="flex-1 text-[#2C2C2C] text-sm ml-2"
                                placeholder="Search chats…"
                                placeholderTextColor="#A0977D"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                returnKeyType="search"
                                accessibilityLabel="Search conversations"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#A0977D" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <SectionList
                        sections={sections}
                        keyExtractor={(item) =>
                            item.type === 'channel' ? item.data.name : item.data.peerId
                        }
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}
                        renderSectionHeader={({ section: { title } }) => (
                            <View className="flex-row items-center justify-between pt-3 pb-2">
                                <Text className="text-[#A0977D] text-xs font-semibold uppercase tracking-wider">
                                    {title}
                                </Text>
                                {title === 'Channels' && (
                                    <TouchableOpacity
                                        onPress={() => setShowCreateChannel(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Join or create channel"
                                    >
                                        <Ionicons name="add-circle-outline" size={20} color="#5C6B3C" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        renderItem={({ item }) =>
                            item.type === 'channel' ? (
                                <ChannelItem channel={item.data} />
                            ) : (
                                <ConversationItem conv={item.data} />
                            )
                        }
                    />
                </View>
            )}

            <CreateChannelModal
                visible={showCreateChannel}
                onClose={() => setShowCreateChannel(false)}
                onCreateOrJoin={handleCreateOrJoin}
            />
        </View>
    );
}
