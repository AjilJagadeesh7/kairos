import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './index.css'
import App from './App.tsx'

// StrictMode is intentionally omitted: Milkdown's debounced serializer accesses
// editorViewCtx in a setTimeout that outlives the first effect invocation when
// Strict Mode double-invokes effects, causing an uncatchable MilkdownError.

// MemoryRouter is used instead of BrowserRouter so the app always starts at /
// (the landing page) on every launch — desktop/Tauri apps have no URL bar to
// restore, and BrowserRouter would remember the last-visited route across reloads.
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/']} initialIndex={0}>
    <App />
  </MemoryRouter>,
)
