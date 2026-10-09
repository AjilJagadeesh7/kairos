/** Types for opt-in web access (P7): search providers, fetched pages, approvals. */

export type WebProviderKind = 'searxng' | 'brave' | 'ddg' | 'fetch-only'

export interface WebSettings {
  /** Off by default; can be turned on only after Test connection passed. */
  enabled: boolean
  provider: WebProviderKind
  /** SearXNG instance, e.g. https://searx.example.org */
  searxngUrl: string
  /** Show each query / URL and wait for approval before sending (default on). */
  askBeforeEach: boolean
  /** fetch_url only: when non-empty, only these domains (and their subdomains). */
  allowlist: string[]
  /** fetch_url only: never these domains. */
  blocklist: string[]
  maxResults: number
  /** Bytes read from a page before extraction (default 1 MB). */
  maxPageBytes: number
  /** What passed Test connection (provider + URL + whether a key was set); edits clear it. */
  verified: string | null
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface FetchedPage {
  url: string
  title: string
  /** Main text as markdown, trimmed to the token cap. */
  text: string
  /** True when the page was cut (by size or by the token cap). */
  truncated: boolean
}

/** One web request the user approves or not (when "Ask before each request" is on). */
export type WebRequest = { kind: 'search'; query: string; provider: string } | { kind: 'fetch'; url: string }

/** A web request waiting for the user's Allow / Don't allow. */
export interface PendingWebRequest {
  request: WebRequest
  answer: (allow: boolean) => void
}

/** What the global chat gets when web access is on. Absent everywhere else (the page bubble never has it). */
export interface WebAccess {
  /** The provider's label, e.g. "SearXNG (searx.example.org)". */
  label: string
  canSearch: boolean
  search: (query: string, limit?: number) => Promise<SearchResult[]>
  fetch: (url: string) => Promise<FetchedPage>
}
