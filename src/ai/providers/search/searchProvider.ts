/**
 * Web search providers (P7) behind one interface. Requests go through the
 * native HTTP layer (`requestText`), never a Kairos server. Each provider
 * file is self-contained, so one can be removed without touching the others.
 */
import { requestText } from '../../transport/httpStream'
import type { SearchResult } from '../../../types'

export interface SearchProvider {
  /** e.g. "SearXNG (searx.example.org)". */
  label: string
  search(query: string, limit: number, signal?: AbortSignal): Promise<SearchResult[]>
}

/** GET returning status and body text. Injected so tests run on recorded responses. */
export type HttpGet = (url: string, headers: Record<string, string>, signal?: AbortSignal) => Promise<{ status: number; text: string }>

export const nativeGet: HttpGet = (url, headers, signal) => requestText({ url, method: 'GET', headers }, signal)

/** A search failure with a message meant for the user. */
export class WebSearchError extends Error {
  constructor(message: string) { super(message); this.name = 'WebSearchError' }
}

/** A normal desktop browser's user agent, for providers that serve HTML to browsers only. */
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

export function hostOf(url: string): string {
  try { return new URL(url).host } catch { return url }
}

/** Trims, drops empty and duplicate URLs, caps the count. */
export function cleanResults(results: SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>()
  const out: SearchResult[] = []
  for (const r of results) {
    const url = r.url.trim()
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
    seen.add(url)
    out.push({ title: r.title.replace(/\s+/g, ' ').trim() || url, url, snippet: r.snippet.replace(/\s+/g, ' ').trim() })
    if (out.length >= limit) break
  }
  return out
}
