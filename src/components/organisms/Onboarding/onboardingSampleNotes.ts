export const SAMPLE_NOTE_2_TITLE = 'MindVault Features'
export const SAMPLE_NOTE_2 = `## What makes MindVault different

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
Built-in **Kanban boards** for task management and a **Journal** view for daily notes — no plugins needed.
`

export const SAMPLE_NOTE_1_TITLE = 'Welcome to MindVault'
export const makeSampleNote1 = () => `## Getting started

> [!NOTE]
> These are sample notes to help you explore MindVault. Delete them whenever you're ready to start fresh.

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

---

The **sidebar** is a full file explorer — create folders, drag notes, and search across everything.
`
