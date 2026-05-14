import { useEffect, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import type { StorageTarget } from '../../../types'

type StorageId = StorageTarget

export function StorageSection() {
  const storageChoices    = useAppStore((s) => s.storageChoices)
  const setStorageChoices = useAppStore((s) => s.setStorageChoices)

  const supportsFS = 'showDirectoryPicker' in window
    || !!((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)

  const [folderConnected, setFolderConnected] = useState(false)
  const [folderName,      setFolderName]      = useState<string | null>(null)

  useEffect(() => {
    void import('../../../sync/plainFolder').then(({ isPlainFolderConnected, getPlainFolderName }) => {
      setFolderConnected(isPlainFolderConnected())
      setFolderName(getPlainFolderName())
    })
  }, [])

  function toggle(id: StorageId, alwaysOn?: boolean) {
    if (alwaysOn) return
    const next = storageChoices.includes(id)
      ? storageChoices.filter((o) => o !== id)
      : [...storageChoices, id]
    if (next.length === 0) return
    setStorageChoices(next)
    void import('../../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
  }

  async function onConnect() {
    const { connectPlainFolder, isPlainFolderConnected, getPlainFolderName } = await import('../../../sync/plainFolder')
    try {
      await connectPlainFolder()
      setFolderConnected(isPlainFolderConnected())
      setFolderName(getPlainFolderName())
    } catch { /* user cancelled */ }
  }

  async function onDisconnect() {
    const { disconnectPlainFolder } = await import('../../../sync/plainFolder')
    await disconnectPlainFolder()
    setFolderConnected(false)
    setFolderName(null)
  }

  const OPTIONS: Array<{ id: StorageId; label: string; description: string; alwaysOn?: boolean; requiresFS?: boolean }> = [
    {
      id: 'indexdb',
      label: 'In-app storage (IndexedDB)',
      description: 'Notes live in the browser database. Fast, works everywhere, always active as the local cache.',
      alwaysOn: true,
    },
    {
      id: 'local',
      label: 'Local folder (filesystem)',
      description: 'Also write readable .md files to a folder on disk on every save.',
      requiresFS: true,
    },
  ]

  const localChecked = storageChoices.includes('local')

  return (
    <div className="space-y-4">
      <SectionCard title="Storage">
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Select where notes are saved. IndexedDB is always on as the local cache.
          Enable additional targets and every save will write to all of them.
        </p>
        <div className="space-y-2">
          {OPTIONS.map(({ id, label, description, alwaysOn, requiresFS }) => {
            const checked  = storageChoices.includes(id)
            const disabled = alwaysOn || (requiresFS && !supportsFS)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id, alwaysOn)}
                disabled={disabled}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  checked
                    ? 'border-[rgb(var(--accent)_/_0.4)] bg-[rgb(var(--accent)_/_0.08)]'
                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))]'
                } ${disabled ? 'cursor-default opacity-60' : ''}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  checked
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]'
                    : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-3))]'
                }`}>
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1,4 3.5,6.5 9,1" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[rgb(var(--text))]">
                    {label}
                    {alwaysOn && (
                      <span className="ml-2 text-[10px] font-normal text-[rgb(var(--text-3))]">always on</span>
                    )}
                  </p>
                  <p className="text-xs text-[rgb(var(--text-3))]">{description}</p>
                  {requiresFS && !supportsFS && (
                    <p className="mt-1 text-xs text-amber-400">
                      Not available in this browser — use Chrome, Edge, or the desktop app.
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Folder connection — shown when local is checked */}
        {localChecked && supportsFS && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen size={14} className={folderConnected ? 'text-green-500' : 'text-[rgb(var(--text-3))]'} />
              <span className="text-[rgb(var(--text-2))]">
                {folderConnected ? (folderName ?? 'Connected') : 'No folder selected'}
              </span>
            </div>
            {folderConnected ? (
              <Button variant="ghost" size="xs" onClick={() => void onDisconnect()}>
                <X size={11} className="mr-1" /> Disconnect
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => void onConnect()}>
                Choose Folder…
              </Button>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
