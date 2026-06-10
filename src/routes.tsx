import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { LandingPage } from './pages/LandingPage'
import { usePluginRegistry } from './plugins/pluginContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { Icon } from './icons/Icon'

const GraphPage   = lazy(() => import('./pages/GraphPage').then(m => ({ default: m.GraphPage })))
const KanbanPage  = lazy(() => import('./pages/KanbanPage').then(m => ({ default: m.KanbanPage })))
const CanvasPage  = lazy(() => import('./pages/CanvasPage').then(m => ({ default: m.CanvasPage })))
const PenNotePage = lazy(() => import('./pages/PenNotePage').then(m => ({ default: m.PenNotePage })))
const JournalPage      = lazy(() => import('./pages/JournalPage').then(m => ({ default: m.JournalPage })))
const PeriodicNotesPage = lazy(() => import('./pages/PeriodicNotesPage').then(m => ({ default: m.PeriodicNotesPage })))

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center text-[rgb(var(--text-3))]">
      <Icon name="loader-2" size={20} className="animate-spin" />
    </div>
  )
}

export function AppRoutes() {
  const { pages } = usePluginRegistry()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/notes/:noteId" element={<NotesPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      <Route path="/graph" element={
        <Suspense fallback={<PageLoader />}><GraphPage /></Suspense>
      } />
      <Route path="/journal" element={
        <Suspense fallback={<PageLoader />}><JournalPage /></Suspense>
      } />
      <Route path="/journal/:date" element={
        <Suspense fallback={<PageLoader />}><JournalPage /></Suspense>
      } />
      <Route path="/kanban" element={
        <Suspense fallback={<PageLoader />}><KanbanPage /></Suspense>
      } />
      <Route path="/kanban/:boardId" element={
        <Suspense fallback={<PageLoader />}><KanbanPage /></Suspense>
      } />
      <Route path="/canvas" element={
        <Suspense fallback={<PageLoader />}><CanvasPage /></Suspense>
      } />
      <Route path="/canvas/:canvasId" element={
        <Suspense fallback={<PageLoader />}><CanvasPage /></Suspense>
      } />
      <Route path="/pennote" element={
        <Suspense fallback={<PageLoader />}><PenNotePage /></Suspense>
      } />
      <Route path="/pennote/:penNoteId" element={
        <Suspense fallback={<PageLoader />}><PenNotePage /></Suspense>
      } />

      <Route path="/periodic" element={
        <Suspense fallback={<PageLoader />}><PeriodicNotesPage /></Suspense>
      } />

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
              <Suspense fallback={<PageLoader />}>
                <PluginPage />
              </Suspense>
            </ErrorBoundary>
          }
        />
      ))}
    </Routes>
  )
}
