import { Routes, Route } from 'react-router-dom'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { LandingPage } from './pages/LandingPage'
import { GraphView } from './components/organisms/Graph/GraphView'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/notes/:noteId" element={<NotesPage />} />
      <Route path="/graph" element={<GraphView />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
