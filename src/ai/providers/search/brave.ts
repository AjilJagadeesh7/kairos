/**
 * Brave Search API with the user's own key (free tier available).
 * `GET https://api.search.brave.com/res/v1/web/search?q=…&count=…` with
 * `X-Subscription-Token`; results in `web.results[]` (title, url, description).
 */
import { WebSearchError, cleanResults, nativeGet, type HttpGet, type SearchProvider } from './searchProvider'

export const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

export function parseBrave(text: string): Array<{ title: string; url: string; snippet: string }> {
  const body = JSON.parse(text) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }
  return (body.web?.results ?? []).map((r) => ({ title: r.title ?? '', url: r.url ?? '', snippet: (r.description ?? '').replace(/<[^>]+>/g, '') }))
}

export function braveProvider(apiKey: string, get: HttpGet = nativeGet): SearchProvider {
  return {
    label: 'Brave Search',
    async search(query, limit, signal) {
      const count = Math.min(20, Math.max(1, limit))
      const { status, text } = await get(`${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`, {
        Accept: 'application/json', 'X-Subscription-Token': apiKey,
      }, signal)
      if (status === 401 || status === 403 || status === 422) throw new WebSearchError('Brave Search rejected the API key.')
      if (status === 429) throw new WebSearchError('Brave Search rate limit reached (free tier: about 1 request per second, limited per month).')
      if (status < 200 || status >= 300) throw new WebSearchError(`Brave Search answered ${status}.`)
      try {
        return cleanResults(parseBrave(text), limit)
      } catch {
        throw new WebSearchError('Brave Search sent a response that isn\'t search results.')
      }
    },
  }
}
