# MindVault Plugin Development Guide

This guide details how to build and distribute custom plugins for MindVault using the **MindVaultPluginAPI**.

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
* `read:notes` / `write:notes`: Access and modify note contents.
* `read:kanban` / `write:kanban`: Access and modify Kanban boards.
* `ui:page`: Register custom navbar/header tabs.
* `ui:settings`: Append sections to the Settings screen.
* `events`: Listen for app-wide lifecycle events.

---

## 3. Entry Point (`index.js`)

Your plugin's entry point must export a default function that receives the `MindVaultPluginAPI` instance.

```javascript
export default function setup(api) {
  console.log(`Loaded plugin: ${api.manifest.name}`);

  // Register components, events, and setups here...
}
```

---

## 4. Injected API Reference

The `MindVaultPluginAPI` object provides access to MindVault's react bindings, UI registries, store modules, and file storage.

### 4.1 UI Registration
* **`api.registerPage({ path, navLabel, navIcon, component })`**:
  Registers a top-level route and nav button in the header.
* **`api.registerSettingsSection({ id, label, icon, component })`**:
  Registers a dedicated section under settings.

### 4.2 Local Plugin Storage
Plugins have access to a isolated subdirectory: `{vault}/plugins/{pluginId}/` to persist data files.
* **`api.readPluginData(filename)`**: `Promise<string | null>`
* **`api.writePluginData(filename, content)`**: `Promise<void>`

### 4.3 App Event Bus
Subscribe to app events or emit your own.
* **`api.on(event, handler)`** / **`api.off(event, handler)`**
* **`api.emit(event, payload)`**

**Supported Events:**
* `'note:created'`: Emitted when a new note is added.
* `'note:updated'`: Emitted when note text changes.
* `'note:deleted'`: Emitted when a note is deleted.
* `'kanban:taskCreated'` / `'kanban:taskMoved'`: Kanban state updates.
* `'vault:connected'`: Fired when a new vault directory is loaded.

### 4.4 Shared State Stores
Access the global Zustand states directly.
* **`api.getAppStore()`**: Returns the main note and configuration store.
* **`api.getKanbanStore()`**: Returns the Kanban board and task store.

### 4.5 Component and Lib Reuse
To keep bundle sizes tiny, React and UI widgets are supplied directly by the API.
* **`api.React`**: React v18 instance.
* **`api.components`**: Common shared widgets (`Button`, `Card`, etc.).

---

## 5. Complete Example: Custom Page with Settings & State

Below is a complete implementation of a custom Pomodoro plugin inside `index.js`:

```javascript
export default function setup(api) {
  const { React, components } = api
  const { Button } = components

  // 1. Define custom dashboard page component
  function PomodoroPage() {
    const [secondsLeft, setSecondsLeft] = React.useState(1500)
    const [running, setRunning] = React.useState(false)

    React.useEffect(() => {
      if (!running) return
      const interval = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            setRunning(false)
            alert("Time's up!")
            return 1500
          }
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
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      ),
      React.createElement(
        'div',
        { className: 'flex gap-2' },
        React.createElement(
          Button,
          { onClick: () => setRunning(!running), className: 'flex-1' },
          running ? 'Pause' : 'Start'
        ),
        React.createElement(
          Button,
          { onClick: () => { setRunning(false); setSecondsLeft(1500) }, variant: 'ghost' },
          'Reset'
        )
      )
    )
  }

  // 2. Register page in MindVault header navigation
  api.registerPage({
    path: '/pomodoro',
    navLabel: 'Pomodoro',
    component: PomodoroPage,
  })

  // 3. Listen for events
  api.on('note:created', (note) => {
    console.log(`Created note ${note.title} during a Pomodoro flow!`)
  })
}
```
