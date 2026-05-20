import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ensureSalt, deriveKey, encryptText, decryptText } from './crypto'

const makeLocalStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage())
})

describe('ensureSalt', () => {
  it('generates a 16-byte salt on first call', () => {
    const salt = ensureSalt()
    expect(salt).toBeInstanceOf(Uint8Array)
    expect(salt.byteLength).toBe(16)
  })

  it('returns the same salt on subsequent calls', () => {
    const first = ensureSalt()
    const second = ensureSalt()
    expect(first).toEqual(second)
  })
})

describe('encryptText / decryptText', () => {
  it('round-trips plaintext correctly', async () => {
    const key = await deriveKey('test-password')
    const plaintext = 'Hello, MindVault!'
    const payload = await encryptText(plaintext, key, new Date().toISOString())
    const result = await decryptText(payload, key)
    expect(result).toBe(plaintext)
  })

  it('round-trips empty string', async () => {
    const key = await deriveKey('pw')
    const payload = await encryptText('', key, new Date().toISOString())
    expect(await decryptText(payload, key)).toBe('')
  })

  it('produces a different IV each encryption (non-deterministic)', async () => {
    const key = await deriveKey('pw')
    const ts = new Date().toISOString()
    const a = await encryptText('same text', key, ts)
    const b = await encryptText('same text', key, ts)
    expect(a.iv).not.toBe(b.iv)
  })

  it('payload has version 1', async () => {
    const key = await deriveKey('pw')
    const payload = await encryptText('data', key, new Date().toISOString())
    expect(payload.version).toBe(1)
  })

  it('decrypting with the wrong key throws', async () => {
    const key1 = await deriveKey('correct-password')
    const key2 = await deriveKey('wrong-password')
    const payload = await encryptText('secret', key1, new Date().toISOString())
    await expect(decryptText(payload, key2)).rejects.toThrow()
  })
})
