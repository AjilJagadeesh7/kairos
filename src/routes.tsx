import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { LandingPage } from './pages/LandingPage'
import { GraphPage } from './pages/GraphPage'
import { KanbanPage } from './pages/KanbanPage'
import { DailyNotesPage } from './pages/DailyNotesPage'
import { usePluginRegistry } from './plugins/pluginContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'

export function AppRoutes() {
  const { pages } = usePluginRegistry()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/notes/:noteId" element={<NotesPage />} />
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/daily" element={<DailyNotesPage />} />
      <Route path="/daily/:date" element={<DailyNotesPage />} />
      <Route path="/kanban" element={<KanbanPage />} />
      <Route path="/kanban/:boardId" element={<KanbanPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* Plugin-registered routes */}
      {pages.map(({ path, component: PluginPage }) => (
        <Route
          key={path}
          path={path}
          element={
            <ErrorBoundary fallback={
              <div className="flex h-full items-center justify-center p-8 text-sm text-red-400">
                Plugin failed to render. Check the console for details.
              </div>
            }>
              <Suspense fallback={
                <div className="flex h-full items-center justify-center p-8 text-sm text-[rgb(var(--text-3))]">
                  Loading plugin…
                </div>
              }>
                <PluginPage />
              </Suspense>
            </ErrorBoundary>
          }
        />
      ))}
    </Routes>
  )
}
