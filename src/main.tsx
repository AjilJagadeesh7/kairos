import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './index.css'
import App from './App.tsx'

// Service worker is registered automatically by vite-plugin-pwa (registerType: 'autoUpdate').
// The manual /sw.js registration below is removed to avoid duplicate SW conflicts.

// StrictMode is intentionally omitted: Milkdown's debounced serializer accesses
// editorViewCtx in a setTimeout that outlives the first effect invocation when
// Strict Mode double-invokes effects, causing an uncatchable MilkdownError.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
