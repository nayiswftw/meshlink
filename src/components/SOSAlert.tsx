/**
 * SOSAlert — Full-screen emergency alert overlay shown when an SOS is received.
 * Shows sender, message, GPS coordinates with distance estimate, elapsed time,
 * and quick actions (open maps, share coordinates).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Vibration, Linking, Platform, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SOSPayload } from '../services/RelayService';
import { formatName } from '../utils';
import { getCurrentLocation, distanceBetween, formatDistance } from '../services/LocationService';

interface SOSAlertProps {
    sos: SOSPayload | null;
    onDismiss: () => void;
}

export default function SOSAlert({ sos, onDismiss }: SOSAlertProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const [elapsed, setElapsed] = useState('');
    const [distanceStr, setDistanceStr] = useState<string | null>(null);

    useEffect(() => {
        if (!sos) return;

        // Vibrate urgently
        Vibration.vibrate([0, 500, 200, 500, 200, 500], false);

        // Pulse animation
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        // Live elapsed timer
        const timer = setInterval(() => {
            const diff = Date.now() - sos.timestamp;
            const secs = Math.floor(diff / 1000);
            if (secs < 60) setElapsed(`${secs}s ago`);
            else if (secs < 3600) setElapsed(`${Math.floor(secs / 60)}m ago`);
            else setElapsed(`${Math.floor(secs / 3600)}h ago`);
        }, 1000);

        // Calculate distance if SOS has GPS and we can get our location
        if (sos.coordinates) {
            getCurrentLocation().then(myLoc => {
                if (myLoc && sos.coordinates) {
                    const dist = distanceBetween(myLoc, sos.coordinates);
                    setDistanceStr(formatDistance(dist));
                }
            });
        }

        return () => {
            pulse.stop();
            clearInterval(timer);
        };
    }, [sos, pulseAnim]);

    if (!sos) return null;

    const time = new Date(sos.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderName = formatName(sos.senderNickname);

    const openMaps = () => {
        if (!sos?.coordinates) return;
        const { lat, lon } = sos.coordinates;
        const label = encodeURIComponent(`SOS from ${senderName}`);
        const url = Platform.select({
            ios: `maps:0,0?q=${lat},${lon}(${label})`,
            android: `geo:0,0?q=${lat},${lon}(${label})`
        });
        if (url) {
            Linking.openURL(url).catch(() => {});
        }
    };

    const shareLocation = async () => {
        if (!sos?.coordinates) return;
        const { lat, lon } = sos.coordinates;
        await Share.share({
            message: `EMERGENCY SOS from ${senderName}!\n${sos.message ? `"${sos.message}"\n` : ''}Location: https://maps.google.com/?q=${lat},${lon}\nSent at ${timeStr}`,
        }).catch(() => {});
    };

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(127, 29, 29, 0.97)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 28,
            }}>
                {/* Pulsing icon */}
                <Animated.View style={{
                    transform: [{ scale: pulseAnim }],
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: '#DC2626',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    shadowColor: '#FF0000',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 20,
                    elevation: 10,
                }}>
                    <Ionicons name="warning" size={48} color="#FFFFFF" />
                </Animated.View>

                <Text style={{
                    color: '#FFFFFF',
                    fontSize: 26,
                    fontWeight: '800',
                    marginBottom: 4,
                    letterSpacing: 3,
                }}>
                    EMERGENCY SOS
                </Text>

                <Text style={{
                    color: '#FCA5A5',
                    fontSize: 17,
                    fontWeight: '600',
                    marginBottom: 4,
                }}>
                    from {senderName}
                </Text>

                <Text style={{ color: '#FECACA', fontSize: 13, marginBottom: 20 }}>
                    {timeStr} · {elapsed} {sos.hopCount > 0 ? `· relayed ${sos.hopCount}×` : ''}
                </Text>

                {/* Custom message */}
                {sos.message ? (
                    <View style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 14,
                        padding: 16,
                        width: '100%',
                        marginBottom: 12,
                    }}>
                        <Text style={{ color: '#FCA5A5', fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 1 }}>
                            MESSAGE
                        </Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 22 }}>
                            {sos.message}
                        </Text>
                    </View>
                ) : null}

                {/* GPS coordinates + distance */}
                {sos.coordinates && (
                    <View style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 14,
                        padding: 14,
                        width: '100%',
                        marginBottom: 12,
                    }}>
                        <Text style={{ color: '#FCA5A5', fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1 }}>
                            LOCATION
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: distanceStr ? 8 : 0 }}>
                            <Ionicons name="location" size={18} color="#FCA5A5" />
                            <Text style={{
                                color: '#FFFFFF',
                                fontSize: 14,
                                marginLeft: 8,
                                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                            }}>
                                {sos.coordinates.lat.toFixed(6)}, {sos.coordinates.lon.toFixed(6)}
                            </Text>
                        </View>
                        {distanceStr && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="navigate" size={16} color="#86EFAC" />
                                <Text style={{ color: '#86EFAC', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
                                    ~{distanceStr} away
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Action buttons */}
                {sos.coordinates && (
                    <View style={{ width: '100%', gap: 10, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={openMaps}
                            style={{
                                backgroundColor: '#059669',
                                borderRadius: 12,
                                paddingVertical: 14,
                                width: '100%',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <Ionicons name="map" size={18} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                                Navigate to Location
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={shareLocation}
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderRadius: 12,
                                paddingVertical: 14,
                                width: '100%',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                                Share with Authorities
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    onPress={onDismiss}
                    style={{
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.5)',
                        borderRadius: 12,
                        paddingVertical: 14,
                        paddingHorizontal: 40,
                        width: '100%',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                        Dismiss
                    </Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}
