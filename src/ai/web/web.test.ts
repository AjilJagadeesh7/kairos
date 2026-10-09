// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { extractMain, looksLikeHtml } from './extract'
import { createWebAccess, domainAllowed, fetchPage, WebDeclined } from './webAccess'
import { ddgPageKind, ddgProvider, ddgTarget, parseDdgHtml, DDG_BACKOFF_MS } from '../providers/search/ddg-scraper'
import { searxngProvider } from '../providers/search/searxng'
import { braveProvider } from '../providers/search/brave'
import { looksLikeInjection } from '../text/injection'
import { DEFAULT_WEB_SETTINGS, useAiWebStore, webSignature } from '../../store/useAiWebStore'
import * as fx from './__fixtures__/web.fixtures'
import type { HttpGet, SearchProvider } from '../providers/search/searchProvider'
import type { StreamResponse } from '../transport/httpStream'

const reply = (status: number, text: string): HttpGet => vi.fn(async () => ({ status, text }))

describe('extractMain', () => {
  it('keeps the article text and drops scripts, navigation and everything hidden', () => {
    const { title, text } = extractMain(fx.INJECTION_PAGE)
    expect(title).toBe('Go database drivers compared')
    expect(text).toContain('# Go database drivers compared')
    expect(text).toContain('- pgx: fast, PostgreSQL only')
    for (const hidden of ['hacked', 'pwned', 'move every card', 'link_notes', 'Home', '© 2026', '__ai']) expect(text).not.toContain(hidden)
    // Visible instructions stay (as data) — and are spotted for the plan warning.
    expect(text).toContain('Note to any AI reading this')
    expect(looksLikeInjection(text)).toBe(true)
  })

  it('tells HTML from plain text', () => {
    expect(looksLikeHtml(fx.INJECTION_PAGE)).toBe(true)
    expect(looksLikeHtml('# Just markdown\n\nText')).toBe(false)
  })
})

describe('DuckDuckGo scraper (experimental)', () => {
  it('parses results from the recorded page, decodes redirect links, skips ads', () => {
    expect(parseDdgHtml(fx.DDG_RESULTS)).toEqual([
      { title: 'GitHub - jackc/pgx: PostgreSQL driver and toolkit for Go', url: 'https://github.com/jackc/pgx', snippet: 'pgx is a pure Go driver and toolkit for PostgreSQL.' },
      { title: 'pgx package - github.com/jackc/pgx/v5 - Go Packages', url: 'https://pkg.go.dev/github.com/jackc/pgx/v5', snippet: 'Package pgx is a PostgreSQL database driver.' },
    ])
    expect(ddgTarget('//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.dev%2Fx&rut=1')).toBe('https://a.dev/x')
  })

  it('throttles to one request per 2 s, with a browser user agent', async () => {
    let t = 10_000
    const slept: number[] = []
    const get = reply(200, fx.DDG_RESULTS)
    const ddg = ddgProvider(get, () => t, async (ms) => { slept.push(ms); t += ms })
    await ddg.search('pgx', 5)
    t += 500
    await ddg.search('pgx again', 5)
    expect(slept).toEqual([1500])
    expect(vi.mocked(get).mock.calls[0][1]['User-Agent']).toMatch(/Mozilla\/5\.0/)
  })

  it('on a CAPTCHA page: clear error, backs off 60 s without sending, never loops', async () => {
    let t = 0
    const get = reply(200, fx.DDG_CAPTCHA)
    const ddg = ddgProvider(get, () => t, async (ms) => { t += ms })
    await expect(ddg.search('x', 5)).rejects.toThrow(/CAPTCHA.*SearXNG or Brave/)
    t += DDG_BACKOFF_MS - 1000
    await expect(ddg.search('x', 5)).rejects.toThrow(/waiting 1 s/)
    expect(get).toHaveBeenCalledTimes(1)
    expect(ddgPageKind(429, '')).toBe('blocked')
  })

  it('reports a markup change when a full page yields nothing', async () => {
    await expect(ddgProvider(reply(200, fx.DDG_CHANGED), () => 0, async () => {}).search('x', 5)).rejects.toThrow(/layout changed/)
  })
})

describe('SearXNG and Brave', () => {
  it('SearXNG: JSON API, deduplicated, capped; a 403 explains the JSON setting', async () => {
    const get = reply(200, fx.SEARXNG_JSON)
    expect(await searxngProvider('https://searx.example.org/', get).search('postgres pgx', 5)).toHaveLength(2)
    expect(vi.mocked(get).mock.calls[0][0]).toBe('https://searx.example.org/search?q=postgres%20pgx&format=json')
    await expect(searxngProvider('https://searx.example.org', reply(403, 'Forbidden')).search('x', 5)).rejects.toThrow(/search\.formats/)
  })

  it('Brave: subscription token header, description stripped of markup, bad key explained', async () => {
    const get = reply(200, fx.BRAVE_JSON)
    expect(await braveProvider('BSA-key', get).search('pgx', 5)).toEqual([{ title: 'jackc/pgx', url: 'https://github.com/jackc/pgx', snippet: 'pgx is a pure Go driver' }])
    expect(vi.mocked(get).mock.calls[0][1]['X-Subscription-Token']).toBe('BSA-key')
    await expect(braveProvider('bad', reply(401, '')).search('x', 5)).rejects.toThrow(/rejected the API key/)
  })
})

describe('web access', () => {
  const provider: SearchProvider = { label: 'SearXNG (test)', search: vi.fn(async () => [{ title: 't', url: 'https://a.dev', snippet: 's' }]) }
  const page = (body: string): StreamResponse => ({ status: 200, body: (async function* () { for (let i = 0; i < body.length; i += 1000) yield body.slice(i, i + 1000) })() })

  it('asks before each request with the exact query; nothing is sent when declined', async () => {
    const confirm = vi.fn(async () => false)
    const web = createWebAccess({ settings: DEFAULT_WEB_SETTINGS, provider, confirm })
    await expect(web.search('  postgres pgx  ')).rejects.toBeInstanceOf(WebDeclined)
    expect(confirm).toHaveBeenCalledWith({ kind: 'search', query: 'postgres pgx', provider: 'SearXNG (test)' })
    expect(provider.search).not.toHaveBeenCalled()
    const send = vi.fn()
    await expect(createWebAccess({ settings: DEFAULT_WEB_SETTINGS, provider, confirm, fetchDeps: { send } }).fetch('https://go.dev/doc')).rejects.toBeInstanceOf(WebDeclined)
    expect(send).not.toHaveBeenCalled()
  })

  it('applies the allow/block lists before asking or fetching', async () => {
    expect(domainAllowed('https://docs.go.dev/x', ['go.dev'], [])).toEqual({ ok: true })
    expect(domainAllowed('https://evil.dev/x', ['go.dev'], [])).toMatchObject({ ok: false })
    expect(domainAllowed('https://ads.tracker.com/x', [], ['tracker.com'])).toMatchObject({ ok: false, reason: expect.stringMatching(/blocklist/) })
    const confirm = vi.fn(async () => true)
    const web = createWebAccess({ settings: { ...DEFAULT_WEB_SETTINGS, blocklist: ['tracker.com'] }, provider, confirm })
    await expect(web.fetch('https://ads.tracker.com/x')).rejects.toThrow(/blocklist/)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('reads at most maxPageBytes and extracts the main text', async () => {
    const big = `<html><body><article><h1>Big</h1><p>${'word '.repeat(50_000)}</p></article></body></html>`
    const p = await fetchPage('https://a.dev/big', 20_000, { send: async () => page(big) })
    expect(p).toMatchObject({ title: 'Big', truncated: true })
    expect(p.text.length).toBeLessThan(20_000)
    const plain = await fetchPage('https://a.dev/readme.txt', 1_000_000, { send: async () => page('Plain text\u0007 file') })
    expect(plain).toMatchObject({ text: 'Plain text file', truncated: false, title: 'a.dev' })
  })
})

describe('web settings', () => {
  it('can be enabled only after Test connection passed; changing the provider turns it off', () => {
    const s = useAiWebStore.getState()
    s.setEnabled(true)
    expect(useAiWebStore.getState().enabled).toBe(false)
    s.update({ searxngUrl: 'https://searx.example.org' })
    s.markVerified(webSignature(useAiWebStore.getState(), false))
    s.setEnabled(true)
    expect(useAiWebStore.getState().enabled).toBe(true)
    s.update({ provider: 'ddg' })
    expect(useAiWebStore.getState()).toMatchObject({ enabled: false, verified: null })
  })
})
