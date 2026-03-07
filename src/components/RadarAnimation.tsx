/**
 * RadarAnimation — Pulsing radar effect for the peer discovery screen.
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Animated, Easing, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RadarAnimationProps {
    isActive: boolean;
    size?: number;
    peers?: { id: string; nickname: string }[];
    onPeerPress?: (id: string, nickname: string) => void;
}

export default function RadarAnimation({
    isActive,
    size = 200,
    peers = [],
    onPeerPress,
}: RadarAnimationProps) {
    const pulse1 = useRef(new Animated.Value(0)).current;
    const pulse2 = useRef(new Animated.Value(0)).current;
    const pulse3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!isActive) {
            pulse1.setValue(0);
            pulse2.setValue(0);
            pulse3.setValue(0);
            return;
        }

        const createPulse = (anim: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );

        const anim1 = createPulse(pulse1, 0);
        const anim2 = createPulse(pulse2, 600);
        const anim3 = createPulse(pulse3, 1200);

        anim1.start();
        anim2.start();
        anim3.start();

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
        };
    }, [isActive]);

    const renderRing = (anim: Animated.Value) => {
        const scale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
        });
        const opacity = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.6, 0],
        });

        return (
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 2,
                    borderColor: '#059669',
                    transform: [{ scale }],
                    opacity,
                }}
            />
        );
    };

    // Calculate pseudo-random positions using ID and resolve collisions
    const peerPositions = useMemo(() => {
        const radius = size / 2;
        const placedPositions: Array<{ x: number; y: number }> = [];
        const MIN_DIST = 55; // Provide enough spacing so bubbles and text don't overlap

        return peers.map(peer => {
            let hash = 0;
            for (let i = 0; i < peer.id.length; i++) {
                hash = (hash << 5) - hash + peer.id.charCodeAt(i);
                hash |= 0;
            }
            
            let angle = Math.abs(hash % 360) * (Math.PI / 180);
            const maxDist = Math.max(1, radius - 45); // leave room for edges
            let distance = 25 + Math.abs((hash >> 4) % maxDist);

            let x = Math.cos(angle) * distance;
            let y = Math.sin(angle) * distance;

            // Simple collision avoidance
            let attempts = 0;
            let collision = true;
            while (collision && attempts < 30) {
                collision = false;
                for (const pos of placedPositions) {
                    const dx = pos.x - x;
                    const dy = pos.y - y;
                    if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) {
                        collision = true;
                        // Nudge angle and recalculate
                        angle += Math.PI / 4; // Shift by 45 degrees
                        distance = Math.min(radius - 35, distance + 10);
                        x = Math.cos(angle) * distance;
                        y = Math.sin(angle) * distance;
                        break;
                    }
                }
                attempts++;
            }

            placedPositions.push({ x, y });

            return { ...peer, x, y };
        });
    }, [peers, size]);

    return (
        <View
            style={{
                width: size,
                height: size,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {renderRing(pulse1)}
            {renderRing(pulse2)}
            {renderRing(pulse3)}

            {/* Found Peers as interactive Chat Bubbles */}
            {peerPositions.map((peer, index) => (
                <TouchableOpacity
                    key={peer.id}
                    onPress={() => onPeerPress?.(peer.id, peer.nickname)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.75}
                    style={{
                        position: 'absolute',
                        transform: [
                            { translateX: peer.x },
                            { translateY: peer.y - 12 } // slightly offset up
                        ],
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10 + index,
                    }}
                >
                    <Ionicons 
                        name="chatbubble-ellipses" 
                        size={28} 
                        color="#059669" 
                    />
                    <Text 
                        style={{ 
                            position: 'absolute', 
                            top: 28, 
                            fontSize: 10, 
                            fontWeight: 'bold', 
                            color: '#111827',
                            backgroundColor: 'rgba(255,255,255,0.8)',
                            paddingHorizontal: 4,
                            borderRadius: 4,
                            overflow: 'hidden',
                        }}
                        numberOfLines={1}
                    >
                        {peer.nickname || 'Unknown'}
                    </Text>
                </TouchableOpacity>
            ))}

            {/* Center dot */}
            <View
                className="w-4 h-4 rounded-full bg-[#059669]"
                pointerEvents="none"
                style={{
                    shadowColor: '#059669',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 10,
                    elevation: 8,
                }}
            />
        </View>
    );
}
