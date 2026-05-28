import { Code, InlineCode, Collapsible, CalloutNote } from './PluginDocPrimitives'

// ─── UI Extensions tab ────────────────────────────────────────────────────────
// Covers: slots, themes, commands, editor extensions, canvas node types

const SLOT_IDS = [
  { id: 'editor:toolbar:start',      props: '{ noteId, noteTitle }',  where: 'Note editor toolbar — left side' },
  { id: 'editor:toolbar:end',        props: '{ noteId, noteTitle }',  where: 'Note editor toolbar — right side' },
  { id: 'editor:title:below',        props: '{ noteId, noteTitle }',  where: 'Below the note title, above editor body' },
  { id: 'notes:right-sidebar:panel', props: '{ note }',               where: 'Extra panel in the note right sidebar' },
  { id: 'kanban:toolbar:end',        props: '{ boardId }',            where: 'Kanban board toolbar — right side' },
  { id: 'kanban:card:footer',        props: '{ taskId, boardId }',    where: 'Bottom of each task card' },
  { id: 'canvas:toolbar:end',        props: '{ canvasId }',           where: 'Canvas toolbar — right side' },
  { id: 'journal:header:end',        props: '{ date }',               where: 'Journal date header — right side' },
  { id: 'journal:sidebar:panel',     props: '{ date }',               where: 'Extra panel in the journal sidebar' },
  { id: 'sidebar:header:end',        props: '{}',                     where: 'Notes sidebar header — right side' },
  { id: 'sidebar:footer',            props: '{}',                     where: 'Bottom of the notes sidebar' },
  { id: 'activity-bar:bottom',       props: '{}',                     where: 'Activity bar — above settings icon' },
  { id: 'layout:status-bar',         props: '{}',                     where: 'App-wide status bar (bottom)' },
  { id: 'settings:sidebar:end',      props: '{}',                     where: 'Settings sidebar — bottom' },
]

export function TabUIExtensions() {
  return (
    <div className="space-y-3">

      {/* Slots */}
      <Collapsible title="UI Slots — inject anywhere" iconName="layout-list" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Slots are named extension points across the app. Register a React component into any slot and it renders there, receiving context props from the host.
        </p>
        <Code>{`
// Requires "ui:slot" permission
api.registerSlot('editor:toolbar:end', MyButton)
api.registerSlot('notes:right-sidebar:panel', MyPanel, /* order */ 10)

// Your component receives context props:
function MyPanel({ note }) {
  return React.createElement('div', { style: { padding: 12 } },
    'Note has ' + note.content.length + ' characters'
  )
}
`}</Code>
        <p className="mt-2 text-xs font-medium text-[rgb(var(--text-2))]">All available slots:</p>
        <div className="mt-2 overflow-hidden rounded-lg border border-[rgb(var(--border))]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
                <th className="px-3 py-1.5 text-left font-medium text-[rgb(var(--text-2))]">Slot ID</th>
                <th className="px-3 py-1.5 text-left font-medium text-[rgb(var(--text-2))] hidden sm:table-cell">Props</th>
                <th className="px-3 py-1.5 text-left font-medium text-[rgb(var(--text-2))] hidden md:table-cell">Where</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {SLOT_IDS.map(s => (
                <tr key={s.id}>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-[rgb(var(--accent))]">{s.id}</td>
                  <td className="px-3 py-1.5 font-mono text-[rgb(var(--text-3))] hidden sm:table-cell">{s.props}</td>
                  <td className="px-3 py-1.5 text-[rgb(var(--text-3))] hidden md:table-cell">{s.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-[rgb(var(--text-3))]">
          The optional third argument is <InlineCode>order</InlineCode> — lower numbers render first (default 50).
        </p>
      </Collapsible>

      {/* Themes */}
      <Collapsible title="Themes — CSS variables + raw CSS" iconName="palette">
        <p className="text-xs text-[rgb(var(--text-2))]">
          Register a theme to override any CSS variable in the app. Use <InlineCode>darkTokens</InlineCode> for dark-mode overrides and <InlineCode>rawCSS</InlineCode> for anything beyond variables — custom fonts, animations, component selectors.
        </p>
        <Code>{`
// Requires "ui:theme" permission
api.registerTheme({
  id: 'my-theme',
  name: 'My Theme',
  tokens: {
    '--color-accent':    '#7c3aed',
    '--color-bg':        '#0d0d0d',
    '--color-surface':   '#161616',
    '--color-text':      '#e8e8e8',
  },
  darkTokens: {
    '--color-accent': '#a78bfa',   // lighter purple in dark mode
  },
  rawCSS: \`
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code');
    .ProseMirror { font-family: 'Fira Code', monospace; }
  \`,
})
`}</Code>
        <CalloutNote>
          Token overrides apply instantly — no reload required. The <InlineCode>rawCSS</InlineCode> string is injected verbatim, so you can use any valid CSS including <InlineCode>@import</InlineCode>, keyframe animations, or media queries.
        </CalloutNote>
      </Collapsible>

      {/* Commands */}
      <Collapsible title="Commands — command palette entries" iconName="search">
        <p className="text-xs text-[rgb(var(--text-2))]">
          Add items to the command palette (<InlineCode>Cmd+K</InlineCode>). Users can find and trigger your plugin's actions without navigating to its page.
        </p>
        <Code>{`
// Requires "ui:commands" permission
api.registerCommand({
  id:       'my-plugin:sync',
  label:    'My Plugin: Sync now',
  hint:     'Manually trigger a sync',
  iconName: 'refresh-cw',
  shortcut: 'Ctrl+Shift+S',
  action:   () => myPlugin.sync(),
})
`}</Code>
      </Collapsible>

      {/* Editor */}
      <Collapsible title="Editor extensions — toolbar + Milkdown plugins" iconName="pen-line">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-[rgb(var(--text-2))]">Toolbar button</p>
            <p className="mb-2 text-xs text-[rgb(var(--text-3))]">
              Simpler than a slot — registers a standard icon button. The host calls <InlineCode>run(editorView)</InlineCode> with the live ProseMirror view.
            </p>
            <Code>{`
// Requires "editor:extend" permission
api.editor.registerToolbarItem({
  id:       'my-plugin:highlight',
  title:    'Highlight selection',
  iconName: 'highlighter',
  order:    20,
  run: (view) => {
    // view is the ProseMirror EditorView
    const { state, dispatch } = view
    // ... apply a mark
  },
  isActive: (view) => false,
})
`}</Code>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-[rgb(var(--text-2))]">Milkdown / ProseMirror plugin</p>
            <p className="mb-2 text-xs text-[rgb(var(--text-3))]">
              Inject a raw Milkdown plugin — custom block types, input rules, decorators, anything the ProseMirror plugin system supports.
            </p>
            <Code>{`
api.editor.registerMilkdownPlugin(myMilkdownPlugin)
`}</Code>
            <CalloutNote>
              Milkdown plugins are applied when the editor initialises for a note. They read from the registry at that point, so plugins should be registered during <InlineCode>setup()</InlineCode>.
            </CalloutNote>
          </div>
        </div>
      </Collapsible>

      {/* Canvas */}
      <Collapsible title="Canvas node types — custom ReactFlow nodes" iconName="git-fork">
        <p className="text-xs text-[rgb(var(--text-2))]">
          Register custom node types in the canvas board. Users can then place your node type by dragging it from the toolbar (if you also add a toolbar slot button for it).
        </p>
        <Code>{`
// Requires "canvas:extend" permission
function ExcalidrawNode({ data }) {
  return React.createElement('div', {
    style: { width: 400, height: 300, border: '1px solid #333' }
  }, React.createElement(Excalidraw, { /* ... */ }))
}

api.canvas.registerNodeType('excalidraw', ExcalidrawNode)

// Then add a toolbar button to insert the node:
api.registerSlot('canvas:toolbar:end', function AddExcalidrawBtn({ canvasId }) {
  return React.createElement('button', {
    onClick: () => { /* add node to canvas */ }
  }, '+ Drawing')
})
`}</Code>
        <p className="mt-1.5 text-xs text-[rgb(var(--text-3))]">
          Node type strings are global — prefix with your plugin id to avoid collisions: <InlineCode>myplugin:excalidraw</InlineCode>.
        </p>
      </Collapsible>

    </div>
  )
}
