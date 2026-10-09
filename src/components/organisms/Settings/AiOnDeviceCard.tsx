import { useEffect, useState } from 'react'
import { useOnDeviceStore } from '../../../store/useOnDeviceStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { useModelDownload } from '../../../hooks/useModelDownload'
import { ON_DEVICE_MODELS, deviceWarnings, modelById } from '../../../ai/onDevice/models'
import { localRuntime } from '../../../ai/onDevice/native'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { ProgressBar } from '../../atoms/ProgressBar'
import { Select } from '../../atoms/Select'
import { Icon } from '../../../icons/Icon'

const mb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`)

/** Settings → AI → On-device model (Full build only): choose, download, verify, delete. */
export function AiOnDeviceCard() {
  const modelId = useOnDeviceStore((s) => s.modelId)
  const setModelId = useOnDeviceStore((s) => s.setModelId)
  const confirm = useConfirmStore((s) => s.confirm)
  const dl = useModelDownload()
  const [runtime, setRuntime] = useState<boolean | null>(null)
  const model = modelById(modelId) ?? ON_DEVICE_MODELS[0]

  useEffect(() => { void localRuntime().then((r) => r?.available() ?? false).then(setRuntime) }, [])

  const warnings = dl.device ? deviceWarnings(model, dl.device) : []
  const busy = dl.phase === 'downloading' || dl.phase === 'verifying'
  const state = dl.status?.state ?? 'none'

  async function remove() {
    const ok = await confirm({ title: `Delete ${model.label}?`, message: `Frees ${mb(model.sizeBytes)}. Surfaces using the on-device model are switched off until you download it again.`, confirmLabel: 'Delete model', danger: true })
    if (ok) await dl.remove()
  }

  return (
    <SectionCard title="On-device model">
      <div className="space-y-3">
        <p className="text-xs text-text2">
          Runs the assistant on this device: nothing leaves it. The model is downloaded on demand from a pinned Hugging Face file and checked by SHA-256; it is never bundled with the app.
        </p>
        {dl.files === null ? (
          <p className="text-[12px] text-text3">Available in the desktop and Android apps.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-text">Model</p>
                <p className="text-[11px] text-text3">{mb(model.sizeBytes)} download · needs about {Math.round(model.minRamBytes / 1024 ** 3)} GB free memory</p>
              </div>
              <span className={busy ? 'pointer-events-none opacity-50' : ''}>
                <Select value={modelId} options={ON_DEVICE_MODELS.map((m) => ({ value: m.id, label: `${m.label} · ${mb(m.sizeBytes)}` }))} onChange={setModelId} />
              </span>
            </div>
            {warnings.map((w) => (
              <p key={w} role="alert" className="flex items-start gap-1.5 text-[11.5px] text-amber-600"><Icon name="alert-triangle" size={12} className="mt-px shrink-0" />{w}</p>
            ))}
            <div className="space-y-2 rounded-lg border border-border px-3 py-2">
              <p className="text-[12px] text-text2">
                {dl.phase === 'verifying' ? 'Checking the SHA-256…'
                  : dl.phase === 'downloading' ? `Downloading… ${dl.progress ? `${mb(dl.progress.done)} of ${mb(dl.progress.total)}` : ''}`
                  : state === 'ready' ? `Downloaded and verified (${mb(model.sizeBytes)}).`
                  : state === 'partial' ? `Paused at ${mb(dl.status!.bytes)} of ${mb(model.sizeBytes)} — Resume continues from there.`
                  : 'Not downloaded.'}
              </p>
              {dl.error && <p role="alert" className="text-[11.5px] text-red-500">{dl.error}</p>}
              {(busy || state === 'partial') && (dl.progress || dl.status) && (
                <ProgressBar done={dl.progress?.done ?? dl.status?.bytes ?? 0} total={model.sizeBytes} />
              )}
              <div className="flex flex-wrap gap-2">
                {dl.phase === 'downloading' && <Button variant="hollow" size="sm" onClick={dl.pause}>Pause</Button>}
                {!busy && state !== 'ready' && (
                  <Button variant="primary" size="sm" onClick={() => void dl.download()}>
                    {state === 'partial' ? 'Resume' : `Download (${mb(model.sizeBytes)})`}
                  </Button>
                )}
                {!busy && state !== 'none' && <Button variant="danger" size="sm" onClick={() => void remove()}>Delete model</Button>}
              </div>
            </div>
            {state === 'ready' && runtime === false && (
              <p className="text-[11px] text-text3">This build doesn't include the on-device runtime yet, so the model can't be selected for chat.</p>
            )}
            {state === 'ready' && runtime && (
              <p className="text-[11px] text-text3">Choose “On-device” for the global chat or page bubble under Use for.</p>
            )}
          </>
        )}
      </div>
    </SectionCard>
  )
}
