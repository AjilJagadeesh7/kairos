import { useNavigate } from 'react-router-dom'

import { useAppStore } from '../store/useAppStore'
import { usePenNoteStore } from '../store/usePenNoteStore'
import { useCanvasStore } from '../store/useCanvasStore'
import { todayDate } from '../store/useJournalStore'
import { WorkspaceGrid } from '../components/organisms/Landing/WorkspaceGrid'
import { RecentActivity } from '../components/organisms/Landing/RecentActivity'
import { Button } from '../components/atoms/Button'
import { Icon } from '../icons/Icon'
import type { IconToken } from '../icons/tokens'

function greeting(name: string): string {
  const h = new Date().getHours()
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name.trim() ? `${base}, ${name.trim().split(' ')[0]}` : 'Kairos'
}

export function LandingPage() {
  const navigate     = useNavigate()
  const userName     = useAppStore(s => s.userName)
  const createNote   = useAppStore(s => s.createNote)
  const createPen    = usePenNoteStore(s => s.create)
  const createCanvas = useCanvasStore(s => s.createCanvas)
  const today        = todayDate()

  const actions: Array<{ label: string; iconName: IconToken; onClick: () => void }> = [
    { label: 'New note',    iconName: 'book-open',     onClick: () => void createNote().then(id => navigate(`/notes/${id}`)) },
    { label: 'Pen note',    iconName: 'pen-line',      onClick: () => navigate(`/pennote/${createPen()}`) },
    { label: 'Canvas',      iconName: 'pen-tool',      onClick: () => navigate(`/canvas/${createCanvas()}`) },
    { label: 'Board',       iconName: 'square-kanban', onClick: () => navigate('/kanban') },
    { label: "Today's entry", iconName: 'calendar-days', onClick: () => navigate(`/journal/${today}`) },
  ]

  return (
    <main className="h-full overflow-y-auto bg-[rgb(var(--bg))] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Hero */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[rgb(var(--text))]">
            {greeting(userName)}
          </h1>
          <p className="mt-1 text-[rgb(var(--text-2))]">
            {userName.trim()
              ? 'Your private, local-first workspace'
              : 'Private-by-default notes, kanban, canvas, and knowledge base'}
          </p>
        </div>

        {/* Quick create */}
        <div className="flex flex-wrap gap-2">
          {actions.map(a => (
            <Button key={a.label} variant="hollow" size="md" onClick={a.onClick} className="inline-flex items-center gap-1.5">
              <Icon name={a.iconName} size={15} className="text-[rgb(var(--accent))]" /> {a.label}
            </Button>
          ))}
        </div>

        {/* Every content type, with live counts */}
        <WorkspaceGrid />

        {/* Recent work across all content types */}
        <RecentActivity />

        {/* Footer link */}
        <div className="flex flex-wrap gap-3 border-t border-[rgb(var(--border))] pt-6">
          <Button variant="link" size="sm" onClick={() => navigate('/graph')}>
            <Icon name="network" size={15} className="text-[rgb(var(--accent))]" /> Graph view
          </Button>
          <Button variant="link" size="sm" onClick={() => navigate('/settings')}>
            <Icon name="settings-2" size={15} className="text-[rgb(var(--accent))]" /> Settings
          </Button>
        </div>
      </div>
    </main>
  )
}
