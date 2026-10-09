/**
 * SearXNG (recommended): a metasearch instance the user runs or trusts. Uses
 * its JSON API, `GET /search?q=…&format=json` (docs.searxng.org/dev/search_api),
 * which the instance must enable under `search.formats` in settings.yml.
 */
import { WebSearchError, cleanResults, hostOf, nativeGet, type HttpGet, type SearchProvider } from './searchProvider'

export function parseSearxng(text: string): Array<{ title: string; url: string; snippet: string }> {
  const body = JSON.parse(text) as { results?: Array<{ title?: string; url?: string; content?: string }> }
  if (!Array.isArray(body.results)) throw new Error('no results array')
  return body.results.map((r) => ({ title: r.title ?? '', url: r.url ?? '', snippet: r.content ?? '' }))
}

export function searxngProvider(baseUrl: string, get: HttpGet = nativeGet): SearchProvider {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return {
    label: `SearXNG (${hostOf(base)})`,
    async search(query, limit, signal) {
      const { status, text } = await get(`${base}/search?q=${encodeURIComponent(query)}&format=json`, { Accept: 'application/json' }, signal)
      if (status === 403) throw new WebSearchError(`${hostOf(base)} doesn't allow JSON results. Enable "json" under search.formats in its settings.yml, or use another instance.`)
      if (status === 429) throw new WebSearchError(`${hostOf(base)} is rate-limiting requests — try again shortly.`)
      if (status < 200 || status >= 300) throw new WebSearchError(`${hostOf(base)} answered ${status} — check the instance URL.`)
      try {
        return cleanResults(parseSearxng(text), limit)
      } catch {
        throw new WebSearchError(`${hostOf(base)} didn't return SearXNG JSON — check the instance URL.`)
      }
    },
  }
}
