import { useEffect, useCallback, useState } from 'react'
import { Toaster } from 'sonner'
import { useAppStore } from './store/useAppStore'
import { usePaneStore } from './store/usePaneStore'
import { useAppStartup } from './hooks/useAppStartup'
import { useAutoSync } from './hooks/useAutoSync'
import { useVaultWatcher } from './hooks/useVaultWatcher'
import { useAndroidBack } from './hooks/useAndroidBack'
import { ActivityBar } from './components/organisms/ActivityBar/ActivityBar'
import { PaneLayout } from './components/organisms/SplitLayout/PaneLayout'
import { LoaderBar } from './components/molecules/LoaderBar'
import { ConfirmDialog } from './components/organisms/ConfirmDialog'
import { UpgradeModal } from './components/organisms/Upgrade/UpgradeModal'
import { PluginProvider } from './plugins/pluginContext'
import { PluginThemeProvider } from './providers/PluginThemeProvider'
import { IconProvider } from './icons/IconContext'
import { OnboardingModal } from './components/organisms/Onboarding/OnboardingModal'
import { ShortcutsModal } from './components/organisms/ShortcutsModal'
import { CommandPalette } from './components/organisms/CommandPalette'
import { SHORTCUT_REGISTRY, matchesBinding, bindingHasModifier } from './shortcuts/registry'
import { todayDate } from './store/useJournalStore'
import { useCalloutStyles } from './hooks/useCalloutStyles'
import { MobileNav } from './components/organisms/MobileNav/MobileNav'
import { MobileHeader } from './components/organisms/MobileHeader/MobileHeader'

const DARK_THEMES = new Set(['dark', 'cyberpunk', 'dracula', 'nord', 'catppuccin'])

function AppInner() {
  const theme          = useAppStore(s => s.theme)
  const onboardingDone = useAppStore(s => s.onboardingDone)
  const keyBindings    = useAppStore(s => s.keyBindings)
  const createNote     = useAppStore(s => s.createNote)
  const [showShortcuts, setShowShortcuts]           = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  useAppStartup()
  useAutoSync()
  useCalloutStyles()
  useAndroidBack()


  // Hot-reload notes when the vault directory is modified externally
  // (VS Code, git pull, another Markdown editor, etc.)
  const loadNotes    = useAppStore(s => s.loadNotes)
  const vaultStatus  = useAppStore(s => s.vaultStatus)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  useEffect(() => {
    if (vaultStatus !== 'ok') return
    import('./sync/plainFolder').then(({ getVaultPath }) => setVaultPath(getVaultPath()))
  }, [vaultStatus])
  useVaultWatcher(vaultPath, loadNotes)

  const closeShortcuts      = useCallback(() => setShowShortcuts(false), [])
  const closeCommandPalette = useCallback(() => setShowCommandPalette(false), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const def of SHORTCUT_REGISTRY) {
        const binding = keyBindings[def.id] ?? def.defaultKey
        if (!binding) continue
        if (isTextInput && !bindingHasModifier(binding)) continue
        if (!matchesBinding(e, binding)) continue

        e.preventDefault()

        const { focusedPaneId, navigatePane } = usePaneStore.getState()
        const go = (path: string) => navigatePane(focusedPaneId, path)

        switch (def.id) {
          case 'command-palette': setShowCommandPalette(v => !v); break
          case 'show-shortcuts':  setShowShortcuts(v => !v); break
          case 'goto-notes':    go('/notes'); break
          case 'goto-graph':    go('/graph'); break
          case 'goto-kanban':   go('/kanban'); break
          case 'goto-journal':  go(`/journal/${todayDate()}`); break
          case 'goto-settings': go('/settings'); break
          case 'new-note':
            void createNote().then(id => go(`/notes/${id}`))
            break
        }
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyBindings, createNote])

  return (
    <div className="app-shell flex h-dvh overflow-hidden bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[99999] focus:rounded-lg focus:bg-[rgb(var(--accent))] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[rgb(var(--accent-fg))] focus:shadow-lg"
      >
        Skip to content
      </a>
      <LoaderBar />
      <ConfirmDialog />
      <UpgradeModal />
      {!onboardingDone && <OnboardingModal />}
      {showCommandPalette && <CommandPalette onClose={closeCommandPalette} />}
      {showShortcuts && <ShortcutsModal onClose={closeShortcuts} />}
      <ActivityBar />
      <div id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <MobileHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PaneLayout />
        </div>
        <MobileNav />
      </div>
      <Toaster
        position="bottom-right"
        theme={DARK_THEMES.has(theme) ? 'dark' : 'light'}
        richColors
        closeButton
      />
    </div>
  )
}

function App() {
  return (
    <IconProvider>
      <PluginProvider>
        <PluginThemeProvider>
          <AppInner />
        </PluginThemeProvider>
      </PluginProvider>
    </IconProvider>
  )
}

export default App
