# Changelog

All notable changes to Kairos are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
