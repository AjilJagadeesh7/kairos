/**
 * OS-backed secret storage — the only place API keys and sync credentials live.
 *
 *  - Desktop (Tauri): OS keychain / Credential Manager / Secret Service via the
 *    `keyring` crate (`secret_get` / `secret_set` / `secret_delete` commands).
 *  - Android (Capacitor): AES-GCM with an Android Keystore key, via
 *    `@aparajita/capacitor-secure-storage`.
 *  - Anywhere else (browser dev server, tests): an in-memory map. Nothing is
 *    persisted, so secrets must be re-entered after a reload — never written
 *    to localStorage.
 *
 * Secrets are never synced and never written to the vault.
 */
import { isDesktop, isMobile } from '../utils/platform'

export interface SecretBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

const memory = new Map<string, string>()

const memoryBackend: SecretBackend = {
  get: async (key) => memory.get(key) ?? null,
  set: async (key, value) => { memory.set(key, value) },
  remove: async (key) => { memory.delete(key) },
}

const tauriBackend: SecretBackend = {
  async get(key) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string | null>('secret_get', { key })
  },
  async set(key, value) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('secret_set', { key, value })
  },
  async remove(key) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('secret_delete', { key })
  },
}

const capacitorBackend: SecretBackend = {
  async get(key) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
    return SecureStorage.getItem(key)
  },
  async set(key, value) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
    await SecureStorage.setItem(key, value)
  },
  async remove(key) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
    await SecureStorage.removeItem(key)
  },
}

let override: SecretBackend | null = null

/** Test hook: swap the backend. Pass null to restore platform detection. */
export function setSecretBackendForTests(backend: SecretBackend | null): void {
  override = backend
}

function backend(): SecretBackend {
  if (override) return override
  if (isDesktop()) return tauriBackend
  if (isMobile()) return capacitorBackend
  return memoryBackend
}

/** True when secrets survive a restart (desktop and Android). */
export function isSecureStorePersistent(): boolean {
  return override !== null || isDesktop() || isMobile()
}

export async function getSecret(key: string): Promise<string | null> {
  const value = await backend().get(key)
  return value === '' ? null : value
}

/** Stores `value`; an empty string removes the entry. */
export async function setSecret(key: string, value: string): Promise<void> {
  if (value === '') return backend().remove(key)
  return backend().set(key, value)
}

export async function deleteSecret(key: string): Promise<void> {
  return backend().remove(key)
}

// Key names — kept here so every caller agrees on them.
export const SECRET_KEYS = {
  webdavPassword: 'sync.webdav.password',
  s3SecretKey: 'sync.s3.secretKey',
  configSecretsSnapshot: 'sync.config.secretsSnapshot',
  aiProvider: (providerId: string) => `ai.provider.${providerId}.apiKey`,
  braveSearch: 'ai.web.brave.apiKey',
} as const
