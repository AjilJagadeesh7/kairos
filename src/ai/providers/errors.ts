/**
 * Provider failures, classified so the UI can show a clear message with a
 * "Switch provider" action. There is never a silent fallback to another
 * provider — that would send data somewhere the user didn't choose.
 */
export type ProviderErrorKind =
  | 'disabled'     // AI toggle is off
  | 'consent'      // cloud provider used before its consent dialog was accepted
  | 'config'       // missing/invalid URL, model or key
  | 'network'      // unreachable, DNS, TLS, timeout
  | 'auth'         // 401 / 403
  | 'quota'        // out of credit
  | 'rate_limit'   // 429
  | 'bad_request'  // 400 / 404 / 422 — usually a wrong model name
  | 'server'       // 5xx
  | 'invalid_output' // JSON / tool output failed validation after the retry
  | 'aborted'

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly status?: number

  constructor(kind: ProviderErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.status = status
  }
}

/** Pulls `error.message` / `error.code` out of an OpenAI-style error body. */
export function parseErrorBody(text: string): { message: string; code: string } {
  try {
    const body = JSON.parse(text) as { error?: { message?: string; code?: string; type?: string } | string; message?: string }
    if (typeof body.error === 'string') return { message: body.error, code: '' }
    return {
      message: body.error?.message ?? body.message ?? '',
      code: body.error?.code ?? body.error?.type ?? '',
    }
  } catch {
    return { message: text.slice(0, 300), code: '' }
  }
}

export function errorForStatus(status: number, bodyText: string, providerName: string): ProviderError {
  const { message, code } = parseErrorBody(bodyText)
  const detail = message ? ` — ${message}` : ''
  if (status === 401 || status === 403) {
    return new ProviderError('auth', `${providerName} rejected the API key (${status})${detail}`, status)
  }
  if (status === 402 || code === 'insufficient_quota') {
    return new ProviderError('quota', `${providerName} reports no remaining quota${detail}`, status)
  }
  if (status === 429) {
    return new ProviderError('rate_limit', `${providerName} is rate-limiting requests — try again shortly${detail}`, status)
  }
  if (status >= 500) {
    return new ProviderError('server', `${providerName} had a server error (${status})${detail}`, status)
  }
  return new ProviderError('bad_request', `${providerName} rejected the request (${status})${detail}`, status)
}
