# Relay Messaging Implementation

This document describes the relay messaging feature implemented in Meshlink, which extends the reach of the mesh network by allowing messages to hop through intermediate nodes.

## Overview

Relay messaging allows messages to travel through multiple nodes in the mesh network, enabling communication between devices that are not within direct Bluetooth range of each other. This is essential for extending the effective range of the mesh network.

### How It Works

```
Device A <--BLE--> Device B <--BLE--> Device C
```

In the above scenario without relay:
- A can only talk to B
- B can talk to both A and C  
- C can only talk to B

With relay enabled:
- A can send a message to C through B
- C can send a message to A through B
- The network reach is significantly extended

## Architecture

### Components

1. **RelayService** (`src/services/RelayService.ts`)
   - Core relay logic and message forwarding
   - Message deduplication using ID tracking
   - Hop count management (max 5 hops)
   - Relay path tracking to prevent loops

2. **MeshContext Integration** (`src/context/MeshContext.tsx`)
   - Incoming message handling with relay support
   - Outgoing message encoding with relay metadata
   - Automatic relay of messages not destined for the current node

3. **App Settings** (`src/types.ts`)
   - `relayEnabled` boolean setting (default: true)
   - User can toggle relay on/off in settings

### Message Format

Relay messages are encoded with metadata:

```
__RELAY__{json_metadata}__MSG__actual_message_content
```

**Metadata Structure:**
```typescript
{
  hopCount: number;           // Current hop count (0-5)
  originPeerID: string;       // Original sender's peer ID
  originNickname: string;     // Original sender's nickname
  destinationPeerID?: string; // Target recipient (for private messages)
  relayPath?: string[];       // Path the message has taken
}
```

### Key Features

#### 1. Loop Prevention
- **Message ID Tracking**: Each message ID is tracked in a cache (max 1000 entries)
- **Relay Path**: Messages include the path they've taken
- **TTL/Hop Count**: Maximum 5 hops to prevent infinite forwarding

#### 2. Deduplication
- Messages seen before are not relayed again
- Cache entries expire after 5 minutes
- Automatic cleanup runs every minute

#### 3. Smart Forwarding
- Messages are forwarded to all connected peers except the sender
- Private messages include destination information
- Channel messages are re-broadcast to the channel

#### 4. Transparent to Users
- Users see the original sender's name, not the relay node
- Message content is displayed without relay metadata
- Relay status shown in UI when enabled

## Usage

### Enabling/Disabling Relay

Users can toggle relay in Settings > Mesh Network:

```typescript
// In code
updateSettings({ relayEnabled: true });
```

### Sending Messages with Relay

Messages are automatically sent with relay support when enabled:

```typescript
// Private message
await RelayService.sendWithRelay(
  content,
  true,              // isPrivate
  recipientPeerID,
  recipientNickname
);

// Channel message
await RelayService.sendWithRelay(
  content,
  false,             // not private
  undefined,
  undefined,
  channelName,
  mentions
);
```

### Receiving and Relaying Messages

The MeshContext automatically handles incoming messages:

1. **Parse** relay metadata from message
2. **Check** if message is for this node
3. **Relay** if not for this node and hop count < max
4. **Store** and display if for this node

## Configuration

Constants in `RelayService.ts`:

```typescript
const MAX_HOPS = 5;                     // Maximum relay hops
const SEEN_MESSAGE_CACHE_SIZE = 1000;   // Message ID cache size
const SEEN_MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

## Performance Considerations

### Network Traffic
- Each relay increases network traffic exponentially
- Max 5 hops limits this growth
- Deduplication prevents message loops

### Battery Impact
- Relaying messages uses Bluetooth radio
- Users can disable relay to save battery
- Only active when mesh is running

### Memory Usage
- Seen message cache limited to 1000 entries
- Automatic cleanup after 5 minutes
- Minimal memory footprint (~50KB for cache)

## Testing

Unit tests in `src/services/__tests__/RelayService.test.ts`:

- Metadata parsing and encoding
- Deduplication logic
- Hop count management
- Enable/disable functionality

Run tests:
```bash
npm test
```

## UI Indicators

### Settings Screen
- Toggle switch in "Mesh Network" section
- Description explaining relay functionality

### Connection Banner
- Shows "Relay" badge when enabled and peers connected
- Visual indicator of mesh network status

## Security Considerations

1. **No Additional Encryption**: Relay doesn't add encryption; relies on expo-bitchat's native encryption
2. **Trust Model**: All nodes in path can see encrypted messages
3. **Spam Prevention**: Hop limit prevents DOS via message flooding
4. **Message Replay**: Seen message tracking prevents replay attacks

## Future Enhancements

Potential improvements:

1. **Smart Routing**: Track which peers can reach which destinations
2. **Selective Relay**: Only relay for specific channels/contacts
3. **Priority Messages**: Fast-path for important messages
4. **Relay Statistics**: Show relay count in UI
5. **Adaptive Hop Limit**: Adjust max hops based on network size

## Troubleshooting

### Messages Not Reaching Destination
- Check relay is enabled on intermediate nodes
- Verify hop count hasn't exceeded limit
- Check Bluetooth range between nodes

### Duplicate Messages
- Deduplication should handle this automatically
- If persisting, clear relay cache via `RelayService.clearCache()`

### High Battery Usage
- Disable relay if not needed
- Reduce number of active channels
- Close app when not in use

## API Reference

### RelayService

```typescript
// Set identity
setIdentity(peerID: string, nickname: string): void

// Enable/disable
setEnabled(enabled: boolean): void
isRelayEnabled(): boolean

// Send message with relay
sendWithRelay(
  content: string,
  isPrivate: boolean,
  recipientPeerID?: string,
  recipientNickname?: string,
  channel?: string,
  mentions?: string[]
): Promise<void>

// Parse relay metadata
parseRelayMetadata(content: string): {
  metadata: RelayMetadata | null;
  actualContent: string;
}

// Get statistics
getStats(): {
  seenMessages: number;
  enabled: boolean;
  maxHops: number;
}

// Clear cache
clearCache(): void
```

## Related Files

- `src/services/RelayService.ts` - Core relay implementation
- `src/context/MeshContext.tsx` - Integration with app state
- `src/types.ts` - Type definitions
- `src/app/(tabs)/settings.tsx` - Settings UI
- `src/components/ConnectionBanner.tsx` - Status indicator
- `src/services/__tests__/RelayService.test.ts` - Unit tests
