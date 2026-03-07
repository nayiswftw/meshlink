// Mock AsyncStorage before importing Database
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, val: string) => {
        mockStore[key] = val;
        return Promise.resolve();
    }),
}));

import type { StoredMessage, Conversation, Channel } from '../../../types';

// Database uses module-level cache, so we need fresh imports per test suite
// We reset caches by re-requiring between describe blocks

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
    return {
        id: 'msg-1',
        sender: 'Alice',
        content: 'hello',
        timestamp: 1000,
        isPrivate: true,
        senderPeerID: 'peer-alice',
        isMine: false,
        status: 'delivered',
        ...overrides,
    };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
    return {
        peerId: 'peer-1',
        peerName: 'Alice',
        lastMessage: 'hi',
        lastMessageTimestamp: 1000,
        unreadCount: 0,
        updatedAt: 1000,
        ...overrides,
    };
}

function makeChannel(overrides: Partial<Channel> = {}): Channel {
    return {
        name: '#general',
        isPasswordProtected: false,
        createdAt: 1000,
        lastMessage: '',
        lastMessageSender: '',
        lastMessageTimestamp: 0,
        unreadCount: 0,
        updatedAt: 1000,
        ...overrides,
    };
}

describe('Database', () => {
    let Database: typeof import('../../storage/Database');

    beforeEach(() => {
        // Clear the mock store
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);

        // Reset module cache to get fresh caches
        jest.resetModules();
    });

    async function loadDb() {
        Database = await import('../../storage/Database');
        await Database.hydrateDatabase();
        return Database;
    }

    // ── Hydration ────────────────────────────────────

    describe('hydrateDatabase', () => {
        it('initializes with empty arrays when no stored data', async () => {
            const db = await loadDb();
            expect(db.getConversations()).toEqual([]);
            expect(db.getChannels()).toEqual([]);
        });

        it('loads existing data from storage', async () => {
            const msgs = [makeMessage()];
            const convs = [makeConversation()];
            const chans = [makeChannel()];
            mockStore['@meshlink/messages'] = JSON.stringify(msgs);
            mockStore['@meshlink/conversations'] = JSON.stringify(convs);
            mockStore['@meshlink/channels'] = JSON.stringify(chans);

            const db = await loadDb();
            expect(db.getConversations()).toHaveLength(1);
            expect(db.getChannels()).toHaveLength(1);
        });

        it('only hydrates once (idempotent)', async () => {
            const db = await loadDb();
            // Add data after hydration
            mockStore['@meshlink/conversations'] = JSON.stringify([makeConversation()]);
            // Re-hydrate should be a no-op
            await db.hydrateDatabase();
            expect(db.getConversations()).toEqual([]);
        });
    });

    // ── Messages ─────────────────────────────────────

    describe('saveMessage & getPrivateMessagesForPeer', () => {
        it('saves and retrieves private messages by peerId', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'peer-alice', peerName: 'Alice' }));
            db.saveMessage(makeMessage({ isPrivate: true, isMine: false }));

            const result = db.getPrivateMessagesForPeer('peer-alice');
            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('hello');
        });

        it('updates existing message by id', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'peer-alice', peerName: 'Alice' }));
            db.saveMessage(makeMessage({ id: 'x', content: 'v1' }));
            db.saveMessage(makeMessage({ id: 'x', content: 'v2' }));

            const msgs = db.getPrivateMessagesForPeer('peer-alice');
            expect(msgs).toHaveLength(1);
            expect(msgs[0].content).toBe('v2');
        });

        it('sorts messages by timestamp', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'peer-alice', peerName: 'Alice' }));
            db.saveMessage(makeMessage({ id: '2', timestamp: 2000 }));
            db.saveMessage(makeMessage({ id: '1', timestamp: 1000 }));
            db.saveMessage(makeMessage({ id: '3', timestamp: 3000 }));

            const msgs = db.getPrivateMessagesForPeer('peer-alice');
            expect(msgs.map((m) => m.id)).toEqual(['1', '2', '3']);
        });
    });

    describe('updateMessageStatus', () => {
        it('updates the status of an existing message', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'peer-alice', peerName: 'Alice' }));
            db.saveMessage(makeMessage({ id: 'msg-1', status: 'sending' }));
            db.updateMessageStatus('msg-1', 'delivered');

            const msgs = db.getPrivateMessagesForPeer('peer-alice');
            expect(msgs[0].status).toBe('delivered');
        });

        it('does nothing for unknown message id', async () => {
            const db = await loadDb();
            // Should not throw
            db.updateMessageStatus('nonexistent', 'read');
        });
    });

    // ── Conversations ────────────────────────────────

    describe('upsertConversation', () => {
        it('inserts a new conversation', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation());
            expect(db.getConversations()).toHaveLength(1);
        });

        it('accumulates unread count on update', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'p1', unreadCount: 2 }));
            db.upsertConversation(makeConversation({ peerId: 'p1', unreadCount: 3 }));

            const conv = db.getConversations().find((c) => c.peerId === 'p1');
            expect(conv?.unreadCount).toBe(5);
        });

        it('resets unread count when updating with 0', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'p1', unreadCount: 5 }));
            db.upsertConversation(makeConversation({ peerId: 'p1', unreadCount: 0 }));

            const conv = db.getConversations().find((c) => c.peerId === 'p1');
            expect(conv?.unreadCount).toBe(0);
        });
    });

    describe('getConversations', () => {
        it('returns sorted by updatedAt descending', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'old', peerName: 'OldPeer', updatedAt: 1000 }));
            db.upsertConversation(makeConversation({ peerId: 'new', peerName: 'NewPeer', updatedAt: 3000 }));
            db.upsertConversation(makeConversation({ peerId: 'mid', peerName: 'MidPeer', updatedAt: 2000 }));

            const convs = db.getConversations();
            expect(convs.map((c) => c.peerId)).toEqual(['new', 'mid', 'old']);
        });

        it('returns a copy (not the internal array)', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation());
            const a = db.getConversations();
            const b = db.getConversations();
            expect(a).not.toBe(b);
        });
    });

    describe('markConversationRead', () => {
        it('sets unread count to zero', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'p1', unreadCount: 5 }));
            db.markConversationRead('p1');

            const conv = db.getConversations().find((c) => c.peerId === 'p1');
            expect(conv?.unreadCount).toBe(0);
        });

        it('does nothing for unknown peer', async () => {
            const db = await loadDb();
            // Should not throw
            db.markConversationRead('nonexistent');
        });
    });

    // ── Channels ─────────────────────────────────────

    describe('upsertChannel', () => {
        it('inserts a new channel', async () => {
            const db = await loadDb();
            db.upsertChannel(makeChannel());
            expect(db.getChannels()).toHaveLength(1);
        });

        it('preserves createdAt on update', async () => {
            const db = await loadDb();
            db.upsertChannel(makeChannel({ name: '#test', createdAt: 1000 }));
            db.upsertChannel(makeChannel({ name: '#test', createdAt: 9999, updatedAt: 2000 }));

            const ch = db.getChannel('#test');
            expect(ch?.createdAt).toBe(1000);
        });

        it('accumulates unread count', async () => {
            const db = await loadDb();
            db.upsertChannel(makeChannel({ name: '#ch', unreadCount: 2 }));
            db.upsertChannel(makeChannel({ name: '#ch', unreadCount: 3 }));

            const ch = db.getChannel('#ch');
            expect(ch?.unreadCount).toBe(5);
        });
    });

    describe('getChannels', () => {
        it('returns sorted by updatedAt descending', async () => {
            const db = await loadDb();
            db.upsertChannel(makeChannel({ name: '#a', updatedAt: 1000 }));
            db.upsertChannel(makeChannel({ name: '#c', updatedAt: 3000 }));
            db.upsertChannel(makeChannel({ name: '#b', updatedAt: 2000 }));

            const chans = db.getChannels();
            expect(chans.map((c) => c.name)).toEqual(['#c', '#b', '#a']);
        });
    });

    describe('markChannelRead', () => {
        it('sets unread count to zero', async () => {
            const db = await loadDb();
            db.upsertChannel(makeChannel({ name: '#ch', unreadCount: 5 }));
            db.markChannelRead('#ch');

            const ch = db.getChannel('#ch');
            expect(ch?.unreadCount).toBe(0);
        });
    });

    describe('deleteChannel', () => {
        it('removes the channel', async () => {
            const db = await loadDb();
            db.upsertChannel(makeChannel({ name: '#doomed' }));
            expect(db.getChannels()).toHaveLength(1);

            db.deleteChannel('#doomed');
            expect(db.getChannels()).toHaveLength(0);
        });
    });

    describe('getChannelMessages', () => {
        it('returns non-private messages for the given channel', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: '1', isPrivate: false, channel: '#general', timestamp: 1000 }));
            db.saveMessage(makeMessage({ id: '2', isPrivate: false, channel: '#other', timestamp: 2000 }));
            db.saveMessage(makeMessage({ id: '3', isPrivate: true, channel: '#general', timestamp: 3000 }));

            const msgs = db.getChannelMessages('#general');
            expect(msgs).toHaveLength(1);
            expect(msgs[0].id).toBe('1');
        });

        it('returns messages sorted by timestamp', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: 'b', isPrivate: false, channel: '#ch', timestamp: 2000 }));
            db.saveMessage(makeMessage({ id: 'a', isPrivate: false, channel: '#ch', timestamp: 1000 }));

            const msgs = db.getChannelMessages('#ch');
            expect(msgs.map((m) => m.id)).toEqual(['a', 'b']);
        });
    });

    // ── Search ───────────────────────────────────────

    describe('searchMessages', () => {
        it('finds messages matching the query (case-insensitive)', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: '1', content: 'Hello World' }));
            db.saveMessage(makeMessage({ id: '2', content: 'goodbye' }));
            db.saveMessage(makeMessage({ id: '3', content: 'HELLO again' }));

            const results = db.searchMessages('hello');
            expect(results).toHaveLength(2);
            expect(results.map((m) => m.id)).toContain('1');
            expect(results.map((m) => m.id)).toContain('3');
        });

        it('returns empty for blank query', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: '1', content: 'test' }));
            expect(db.searchMessages('')).toEqual([]);
            expect(db.searchMessages('   ')).toEqual([]);
        });

        it('returns results sorted by timestamp descending', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: 'old', content: 'hello', timestamp: 1000 }));
            db.saveMessage(makeMessage({ id: 'new', content: 'hello', timestamp: 3000 }));
            db.saveMessage(makeMessage({ id: 'mid', content: 'hello', timestamp: 2000 }));

            const results = db.searchMessages('hello');
            expect(results.map((m) => m.id)).toEqual(['new', 'mid', 'old']);
        });
    });

    // ── Delete ───────────────────────────────────────

    describe('deleteMessage', () => {
        it('removes a message by id', async () => {
            const db = await loadDb();
            db.upsertConversation(makeConversation({ peerId: 'peer-alice', peerName: 'Alice' }));
            db.saveMessage(makeMessage({ id: 'x', content: 'doomed' }));
            expect(db.getPrivateMessagesForPeer('peer-alice')).toHaveLength(1);

            const deleted = db.deleteMessage('x');
            expect(deleted).toBe(true);
            expect(db.getPrivateMessagesForPeer('peer-alice')).toHaveLength(0);
        });

        it('returns false for unknown id', async () => {
            const db = await loadDb();
            expect(db.deleteMessage('nonexistent')).toBe(false);
        });

        it('updates parent conversation lastMessage after deletion', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: '1', content: 'first', timestamp: 1000, sender: 'Alice' }));
            db.saveMessage(makeMessage({ id: '2', content: 'second', timestamp: 2000, sender: 'Alice' }));
            db.upsertConversation(makeConversation({ peerId: 'p1', peerName: 'Alice', lastMessage: 'second' }));

            db.deleteMessage('2');
            const conv = db.getConversations().find((c) => c.peerId === 'p1');
            expect(conv?.lastMessage).toBe('first');
        });

        it('clears conversation lastMessage when all messages deleted', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: '1', content: 'only', sender: 'Alice' }));
            db.upsertConversation(makeConversation({ peerId: 'p1', peerName: 'Alice', lastMessage: 'only' }));

            db.deleteMessage('1');
            const conv = db.getConversations().find((c) => c.peerId === 'p1');
            expect(conv?.lastMessage).toBe('');
        });

        it('updates parent channel lastMessage after deletion', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: '1', content: 'first', timestamp: 1000, isPrivate: false, channel: '#test' }));
            db.saveMessage(makeMessage({ id: '2', content: 'second', timestamp: 2000, isPrivate: false, channel: '#test' }));
            db.upsertChannel(makeChannel({ name: '#test', lastMessage: 'second' }));

            db.deleteMessage('2');
            const ch = db.getChannel('#test');
            expect(ch?.lastMessage).toBe('first');
        });
    });

    // ── hasMessage ────────────────────────────────────

    describe('hasMessage', () => {
        it('returns true for existing message', async () => {
            const db = await loadDb();
            db.saveMessage(makeMessage({ id: 'exists' }));
            expect(db.hasMessage('exists')).toBe(true);
        });

        it('returns false for non-existing message', async () => {
            const db = await loadDb();
            expect(db.hasMessage('nope')).toBe(false);
        });
    });
});
