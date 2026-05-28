export interface ChangelogEntry {
  version: string
  date: string
  highlights: string[]
  added?: string[]
  improved?: string[]
  fixed?: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.0.1',
    date: '2026-05-28',
    highlights: [
      'Initial release of Kairos — a local-first, privacy-first knowledge workspace.',
    ],
    added: [
      'Notes — Markdown editor with wikilinks, transclusions, tags, backlinks, and folder organisation',
      'Daily journal — calendar navigation, auto-save, version history, and date-keyed entries',
      'Kanban — drag-and-drop boards with columns, priorities, due dates, subtasks, comments, and attachments',
      'Canvas — infinite canvas with note cards, freeform text, images, and embedded web pages',
      'Graph — force-directed knowledge graph with cosine-similarity edges and position memory',
      'Full-text search — instant fuzzy search powered by MiniSearch with per-field boosting',
      'Semantic search — local AI embeddings for meaning-aware note discovery',
      'Command palette — Cmd+K launcher for navigation, search, and actions across all content types',
      'Split-pane layout — open multiple notes, boards, or views side by side with tab drag-and-drop',
      'Publish & Export — export notes to PDF, HTML, or Markdown with one click',
      'Custom callouts — define callout types with custom labels, emoji, and accent colours',
      'Plugin system — installable plugins with a slot API, command registration, and a Marketplace tab',
      'Keyboard shortcuts — fully customisable bindings with a visual shortcut browser',
      'Theme support — light, dark, and system-matched themes',
      'Version history — per-note and per-journal-entry restore points',
      'Auto-updates — in-app update checker and installer on desktop',
      'Local-first storage — all data lives in your vault folder, no cloud account required',
    ],
  },
]
