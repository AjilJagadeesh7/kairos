import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { useAppStore } from './store/useAppStore'
import { Header } from './components/organisms/Header/Header'
import { AppRoutes } from './routes'
import { LoaderBar } from './components/molecules/LoaderBar'
import { ConfirmDialog } from './components/organisms/ConfirmDialog'
import { initPlainFolder, isPlainFolderConnected } from './sync/plainFolder'

const FONT_FAMILIES: Record<string, string> = {
  'manrope':           "'Manrope', ui-sans-serif, system-ui, sans-serif",
  'inter':             "'Inter', ui-sans-serif, system-ui, sans-serif",
  'roboto':            "'Roboto', ui-sans-serif, system-ui, sans-serif",
  'ubuntu':            "'Ubuntu', ui-sans-serif, system-ui, sans-serif",
  'poppins':           "'Poppins', ui-sans-serif, system-ui, sans-serif",
  'lora':              "'Lora', ui-serif, Georgia, serif",
  'libre-baskerville': "'Libre Baskerville', ui-serif, Georgia, serif",
  'playfair-display':  "'Playfair Display', ui-serif, Georgia, serif",
  'cormorant':         "'Cormorant Garamond', ui-serif, Georgia, serif",
  'cinzel':            "'Cinzel', ui-serif, serif",
}

function AppInner() {
  const navigate    = useNavigate()
  const theme       = useAppStore((s) => s.theme)
  const font        = useAppStore((s) => s.font)
  const fontWeight  = useAppStore((s) => s.fontWeight)

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    if (theme === 'light') root.classList.remove('dark')
    else root.classList.add('dark')
    localStorage.setItem('mindvault.theme', theme)
  }, [theme])

  // Apply font family CSS variable
  useEffect(() => {
    const family = FONT_FAMILIES[font] ?? FONT_FAMILIES['manrope']
    document.documentElement.style.setProperty('--font-sans', family)
    localStorage.setItem('mindvault.font', font)
  }, [font])

  // Apply font weight CSS variable
  useEffect(() => {
    const weightMap = { light: '300', regular: '400', medium: '500' }
    document.documentElement.style.setProperty('--font-weight', weightMap[fontWeight] ?? '400')
    localStorage.setItem('mindvault.fontWeight', fontWeight)
  }, [fontWeight])

  // Startup: restore folder, validate it exists, load data, check remote sync
  useEffect(() => {
    void (async () => {
      const { initLocalFolder } = await import('./sync/localFolder')
      const { setS3Config } = await import('./sync/s3')
      const { setWebDAVConfig } = await import('./sync/webdav')

      const store = useAppStore.getState()
      if (store.s3Config) setS3Config(store.s3Config)
      if (store.webdavConfig) setWebDAVConfig(store.webdavConfig)

      await initLocalFolder()
      const folderStatus = await initPlainFolder()

      // Load settings from config folder (only if folder is connected)
      if (folderStatus === 'ok') {
        const { loadSettings } = await import('./sync/settingsSync')
        const saved = await loadSettings()
        if (saved) {
          if (saved.theme)       store.setTheme(saved.theme)
          if (saved.font)        store.setFont(saved.font)
          if (saved.fontWeight)  store.setFontWeight(saved.fontWeight)
          if (saved.aiUrl)       store.setAiUrl(saved.aiUrl)
          if (saved.storageChoices) store.setStorageChoices(saved.storageChoices)
          if (saved.s3Config !== undefined && saved.s3Config !== store.s3Config) {
            store.setS3Config(saved.s3Config)
            if (saved.s3Config) setS3Config(saved.s3Config)
          }
          if (saved.webdavConfig !== undefined && saved.webdavConfig !== store.webdavConfig) {
            store.setWebDAVConfig(saved.webdavConfig)
            if (saved.webdavConfig) setWebDAVConfig(saved.webdavConfig)
          }
        }
      }

      // Handle folder status
      if (folderStatus === 'missing') {
        toast.error('Vault folder not found', {
          description: 'The folder this app was using has been moved or deleted. Please select a new one.',
          duration: Infinity,
          action: { label: 'Select folder', onClick: () => navigate('/settings') },
        })
      } else if (folderStatus === 'none') {
        toast('Welcome to MindVault', {
          description: 'Choose a local folder to store your notes and boards.',
          duration: Infinity,
          action: { label: 'Set up folder', onClick: () => navigate('/settings') },
        })
      } else {
        // Folder OK — load notes and boards
        await store.loadNotes()

        const { useKanbanStore } = await import('./store/useKanbanStore')
        const kanbanStore = useKanbanStore.getState()
        if (!kanbanStore.isLoaded) {
          await kanbanStore.loadBoards()
        }
      }

      // Check remote sync providers in the background — non-blocking
      const { pingS3, isS3Connected } = await import('./sync/s3')
      const { pingWebDAV, isWebDAVConnected } = await import('./sync/webdav')

      if (isS3Connected()) {
        pingS3().then(err => {
          if (err) {
            toast.warning('S3 sync unavailable', {
              description: err,
              action: { label: 'Settings', onClick: () => navigate('/settings') },
            })
          }
        })
      }

      if (isWebDAVConnected()) {
        pingWebDAV().then(err => {
          if (err) {
            toast.warning('WebDAV sync unavailable', {
              description: err,
              action: { label: 'Settings', onClick: () => navigate('/settings') },
            })
          }
        })
      }

      // Pull from connected remote sync providers (only if folder is ready)
      if (folderStatus === 'ok') {
        const { syncAllProviders, anySyncProviderConnected } = await import('./sync/syncOrchestrator')
        if (anySyncProviderConnected()) {
          store.setSyncStatus('syncing')
          syncAllProviders(store.setSyncStatus)
            .then(() => {
              if (isPlainFolderConnected()) return store.loadNotes()
            })
            .catch(err => {
              console.warn('[sync] startup sync failed:', err)
              store.setSyncStatus('error')
            })
        }
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        theme={theme === 'dark' || theme === 'cyberpunk' ? 'dark' : 'light'}
        richColors
        closeButton
      />
    </div>
  )
}

function App() {
  return <AppInner />
}

export default App
