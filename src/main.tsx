import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './index.css'
import App from './App.tsx'
import { logger } from './logger/logger'

window.onerror = (_msg, _source, _line, _col, error) => {
  logger.captureError(error ?? new Error(String(_msg)), 'window.onerror')
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason
  // Skip Vite HMR module-reload failures — dev-only noise, not real app errors
  if (typeof reason === 'string' && reason.includes('Importing a module script failed')) return
  logger.captureError(reason ?? new Error('Unhandled promise rejection'), 'unhandledrejection')
}

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
