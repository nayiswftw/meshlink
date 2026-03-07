/**
 * VoiceRecordButton — Hold-to-record push-to-talk button with visual feedback.
 */
import React, { useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceRecordButtonProps {
    onRecordStart: () => void;
    onRecordEnd: () => void;
    onRecordCancel: () => void;
    disabled?: boolean;
}

export default function VoiceRecordButton({
    onRecordStart,
    onRecordEnd,
    onRecordCancel,
    disabled,
}: VoiceRecordButtonProps) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const handlePressIn = () => {
        if (disabled) return;
        setRecording(true);
        setSeconds(0);
        onRecordStart();

        Animated.spring(scaleAnim, {
            toValue: 1.3,
            useNativeDriver: true,
        }).start();

        timerRef.current = setInterval(() => {
            setSeconds((s) => {
                if (s >= 14) {
                    // Auto-stop at 15 seconds
                    handlePressOut();
                    return 15;
                }
                return s + 1;
            });
        }, 1000);
    };

    const handlePressOut = () => {
        if (!recording) return;
        setRecording(false);

        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
        }).start();

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (seconds < 1) {
            onRecordCancel();
        } else {
            onRecordEnd();
        }
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View
                onTouchStart={handlePressIn}
                onTouchEnd={handlePressOut}
                onTouchCancel={() => {
                    if (recording) {
                        setRecording(false);
                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                        Animated.spring(scaleAnim, {
                            toValue: 1,
                            useNativeDriver: true,
                        }).start();
                        onRecordCancel();
                    }
                }}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: recording ? '#DC2626' : '#E5E7EB',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                accessibilityRole="button"
                accessibilityLabel={recording ? `Recording ${seconds}s` : 'Hold to record voice message'}
            >
                <Ionicons
                    name={recording ? 'stop' : 'mic'}
                    size={20}
                    color={recording ? '#FFFFFF' : '#4B5563'}
                />
            </View>
            {recording && (
                <View style={{
                    position: 'absolute',
                    top: -24,
                    left: -4,
                    right: -4,
                    alignItems: 'center',
                }}>
                    <View style={{
                        backgroundColor: '#DC2626',
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}>
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#FFFFFF',
                            marginRight: 4,
                        }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                            {seconds}s
                        </Text>
                    </View>
                </View>
            )}
        </Animated.View>
    );
}
