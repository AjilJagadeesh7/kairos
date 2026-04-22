import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'
import { useAppStore } from './store/useAppStore'
import { Header } from './components/layout/Header'
import { AppRoutes } from './routes'
import { LoaderBar } from './components/ui/LoaderBar'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import type { ThemeMode } from './types'

function App() {
  const notes = useLiveQuery(() => db.notes.toArray(), [], undefined)
  const cleanupDoneRef = useRef(false)
  const setActiveNoteId = useAppStore((s) => s.setActiveNoteId)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('mindvault.theme') as ThemeMode | null
    return stored ?? 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    if (theme === 'light') root.classList.remove('dark')
    else root.classList.add('dark')
    localStorage.setItem('mindvault.theme', theme)
  }, [theme])

  // Clean up empty untitled notes left from previous sessions
  useEffect(() => {
    if (!notes || cleanupDoneRef.current) return
    cleanupDoneRef.current = true

    const emptyUntitled = notes.filter(
      (note) =>
        note.title.trim() === 'Untitled note' &&
        note.content.trim() === '' &&
        note.tags.length === 0,
    )

    if (emptyUntitled.length > 0) {
      void (async () => {
        for (const note of emptyUntitled) {
          await db.notes.delete(note.id)
          await db.syncMeta.delete(note.id)
        }
        setActiveNoteId(undefined)
      })()
    }
  }, [notes, setActiveNoteId])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      <LoaderBar />
      <ConfirmDialog />
      <Header theme={theme} setTheme={setTheme} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppRoutes />
      </div>
    </div>
  )
}

export default App
