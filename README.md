# Kairos

**A privacy-first, local-first knowledge workspace — notes, journal, kanban, canvas, and knowledge graph, all on your device.**

No accounts. No cloud required. No telemetry. Your data never leaves your machine unless you explicitly turn on sync.

---

## What's inside

| Module | What it does |
| ------ | ------------ |
| **Notes** | Rich markdown editor with wikilinks, transclusion, backlinks, tags, version history, PDF export |
| **Journal** | Daily entries with a calendar sidebar, full-text search, auto-save |
| **Kanban** | Drag-and-drop boards with subtasks, priorities, due dates, and note links |
| **Canvas** | Freeform whiteboard — text cards, embedded notes, web pages, custom nodes |
| **Knowledge Graph** | Force-directed graph of wikilink connections between notes |
| **Plugins** | First-class plugin system — inject UI anywhere, add themes, custom node types, editor blocks |

---

## Features

### Notes

- Rich markdown editor (Milkdown / ProseMirror) — bold, italic, tables, code, math, callouts
- **Wikilinks** — type `[[` to link notes with autocomplete; hover for a preview popover
- **Transclusion** — type `![[` to embed another note's content as a live card
- Full-text search (fuzzy + prefix) and semantic AI search via local Ollama
- Tags with colours, backlinks panel, frontmatter properties, note word/char counts
- **Version history** — every save is snapshotted; restore any version with one click
- **11 note templates** — Meeting Notes, Project Plan, Brainstorm, Bug Report, Weekly Review, and more
- Reading mode, PDF export, Markdown export

### Journal

- Daily entries keyed by date at `/journal/YYYY-MM-DD`
- Calendar sidebar with Monday-first grid
- Search across all entries by content or date
- Version history per entry, auto-save with 2s debounce + Ctrl+S

### Kanban

- Multiple boards, drag-and-drop columns and cards
- Subtasks, checkpoints, priorities (urgent / high / medium / low), due dates, labels
- Filter by priority, due date, and tag; sort by manual order, priority, or due date
- Undo / redo per board

### Canvas

- Freeform whiteboard powered by ReactFlow
- Text cards, embedded note cards (live wikilink preview), web page iframes
- Minimap, fit-view, named canvas list, custom plugin node types

### Knowledge Graph

- Force-directed 2D graph of note–note wikilink connections
- Tag clustering, neighbourhood focus mode, cosine-similarity semantic edges
- Right-click node to create a new wikilink, pin nodes, search + highlight

### Sync (optional, always encrypted)

- S3-compatible (AWS S3, Backblaze B2, Cloudflare R2, MinIO, any compatible provider)
- WebDAV
- Notes are encrypted on-device before upload — the server never sees plaintext

### AI (fully local)

- Semantic search via local embeddings (all-MiniLM-L6-v2, runs in-browser via transformers.js)
- Optional: connect to a local [Ollama](https://ollama.com) instance for LLM features
- Zero data sent to OpenAI, Anthropic, or any cloud AI service

---

## Plugin System

Kairos has a first-class plugin system. Plugins are plain JavaScript files that live in your vault — no marketplace account required, no build pipeline needed for simple plugins.

### What plugins can do

| Capability | API | Permission |
| ---------- | --- | ---------- |
| Add a full page + nav item | `api.registerPage(...)` | `ui:page` |
| Add a Settings section | `api.registerSettingsSection(...)` | `ui:settings` |
| Inject UI into any slot | `api.registerSlot(slotId, Component)` | `ui:slot` |
| Override CSS variables + inject raw CSS | `api.registerTheme(...)` | `ui:theme` |
| Add command palette entries | `api.registerCommand(...)` | `ui:commands` |
| Add editor toolbar buttons | `api.editor.registerToolbarItem(...)` | `editor:extend` |
| Inject raw Milkdown / ProseMirror plugins | `api.editor.registerMilkdownPlugin(...)` | `editor:extend` |
| Register custom canvas node types | `api.canvas.registerNodeType(type, Component)` | `canvas:extend` |
| Override built-in icons | `api.registerIconPack(...)` | `ui:icons` |
| Read and write notes | `api.notes.*` | `read:notes` / `write:notes` |
| Read and write kanban tasks | `api.kanban.*` | `read:kanban` / `write:kanban` |
| Subscribe to app events | `api.on(event, handler)` | `events` |
| Persist plugin data | `api.readPluginData / writePluginData` | — |

### Available UI slots

Slots are named positions across the app where plugins can inject React components:

```
editor:toolbar:start / end    Notes editor toolbar (left / right)
editor:title:below            Below the note title
notes:right-sidebar:panel     Extra panel in the note right rail
kanban:toolbar:end            Kanban board toolbar
kanban:card:footer            Bottom of each task card
canvas:toolbar:end            Canvas toolbar
journal:header:end            Journal date header
journal:sidebar:panel         Journal sidebar
sidebar:header:end            Notes sidebar header
sidebar:footer                Bottom of notes sidebar
activity-bar:bottom           Activity bar above settings
layout:status-bar             App-wide status bar
settings:sidebar:end          Settings sidebar
```

### Minimal example

```js
// {vault}/plugins/word-count/index.js
export default function setup(api) {
  const { React } = api

  function WordCount({ noteId }) {
    const [count, setCount] = React.useState(null)
    return React.createElement('button', {
      onClick: () => {
        const note = api.notes.get(noteId)
        setCount(note?.content.split(/\s+/).length ?? 0)
      },
      style: { fontSize: 11, padding: '0 8px' }
    }, count === null ? 'Count words' : `${count} words`)
  }

  api.registerSlot('editor:toolbar:end', WordCount)
}
```

```json
// {vault}/plugins/word-count/manifest.json
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "description": "Shows word count in the editor toolbar.",
  "author": "You",
  "entryPoint": "index.js",
  "permissions": ["ui:slot", "read:notes"]
}
```

Drop the folder into `{vault}/plugins/` and restart. It appears in **Settings → Plugins** automatically.

Full plugin documentation is available inside the app under **Settings → Plugins → Build a Plugin**.

---

## Platforms

| Platform | Method |
| -------- | ------ |
| Desktop (Windows, macOS, Linux) | Tauri v2 |
| Web / PWA | File System Access API |
| Mobile (iOS, Android) | Capacitor *(in progress)* |

Desktop builds include **over-the-air updates** — the app checks for new releases on startup.

---

## Tech Stack

| Layer | Library |
| ----- | ------- |
| UI | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + CSS variables theme system |
| Editor | Milkdown / Crepe (ProseMirror) |
| Canvas | ReactFlow |
| Graph | react-force-graph-2d |
| State | Zustand |
| Local DB | Dexie.js (IndexedDB) |
| Storage | Tauri FS (desktop) · File System Access API (web) |
| Embeddings | transformers.js — all-MiniLM-L6-v2, runs locally |
| Desktop shell | Tauri v2 |
| PWA | vite-plugin-pwa + Workbox |

---

## Getting Started (Development)

### Prerequisites

- Node.js 20+
- Rust + Cargo (for desktop builds only)
- A Chromium-based browser (for File System Access API in web mode)

### Web / PWA

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, click **Set up vault**, and pick a local folder. Notes are saved as plain `.md` files — readable by any text editor.

### Desktop (Tauri)

```bash
npm install
npm run tauri dev
```

```bash
# Production build
npm run tauri build
```

---

## Project Structure

```
src/
├── components/
│   ├── atoms/              # Button, TagBadge, IconButton, ToggleSwitch, …
│   ├── molecules/          # SlotRenderer, ModalShell, TagSelector, Dropdown, …
│   └── organisms/
│       ├── ActivityBar/    # App navigation bar
│       ├── Canvas/         # CanvasView, CanvasToolbar, node types
│       ├── Editor/         # MarkdownEditor, EditorDraft, HistoryPanel, …
│       ├── Graph/          # GraphView, GraphSidebar
│       ├── Journal/        # JournalCalendar, JournalEditor
│       ├── Kanban/         # BoardView, BoardList, task modals
│       ├── Notes/          # NotesHome, NoteTemplateModal
│       ├── Settings/       # All settings sections including plugin docs
│       └── Sidebar/        # Notes sidebar, FolderTree
├── hooks/                  # useAppStartup, useSidebarNotes, useGraphData, …
├── pages/                  # NotesPage, JournalPage, KanbanPage, CanvasPage, GraphPage, …
├── plugins/                # Plugin system — registry, API factory, loader, slot types
├── providers/              # PluginThemeProvider
├── store/                  # Zustand stores (useAppStore, useKanbanStore, …)
├── sync/                   # plainFolder, s3, webdav, syncOrchestrator, offlineQueue
├── search/                 # universalSearch — full-text index covering all content types
├── types/                  # Shared TypeScript types
└── utils/                  # wikilinks, timeAgo, stripMarkdown, folderTree, …

src-tauri/                  # Tauri v2 Rust shell + capabilities
```

---

## Sync Setup

### S3 / S3-compatible

Go to **Settings → Sync** and enter your bucket name, region, endpoint, access key, and secret key. Works with AWS S3, Backblaze B2, Cloudflare R2, MinIO, and any S3-compatible provider.

### WebDAV

Enter your WebDAV server URL and credentials in **Settings → Sync**.

---

## Adding a Feature to the Command Palette

The command palette (`src/components/organisms/CommandPalette.tsx`) is the single entry point for all searchable content. When adding a new content type or route, see the detailed checklist in [CLAUDE.md](./CLAUDE.md#adding-a-new-feature--command-palette-checklist).

---

## Releases

Desktop builds are distributed as signed installers for Windows (`.msi`), macOS (`.dmg`), and Linux (`.AppImage`).

PWA installs update automatically via the service worker — a "Reload to update" prompt appears when a new version is ready.

---

## Contributing

Pull requests are welcome. Open an issue before starting large changes so the approach can be discussed first.

By submitting a PR you agree your contribution will be licensed under AGPL-3.0.

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](./LICENSE).

Any modified version of Kairos distributed over a network must also be made available under AGPL-3.0.

---

## Author

Built by **Ajil Jagadeesh**

- GitHub: [@AjilJagadeesh7](https://github.com/AjilJagadeesh7)
- Email: ajiljagadeesh8@protonmail.com
<meta name="google-site-verification" content="8VJtAqFu9l8SE0ZTCVw9CRGSWGIj6RaL7634fHNheCc" />
