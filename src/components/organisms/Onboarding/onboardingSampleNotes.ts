export const SAMPLE_NOTE_2_TITLE = 'Kairos Features'
export const SAMPLE_NOTE_2 = `## What makes Kairos different

> [!TIP] Privacy first
> Everything is stored locally on your device. No accounts, no telemetry, no cloud lock-in. Sync is optional and always end-to-end encrypted.

### Folders
Organise notes into folders from the sidebar. Drag notes between folders, create nested subfolders, and rename them — any **[[wikilinks]]** pointing to renamed notes update automatically.

### Callout blocks
Use Obsidian-style callouts anywhere in your notes. All 8 types are supported:

> [!NOTE]
> General information — aliases: \`INFO\`

> [!TIP]
> Helpful hints — aliases: \`HINT\`, \`SUCCESS\`

> [!IMPORTANT]
> Key things to remember.

> [!WARNING]
> Watch out — aliases: \`CAUTION\`

> [!DANGER]
> Critical issues — aliases: \`BUG\`, \`ERROR\`

> [!EXAMPLE]
> Illustrative examples.

> [!QUOTE]
> Quotations — aliases: \`CITE\`

> [!ABSTRACT]
> Summaries — aliases: \`SUMMARY\`, \`TLDR\`

### Kanban & Journal
Built-in **Kanban boards** — with sprints, swimlanes, list and backlog views — plus a **Journal** for daily notes. No plugins needed.

### Pen notes & attachments
Handwrite with a stylus in **Pen notes**, and keep images, PDFs and files in **Attachments** with their own folder tree. Drag a file into a note to embed it.

### Nothing is lost by accident

> [!TIP] The Trash has your back
> Deleting anything — a note, board, canvas, pen note or file — moves it to the **Trash** instead of destroying it. Restore it any time, or let the retention timer clear it out. Set the window in **Settings → General → Trash**.
`

export const SAMPLE_NOTE_1_TITLE = 'Welcome to Kairos'
export const makeSampleNote1 = (name?: string) => `## ${name ? `Getting started, ${name}` : 'Getting started'}

> [!NOTE]
> These are sample notes to help you explore Kairos. Delete them whenever you're ready to start fresh.

### Wikilinks — connect your notes

Type \`[[\` anywhere to get an autocomplete list of your notes. Rename a note and every \`[[link]]\` pointing to it updates automatically — no broken links.

Here's a link to [[${SAMPLE_NOTE_2_TITLE}]].

### Transclusion — embed a note inline

Prefix with \`!\` to embed another note's content live:

![[${SAMPLE_NOTE_2_TITLE}]]

### Command palette

Press \`Ctrl+P\` (or \`Cmd+P\` on Mac) to instantly search and open **notes**, **journal entries**, **tasks**, and **settings** from anywhere in the app.

### Callout blocks

Use Obsidian-style callouts with \`> [!TYPE]\` syntax:

> [!TIP] Supported types
> NOTE · TIP · IMPORTANT · WARNING · DANGER · EXAMPLE · QUOTE · ABSTRACT

### Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Save note | \`Ctrl+S\` |
| Command palette | \`Ctrl+P\` |
| Keyboard shortcuts | \`Ctrl+/\` |

> [!TIP] Customise your shortcuts
> Go to **Settings → Keyboard** to remap any shortcut to your preference.

### Deleted something by mistake?

Everything you delete goes to the **Trash** first, so it is always recoverable. Open it from the activity bar, restore what you need, and choose how long items are kept in **Settings → General → Trash**.

---

The **sidebar** is a full file explorer — create folders, drag notes, and search across everything.

> [!NOTE] Replay this tour
> **Settings → General → Replay welcome tour** walks you through the basics again. It will not re-create these sample notes.
`
