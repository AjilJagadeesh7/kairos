import { Routes, Route } from 'react-router-dom'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { LandingPage } from './pages/LandingPage'
import { GraphPage } from './pages/GraphPage'
import { KanbanPage } from './pages/KanbanPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/notes/:noteId" element={<NotesPage />} />
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/kanban" element={<KanbanPage />} />
      <Route path="/kanban/:boardId" element={<KanbanPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
