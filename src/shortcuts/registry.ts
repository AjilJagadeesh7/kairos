export type ShortcutContext = 'Global' | 'Notes' | 'Kanban' | 'Journal'

export interface ShortcutDef {
  id: string
  label: string
  context: ShortcutContext
  /** undefined = no default binding; user must add it explicitly */
  defaultKey?: string
}

// Actions with default bindings — always shown in the keyboard settings list
export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'command-palette', label: 'Open command palette', context: 'Global', defaultKey: 'ctrl+p' },
  { id: 'show-shortcuts', label: 'Show keyboard shortcuts', context: 'Global', defaultKey: 'ctrl+/' },
  { id: 'save-note',      label: 'Save note',               context: 'Notes',  defaultKey: 'ctrl+s' },
  { id: 'undo',           label: 'Undo',                    context: 'Kanban', defaultKey: 'ctrl+z' },
  { id: 'redo',           label: 'Redo',                    context: 'Kanban', defaultKey: 'ctrl+shift+z' },
  { id: 'close-panel',    label: 'Close panel / dialog',    context: 'Kanban', defaultKey: 'escape' },
]

// Actions without a default binding — user must pick a key via "Add shortcut"
export const EXTRA_SHORTCUTS: ShortcutDef[] = [
  // Global navigation
  { id: 'goto-notes',     label: 'Go to Notes',             context: 'Global'  },
  { id: 'goto-graph',     label: 'Go to Graph',             context: 'Global'  },
  { id: 'goto-kanban',    label: 'Go to Kanban',            context: 'Global'  },
  { id: 'goto-journal',   label: 'Go to Journal',           context: 'Global'  },
  { id: 'goto-settings',  label: 'Go to Settings',          context: 'Global'  },
  // Notes
  { id: 'new-note',       label: 'Create new note',         context: 'Notes'   },
  { id: 'delete-note',    label: 'Delete current note',     context: 'Notes'   },
  { id: 'toggle-history', label: 'Toggle version history',  context: 'Notes'   },
  // Kanban
  { id: 'new-task',       label: 'New task in first column',context: 'Kanban'  },
  // Journal
  { id: 'journal-today',  label: 'Jump to today',           context: 'Journal' },
]

export const SHORTCUT_REGISTRY: ShortcutDef[] = [...DEFAULT_SHORTCUTS, ...EXTRA_SHORTCUTS]

export type ShortcutId = (typeof SHORTCUT_REGISTRY)[number]['id']

export function normalizeEventKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  const key = e.key.toLowerCase()
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) parts.push(key)
  return parts.join('+')
}

export function matchesBinding(e: KeyboardEvent, binding: string): boolean {
  const parts  = binding.toLowerCase().split('+')
  const key    = parts.find(p => !['ctrl', 'shift', 'alt'].includes(p)) ?? ''
  const ctrl   = parts.includes('ctrl')
  const shift  = parts.includes('shift')
  const alt    = parts.includes('alt')
  const ctrlOrMeta = e.ctrlKey || e.metaKey
  return ctrlOrMeta === ctrl && e.shiftKey === shift && e.altKey === alt && e.key.toLowerCase() === key
}

export function bindingHasModifier(binding: string): boolean {
  return binding.includes('ctrl') || binding.includes('alt')
}

const KEY_LABELS: Record<string, string> = {
  ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt',
  escape: 'Esc', enter: 'Enter', tab: 'Tab',
  arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  ' ': 'Space', backspace: 'Backspace', delete: 'Del',
  '/': '/',
}

export function displayKey(binding: string): string {
  return binding
    .split('+')
    .map(k => KEY_LABELS[k] ?? k.toUpperCase())
    .join('+')
}
