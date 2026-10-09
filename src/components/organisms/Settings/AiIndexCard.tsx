import { useEffect } from 'react'
import { useAiStore } from '../../../store/useAiStore'
import { useAiIndexStore } from '../../../store/useAiIndexStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { ON_DEVICE_MODEL } from '../../../ai/index/indexStorage'
import { activeModelId } from '../../../ai/index/embedSource'
import { supportsEmbeddings } from '../../../ai/providers/registry'
import { locationForUrl } from '../../../ai/net/urlPolicy'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { ProgressBar } from '../../atoms/ProgressBar'
import { Select, type SelectOption } from '../../atoms/Select'
import type { IndexSource } from '../../../types'

const SOURCES: SelectOption<IndexSource>[] = [
  { value: 'on-device', label: 'On-device (MiniLM)' },
  { value: 'provider', label: 'Provider embeddings' },
  { value: 'keyword', label: 'Keyword only' },
]

function size(bytes: number): string {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
}

/** Settings → AI → Semantic index: source, Build / Pause / Rebuild / Delete, size. */
export function AiIndexCard() {
  const source = useAiStore((s) => s.indexSource)
  const setSource = useAiStore((s) => s.setIndexSource)
  const meta = useAiStore((s) => s.indexMeta)
  const providers = useAiStore((s) => s.providers)
  const providerId = useAiStore((s) => s.indexProviderId)
  const setProviderId = useAiStore((s) => s.setIndexProviderId)
  const embedders = providers.filter((p) => p.verified && supportsEmbeddings(p) && p.embeddingModel)
  const chosen = embedders.find((p) => p.id === providerId) ?? null
  const { status, progress, error, stats, build, pause, remove, refreshStats } = useAiIndexStore()
  const confirm = useConfirmStore((s) => s.confirm)

  useEffect(() => { void refreshStats() }, [refreshStats])

  // Re-read on every render: the source, provider or its embedding model may have changed.
  const wanted = activeModelId()
  const stale = !!meta && !!wanted && meta.modelId !== wanted
  const ready = source === 'on-device' || (source === 'provider' && !!chosen)
  const building = status === 'building'

  async function rebuild() {
    const where = source === 'provider' && chosen ? `by ${chosen.name}` : 'on this device'
    const ok = await confirm({ title: 'Rebuild the semantic index?', message: `Every note and journal entry is embedded again ${where}.`, confirmLabel: 'Rebuild' })
    if (!ok) return
    await remove()
    await build()
  }

  async function del() {
    const ok = await confirm({ title: 'Delete the semantic index?', message: 'The global chat falls back to keyword search until you build it again. Your notes are not affected.', confirmLabel: 'Delete', danger: true })
    if (ok) await remove()
  }

  return (
    <SectionCard title="Semantic index">
      <div className="space-y-3">
        <p className="text-xs text-text2">
          Lets the global chat find notes by meaning, not just matching words. Built on this device from your notes and journal; never synced.
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-text">Embedding source</p>
            <p className="text-[11px] text-text3">
              {source === 'keyword' ? 'No index needed — search matches words only.'
                : source === 'provider' ? (chosen ? `${chosen.embeddingModel} via ${chosen.name}` : 'Pick a provider that has an embedding model set')
                : `${ON_DEVICE_MODEL} · runs in the app, nothing leaves the device`}
            </p>
          </div>
          <Select value={source} options={SOURCES} onChange={setSource} />
        </div>

        {source === 'provider' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-text">Embedding provider</p>
              <Select
                value={chosen?.id ?? ''}
                options={[{ value: '', label: embedders.length ? 'Choose…' : 'None available' }, ...embedders.map((p) => ({ value: p.id, label: `${p.name} · ${p.embeddingModel}` }))]}
                onChange={(v) => setProviderId(v || null)}
              />
            </div>
            <p className="text-[11px] text-text3">
              {chosen && locationForUrl(chosen.baseUrl) === 'cloud'
                ? `Note and journal text is sent to ${chosen.name} to be embedded, under the consent you gave it. Your questions are too.`
                : chosen ? `Embedded by ${chosen.name} on your own machine or network.`
                : 'Set an embedding model on a tested OpenAI-compatible or Gemini provider to use it here. Claude has no embeddings endpoint.'}
            </p>
          </div>
        )}

        {ready && (
          <div className="space-y-2 rounded-lg border border-border px-3 py-2">
            <p className="text-[12px] text-text2">
              {building ? 'Building…'
                : status === 'paused' ? 'Paused — Resume continues where it stopped.'
                : status === 'error' ? `Build failed: ${error}`
                : meta ? `Built ${meta.builtAt.slice(0, 10)}${stale ? ' with another model — rebuild to use it' : ''}`
                : 'Not built yet. The chat uses keyword search until it is.'}
            </p>
            {stats && stats.chunks > 0 && (
              <p className="text-[11px] text-text3">{stats.docs} notes · {stats.chunks} passages · {size(stats.bytes)}</p>
            )}
            {(building || status === 'paused') && progress && progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
            <div className="flex flex-wrap gap-2">
              {building
                ? <Button variant="hollow" size="sm" onClick={pause}>Pause</Button>
                : <Button variant="primary" size="sm" onClick={() => void build()}>{status === 'paused' ? 'Resume' : meta ? 'Update' : 'Build index'}</Button>}
              {!building && meta && <Button variant="hollow" size="sm" onClick={() => void rebuild()}>Rebuild</Button>}
              {!building && (stats?.chunks ?? 0) > 0 && <Button variant="danger" size="sm" onClick={() => void del()}>Delete</Button>}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
