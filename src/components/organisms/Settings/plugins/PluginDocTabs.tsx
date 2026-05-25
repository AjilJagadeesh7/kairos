import { Code, InlineCode, Collapsible, PropRow, CalloutNote } from './PluginDocPrimitives'

export function TabGettingStarted() {
  return (
    <div className="space-y-3">
      <Collapsible title="Vault folder structure" iconName="folder-open" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Each plugin lives in its own subfolder inside <InlineCode>{'{vault}/plugins/'}</InlineCode>:
        </p>
        <Code>{`
{vault}/
└── plugins/
    └── my-plugin/
        ├── manifest.json   ← required: metadata + permissions
        └── index.js        ← required: plugin entry point
`}</Code>
        <p className="text-xs text-[rgb(var(--text-3))]">
          Plugins can also store data via <InlineCode>api.writePluginData(filename, content)</InlineCode>.
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
  "permissions": ["ui:page", "read:notes"]
}
`}</Code>
        <div className="space-y-1.5">
          <PropRow name="id"         desc="Must match the vault folder name. Lowercase, hyphens only." />
          <PropRow name="name"       desc="Display name shown in the Plugins list." />
          <PropRow name="version"    desc='Semver string — e.g. "1.0.0".' />
          <PropRow name="entryPoint" desc="Path to your JS bundle, relative to the plugin folder." />
          <PropRow name="permissions" desc="Declare what the plugin needs (shown to user on install)." />
        </div>
        <p className="mt-2 text-xs font-medium text-[rgb(var(--text-2))]">Available permissions:</p>
        <div className="grid grid-cols-2 gap-1">
          {['read:notes', 'write:notes', 'read:kanban', 'write:kanban', 'ui:page', 'ui:settings', 'ui:header', 'ui:icons', 'events'].map(p => (
            <InlineCode key={p}>{p}</InlineCode>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="index.js — minimal example" iconName="code-2">
        <p className="text-xs text-[rgb(var(--text-2))]">
          Your entry point must export a <InlineCode>default</InlineCode> function that receives the <InlineCode>api</InlineCode> object:
        </p>
        <Code>{`
export default function setup(api) {
  const { React, components: { SectionCard } } = api

  function MyPage() {
    return React.createElement('div', { className: 'p-6' },
      React.createElement('h1', { className: 'text-2xl font-bold' },
        'My Plugin Page'
      )
    )
  }

  api.registerPage({ path: '/my-plugin', navLabel: 'My Plugin', component: MyPage })
  api.on('note:created', (note) => console.log('New note:', note.title))
}
`}</Code>
        <CalloutNote>
          No bundler required for simple plugins — just a plain <InlineCode>.js</InlineCode> file using the <InlineCode>api.React</InlineCode> already provided by the host.
        </CalloutNote>
      </Collapsible>
    </div>
  )
}

export function TabApiReference() {
  return (
    <div className="space-y-3">
      <Collapsible title="UI registration" iconName="layout-list" defaultOpen>
        <div className="space-y-3 text-xs">
          <div>
            <div className="mb-1"><InlineCode>api.registerPage({'{ path, navLabel, navIcon?, component }'})</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Adds a route and nav link. Requires <InlineCode>ui:page</InlineCode> permission.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.registerSettingsSection({'{ id, label, icon?, component }'})</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Adds a Settings section. Requires <InlineCode>ui:settings</InlineCode>.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.registerIconRules(rules)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Maps note titles, folders, or tags to emoji icons. Requires <InlineCode>ui:icons</InlineCode>.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.registerIconPack(pack)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Replaces any builtin icon token with an SVG string or URL.</p>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Event bus" iconName="zap">
        <div className="space-y-3 text-xs">
          <div>
            <div className="mb-1"><InlineCode>api.on(event, handler)</InlineCode> / <InlineCode>api.off(event, handler)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Subscribe/unsubscribe. Requires <InlineCode>events</InlineCode> permission.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.emit(event, payload?)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Emit a custom event other plugins can listen to.</p>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-[rgb(var(--text-2))]">Available events:</p>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {['note:created', 'note:updated', 'note:deleted', 'kanban:taskMoved', 'kanban:taskCreated', 'vault:connected', 'app:ready'].map(e => (
            <InlineCode key={e}>{e}</InlineCode>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Notes API" iconName="file-text">
        <div className="space-y-1.5 text-xs">
          <PropRow name="api.notes.list()"                            desc="Returns all notes as NoteListItem[]." />
          <PropRow name="api.notes.get(id)"                           desc="Returns a single NoteView, or null." />
          <PropRow name="await api.notes.create({ title, content })"  desc="Creates a new note, returns its id." />
          <PropRow name="await api.notes.update(id, patch)"           desc="Patches title, content, or tags." />
          <PropRow name="await api.notes.delete(id)"                  desc="Permanently deletes a note." />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          Reads require <InlineCode>read:notes</InlineCode>, mutations require <InlineCode>write:notes</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="Kanban API" iconName="square-kanban">
        <div className="space-y-1.5 text-xs">
          <PropRow name="api.kanban.getBoards()"                          desc="Lists all boards as BoardSummary[]." />
          <PropRow name="api.kanban.createTask(boardId, columnId, title)" desc="Adds a task, returns its id." />
          <PropRow name="api.kanban.updateTask(boardId, taskId, updates)" desc="Patches title, priority, due, or tags." />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          Reads require <InlineCode>read:kanban</InlineCode>, mutations require <InlineCode>write:kanban</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="Plugin data storage" iconName="save">
        <div className="space-y-1.5 text-xs">
          <PropRow name="await api.readPluginData(filename)"         desc="Reads from {vault}/plugins/{id}/{filename}. Returns null if missing." />
          <PropRow name="await api.writePluginData(filename, content)" desc="Writes to the same location." />
        </div>
        <Code>{`
const raw = await api.readPluginData('settings.json')
const cfg = raw ? JSON.parse(raw) : { enabled: true }
await api.writePluginData('settings.json', JSON.stringify(cfg))
`}</Code>
      </Collapsible>

      <Collapsible title="Shared UI components" iconName="layers">
        <p className="mb-2 text-xs text-[rgb(var(--text-3))]">Available via <InlineCode>api.components</InlineCode>:</p>
        <div className="grid grid-cols-3 gap-1">
          {['Button', 'Pill', 'PriorityDot', 'ProgressBar', 'Select', 'TagBadge', 'TagChip', 'SectionCard', 'Field', 'Dropdown', 'ColorPicker'].map(c => (
            <InlineCode key={c}>{c}</InlineCode>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}

export function TabIconPacks() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-3 text-xs leading-relaxed text-[rgb(var(--text-2))]">
        Icon packs let users swap every icon in MindVault without writing React — just SVG files and a JSON map.
      </div>

      <Collapsible title="Folder structure" iconName="folder-open" defaultOpen>
        <Code>{`
{vault}/plugins/my-icon-pack/
├── manifest.json
├── icons.json      ← maps token names → SVG file paths
└── icons/
    ├── file-text.svg
    └── ...
`}</Code>
      </Collapsible>

      <Collapsible title="icons.json format" iconName="file-json">
        <Code>{`
{
  "file-text":   "icons/file-text.svg",
  "folder-open": "icons/folder-open.svg",
  "search":      "<svg xmlns='http://www.w3.org/2000/svg' ...>...</svg>"
}
`}</Code>
        <CalloutNote>
          You only need to provide tokens you want to override — others fall back to builtin Lucide icons.
        </CalloutNote>
      </Collapsible>

      <Collapsible title="Registering the pack" iconName="code-2">
        <Code>{`
export default async function setup(api) {
  const raw = await api.readPluginData('icons.json')
  if (!raw) return
  api.registerIconPack(JSON.parse(raw))
}
`}</Code>
        <p className="mt-1 text-xs text-[rgb(var(--text-3))]">Requires <InlineCode>ui:icons</InlineCode> permission.</p>
      </Collapsible>

      <Collapsible title="All overridable token names" iconName="list">
        <div className="grid grid-cols-3 gap-1">
          {[
            'alert-triangle','arrow-left','arrow-right','arrow-up-right',
            'bar-chart-2','book-open','brackets','brain-circuit','bug',
            'calendar','calendar-days','check','check-circle-2','check-square',
            'columns-2','chevron-down','chevron-left','chevron-right','chevron-up',
            'circle','clipboard-copy','cloud','cloud-off','code-2','copy',
            'corner-down-left','crosshair','download','external-link','eye',
            'file-down','file-json','file-text','flask-conical',
            'folder-input','folder-open','folder-plus','folder-sync',
            'git-fork','git-merge','globe','graduation-cap','grip-vertical',
            'history','home','image','info','keyboard','layers','layout-list',
            'lightbulb','link','link-2','list','loader-2','more-horizontal',
            'network','palette','pencil','pin','plus','puzzle',
            'redo-2','refresh-cw','rotate-ccw','save','scroll-text','search',
            'send','settings','settings-2','shield-check','square-kanban',
            'sticky-note','store','tag','trash-2','undo-2','unlink',
            'users','wifi-off','x','zap',
          ].map(t => <InlineCode key={t}>{t}</InlineCode>)}
        </div>
      </Collapsible>
    </div>
  )
}

export function TabDistribution() {
  return (
    <div className="space-y-3">
      <Collapsible title="Manual install (local)" iconName="folder-input" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Drop the plugin folder into <InlineCode>{'{vault}/plugins/'}</InlineCode> and restart MindVault.
        </p>
      </Collapsible>

      <Collapsible title="Marketplace" iconName="store">
        <div className="space-y-2 text-xs text-[rgb(var(--text-2))]">
          <p>Host your <InlineCode>manifest.json</InlineCode> and <InlineCode>index.js</InlineCode> on a public URL, then submit to the marketplace.</p>
          <p className="text-[rgb(var(--text-3))]">The marketplace iframe posts a structured install message to the host app, which downloads and registers the plugin without manual file placement.</p>
        </div>
      </Collapsible>

      <Collapsible title="Deep link (desktop)" iconName="link">
        <p className="mb-2 text-xs text-[rgb(var(--text-2))]">Link directly from your site to trigger an install prompt:</p>
        <Code>{`mindvault://install?id=my-plugin&source=https://your-cdn.com`}</Code>
        <p className="mt-2 mb-1 text-xs text-[rgb(var(--text-3))]">Web fallback:</p>
        <Code>{`https://app.mindvault.app?installPlugin=my-plugin&source=https://your-cdn.com`}</Code>
        <CalloutNote>
          The app fetches <InlineCode>{'{source}/plugins/{id}/manifest.json'}</InlineCode> and <InlineCode>{'{source}/plugins/{id}/index.js'}</InlineCode>.
        </CalloutNote>
      </Collapsible>
    </div>
  )
}
