# Changelog

All notable changes to Kairos are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] — 2026-07-25

The Jira-grade Kanban release: boards gain first-class issues with types and
parent/child links, human-readable keys, five view modes, sprints, and a
redesigned issue detail.

### Added

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

### Changed

- **Smoother drag-and-drop.** Removed the gimmicky rotate/scale on the drag
  overlay and the overshoot/bounce drop easing; cards now lift cleanly and glide
  into place, with clear dashed drop-zone placeholders on both the flat board and
  the swimlanes.
- **Sprint and search scopes are transient.** They reset to "All" on load so a
  stale scope can't silently hide issues between sessions.

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

[0.0.5]: https://github.com/AjilJagadeesh7/kairos/compare/v0.0.4...v0.0.5
