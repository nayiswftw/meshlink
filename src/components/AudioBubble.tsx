/**
 * AudioBubble — Inline audio playback widget for voice messages.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playAudio, stopAudio } from '../services/AudioService';

interface AudioBubbleProps {
    audioData: string;
    messageId: string;
    isMine: boolean;
}

export default function AudioBubble({ audioData, messageId, isMine }: AudioBubbleProps) {
    const [playing, setPlaying] = useState(false);

    const handlePress = async () => {
        if (playing) {
            await stopAudio(messageId);
            setPlaying(false);
        } else {
            setPlaying(true);
            await playAudio(audioData, messageId, () => setPlaying(false));
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Stop voice message' : 'Play voice message'}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 10,
                minWidth: 140,
            }}
        >
            <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isMine ? 'rgba(255,255,255,0.25)' : '#ECFDF5',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
            }}>
                <Ionicons
                    name={playing ? 'stop' : 'play'}
                    size={16}
                    color={isMine ? '#FFFFFF' : '#059669'}
                />
            </View>
            {/* Waveform placeholder bars */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}>
                {[3, 5, 8, 4, 7, 5, 6, 4, 8, 3, 5, 7, 4, 6, 3].map((h, i) => (
                    <View
                        key={i}
                        style={{
                            width: 3,
                            height: h * 2,
                            borderRadius: 1.5,
                            backgroundColor: isMine
                                ? playing ? '#FFFFFF' : 'rgba(255,255,255,0.5)'
                                : playing ? '#059669' : '#D1D5DB',
                        }}
                    />
                ))}
            </View>
            <Text style={{
                marginLeft: 8,
                fontSize: 11,
                color: isMine ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
                fontVariant: ['tabular-nums'],
            }}>
                {playing ? '▶' : ''}
            </Text>
        </TouchableOpacity>
    );
}
