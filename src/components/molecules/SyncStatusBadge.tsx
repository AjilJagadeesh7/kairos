import { NavLink } from 'react-router-dom'
import { Cloud, CloudOff } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { anySyncProviderConnected } from '../../sync/syncOrchestrator'

export function SyncStatusBadge(): JSX.Element {
  const syncStatus = useAppStore((s) => s.syncStatus)
  const connected = anySyncProviderConnected()

  const dotColor =
    syncStatus === 'ok'      ? 'bg-green-500'  :
    syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
    syncStatus === 'error'   ? 'bg-red-400'    : 'bg-[rgb(var(--surface-3))]'

  return (
    <NavLink to="/settings" title={connected ? `Sync active · ${syncStatus}` : 'Sync disabled — click to configure'}>
      <div className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
        {connected ? <Cloud size={13} /> : <CloudOff size={13} />}
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      </div>
    </NavLink>
  )
}
