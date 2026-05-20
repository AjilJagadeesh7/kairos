import { Toaster } from 'sonner'
import { useAppStore } from './store/useAppStore'
import { useAppStartup } from './hooks/useAppStartup'
import { Header } from './components/organisms/Header/Header'
import { AppRoutes } from './routes'
import { LoaderBar } from './components/molecules/LoaderBar'
import { ConfirmDialog } from './components/organisms/ConfirmDialog'
import { PluginProvider } from './plugins/pluginContext'
import { OnboardingModal } from './components/organisms/Onboarding/OnboardingModal'

const DARK_THEMES = new Set(['dark', 'cyberpunk', 'dracula', 'nord', 'catppuccin'])

function AppInner() {
  const theme          = useAppStore(s => s.theme)
  const onboardingDone = useAppStore(s => s.onboardingDone)
  useAppStartup()

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
