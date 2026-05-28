import { useState } from 'react'
import type { IconToken } from '../../../icons/tokens'
import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { isDesktop, isMobile } from '../../../utils/platform'
import { InfoRow } from './OnboardingAtoms'
import { Icon } from '../../../icons/Icon'

type ConnectState = 'idle' | 'connecting' | 'done' | 'error'

function SyncOption({
  icon, title, desc, accentClass, onClick,
}: {
  icon: IconToken; title: string; desc: string; accentClass: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-left transition hover:border-[rgb(var(--accent)/0.3)] hover:bg-[rgb(var(--surface-2))]"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
        <Icon name={icon} size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[rgb(var(--text))]">{title}</p>
        <p className="text-[11px] text-[rgb(var(--text-3))]">{desc}</p>
      </div>
      <Icon name="arrow-right" size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
    </button>
  )
}

function WebStorageStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => Promise<void> }) {
  return (
    <div className="px-5 pb-8 pt-8 sm:px-8">
      <div className="mb-5 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)]">
          <Icon name="cloud" size={26} className="text-[rgb(var(--accent))]" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-[rgb(var(--text))]">Where to save your notes</h2>
        <p className="mt-1.5 text-sm text-[rgb(var(--text-2))]">
          Your notes are stored in your browser. Set up sync later to back them up.
        </p>
      </div>

      <div className="mb-5 flex flex-col gap-2.5">
        <SyncOption
          icon="server"
          title="S3 / object storage"
          desc="Amazon S3, Backblaze B2, Cloudflare R2 — any compatible bucket."
          accentClass="bg-orange-500/10 text-orange-400"
          onClick={() => {
            void onFinish().then(() => {
              const { focusedPaneId, navigatePane } = usePaneStore.getState()
              navigatePane(focusedPaneId, '/settings?section=storage-sync')
            })
          }}
        />
        <SyncOption
          icon="cloud"
          title="WebDAV / Nextcloud"
          desc="Self-hosted Nextcloud, Synology NAS, or any WebDAV server."
          accentClass="bg-blue-500/10 text-blue-400"
          onClick={() => {
            void onFinish().then(() => {
              const { focusedPaneId, navigatePane } = usePaneStore.getState()
              navigatePane(focusedPaneId, '/settings?section=storage-sync')
            })
          }}
        />
        <button
          onClick={() => void onFinish()}
          className="flex w-full items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-left transition hover:border-[rgb(var(--accent)/0.3)] hover:bg-[rgb(var(--surface-2))]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))]">
            <Icon name="monitor" size={15} className="text-[rgb(var(--text-3))]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[rgb(var(--text))]">Browser storage only</p>
            <p className="text-[11px] text-[rgb(var(--text-3))]">
              Stored in your browser. Clearing browser data will remove your notes.
            </p>
          </div>
          <Icon name="arrow-right" size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]"
        >
          Back
        </button>
      </div>
    </div>
  )
}

interface VaultSetupStepProps {
  onBack: () => void
  onFinish: () => Promise<void>
}

export function VaultSetupStep({ onBack, onFinish }: VaultSetupStepProps) {
  const vaultStatus = useAppStore(s => s.vaultStatus)
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [folderName,   setFolderName]   = useState<string | null>(null)
  const [errorMsg,     setErrorMsg]     = useState('')

  const mobileReady  = isMobile() && vaultStatus === 'ok'
  const desktopReady = isDesktop() && (vaultStatus === 'ok' || connectState === 'done')

  async function connectDesktop() {
    setConnectState('connecting')
    setErrorMsg('')
    try {
      const { connectPlainFolder, isPlainFolderConnected, getPlainFolderName } =
        await import('../../../sync/plainFolder')
      await connectPlainFolder()
      if (!isPlainFolderConnected()) { setConnectState('idle'); return }
      setFolderName(getPlainFolderName())
      const store = useAppStore.getState()
      store.setVaultStatus('ok')
      await store.loadNotes()
      await store.loadFolders()
      const { useKanbanStore } = await import('../../../store/useKanbanStore')
      await useKanbanStore.getState().loadBoards()
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
      setConnectState('done')
    } catch {
      setConnectState('error')
      setErrorMsg('Could not open the folder. Please try again.')
    }
  }

  async function connectMobile() {
    setConnectState('connecting')
    setErrorMsg('')
    try {
      const { Filesystem } = await import('@capacitor/filesystem')
      await Filesystem.requestPermissions()
      const { initPlainFolder } = await import('../../../sync/plainFolder')
      const result = await initPlainFolder()
      if (result === 'ok') {
        const store = useAppStore.getState()
        store.setVaultStatus('ok')
        await store.loadNotes()
        await store.loadFolders()
        setConnectState('done')
      } else {
        setConnectState('error')
        setErrorMsg('Could not create the Kairos folder. Check your storage permissions.')
      }
    } catch {
      setConnectState('error')
      setErrorMsg('Permission request failed. Grant storage access in your device settings.')
    }
  }

  if (isDesktop()) {
    return (
      <div className="px-5 pb-8 pt-8 sm:px-8">
        <div className="mb-5 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)]">
            <Icon name="hard-drive" size={26} className="text-[rgb(var(--accent))]" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-[rgb(var(--text))]">
            Where should your notes live?
          </h2>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-2))]">
            Pick any folder on your device. Notes are saved as plain text files you always own.
          </p>
        </div>

        {desktopReady ? (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/[0.07] px-4 py-3.5">
            <Icon name="check-circle-2" size={18} className="shrink-0 text-green-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[rgb(var(--text))]">{folderName ?? 'Vault connected'}</p>
              <p className="text-[11px] text-[rgb(var(--text-3))]">notes/ · kanban/ · config/ ready</p>
            </div>
            <button
              onClick={() => void connectDesktop()}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mb-5 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-6 text-center">
            <Icon name="folder-open" size={22} className="mx-auto mb-2 text-[rgb(var(--text-3))]" />
            <p className="mb-1 text-sm font-semibold text-[rgb(var(--text))]">No folder selected</p>
            <p className="mb-4 text-[11px] text-[rgb(var(--text-3))]">
              Choose any folder — subdirectories are created automatically.
            </p>
            <button
              onClick={() => void connectDesktop()}
              disabled={connectState === 'connecting'}
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-5 py-2.5 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {connectState === 'connecting'
                ? <><Icon name="loader-2" size={14} className="animate-spin" /> Opening…</>
                : <><Icon name="folder-open" size={14} /> Choose Folder</>}
            </button>
            {errorMsg && <p className="mt-2 text-[11px] text-red-400">{errorMsg}</p>}
          </div>
        )}

        <div className="mb-6 flex flex-col gap-2">
          <InfoRow icon="file-text"    text="Every note is a plain .md file — readable in any text editor" />
          <InfoRow icon="refresh-cw"   text="Add sync via S3 or WebDAV anytime in Settings" />
          <InfoRow icon="shield-check" text="No accounts, no telemetry — everything stays on your machine" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]"
          >
            Back
          </button>
          <button
            onClick={() => void onFinish()}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
          >
            {desktopReady
              ? <><Icon name="check" size={15} /> Start writing</>
              : <><Icon name="arrow-right" size={15} /> Skip for now</>}
          </button>
        </div>
        {!desktopReady && (
          <p className="mt-2 text-center text-[10px] text-[rgb(var(--text-3))]">
            You can connect a folder anytime from Settings → Vault
          </p>
        )}
      </div>
    )
  }

  if (isMobile()) {
    return (
      <div className="px-5 pb-8 pt-8 sm:px-8">
        <div className="mb-5 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)]">
            <Icon name="smartphone" size={26} className="text-[rgb(var(--accent))]" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-[rgb(var(--text))]">Set up your vault</h2>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-2))]">
            Notes will be saved to your device's Documents folder as plain text files.
          </p>
        </div>

        {(mobileReady || connectState === 'done') ? (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/[0.07] px-4 py-3.5">
            <Icon name="check-circle-2" size={18} className="shrink-0 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--text))]">Documents/Kairos ready</p>
              <p className="text-[11px] text-[rgb(var(--text-3))]">notes/ · kanban/ · config/ created</p>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-6 text-center">
            <Icon name="folder-plus" size={22} className="mx-auto mb-2 text-[rgb(var(--text-3))]" />
            <p className="mb-1 text-sm font-semibold text-[rgb(var(--text))]">Documents/Kairos</p>
            <p className="mb-4 text-[11px] text-[rgb(var(--text-3))]">
              We'll create a Kairos folder in your Documents and ask for permission to write files there.
            </p>
            <button
              onClick={() => void connectMobile()}
              disabled={connectState === 'connecting'}
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-5 py-2.5 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {connectState === 'connecting'
                ? <><Icon name="loader-2" size={14} className="animate-spin" /> Setting up…</>
                : <><Icon name="folder-plus" size={14} /> Create Vault Folder</>}
            </button>
            {errorMsg && <p className="mt-2 text-[11px] text-red-400">{errorMsg}</p>}
          </div>
        )}

        <div className="mb-6 flex flex-col gap-2">
          <InfoRow icon="file-text"    text="Notes saved as plain .md files in Documents/Kairos" />
          <InfoRow icon="cloud"        text="Add S3 or WebDAV sync later to back up across devices" />
          <InfoRow icon="shield-check" text="Files stay on your device — no cloud account needed" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]"
          >
            Back
          </button>
          <button
            onClick={() => void onFinish()}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
          >
            <Icon name="check" size={15} /> Start writing
          </button>
        </div>
      </div>
    )
  }

  // Web
  return <WebStorageStep onBack={onBack} onFinish={onFinish} />
}
