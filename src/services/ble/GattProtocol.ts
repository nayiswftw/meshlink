/**
 * GattProtocol — Packet framing, chunking, and reassembly for BLE transport.
 */
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import {
    BLE_MAX_PAYLOAD_SIZE,
    BLE_PACKET_HEADER_SIZE,
} from '../../constants';
import { BlePacket, PacketFlags } from '../../types';

// ─── Packet Header Layout (20 bytes) ────────────────────────────
// [0..15]  messageId   (16 bytes — UUID as raw bytes)
// [16]     chunkIndex  (1 byte  — 0-255)
// [17]     totalChunks (1 byte  — 1-255)
// [18]     flags       (1 byte  — bitfield)
// [19]     reserved    (1 byte)

/**
 * Split a message payload into BLE-friendly chunks.
 */
export function chunkMessage(
    messageId: string,
    data: Uint8Array,
    isRelay: boolean = false
): BlePacket[] {
    const totalChunks = Math.ceil(data.length / BLE_MAX_PAYLOAD_SIZE) || 1;
    const packets: BlePacket[] = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * BLE_MAX_PAYLOAD_SIZE;
        const end = Math.min(start + BLE_MAX_PAYLOAD_SIZE, data.length);
        const payload = data.slice(start, end);

        let flags: number = PacketFlags.NONE;
        if (i === 0) flags |= PacketFlags.FIRST;
        if (i === totalChunks - 1) flags |= PacketFlags.LAST;
        if (isRelay) flags |= PacketFlags.IS_RELAY;

        packets.push({
            messageId,
            chunkIndex: i,
            totalChunks,
            payload,
            flags: flags as PacketFlags,
        });
    }

    return packets;
}

/**
 * Serialize a BlePacket into a raw byte buffer for BLE transmission.
 */
export function serializePacket(packet: BlePacket): Uint8Array {
    const header = new Uint8Array(BLE_PACKET_HEADER_SIZE);
    // Write messageId as 16 raw bytes (strip hyphens, hex → bytes)
    const idHex = packet.messageId.replace(/-/g, '');
    for (let i = 0; i < 16; i++) {
        header[i] = parseInt(idHex.substring(i * 2, i * 2 + 2), 16);
    }
    header[16] = packet.chunkIndex;
    header[17] = packet.totalChunks;
    header[18] = packet.flags;
    header[19] = 0; // reserved

    const result = new Uint8Array(BLE_PACKET_HEADER_SIZE + packet.payload.length);
    result.set(header, 0);
    result.set(packet.payload, BLE_PACKET_HEADER_SIZE);
    return result;
}

/**
 * Deserialize raw bytes from BLE into a BlePacket.
 */
export function deserializePacket(raw: Uint8Array): BlePacket {
    if (raw.length < BLE_PACKET_HEADER_SIZE) {
        throw new Error(`Packet too short: ${raw.length} bytes`);
    }

    // Read messageId (16 bytes → UUID string)
    const idBytes = raw.slice(0, 16);
    const hex = Array.from(idBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const messageId = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('-');

    return {
        messageId,
        chunkIndex: raw[16],
        totalChunks: raw[17],
        flags: raw[18] as PacketFlags,
        payload: raw.slice(BLE_PACKET_HEADER_SIZE),
    };
}

// ─── Reassembly Buffer ──────────────────────────────────────────

interface ReassemblyEntry {
    chunks: Map<number, Uint8Array>;
    totalChunks: number;
    createdAt: number;
}

const REASSEMBLY_TIMEOUT_MS = 30_000; // 30 seconds to receive all chunks

export class PacketReassembler {
    private buffer: Map<string, ReassemblyEntry> = new Map();

    /**
     * Add a received packet. Returns the full reassembled payload
     * if all chunks have been received, otherwise null.
     */
    addPacket(packet: BlePacket): Uint8Array | null {
        let entry = this.buffer.get(packet.messageId);

        if (!entry) {
            entry = {
                chunks: new Map(),
                totalChunks: packet.totalChunks,
                createdAt: Date.now(),
            };
            this.buffer.set(packet.messageId, entry);
        }

        entry.chunks.set(packet.chunkIndex, packet.payload);

        // Check if all chunks received
        if (entry.chunks.size === entry.totalChunks) {
            // Reassemble
            const totalSize = Array.from(entry.chunks.values()).reduce(
                (sum, chunk) => sum + chunk.length,
                0
            );
            const result = new Uint8Array(totalSize);
            let offset = 0;
            for (let i = 0; i < entry.totalChunks; i++) {
                const chunk = entry.chunks.get(i);
                if (!chunk) throw new Error(`Missing chunk ${i} for ${packet.messageId}`);
                result.set(chunk, offset);
                offset += chunk.length;
            }

            this.buffer.delete(packet.messageId);
            return result;
        }

        return null;
    }

    /**
     * Clean up stale reassembly entries.
     */
    cleanup(): void {
        const now = Date.now();
        for (const [id, entry] of this.buffer.entries()) {
            if (now - entry.createdAt > REASSEMBLY_TIMEOUT_MS) {
                this.buffer.delete(id);
            }
        }
    }
}
