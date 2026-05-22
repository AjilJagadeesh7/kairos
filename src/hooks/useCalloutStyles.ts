import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { dynamicTypeMap } from '../components/organisms/Editor/calloutRegistry'

function hexToRgbComponents(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

function buildColorCSS(type: string, hex: string): string {
  const rgb = hexToRgbComponents(hex)
  return `
.milkdown .ProseMirror blockquote.callout-${type} { border-color: ${hex}; background: rgb(${rgb} / 0.07); }
.milkdown .ProseMirror blockquote.callout-${type} > p:first-child { color: ${hex}; background: rgb(${rgb} / 0.12); }
:root.dark .milkdown .ProseMirror blockquote.callout-${type} > p:first-child { color: ${hex}; }`
}

function buildCustomCSS(type: string, emoji: string, hex: string): string {
  const rgb = hexToRgbComponents(hex)
  return `
.milkdown .ProseMirror blockquote.callout-${type} { border-color: ${hex}; background: rgb(${rgb} / 0.07); }
.milkdown .ProseMirror blockquote.callout-${type} > p:first-child { color: ${hex}; background: rgb(${rgb} / 0.12); }
.milkdown .ProseMirror blockquote.callout-${type} > p:first-child::before { content: "${emoji}  "; }
:root.dark .milkdown .ProseMirror blockquote.callout-${type} > p:first-child { color: ${hex}; }`
}

const STYLE_ID = 'mv-callout-color-overrides'

export function useCalloutStyles() {
  const calloutColors  = useAppStore(s => s.calloutColors)
  const customCallouts = useAppStore(s => s.customCallouts)

  useEffect(() => {
    // Sync custom types into the module-level map read by the ProseMirror plugin
    for (const key of Object.keys(dynamicTypeMap)) delete dynamicTypeMap[key]
    for (const c of customCallouts) dynamicTypeMap[c.type] = c.type

    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }

    const colorOverrides = Object.entries(calloutColors)
      .map(([type, hex]) => buildColorCSS(type, hex))
      .join('\n')

    const customStyles = customCallouts
      .map(c => {
        const hex = calloutColors[c.type] ?? c.color
        return buildCustomCSS(c.type, c.emoji, hex)
      })
      .join('\n')

    el.textContent = colorOverrides + '\n' + customStyles
  }, [calloutColors, customCallouts])
}
