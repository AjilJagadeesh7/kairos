import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ModalShell } from '../../molecules/ModalShell'
import { Field } from '../../molecules/Field'
import { Button } from '../../atoms/Button'
import { LocationBadge } from '../../atoms/LocationBadge'
import { Icon } from '../../../icons/Icon'
import { ConsentDialog } from './ConsentDialog'
import { PROVIDER_PRESETS, PROVIDER_TYPES, MAX_CONTEXT_TOKENS } from './providerPresets'
import { Select } from '../../atoms/Select'
import { useAiStore } from '../../../store/useAiStore'
import { useProviderTest } from '../../../hooks/useProviderTest'
import { checkProviderUrl, locationForUrl } from '../../../ai/net/urlPolicy'
import { getProviderKey, setProviderKey, supportsEmbeddings } from '../../../ai/providers/registry'
import { isSecureStorePersistent } from '../../../secrets/secureStore'
import type { AiProviderConfig, AiProviderType } from '../../../types'

interface ProviderEditorModalProps {
  /** Omit to add a new provider. */
  existing?: AiProviderConfig
  onClose: () => void
}

const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, '')

export function ProviderEditorModal({ existing, onClose }: ProviderEditorModalProps) {
  const addProvider    = useAiStore((s) => s.addProvider)
  const updateProvider = useAiStore((s) => s.updateProvider)
  const markVerified   = useAiStore((s) => s.markVerified)

  // New providers get their id up front: consent is recorded per id before saving.
  const [id] = useState(() => existing?.id ?? uuid())
  const [type, setType] = useState<AiProviderType>(existing?.type ?? 'openai-compat')
  const [name, setName] = useState(existing?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '')
  const [model, setModel] = useState(existing?.model ?? '')
  const [contextTokens, setContextTokens] = useState(String(existing?.contextTokens ?? 8192))
  const [embeddingModel, setEmbeddingModel] = useState(existing?.embeddingModel ?? '')
  const [apiKey, setApiKey] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const tester = useProviderTest()

  useEffect(() => {
    if (existing) void getProviderKey(existing.id).then((k) => setHasStoredKey(Boolean(k))).catch(() => {})
  }, [existing])

  const url = normalizeUrl(baseUrl)
  const urlCheck = url ? checkProviderUrl(url) : null
  const tokens = Math.min(MAX_CONTEXT_TOKENS, Math.max(1024, parseInt(contextTokens, 10) || 8192))
  const draft: AiProviderConfig = useMemo(() => ({
    id, type, name: name.trim() || hostLabel(url), baseUrl: url, model: model.trim(),
    verified: false, contextTokens: tokens, createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...(embeddingModel.trim() && supportsEmbeddings({ type }) ? { embeddingModel: embeddingModel.trim() } : {}),
  }), [id, type, name, url, model, tokens, embeddingModel, existing?.createdAt])
  const typeInfo = PROVIDER_TYPES.find((t) => t.value === type) ?? PROVIDER_TYPES[0]

  // Anything that changes what Test connection exercised invalidates its result.
  const signature = `${type}|${url}|${draft.model}|${apiKey.trim() || (hasStoredKey ? 'stored' : '')}`
  const canTest = Boolean(urlCheck?.ok && draft.model)
  const tested = tester.passed(signature)

  function applyPreset(i: number) {
    const p = PROVIDER_PRESETS[i]
    setType(p.type)
    setEmbeddingModel(p.embeddingModel ?? '')
    setName(p.name)
    setBaseUrl(p.baseUrl)
    setContextTokens(String(p.contextTokens))
  }

  async function save() {
    setSaving(true)
    try {
      const values = { type: draft.type, name: draft.name, baseUrl: draft.baseUrl, model: draft.model, contextTokens: draft.contextTokens, embeddingModel: draft.embeddingModel }
      if (existing) updateProvider(id, values)
      else addProvider(values, id)
      if (apiKey.trim()) await setProviderKey(id, apiKey)
      // A rename alone keeps an earlier pass; new URL, model or key needs a fresh test.
      const unchanged = existing && existing.type === draft.type && existing.baseUrl === draft.baseUrl && existing.model === draft.model && !apiKey.trim()
      markVerified(id, tested || Boolean(unchanged && existing.verified))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{existing ? 'Edit provider' : 'Add AI provider'}</h2>
          {urlCheck?.ok && <LocationBadge location={locationForUrl(url)} />}
        </div>

        {!existing && (
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_PRESETS.map((p, i) => (
              <Button key={p.label} variant="pill" size="xs" onClick={() => applyPreset(i)}>{p.label}</Button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-text2">Provider type</span>
          <Select value={type} options={PROVIDER_TYPES.map((t) => ({ value: t.value, label: t.label }))} onChange={(v) => setType(v as AiProviderType)} />
        </div>
        <Field label="Name" placeholder="e.g. Ollama on my desktop" value={name} onChange={setName} />
        <div className="space-y-1">
          <Field label={typeInfo.urlLabel} placeholder={typeInfo.urlPlaceholder} value={baseUrl} onChange={setBaseUrl} type="url" mono />
          {urlCheck && !urlCheck.ok && <p className="text-[11px] text-red-500">{urlCheck.reason}</p>}
        </div>
        <div className="space-y-1">
          <Field
            label={hasStoredKey ? 'API key (saved — leave blank to keep)' : 'API key (optional for local servers)'}
            placeholder={hasStoredKey ? '••••••••' : 'sk-…'}
            value={apiKey}
            onChange={setApiKey}
            type="password"
            mono
          />
          <p className="flex items-center gap-1 text-[11px] text-text3">
            <Icon name="lock" size={10} />
            {isSecureStorePersistent()
              ? 'Stored in your OS secure storage. Never synced, logged or exported.'
              : 'This environment has no secure storage — the key is kept in memory until reload.'}
          </p>
        </div>
        <Field label="Model" placeholder={typeInfo.modelPlaceholder} value={model} onChange={setModel} mono />
        {tester.state.status === 'ok' && tester.state.models.length > 0 && (
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {tester.state.models.map((m) => (
              <Button key={m} variant="pill" size="xs" onClick={() => setModel(m)}>{m}</Button>
            ))}
          </div>
        )}
        <Field label="Prompt budget (tokens)" value={contextTokens} onChange={setContextTokens} type="number" />
        {supportsEmbeddings({ type }) ? (
          <Field label="Embedding model (optional, for semantic search)" placeholder="e.g. nomic-embed-text" value={embeddingModel} onChange={setEmbeddingModel} mono />
        ) : (
          <p className="text-[11px] text-text3">Claude has no embeddings endpoint: for semantic search, use the on-device model or another provider.</p>
        )}

        <TestStatus state={tester.state} stale={tester.state.status === 'ok' && !tested} />

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="hollow" size="md" disabled={!canTest || tester.state.status === 'testing'}
            onClick={() => tester.test(draft, apiKey.trim() || undefined, signature)}>
            {tester.state.status === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="md" disabled={!urlCheck?.ok || !draft.model || saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
        {!tested && <p className="text-[11px] text-text3">A provider can be selected for chat only after Test connection passes.</p>}
      </div>

      {tester.pendingConsent && (
        <ConsentDialog
          providerName={tester.pendingConsent.name}
          baseUrl={tester.pendingConsent.baseUrl}
          onAccept={tester.acceptConsent}
          onCancel={tester.cancelConsent}
        />
      )}
    </ModalShell>
  )
}

function hostLabel(url: string): string {
  try { return new URL(url).host } catch { return 'Custom provider' }
}

function TestStatus({ state, stale }: { state: ReturnType<typeof useProviderTest>['state']; stale: boolean }) {
  if (state.status === 'idle') return null
  if (state.status === 'testing') {
    return <p className="flex items-center gap-1.5 text-xs text-text2"><Icon name="loader-2" size={12} className="animate-spin" /> Contacting provider…</p>
  }
  if (state.status === 'error') {
    return <p className="flex items-start gap-1.5 text-xs text-red-500"><Icon name="alert-triangle" size={12} className="mt-0.5 shrink-0" /> {state.message}</p>
  }
  return (
    <p className={`flex items-center gap-1.5 text-xs ${stale ? 'text-text3' : 'text-emerald-600 dark:text-emerald-400'}`}>
      <Icon name="check-circle-2" size={12} />
      {stale ? 'Settings changed since the last test — test again.' : 'Connected. The model answered.'}
    </p>
  )
}
