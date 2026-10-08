import { useEffect } from 'react'
import { useAiStore } from '../../../store/useAiStore'
import { useAiIndexStore } from '../../../store/useAiIndexStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { ON_DEVICE_MODEL } from '../../../ai/index/indexStorage'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { ProgressBar } from '../../atoms/ProgressBar'
import { Select, type SelectOption } from '../../atoms/Select'
import type { IndexSource } from '../../../types'

const SOURCES: SelectOption<IndexSource>[] = [
  { value: 'on-device', label: 'On-device (MiniLM)' },
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
  const { status, progress, error, stats, build, pause, remove, refreshStats } = useAiIndexStore()
  const confirm = useConfirmStore((s) => s.confirm)

  useEffect(() => { void refreshStats() }, [refreshStats])

  const stale = !!meta && meta.modelId !== ON_DEVICE_MODEL
  const building = status === 'building'

  async function rebuild() {
    const ok = await confirm({ title: 'Rebuild the semantic index?', message: 'Every note and journal entry is embedded again on this device.', confirmLabel: 'Rebuild' })
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
            <p className="text-[11px] text-text3">{source === 'keyword' ? 'No index needed — search matches words only.' : `${ON_DEVICE_MODEL} · runs in the app, nothing leaves the device`}</p>
          </div>
          <Select value={source} options={SOURCES} onChange={setSource} />
        </div>

        {source === 'on-device' && (
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
