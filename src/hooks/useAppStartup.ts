import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppStore } from '../store/useAppStore'
import { initPlainFolder, isPlainFolderConnected } from '../sync/plainFolder'
import type { FontOption, FontWeight } from '../types/ui.types'

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

export function useAppStartup() {
  const navigate   = useNavigate()
  const theme      = useAppStore(s => s.theme)
  const font       = useAppStore(s => s.font)
  const fontWeight = useAppStore(s => s.fontWeight)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    if (theme === 'light') root.classList.remove('dark')
    else root.classList.add('dark')
    localStorage.setItem('mindvault.theme', theme)
  }, [theme])

  useEffect(() => {
    const family = FONT_FAMILIES[font] ?? FONT_FAMILIES['manrope']
    document.documentElement.style.setProperty('--font-sans', family)
    localStorage.setItem('mindvault.font', font)
  }, [font])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-weight', FONT_WEIGHT_MAP[fontWeight] ?? '400')
    localStorage.setItem('mindvault.fontWeight', fontWeight)
  }, [fontWeight])

  useEffect(() => {
    void (async () => {
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
        await store.loadNotes()
        const { useKanbanStore } = await import('../store/useKanbanStore')
        const kanbanStore = useKanbanStore.getState()
        if (!kanbanStore.isLoaded) await kanbanStore.loadBoards()

        const { useJournalStore } = await import('../store/useJournalStore')
        const journalStore = useJournalStore.getState()
        if (!journalStore.isLoaded) await journalStore.loadEntries()

        // Load plugins after data is ready
        const { loadAllPlugins } = await import('../plugins/pluginManager')
        await loadAllPlugins()

        // Handle pending URL-param install (web/PWA — deferred because vault wasn't ready)
        const pending = sessionStorage.getItem('mindvault_pending_install')
        if (pending) {
          sessionStorage.removeItem('mindvault_pending_install')
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
            sessionStorage.setItem('mindvault_pending_install', JSON.stringify({ id: installId, source }))
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

      const { pingS3, isS3Connected } = await import('../sync/s3')
      const { pingWebDAV, isWebDAVConnected } = await import('../sync/webdav')

      if (isS3Connected()) {
        pingS3().then(err => {
          if (err) toast.warning('S3 sync unavailable', { description: err, action: { label: 'Settings', onClick: () => navigate('/settings') } })
        })
      }
      if (isWebDAVConnected()) {
        pingWebDAV().then(err => {
          if (err) toast.warning('WebDAV sync unavailable', { description: err, action: { label: 'Settings', onClick: () => navigate('/settings') } })
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
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
