/**
 * Prevents the vault file-watcher from reacting to writes the app itself made.
 * Call suppressVaultWatcher() before writing a note to disk; the watcher will
 * ignore events for the next `ms` milliseconds (default 3 s, longer than the
 * autosave cycle so back-to-back saves stay suppressed while editing).
 */
let suppressedUntil = 0

export function suppressVaultWatcher(ms = 3000): void {
  suppressedUntil = Date.now() + ms
}

export function isVaultWatcherSuppressed(): boolean {
  return Date.now() < suppressedUntil
}
