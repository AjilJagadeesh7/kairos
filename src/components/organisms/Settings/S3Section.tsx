import { useEffect, useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'
import { StatusPill } from '../../molecules/StatusPill'
import { isS3Connected, setS3Config, testS3Connection } from '../../../sync/s3'
import type { S3Config } from '../../../sync/s3'
import { Icon } from '../../../icons/Icon'

interface Props {
  onConnectionChange?: (connected: boolean) => void
}

export function S3Section({ onConnectionChange }: Props) {
  const storedS3 = useAppStore((s) => s.s3Config)
  const saveS3   = useAppStore((s) => s.setS3Config)

  const [endpoint,  setEndpoint]  = useState(storedS3?.endpoint  ?? '')
  const [bucket,    setBucket]    = useState(storedS3?.bucket     ?? '')
  const [region,    setRegion]    = useState(storedS3?.region     ?? 'auto')
  const [accessKey, setAccessKey] = useState(storedS3?.accessKey  ?? '')
  const [secretKey, setSecretKey] = useState(storedS3?.secretKey  ?? '')
  const [connected, setConnected] = useState(false)
  const [error,     setError]     = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (storedS3) { setS3Config(storedS3); setConnected(isS3Connected()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSave() {
    setError(''); setSaving(true)
    // Strip all whitespace and default to https:// so a stray space or missing
    // scheme can't produce an unparseable URL later.
    let ep = endpoint.replace(/\s+/g, '')
    if (ep && !/^https?:\/\//i.test(ep)) ep = `https://${ep}`
    const cfg: S3Config = {
      endpoint: ep.replace(/\/+$/, ''),
      bucket: bucket.replace(/\s+/g, '').replace(/^\/+|\/+$/g, ''),
      region: region.trim() || 'auto',
      accessKey: accessKey.trim(), secretKey,
    }
    try {
      await testS3Connection(cfg)
      setS3Config(cfg); saveS3(cfg); setConnected(true)
      onConnectionChange?.(true)
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally { setSaving(false) }
  }

  async function onDisconnect() {
    setS3Config(null); saveS3(null); setConnected(false)
    setEndpoint(''); setBucket(''); setRegion('auto')
    setAccessKey(''); setSecretKey('')
    onConnectionChange?.(false)
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  return (
    <SectionCard title="S3 / Cloudflare R2 / Backblaze B2">
      <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
        Any S3-compatible object storage. Ensure CORS is configured when using from a web browser.
      </p>
      {connected ? (
        <div className="flex items-center justify-between">
          <StatusPill connected label={storedS3?.bucket ?? 'Connected'} />
          <Button variant="ghost" size="xs" onClick={() => void onDisconnect()}>
            <Icon name="x" size={11} className="mr-1" /> Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Endpoint URL" placeholder="https://…" type="url" value={endpoint} onChange={setEndpoint} />
            <Field label="Bucket" placeholder="my-vault" mono value={bucket} onChange={setBucket} />
            <Field label="Region" placeholder="auto" mono value={region} onChange={setRegion} />
            <Field label="Access Key ID" mono value={accessKey} onChange={setAccessKey} />
          </div>
          <Field label="Secret Access Key" type="password" mono value={secretKey} onChange={setSecretKey} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button variant="primary" size="md" onClick={() => void onSave()}
            disabled={saving || !endpoint || !bucket || !accessKey || !secretKey}>
            {saving ? 'Testing…' : 'Test & Connect'}
          </Button>
        </div>
      )}
    </SectionCard>
  )
}
