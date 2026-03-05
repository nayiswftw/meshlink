/**
 * RadarAnimation — Pulsing radar effect for the peer discovery screen.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

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
                style={{
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 2,
                    borderColor: '#5C6B3C',
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
            {/* Center dot */}
            <View
                className="w-4 h-4 rounded-full bg-[#5C6B3C]"
                style={{
                    shadowColor: '#5C6B3C',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 10,
                    elevation: 8,
                }}
            />
        </View>
    );
}
