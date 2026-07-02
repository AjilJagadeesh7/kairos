import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import 'katex/dist/katex.min.css'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App.tsx'
import { logger } from './logger/logger'

// Suppress the browser/WebView native context menu — but only in production
// builds. In dev (`tauri dev`, where devtools are enabled), letting the native
// menu through keeps the right-click "Inspect Element" option available so the
// console and network tabs are reachable. Release builds keep the menu off and
// have no devtools compiled in, so the option never shows up for users.
//
// Touch devices are exempt: on a coarse pointer the long-press that fires
// `contextmenu` is also the gesture that starts text selection, so preventing
// it here would break the native selection handles + Cut/Copy/Paste/Select All
// action bar that mobile users expect.
const isCoarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false
if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', e => {
    if (!isCoarsePointer()) e.preventDefault()
  })
}

window.onerror = (_msg, _source, _line, _col, error) => {
  logger.captureError(error ?? new Error(String(_msg)), 'window.onerror')
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason
  const msg = typeof reason === 'string' ? reason : (reason instanceof Error ? reason.message : '')
  // Skip Vite HMR module-reload failures — dev-only noise, not real app errors
  if (msg.includes('Importing a module script failed')) return
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
