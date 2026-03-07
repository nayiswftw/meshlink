/**
 * ToastContext — Lightweight toast notification system.
 * Provides showToast(message, type) for error/success/info feedback.
 */
import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'error' | 'success' | 'info';

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const TOAST_CONFIG: Record<
    ToastType,
    {
        bg: string;
        border: string;
        icon: keyof typeof Ionicons.glyphMap;
        iconColor: string;
        textColor: string;
    }
> = {
    error: {
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: 'alert-circle',
        iconColor: '#B85C4A',
        textColor: '#7F1D1D',
    },
    success: {
        bg: '#F0FDF4',
        border: '#BBF7D0',
        icon: 'checkmark-circle',
        iconColor: '#4A7C59',
        textColor: '#14532D',
    },
    info: {
        bg: '#EFF6FF',
        border: '#BFDBFE',
        icon: 'information-circle',
        iconColor: '#6B8FA3',
        textColor: '#1E3A5F',
    },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    const [toast, setToast] = useState<{
        message: string;
        type: ToastType;
    } | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const showToast = useCallback(
        (message: string, type: ToastType = 'error') => {
            if (timerRef.current) clearTimeout(timerRef.current);

            setToast({ message, type });
            opacity.setValue(0);
            translateY.setValue(-20);

            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            timerRef.current = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -20,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]).start(() => setToast(null));
            }, 3500);
        },
        [opacity, translateY]
    );

    // Clean up timer on unmount
    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const config = toast ? TOAST_CONFIG[toast.type] : null;

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && config && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: insets.top + 8,
                        left: 16,
                        right: 16,
                        opacity,
                        transform: [{ translateY }],
                        zIndex: 9999,
                    }}
                    pointerEvents="none"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                >
                    <View
                        style={{
                            backgroundColor: config.bg,
                            borderWidth: 1,
                            borderColor: config.border,
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                    >
                        <Ionicons
                            name={config.icon}
                            size={20}
                            color={config.iconColor}
                        />
                        <Text
                            style={{
                                color: config.textColor,
                                fontSize: 14,
                                fontWeight: '500',
                                marginLeft: 10,
                                flex: 1,
                            }}
                        >
                            {toast.message}
                        </Text>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextType {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return ctx;
}
