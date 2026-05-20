import { useState, useEffect, useCallback } from 'react'
import { Toaster } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useAppStartup } from './hooks/useAppStartup'
import { Header } from './components/organisms/Header/Header'
import { AppRoutes } from './routes'
import { LoaderBar } from './components/molecules/LoaderBar'
import { ConfirmDialog } from './components/organisms/ConfirmDialog'
import { PluginProvider } from './plugins/pluginContext'
import { OnboardingModal } from './components/organisms/Onboarding/OnboardingModal'
import { ShortcutsModal } from './components/organisms/ShortcutsModal'
import { SHORTCUT_REGISTRY, matchesBinding, bindingHasModifier } from './shortcuts/registry'
import { todayDate } from './store/useJournalStore'

const DARK_THEMES = new Set(['dark', 'cyberpunk', 'dracula', 'nord', 'catppuccin'])

function AppInner() {
  const theme          = useAppStore(s => s.theme)
  const onboardingDone = useAppStore(s => s.onboardingDone)
  const keyBindings    = useAppStore(s => s.keyBindings)
  const createNote     = useAppStore(s => s.createNote)
  const navigate       = useNavigate()
  const [showShortcuts, setShowShortcuts] = useState(false)
  useAppStartup()

  const closeShortcuts = useCallback(() => setShowShortcuts(false), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const def of SHORTCUT_REGISTRY) {
        const binding = keyBindings[def.id] ?? def.defaultKey
        if (!binding) continue
        // Bare-key shortcuts (no Ctrl/Alt) don't fire inside text inputs — they'd type characters
        if (isTextInput && !bindingHasModifier(binding)) continue
        if (!matchesBinding(e, binding)) continue

        e.preventDefault()

        switch (def.id) {
          case 'show-shortcuts': setShowShortcuts(v => !v); break
          case 'goto-notes':    navigate('/notes'); break
          case 'goto-graph':    navigate('/graph'); break
          case 'goto-kanban':   navigate('/kanban'); break
          case 'goto-journal':  navigate(`/journal/${todayDate()}`); break
          case 'goto-settings': navigate('/settings'); break
          case 'new-note':
            void createNote().then(id => navigate(`/notes/${id}`))
            break
          default:
            // Component-specific actions are handled by their own window listeners
        }
        return  // stop after first match
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyBindings, navigate, createNote])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[99999] focus:rounded-lg focus:bg-[rgb(var(--accent))] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[rgb(var(--accent-fg))] focus:shadow-lg"
      >
        Skip to content
      </a>
      <LoaderBar />
      <ConfirmDialog />
      {!onboardingDone && <OnboardingModal />}
      {showShortcuts && <ShortcutsModal onClose={closeShortcuts} />}
      <Header />
      <div id="main-content" className="page-enter min-h-0 flex-1 overflow-hidden">
        <AppRoutes />
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
    <PluginProvider>
      <AppInner />
    </PluginProvider>
  )
}

export default App
