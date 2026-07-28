# Changelog

All notable changes to Kairos are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] — 2026-07-28

The largest release so far. Kanban grows into a Jira-grade issue tracker with
sprints and five view modes; deleting anything is now recoverable through a new
**Trash**; mobile gains **over-the-air updates**; the editor gets **slash
commands**; and the home screen and welcome tour are rebuilt.

### Added

#### Kanban

- **First-class issues with types and parent/child links.** Every card is now a
  typed issue — `story`, `task`, `bug`, or `subtask` — with an optional
  `parentId`. Subtasks are promoted to real issues with their own IDs and pages
  instead of embedded checklist items. Existing embedded subtasks migrate
  automatically into first-class children (preserving their checkpoints as a
  lightweight checklist) on first load, non-destructively until the board is
  next edited.
- **Human-readable issue keys.** Each board derives a key prefix from its title
  (e.g. `KAIR`) and hands out stable, sequential keys like `KAIR-42`, shown on
  cards, in lists, in search, and in the command palette. Keys are assigned
  deterministically during migration so they stay consistent across reloads.
- **Five board views via tabs.** A Jira-style tab bar switches between
  **Summary**, **Timeline**, **Backlog**, **Board**, and **List**, encoded in the
  URL (`?view=`) so a view is deep-linkable and survives tab switches.
- **List view.** A flat, sortable issue table (sort by key, summary, status,
  priority, due) with subtasks nested under their parents.
- **Timeline (Gantt) view.** Issue bars span each issue's start → due date across
  a month-scaled grid with a "today" marker; a new **start date** field feeds it.
- **Backlog with sprints.** Create sprints, drag issues between the backlog and
  sprints, and cycle sprint status (planned → active → completed). Deleting a
  sprint returns its issues to the backlog.
- **Sprint scope on the board.** A Sprint dropdown scopes the Board, List, and
  Timeline to a chosen sprint (or the backlog), combining with the other filters.
- **Board grouping by parent (swimlanes).** A "Group: Subtask" toggle renders one
  collapsible swimlane per parent story with its subtasks across the columns;
  parent issues without subtasks collect under an "Everything else" lane. When
  ungrouped, the board shows only top-level issues.
- **Summary dashboard.** Completion donut with % done, stat tiles (total,
  completed, in progress, to do, overdue), status/priority/type breakdowns,
  per-sprint progress bars, and "due soon" and "recent activity" panels — all
  clickable to open an issue.
- **Per-issue pages and a redesigned detail.** Issues open at
  `/kanban/:boardId/:taskId` as a full page, or in the drawer, sharing a
  two-column Jira-style layout: main content plus a right **Details** panel
  (type, priority, parent, sprint, start/due dates, labels, timestamps) and a
  prominent status dropdown, with breadcrumb navigation between parent and child.
- **Dedicated markdown description editor.** The task description is now a
  purpose-built editor — a formatting toolbar (bold, italic, strikethrough, code,
  H1/H2, lists, checklist, quote, link), a Write/Preview toggle, and rendered
  markdown in read mode — instead of reusing the notes editor.

#### Trash

- **Deleting anything is now recoverable.** Notes, journal entries, boards,
  canvases, pen notes and attachments move to a new **Trash** (`/trash`) instead
  of being destroyed. Restore puts an item back under its original id,
  timestamps and folder — rebuilding the vault file and re-pushing it to every
  connected sync provider — so a restored item is indistinguishable from one that
  was never deleted. Reachable from the activity bar, the mobile nav and the
  command palette, with per-kind filters, per-item restore / delete-forever, and
  Empty trash.
- **Retention timer.** Choose how long deleted items survive — Forever, 1, 7, 30
  (default) or 90 days — in **Settings → General → Trash**. A sweeper purges
  expired items at startup and hourly thereafter, and re-runs immediately when
  the window is shortened. The setting travels with your other synced prefs.
- The trash itself is **device-local by design**: it is never written to the
  vault or pushed to a provider, so a pull from another device can't resurrect
  something you deleted here.

#### Mobile

- **Over-the-air updates.** Mobile builds now self-update without an app-store
  reinstall, via self-hosted [Capgo](https://capgo.app) in manual mode
  (`autoUpdate: false` — no Capgo Cloud account, no server, no cost). CI zips
  `dist/` into `kairos-mobile-<ver>.zip` alongside a `mobile-latest.json`
  manifest and attaches both to the same GitHub Release; the app polls the
  manifest and applies bundles itself (`useMobileUpdater`,
  `scripts/build-mobile-bundle.mjs`).
- **Native-compatibility gate.** Each bundle records the minimum native shell it
  needs (`otaMinNative`), and the app refuses any bundle newer than the installed
  APK can run — telling the user to update the app instead of loading a bundle
  that would crash. `notifyAppReady()` fires on launch so a bad bundle rolls back
  automatically.

#### Editor

- **Slash commands.** Type `/` at the start of an empty paragraph for a filtered,
  keyboard-navigable insert menu — headings, lists, checklists, quotes, code,
  tables, dividers, images, links and all five callout types, with grouped
  submenus (`SlashMenu`, `useSlashMenu`).
- **Transclusion from the context menu.** The editor's right-click menu now has a
  **Link / embed** submenu offering wikilink, embed (transclusion) and external
  link, rather than only the two link options.

#### Home screen

- **Workspace grid.** A tile per content type — notes, journal, kanban, pen
  notes, canvas, attachments, graph — each with a live count and a one-tap route.
- **Recent activity feed.** A unified "recently touched" list across every
  content type, so the newest work of any kind is one click from home.

#### Appearance & onboarding

- **Text size setting.** Font settings gain **size** alongside typeface and
  weight — Small / Default / Large / Larger (14–20px). It drives the root font
  size, so rem-based type and spacing scale together, and it is applied before
  first paint so there is no resize flash on launch.
- **Personalise step in the welcome tour.** A new second step offers theme and
  text size, applied live — the rest of the tour then renders in the look you
  just picked.

### Changed

- **Smoother drag-and-drop.** Removed the gimmicky rotate/scale on the drag
  overlay and the overshoot/bounce drop easing; cards now lift cleanly and glide
  into place, with clear dashed drop-zone placeholders on both the flat board and
  the swimlanes.
- **Sprint and search scopes are transient.** They reset to "All" on load so a
  stale scope can't silently hide issues between sessions.
- **Selecting a graph node now highlights the path it belongs to.** Its edges
  brighten and thicken while unrelated nodes dim, and direct neighbours get an
  accent ring — previously this only happened in focus mode. Node and link
  colours also track the active theme's accent instead of a hardcoded indigo.
- **The block "+" handle works everywhere.** It was touch-only and driven by
  Crepe's BlockEdit; it now appears on every platform, anchors to the caret's
  block, and opens the same slash menu you get by typing `/`.
- **Interactive swimlane headers.** The whole header was one collapse button;
  the chevron now toggles collapse on its own and clicking the parent story opens
  its detail — the only way to reach a parent that never appears as a card.
- **Updates panel serves both platforms.** Settings → Updates drives the Tauri
  updater on desktop and the OTA updater on mobile through one shared interface,
  instead of telling mobile users that auto-updates are desktop-only.
- **Welcome tour rebuilt.** Five steps instead of a monolithic modal: dialog
  semantics (`role="dialog"`, `aria-modal`, labelled by the live step heading),
  Escape to leave, ←/→ to page through, focus moved into each new step and
  trapped inside the dialog, clickable progress dots with a step counter, and
  animations that honour `prefers-reduced-motion`. Content was refreshed to cover
  pen notes, attachments and the trash, and the command-palette shortcut it shows
  is now read from your key bindings instead of being hardcoded.

### Removed

- **PDF export.** The PDF option is gone from both the notes and journal export
  menus; Markdown and HTML export are unaffected.

### Fixed

- **Query-string navigation dropped by the pane router.** The per-pane navigator
  discarded `search`/`hash` when navigating with a resolved path object, so
  `?view=` never applied and every board tab except Board appeared inert. It now
  preserves the query string, fixing view switching app-wide.
- **Board crash from legacy filters.** Kanban filters persisted before newer
  fields (types, sprint) existed rehydrated with `undefined`, throwing on render;
  the store now backfills defaults on rehydration.
- **Duplicate swimlane drop targets.** Every swimlane reused the same column ids,
  so dragging highlighted the matching column in *all* lanes at once; droppable
  ids are now unique per lane, and the drag overlay matches the card width.
- **Duplicate headings in the issue detail**, and the Vite dev server now ignores
  `src-tauri/**` so Rust build output no longer triggers reloads.
- **Replaying the welcome tour duplicated the sample notes.** "Replay welcome
  tour" re-ran the seeding step every time, adding another *Welcome to Kairos* and
  *Kairos Features* pair on each replay. Seeding is now guarded by a persisted
  flag, and a replay closes in place instead of navigating you away.
- **Typing after a link kept extending the link.** With the caret at a link's
  trailing edge the stored link mark stayed active, so the next characters were
  swallowed into the link text. The mark is now dropped at the boundary.
- **Due-date calendar clipped inside the issue panel.** The picker rendered
  inline in a scrollable container and was cut off near the bottom. It now
  renders in a portal, flips above the trigger when there isn't room below, and
  closes on scroll rather than detaching from its trigger.
- **Block "+" handle mis-anchored on empty paragraphs.** `coordsAtPos` could
  report the document end for an empty block, parking the handle at the wrong
  line; it now measures the block element's rect.

## [0.0.6] — 2026-07-02

### Fixed

- **S Pen writing latency on Samsung tablets.** Vertical and mixed strokes (e.g.
  writing a `T`) would drop the first points — appearing blank, then a dash,
  then catching up — because the canvas used `touch-action: pan-y`, letting the
  WebView compositor withhold pen events while disambiguating scroll-vs-draw.
  The pen canvas now flips `touch-action` to `none` while a pen is hovering (so
  every stroke registers instantly) and restores `pan-y` when the pen leaves, so
  one-finger scroll with native momentum still works.

## [0.0.5] — 2026-07-02

The attachments release: files become a first-class content type that syncs as
real binary data across every provider, embeds inline in notes, and exports
with your content.

### Added

- **Attachments as a first-class content type.** New `/attachments` section with
  its own sidebar folder tree, gallery, viewer, file rows, and context menu
  (rename / move / delete). Backed by a dedicated `useAttachmentStore` with full
  CRUD plus folder create / rename / delete. Each attachment has its own id, name,
  and folder; notes and journals reference them via `attachment://<id>`.
- **Binary attachment sync across all providers.** New `attachmentSync` module
  and a binary-blob API on the remote-provider interface, implemented for local
  folder, plain folder, S3, WebDAV, and Proton Drive. A manifest keeps standalone
  attachments consistent across devices, and sync is wired into the orchestrator's
  normal cycle.
- **Inline attachments in the editor.** New `attachmentRenderPlugin` and
  `attachmentWidgets` render images and files inline from `attachment://` refs,
  with banner-image support (`useResolvedBanner`, `EditorBannerArea`).
- **Paste-to-attach.** Paste an image onto the Attachments page — either raw
  clipboard bytes (copying an image) or a remote image URL (copying an image
  address) — to import it directly (`useAttachmentPaste`).
- **Attachment-aware export.** HTML/site export inlines attachments as data URLs
  and can bundle them into a zip (`attachmentExport`, `publishSiteGenerator`).
- **Navigation & search coverage.** Attachments are reachable from the ActivityBar,
  the mobile floating nav, and the command palette, and are indexed in universal
  search.

### Changed

- **Storage usage now counts attachments.** Attachment sizes are included in
  storage/tier calculations (`storageUsage`, `tiers`).
- **New `attachments` table** added to the Dexie schema.
- Markdown/HTML export and reading-mode rendering updated to resolve attachment
  references correctly.

### Fixed

- **Mobile text selection.** Native selection is restored on touch devices —
  drag handles and the Cut / Copy / Paste / Select All action bar now work.
  The global `contextmenu` suppression and the editor's custom context menu are
  now skipped on touch (via a shared `isTouch()` helper) so the WebView's native
  selection UI takes over.

[0.0.7]: https://github.com/AjilJagadeesh7/kairos/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/AjilJagadeesh7/kairos/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/AjilJagadeesh7/kairos/compare/v0.0.4...v0.0.5
