/**
 * Builds the global chat's web access from the settings, and runs Test
 * connection. Returns null — and nothing web-related runs — unless both the
 * AI assistant and web access are on and the test passed.
 */
import { useAiStore } from '../../store/useAiStore'
import { useAiWebStore, webSignature } from '../../store/useAiWebStore'
import { getSecret, SECRET_KEYS } from '../../secrets/secureStore'
import { searxngProvider } from '../providers/search/searxng'
import { braveProvider } from '../providers/search/brave'
import { ddgProvider } from '../providers/search/ddg-scraper'
import { WebSearchError, type SearchProvider } from '../providers/search/searchProvider'
import { createWebAccess, fetchPage } from './webAccess'
import type { WebAccess, WebRequest, WebSettings } from '../../types'

// One DuckDuckGo scraper per session, so its throttle and back-off hold across chats.
let ddg: SearchProvider | null = null

export const getBraveKey = () => getSecret(SECRET_KEYS.braveSearch)

export function searchProviderFor(s: WebSettings, braveKey: string | null): SearchProvider | null {
  switch (s.provider) {
    case 'searxng': return s.searxngUrl.trim() ? searxngProvider(s.searxngUrl) : null
    case 'brave': return braveKey ? braveProvider(braveKey) : null
    case 'ddg': return (ddg ??= ddgProvider())
    case 'fetch-only': return null
  }
}

/** The web access the global chat gets, or null when it's off. */
export async function webAccessFor(confirm: (req: WebRequest) => Promise<boolean>): Promise<WebAccess | null> {
  const s = useAiWebStore.getState()
  if (!useAiStore.getState().enabled || !s.enabled || !s.verified) return null
  const braveKey = s.provider === 'brave' ? await getBraveKey() : null
  if (s.verified !== webSignature(s, !!braveKey)) return null
  const provider = searchProviderFor(s, braveKey)
  if (s.provider !== 'fetch-only' && !provider) return null
  return createWebAccess({ settings: s, provider, confirm })
}

/** One real search (or, fetch-only, one page read). Resolves with a short summary; throws a clear error. */
export async function testWebConnection(s: WebSettings, braveKey: string | null): Promise<string> {
  if (s.provider === 'fetch-only') {
    const page = await fetchPage('https://example.com/', s.maxPageBytes)
    return `Read “${page.title}”.`
  }
  if (s.provider === 'searxng' && !s.searxngUrl.trim()) throw new WebSearchError('Enter your SearXNG instance URL')
  if (s.provider === 'brave' && !braveKey) throw new WebSearchError('Enter your Brave Search API key')
  const provider = searchProviderFor(s, braveKey)!
  const results = await provider.search('kairos notes app', 3)
  if (!results.length) throw new WebSearchError(`${provider.label} answered but returned no results`)
  return `${provider.label} returned ${results.length} results.`
}
