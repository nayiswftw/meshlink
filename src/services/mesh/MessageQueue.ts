/**
 * MessageQueue — Outbound message queue with retry and store-and-forward.
 */
import { MESSAGE_RETRY_COUNT, MESSAGE_RETRY_DELAY_MS } from '../../constants';
import type { MeshMessage } from '../../types';

interface QueuedMessage {
    message: MeshMessage;
    targetDeviceId: string | null; // null = broadcast to all connected peers
    excludeDeviceId: string | null; // device to exclude from broadcast (prevent echo)
    retryCount: number;
    lastAttempt: number;
}

type SendFunction = (
    deviceId: string,
    messageId: string,
    data: Uint8Array,
    isRelay: boolean
) => Promise<boolean>;

class MessageQueueService {
    private queue: QueuedMessage[] = [];
    private processInterval: ReturnType<typeof setInterval> | null = null;
    private isProcessing = false;
    private sendFn: SendFunction | null = null;
    private encodeFn: ((msg: MeshMessage) => Uint8Array) | null = null;
    private getConnectedDeviceIds: (() => string[]) | null = null;

    /**
     * Configure the queue with send capabilities.
     */
    configure(
        sendFn: SendFunction,
        encodeFn: (msg: MeshMessage) => Uint8Array,
        getConnectedDeviceIds: () => string[]
    ): void {
        this.sendFn = sendFn;
        this.encodeFn = encodeFn;
        this.getConnectedDeviceIds = getConnectedDeviceIds;
    }

    /**
     * Enqueue a message for delivery.
     */
    enqueue(
        message: MeshMessage,
        targetDeviceId: string | null = null,
        excludeDeviceId: string | null = null
    ): void {
        this.queue.push({
            message,
            targetDeviceId,
            excludeDeviceId,
            retryCount: 0,
            lastAttempt: 0,
        });
        // Process immediately
        this.processQueue();
    }

    /**
     * Start periodic queue processing.
     */
    startProcessing(): void {
        if (this.processInterval) return;
        this.processInterval = setInterval(() => {
            this.processQueue();
        }, MESSAGE_RETRY_DELAY_MS);
    }

    /**
     * Stop periodic queue processing.
     */
    stopProcessing(): void {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
    }

    /**
     * Process the queue — attempt to send queued messages.
     * Guarded against concurrent execution.
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) return;
        if (!this.sendFn || !this.encodeFn || !this.getConnectedDeviceIds) return;

        this.isProcessing = true;
        try {
            const connectedDevices = this.getConnectedDeviceIds();
            if (connectedDevices.length === 0) return;

        const toRetry: QueuedMessage[] = [];

        for (const item of this.queue) {
            const now = Date.now();

            // Skip if retried too recently
            if (now - item.lastAttempt < MESSAGE_RETRY_DELAY_MS) {
                toRetry.push(item);
                continue;
            }

            const data = this.encodeFn(item.message);
            let sent = false;

            if (item.targetDeviceId && connectedDevices.includes(item.targetDeviceId)) {
                // Send to specific device
                sent = await this.sendFn(
                    item.targetDeviceId,
                    item.message.id,
                    data,
                    false
                );
            } else if (!item.targetDeviceId) {
                // Broadcast to all connected devices (relay), excluding the sender
                for (const deviceId of connectedDevices) {
                    if (deviceId === item.excludeDeviceId) continue; // prevent echo
                    const result = await this.sendFn(
                        deviceId,
                        item.message.id,
                        data,
                        true
                    );
                    if (result) sent = true;
                }
            }

            if (!sent) {
                item.retryCount++;
                item.lastAttempt = now;

                if (item.retryCount < MESSAGE_RETRY_COUNT) {
                    toRetry.push(item);
                }
                // else: drop after max retries
            }
        }

            this.queue = toRetry;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get number of queued messages.
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Clear the queue.
     */
    clear(): void {
        this.queue = [];
        this.stopProcessing();
    }
}

export const messageQueue = new MessageQueueService();
