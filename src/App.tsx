import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'
import { useAppStore } from './store/useAppStore'
import { Header } from './components/organisms/Header/Header'
import { AppRoutes } from './routes'
import { LoaderBar } from './components/molecules/LoaderBar'
import { ConfirmDialog } from './components/organisms/ConfirmDialog'
import { initPlainFolder } from './sync/plainFolder'

function App() {
  const notes          = useLiveQuery(() => db.notes.toArray(), [], undefined)
  const cleanupDoneRef = useRef(false)
  const setActiveNoteId = useAppStore((s) => s.setActiveNoteId)
  const theme           = useAppStore((s) => s.theme)

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    if (theme === 'light') root.classList.remove('dark')
    else root.classList.add('dark')
    localStorage.setItem('mindvault.theme', theme)
  }, [theme])

  // Startup: restore folder handles, load persisted settings, then sync
  useEffect(() => {
    void (async () => {
      const { initLocalFolder }  = await import('./sync/localFolder')
      const { setS3Config }      = await import('./sync/s3')
      const { setWebDAVConfig }  = await import('./sync/webdav')

      // Hydrate sync provider configs into module singletons before anything runs
      const store = useAppStore.getState()
      if (store.s3Config)     setS3Config(store.s3Config)
      if (store.webdavConfig) setWebDAVConfig(store.webdavConfig)

      await Promise.all([initLocalFolder(), initPlainFolder()])

      // Load settings persisted in the config folder and apply them
      const { loadSettings } = await import('./sync/settingsSync')
      const saved = await loadSettings()
      if (saved) {
        if (saved.theme)          store.setTheme(saved.theme)
        if (saved.aiUrl)          store.setAiUrl(saved.aiUrl)
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

      // Pull in notes from all connected providers
      const { syncAllProviders, anySyncProviderConnected } = await import('./sync/syncOrchestrator')
      if (anySyncProviderConnected()) {
        void syncAllProviders(store.setSyncStatus)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clean up empty untitled notes left from previous sessions
  useEffect(() => {
    if (!notes || cleanupDoneRef.current) return
    cleanupDoneRef.current = true
    const emptyUntitled = notes.filter(
      (n) => n.title.trim() === 'Untitled note' && n.content.trim() === '' && n.tags.length === 0,
    )
    if (emptyUntitled.length > 0) {
      void (async () => {
        for (const n of emptyUntitled) {
          await db.notes.delete(n.id)
          await db.syncMeta.delete(n.id)
        }
        setActiveNoteId(undefined)
      })()
    }
  }, [notes, setActiveNoteId])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      <LoaderBar />
      <ConfirmDialog />
      <Header />
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppRoutes />
      </div>
    </div>
  )
}

export default App
