import { useEffect, useState } from 'react'
import { useAiWebStore, webSignature } from '../../../store/useAiWebStore'
import { getBraveKey, testWebConnection } from '../../../ai/web/webSetup'
import { setSecret, SECRET_KEYS } from '../../../secrets/secureStore'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'
import { Button } from '../../atoms/Button'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import { Select, type SelectOption } from '../../atoms/Select'
import { Icon } from '../../../icons/Icon'
import type { WebProviderKind } from '../../../types'

const PROVIDERS: SelectOption<WebProviderKind>[] = [
  { value: 'searxng', label: 'SearXNG (recommended)' },
  { value: 'brave', label: 'Brave Search API' },
  { value: 'ddg', label: 'DuckDuckGo (experimental, unofficial)' },
  { value: 'fetch-only', label: 'Fetch only (no search)' },
]

const HINT: Record<WebProviderKind, string> = {
  searxng: 'Your own or a trusted public instance. It queries Google, Bing, DuckDuckGo, Brave and others and merges the results. Its JSON API must be enabled (search.formats in settings.yml).',
  brave: 'Brave\'s official API with your own key (free tier available). The key is kept in your OS secure storage.',
  ddg: 'Scrapes DuckDuckGo\'s results pages. Not an official API: it may stop working at any time.',
  'fetch-only': 'No search: the assistant can only read links you paste into the chat.',
}

const list = (v: string[]) => v.join(', ')
const parseList = (v: string) => v.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean)

/** Settings → AI → Web access (P7): off by default, enabled only after Test connection passes. */
export function AiWebCard() {
  const web = useAiWebStore()
  const [braveDraft, setBraveDraft] = useState('')
  const [hasBraveKey, setHasBraveKey] = useState(false)
  const [test, setTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({ status: 'idle' })
  const [allow, setAllow] = useState(list(web.allowlist))
  const [block, setBlock] = useState(list(web.blocklist))

  useEffect(() => { void getBraveKey().then((k) => setHasBraveKey(!!k)).catch(() => {}) }, [])

  const signature = webSignature(web, hasBraveKey)
  const verified = web.verified === signature

  async function runTest() {
    setTest({ status: 'testing' })
    try {
      let key = hasBraveKey ? await getBraveKey() : null
      if (web.provider === 'brave' && braveDraft.trim()) {
        await setSecret(SECRET_KEYS.braveSearch, braveDraft.trim())
        key = braveDraft.trim()
        setBraveDraft('')
        setHasBraveKey(true)
      }
      const message = await testWebConnection(web, key)
      web.markVerified(webSignature(web, !!key))
      setTest({ status: 'ok', message })
    } catch (err) {
      web.markVerified(null)
      setTest({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <SectionCard title="Web access">
      <div className="space-y-3">
        <p className="text-xs text-text2">
          Lets the global chat search the web and read pages. Only the search queries and pages go to the network; the page bubble never gets web access.
        </p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-text">Search provider</p>
          <Select value={web.provider} options={PROVIDERS} onChange={(provider) => { web.update({ provider }); setTest({ status: 'idle' }) }} />
        </div>
        <p className="text-[11px] text-text3">{HINT[web.provider]}</p>
        {web.provider === 'searxng' && (
          <Field label="SearXNG instance URL" placeholder="https://searx.example.org" value={web.searxngUrl} onChange={(searxngUrl) => web.update({ searxngUrl })} type="url" mono />
        )}
        {web.provider === 'brave' && (
          <Field label={hasBraveKey ? 'Brave API key (saved — leave blank to keep)' : 'Brave API key'} placeholder="BSA…" value={braveDraft}
            onChange={(v) => { setBraveDraft(v); if (verified) web.markVerified(null) }} type="password" mono />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="hollow" size="sm" disabled={test.status === 'testing'} onClick={() => void runTest()}>
            {test.status === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          {test.status === 'ok' && <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><Icon name="check-circle-2" size={11} /> {test.message}</span>}
          {test.status === 'error' && <span role="alert" className="flex items-start gap-1 text-[11px] text-red-500"><Icon name="alert-triangle" size={11} className="mt-px shrink-0" /> {test.message}</span>}
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
          <div>
            <p className="text-sm text-text">Enable web access</p>
            <p className="text-[11px] text-text3">{verified ? 'Queries are sent to the chosen provider; Kairos servers are never involved.' : 'Pass Test connection first.'}</p>
          </div>
          <span className={verified ? '' : 'pointer-events-none opacity-50'}>
            <ToggleSwitch size="md" checked={web.enabled && verified} onChange={web.setEnabled} label="Enable web access" />
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text">Ask before each request</p>
            <p className="text-[11px] text-text3">Shows the exact query or URL and waits for you to allow it.</p>
          </div>
          <ToggleSwitch size="md" checked={web.askBeforeEach} onChange={(askBeforeEach) => web.update({ askBeforeEach })} label="Ask before each request" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Only read pages from (optional)" placeholder="wikipedia.org, go.dev" value={allow} onChange={(v) => { setAllow(v); web.update({ allowlist: parseList(v) }) }} mono />
          <Field label="Never read pages from" placeholder="example.com" value={block} onChange={(v) => { setBlock(v); web.update({ blocklist: parseList(v) }) }} mono />
          <Field label="Max results per search" value={String(web.maxResults)} onChange={(v) => web.update({ maxResults: Math.min(20, Math.max(1, parseInt(v, 10) || 5)) })} type="number" />
          <Field label="Max page size (KB)" value={String(Math.round(web.maxPageBytes / 1000))} onChange={(v) => web.update({ maxPageBytes: Math.min(10_000, Math.max(50, parseInt(v, 10) || 1000)) * 1000 })} type="number" />
        </div>
      </div>
    </SectionCard>
  )
}
