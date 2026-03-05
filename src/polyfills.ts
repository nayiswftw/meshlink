/**
 * Dedicated polyfills initialization file.
 * Must be imported at the very top of the app entry point (e.g., _layout.tsx)
 * to ensure global APIs are available before any components or libraries load.
 */

// Provides `crypto.getRandomValues` globally for libraries like TweetNaCl and uuid
import 'react-native-get-random-values';

// Provides `Buffer` globally for libraries expecting Node.js Buffer
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}
