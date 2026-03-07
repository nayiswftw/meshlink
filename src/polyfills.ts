/**
 * Polyfills initialization file.
 * Must be imported at the very top of the app entry point (_layout.tsx).
 *
 * expo-bitchat handles all BLE/crypto natively, so we only need
 * minimal polyfills for any remaining JS-side dependencies.
 */

// react-native-get-random-values provides crypto.getRandomValues for uuid
import 'react-native-get-random-values';
