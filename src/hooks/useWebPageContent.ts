import { useEffect, useState } from 'react'
import { isDesktop } from '../utils/platform'
import { parseWebPage, type ParsedPage } from '../utils/webReader'

export type WebContentStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface WebContentState {
  status: WebContentStatus
  page: ParsedPage | null
  error: string | null
}

const IDLE: WebContentState = { status: 'idle', page: null, error: null }

/**
 * Fetch a page's HTML and parse it for reader mode / link-card fallbacks.
 *
 * Desktop routes through `mvproxy://` — the Rust scheme handler adds
 * `Access-Control-Allow-Origin: *`, so a cross-origin read is possible at all,
 * and strips the framing headers. On web and mobile builds there is no proxy and
 * CORS blocks the read, so this stays idle and the caller offers "open in
 * browser" instead.
 */
export function useWebPageContent(url: string, enabled: boolean): WebContentState {
  const [state, setState] = useState<WebContentState>(IDLE)

  useEffect(() => {
    if (!enabled || !url) { setState(IDLE); return }

    if (!isDesktop()) {
      setState({ status: 'error', page: null, error: 'Reader mode needs the desktop app.' })
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setState({ status: 'loading', page: null, error: null })

    void (async () => {
      try {
        const target = url.replace(/^https?:\/\//, 'mvproxy://')
        const res = await fetch(target, { signal: controller.signal, redirect: 'follow' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.toLowerCase().includes('html')) {
          throw new Error(`Not a web page (${contentType.split(';')[0] || 'unknown type'})`)
        }

        const html = await res.text()
        if (cancelled) return

        // Parsing walks the whole document; keep it off the paint path so a
        // large page can't jank the canvas mid-pan.
        const page = parseWebPage(html, url)
        if (cancelled) return
        setState({ status: 'ready', page, error: null })
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setState({
          status: 'error',
          page: null,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })()

    return () => { cancelled = true; controller.abort() }
  }, [url, enabled])

  return state
}
