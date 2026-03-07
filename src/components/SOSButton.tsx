/**
 * SOSButton — Long-press (3s) button to trigger an emergency SOS broadcast.
 * Shows a fill animation during the long press, then a confirmation dialog
 * with optional custom message and automatic GPS attachment.
 */
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SOSButtonProps {
    onSOS: (message?: string) => void;
    disabled?: boolean;
}

const HOLD_DURATION = 3000; // 3 seconds

export default function SOSButton({ onSOS, disabled }: SOSButtonProps) {
    const [holding, setHolding] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [sosMessage, setSOSMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const fillAnim = useRef(new Animated.Value(0)).current;
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handlePressIn = () => {
        if (disabled) return;
        setHolding(true);
        fillAnim.setValue(0);
        Animated.timing(fillAnim, {
            toValue: 1,
            duration: HOLD_DURATION,
            useNativeDriver: false,
        }).start();
        holdTimer.current = setTimeout(() => {
            setHolding(false);
            setShowConfirm(true);
        }, HOLD_DURATION);
    };

    const handlePressOut = () => {
        setHolding(false);
        fillAnim.stopAnimation();
        fillAnim.setValue(0);
        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
    };

    const handleConfirm = async () => {
        setIsSending(true);
        try {
            await onSOS(sosMessage.trim() || undefined);
        } finally {
            setIsSending(false);
            setShowConfirm(false);
            setSOSMessage('');
        }
    };

    const fillWidth = fillAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <>
            <TouchableOpacity
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Emergency SOS. Hold for 3 seconds to activate."
                style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: disabled ? '#9CA3AF' : '#DC2626',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                }}
            >
                {holding && (
                    <Animated.View
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: fillWidth,
                            backgroundColor: 'rgba(255,255,255,0.3)',
                        }}
                    />
                )}
                <Ionicons name="warning" size={28} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', marginTop: 1 }}>
                    SOS
                </Text>
            </TouchableOpacity>

            {/* Confirmation modal */}
            <Modal
                visible={showConfirm}
                transparent
                animationType="fade"
                onRequestClose={() => setShowConfirm(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 32,
                }}>
                    <View style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        padding: 24,
                        width: '100%',
                        maxWidth: 340,
                        alignItems: 'center',
                    }}>
                        <View style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: '#FEF2F2',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                        }}>
                            <Ionicons name="warning" size={28} color="#DC2626" />
                        </View>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: '700',
                            color: '#111827',
                            marginBottom: 8,
                        }}>
                            Send Emergency SOS?
                        </Text>
                        <Text style={{
                            fontSize: 14,
                            color: '#6B7280',
                            textAlign: 'center',
                            lineHeight: 20,
                            marginBottom: 16,
                        }}>
                            This will broadcast an emergency alert with your GPS location to all peers in the mesh network.
                        </Text>
                        <TextInput
                            placeholder="Optional: Describe your emergency..."
                            value={sosMessage}
                            onChangeText={setSOSMessage}
                            multiline
                            maxLength={200}
                            style={{
                                width: '100%',
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                borderRadius: 10,
                                padding: 12,
                                fontSize: 14,
                                color: '#111827',
                                minHeight: 60,
                                marginBottom: 8,
                                textAlignVertical: 'top',
                            }}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <Ionicons name="location" size={14} color="#059669" />
                            <Text style={{ fontSize: 12, color: '#059669', marginLeft: 4 }}>
                                GPS location will be attached automatically
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleConfirm}
                            disabled={isSending}
                            style={{
                                backgroundColor: isSending ? '#F87171' : '#DC2626',
                                borderRadius: 12,
                                paddingVertical: 14,
                                width: '100%',
                                alignItems: 'center',
                                marginBottom: 10,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            {isSending && <ActivityIndicator size="small" color="#FFFFFF" />}
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                                {isSending ? 'Sending SOS...' : 'Send SOS'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowConfirm(false)}
                            style={{
                                paddingVertical: 10,
                                width: '100%',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
