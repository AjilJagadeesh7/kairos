import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../store/useAppStore'
import { usePaneStore } from '../store/usePaneStore'
import { initPlainFolder, isPlainFolderConnected } from '../sync/plainFolder'
import { initLogger } from '../logger/logger'
import type { FontOption, FontWeight } from '../types/ui.types'

async function drainOfflineQueue() {
  const { getPending, dequeue } = await import('../sync/offlineQueue')
  const { pushNoteToAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
  if (!anySyncProviderConnected()) return

  const pending = getPending()
  if (pending.length === 0) return

  const notes = useAppStore.getState().notes
  toast(`Syncing ${pending.length} note${pending.length > 1 ? 's' : ''} saved while offline…`)

  await Promise.allSettled(
    pending.map(async (id) => {
      const note = notes.find(n => n.id === id)
      if (!note) { dequeue(id); return }
      await pushNoteToAll(note)
      dequeue(id)
    })
  )
  useAppStore.getState().setSyncStatus('ok')
}

const FONT_FAMILIES: Record<FontOption, string> = {
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

const FONT_WEIGHT_MAP: Record<FontWeight, string> = { light: '300', regular: '400', medium: '500' }

function goToSettings(section = 'vault') {
  const { focusedPaneId, navigatePane } = usePaneStore.getState()
  navigatePane(focusedPaneId, `/settings?section=${section}`)
}

export function useAppStartup() {
  const theme      = useAppStore(s => s.theme)
  const font       = useAppStore(s => s.font)
  const fontWeight = useAppStore(s => s.fontWeight)

  // Drain offline queue when connectivity returns
  useEffect(() => {
    window.addEventListener('online', drainOfflineQueue)
    // Also drain on startup in case app was closed while offline
    if (navigator.onLine) void drainOfflineQueue()
    return () => window.removeEventListener('online', drainOfflineQueue)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    if (theme === 'light') root.classList.remove('dark')
    else root.classList.add('dark')
    localStorage.setItem('kairos.theme', theme)
  }, [theme])

  useEffect(() => {
    const family = FONT_FAMILIES[font] ?? FONT_FAMILIES['manrope']
    document.documentElement.style.setProperty('--font-sans', family)
    localStorage.setItem('kairos.font', font)
  }, [font])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-weight', FONT_WEIGHT_MAP[fontWeight] ?? '400')
    localStorage.setItem('kairos.fontWeight', fontWeight)
  }, [fontWeight])

  useEffect(() => {
    void (async () => {
      // Mark session start in the log now that the React tree and Tauri bridge are ready
      initLogger()

      const { initLocalFolder } = await import('../sync/localFolder')
      const { setS3Config } = await import('../sync/s3')
      const { setWebDAVConfig } = await import('../sync/webdav')

      const store = useAppStore.getState()
      if (store.s3Config) setS3Config(store.s3Config)
      if (store.webdavConfig) setWebDAVConfig(store.webdavConfig)

      await initLocalFolder()
      const folderStatus = await initPlainFolder()

      if (folderStatus === 'ok') {
        const { loadSettings } = await import('../sync/settingsSync')
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

      useAppStore.getState().setVaultStatus(folderStatus === 'ok' ? 'ok' : folderStatus === 'missing' ? 'missing' : 'none')

      if (folderStatus === 'missing') {
        toast.error('Vault folder not found', {
          description: 'The folder this app was using has been moved or deleted. Please select a new one.',
          duration: Infinity,
          action: { label: 'Select folder', onClick: () => goToSettings('vault') },
        })
      } else if (folderStatus === 'none') {
        // no toast — VaultBanner handles this inline
      } else {
        // Notes must be awaited first — other stores may reference note IDs
        await store.loadNotes()
        await store.loadFolders()

        // Kanban, journal, canvas, and pen notes are independent — load in parallel
        const [
          { useKanbanStore },
          { useJournalStore },
          { useCanvasStore },
          { usePenNoteStore },
          { useAttachmentStore },
        ] = await Promise.all([
          import('../store/useKanbanStore'),
          import('../store/useJournalStore'),
          import('../store/useCanvasStore'),
          import('../store/usePenNoteStore'),
          import('../store/useAttachmentStore'),
        ])
        await Promise.all([
          useKanbanStore.getState().isLoaded  ? Promise.resolve() : useKanbanStore.getState().loadBoards(),
          useJournalStore.getState().isLoaded ? Promise.resolve() : useJournalStore.getState().loadEntries(),
          useCanvasStore.getState().isLoaded  ? Promise.resolve() : useCanvasStore.getState().loadCanvases(),
          usePenNoteStore.getState().isLoaded ? Promise.resolve() : usePenNoteStore.getState().loadPenNotes(),
          useAttachmentStore.getState().isLoaded ? Promise.resolve() : useAttachmentStore.getState().loadAttachments(),
        ])

        // Discover plugins dropped directly into the vault folder, then load.
        // resetPluginSession() ensures a clean slate if the vault was reconnected.
        const { scanLocalPlugins, loadAllPlugins, resetPluginSession } = await import('../plugins/pluginManager')
        resetPluginSession()
        await scanLocalPlugins()
        await loadAllPlugins()

        // Handle pending URL-param install (web/PWA — deferred because vault wasn't ready)
        const pending = sessionStorage.getItem('kairos_pending_install')
        if (pending) {
          sessionStorage.removeItem('kairos_pending_install')
          const req = JSON.parse(pending) as { id: string; source: string }
          const { installPlugin } = await import('../plugins/installPlugin')
          await installPlugin({
            id: req.id,
            manifestUrl: `${req.source}/plugins/${req.id}/manifest.json`,
            bundleUrl:   `${req.source}/plugins/${req.id}/index.js`,
          })
        }
      }

      // Handle URL-param install when vault IS already connected (web/PWA)
      {
        const params = new URLSearchParams(window.location.search)
        const installId = params.get('installPlugin')
        const source    = params.get('source')
        if (installId && source) {
          // Clean URL immediately so it doesn't re-trigger on refresh
          const clean = new URL(window.location.href)
          clean.searchParams.delete('installPlugin')
          clean.searchParams.delete('source')
          window.history.replaceState({}, '', clean.toString())

          if (isPlainFolderConnected()) {
            const { installPlugin } = await import('../plugins/installPlugin')
            await installPlugin({
              id: installId,
              manifestUrl: `${source}/plugins/${installId}/manifest.json`,
              bundleUrl:   `${source}/plugins/${installId}/index.js`,
            })
          } else {
            // Vault not yet connected — defer install until after vault setup
            sessionStorage.setItem('kairos_pending_install', JSON.stringify({ id: installId, source }))
          }
        }
      }

      // Tauri deep link handler
      try {
        const { isDesktop } = await import('../utils/platform')
        if (isDesktop()) {
          const { onOpenUrl } = await import(/* @vite-ignore */ '@tauri-apps/plugin-deep-link')
          await onOpenUrl(async (urls: string[]) => {
            const { handleInstallDeepLink } = await import('../plugins/installPlugin')
            for (const url of urls) await handleInstallDeepLink(url)
          })
        }
      } catch { /* tauri-plugin-deep-link not available in web build */ }

      // Tauri OTA update check
      try {
        const { isDesktop } = await import('../utils/platform')
        if (isDesktop()) {
          const { check } = await import(/* @vite-ignore */ '@tauri-apps/plugin-updater')
          const { relaunch } = await import(/* @vite-ignore */ '@tauri-apps/plugin-process')
          const update = await check()
          if (update?.available) {
            toast(`Update available — v${update.version}`, {
              description: update.body || 'A new version of Kairos is ready to install.',
              duration: Infinity,
              action: {
                label: 'Install & relaunch',
                onClick: () => {
                  void update.downloadAndInstall().then(() => relaunch())
                },
              },
            })
          }
        }
      } catch { /* updater not available or no pubkey set yet */ }

      const { pingS3, isS3Connected } = await import('../sync/s3')
      const { pingWebDAV, isWebDAVConnected } = await import('../sync/webdav')

      if (isS3Connected()) {
        pingS3().then(err => {
          if (err) toast.warning('S3 sync unavailable', { description: err, action: { label: 'Settings', onClick: () => goToSettings('storage-sync') } })
        })
      }
      if (isWebDAVConnected()) {
        pingWebDAV().then(err => {
          if (err) toast.warning('WebDAV sync unavailable', { description: err, action: { label: 'Settings', onClick: () => goToSettings('storage-sync') } })
        })
      }

      if (folderStatus === 'ok') {
        const { syncAllProviders, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
        if (anySyncProviderConnected()) {
          store.setSyncStatus('syncing')
          syncAllProviders(store.setSyncStatus)
            .then(() => { if (isPlainFolderConnected()) return store.loadNotes() })
            .catch(err => { console.warn('[sync] startup sync failed:', err); store.setSyncStatus('error') })
        }
      }

      // Begin tracking storage usage (recalculates now + every 5 minutes)
      const { useStorageStore } = await import('../store/useStorageStore')
      useStorageStore.getState().startAutoRefresh()
    })()
  }, [])
}
