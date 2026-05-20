export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  msg: string
  context?: string
  stack?: string
}

const MAX_MEMORY = 500
const MAX_LOCAL  = 100
const LS_KEY     = 'mindvault_diagnostic_log'

const memoryBuffer: LogEntry[] = []

// Seed memory from localStorage so previous-session errors are available immediately
;(function seedFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const entries = JSON.parse(raw) as LogEntry[]
      memoryBuffer.push(...entries.slice(-MAX_MEMORY))
    }
  } catch { /* ignore */ }
})()

function persistToLocalStorage(entry: LogEntry): void {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const existing: LogEntry[] = raw ? (JSON.parse(raw) as LogEntry[]) : []
    existing.push(entry)
    if (existing.length > MAX_LOCAL) existing.splice(0, existing.length - MAX_LOCAL)
    localStorage.setItem(LS_KEY, JSON.stringify(existing))
  } catch { /* ignore */ }
}

// Cached log directory path — resolved once after Tauri is ready
let logsDirCache: string | null = null

async function appendTauriLog(entry: LogEntry): Promise<void> {
  // Synchronous guard — avoids any dynamic imports if not in Tauri
  if (typeof window === 'undefined' || (!window.__TAURI__ && !window.__TAURI_INTERNALS__)) return

  try {
    if (!logsDirCache) {
      const { appLocalDataDir } = await import(/* @vite-ignore */ '@tauri-apps/api/path')
      const { mkdir } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
      const base = await appLocalDataDir()
      logsDirCache = `${base}/logs`
      await mkdir(logsDirCache, { recursive: true }).catch(() => {})
    }

    const { writeTextFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
    await writeTextFile(`${logsDirCache}/app.log`, JSON.stringify(entry) + '\n', { append: true })
  } catch { /* never recurse or throw */ }
}

function write(entry: LogEntry): void {
  memoryBuffer.push(entry)
  if (memoryBuffer.length > MAX_MEMORY) memoryBuffer.shift()

  persistToLocalStorage(entry)
  void appendTauriLog(entry)
}

function make(level: LogLevel, msg: string, context?: string, error?: unknown): LogEntry {
  const err = error instanceof Error ? error : undefined
  return {
    ts: new Date().toISOString(),
    level,
    msg,
    context,
    stack: err?.stack,
  }
}

export const logger = {
  info(msg: string, context?: string): void {
    write(make('info', msg, context))
  },

  warn(msg: string, context?: string): void {
    write(make('warn', msg, context))
  },

  error(msg: string, context?: string, error?: unknown): void {
    write(make('error', msg, context, error))
  },

  captureError(error: unknown, context?: string): void {
    const err = error instanceof Error ? error : new Error(String(error))
    write(make('error', err.message, context, err))
  },

  getEntries(): LogEntry[] {
    return [...memoryBuffer]
  },

  getFormatted(): string {
    return memoryBuffer.map(e => JSON.stringify(e)).join('\n')
  },

  clear(): void {
    memoryBuffer.splice(0, memoryBuffer.length)
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
  },
}

// Call this once after the app/Tauri bridge is ready (from useAppStartup)
export function initLogger(): void {
  logger.info('session-start', 'logger')
}
