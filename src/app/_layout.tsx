/**
 * Root layout — Wraps the entire app with MeshProvider.
 */
import '../polyfills'; // Must be the absolute first import
import '../global.css';

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MeshProvider } from '../context/MeshContext';
import { ToastProvider } from '../context/ToastContext';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <MeshProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#F9FAFB' },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="chat/[peerId]"
              options={{ headerShown: true }}
            />
            <Stack.Screen
              name="channel/[channelName]"
              options={{ headerShown: true }}
            />
          </Stack>
        </MeshProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
