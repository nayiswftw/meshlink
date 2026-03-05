/**
 * Onboarding — First launch setup: identity generation, name input, BLE permissions.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Animated,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../context/MeshContext';
import { setOnboardingComplete, saveSettings } from '../services/storage/AppState';
import RadarAnimation from '../components/RadarAnimation';

const STEPS = [
    {
        title: 'Welcome to Meshlink',
        subtitle: 'Communicate without internet.\nPowered by Bluetooth mesh networking.',
        icon: 'radio-outline' as const,
    },
    {
        title: 'How it works',
        subtitle:
            'Your device discovers nearby Meshlink users via Bluetooth.\nMessages hop device-to-device to reach their destination.',
        icon: 'git-network-outline' as const,
    },
    {
        title: 'End-to-end encrypted',
        subtitle:
            'Every message is encrypted with your unique key.\nOnly the recipient can read your messages.',
        icon: 'shield-checkmark-outline' as const,
    },
];

export default function OnboardingScreen() {
    const { identity, updateSettings, bleReady, requestEnableBle } = useMesh();
    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [bleGranted, setBleGranted] = useState(bleReady);
    const [isLoading, setIsLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (identity) {
            setName(identity.displayName);
        }
    }, [identity]);

    // Reactively sync BLE state from context — if the user turns
    // Bluetooth on/off from system settings, this updates immediately
    useEffect(() => {
        setBleGranted(bleReady);
    }, [bleReady]);

    const animateTransition = (next: number) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -30,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setStep(next);
            slideAnim.setValue(30);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    };

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            animateTransition(step + 1);
        } else {
            animateTransition(STEPS.length); // name input step
        }
    };

    const handleGrantBle = async () => {
        setIsLoading(true);
        try {
            await requestEnableBle();
            // The UI will be reactively unlocked via bleReady once Bluetooth turns on.
        } catch (error) {
            Alert.alert(
                'Bluetooth Error',
                'Failed to initialize Bluetooth. Please check your device settings.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinish = () => {
        if (name.trim()) {
            updateSettings({ displayName: name.trim(), onboardingComplete: true });
        } else {
            updateSettings({ onboardingComplete: true });
        }
        setOnboardingComplete();
        router.replace('/(tabs)/peers');
    };

    const isIntroStep = step < STEPS.length;
    const isNameStep = step === STEPS.length;
    const isBleStep = step === STEPS.length + 1;

    return (
        <SafeAreaView className="flex-1 bg-[#FAF6F1]" style={{ flex: 1, backgroundColor: '#FAF6F1' }}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                style={{ flex: 1 }}
            >
                <View className="flex-1 px-8 justify-center items-center" style={{ flex: 1 }}>
                    {/* Progress dots */}
                    <View className="flex-row gap-2 mb-12" style={{ flexDirection: 'row', gap: 8, marginBottom: 48 }}>
                        {[...STEPS, {}, {}].map((_, i) => (
                            <View
                                key={i}
                                className={`h-1.5 rounded-full ${i === step ? 'w-6 bg-[#5C6B3C]' : 'w-1.5 bg-[#D9D2C7]'
                                    }`}
                            />
                        ))}
                    </View>

                    <Animated.View
                        className="items-center w-full"
                        style={{
                            alignItems: 'center',
                            width: '100%',
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }}
                    >
                        {isIntroStep && (
                            <>
                                <View className="w-20 h-20 rounded-full bg-[#E8EDDF] items-center justify-center mb-8">
                                    <Ionicons
                                        name={STEPS[step].icon}
                                        size={36}
                                        color="#5C6B3C"
                                    />
                                </View>
                                <Text className="text-[#2C2C2C] text-2xl font-bold text-center mb-4" style={{ color: '#2C2C2C' }}>
                                    {STEPS[step].title}
                                </Text>
                                <Text className="text-[#7A7A7A] text-base text-center leading-6 mb-12 max-w-xs" style={{ color: '#7A7A7A' }}>
                                    {STEPS[step].subtitle}
                                </Text>
                            </>
                        )}

                        {isNameStep && (
                            <>
                                <View className="w-20 h-20 rounded-full bg-[#E8EDDF] items-center justify-center mb-8">
                                    <Ionicons name="person-outline" size={36} color="#5C6B3C" />
                                </View>
                                <Text className="text-[#2C2C2C] text-2xl font-bold text-center mb-3" style={{ color: '#2C2C2C' }}>
                                    What should we call you?
                                </Text>
                                <Text className="text-[#7A7A7A] text-sm text-center mb-8" style={{ color: '#7A7A7A' }}>
                                    This name is visible to nearby peers
                                </Text>
                                <TextInput
                                    className="bg-white text-[#2C2C2C] text-base w-full rounded-xl px-4 py-3.5 border border-[#E8E2D9] text-center"
                                    placeholder={identity?.displayName ?? 'Enter your name'}
                                    placeholderTextColor="#A0977D"
                                    value={name}
                                    onChangeText={setName}
                                    maxLength={20}
                                    autoFocus
                                />
                            </>
                        )}

                        {isBleStep && (
                            <>
                                <RadarAnimation isActive={bleGranted} size={160} />
                                <Text className="text-[#2C2C2C] text-2xl font-bold text-center mb-3 mt-8" style={{ color: '#2C2C2C' }}>
                                    Enable Bluetooth
                                </Text>
                                <Text className="text-[#7A7A7A] text-sm text-center mb-8 max-w-xs" style={{ color: '#7A7A7A' }}>
                                    Meshlink needs Bluetooth to discover and communicate with
                                    nearby devices
                                </Text>
                                {!bleGranted && (
                                    <TouchableOpacity
                                        onPress={handleGrantBle}
                                        className="bg-[#5C6B3C] rounded-xl px-8 py-3.5"
                                        disabled={isLoading}
                                        style={{
                                            shadowColor: '#5C6B3C',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        }}
                                    >
                                        <Text className="text-white font-semibold text-base" style={{ color: 'white' }}>
                                            {isLoading ? 'Requesting…' : 'Grant Permission'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {bleGranted && (
                                    <View className="flex-row items-center">
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={20}
                                            color="#4A7C59"
                                        />
                                        <Text className="text-[#4A7C59] ml-2 font-medium" style={{ color: '#4A7C59' }}>
                                            Bluetooth ready!
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}
                    </Animated.View>
                </View>

                {/* Bottom button */}
                <View className="px-8 pb-8">
                    {isIntroStep && (
                        <TouchableOpacity
                            onPress={handleNext}
                            className="bg-[#5C6B3C] rounded-xl py-4 items-center"
                            style={{
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                        >
                            <Text className="text-white font-semibold text-base" style={{ color: 'white' }}>
                                {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {isNameStep && (
                        <TouchableOpacity
                            onPress={() => animateTransition(STEPS.length + 1)}
                            className={`rounded-xl py-4 items-center ${name.trim() ? 'bg-[#5C6B3C]' : 'bg-[#D9D2C7]'
                                }`}
                            disabled={!name.trim()}
                            style={name.trim() ? {
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            } : undefined}
                        >
                            <Text
                                className={`font-semibold text-base ${name.trim() ? 'text-white' : 'text-[#A0977D]'
                                    }`}
                            >
                                Continue
                            </Text>
                        </TouchableOpacity>
                    )}
                    {isBleStep && (
                        <TouchableOpacity
                            onPress={handleFinish}
                            disabled={!bleGranted}
                            className={`rounded-xl py-4 items-center ${bleGranted ? 'bg-[#5C6B3C]' : 'bg-[#D9D2C7]'
                                }`}
                            style={bleGranted ? {
                                shadowColor: '#5C6B3C',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            } : undefined}
                        >
                            <Text
                                className={`font-semibold text-base ${bleGranted ? 'text-white' : 'text-[#7A7A7A]'
                                    }`}
                            >
                                {bleGranted ? 'Enter Meshlink' : 'Enable Bluetooth to continue'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
