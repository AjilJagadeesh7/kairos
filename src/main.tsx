import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW is a progressive enhancement — failure is silent
    })
  })
}

// StrictMode is intentionally omitted: Milkdown's debounced serializer accesses
// editorViewCtx in a setTimeout that outlives the first effect invocation when
// Strict Mode double-invokes effects, causing an uncatchable MilkdownError.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
