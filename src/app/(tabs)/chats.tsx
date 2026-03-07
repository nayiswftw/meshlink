/**
 * Chats tab — Redesigned with horizontal filter pills, online peer avatars,
 * and section-based conversation/channel layout.
 */
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SectionList,
    ScrollView,
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

/* ─── Filter Pill ─────────────────────────────────────────── */
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`px-4 py-2 rounded-full mr-2 ${active ? 'bg-[#059669]' : 'bg-[#FFFFFF]'}`}
            style={!active ? { borderWidth: 1, borderColor: '#E5E7EB' } : undefined}
        >
            <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-[#6B7280]'}`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

/* ─── Online Peer Avatar (horizontal row) ─────────────────── */
function OnlinePeerAvatar({ name, peerId, unread }: { name: string; peerId: string; unread: number }) {
    const color = peerColor(peerId);
    return (
        <TouchableOpacity
            onPress={() => router.push(`/chat/${peerId}`)}
            activeOpacity={0.7}
            className="items-center mr-4"
            accessibilityLabel={`${name}${unread > 0 ? `, ${unread} unread` : ''}`}
        >
            <View>
                <View
                    className="w-14 h-14 rounded-full items-center justify-center"
                    style={{ backgroundColor: color + '22' }}
                >
                    <Text className="text-base font-bold" style={{ color }}>
                        {name.slice(0, 2).toUpperCase()}
                    </Text>
                </View>
                {/* Online dot */}
                <View className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-[#F9FAFB]" />
                {/* Unread badge */}
                {unread > 0 && (
                    <View className="absolute -top-1 -right-1 bg-[#059669] rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                        <Text className="text-white text-[10px] font-bold">
                            {unread > 99 ? '99+' : unread}
                        </Text>
                    </View>
                )}
            </View>
            <Text className="text-[#6B7280] text-[11px] mt-1.5 max-w-[56px]" numberOfLines={1}>
                {name}
            </Text>
        </TouchableOpacity>
    );
}

/* ─── Conversation Row ────────────────────────────────────── */
function ConversationItem({ conv }: { conv: Conversation }) {
    const color = peerColor(conv.peerId);
    const initials = conv.peerName.slice(0, 2).toUpperCase() || '??';

    return (
        <TouchableOpacity
            onPress={() => router.push(`/chat/${conv.peerId}`)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${conv.peerName}${conv.unreadCount > 0 ? `, ${conv.unreadCount} unread` : ''}`}
            className="flex-row items-center py-3 px-4"
        >
            <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: color + '22' }}
            >
                <Text className="text-sm font-bold" style={{ color }}>
                    {initials}
                </Text>
            </View>

            <View className="flex-1 mr-3">
                <View className="flex-row items-center justify-between mb-0.5">
                    <Text className="text-[#111827] font-semibold text-[15px] flex-1 mr-2" numberOfLines={1}>
                        {conv.peerName}
                    </Text>
                    <Text className="text-[#9CA3AF] text-xs">
                        {formatTimestamp(conv.lastMessageTimestamp)}
                    </Text>
                </View>
                <View className="flex-row items-center justify-between">
                    <Text className="text-[#6B7280] text-[13px] flex-1 mr-2" numberOfLines={1}>
                        {conv.lastMessage}
                    </Text>
                    {conv.unreadCount > 0 && (
                        <View className="bg-[#059669] rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
                            <Text className="text-white text-[11px] font-bold">
                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

/* ─── Channel Row ─────────────────────────────────────────── */
function ChannelItem({ channel }: { channel: Channel }) {
    const color = peerColor(channel.name);

    return (
        <TouchableOpacity
            onPress={() => router.push(`/channel/${encodeURIComponent(channel.name)}`)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Channel ${channel.name}${channel.unreadCount > 0 ? `, ${channel.unreadCount} unread` : ''}`}
            className="flex-row items-center py-3 px-4"
        >
            <View
                className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                style={{ backgroundColor: color + '22' }}
            >
                <Text className="text-lg font-bold" style={{ color }}>#</Text>
            </View>

            <View className="flex-1 mr-3">
                <View className="flex-row items-center justify-between mb-0.5">
                    <View className="flex-row items-center flex-1 mr-2">
                        <Text className="text-[#111827] font-semibold text-[15px]" numberOfLines={1}>
                            {channel.name}
                        </Text>
                        {channel.isPasswordProtected && (
                            <Ionicons name="lock-closed" size={11} color="#9CA3AF" style={{ marginLeft: 4 }} />
                        )}
                    </View>
                    {channel.lastMessageTimestamp > 0 && (
                        <Text className="text-[#9CA3AF] text-xs">
                            {formatTimestamp(channel.lastMessageTimestamp)}
                        </Text>
                    )}
                </View>
                <View className="flex-row items-center justify-between">
                    {channel.lastMessage ? (
                        <Text className="text-[#6B7280] text-[13px] flex-1 mr-2" numberOfLines={1}>
                            {channel.lastMessageSender ? `${channel.lastMessageSender}: ` : ''}
                            {channel.lastMessage}
                        </Text>
                    ) : (
                        <Text className="text-[#9CA3AF] text-[13px] italic flex-1">
                            No messages yet
                        </Text>
                    )}
                    {channel.unreadCount > 0 && (
                        <View className="bg-[#059669] rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
                            <Text className="text-white text-[11px] font-bold">
                                {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

/* ─── Main Screen ─────────────────────────────────────────── */
export default function ChatsScreen() {
    const { conversations, channels, joinChannel, peers } = useMesh();
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [filter, setFilter] = useState<'all' | 'direct' | 'channels'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const hasContent = conversations.length > 0 || channels.length > 0;

    // Online peers for avatar row
    const onlinePeers = useMemo(() => {
        return Object.entries(peers).map(([id, nick]) => {
            const conv = conversations.find((c) => c.peerId === id);
            return { id, name: nick, unread: conv?.unreadCount ?? 0 };
        });
    }, [peers, conversations]);

    // Filter and search
    const filteredConversations = useMemo(() => {
        let list = conversations;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (c) => c.peerName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
            );
        }
        return list;
    }, [conversations, searchQuery]);

    const filteredChannels = useMemo(() => {
        let list = channels;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (c) => c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
            );
        }
        return list;
    }, [channels, searchQuery]);

    const handleCreateOrJoin = async (channelName: string, password?: string) => {
        await joinChannel(channelName, password);
        router.push(`/channel/${encodeURIComponent(channelName)}`);
    };

    type SectionItem = { type: 'conversation'; data: Conversation } | { type: 'channel'; data: Channel };
    const sections: { title: string; subtitle?: string; data: SectionItem[] }[] = [];

    if ((filter === 'all' || filter === 'channels') && filteredChannels.length > 0) {
        sections.push({
            title: 'Channels',
            subtitle: `${filteredChannels.length} active`,
            data: filteredChannels.map((c) => ({ type: 'channel' as const, data: c })),
        });
    }

    if ((filter === 'all' || filter === 'direct') && filteredConversations.length > 0) {
        sections.push({
            title: 'Direct Messages',
            subtitle: `${filteredConversations.length} conversation${filteredConversations.length !== 1 ? 's' : ''}`,
            data: filteredConversations.map((c) => ({ type: 'conversation' as const, data: c })),
        });
    }

    return (
        <View className="flex-1 bg-[#F9FAFB]" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* ── Header ─────────────────────────────────── */}
            <View className="px-4 pt-2">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-[#111827] text-[28px] font-bold">Chats</Text>
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => setShowSearch(!showSearch)}
                            className="w-9 h-9 rounded-full bg-[#FFFFFF] items-center justify-center mr-2"
                            style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
                        >
                            <Ionicons name="search" size={18} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateChannel(true)}
                            className="w-9 h-9 rounded-full bg-[#059669] items-center justify-center"
                            accessibilityLabel="Create or join channel"
                        >
                            <Ionicons name="add" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {showSearch && (
                    <View className="flex-row items-center bg-[#FFFFFF] rounded-xl px-3 py-2.5 mb-3" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 text-[#111827] text-sm ml-2"
                            placeholder="Search chats…"
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                            returnKeyType="search"
                            accessibilityLabel="Search conversations"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-4"
                    contentContainerStyle={{ paddingRight: 16 }}
                >
                    <FilterPill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
                    <FilterPill label="Direct" active={filter === 'direct'} onPress={() => setFilter('direct')} />
                    <FilterPill label="Channels" active={filter === 'channels'} onPress={() => setFilter('channels')} />
                </ScrollView>
            </View>

            {/* ── Online Peers Row ────────────────────────── */}
            {onlinePeers.length > 0 && (
                <View className="mb-2">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                    >
                        {onlinePeers.map((p) => (
                            <OnlinePeerAvatar key={p.id} name={p.name} peerId={p.id} unread={p.unread} />
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* ── Content ─────────────────────────────────── */}
            {!hasContent ? (
                <View className="flex-1 items-center justify-center px-8">
                    <View className="w-20 h-20 rounded-full bg-[#FFFFFF] items-center justify-center mb-5" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Ionicons name="chatbubbles-outline" size={36} color="#9CA3AF" />
                    </View>
                    <Text className="text-[#111827] text-xl font-bold mb-2">
                        No conversations yet
                    </Text>
                    <Text className="text-[#6B7280] text-sm text-center max-w-[280px] mb-8">
                        Find nearby peers on the Network tab or join a channel to start messaging
                    </Text>
                    <View className="flex-row gap-3" style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/peers')}
                            className="bg-[#059669] flex-row items-center rounded-full px-6 py-3.5"
                            accessibilityRole="button"
                            accessibilityLabel="Find Peers"
                        >
                            <Ionicons name="radio-outline" size={16} color="#FFFFFF" />
                            <Text className="text-white font-semibold text-sm ml-2">Find Peers</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateChannel(true)}
                            className="border border-[#E5E7EB] flex-row items-center rounded-full px-6 py-3.5 bg-[#FFFFFF]"
                            accessibilityRole="button"
                            accessibilityLabel="Join Channel"
                        >
                            <Ionicons name="add" size={16} color="#059669" />
                            <Text className="text-[#059669] font-semibold text-sm ml-1.5">Join Channel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) =>
                        item.type === 'channel' ? item.data.name : item.data.peerId
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <View className="flex-row items-center justify-between px-4 pt-5 pb-1">
                            <View>
                                <Text className="text-[#111827] text-lg font-bold">
                                    {section.title}
                                </Text>
                                {section.subtitle && (
                                    <Text className="text-[#9CA3AF] text-xs mt-0.5">
                                        {section.subtitle}
                                    </Text>
                                )}
                            </View>
                            {section.title === 'Channels' && (
                                <TouchableOpacity
                                    onPress={() => setShowCreateChannel(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Join or create channel"
                                    className="w-8 h-8 rounded-full bg-[#FFFFFF] items-center justify-center"
                                    style={{ borderWidth: 1, borderColor: '#E5E7EB' }}
                                >
                                    <Ionicons name="add" size={16} color="#059669" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    ItemSeparatorComponent={() => (
                        <View className="h-px bg-[#F3F4F6] mx-4 ml-[76px]" />
                    )}
                    renderItem={({ item }) =>
                        item.type === 'channel' ? (
                            <ChannelItem channel={item.data} />
                        ) : (
                            <ConversationItem conv={item.data} />
                        )
                    }
                />
            )}

            <CreateChannelModal
                visible={showCreateChannel}
                onClose={() => setShowCreateChannel(false)}
                onCreateOrJoin={handleCreateOrJoin}
            />
        </View>
    );
}
