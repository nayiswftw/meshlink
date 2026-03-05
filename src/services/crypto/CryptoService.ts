/**
 * CryptoService — Key generation, E2E encryption, and message signing.
 *
 * Uses TweetNaCl for all crypto operations:
 * - Ed25519 for signing (identity verification)
 * - X25519 + XSalsa20-Poly1305 for E2E encryption (NaCl box)
 */
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

// Explicitly set TweetNaCl PRNG securely using expo-crypto
// This bypasses 'react-native-get-random-values' global import order issues
nacl.setPRNG((x, n) => {
    const bytes = Crypto.getRandomBytes(n);
    for (let i = 0; i < n; i++) {
        x[i] = bytes[i];
    }
});

// ─── Key Management ──────────────────────────────────────────────

export interface KeyPair {
    publicKey: string; // base64
    secretKey: string; // base64
}

/**
 * Generate a new NaCl box keypair for encryption (X25519).
 */
export function generateEncryptionKeyPair(): KeyPair {
    const kp = nacl.box.keyPair();
    return {
        publicKey: Buffer.from(kp.publicKey).toString('base64'),
        secretKey: Buffer.from(kp.secretKey).toString('base64'),
    };
}

/**
 * Generate a new NaCl sign keypair for signing (Ed25519).
 */
export function generateSigningKeyPair(): KeyPair {
    const kp = nacl.sign.keyPair();
    return {
        publicKey: Buffer.from(kp.publicKey).toString('base64'),
        secretKey: Buffer.from(kp.secretKey).toString('base64'),
    };
}

// ─── Encryption ──────────────────────────────────────────────────

/**
 * Encrypt a plaintext message for a specific recipient.
 * Returns { ciphertext, nonce } both base64-encoded.
 */
export function encryptMessage(
    plaintext: string,
    recipientPublicKey: string,
    senderSecretKey: string
): { ciphertext: string; nonce: string } {
    const messageBytes = Buffer.from(plaintext, 'utf-8');
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const recipientPk = Buffer.from(recipientPublicKey, 'base64');
    const senderSk = Buffer.from(senderSecretKey, 'base64');

    const encrypted = nacl.box(messageBytes, nonce, recipientPk, senderSk);

    if (!encrypted) {
        throw new Error('Encryption failed');
    }

    return {
        ciphertext: Buffer.from(encrypted).toString('base64'),
        nonce: Buffer.from(nonce).toString('base64'),
    };
}

/**
 * Decrypt a message from a specific sender.
 */
export function decryptMessage(
    ciphertext: string,
    nonce: string,
    senderPublicKey: string,
    recipientSecretKey: string
): string {
    const ciphertextBytes = Buffer.from(ciphertext, 'base64');
    const nonceBytes = Buffer.from(nonce, 'base64');
    const senderPk = Buffer.from(senderPublicKey, 'base64');
    const recipientSk = Buffer.from(recipientSecretKey, 'base64');

    const decrypted = nacl.box.open(
        ciphertextBytes,
        nonceBytes,
        senderPk,
        recipientSk
    );

    if (!decrypted) {
        throw new Error('Decryption failed — message may be tampered or wrong key');
    }

    return Buffer.from(decrypted).toString('utf-8');
}

// ─── Signing ─────────────────────────────────────────────────────

/**
 * Sign a message with the sender's signing secret key.
 * Returns the signature as a base64 string.
 */
export function signMessage(
    message: string,
    signingSecretKey: string
): string {
    const messageBytes = Buffer.from(message, 'utf-8');
    const secretKey = Buffer.from(signingSecretKey, 'base64');
    const signature = nacl.sign.detached(messageBytes, secretKey);
    return Buffer.from(signature).toString('base64');
}

/**
 * Verify a message signature.
 */
export function verifySignature(
    message: string,
    signature: string,
    signingPublicKey: string
): boolean {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = Buffer.from(signature, 'base64');
    const publicKey = Buffer.from(signingPublicKey, 'base64');
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
}

/**
 * Derive a short, human-readable name from a public key.
 * Example: "Mesh-7F3A"
 */
export function deriveDisplayName(publicKey: string): string {
    const bytes = Buffer.from(publicKey, 'base64');
    const hex = bytes.slice(0, 2).toString('hex').toUpperCase();
    return `Mesh-${hex}`;
}
