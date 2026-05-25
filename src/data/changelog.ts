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
    version: '0.1.0',
    date: '2025-05-25',
    highlights: ['Initial release of MindVault'],
    added: [
      'Notes with Markdown editor, wikilinks, tags, and backlinks',
      'Daily journal with calendar view',
      'Kanban boards with drag-and-drop, priorities, and due dates',
      'Infinite canvas with note cards, text, and web pages',
      'Force-directed knowledge graph',
      'Semantic search using local AI embeddings',
      'Full-text search with Tantivy',
      'Local-first vault storage — no cloud account required',
      'Theme support (light, dark, system)',
      'Plugin system with marketplace',
      'Keyboard shortcut customization',
    ],
  },
]
