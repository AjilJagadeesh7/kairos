/** Types for the on-device model (P8, Full build only): runtime contract, downloads, device check. */

export interface DeviceInfo {
  totalRam: number
  availableRam: number
  /** Free bytes on the volume that holds the models folder. */
  freeDisk: number
}

/** A model file's state on disk. */
export interface ModelStatus {
  id: string
  /** none = not downloaded; partial = a paused/interrupted download; ready = complete and SHA-256 verified. */
  state: 'none' | 'partial' | 'ready'
  bytes: number
  path: string | null
}

export type ModelDownloadEvent =
  | { type: 'progress'; done: number; total: number }
  | { type: 'verifying' }
  | { type: 'done'; path: string }
  | { type: 'paused'; done: number }
  | { type: 'error'; message: string }

/** One generation request to the native runtime. The chat template is applied natively. */
export interface LocalGenerateRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens: number
  temperature: number
  stop?: string[]
  /** GBNF grammar; when set, decoding is constrained to it. */
  grammar?: string
  /** Let a reasoning model think before answering (off: the answer starts right away). */
  thinking?: boolean
}

export type LocalTokenEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; promptTokens: number; completionTokens: number }
  | { type: 'error'; message: string }

/**
 * The native on-device runtime: llama.cpp behind Tauri commands (desktop,
 * `local-llm` feature) or a Capacitor plugin (Android, `full` flavor).
 */
export interface LocalRuntime {
  /** False when this build or platform has no runtime. */
  available(): Promise<boolean>
  load(modelPath: string, contextTokens: number): Promise<void>
  unload(): Promise<void>
  /** Resolves after the `done` event (or rejects on `error`). */
  generate(request: LocalGenerateRequest, onEvent: (e: LocalTokenEvent) => void): Promise<void>
  abort(): Promise<void>
}
