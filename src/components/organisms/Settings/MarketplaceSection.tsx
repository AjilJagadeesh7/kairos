import { useEffect, useRef } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { installPlugin } from '../../../plugins/installPlugin'
import type { PluginInstallRequest } from '../../../plugins/types'
import { Icon } from '../../../icons/Icon'

const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL as string | undefined

interface InstallMessage {
  type: 'MINDVAULT_INSTALL_PLUGIN'
  id: string
  manifestUrl: string
  bundleUrl: string
}

interface InstallResultMessage {
  type: 'MINDVAULT_INSTALL_RESULT'
  id: string
  success: boolean
  error?: string
}

export function MarketplaceSection() {
  const theme      = useAppStore(s => s.theme)
  const iframeRef  = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!MARKETPLACE_URL) return

    async function handleMessage(event: MessageEvent) {
      // Strict origin check — reject everything else
      if (event.origin !== new URL(MARKETPLACE_URL!).origin) return
      if (!event.data || event.data.type !== 'MINDVAULT_INSTALL_PLUGIN') return

      const { id, manifestUrl, bundleUrl } = event.data as InstallMessage

      // Validate URLs are from the same marketplace origin before fetching
      const marketplaceOrigin = new URL(MARKETPLACE_URL!).origin
      if (!manifestUrl.startsWith(marketplaceOrigin) || !bundleUrl.startsWith(marketplaceOrigin)) {
        console.warn('[marketplace] rejected install: untrusted URL', { manifestUrl, bundleUrl })
        sendResult(id, false, 'Untrusted plugin source')
        return
      }

      const req: PluginInstallRequest = { id, manifestUrl, bundleUrl }
      const success = await installPlugin(req)
      sendResult(id, success)
    }

    function sendResult(id: string, success: boolean, error?: string) {
      const msg: InstallResultMessage = { type: 'MINDVAULT_INSTALL_RESULT', id, success, error }
      iframeRef.current?.contentWindow?.postMessage(msg, new URL(MARKETPLACE_URL!).origin)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (!MARKETPLACE_URL) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[rgb(var(--border))] py-16 text-center">
        <Icon name="wifi-off" size={28} className="text-[rgb(var(--text-3))]" />
        <p className="text-sm text-[rgb(var(--text-2))]">Marketplace not configured.</p>
        <p className="text-xs text-[rgb(var(--text-3))]">
          Set <code className="rounded bg-[rgb(var(--surface-2))] px-1">VITE_MARKETPLACE_URL</code> at build time.
        </p>
      </div>
    )
  }

  const src = `${MARKETPLACE_URL}?embedded=true&theme=${theme}`

  return (
    <div className="-mx-6 -my-6 h-[calc(100vh-10rem)]">
      <iframe
        ref={iframeRef}
        src={src}
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="MindVault Plugin Marketplace"
      />
    </div>
  )
}
