/**
 * One web tool call (web_search / fetch_url) for the agent, through the
 * user's web access: each request waits for approval when asked to, and
 * failures or refusals come back as text, never exceptions.
 */
import { WebDeclined } from '../web/webAccess'
import type { ToolCall, WebAccess } from '../../types'

export interface WebFind { url: string; title: string; text: string; kind: 'page' | 'result' }

export interface WebToolOutcome {
  /** What goes back to the model (inside a <web_content> block). */
  text: string
  finds: WebFind[]
  declined: boolean
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Runs one web_search / fetch_url call. Failures and refusals become text, never exceptions. */
export async function runWebTool(call: ToolCall, web: WebAccess): Promise<WebToolOutcome> {
  try {
    if (call.name === 'web_search') {
      const query = str(call.args.query)
      const results = await web.search(query, typeof call.args.limit === 'number' ? call.args.limit : undefined)
      return {
        text: `## web_search "${query}"\n${results.length ? results.map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}`).join('\n') : 'No results.'}`,
        finds: results.map((r) => ({ url: r.url, title: r.title, text: r.snippet, kind: 'result' as const })),
        declined: false,
      }
    }
    const url = str(call.args.url)
    const page = await web.fetch(url)
    return {
      text: `## fetch_url ${url}\nTitle: ${page.title}\n${page.text}${page.truncated ? '\n[… the rest of the page was cut]' : ''}`,
      finds: [{ url: page.url, title: page.title, text: page.text, kind: 'page' }],
      declined: false,
    }
  } catch (err) {
    const declined = err instanceof WebDeclined
    return { text: `## ${call.name} ${declined ? 'not allowed by the user' : `failed: ${(err as Error).message}`}`, finds: [], declined }
  }
}
