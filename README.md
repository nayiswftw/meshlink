# 📡 Meshlink

**Decentralised communication that works without internet, powered by Bluetooth LE mesh networking.**

Meshlink lets you send encrypted messages to nearby devices using Bluetooth Low Energy. Messages hop device-to-device through a mesh network — no Wi-Fi, no cellular, no servers.

## Features

- **🔗 BLE Mesh Networking** — Discover and communicate with nearby devices via Bluetooth
- **🔐 E2E Encryption** — Every message is encrypted with NaCl (XSalsa20-Poly1305)
- **📡 Store-and-Forward Relay** — Messages hop through peers to reach their destination
- **🆔 Cryptographic Identity** — Each device generates a unique keypair on first launch
- **📱 Beautiful UI** — Dark-themed interface with animated radar, signal indicators, and smooth transitions

## Tech Stack

- **React Native** (Expo / Expo Router)
- **TypeScript**
- **react-native-ble-plx** — BLE scanning, advertising, GATT
- **TweetNaCl** — Cryptographic operations
- **MMKV** — Fast local storage
- **Uniwind** — Tailwind-style styling for React Native

## Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Tab navigator (Peers, Chats, Settings)
│   ├── chat/[peerId].tsx   # Chat conversation
│   └── onboarding.tsx      # First launch setup
├── components/             # Shared UI components
├── context/                # React context (MeshProvider)
├── services/
│   ├── ble/                # BLE transport layer
│   ├── mesh/               # Mesh routing protocol
│   ├── crypto/             # Encryption & identity
│   └── storage/            # Local persistence
├── types.ts                # TypeScript interfaces
└── constants.ts            # Config & UUIDs
```

## Getting Started

```bash
# Install dependencies
bun install

# Build dev client (requires physical device)
npx expo prebuild
npx expo run:android

# Or start with Expo
bun start
```

> **Note:** BLE features require a physical device and a custom Dev Client build. Expo Go does not support native BLE modules.

## How the Mesh Works

1. **Discovery** — Devices scan and advertise a custom BLE service UUID
2. **Connection** — GATT connection + identity exchange (public keys)
3. **Messaging** — Messages encrypted with recipient's key, chunked for BLE MTU
4. **Relay** — If recipient is out of range, nearby peers store-and-forward the message
5. **Dedup** — Rolling message ID cache prevents infinite relay loops

## License

MIT
