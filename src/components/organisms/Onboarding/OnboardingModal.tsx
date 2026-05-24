import { useRef, useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { isDesktop, isMobile } from '../../../utils/platform'
import { Icon } from '../../../icons/Icon'
import { AppLogo } from '../../atoms/AppLogo'
import type { IconToken } from '../../../icons/tokens'

// ── Sample notes ──────────────────────────────────────────────────────────────

const SAMPLE_NOTE_2_TITLE = 'MindVault Features'
const SAMPLE_NOTE_2 = `## What makes MindVault different

> [!TIP] Privacy first
> Everything is stored locally on your device. No accounts, no telemetry, no cloud lock-in. Sync is optional and always end-to-end encrypted.

### Folders
Organise notes into folders from the sidebar. Drag notes between folders, create nested subfolders, and rename them — any **[[wikilinks]]** pointing to renamed notes update automatically.

### Callout blocks
Use Obsidian-style callouts anywhere in your notes. All 8 types are supported:

> [!NOTE]
> General information — aliases: \`INFO\`

> [!TIP]
> Helpful hints — aliases: \`HINT\`, \`SUCCESS\`

> [!IMPORTANT]
> Key things to remember.

> [!WARNING]
> Watch out — aliases: \`CAUTION\`

> [!DANGER]
> Critical issues — aliases: \`BUG\`, \`ERROR\`

> [!EXAMPLE]
> Illustrative examples.

> [!QUOTE]
> Quotations — aliases: \`CITE\`

> [!ABSTRACT]
> Summaries — aliases: \`SUMMARY\`, \`TLDR\`

### Kanban & Journal
Built-in **Kanban boards** for task management and a **Journal** view for daily notes — no plugins needed.
`

const SAMPLE_NOTE_1_TITLE = 'Welcome to MindVault'
const makeSampleNote1 = () => `## Getting started

> [!NOTE]
> These are sample notes to help you explore MindVault. Delete them whenever you're ready to start fresh.

### Wikilinks — connect your notes

Type \`[[\` anywhere to get an autocomplete list of your notes. Rename a note and every \`[[link]]\` pointing to it updates automatically — no broken links.

Here's a link to [[${SAMPLE_NOTE_2_TITLE}]].

### Transclusion — embed a note inline

Prefix with \`!\` to embed another note's content live:

![[${SAMPLE_NOTE_2_TITLE}]]

### Command palette

Press \`Ctrl+P\` (or \`Cmd+P\` on Mac) to instantly search and open **notes**, **journal entries**, **tasks**, and **settings** from anywhere in the app.

### Callout blocks

Use Obsidian-style callouts with \`> [!TYPE]\` syntax:

> [!TIP] Supported types
> NOTE · TIP · IMPORTANT · WARNING · DANGER · EXAMPLE · QUOTE · ABSTRACT

### Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Save note | \`Ctrl+S\` |
| Command palette | \`Ctrl+P\` |
| Keyboard shortcuts | \`Ctrl+/\` |

> [!TIP] Customise your shortcuts
> Go to **Settings → Keyboard** to remap any shortcut to your preference.

---

The **sidebar** is a full file explorer — create folders, drag notes, and search across everything.
`

// ── Shared atoms ──────────────────────────────────────────────────────────────

function FeatureCard({ iconName, title, desc }: { iconName: IconToken; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3.5 transition hover:border-[rgb(var(--accent)/0.4)]">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
          <Icon name={iconName} size={14} className="text-[rgb(var(--accent))]" />
        </div>
        <span className="text-sm font-semibold text-[rgb(var(--text))]">{title}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">{desc}</p>
    </div>
  )
}

function InfoRow({ icon, text }: { icon: IconToken; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--text-3))]">
      <Icon name={icon} size={11} className="shrink-0" />
      {text}
    </div>
  )
}

// ── Vault setup step ──────────────────────────────────────────────────────────

type ConnectState = 'idle' | 'connecting' | 'done' | 'error'

function VaultSetupStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => Promise<void> }) {
  const vaultStatus           = useAppStore(s => s.vaultStatus)
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [folderName,   setFolderName]   = useState<string | null>(null)
  const [errorMsg,     setErrorMsg]     = useState('')

  // Mobile vault is auto-created by initPlainFolder() in useAppStartup
  const mobileReady  = isMobile() && vaultStatus === 'ok'
  const desktopReady = isDesktop() && (vaultStatus === 'ok' || connectState === 'done')
  const isReady      = mobileReady || desktopReady

  // ── Desktop: Tauri folder picker ──
  async function connectDesktop() {
    setConnectState('connecting')
    setErrorMsg('')
    try {
      const { connectPlainFolder, isPlainFolderConnected, getPlainFolderName } =
        await import('../../../sync/plainFolder')
      await connectPlainFolder()
      if (!isPlainFolderConnected()) { setConnectState('idle'); return } // user cancelled
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
      setErrorMsg('Could not open folder. Please try again.')
    }
  }

  // ── Mobile: Capacitor permissions + mkdir ──
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
        setErrorMsg('Could not create the MindVault folder. Check storage permissions.')
      }
    } catch {
      setConnectState('error')
      setErrorMsg('Permission request failed. Grant storage access in device settings.')
    }
  }

  // ── Desktop layout ──
  if (isDesktop()) {
    return (
      <div className="px-8 pb-8 pt-12">
        <div className="mb-5 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)]">
            <Icon name="hard-drive" size={26} className="text-[rgb(var(--accent))]" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-[rgb(var(--text))]">Choose your vault folder</h2>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-2))]">Notes are saved as plain .md files you always own.</p>
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
            <p className="mb-1 text-sm font-medium text-[rgb(var(--text))]">No folder selected</p>
            <p className="mb-4 text-[11px] text-[rgb(var(--text-3))]">
              Pick any folder on your device — subdirectories are created automatically.
            </p>
            <button
              onClick={() => void connectDesktop()}
              disabled={connectState === 'connecting'}
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-5 py-2.5 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {connectState === 'connecting'
                ? <><Icon name="loader-2" size={14} className="animate-spin" /> Opening…</>
                : <><Icon name="folder-open" size={14} /> Choose Folder…</>}
            </button>
            {errorMsg && <p className="mt-2 text-[11px] text-red-400">{errorMsg}</p>}
          </div>
        )}

        <div className="mb-6 flex flex-col gap-2">
          <InfoRow icon="file-text"    text="Each note is a plain .md file — open in any editor" />
          <InfoRow icon="refresh-cw"   text="Optional sync via your own S3 or WebDAV server" />
          <InfoRow icon="shield-check" text="No accounts, no telemetry — your data stays local" />
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]">
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
            You can connect a folder later from Settings → Vault
          </p>
        )}
      </div>
    )
  }

  // ── Mobile layout ──
  if (isMobile()) {
    return (
      <div className="px-8 pb-8 pt-12">
        <div className="mb-5 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)]">
            <Icon name="smartphone" size={26} className="text-[rgb(var(--accent))]" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-[rgb(var(--text))]">Set up your vault</h2>
          <p className="mt-1.5 text-sm text-[rgb(var(--text-2))]">Notes will be saved to your device's Documents folder.</p>
        </div>

        {(mobileReady || connectState === 'done') ? (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/[0.07] px-4 py-3.5">
            <Icon name="check-circle-2" size={18} className="shrink-0 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--text))]">Documents/MindVault ready</p>
              <p className="text-[11px] text-[rgb(var(--text-3))]">notes/ · kanban/ · config/ created</p>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-6 text-center">
            <Icon name="folder-plus" size={22} className="mx-auto mb-2 text-[rgb(var(--text-3))]" />
            <p className="mb-1 text-sm font-medium text-[rgb(var(--text))]">MindVault/Documents</p>
            <p className="mb-4 text-[11px] text-[rgb(var(--text-3))]">
              We'll create a <code className="font-mono">MindVault</code> folder in your Documents directory and ask for permission to write files there.
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
          <InfoRow icon="file-text"    text="Notes saved as plain .md files in Documents/MindVault" />
          <InfoRow icon="cloud"        text="Set up S3 or WebDAV sync later to back up across devices" />
          <InfoRow icon="shield-check" text="Files stay on your device — no cloud account needed" />
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]">
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

  // ── Web layout ──
  return (
    <WebStorageStep onBack={onBack} onFinish={onFinish} />
  )
}

// ── Web: sync options ─────────────────────────────────────────────────────────

function WebStorageStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => Promise<void> }) {
  return (
    <div className="px-8 pb-8 pt-12">
      <div className="mb-5 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.1)]">
          <Icon name="cloud" size={26} className="text-[rgb(var(--accent))]" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-[rgb(var(--text))]">Where to save your notes</h2>
        <p className="mt-1.5 text-sm text-[rgb(var(--text-2))]">Notes live in your browser by default. Add sync to keep them safe.</p>
      </div>

      <div className="mb-5 flex flex-col gap-2.5">
        <SyncOption
          icon="server"
          title="S3 / object storage"
          desc="Amazon S3, Backblaze B2, Cloudflare R2 — any S3-compatible bucket."
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
            <p className="text-[11px] text-[rgb(var(--text-3))]">Notes stay in IndexedDB. No backup — clear browser data and they're gone.</p>
          </div>
          <Icon name="arrow-right" size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]">
          Back
        </button>
      </div>
    </div>
  )
}

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

// ── Main modal ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

export function OnboardingModal() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const inputRef        = useRef<HTMLInputElement>(null)

  const setUserName        = useAppStore(s => s.setUserName)
  const completeOnboarding = useAppStore(s => s.completeOnboarding)

  async function finish() {
    if (name.trim()) setUserName(name.trim())
    const store = useAppStore.getState()
    await store.createNote({ title: SAMPLE_NOTE_2_TITLE, content: SAMPLE_NOTE_2 })
    const welcomeId = await store.createNote({ title: SAMPLE_NOTE_1_TITLE, content: makeSampleNote1() })
    completeOnboarding()
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, welcomeId ? `/notes/${welcomeId}` : '/notes')
  }

  function skip() {
    completeOnboarding()
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, '/notes')
  }

  const prev = () => setStep(s => Math.max(0, s - 1))
  const next = () => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1))

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl"
        style={{ animation: 'onboard-modal-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Skip — only on non-final steps */}
        {step < TOTAL_STEPS - 1 && (
          <button
            type="button"
            onClick={skip}
            className="absolute right-4 top-4 text-[11px] text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text-2))]"
          >
            Skip tour
          </button>
        )}

        {/* Progress dots */}
        <div className="absolute left-0 right-0 top-4 flex justify-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-[rgb(var(--accent))]' : i < step ? 'w-1.5 bg-[rgb(var(--accent)/0.4)]' : 'w-1.5 bg-[rgb(var(--border))]'
              }`}
            />
          ))}
        </div>

        <div key={step} style={{ animation: 'onboard-step-in 0.28s ease both' }}>

          {/* ── Step 0: Welcome + name ─────────────────────────────────── */}
          {step === 0 && (
            <div className="px-8 pb-8 pt-12 text-center">
              <div className="mb-5 inline-flex items-center justify-center">
                <AppLogo size={64} />
              </div>
              <h1 className="mb-2 text-2xl font-black tracking-tight text-[rgb(var(--text))]">
                Welcome to MindVault
              </h1>
              <p className="mb-8 text-sm leading-relaxed text-[rgb(var(--text-2))]">
                Your private, local-first knowledge base. No cloud required, no accounts, no tracking.
              </p>
              <div className="mb-8 text-left">
                <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--text-2))]">
                  What should we call you? <span className="font-normal text-[rgb(var(--text-3))]">(optional)</span>
                </label>
                <input
                  ref={inputRef}
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') next() }}
                  placeholder="Your name…"
                  maxLength={40}
                  className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--accent)/0.6)] focus:ring-2 focus:ring-[rgb(var(--accent)/0.15)]"
                />
              </div>
              <button
                onClick={next}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90 active:scale-[0.98]"
              >
                Get started <Icon name="arrow-right" size={16} />
              </button>
            </div>
          )}

          {/* ── Step 1: Feature overview ────────────────────────────────── */}
          {step === 1 && (
            <div className="px-8 pb-8 pt-12">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">
                {name.trim() ? `Everything you need, ${name.trim().split(' ')[0]}` : 'Everything in one place'}
              </h2>
              <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">All features work offline, on your device.</p>
              <div className="mb-6 grid grid-cols-2 gap-2.5">
                <FeatureCard iconName="book-open"     title="Notes"    desc="Markdown editor with wikilinks, tags, backlinks, and semantic search." />
                <FeatureCard iconName="calendar-days" title="Journal"  desc="Daily entries with a calendar view. Never lose a thought." />
                <FeatureCard iconName="square-kanban" title="Kanban"   desc="Multi-board task management with drag-and-drop, priorities, and due dates." />
                <FeatureCard iconName="pen-tool"      title="Canvas"   desc="Visual workspace — mix notes, text, and web pages on an infinite canvas." />
                <FeatureCard iconName="network"       title="Graph"    desc="Force-directed knowledge graph that maps note connections visually." />
                <FeatureCard iconName="shield-check"  title="Private"  desc="No accounts, no telemetry. Your data never leaves your device." />
              </div>
              <div className="flex gap-3">
                <button onClick={prev} className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]">Back</button>
                <button onClick={next} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90">Next <Icon name="arrow-right" size={15} /></button>
              </div>
            </div>
          )}

          {/* ── Step 2: Wikilinks & Transclusion ───────────────────────── */}
          {step === 2 && (
            <div className="px-8 pb-8 pt-12">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">Connect your notes</h2>
              <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">Two syntaxes that turn notes into a knowledge base.</p>

              <div className="mb-4 flex flex-col gap-3">
                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="link-2" size={13} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">Wikilinks — link between notes</span>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Type <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5 font-mono text-[rgb(var(--accent))]">[[</code> anywhere for an autocomplete list. Links update automatically when notes are renamed.
                  </p>
                  <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 font-mono text-xs">
                    <span className="text-[rgb(var(--text-3))]">See also </span>
                    <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1 py-0.5 text-[rgb(var(--accent))]">[[Meeting Notes]]</span>
                    <span className="text-[rgb(var(--text-3))]"> and </span>
                    <span className="rounded bg-[rgb(var(--accent)/0.12)] px-1 py-0.5 text-[rgb(var(--accent))]">[[Project Plan]]</span>
                  </div>
                </div>

                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="layers" size={13} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">Transclusion — embed note content</span>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Add <code className="rounded bg-[rgb(var(--surface-2))] px-1 py-0.5 font-mono text-[rgb(var(--accent))]">!</code> before brackets to embed a note's full content live — rendered inline as an expandable card.
                  </p>
                  <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 font-mono text-xs">
                    <span className="text-[rgb(var(--text-3))]">Summary:</span>
                    <div className="mt-1.5 rounded-md border border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent)/0.05)] p-2">
                      <div className="mb-1 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
                        <span className="font-sans text-[10px] font-semibold text-[rgb(var(--accent))]">Weekly Review</span>
                      </div>
                      <p className="font-sans text-[10px] text-[rgb(var(--text-3))]">Shipped the kanban feature, fixed three bugs…</p>
                    </div>
                    <span className="mt-1 block text-[rgb(var(--text-3))]"><span className="text-[rgb(var(--accent))]">!</span>[[Weekly Review]]</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={prev} className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]">Back</button>
                <button onClick={next} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90">Next <Icon name="arrow-right" size={15} /></button>
              </div>
            </div>
          )}

          {/* ── Step 3: Canvas & Graph ──────────────────────────────────── */}
          {step === 3 && (
            <div className="px-8 pb-8 pt-12">
              <h2 className="mb-1 text-center text-xl font-black tracking-tight text-[rgb(var(--text))]">See the bigger picture</h2>
              <p className="mb-5 text-center text-sm text-[rgb(var(--text-2))]">Two views that go beyond text.</p>

              <div className="mb-4 flex flex-col gap-3">
                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="pen-tool" size={14} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">Canvas — infinite visual workspace</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Drop notes, free-form text, and web pages onto an infinite canvas. Draw connections between them and arrange ideas spatially. Great for planning, mood boards, or mind maps.
                  </p>
                  <div className="mt-3 relative h-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] overflow-hidden">
                    <div className="absolute left-4 top-3 w-24 rounded-lg border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] px-2 py-1.5">
                      <div className="h-1.5 w-12 rounded bg-[rgb(var(--text-3)/0.4)] mb-1" />
                      <div className="h-1 w-16 rounded bg-[rgb(var(--text-3)/0.25)]" />
                    </div>
                    <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                      <line x1="106" y1="30" x2="148" y2="55" stroke="rgb(var(--accent))" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 2" />
                    </svg>
                    <div className="absolute right-6 top-8 w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-1.5">
                      <div className="h-1.5 w-10 rounded bg-[rgb(var(--text-3)/0.4)] mb-1" />
                      <div className="h-1 w-14 rounded bg-[rgb(var(--text-3)/0.25)]" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)]">
                      <Icon name="network" size={14} className="text-[rgb(var(--accent))]" />
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">Graph — your knowledge map</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[rgb(var(--text-3))]">
                    Every note is a node. Wikilinks, shared tags, and semantic similarity all become edges. The more you write, the richer the map — patterns and clusters emerge naturally.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={prev} className="flex-1 rounded-xl border border-[rgb(var(--border))] px-4 py-3 text-sm font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]">Back</button>
                <button onClick={next} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90">Next <Icon name="arrow-right" size={15} /></button>
              </div>
            </div>
          )}

          {/* ── Step 4: Storage setup ───────────────────────────────────── */}
          {step === 4 && (
            <VaultSetupStep onBack={prev} onFinish={finish} />
          )}

        </div>
      </div>
    </div>
  )
}
