/**
 * Index — Entry point redirect.
 * Routes to onboarding if first launch, otherwise to the tabs.
 * Waits for MeshContext to finish hydration before redirecting.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useMesh } from '../context/MeshContext';
import { isOnboardingComplete } from '../services/storage/AppState';

export default function Index() {
  const { isInitialised } = useMesh();

  useEffect(() => {
    if (!isInitialised) return; // Wait for hydration to complete

    if (isOnboardingComplete()) {
      router.replace('/(tabs)/peers');
    } else {
      router.replace('/onboarding');
    }
  }, [isInitialised]);

  return (
    <View className="flex-1 bg-[#FAF6F1] items-center justify-center">
      <ActivityIndicator size="large" color="#5C6B3C" />
    </View>
  );
}
