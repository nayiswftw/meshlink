/**
 * BleAdvertiser — Makes this device discoverable to other Meshlink devices.
 *
 * Uses munim-bluetooth-peripheral to act as a BLE Peripheral:
 * - Sets up a GATT service with MESHLINK_SERVICE_UUID
 * - Advertises the service UUID so scanners can find us
 * - Exposes an Identity characteristic so connected peers can read who we are
 *
 * Gracefully degrades to no-op if the native module is unavailable (e.g. Expo Go).
 */
import { Buffer } from 'buffer';
import { createLogger } from '../Logger';
import {
    MESHLINK_SERVICE_UUID,
    IDENTITY_CHAR_UUID,
    MESSAGE_CHAR_UUID,
    ACK_CHAR_UUID,
} from '../../constants';
import type { DeviceIdentity } from '../../types';

const log = createLogger('BLE-Adv');

class BleAdvertiserService {
    private isAdvertising = false;
    private available = false;

    /**
     * Start the GATT server and begin advertising the Meshlink service.
     * The identity characteristic is populated so other devices can read
     * our id, publicKey, and displayName after connecting.
     */
    async start(identity: DeviceIdentity): Promise<void> {
        if (this.isAdvertising) return;

        try {
            const {
                startAdvertising,
                stopAdvertising,
                setServices,
            } = require('munim-bluetooth-peripheral');

            this.available = true;

            // Encode identity as Base64 for the characteristic value
            const identityJson = JSON.stringify({
                id: identity.id,
                publicKey: identity.publicKey,
                displayName: identity.displayName,
            });
            const identityBase64 = Buffer.from(identityJson, 'utf-8').toString('base64');

            // Define the GATT service with characteristics
            await setServices([
                {
                    uuid: MESHLINK_SERVICE_UUID,
                    characteristics: [
                        {
                            uuid: IDENTITY_CHAR_UUID,
                            properties: ['read'],
                            value: identityBase64,
                        },
                        {
                            uuid: MESSAGE_CHAR_UUID,
                            properties: ['read', 'write', 'notify'],
                            value: '',
                        },
                        {
                            uuid: ACK_CHAR_UUID,
                            properties: ['read', 'write', 'notify'],
                            value: '',
                        },
                    ],
                },
            ]);

            // Start advertising the service UUID
            await startAdvertising({
                serviceUUIDs: [MESHLINK_SERVICE_UUID],
                localName: identity.displayName.slice(0, 8),
            });

            this.isAdvertising = true;
            log.info(`Advertising started as "${identity.displayName}"`);
        } catch (error: any) {
            log.warn('Failed to start advertising:', error?.message ?? error);
            this.available = false;
        }
    }

    /**
     * Stop advertising and tear down the GATT server.
     */
    async stop(): Promise<void> {
        if (!this.isAdvertising || !this.available) return;

        try {
            const { stopAdvertising } = require('munim-bluetooth-peripheral');
            await stopAdvertising();
            this.isAdvertising = false;
            log.info('Advertising stopped');
        } catch (error: any) {
            log.warn('Failed to stop advertising:', error?.message ?? error);
        }
    }

    getIsAdvertising(): boolean {
        return this.isAdvertising;
    }
}

export const bleAdvertiser = new BleAdvertiserService();
