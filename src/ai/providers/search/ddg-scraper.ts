/**
 * DuckDuckGo (experimental, unofficial). There is no official API: this
 * reads DDG's HTML results page, the same approach as Open WebUI's `ddgs`.
 * The one JS port (`duck-duck-scrape`, last released Jan 2025) runs on Node's
 * HTTP stack, so it can't go through the app's native layer; this is an
 * in-house parser instead. Isolated: delete this file and its settings entry
 * to remove it.
 *
 * Rules (PRD): 1 request per 2 s; a normal browser user agent; detect rate
 * limits, CAPTCHA pages and markup changes; after a block, back off ≥ 60 s;
 * never retry in a loop; never chosen automatically.
 */
import { BROWSER_UA, WebSearchError, cleanResults, nativeGet, type HttpGet, type SearchProvider } from './searchProvider'

export const DDG_ENDPOINT = 'https://html.duckduckgo.com/html/'
export const DDG_MIN_INTERVAL_MS = 2_000
export const DDG_BACKOFF_MS = 60_000

const SUGGEST = 'Use SearXNG or Brave Search in Settings → AI → Web access for reliable results.'

/** `//duckduckgo.com/l/?uddg=<encoded>&rut=…` → the real URL. */
export function ddgTarget(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/)
  if (m) { try { return decodeURIComponent(m[1]) } catch { /* fall through */ } }
  return href.startsWith('//') ? `https:${href}` : href
}

/** What a results page says about itself. */
export function ddgPageKind(status: number, html: string): 'blocked' | 'no-results' | 'results' {
  if (status === 202 || status === 403 || status === 418 || status === 429) return 'blocked'
  if (/anomaly-modal|bots use DuckDuckGo too|g-recaptcha|challenge-form/i.test(html)) return 'blocked'
  if (/class="no-results"|No results\.|No more results/i.test(html) && !/class="result__a"/.test(html)) return 'no-results'
  return 'results'
}

export function parseDdgHtml(html: string, parse: (h: string) => Document = (h) => new DOMParser().parseFromString(h, 'text/html')) {
  const doc = parse(html)
  return [...doc.querySelectorAll('.result')]
    .filter((el) => !el.classList.contains('result--ad'))
    .map((el) => {
      const a = el.querySelector('a.result__a')
      return {
        title: a?.textContent ?? '',
        url: ddgTarget(a?.getAttribute('href') ?? ''),
        snippet: el.querySelector('.result__snippet')?.textContent ?? '',
      }
    })
    .filter((r) => r.title && r.url)
}

/** One scraper per app session: the throttle and back-off are shared across chats. */
export function ddgProvider(get: HttpGet = nativeGet, now: () => number = Date.now, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): SearchProvider {
  let last = 0
  let blockedUntil = 0
  return {
    label: 'DuckDuckGo (experimental)',
    async search(query, limit, signal) {
      if (now() < blockedUntil) {
        throw new WebSearchError(`DuckDuckGo blocked recent requests; waiting ${Math.ceil((blockedUntil - now()) / 1000)} s before trying again. ${SUGGEST}`)
      }
      const wait = last + DDG_MIN_INTERVAL_MS - now()
      if (wait > 0) await sleep(wait)
      last = now()
      const { status, text } = await get(`${DDG_ENDPOINT}?q=${encodeURIComponent(query)}`, {
        'User-Agent': BROWSER_UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.8',
      }, signal)
      const kind = ddgPageKind(status, text)
      if (kind === 'blocked') {
        blockedUntil = now() + DDG_BACKOFF_MS
        throw new WebSearchError(`DuckDuckGo is rate-limiting or asking for a CAPTCHA. Paused for 60 s. ${SUGGEST}`)
      }
      if (status < 200 || status >= 300) throw new WebSearchError(`DuckDuckGo answered ${status}. ${SUGGEST}`)
      if (kind === 'no-results') return []
      const results = parseDdgHtml(text)
      // A page with content but nothing parsed means DDG changed its markup.
      if (!results.length && text.trim().length > 500) {
        throw new WebSearchError(`DuckDuckGo's page layout changed and its results can't be read any more. ${SUGGEST}`)
      }
      return cleanResults(results, limit)
    },
  }
}
