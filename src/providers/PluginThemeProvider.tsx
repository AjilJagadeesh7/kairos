import { useEffect, type ReactNode } from 'react'
import { usePluginThemes } from '../plugins/pluginContext'

// Applies plugin-registered theme tokens as CSS variables on :root.
// Dark-mode overrides are scoped to html[data-theme="dark"] so they
// respect the app's existing theme toggle without additional coordination.

export function PluginThemeProvider({ children }: { children: ReactNode }) {
  const themes = usePluginThemes()

  useEffect(() => {
    const styleId = 'mv-plugin-themes'
    let el = document.getElementById(styleId) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = styleId
      document.head.appendChild(el)
    }

    const lightLines: string[] = []
    const darkLines: string[]  = []
    const rawParts: string[]   = []

    for (const theme of themes) {
      if (theme.tokens) {
        for (const [key, val] of Object.entries(theme.tokens)) {
          lightLines.push(`  ${key}: ${val};`)
        }
      }
      if (theme.darkTokens) {
        for (const [key, val] of Object.entries(theme.darkTokens)) {
          darkLines.push(`  ${key}: ${val};`)
        }
      }
      if (theme.rawCSS) rawParts.push(theme.rawCSS)
    }

    const parts: string[] = []
    if (lightLines.length) parts.push(`:root {\n${lightLines.join('\n')}\n}`)
    if (darkLines.length)  parts.push(`html[data-theme="dark"] {\n${darkLines.join('\n')}\n}`)
    if (rawParts.length)   parts.push(rawParts.join('\n'))
    el.textContent = parts.join('\n')

    return () => { if (el) el.textContent = '' }
  }, [themes])

  return <>{children}</>
}
