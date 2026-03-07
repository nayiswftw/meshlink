/**
 * RadarAnimation — Pulsing radar effect for the peer discovery screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RadarAnimationProps {
    isActive: boolean;
    size?: number;
}

export default function RadarAnimation({
    isActive,
    size = 200,
}: RadarAnimationProps) {
    const pulse1 = useRef(new Animated.Value(0)).current;
    const pulse2 = useRef(new Animated.Value(0)).current;
    const pulse3 = useRef(new Animated.Value(0)).current;

    // Chat bubbles state
    const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number; scale: Animated.Value; opacity: Animated.Value }[]>([]);
    const bubbleIdCounter = useRef(0);

    useEffect(() => {
        if (!isActive) {
            pulse1.setValue(0);
            pulse2.setValue(0);
            pulse3.setValue(0);
            setBubbles([]);
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

        // Chat bubble popping logic
        const interval = setInterval(() => {
            const angle = Math.random() * Math.PI * 2;
            const distance = (Math.random() * (size / 2 - 20)) + 20;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            const scale = new Animated.Value(0);
            const opacity = new Animated.Value(0);
            
            const id = bubbleIdCounter.current++;
            
            setBubbles(prev => [...prev.slice(-4), { id, x, y, scale, opacity }]);
            
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scale, {
                        toValue: 1,
                        friction: 4,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    })
                ]),
                Animated.delay(1000),
                Animated.parallel([
                    Animated.timing(scale, {
                        toValue: 0.5,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    })
                ])
            ]).start(() => {
                setBubbles(prev => prev.filter(b => b.id !== id));
            });

        }, 800);

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
            clearInterval(interval);
        };
    }, [isActive, size]);

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

            {/* Popping Chat Bubbles */}
            {bubbles.map(bubble => (
                <Animated.View
                    key={bubble.id}
                    style={{
                        position: 'absolute',
                        transform: [
                            { translateX: bubble.x },
                            { translateY: bubble.y },
                            { scale: bubble.scale }
                        ],
                        opacity: bubble.opacity,
                    }}
                >
                    <Ionicons 
                        name={bubble.id % 2 === 0 ? "chatbubble" : "chatbubble-ellipses"} 
                        size={24} 
                        color="#059669" 
                    />
                </Animated.View>
            ))}

            {/* Center dot */}
            <View
                className="w-4 h-4 rounded-full bg-[#059669]"
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
