import { useEffect, useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'
import { StatusPill } from '../../molecules/StatusPill'
import { isWebDAVConnected, setWebDAVConfig, testWebDAVConnection } from '../../../sync/webdav'
import type { WebDAVConfig } from '../../../sync/webdav'
import { Icon } from '../../../icons/Icon'

interface Props {
  onConnectionChange?: (connected: boolean) => void
}

export function WebDAVSection({ onConnectionChange }: Props) {
  const storedDAV = useAppStore((s) => s.webdavConfig)
  const saveDAV   = useAppStore((s) => s.setWebDAVConfig)

  const [url,       setUrl]       = useState(storedDAV?.url      ?? '')
  const [user,      setUser]      = useState(storedDAV?.username  ?? '')
  const [pass,      setPass]      = useState(storedDAV?.password  ?? '')
  const [connected, setConnected] = useState(false)
  const [error,     setError]     = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (storedDAV) { setWebDAVConfig(storedDAV); setConnected(isWebDAVConnected()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSave() {
    setError(''); setSaving(true)
    const cfg: WebDAVConfig = { url: url.trim(), username: user.trim(), password: pass }
    try {
      await testWebDAVConnection(cfg)
      setWebDAVConfig(cfg); saveDAV(cfg); setConnected(true)
      onConnectionChange?.(true)
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally { setSaving(false) }
  }

  async function onDisconnect() {
    setWebDAVConfig(null); saveDAV(null); setConnected(false)
    setUrl(''); setUser(''); setPass('')
    onConnectionChange?.(false)
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  return (
    <SectionCard title="WebDAV">
      <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
        Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS. Use an app password where supported.
      </p>
      {connected ? (
        <div className="flex items-center justify-between">
          <StatusPill connected label={storedDAV?.username ?? 'Connected'} />
          <Button variant="ghost" size="xs" onClick={() => void onDisconnect()}>
            <Icon name="x" size={11} className="mr-1" /> Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="WebDAV URL" placeholder="https://cloud.example.com/remote.php/dav/files/user" type="url" value={url} onChange={setUrl} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" value={user} onChange={setUser} />
            <Field label="Password / App Password" type="password" value={pass} onChange={setPass} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button variant="primary" size="sm" onClick={() => void onSave()}
            disabled={saving || !url || !user || !pass}>
            {saving ? 'Connecting…' : 'Test & Connect'}
          </Button>
        </div>
      )}
    </SectionCard>
  )
}
