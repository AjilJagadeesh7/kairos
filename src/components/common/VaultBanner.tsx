import { useAppStore } from '../../store/useAppStore'
import { usePaneStore } from '../../store/usePaneStore'
import { Icon } from '../../icons/Icon'

export function VaultBanner() {
  const vaultStatus = useAppStore(s => s.vaultStatus)

  if (vaultStatus === 'ok' || vaultStatus === 'loading') return null

  const isMissing = vaultStatus === 'missing'

  return (
    <div className={`flex items-center gap-3 border-b px-4 py-3 text-sm ${
      isMissing
        ? 'border-red-400/20 bg-red-500/5 text-red-400'
        : 'border-[rgb(var(--accent)/0.2)] bg-[rgb(var(--accent)/0.05)] text-[rgb(var(--accent))]'
    }`}>
      {isMissing
        ? <Icon name="alert-triangle" size={15} className="shrink-0" />
        : <Icon name="folder-open" size={15} className="shrink-0" />
      }
      <span className="flex-1 text-xs">
        {isMissing
          ? 'Your vault folder has moved or been deleted. Notes cannot be saved until you reconnect.'
          : 'No vault folder connected. Pick a local folder to start saving notes.'}
      </span>
      <button
        onClick={() => {
          const { focusedPaneId, navigatePane } = usePaneStore.getState()
          navigatePane(focusedPaneId, '/settings?section=vault')
        }}
        className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition ${
          isMissing
            ? 'bg-red-500/10 hover:bg-red-500/20'
            : 'bg-[rgb(var(--accent)/0.1)] hover:bg-[rgb(var(--accent)/0.2)]'
        }`}
      >
        {isMissing ? 'Reconnect' : 'Set up vault'}
      </button>
    </div>
  )
}
