# MindVault

**A privacy-first, local-first knowledge base — notes, journal, kanban, and knowledge graph, all on your device.**

No accounts. No cloud required. No telemetry. Your data never leaves your machine unless you explicitly enable sync.

---

## Features

### Notes
- Rich markdown editor (Milkdown / ProseMirror) with WYSIWYG toolbar
- **Wikilinks** — type `[[` to link between notes with autocomplete
- **Transclusion** — type `![[` to embed a note's content inline as a live card
- Full-text search (fuzzy + prefix) and semantic AI search via local Ollama
- Tags, backlinks panel, note info, PDF export
- **Version history** — every save creates a snapshot; restore any previous version
- **11 note templates** — Meeting Notes, Project Plan, Brainstorm, Book Notes, Bug Report, Weekly Review, and more

### Journal
- Daily entries with a calendar sidebar (Monday-first grid)
- Search across all journal entries by content or date
- Version history per entry
- Auto-save with 2 s debounce + Ctrl+S

### Kanban
- Multiple boards with drag-and-drop columns and tasks
- Subtasks, checkpoints, priorities, due dates, labels
- Tasks linkable to notes

### Knowledge Graph
- Force-directed 3D graph of note–note wikilink connections
- Tag clusters, neighbourhood focus, right-click to create links

### Sync (optional, always encrypted)
- S3-compatible storage (AWS, Backblaze, MinIO, etc.)
- WebDAV
- Notes are encrypted on-device before upload — the server never sees plaintext

### AI (fully local)
- Semantic search using local embeddings via [Ollama](https://ollama.com)
- No data sent to OpenAI, Anthropic, or any cloud AI service

### Privacy
- No accounts, no sign-up, no email required
- Everything stored locally (filesystem via File System Access API or Tauri FS)
- No analytics or telemetry of any kind
- Works fully offline

---

## Platforms

| Platform | Status |
|----------|--------|
| Desktop (Windows, macOS, Linux) | Tauri v2 |
| Web / PWA | File System Access API |
| Mobile (iOS, Android) | Capacitor (in progress) |

Desktop builds include **over-the-air updates** — the app checks for new releases on startup and prompts you to install.

---

## Tech Stack

| Layer | Library |
|-------|---------|
| UI | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + CSS variables theme system |
| Editor | Milkdown / Crepe (ProseMirror) |
| State | Zustand |
| Local DB | Dexie.js (IndexedDB) |
| Storage | Tauri FS (desktop) · File System Access API (web) |
| Graph | 3d-force-graph + Three.js |
| Embeddings | transformers.js (all-MiniLM-L6-v2, local) |
| Desktop shell | Tauri v2 |
| PWA | vite-plugin-pwa + Workbox |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Rust + Cargo (for desktop builds)
- A Chromium-based browser (for File System Access API in web mode)

### Web / PWA

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, click **Set up vault**, and pick a local folder. All notes are saved as plain `.md` files in that folder.

### Desktop (Tauri)

```bash
npm install
npm run tauri dev
```

Build a distributable:

```bash
npm run tauri build
```

---

## Project Structure

```
src/
├── components/
│   ├── atoms/          # Button, TagBadge, …
│   ├── molecules/      # NoteListItem, TagSelector, …
│   └── organisms/
│       ├── Editor/     # MarkdownEditor, EditorDraft, HistoryPanel, …
│       ├── Journal/    # JournalCalendar, JournalEditor
│       ├── Kanban/     # BoardView, BoardList, task modals
│       ├── Notes/      # NotesHome, NoteTemplateModal
│       ├── Settings/   # All settings sections
│       └── Onboarding/ # OnboardingModal
├── hooks/              # useAppStartup, useSidebarNotes, usePwaUpdate, …
├── pages/              # NotesPage, JournalPage, KanbanPage, GraphPage, …
├── store/              # Zustand stores (useAppStore, useJournalStore, …)
├── sync/               # plainFolder, s3, webdav, syncOrchestrator
├── search/             # Full-text note index (MiniSearch)
├── types/              # Shared TypeScript types
└── utils/              # wikilinks, timeAgo, stripMarkdown, …

src-tauri/              # Tauri v2 Rust shell
```

---

## Sync Setup

### S3 / S3-compatible
Go to **Settings → Sync** and enter your bucket name, region, endpoint, access key, and secret key. Works with AWS S3, Backblaze B2, Cloudflare R2, MinIO, and any S3-compatible provider.

### WebDAV
Enter your WebDAV server URL and credentials in **Settings → Sync**.

---

## Releases & Updates

Desktop builds are distributed as signed installers for Windows (`.msi`), macOS (`.dmg`), and Linux (`.AppImage`). The app checks for new releases on startup via the Tauri updater and shows a prompt to install.

PWA installs update automatically via the service worker — you'll see a "Reload to update" prompt when a new version is ready.

---

## Contributing

Pull requests are welcome. By submitting a PR you agree your contribution will be licensed under AGPL-3.0.

Please open an issue before starting large changes so we can discuss the approach first.

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](./LICENSE).

Any modified version of MindVault distributed over a network must also be made available under AGPL-3.0.

---

## Author

Built by **Ajil Jagadeesh**.

- GitHub: [@AjilJagadeesh7](https://github.com/AjilJagadeesh7)
- Email: ajiljagadeesh7@gmail.com
