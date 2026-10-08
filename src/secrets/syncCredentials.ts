/**
 * Keeps WebDAV / S3 secrets in OS secure storage instead of plain-text
 * settings (localStorage `kairos-ui-store` and vault/config/settings.json).
 *
 * In memory the store still holds the full config, so every sync module keeps
 * working unchanged. Only the *persisted* copies are redacted — and only once
 * `resolveSyncCredentials` has confirmed the secrets are in secure storage.
 * Until then (or if that write fails) persisted copies are left as they were,
 * so a failed migration can never lose a credential.
 */
import { getSecret, setSecret, deleteSecret, isSecureStorePersistent, SECRET_KEYS } from './secureStore'
import type { S3Config, WebDAVConfig } from '../types'

let ready = false

/** True once secrets are confirmed in secure storage — persisted copies may be redacted. */
export function canRedactPersisted(): boolean {
  return ready && isSecureStorePersistent()
}

/** Test hook. */
export function resetSyncCredentialsForTests(): void {
  ready = false
}

export function redactS3(cfg: S3Config | null): S3Config | null {
  if (!cfg || !canRedactPersisted()) return cfg
  return { ...cfg, secretKey: '' }
}

export function redactWebDAV(cfg: WebDAVConfig | null): WebDAVConfig | null {
  if (!cfg || !canRedactPersisted()) return cfg
  return { ...cfg, password: '' }
}

/** Save (or clear) the S3 secret. A config with an empty secret is a redacted
 *  copy and leaves the stored secret alone. */
export async function persistS3Secret(cfg: S3Config | null): Promise<void> {
  if (cfg === null) return deleteSecret(SECRET_KEYS.s3SecretKey)
  if (cfg.secretKey) return setSecret(SECRET_KEYS.s3SecretKey, cfg.secretKey)
}

export async function persistWebDAVSecret(cfg: WebDAVConfig | null): Promise<void> {
  if (cfg === null) return deleteSecret(SECRET_KEYS.webdavPassword)
  if (cfg.password) return setSecret(SECRET_KEYS.webdavPassword, cfg.password)
}

export interface ResolvedCredentials {
  s3: S3Config | null
  webdav: WebDAVConfig | null
  /** A plain-text secret was found and moved into secure storage. */
  migrated: boolean
}

/**
 * Returns the configs with their secrets filled in from secure storage. A
 * config that still carries a plain-text secret (legacy) has it copied into
 * secure storage first. On success, persisted copies become redactable.
 */
export async function resolveSyncCredentials(
  s3: S3Config | null,
  webdav: WebDAVConfig | null,
): Promise<ResolvedCredentials> {
  let migrated = false
  try {
    let s3Out = s3
    if (s3) {
      if (s3.secretKey) {
        await setSecret(SECRET_KEYS.s3SecretKey, s3.secretKey)
        migrated = true
      } else {
        s3Out = { ...s3, secretKey: (await getSecret(SECRET_KEYS.s3SecretKey)) ?? '' }
      }
    }

    let davOut = webdav
    if (webdav) {
      if (webdav.password) {
        await setSecret(SECRET_KEYS.webdavPassword, webdav.password)
        migrated = true
      } else {
        davOut = { ...webdav, password: (await getSecret(SECRET_KEYS.webdavPassword)) ?? '' }
      }
    }

    // The legacy change-detection snapshot of secrets.json held the plain-text
    // body in localStorage; it now lives in secure storage.
    if (localStorage.getItem(LEGACY_SECRETS_SNAP) !== null) {
      localStorage.removeItem(LEGACY_SECRETS_SNAP)
      migrated = true
    }

    ready = true
    return { s3: s3Out, webdav: davOut, migrated }
  } catch (err) {
    console.warn('[secrets] secure storage unavailable — leaving sync credentials as they are:', err)
    return { s3, webdav, migrated: false }
  }
}

export const LEGACY_SECRETS_SNAP = 'kairos_cfg_secrets_snap'
