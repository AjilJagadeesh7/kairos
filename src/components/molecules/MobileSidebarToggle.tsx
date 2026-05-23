import { useAppStore } from '../../store/useAppStore'
import { Icon } from '../../icons/Icon'

export function MobileSidebarToggle() {
  const sidebarOpen    = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)

  return (
    <button
      type="button"
      aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      onClick={() => setSidebarOpen(!sidebarOpen)}
      className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-text3 transition hover:bg-surface2 hover:text-text"
    >
      <Icon name={sidebarOpen ? 'panel-left-close' : 'menu'} size={20} strokeWidth={1.75} />
    </button>
  )
}
