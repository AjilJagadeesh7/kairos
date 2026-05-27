import { Code, InlineCode, Collapsible, PropRow, CalloutNote } from './PluginDocPrimitives'

// ─── Getting Started ──────────────────────────────────────────────────────────

export function TabGettingStarted() {
  return (
    <div className="space-y-3">
      <Collapsible title="Vault folder structure" iconName="folder-open" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Each plugin lives in its own subfolder inside <InlineCode>{'{vault}/plugins/'}</InlineCode>. No build tools required for simple plugins.
        </p>
        <Code>{`
{vault}/
└── plugins/
    └── my-plugin/
        ├── manifest.json   ← metadata + permissions declaration
        └── index.js        ← plugin entry point (your code)
`}</Code>
        <p className="text-xs text-[rgb(var(--text-3))]">
          Plugins can persist data via <InlineCode>api.writePluginData(filename, content)</InlineCode> — stored in the same folder, never mixed with your notes.
        </p>
      </Collapsible>

      <Collapsible title="manifest.json" iconName="book-open">
        <Code>{`
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What this plugin does.",
  "author": "Your Name",
  "entryPoint": "index.js",
  "permissions": ["ui:slot", "read:notes"]
}
`}</Code>
        <div className="space-y-1.5">
          <PropRow name="id"          desc="Must match the vault folder name exactly. Lowercase, hyphens only." />
          <PropRow name="entryPoint"  desc="Path to your JS bundle relative to the plugin folder." />
          <PropRow name="permissions" desc="Declare every API surface your plugin uses. Shown to the user on install." />
        </div>
        <p className="mt-3 text-xs font-medium text-[rgb(var(--text-2))]">All available permissions:</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {[
            'read:notes','write:notes',
            'read:kanban','write:kanban',
            'ui:page','ui:settings','ui:icons',
            'ui:slot','ui:theme','ui:commands',
            'editor:extend','canvas:extend',
            'events',
          ].map(p => <InlineCode key={p}>{p}</InlineCode>)}
        </div>
      </Collapsible>

      <Collapsible title="Minimal example — inject a toolbar button" iconName="code-2">
        <p className="text-xs text-[rgb(var(--text-2))]">
          Your entry point exports a <InlineCode>default</InlineCode> setup function that receives the <InlineCode>api</InlineCode> object. Here we add a button to the end of the note editor toolbar:
        </p>
        <Code>{`
export default function setup(api) {
  const { React } = api

  function WordCountButton({ noteId }) {
    const [count, setCount] = React.useState(null)
    return React.createElement('button', {
      onClick: async () => {
        const note = api.notes.get(noteId)
        setCount(note?.content.split(/\\s+/).length ?? 0)
      },
      style: { fontSize: 11, padding: '0 8px' }
    }, count === null ? 'Count words' : \`\${count} words\`)
  }

  api.registerSlot('editor:toolbar:end', WordCountButton)
}
`}</Code>
        <CalloutNote>
          No bundler needed — <InlineCode>api.React</InlineCode> is provided by the host. For complex plugins, bundle with esbuild or Vite targeting ESM.
        </CalloutNote>
      </Collapsible>

      <Collapsible title="Adding a full page" iconName="layout-list">
        <Code>{`
export default function setup(api) {
  const { React } = api

  function MyPage() {
    const [notes, setNotes] = React.useState([])
    React.useEffect(() => {
      setNotes(api.notes.list())
    }, [])
    return React.createElement('div', { style: { padding: 24 } },
      React.createElement('h1', null, 'My Plugin'),
      notes.map(n => React.createElement('p', { key: n.id }, n.title))
    )
  }

  api.registerPage({
    path: '/my-plugin',
    navLabel: 'My Plugin',
    navIconName: 'puzzle',
    component: MyPage,
  })
}
`}</Code>
        <p className="text-xs text-[rgb(var(--text-3))]">Requires <InlineCode>ui:page</InlineCode> permission. The route appears in the activity bar and command palette automatically.</p>
      </Collapsible>
    </div>
  )
}

// ─── API Reference ────────────────────────────────────────────────────────────

export function TabApiReference() {
  return (
    <div className="space-y-3">
      <Collapsible title="Notes API" iconName="file-text" defaultOpen>
        <div className="space-y-1.5 text-xs">
          <PropRow name="api.notes.list()"                           desc="Returns all notes as NoteListItem[] — id, title, tags, dates." />
          <PropRow name="api.notes.get(id)"                          desc="Returns a NoteView (includes content), or null." />
          <PropRow name="await api.notes.create({ title, content })" desc="Creates a note. Returns its id." />
          <PropRow name="await api.notes.update(id, patch)"          desc="Patches title, content, or tags. Writes to vault + syncs." />
          <PropRow name="await api.notes.delete(id)"                 desc="Permanently deletes the note." />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          Read methods require <InlineCode>read:notes</InlineCode>. Mutations require <InlineCode>write:notes</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="Kanban API" iconName="square-kanban">
        <div className="space-y-1.5 text-xs">
          <PropRow name="api.kanban.getBoards()"                          desc="Lists all boards as {id, title}[]." />
          <PropRow name="api.kanban.createTask(boardId, columnId, title)" desc="Adds a task. Returns its id." />
          <PropRow name="api.kanban.updateTask(boardId, taskId, updates)" desc="Patches title, priority, due, or tags." />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          Reads require <InlineCode>read:kanban</InlineCode>. Mutations require <InlineCode>write:kanban</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="Event bus" iconName="zap">
        <div className="space-y-1.5 text-xs">
          <PropRow name="api.on(event, handler)"   desc="Subscribe. Requires events permission." />
          <PropRow name="api.off(event, handler)"  desc="Unsubscribe." />
          <PropRow name="api.emit(event, payload)" desc="Emit a custom event other plugins can listen to." />
        </div>
        <p className="mt-2 text-xs font-medium text-[rgb(var(--text-2))]">Built-in events:</p>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {['note:created','note:updated','note:deleted','kanban:taskMoved','kanban:taskCreated','vault:connected','app:ready'].map(e => (
            <InlineCode key={e}>{e}</InlineCode>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Plugin data storage" iconName="save">
        <div className="space-y-1.5 text-xs">
          <PropRow name="await api.readPluginData(filename)"          desc="Reads {vault}/plugins/{id}/{filename}. Returns null if missing." />
          <PropRow name="await api.writePluginData(filename, content)" desc="Writes to the same path." />
        </div>
        <Code>{`
const raw = await api.readPluginData('settings.json')
const cfg = raw ? JSON.parse(raw) : { enabled: true }
await api.writePluginData('settings.json', JSON.stringify(cfg))
`}</Code>
      </Collapsible>

      <Collapsible title="Shared UI components" iconName="layers">
        <p className="mb-2 text-xs text-[rgb(var(--text-3))]">Available via <InlineCode>api.components</InlineCode> — no import needed:</p>
        <div className="grid grid-cols-3 gap-1">
          {['Button','Pill','PriorityDot','ProgressBar','Select','TagBadge','TagChip','SectionCard','Field','Dropdown','ColorPicker'].map(c => (
            <InlineCode key={c}>{c}</InlineCode>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}
