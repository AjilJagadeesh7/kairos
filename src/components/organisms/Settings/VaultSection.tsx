import { useEffect, useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import { Icon } from '../../../icons/Icon'

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

      store.setVaultStatus('ok')
      await store.loadNotes()
      await store.loadFolders()
      const { useKanbanStore } = await import('../../../store/useKanbanStore')
      await useKanbanStore.getState().loadBoards()
      const { usePenNoteStore } = await import('../../../store/usePenNoteStore')
      await usePenNoteStore.getState().loadPenNotes()
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch { /* user cancelled */ }
  }

  async function onDisconnectVault() {
    const { disconnectPlainFolder } = await import('../../../sync/plainFolder')
    await disconnectPlainFolder()
    setVaultConnected(false)
    setVaultName(null)
    useAppStore.getState().setVaultStatus('none')
  }

  return (
    <SectionCard title="Vault Folder">
      <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
        Your single source of truth. Notes, journal, boards, canvases, and config are stored inside
        this folder as plain files — easy to back up, version-control, or move to another device.
        The folder contains <code className="rounded bg-[rgb(var(--surface-2))] px-1">notes/</code>,{' '}
        <code className="rounded bg-[rgb(var(--surface-2))] px-1">journal/</code>,{' '}
        <code className="rounded bg-[rgb(var(--surface-2))] px-1">kanban/</code>,{' '}
        <code className="rounded bg-[rgb(var(--surface-2))] px-1">canvas/</code>, and{' '}
        <code className="rounded bg-[rgb(var(--surface-2))] px-1">config/</code> subdirectories.
        Connect a remote below to sync any of these across devices.
      </p>

      {vaultConnected ? (
        <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="check-circle-2" size={15} className="shrink-0 text-green-500" />
            <div>
              <p className="text-sm font-medium text-[rgb(var(--text))]">{vaultName ?? 'Connected'}</p>
              <p className="text-[10px] text-[rgb(var(--text-3))]">notes/ · journal/ · kanban/ · canvas/ · config/</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="xs" onClick={() => void onConnectVault()}>
              <Icon name="folder-open" size={12} className="mr-1" /> Change…
            </Button>
            <Button variant="ghost" size="xs" onClick={() => void onDisconnectVault()}>
              <Icon name="x" size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-8 text-center">
          <Icon name="circle" size={24} className="text-[rgb(var(--text-3))]" />
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">No vault folder selected</p>
            <p className="mt-0.5 text-xs text-[rgb(var(--text-3))]">
              Pick a folder on your device. Subdirectories will be created automatically.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => void onConnectVault()}>
            <Icon name="folder-open" size={13} className="mr-1.5" /> Choose Folder…
          </Button>
        </div>
      )}
    </SectionCard>
  )
}
