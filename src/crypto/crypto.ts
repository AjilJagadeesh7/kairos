const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

export type EncryptedPayload = {
  version: 1
  iv: string
  data: string
  updatedAt: string
}

const SALT_KEY = 'mindvault.pbkdf2.salt'

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function ensureSalt(): Uint8Array {
  const existing = localStorage.getItem(SALT_KEY)
  if (existing) return fromBase64(existing)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(SALT_KEY, toBase64(salt))
  return salt
}

export async function deriveKey(password: string): Promise<CryptoKey> {
  const salt = ensureSalt()
  const baseKey = await crypto.subtle.importKey('raw', TEXT_ENCODER.encode(password), 'PBKDF2', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations: 100_000,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(plaintext: string, key: CryptoKey, updatedAt: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(TEXT_ENCODER.encode(plaintext)),
  )

  return {
    version: 1,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
    updatedAt,
  }
}

export async function decryptText(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const iv = fromBase64(payload.iv)
  const data = fromBase64(payload.data)
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data),
  )

  return TEXT_DECODER.decode(plainBuffer)
}
