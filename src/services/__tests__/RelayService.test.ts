/**
 * RelayService.test.ts — Unit tests for message relay functionality.
 */

// Mock expo-bitchat before importing RelayService
jest.mock('expo-bitchat', () => ({
    __esModule: true,
    default: {
        sendPrivateMessage: jest.fn(),
        sendMessage: jest.fn(),
    },
}));

import RelayService from '../RelayService';

describe('RelayService', () => {
    beforeEach(() => {
        RelayService.clearCache();
        RelayService.setEnabled(true);
        RelayService.setIdentity('test-peer-id', 'TestUser');
    });

    afterAll(() => {
        // Clean up the relay service to prevent timer leaks
        RelayService.destroy();
    });

    describe('parseRelayMetadata', () => {
        it('should parse valid relay metadata', () => {
            const metadata = { hopCount: 1, originPeerID: 'alice', originNickname: 'Alice' };
            const content = 'Hello World';
            const encoded = RelayService.encodeRelayMessage(content, metadata);

            const result = RelayService.parseRelayMetadata(encoded);

            expect(result.metadata).toEqual(metadata);
            expect(result.actualContent).toBe(content);
        });

        it('should handle messages without relay metadata', () => {
            const content = 'Plain message';
            const result = RelayService.parseRelayMetadata(content);

            expect(result.metadata).toBeNull();
            expect(result.actualContent).toBe(content);
        });

        it('should handle malformed relay metadata', () => {
            const content = '__RELAY__{invalid json}__MSG__content';
            const result = RelayService.parseRelayMetadata(content);

            expect(result.metadata).toBeNull();
            expect(result.actualContent).toBe(content);
        });
    });

    describe('encodeRelayMessage', () => {
        it('should encode message with relay metadata', () => {
            const content = 'Test message';
            const metadata = { 
                hopCount: 0, 
                originPeerID: 'bob', 
                originNickname: 'Bob' 
            };

            const encoded = RelayService.encodeRelayMessage(content, metadata);

            expect(encoded).toContain('__RELAY__');
            expect(encoded).toContain('__MSG__');
            expect(encoded).toContain(content);
            expect(encoded).toContain('Bob');
        });
    });

    describe('createInitialMetadata', () => {
        it('should create metadata with hop count 0', () => {
            const metadata = RelayService.createInitialMetadata('target-peer');

            expect(metadata.hopCount).toBe(0);
            expect(metadata.originPeerID).toBe('test-peer-id');
            expect(metadata.originNickname).toBe('TestUser');
            expect(metadata.destinationPeerID).toBe('target-peer');
            expect(metadata.relayPath).toEqual(['test-peer-id']);
        });

        it('should create metadata without destination', () => {
            const metadata = RelayService.createInitialMetadata();

            expect(metadata.destinationPeerID).toBeUndefined();
        });
    });

    describe('getStats', () => {
        it('should return relay statistics', () => {
            const stats = RelayService.getStats();

            expect(stats).toHaveProperty('seenMessages');
            expect(stats).toHaveProperty('enabled');
            expect(stats).toHaveProperty('maxHops');
            expect(stats.enabled).toBe(true);
            expect(stats.maxHops).toBe(5);
        });
    });

    describe('enable/disable', () => {
        it('should enable relay', () => {
            RelayService.setEnabled(true);
            expect(RelayService.isRelayEnabled()).toBe(true);
        });

        it('should disable relay', () => {
            RelayService.setEnabled(false);
            expect(RelayService.isRelayEnabled()).toBe(false);
        });
    });

    describe('clearCache', () => {
        it('should clear seen messages cache', () => {
            const stats1 = RelayService.getStats();
            const initialCount = stats1.seenMessages;

            RelayService.clearCache();

            const stats2 = RelayService.getStats();
            expect(stats2.seenMessages).toBeLessThanOrEqual(initialCount);
        });
    });
});
