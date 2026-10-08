import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setSecretBackendForTests, getSecret, SECRET_KEYS, type SecretBackend } from './secureStore'
import {
  resolveSyncCredentials, redactS3, redactWebDAV, canRedactPersisted, resetSyncCredentialsForTests,
  persistWebDAVSecret, LEGACY_SECRETS_SNAP,
} from './syncCredentials'
import type { S3Config, WebDAVConfig } from '../types'

const s3: S3Config = { endpoint: 'https://r2.example', bucket: 'b', accessKey: 'AK', secretKey: 'S3-SECRET', region: 'auto' }
const dav: WebDAVConfig = { url: 'https://dav.example/kairos', username: 'me', password: 'DAV-PASS' }

let vault: Map<string, string>
let local: Record<string, string>

function memoryBackend(): SecretBackend {
  return {
    get: async (k) => vault.get(k) ?? null,
    set: async (k, v) => { vault.set(k, v) },
    remove: async (k) => { vault.delete(k) },
  }
}

beforeEach(() => {
  vault = new Map()
  local = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => local[k] ?? null,
    setItem: (k: string, v: string) => { local[k] = v },
    removeItem: (k: string) => { delete local[k] },
  })
  setSecretBackendForTests(memoryBackend())
  resetSyncCredentialsForTests()
})

afterEach(() => setSecretBackendForTests(null))

describe('resolveSyncCredentials', () => {
  it('moves legacy plain-text secrets into secure storage', async () => {
    local[LEGACY_SECRETS_SNAP] = JSON.stringify({ s3Config: s3 })
    const r = await resolveSyncCredentials(s3, dav)

    expect(r.migrated).toBe(true)
    expect(r.s3).toEqual(s3)
    expect(r.webdav).toEqual(dav)
    expect(await getSecret(SECRET_KEYS.s3SecretKey)).toBe('S3-SECRET')
    expect(await getSecret(SECRET_KEYS.webdavPassword)).toBe('DAV-PASS')
    expect(local[LEGACY_SECRETS_SNAP]).toBeUndefined()
  })

  it('fills redacted configs from secure storage', async () => {
    vault.set(SECRET_KEYS.s3SecretKey, 'S3-SECRET')
    vault.set(SECRET_KEYS.webdavPassword, 'DAV-PASS')
    const r = await resolveSyncCredentials({ ...s3, secretKey: '' }, { ...dav, password: '' })
    expect(r).toEqual({ s3, webdav: dav, migrated: false })
  })

  it('never redacts before secrets are confirmed in secure storage', async () => {
    expect(canRedactPersisted()).toBe(false)
    expect(redactS3(s3)).toEqual(s3)
    await resolveSyncCredentials(s3, dav)
    expect(canRedactPersisted()).toBe(true)
    expect(redactS3(s3)?.secretKey).toBe('')
    expect(redactWebDAV(dav)?.password).toBe('')
    expect(redactWebDAV(dav)?.username).toBe('me')
  })

  it('keeps plain-text copies when secure storage fails, so nothing is lost', async () => {
    setSecretBackendForTests({
      get: async () => { throw new Error('locked') },
      set: async () => { throw new Error('locked') },
      remove: async () => { throw new Error('locked') },
    })
    const r = await resolveSyncCredentials(s3, dav)
    expect(r).toEqual({ s3, webdav: dav, migrated: false })
    expect(canRedactPersisted()).toBe(false)
    expect(redactS3(s3)).toEqual(s3)
  })
})

describe('persist*Secret', () => {
  it('stores a new secret, ignores a redacted copy, and deletes on disconnect', async () => {
    await persistWebDAVSecret(dav)
    expect(vault.get(SECRET_KEYS.webdavPassword)).toBe('DAV-PASS')
    await persistWebDAVSecret({ ...dav, password: '' })
    expect(vault.get(SECRET_KEYS.webdavPassword)).toBe('DAV-PASS')
    await persistWebDAVSecret(null)
    expect(vault.has(SECRET_KEYS.webdavPassword)).toBe(false)
  })
})
