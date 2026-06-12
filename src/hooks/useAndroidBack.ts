import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePaneStore, pathToType } from '../store/usePaneStore'
import { handleOverlayBack } from '../utils/backHandler'

// Android hardware/gesture back button. Registering a Capacitor backButton
// listener disables the default exit-the-app behavior, so every case must be
// handled here:
//   1. an open overlay (modal / drawer / nav panel) → close it
//   2. a deep page (/notes/:id, /kanban/:boardId, …) → its section root
//   3. a section root → home dashboard
//   4. home → minimize the app (never exit; state stays warm)
export function useAndroidBack() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return

    let removeListener: (() => void) | undefined
    let cancelled = false

    void import('@capacitor/app').then(({ App }) => {
      if (cancelled) return
      void App.addListener('backButton', () => {
        if (handleOverlayBack()) return

        const { focusedPaneId, panes, navigatePane } = usePaneStore.getState()
        const pane = panes.find(p => p.id === focusedPaneId)
        const path = pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'

        if (path === '/') {
          void App.minimizeApp()
          return
        }
        const sectionRoot = '/' + pathToType(path)
        navigatePane(focusedPaneId, path === sectionRoot ? '/' : sectionRoot)
      }).then(handle => {
        if (cancelled) void handle.remove()
        else removeListener = () => void handle.remove()
      })
    })

    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [])
}
