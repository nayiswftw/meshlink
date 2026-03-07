/**
 * Onboarding — First launch setup: intro slides, BT permission, and name input.
 * expo-bitchat handles BLE mesh networking natively.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Animated,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../context/MeshContext';
import { setOnboardingComplete } from '../services/storage/AppState';
import { requestBluetoothPermissions, type PermissionStatus } from '../services/Permissions';
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
    const { nickname, updateSettings } = useMesh();
    const [step, setStep] = useState(0);
    const [name, setName] = useState(nickname || '');
    const [permStatus, setPermStatus] = useState<PermissionStatus | null>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

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

    // Prevent Android back button from leaving onboarding
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step > 0) {
                animateTransition(step - 1);
            }
            return true; // Always consume — don't exit during onboarding
        });
        return () => sub.remove();
    });

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            animateTransition(step + 1);
        } else {
            animateTransition(STEPS.length); // permission step
        }
    };

    const handlePermission = async () => {
        const status = await requestBluetoothPermissions();
        setPermStatus(status);
        if (status === 'granted') {
            // Auto-advance after a short delay so user sees the success state
            setTimeout(() => animateTransition(STEPS.length + 1), 600);
        }
    };

    const handleFinish = () => {
        const trimmed = name.trim();
        if (!trimmed) return; // Name is required
        updateSettings({ displayName: trimmed, onboardingComplete: true });
        setOnboardingComplete();
        router.replace('/(tabs)/chats');
    };

    const isIntroStep = step < STEPS.length;
    const isPermissionStep = step === STEPS.length;
    const isNameStep = step === STEPS.length + 1;

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
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
                                className={`h-1.5 rounded-full ${i === step ? 'w-6 bg-[#059669]' : 'w-1.5 bg-[#E5E7EB]'
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
                                <View className="w-16 h-16 rounded-2xl bg-[#ECFDF5] items-center justify-center mb-8">
                                    <Ionicons
                                        name={STEPS[step].icon}
                                        size={32}
                                        color="#059669"
                                    />
                                </View>
                                <Text className="text-[#111827] text-2xl font-bold text-center mb-4" style={{ color: '#111827' }}>
                                    {STEPS[step].title}
                                </Text>
                                <Text className="text-[#6B7280] text-base text-center leading-6 mb-12 max-w-xs" style={{ color: '#6B7280' }}>
                                    {STEPS[step].subtitle}
                                </Text>
                            </>
                        )}

                        {isPermissionStep && (
                            <>
                                <View className="w-16 h-16 rounded-2xl bg-[#ECFDF5] items-center justify-center mb-8">
                                    <Ionicons name="bluetooth-outline" size={32} color="#059669" />
                                </View>
                                <Text
                                    className="text-[#111827] text-2xl font-bold text-center mb-3"
                                    style={{ color: '#111827' }}
                                    accessibilityRole="header"
                                >
                                    Enable Bluetooth
                                </Text>
                                <Text
                                    className="text-[#6B7280] text-sm text-center mb-8 max-w-xs"
                                    style={{ color: '#6B7280' }}
                                >
                                    Meshlink needs Bluetooth to discover nearby devices and relay messages securely.
                                </Text>
                                {permStatus === 'granted' && (
                                    <View className="flex-row items-center bg-[#ECFDF5] rounded-xl px-4 py-3 mb-4">
                                        <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                                        <Text className="text-[#059669] text-sm font-medium ml-2">
                                            Bluetooth permission granted
                                        </Text>
                                    </View>
                                )}
                                {permStatus === 'blocked' && (
                                    <View className="flex-row items-center bg-[#FEF2F2] rounded-xl px-4 py-3 mb-4">
                                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                        <Text className="text-[#EF4444] text-sm font-medium ml-2">
                                            Permission blocked — enable in device Settings
                                        </Text>
                                    </View>
                                )}
                                {permStatus === 'denied' && (
                                    <View className="flex-row items-center bg-[#2A2515] rounded-xl px-4 py-3 mb-4">
                                        <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                                        <Text className="text-[#FCD34D] text-sm font-medium ml-2">
                                            Permission denied — tap below to try again
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}

                        {isNameStep && (
                            <>
                                <View className="w-16 h-16 rounded-2xl bg-[#ECFDF5] items-center justify-center mb-8">
                                    <Ionicons name="person-outline" size={32} color="#059669" />
                                </View>
                                <Text className="text-[#111827] text-2xl font-bold text-center mb-3" style={{ color: '#111827' }}>
                                    What should we call you?
                                </Text>
                                <Text className="text-[#6B7280] text-sm text-center mb-8" style={{ color: '#6B7280' }}>
                                    This name is visible to nearby peers
                                </Text>
                                <TextInput
                                    className="bg-[#FFFFFF] text-[#111827] text-base w-full rounded-xl px-4 py-3.5 border border-[#E5E7EB] text-center"
                                    placeholder="Enter your name"
                                    placeholderTextColor="#9CA3AF"
                                    value={name}
                                    onChangeText={setName}
                                    maxLength={20}
                                    autoFocus
                                />
                            </>
                        )}
                    </Animated.View>
                </View>

                {/* Bottom button */}
                <View className="px-8 pb-8">
                    {isIntroStep && (
                        <TouchableOpacity
                            onPress={handleNext}
                            accessibilityRole="button"
                            accessibilityLabel={step === STEPS.length - 1 ? 'Get Started' : 'Next'}
                            className="bg-[#059669] rounded-xl py-4 items-center"
                        >
                            <Text className="text-white font-semibold text-base" style={{ color: 'white' }}>
                                {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {isPermissionStep && (
                        <View>
                            {permStatus !== 'granted' && (
                                <TouchableOpacity
                                    onPress={handlePermission}
                                    accessibilityRole="button"
                                    accessibilityLabel="Allow Bluetooth access"
                                    className="bg-[#059669] rounded-xl py-4 items-center mb-3"
                                >
                                    <Text className="text-white font-semibold text-base">
                                        Allow Bluetooth
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => animateTransition(STEPS.length + 1)}
                                accessibilityRole="button"
                                accessibilityLabel={permStatus === 'granted' ? 'Continue' : 'Skip for now'}
                                className={
                                    permStatus === 'granted'
                                        ? 'bg-[#059669] rounded-xl py-4 items-center'
                                        : 'py-4 items-center'
                                }
                            >
                                <Text
                                    className={
                                        permStatus === 'granted'
                                            ? 'text-white font-semibold text-base'
                                            : 'text-[#6B7280] text-sm'
                                    }
                                >
                                    {permStatus === 'granted' ? 'Continue' : 'Skip for now'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {isNameStep && (
                        <TouchableOpacity
                            onPress={handleFinish}
                            className={`rounded-xl py-4 items-center ${name.trim() ? 'bg-[#059669]' : 'bg-[#E5E7EB]'
                                }`}
                            disabled={!name.trim()}
                        >
                            <Text
                                    className={`font-semibold text-base ${name.trim() ? 'text-white' : 'text-[#6B7280]'
                                    }`}
                            >
                                {name.trim() ? 'Enter Meshlink' : 'Enter a name to continue'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
