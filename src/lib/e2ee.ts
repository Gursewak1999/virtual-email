const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface EncryptedPrivateKeyPayload {
  ciphertext: string;
  iv: string;
  salt: string;
  rounds: number;
}

export interface HybridEncryptedPayload {
  ciphertext: string;
  iv: string;
  wrappedKey: string;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this runtime.");
  }

  return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

export function generateMasterRecoveryKey(length = 16): string {
  const bytes = randomBytes(length);
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += recoveryAlphabet[bytes[index] % recoveryAlphabet.length];
  }

  return output;
}

export async function generateUserEncryptionKeyPair(): Promise<CryptoKeyPair> {
  return getCrypto().subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<string> {
  return JSON.stringify(await getCrypto().subtle.exportKey("jwk", publicKey));
}

export async function exportPrivateKeyJwk(
  privateKey: CryptoKey,
): Promise<string> {
  return JSON.stringify(await getCrypto().subtle.exportKey("jwk", privateKey));
}

export async function importPrivateKeyJwk(
  privateKeyJwk: string,
): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    "jwk",
    JSON.parse(privateKeyJwk) as JsonWebKey,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"],
  );
}

async function deriveRecoveryKey(masterRecoveryKey: string, salt: Uint8Array) {
  const crypto = getCrypto();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(masterRecoveryKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 210000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPrivateKey(
  privateKeyJwk: string,
  masterRecoveryKey: string,
): Promise<EncryptedPrivateKeyPayload> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = await deriveRecoveryKey(masterRecoveryKey, salt);

  const ciphertext = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    derivedKey,
    textEncoder.encode(privateKeyJwk),
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    rounds: 210000,
  };
}

export async function decryptPrivateKey(
  payload: EncryptedPrivateKeyPayload,
  masterRecoveryKey: string,
): Promise<string> {
  const derivedKey = await deriveRecoveryKey(
    masterRecoveryKey,
    base64ToBytes(payload.salt),
  );

  const decrypted = await getCrypto().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(payload.iv) as BufferSource,
    },
    derivedKey,
    base64ToBytes(payload.ciphertext) as BufferSource,
  );

  return textDecoder.decode(decrypted);
}

export async function encryptDataForUser(
  plaintext: string,
  publicKeyJwk: string,
): Promise<HybridEncryptedPayload> {
  const crypto = getCrypto();
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(publicKeyJwk) as JsonWebKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );

  const contentKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    contentKey,
    textEncoder.encode(plaintext),
  );

  const rawKey = await crypto.subtle.exportKey("raw", contentKey);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey,
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
  };
}

export async function decryptDataForUser(
  payload: HybridEncryptedPayload,
  privateKeyJwk: string,
): Promise<string> {
  const crypto = getCrypto();
  const privateKey = await importPrivateKeyJwk(privateKeyJwk);
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBytes(payload.wrappedKey) as BufferSource,
  );

  const contentKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) as BufferSource },
    contentKey,
    base64ToBytes(payload.ciphertext) as BufferSource,
  );

  return textDecoder.decode(plaintext);
}

export function storeUnlockedPrivateKey(privateKeyJwk: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem("ircc_unlocked_private_key", privateKeyJwk);
}

export function loadUnlockedPrivateKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem("ircc_unlocked_private_key");
}

export function clearUnlockedPrivateKey(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem("ircc_unlocked_private_key");
}
