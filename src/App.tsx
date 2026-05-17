import { Toaster } from 'sonner'
import { useAppStore } from './store/useAppStore'
import { useAppStartup } from './hooks/useAppStartup'
import { Header } from './components/organisms/Header/Header'
import { AppRoutes } from './routes'
import { LoaderBar } from './components/molecules/LoaderBar'
import { ConfirmDialog } from './components/organisms/ConfirmDialog'
import { PluginProvider } from './plugins/pluginContext'

const DARK_THEMES = new Set(['dark', 'cyberpunk', 'dracula', 'nord', 'catppuccin'])

function AppInner() {
  const theme = useAppStore(s => s.theme)
  useAppStartup()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      <LoaderBar />
      <ConfirmDialog />
      <Header />
      <div className="min-h-0 flex-1 overflow-hidden">
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
