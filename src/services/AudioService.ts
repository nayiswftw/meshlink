/**
 * AudioService — Recording, compression, and playback for voice messages.
 * Uses expo-audio. Audio is exported as base64-encoded data for BLE transmission.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { requestRecordingPermissionsAsync, AudioModule } from 'expo-audio';
import { createLogger } from './Logger';

const log = createLogger('Audio');

const MAX_DURATION_MS = 15_000; // 15 seconds max
const AUDIO_PREFIX = '__AUDIO__';

// ─── Recording ───────────────────────────────────────────────────

let activeRecording: any = null;

export async function requestAudioPermissions(): Promise<boolean> {
    try {
        const response = await requestRecordingPermissionsAsync();
        return response.granted;
    } catch (e) {
        log.error('Failed to request audio permissions:', e);
        return false;
    }
}

export async function startRecording(): Promise<void> {
    const permissions = await requestRecordingPermissionsAsync();
    if (!permissions.granted) return;

    activeRecording = new AudioModule.AudioRecorder({
        isMeteringEnabled: false,
    });
    
    await activeRecording.prepareToRecordAsync();
    activeRecording.record();
    log.info('Recording started');

    // Auto-stop after max duration
    const ref = activeRecording;
    setTimeout(async () => {
        if (activeRecording === ref) {
            await stopRecording();
        }
    }, MAX_DURATION_MS);
}

export async function stopRecording(): Promise<string | null> {
    if (!activeRecording) return null;

    const recording = activeRecording;
    activeRecording = null;

    try {
        await recording.stop();
        const uri = recording.uri;
        if (!uri) return null;

        // Read the file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Cleanup temp file
        await FileSystem.deleteAsync(uri, { idempotent: true });

        log.info(`Recording complete (${Math.round(base64.length / 1024)}KB)`);
        return base64;
    } catch (error) {
        log.error('Failed to stop recording:', error);
        return null;
    }
}

export function cancelRecording(): void {
    if (activeRecording) {
        activeRecording.stop();
        activeRecording = null;
        log.info('Recording cancelled');
    }
}

export function isRecording(): boolean {
    return activeRecording !== null;
}

// ─── Playback ────────────────────────────────────────────────────

const activePlayers = new Map<string, any>();

export async function playAudio(base64Data: string, messageId: string, onComplete?: () => void): Promise<void> {
    // Stop any existing playback for this message
    await stopAudio(messageId);

    try {
        const tempUri = `${FileSystem.cacheDirectory}voice_${messageId}.m4a`;
        await FileSystem.writeAsStringAsync(tempUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
        });

        const player = new AudioModule.AudioPlayer(tempUri, 500, false, 0);
        activePlayers.set(messageId, player);

        player.addListener('playbackStatusUpdate', (status: { didJustFinish: boolean }) => {
            if (status.didJustFinish) {
                stopAudio(messageId);
                onComplete?.();
            }
        });

        player.play();
    } catch (error) {
        log.error('Playback failed:', error);
        onComplete?.();
    }
}

export async function stopAudio(messageId: string): Promise<void> {
    const player = activePlayers.get(messageId);
    if (player) {
        try {
            player.pause();
            player.remove();
        } catch { /* ignored */ }
        activePlayers.delete(messageId);
    }
}

// ─── Encoding / Decoding ─────────────────────────────────────────

export function encodeAudioMessage(base64Audio: string): string {
    return `${AUDIO_PREFIX}${base64Audio}`;
}

export function decodeAudioMessage(content: string): string {
    return content.slice(AUDIO_PREFIX.length);
}

export function isAudioMessage(content: string): boolean {
    return content.startsWith(AUDIO_PREFIX);
}
