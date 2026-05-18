import { useEffect } from 'react'
import { toast } from 'sonner'

export function usePwaUpdate() {
  useEffect(() => {
    // Only runs in the browser / PWA context — not in Tauri
    if (!('serviceWorker' in navigator)) return

    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          toast('Update available', {
            description: 'A new version of MindVault is ready.',
            duration: Infinity,
            action: {
              label: 'Reload now',
              onClick: () => window.location.reload(),
            },
          })
        },
        onOfflineReady() {
          // App is cached and works offline — no need to notify the user
        },
      })
    }).catch(() => {
      // vite-plugin-pwa not active in dev — ignore
    })
  }, [])
}
