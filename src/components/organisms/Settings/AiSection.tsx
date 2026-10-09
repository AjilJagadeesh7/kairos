import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAiStore } from '../../../store/useAiStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { deleteProviderKey } from '../../../ai/providers/registry'
import { locationForUrl } from '../../../ai/net/urlPolicy'
import { SectionCard } from '../../molecules/SectionCard'
import { EmptyState } from '../../molecules/EmptyState'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import { LocationBadge } from '../../atoms/LocationBadge'
import { Select, type SelectOption } from '../../atoms/Select'
import { Icon } from '../../../icons/Icon'
import { ProviderEditorModal } from '../Ai/ProviderEditorModal'
// Loaded only once AI is on: they pull in the index and chat-history modules.
const AiIndexCard = lazy(() => import('./AiIndexCard').then((m) => ({ default: m.AiIndexCard })))
const AiHistoryCard = lazy(() => import('./AiHistoryCard').then((m) => ({ default: m.AiHistoryCard })))
const AiUsageCard = lazy(() => import('./AiUsageCard').then((m) => ({ default: m.AiUsageCard })))
const AiWebCard = lazy(() => import('./AiWebCard').then((m) => ({ default: m.AiWebCard })))
// Full build only: Lite has no on-device runtime or model download UI (the constant drops this import).
const AiOnDeviceCard = __BUILD_FLAVOR__ === 'full' ? lazy(() => import('./AiOnDeviceCard').then((m) => ({ default: m.AiOnDeviceCard }))) : null
import { useOnDeviceStore } from '../../../store/useOnDeviceStore'
import { onDeviceConfig } from '../../../ai/onDevice/onDeviceConfig'
import type { AiProviderConfig, AiSurface } from '../../../types'

const NONE = '__none__'

export function AiSection() {
  const enabled = useAiStore((s) => s.enabled)
  const setEnabled = useAiStore((s) => s.setEnabled)

  return (
    <div className="space-y-4">
      <SectionCard title="AI assistant">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 text-xs text-text2">
            <p>Lets an assistant summarize, rewrite and organize your notes and boards using an AI provider you choose.</p>
            <p className="text-text3">Off by default. While off, Kairos makes no AI requests.</p>
          </div>
          <ToggleSwitch size="md" checked={enabled} onChange={setEnabled} label="AI assistant" />
        </div>
      </SectionCard>
      {enabled && AiOnDeviceCard && <Suspense fallback={null}><AiOnDeviceCard /></Suspense>}
      {enabled && <ProvidersCard />}
      {enabled && <SurfacesCard />}
      {enabled && (
        <Suspense fallback={null}>
          <AiIndexCard />
          <AiHistoryCard />
          <AiWebCard />
          <AiUsageCard />
        </Suspense>
      )}
    </div>
  )
}

function ProvidersCard() {
  const providers = useAiStore((s) => s.providers)
  const removeProvider = useAiStore((s) => s.removeProvider)
  const confirm = useConfirmStore((s) => s.confirm)
  const navigate = useNavigate()
  const [editing, setEditing] = useState<AiProviderConfig | 'new' | null>(null)

  async function remove(p: AiProviderConfig) {
    const ok = await confirm({ title: `Remove ${p.name}?`, message: 'Its API key is deleted from secure storage.', confirmLabel: 'Remove', danger: true })
    if (!ok) return
    await deleteProviderKey(p.id).catch((err) => console.warn('[ai] could not delete provider key:', err))
    removeProvider(p.id)
  }

  return (
    <SectionCard title="Providers">
      {providers.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="Add an AI provider to get started"
          description="Ollama, LM Studio or llama-server on your own machine, or a cloud API: Claude, OpenAI, Gemini, OpenRouter and others."
          action={{ label: 'Add provider', onClick: () => setEditing('new') }}
        />
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{p.name}</span>
                  <LocationBadge location={locationForUrl(p.baseUrl)} />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text3">
                  <span className="truncate font-mono">{p.model}</span>
                  {p.verified
                    ? <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><Icon name="check" size={10} /> Tested</span>
                    : <span className="text-amber-600">Not tested</span>}
                </div>
              </div>
              <IconButton icon="pencil" size="sm" label={`Edit ${p.name}`} onClick={() => setEditing(p)} />
              <IconButton icon="trash-2" size="sm" label={`Remove ${p.name}`} onClick={() => void remove(p)} />
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <Button variant="hollow" size="sm" onClick={() => setEditing('new')}>Add provider</Button>
            <Button variant="link" size="sm" onClick={() => navigate('/ai/debug')}>Open debug chat</Button>
          </div>
        </div>
      )}
      {editing && (
        <ProviderEditorModal existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </SectionCard>
  )
}

function SurfacesCard() {
  const providers = useAiStore((s) => s.providers)
  const surfaceProvider = useAiStore((s) => s.surfaceProvider)
  const setSurfaceProvider = useAiStore((s) => s.setSurfaceProvider)

  // The on-device model (Full build, verified file on disk) is offered like a provider.
  const onDevice = onDeviceConfig(useOnDeviceStore((s) => s.modelId), useOnDeviceStore((s) => s.readyPath))
  const options: SelectOption[] = [
    { value: NONE, label: 'None' },
    ...(onDevice ? [{ value: onDevice.id, label: onDevice.name }] : []),
    ...providers.filter((p) => p.verified).map((p) => ({ value: p.id, label: `${p.name} · ${p.model}` })),
  ]
  const rows: Array<{ surface: AiSurface; label: string; hint: string }> = [
    { surface: 'global', label: 'Global chat', hint: 'Reads across all notes and boards' },
    { surface: 'bubble', label: 'Page bubble', hint: 'Acts only on the page you have open' },
  ]

  return (
    <SectionCard title="Use for">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.surface} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text">{r.label}</p>
              <p className="text-[11px] text-text3">{r.hint}</p>
            </div>
            <Select
              value={surfaceProvider[r.surface] ?? NONE}
              options={options}
              onChange={(v) => setSurfaceProvider(r.surface, v === NONE ? null : v)}
            />
          </div>
        ))}
        {options.length === 1 && (
          <p className="text-[11px] text-text3">Only providers that passed Test connection can be selected.</p>
        )}
      </div>
    </SectionCard>
  )
}
