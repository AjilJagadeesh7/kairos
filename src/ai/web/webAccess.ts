/**
 * Web access for the global chat (P7): search through the chosen provider
 * and read pages, with the user's approval of each request when "Ask before
 * each request" is on, and the domain allow/block lists for pages. Requests
 * go through the native HTTP layer; nothing passes through a Kairos server.
 */
import { streamHttp } from '../transport/httpStream'
import { estimateTokens } from '../text/tokens'
import { BROWSER_UA, WebSearchError, hostOf, type SearchProvider } from '../providers/search/searchProvider'
import { extractMain, looksLikeHtml } from './extract'
import type { FetchedPage, SearchResult, WebAccess, WebRequest, WebSettings } from '../../types'

/** Fetched pages are trimmed to this many tokens (PRD: ~2–3k). */
export const PAGE_TOKENS = 2_500

/** The user said no to a request, or it was stopped before approval. */
export class WebDeclined extends Error {
  constructor(what: string) { super(`You didn't allow ${what}`); this.name = 'WebDeclined' }
}

const matches = (host: string, domain: string) => {
  const d = domain.trim().toLowerCase().replace(/^\*?\.?/, '')
  return !!d && (host === d || host.endsWith(`.${d}`))
}

/** Whether `url` may be fetched under the allow/block lists. */
export function domainAllowed(url: string, allow: string[], block: string[]): { ok: true } | { ok: false; reason: string } {
  let host: string
  try { host = new URL(url).hostname.toLowerCase() } catch { return { ok: false, reason: 'That isn\'t a valid URL' } }
  if (!/^https?:/i.test(url)) return { ok: false, reason: 'Only http(s) pages can be read' }
  if (block.some((d) => matches(host, d))) return { ok: false, reason: `${host} is on your blocklist` }
  if (allow.filter((d) => d.trim()).length && !allow.some((d) => matches(host, d))) return { ok: false, reason: `${host} isn't on your allowlist` }
  return { ok: true }
}

/** The first `maxTokens` of `text`, word by word. */
function cap(text: string, maxTokens: number): { text: string; cut: boolean } {
  if (estimateTokens(text) <= maxTokens) return { text, cut: false }
  let out = ''
  for (const w of text.split(/(\s+)/)) {
    if (estimateTokens(out + w) > maxTokens) break
    out += w
  }
  return { text: out, cut: true }
}

export interface FetchDeps {
  /** Streams a GET; defaults to the native layer (HTTPS unless local, like providers). */
  send?: typeof streamHttp
  parse?: (html: string) => Document
}

/** Reads at most `maxBytes` of a page, then extracts its main text. */
export async function fetchPage(url: string, maxBytes: number, deps: FetchDeps = {}, signal?: AbortSignal): Promise<FetchedPage> {
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await (deps.send ?? streamHttp)({
      url, method: 'GET', headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
    }, ctrl.signal)
    if (res.status < 200 || res.status >= 300) throw new WebSearchError(`${hostOf(url)} answered ${res.status}`)
    let body = ''
    let tooBig = false
    for await (const chunk of res.body) {
      body += chunk
      if (body.length > maxBytes) { body = body.slice(0, maxBytes); tooBig = true; ctrl.abort(); break }
    }
    const page = looksLikeHtml(body) ? extractMain(body, deps.parse) : { title: '', text: body.replace(/[^\P{C}\n\t]/gu, '') }
    const capped = cap(page.text, PAGE_TOKENS)
    return { url, title: page.title || hostOf(url), text: capped.text, truncated: capped.cut || tooBig }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

export function createWebAccess(opts: {
  settings: WebSettings
  provider: SearchProvider | null
  /** Resolves true when the user allows the request. Called only when askBeforeEach is on. */
  confirm: (req: WebRequest) => Promise<boolean>
  fetchDeps?: FetchDeps
}): WebAccess {
  const { settings, provider } = opts
  const approve = async (req: WebRequest, what: string) => {
    if (settings.askBeforeEach && !(await opts.confirm(req))) throw new WebDeclined(what)
  }
  return {
    label: provider?.label ?? 'Fetch only',
    canSearch: !!provider,
    async search(query: string, limit = settings.maxResults): Promise<SearchResult[]> {
      if (!provider) throw new WebSearchError('Web search is off (fetch-only mode): paste a link to have it read')
      const q = query.trim().slice(0, 400)
      await approve({ kind: 'search', query: q, provider: provider.label }, `the search "${q}"`)
      return provider.search(q, Math.min(limit, settings.maxResults))
    },
    async fetch(url: string): Promise<FetchedPage> {
      const allowed = domainAllowed(url, settings.allowlist, settings.blocklist)
      if (!allowed.ok) throw new WebSearchError(allowed.reason)
      await approve({ kind: 'fetch', url }, `reading ${url}`)
      return fetchPage(url, settings.maxPageBytes, opts.fetchDeps)
    },
  }
}
