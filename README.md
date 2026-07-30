<div align="center">

<img src="public/logo.png" alt="Kairos" width="88" />

# Kairos

**A local-first knowledge workspace — notes, journal, kanban, canvas, handwriting and a knowledge graph, all stored as plain files on your own device.**

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/AjilJagadeesh7/kairos?display_name=tag&color=success)](https://github.com/AjilJagadeesh7/kairos/releases)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-lightgrey)](#install)

</div>

No account. No server. No telemetry. Kairos reads and writes an ordinary folder on
your disk — notes are `.md` files you can open in any editor, and everything else is
plain JSON. Uninstall the app and your work is still sitting there in readable form.

---

## Install

Grab an installer from the [latest release](https://github.com/AjilJagadeesh7/kairos/releases/latest).

| Platform | Package | Updates |
| -------- | ------- | ------- |
| Windows | `.msi` / `.exe` | Built-in updater, checks on launch |
| macOS (Apple Silicon + Intel) | `.dmg` | Built-in updater, checks on launch |
| Linux | `.AppImage` / `.deb` | Built-in updater, checks on launch |
| Android | `.apk` (or `.aab` for Play) | Over-the-air web-bundle updates |

Desktop releases are signed and verified by the updater before install. Android
builds fetch new web bundles over the air, with a native-compatibility gate that
declines any bundle the installed shell is too old to run. An iOS project is
included in the repo but is not distributed — build it yourself with Xcode.

On first launch, choose a folder to be your vault. That's the whole setup.

---

## Features

### Notes

- Markdown editor built on Milkdown / ProseMirror — tables, code blocks, math, callouts, images
- **Slash commands** — type `/` on an empty line for headings, lists, checklists, quotes, code, tables, dividers and callouts
- **Wikilinks** — `[[` to link with autocomplete and a hover preview; `![[` to transclude another note as a live card
- Backlinks panel, coloured tags, frontmatter properties, word and character counts
- **Annotations** — highlights and sticky notes in reading mode, stored alongside the note so the `.md` stays clean, and re-anchored on render so they survive edits elsewhere
- **Version history** — every save is snapshotted; restore any version in one click
- 11 starter templates; Markdown and HTML export

### Journal and periodic notes

- Daily entries at `/journal/YYYY-MM-DD` with a calendar sidebar
- Weekly, monthly, quarterly and yearly notes
- Auto-save (2s debounce, or `Ctrl+S`), per-entry history, search by content or date

### Kanban

- **Typed issues** — `story`, `task`, `bug`, `subtask`, with parent/child links and their own pages
- **Readable keys** — each board derives a prefix from its title and issues stable keys like `KAIR-42`
- **Five views** — Summary, Timeline (Gantt), Backlog, Board and List, each deep-linkable via `?view=`
- Sprints, swimlanes grouped by parent story, filters by priority/due/tag/type, and per-board undo–redo
- Purpose-built markdown description editor with a Write/Preview toggle

### Canvas

- Freeform whiteboard powered by React Flow
- Text cards, live note cards, and attachment cards for documents, images, video and audio
- Minimap, fit-view, named canvas list, and custom node types from plugins

### Pen notes

- Stylus-first handwriting canvas with pressure-sensitive ink
- Own sidebar, toolbar and version history, saved into the vault like everything else

### Attachments

- File library with tree and gallery views plus an in-app viewer
- Embed in notes or drop onto a canvas; files are tracked by id, so renaming or moving one never breaks a reference

### Knowledge graph

- Force-directed 2D graph of wikilink connections between notes
- Tag clustering, neighbourhood focus mode, node pinning, search and highlight
- Right-click a node to create a new wikilink

### Trash

- Every delete is recoverable — notes, journal entries, boards, canvases, pen notes and attachments
- Restore returns an item under its original id, timestamps and folder, rebuilding its vault file, so it is indistinguishable from one that was never deleted
- Retention is yours to set: forever, 1, 7, 30 or 90 days, swept at startup and hourly
- Device-local by design — the trash is never synced, so a pull from another device cannot resurrect something you deleted here

### Workspace

- Split panes with tabs, so a board and its notes can sit side by side
- Command palette (`Ctrl/Cmd+K`) searching every content type at once
- 18 themes in light and dark, plus font family, weight and size settings
- Customisable keyboard shortcuts

---

## Your data

Kairos owns no database you can't read. The vault is just a folder:

```
vault/
├── notes/          *.md — one file per note, YAML frontmatter
├── journal/        YYYY-MM-DD.md
├── kanban/         *.json — boards, issues, sprints
├── canvas/         *.json
├── pennotes/       ink strokes
├── attachments/    your files, plus an attachments.json index
├── history/        notes/ and journal/ version snapshots
├── plugins/        <plugin-id>/index.js + manifest.json
└── config/
```

---

## Sync — bring your own backend

Kairos does not run a sync service. Instead it pushes and pulls your vault against
storage **you** own, configured in **Settings → Sync**:

| Backend | Works with |
| ------- | ---------- |
| Local folder | Anything that syncs a directory — Syncthing, Dropbox, iCloud Drive, a NAS mount |
| S3-compatible | Cloudflare R2, AWS S3, Backblaze B2, MinIO, Wasabi, any S3 API |
| WebDAV | Nextcloud, ownCloud, Koofr, pCloud, Box, most NAS boxes |

Enter your own bucket or server credentials; they stay on device. Files are stored
in the same plain `.md` / `.json` form as your local vault, which keeps them
readable by any other tool — and means the backend can read them too, so pick
storage you're willing to trust, or one you host yourself. Changes queue while
offline and flush when the connection returns.

---

## Plugins

Plugins are plain JavaScript files that live in your vault. No marketplace account,
no build step, no bundler for simple ones. Every capability is gated by a permission
declared in the manifest.

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
| Override icons, or map icons by rule | `api.registerIconPack(...)` / `registerIconRules(...)` | `ui:icons` |
| Read and write notes | `api.notes.*` | `read:notes` / `write:notes` |
| Read and write kanban issues | `api.kanban.*` | `read:kanban` / `write:kanban` |
| Subscribe to app events | `api.on(event, handler)` | `events` |
| Persist plugin data | `api.readPluginData` / `writePluginData` | — |

<details>
<summary><strong>UI slots</strong> — named positions where a plugin can render</summary>

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

</details>

### A complete plugin

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
      style: { fontSize: 11, padding: '0 8px' },
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

Drop the folder into `{vault}/plugins/` and restart — it shows up under
**Settings → Plugins**. Full API reference lives in the app at
**Settings → Plugins → Build a Plugin**.

---

## Development

### Prerequisites

- Node.js 20+ (CI builds on the current LTS)
- Rust and Cargo — desktop builds only
- JDK 17 and the Android SDK — Android builds only

### Run it

```bash
npm install
npm run tauri dev    # desktop shell — the way to run Kairos
npm run dev          # UI-only dev server at :5173, for fast iteration on components
npm test             # vitest
npm run lint
npm run build        # typecheck + production web build
```

```bash
npm run tauri build     # desktop installers
npm run build:mobile    # web build + cap sync
```

### Layout

```
src/
├── components/
│   ├── atoms/          Button, IconButton, ToggleSwitch, TagBadge, …
│   ├── molecules/      ModalShell, EmptyState, SlotRenderer, Dropdown, …
│   └── organisms/      One folder per feature — Editor, Kanban, Canvas, Graph,
│                       Journal, PenNote, Attachments, Settings, Sidebar, …
├── hooks/              useAppStartup, useVaultWatcher, useGraphData, …
├── pages/              One page component per route
├── plugins/            Registry, API factory, loader, permission gate, slot types
├── store/              Zustand stores — useAppStore, useKanbanStore, …
├── sync/               Vault I/O plus the local-folder, S3 and WebDAV providers
├── search/             universalSearch — one index across every content type
├── trash/              Soft-delete capture and restore
├── types/              Shared TypeScript types
└── utils/              wikilinks, folderTree, stripMarkdown, platform, …

src-tauri/              Tauri v2 Rust shell and capabilities
android/ · ios/         Capacitor native projects
```

### Stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Dexie (IndexedDB) ·
Milkdown/Crepe (ProseMirror) · React Flow · react-force-graph-2d · Tauri v2 ·
Capacitor

---

## Contributing

Contributions are welcome. Please open an issue before starting anything large so
the approach can be agreed first — it saves rework on both sides.

- Keep modules under 300 lines and put shared types in `src/types/` — see [CLAUDE.md](./CLAUDE.md) for the conventions the codebase follows
- New content types and routes must be wired into the command palette; there's a [checklist](./CLAUDE.md#adding-a-new-feature--command-palette-checklist)
- Any new delete path must go through `src/trash/trashService.ts`, or that content becomes unrecoverable
- Run `npm test` and `npm run build` before opening a PR

By submitting a pull request you agree your contribution is licensed under AGPL-3.0.

---

## License

[GNU Affero General Public License v3.0](./LICENSE).

You're free to use, study, modify and share Kairos. If you distribute a modified
version — including running it as a network service — that version must also be
made available under AGPL-3.0.

---

## Maintainer

Built by **Ajil Jagadeesh** — [@AjilJagadeesh7](https://github.com/AjilJagadeesh7) ·
[ajiljagadeesh8@protonmail.com](mailto:ajiljagadeesh8@protonmail.com)

Bugs and ideas belong in [Issues](https://github.com/AjilJagadeesh7/kairos/issues).
