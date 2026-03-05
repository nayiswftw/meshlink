/**
 * BleManager — Singleton wrapper for react-native-ble-plx.
 *
 * Handles scanning, advertising, connections, and data transfer.
 * Gracefully degrades to no-op when running in Expo Go (without native modules).
 */
import { Buffer } from 'buffer';
import { Platform, Linking } from 'react-native';
import { createLogger } from '../Logger';

const log = createLogger('BLE');
import {
    MESHLINK_SERVICE_UUID,
    MESSAGE_CHAR_UUID,
    IDENTITY_CHAR_UUID,
    ACK_CHAR_UUID,
    BLE_SCAN_DURATION_MS,
    BLE_SCAN_INTERVAL_MS,
    BLE_MTU_SIZE,
    BLE_CONNECTION_TIMEOUT_MS,
} from '../../constants';
import { requestBlePermissions } from './BlePermissions';
import {
    chunkMessage,
    serializePacket,
    deserializePacket,
    PacketReassembler,
} from './GattProtocol';
import type { BlePacket, Peer, PeerConnectionState } from '../../types';

// ─── Event listener types ────────────────────────────────────────

export type OnPeerDiscoveredCallback = (device: any) => void;
export type OnPeerConnectedCallback = (deviceId: string) => void;
export type OnPeerDisconnectedCallback = (deviceId: string) => void;
export type OnDataReceivedCallback = (deviceId: string, data: Uint8Array) => void;
export type OnBleStateChangedCallback = (powered: boolean) => void;

// ─── Singleton Class ─────────────────────────────────────────────

class BleManagerService {
    private manager: any = null;
    private bleAvailable = false;
    private isScanning = false;
    private connectedDevices: Map<string, any> = new Map();
    private reassembler = new PacketReassembler();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;
    private scanCycleTimeout: ReturnType<typeof setTimeout> | null = null;
    private isCyclingScan = false;
    private stateSubscription: any = null;
    private BleState: any = null; // cached reference to ble-plx State enum

    // Event listeners
    private onPeerDiscovered: OnPeerDiscoveredCallback | null = null;
    private onPeerConnected: OnPeerConnectedCallback | null = null;
    private onPeerDisconnected: OnPeerDisconnectedCallback | null = null;
    private onDataReceived: OnDataReceivedCallback | null = null;
    private onBleStateChanged: OnBleStateChangedCallback | null = null;

    // ─── Initialise ─────────────────────────────────────────────

    /**
     * Create the BLE manager, request permissions, and set up
     * a **persistent** state listener that tracks Bluetooth on/off.
     *
     * Returns true if BLE is currently powered on.
     */
    async init(): Promise<boolean> {
        // If we already have a running manager, just return current state
        if (this.manager) return this.bleAvailable;

        const permissionsGranted = await requestBlePermissions();
        if (!permissionsGranted) return false;

        try {
            const { BleManager: RNBleManager, State } = require('react-native-ble-plx');
            this.manager = new RNBleManager();
            this.BleState = State;

            // Set up persistent state monitoring
            this.startStateMonitoring();

            // Wait for the initial state to be determined
            return new Promise<boolean>((resolve) => {
                let resolved = false;
                const resolveOnce = (value: boolean) => {
                    if (resolved) return;
                    resolved = true;
                    resolve(value);
                };

                // Check current state immediately
                this.manager.state().then((currentState: any) => {
                    const powered = currentState === State.PoweredOn;
                    this.bleAvailable = powered;
                    this.onBleStateChanged?.(powered);
                    resolveOnce(powered);
                }).catch(() => {
                    resolveOnce(false);
                });

                // Timeout fallback
                setTimeout(() => {
                    resolveOnce(this.bleAvailable);
                }, 5_000);
            });
        } catch (error) {
            log.warn('react-native-ble-plx not available (Expo Go?). BLE features disabled.');
            this.bleAvailable = false;
            return false;
        }
    }

    /**
     * Prompt the user to enable Bluetooth.
     * On Android: shows the system "Turn on Bluetooth?" dialog.
     * On iOS: opens Settings since iOS doesn't allow programmatic enable.
     *
     * Ensures manager is created first, then requests enable.
     * The persistent state listener will pick up the change automatically.
     */
    async requestEnable(): Promise<void> {
        // Try to init if not already done. This might fail if permissions are missing.
        if (!this.manager) {
            await this.init();
        }

        if (this.bleAvailable) return; // Already on, nothing to do

        const openAppSettings = () => {
            if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:').catch(() => {
                    Linking.openSettings();
                });
            } else {
                Linking.openSettings();
            }
        };

        const openBluetoothSettings = () => {
            if (Platform.OS === 'ios') {
                Linking.openURL('App-Prefs:Bluetooth').catch(() => {
                    openAppSettings();
                });
            } else {
                Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
                    openAppSettings();
                });
            }
        };

        if (!this.manager) {
            // Either ble-plx is completely unavailable, or we lack OS permissions (Nearby Devices).
            // We must refer them to App Settings so they can grant the missing permission.
            log.warn('requestEnable: manager is null. Opening app settings for permissions.');
            openAppSettings();
            return;
        }

        // User explicitly wants to open the Bluetooth settings page directly,
        // rather than using the system turn-on dialog.
        log.info('requestEnable: Opening system Bluetooth settings.');
        openBluetoothSettings();
    }

    // ─── Persistent State Monitoring ────────────────────────────

    /**
     * Subscribe to BLE adapter state changes for the lifetime of the app.
     * This is what makes the UI reactive — when the user toggles Bluetooth
     * in system settings, this fires and updates `bleAvailable` + notifies
     * the context via `onBleStateChanged`.
     */
    private startStateMonitoring(): void {
        if (this.stateSubscription || !this.manager || !this.BleState) return;

        this.stateSubscription = this.manager.onStateChange((state: any) => {
            const wasPowered = this.bleAvailable;
            const isPowered = state === this.BleState.PoweredOn;

            this.bleAvailable = isPowered;

            // Only fire callback on actual change
            if (isPowered !== wasPowered) {
                log.info(`Bluetooth state changed: ${isPowered ? 'ON' : 'OFF'}`);
                this.onBleStateChanged?.(isPowered);
            }

            // If BLE just turned off, stop scanning and clean up connections
            if (!isPowered && wasPowered) {
                this.stopScan();
                this.connectedDevices.clear();
            }
        }, true); // `true` = emit current state immediately
    }

    /**
     * Manually check and sync current Bluetooth state.
     * Useful when returning to the foreground in case the listener missed an event.
     */
    async checkState(): Promise<boolean> {
        if (!this.manager || !this.BleState) return this.bleAvailable;
        try {
            const state = await this.manager.state();
            const isPowered = state === this.BleState.PoweredOn;

            if (isPowered !== this.bleAvailable) {
                this.bleAvailable = isPowered;
                log.info(`Sync: Bluetooth state changed to: ${isPowered ? 'ON' : 'OFF'}`);
                this.onBleStateChanged?.(isPowered);

                if (!isPowered) {
                    this.stopScan();
                    this.connectedDevices.clear();
                }
            }
            return isPowered;
        } catch {
            return this.bleAvailable;
        }
    }

    private stopStateMonitoring(): void {
        if (this.stateSubscription) {
            this.stateSubscription.remove();
            this.stateSubscription = null;
        }
    }

    // ─── Scanning ───────────────────────────────────────────────

    /**
     * Start continuous scan cycling: scan for BLE_SCAN_DURATION_MS,
     * pause for BLE_SCAN_INTERVAL_MS, repeat. Call stopScan() to stop.
     */
    async startScan(): Promise<void> {
        if (!this.manager || !this.bleAvailable) return;
        if (this.isCyclingScan) return; // already cycling
        this.isCyclingScan = true;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => {
            this.reassembler.cleanup();
        }, 10_000);

        this.runScanCycle();
    }

    private runScanCycle(): void {
        if (!this.isCyclingScan || !this.manager || !this.bleAvailable) {
            this.isCyclingScan = false;
            return;
        }

        this.isScanning = true;
        log.info('Scan cycle started');

        this.manager.startDeviceScan(
            [MESHLINK_SERVICE_UUID],
            { allowDuplicates: true },
            (error: any, device: any) => {
                if (error) {
                    log.warn('Scan error:', error.message);
                    return;
                }

                if (device) {
                    this.onPeerDiscovered?.(device);
                }
            }
        );

        // Stop after scan duration, then pause and restart
        this.scanCycleTimeout = setTimeout(() => {
            this.stopDeviceScan();
            this.isScanning = false;

            if (!this.isCyclingScan) return;

            log.info('Scan cycle paused, restarting after interval');
            this.scanCycleTimeout = setTimeout(() => {
                this.runScanCycle();
            }, BLE_SCAN_INTERVAL_MS);
        }, BLE_SCAN_DURATION_MS);
    }

    private stopDeviceScan(): void {
        if (!this.manager) return;
        try {
            this.manager.stopDeviceScan();
        } catch { }
    }

    stopScan(): void {
        this.isCyclingScan = false;
        this.stopDeviceScan();
        this.isScanning = false;

        if (this.scanCycleTimeout) {
            clearTimeout(this.scanCycleTimeout);
            this.scanCycleTimeout = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    getIsScanning(): boolean {
        return this.isScanning;
    }

    isBleAvailable(): boolean {
        return this.bleAvailable;
    }

    // ─── Connection ─────────────────────────────────────────────

    async connectToDevice(deviceId: string): Promise<boolean> {
        if (!this.manager || !this.bleAvailable) return false;
        if (this.connectedDevices.has(deviceId)) return true;

        try {
            const device = await this.manager.connectToDevice(deviceId, {
                timeout: BLE_CONNECTION_TIMEOUT_MS,
                requestMTU: BLE_MTU_SIZE,
            });

            await device.discoverAllServicesAndCharacteristics();
            this.connectedDevices.set(deviceId, device);
            this.onPeerConnected?.(deviceId);

            this.manager.onDeviceDisconnected(deviceId, () => {
                this.connectedDevices.delete(deviceId);
                this.onPeerDisconnected?.(deviceId);
            });

            device.monitorCharacteristicForService(
                MESHLINK_SERVICE_UUID,
                MESSAGE_CHAR_UUID,
                (error: any, characteristic: any) => {
                    if (error) {
                        log.warn('Monitor error:', error.message);
                        return;
                    }
                    if (characteristic?.value) {
                        const raw = Buffer.from(characteristic.value, 'base64');
                        const packet = deserializePacket(new Uint8Array(raw));
                        const reassembled = this.reassembler.addPacket(packet);
                        if (reassembled) {
                            this.onDataReceived?.(deviceId, reassembled);
                        }
                    }
                }
            );

            return true;
        } catch (error: any) {
            log.warn('Connection error:', error?.message);
            return false;
        }
    }

    async disconnectDevice(deviceId: string): Promise<void> {
        if (!this.manager) return;
        try {
            await this.manager.cancelDeviceConnection(deviceId);
        } catch { }
        this.connectedDevices.delete(deviceId);
    }

    // ─── Data Transfer ──────────────────────────────────────────

    async sendData(
        deviceId: string,
        messageId: string,
        data: Uint8Array,
        isRelay: boolean = false
    ): Promise<boolean> {
        const device = this.connectedDevices.get(deviceId);
        if (!device) return false;

        const packets = chunkMessage(messageId, data, isRelay);

        try {
            for (const packet of packets) {
                const serialized = serializePacket(packet);
                const base64 = Buffer.from(serialized).toString('base64');
                await device.writeCharacteristicWithResponseForService(
                    MESHLINK_SERVICE_UUID,
                    MESSAGE_CHAR_UUID,
                    base64
                );
            }
            return true;
        } catch (error: any) {
            log.warn('Send error:', error?.message);
            return false;
        }
    }

    async readIdentity(deviceId: string): Promise<string | null> {
        const device = this.connectedDevices.get(deviceId);
        if (!device) return null;

        try {
            const characteristic = await device.readCharacteristicForService(
                MESHLINK_SERVICE_UUID,
                IDENTITY_CHAR_UUID
            );
            if (characteristic?.value) {
                return Buffer.from(characteristic.value, 'base64').toString('utf-8');
            }
            return null;
        } catch (error: any) {
            log.warn('Read identity error:', error?.message);
            return null;
        }
    }

    // ─── Event Registration ─────────────────────────────────────

    setOnPeerDiscovered(cb: OnPeerDiscoveredCallback | null): void {
        this.onPeerDiscovered = cb;
    }

    setOnPeerConnected(cb: OnPeerConnectedCallback | null): void {
        this.onPeerConnected = cb;
    }

    setOnPeerDisconnected(cb: OnPeerDisconnectedCallback | null): void {
        this.onPeerDisconnected = cb;
    }

    setOnDataReceived(cb: OnDataReceivedCallback | null): void {
        this.onDataReceived = cb;
    }

    setOnBleStateChanged(cb: OnBleStateChangedCallback | null): void {
        this.onBleStateChanged = cb;
    }

    // ─── Utilities ──────────────────────────────────────────────

    getConnectedDeviceIds(): string[] {
        return Array.from(this.connectedDevices.keys());
    }

    isDeviceConnected(deviceId: string): boolean {
        return this.connectedDevices.has(deviceId);
    }

    // ─── Cleanup ────────────────────────────────────────────────

    destroy(): void {
        this.stopScan();
        this.stopStateMonitoring();
        for (const deviceId of this.connectedDevices.keys()) {
            this.disconnectDevice(deviceId);
        }
        this.connectedDevices.clear();
        try {
            this.manager?.destroy();
        } catch { }
        this.manager = null;
        this.bleAvailable = false;
    }
}

export const bleManager = new BleManagerService();
