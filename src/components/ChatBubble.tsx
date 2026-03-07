/**
 * ChatBubble — Message bubble with timestamp, delivery status, and optional sender avatar.
 * Supports long-press to delete when onDelete is provided.
 */
import React from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isAudioMessage, decodeAudioMessage } from '../services/AudioService';
import AudioBubble from './AudioBubble';
import { formatName } from '../utils';

interface ChatBubbleProps {
    content: string;
    timestamp: number;
    isMine: boolean;
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'queued';
    messageId?: string;
    onDelete?: (messageId: string) => void;
    senderName?: string;
    senderColor?: string;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getStatusIcon(
    status?: string
): { name: keyof typeof Ionicons.glyphMap; color: string } | null {
    switch (status) {
        case 'sending':
            return { name: 'arrow-up-circle-outline', color: '#9CA3AF' };
        case 'sent':
            return { name: 'checkmark', color: '#9CA3AF' };
        case 'delivered':
            return { name: 'checkmark-done', color: '#059669' };
        case 'read':
            return { name: 'checkmark-done', color: '#22C55E' };
        case 'failed':
            return { name: 'alert-circle-outline', color: '#EF4444' };
        case 'queued':
            return { name: 'time-outline', color: '#F59E0B' };
        default:
            return null;
    }
}

function ChatBubbleInner({
    content,
    timestamp,
    isMine,
    status,
    messageId,
    onDelete,
    senderName,
    senderColor,
}: ChatBubbleProps) {
    const statusIcon = isMine ? getStatusIcon(status) : null;
    const isAudio = isAudioMessage(content);
    const audioData = isAudio ? decodeAudioMessage(content) : '';

    const handleLongPress = () => {
        if (!messageId || !onDelete) return;
        Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => onDelete(messageId),
                },
            ],
        );
    };

    const Wrapper = messageId && onDelete ? TouchableOpacity : View;
    const wrapperProps = messageId && onDelete
        ? { onLongPress: handleLongPress, activeOpacity: 0.8 }
        : {};

    // Show inline avatar for received messages
    if (!isMine && senderName) {
        const avatarColor = senderColor || '#6366F1';
        const formattedSender = formatName(senderName); const initials = formattedSender.slice(0, 1).toUpperCase();
        return (
            <View className="flex-row items-end mb-2.5 self-start max-w-[85%]">
                {/* Sender avatar */}
                <View
                    className="w-8 h-8 rounded-full items-center justify-center mr-2 mb-5"
                    style={{ backgroundColor: avatarColor + '22' }}
                >
                    <Text className="text-xs font-bold" style={{ color: avatarColor }}>
                        {initials}
                    </Text>
                </View>
                <Wrapper
                    {...(wrapperProps as any)}
                    className="flex-shrink"
                    accessibilityRole="text"
                    accessibilityLabel={`${formattedSender}: ${content}. ${formatTime(timestamp)}`}
                >
                    {/* Sender name */}
                    <Text className="text-xs font-medium mb-1 ml-1" style={{ color: avatarColor }}>{formattedSender}</Text>
                    <View className="rounded-2xl rounded-bl-sm px-4 py-2.5 bg-[#FFFFFF]" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                        {isAudio ? (
                            <AudioBubble audioData={audioData} messageId={messageId || ''} isMine={false} />
                        ) : (
                            <Text className="text-[15px] leading-5 text-[#1F2937]">
                                {content}
                            </Text>
                        )}
                    </View>
                    <View className="flex-row items-center mt-1 gap-1 justify-start">
                        <Text className="text-[11px] text-[#9CA3AF]">
                            {formatTime(timestamp)}
                        </Text>
                    </View>
                </Wrapper>
            </View>
        );
    }

    return (
        <Wrapper
            {...(wrapperProps as any)}
            className={`max-w-[80%] mb-2.5 ${isMine ? 'self-end' : 'self-start'
                }`}
            accessibilityRole="text"
            accessibilityLabel={`${isMine ? 'You' : 'Peer'}: ${content}. ${formatTime(timestamp)}${status ? `, ${status}` : ''}`}
        >
            <View
                className={`rounded-2xl px-4 py-2.5 ${isMine
                    ? 'bg-[#059669] rounded-br-sm'
                    : 'bg-[#FFFFFF] rounded-bl-sm'
                    }`}
                style={!isMine ? { borderWidth: 1, borderColor: '#E5E7EB' } : undefined}
            >
                {isAudio ? (
                    <AudioBubble audioData={audioData} messageId={messageId || ''} isMine={isMine} />
                ) : (
                    <Text
                        className={`text-[15px] leading-5 ${isMine ? 'text-white' : 'text-[#1F2937]'
                            }`}
                    >
                        {content}
                    </Text>
                )}
            </View>

            {/* Timestamp & Status */}
            <View
                className={`flex-row items-center mt-1 gap-1 ${isMine ? 'justify-end' : 'justify-start'
                    }`}
            >
                <Text className="text-[11px] text-[#9CA3AF]">
                    {formatTime(timestamp)}
                </Text>
                {statusIcon && (
                    <Ionicons
                        name={statusIcon.name}
                        size={13}
                        color={statusIcon.color}
                    />
                )}
            </View>
        </Wrapper>
    );
}

export default React.memo(ChatBubbleInner);
