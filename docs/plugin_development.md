# Kairos Plugin Development Guide

This guide details how to build and distribute custom plugins for Kairos using the **KairosPluginAPI**.

---

## 1. Directory Structure

All plugins reside in the vault's `plugins` directory. Every plugin must have its own folder matching its unique ID:

```text
{your-vault}/
└── plugins/
    └── my-plugin-id/
        ├── manifest.json
        └── index.js
```

---

## 2. Manifest File (`manifest.json`)

The manifest declares your plugin's metadata, entry point, and requested permissions.

```json
{
  "id": "my-plugin-id",
  "name": "My Pomodoro Timer",
  "version": "1.0.0",
  "description": "Adds a simple Pomodoro timer tab and configurable work sessions.",
  "author": "Jane Developer",
  "entryPoint": "index.js",
  "permissions": [
    "ui:page",
    "ui:settings",
    "events",
    "write:notes"
  ]
}
```

### Available Permissions

| Permission | What it grants |
| ---------- | -------------- |
| `read:notes` / `write:notes` | Access and modify note contents |
| `read:kanban` / `write:kanban` | Access and modify kanban boards |
| `ui:page` | Register a full page + nav item |
| `ui:settings` | Append a section to Settings |
| `ui:slot` | Inject a React component into any UI slot |
| `ui:theme` | Override CSS variables and inject raw CSS |
| `ui:commands` | Add entries to the command palette |
| `ui:icons` | Override built-in icons with a custom pack |
| `editor:extend` | Add toolbar buttons or raw Milkdown plugins |
| `canvas:extend` | Register custom canvas node types |
| `events` | Listen for app-wide lifecycle events |

---

## 3. Entry Point (`index.js`)

Your plugin's entry point must export a default function that receives the `KairosPluginAPI` instance.

```javascript
export default function setup(api) {
  console.log(`Loaded plugin: ${api.manifest.name}`)

  // Register components, events, and setups here...
}
```

---

## 4. Injected API Reference

The `KairosPluginAPI` object provides access to Kairos's React bindings, UI registries, store modules, and file storage.

### 4.1 UI Registration

- **`api.registerPage({ path, navLabel, navIcon, component })`** — registers a top-level route and nav button
- **`api.registerSettingsSection({ id, label, icon, component })`** — adds a section under Settings
- **`api.registerSlot(slotId, Component)`** — injects a React component into a named UI slot
- **`api.registerTheme({ id, label, variables, css })`** — adds a selectable theme
- **`api.registerCommand({ id, label, icon, handler })`** — adds a command palette entry
- **`api.editor.registerToolbarItem(item)`** — adds a button to the editor toolbar
- **`api.editor.registerMilkdownPlugin(plugin)`** — injects a raw ProseMirror plugin
- **`api.canvas.registerNodeType(type, Component)`** — registers a custom canvas node

### 4.2 Local Plugin Storage

Plugins have access to an isolated subdirectory: `{vault}/plugins/{pluginId}/`

- **`api.readPluginData(filename)`** → `Promise<string | null>`
- **`api.writePluginData(filename, content)`** → `Promise<void>`

### 4.3 App Event Bus

- **`api.on(event, handler)`** / **`api.off(event, handler)`**
- **`api.emit(event, payload)`**

**Supported events:**

| Event | When it fires |
| ----- | ------------- |
| `note:created` | A new note is added |
| `note:updated` | Note content changes |
| `note:deleted` | A note is deleted |
| `kanban:taskCreated` | A task is created |
| `kanban:taskMoved` | A task changes column |
| `vault:connected` | A vault directory is loaded |

### 4.4 Shared State Stores

- **`api.getAppStore()`** — main note and configuration store
- **`api.getKanbanStore()`** — kanban board and task store

### 4.5 Notes API

- **`api.notes.list()`** → `NoteListItem[]`
- **`api.notes.get(id)`** → `NoteView | undefined`
- **`api.notes.create(data)`** → `Promise<string>` (returns new note id)
- **`api.notes.update(id, data)`** → `Promise<void>`
- **`api.notes.delete(id)`** → `Promise<void>`

### 4.6 Kanban API

- **`api.kanban.listBoards()`** → boards array
- **`api.kanban.getBoard(id)`** → board or undefined
- **`api.kanban.createTask(boardId, columnId, data)`** → `Promise<string>`
- **`api.kanban.updateTask(boardId, taskId, updates)`** → `Promise<void>`
- **`api.kanban.deleteTask(boardId, taskId)`** → `Promise<void>`

### 4.7 Component and Lib Reuse

To keep bundle sizes tiny, React and UI widgets are supplied directly by the API.

- **`api.React`** — React instance (same version as the host app)
- **`api.components`** — shared widgets: `Button`, `Card`, and more

### 4.8 Icon Override

```javascript
api.registerIconPack({
  id: 'my-icons',
  rules: [
    { match: 'notes', svg: '<svg>…</svg>' },
  ]
})
```

---

## 5. Available UI Slots

Slots are named injection points across the Kairos UI:

| Slot ID | Location |
| ------- | -------- |
| `editor:toolbar:start` | Notes editor toolbar — left side |
| `editor:toolbar:end` | Notes editor toolbar — right side |
| `editor:title:below` | Below the note title, above editor body |
| `notes:right-sidebar:panel` | Extra panel in the note right rail |
| `kanban:toolbar:end` | Kanban board toolbar — right side |
| `kanban:card:footer` | Bottom of each task card |
| `canvas:toolbar:end` | Canvas toolbar — right side |
| `journal:header:end` | Journal date header — right side |
| `journal:sidebar:panel` | Extra panel in the journal sidebar |
| `sidebar:header:end` | Notes sidebar header — right side |
| `sidebar:footer` | Bottom of the notes sidebar |
| `activity-bar:bottom` | Activity bar — above the settings icon |
| `layout:status-bar` | App-wide status bar (bottom) |
| `settings:sidebar:end` | Settings sidebar — bottom |

---

## 6. Deep-link Install

Plugins can be installed via a URL scheme from the Kairos Marketplace or a custom CDN:

```text
kairos://install?id=my-plugin&source=https://your-cdn.com
```

On web/PWA:

```text
https://app.kairos.app?installPlugin=my-plugin&source=https://your-cdn.com
```

---

## 7. Complete Example: Pomodoro Timer

```javascript
// {vault}/plugins/pomodoro/index.js
export default function setup(api) {
  const { React, components } = api
  const { Button } = components

  function PomodoroPage() {
    const [secondsLeft, setSecondsLeft] = React.useState(1500)
    const [running, setRunning] = React.useState(false)

    React.useEffect(() => {
      if (!running) return
      const interval = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { setRunning(false); alert("Time's up!"); return 1500 }
          return s - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }, [running])

    const minutes = Math.floor(secondsLeft / 60)
    const seconds = secondsLeft % 60

    return React.createElement(
      'div',
      { className: 'p-6 max-w-md mx-auto space-y-4' },
      React.createElement('h2', { className: 'text-2xl font-bold' }, 'Focus Timer'),
      React.createElement(
        'div',
        { className: 'text-5xl font-mono text-center py-8 bg-zinc-100 rounded-lg' },
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      ),
      React.createElement(
        'div',
        { className: 'flex gap-2' },
        React.createElement(Button, { onClick: () => setRunning(!running), className: 'flex-1' }, running ? 'Pause' : 'Start'),
        React.createElement(Button, { onClick: () => { setRunning(false); setSecondsLeft(1500) }, variant: 'ghost' }, 'Reset')
      )
    )
  }

  api.registerPage({ path: '/pomodoro', navLabel: 'Pomodoro', component: PomodoroPage })

  api.on('note:created', (note) => {
    console.log(`Note "${note.title}" created during a Pomodoro session`)
  })
}
```

```json
// {vault}/plugins/pomodoro/manifest.json
{
  "id": "pomodoro",
  "name": "Pomodoro Timer",
  "version": "1.0.0",
  "description": "Focus timer tab with work session tracking.",
  "author": "You",
  "entryPoint": "index.js",
  "permissions": ["ui:page", "events"]
}
```

Drop the folder into `{vault}/plugins/` and restart Kairos. The plugin appears in **Settings → Plugins** automatically.

---

## 8. Distribution

### Manual (local development)

Drop your plugin folder into `{vault}/plugins/` and restart the app.

### Kairos Marketplace

Submit your plugin to the Kairos Marketplace. Once listed, users can install it with one click from **Settings → Marketplace**.

### Self-hosted CDN

Host your plugin files on any CDN and share the deep-link URL:

```text
kairos://install?id=my-plugin&source=https://your-cdn.com/my-plugin
```

---

Full in-app documentation is available under **Settings → Plugins → Build a Plugin**.
