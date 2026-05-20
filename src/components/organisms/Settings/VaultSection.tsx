import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, FolderOpen, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'

export function VaultSection() {
  const [vaultConnected, setVaultConnected] = useState(false)
  const [vaultName,      setVaultName]      = useState<string | null>(null)

  useEffect(() => {
    void import('../../../sync/plainFolder').then(({ isPlainFolderConnected, getPlainFolderName }) => {
      setVaultConnected(isPlainFolderConnected())
      setVaultName(getPlainFolderName())
    })
  }, [])

  async function onConnectVault() {
    const { connectPlainFolder, isPlainFolderConnected, getPlainFolderName, writePlainNote, writeFolderList } = await import('../../../sync/plainFolder')
    try {
      await connectPlainFolder()
      setVaultConnected(isPlainFolderConnected())
      setVaultName(getPlainFolderName())
      const store = useAppStore.getState()

      // Flush any in-memory notes/folders created before the vault was connected
      if (store.notes.length > 0) {
        await Promise.all(store.notes.map(n => writePlainNote(n).catch(() => {})))
      }
      if (store.folderList.length > 0) {
        await writeFolderList(store.folderList).catch(() => {})
      }

      await store.loadNotes()
      await store.loadFolders()
      const { useKanbanStore } = await import('../../../store/useKanbanStore')
      await useKanbanStore.getState().loadBoards()
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch { /* user cancelled */ }
  }

  async function onDisconnectVault() {
    const { disconnectPlainFolder } = await import('../../../sync/plainFolder')
    await disconnectPlainFolder()
    setVaultConnected(false)
    setVaultName(null)
  }

  return (
    <SectionCard title="Vault Folder">
      <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
        Your single source of truth. All notes, boards, and config are stored inside this folder
        as plain files — easy to back up, version-control, or move to another device.
        The folder will contain <code className="rounded bg-[rgb(var(--surface-2))] px-1">notes/</code>,{' '}
        <code className="rounded bg-[rgb(var(--surface-2))] px-1">kanban/</code>, and{' '}
        <code className="rounded bg-[rgb(var(--surface-2))] px-1">config/</code> subdirectories.
      </p>

      {vaultConnected ? (
        <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-green-500" />
            <div>
              <p className="text-sm font-medium text-[rgb(var(--text))]">{vaultName ?? 'Connected'}</p>
              <p className="text-[10px] text-[rgb(var(--text-3))]">notes/ · kanban/ · config/</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="xs" onClick={() => void onConnectVault()}>
              <FolderOpen size={12} className="mr-1" /> Change…
            </Button>
            <Button variant="ghost" size="xs" onClick={() => void onDisconnectVault()}>
              <X size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-8 text-center">
          <Circle size={24} className="text-[rgb(var(--text-3))]" />
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">No vault folder selected</p>
            <p className="mt-0.5 text-xs text-[rgb(var(--text-3))]">
              Pick a folder on your device. Subdirectories will be created automatically.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => void onConnectVault()}>
            <FolderOpen size={13} className="mr-1.5" /> Choose Folder…
          </Button>
        </div>
      )}
    </SectionCard>
  )
}
