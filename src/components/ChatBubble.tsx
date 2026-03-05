/**
 * ChatBubble — Message bubble with timestamp and delivery status.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ChatBubbleProps {
    content: string;
    timestamp: number;
    isMine: boolean;
    status?: string; // 'queued' | 'sending' | 'sent' | 'delivered' | 'failed'
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getStatusIcon(
    status?: string
): { name: keyof typeof Ionicons.glyphMap; color: string } | null {
    switch (status) {
        case 'queued':
            return { name: 'time-outline', color: '#A0977D' };
        case 'sending':
            return { name: 'arrow-up-circle-outline', color: '#A0977D' };
        case 'sent':
            return { name: 'checkmark', color: '#A0977D' };
        case 'delivered':
            return { name: 'checkmark-done', color: '#5C6B3C' };
        case 'failed':
            return { name: 'alert-circle-outline', color: '#B85C4A' };
        default:
            return null;
    }
}

function ChatBubbleInner({
    content,
    timestamp,
    isMine,
    status,
}: ChatBubbleProps) {
    const statusIcon = isMine ? getStatusIcon(status) : null;

    return (
        <View
            className={`max-w-[80%] mb-2.5 ${isMine ? 'self-end' : 'self-start'
                }`}
        >
            <View
                className={`rounded-2xl px-4 py-2.5 ${isMine
                    ? 'bg-[#5C6B3C] rounded-br-sm'
                    : 'bg-[#F0EBE3] border border-[#E8E2D9] rounded-bl-sm'
                    }`}
            >
                <Text
                    className={`text-[15px] leading-5 ${isMine ? 'text-white' : 'text-[#2C2C2C]'
                        }`}
                >
                    {content}
                </Text>
            </View>

            {/* Timestamp & Status */}
            <View
                className={`flex-row items-center mt-1 gap-1 ${isMine ? 'justify-end' : 'justify-start'
                    }`}
            >
                <Text className="text-[11px] text-[#A0977D]">
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
        </View>
    );
}

export default React.memo(ChatBubbleInner);
