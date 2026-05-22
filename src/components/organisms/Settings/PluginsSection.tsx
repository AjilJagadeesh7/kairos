import { useState } from 'react'
import type { IconToken } from '../../../icons/tokens'
import { usePluginStore } from '../../../plugins/usePluginStore'
import { uninstallPlugin } from '../../../plugins/installPlugin'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'

// ─── Installed plugins list ───────────────────────────────────────────────────

function InstalledPlugins() {
  const plugins    = usePluginStore(s => s.plugins)
  const setEnabled = usePluginStore(s => s.setEnabled)

  if (plugins.length === 0) {
    return (
      <SectionCard title="Installed Plugins">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Icon name="store" size={28} className="text-[rgb(var(--text-3))]" />
          <p className="text-sm text-[rgb(var(--text-2))]">No plugins installed yet.</p>
          <p className="text-xs text-[rgb(var(--text-3))]">
            Go to the <strong className="text-[rgb(var(--text-2))]">Marketplace</strong> tab to discover plugins.
          </p>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Installed Plugins">
      <ul className="space-y-2">
        {plugins.map(plugin => (
          <li
            key={plugin.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[rgb(var(--text))]">{plugin.manifest.name}</span>
                <span className="rounded bg-[rgb(var(--surface-3))] px-1.5 py-0.5 font-mono text-[10px] text-[rgb(var(--text-3))]">
                  v{plugin.manifest.version}
                </span>
                {!plugin.enabled && (
                  <span className="rounded bg-[rgb(var(--surface-3))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-3))]">
                    disabled
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[rgb(var(--text-2))]">{plugin.manifest.description}</p>
              <p className="mt-0.5 text-[11px] text-[rgb(var(--text-3))]">by {plugin.manifest.author}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={plugin.enabled}
                title={plugin.enabled ? 'Disable (takes effect after restart)' : 'Enable (takes effect after restart)'}
                onClick={() => setEnabled(plugin.id, !plugin.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]/50 ${
                  plugin.enabled ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--surface-3))]'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  plugin.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`} />
              </button>
              <Button
                variant="ghost"
                size="xs"
                className="text-[rgb(var(--text-3))] hover:text-red-400"
                onClick={() => void uninstallPlugin(plugin.id)}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-[rgb(var(--text-3))]">
        Enable/disable changes take effect after restarting the app.
      </p>
    </SectionCard>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3 font-mono text-xs leading-relaxed text-[rgb(var(--text-2))]">
      {children.trim()}
    </pre>
  )
}

function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 font-mono text-[11px] text-[rgb(var(--accent))]">
      {children}
    </code>
  )
}

function Collapsible({ title, iconName, defaultOpen = false, children }: {
  title: string
  iconName: IconToken
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-[rgb(var(--border))]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-[rgb(var(--surface-2))]"
      >
        <Icon name={iconName} size={14} className="shrink-0 text-[rgb(var(--accent))]" />
        <span className="flex-1 text-sm font-medium text-[rgb(var(--text))]">{title}</span>
        <Icon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={14}
          className="shrink-0 text-[rgb(var(--text-3))]"
        />
      </button>
      {open && (
        <div className="border-t border-[rgb(var(--border))] px-4 py-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

function PropRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <InlineCode>{name}</InlineCode>
      <span className="text-[rgb(var(--text-3))]">{desc}</span>
    </div>
  )
}

function CalloutNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
      <Icon name="info" size={13} className="mt-px shrink-0 text-[rgb(var(--accent))]" />
      <p className="text-xs text-[rgb(var(--text-2))]">{children}</p>
    </div>
  )
}

// ─── Doc tabs ─────────────────────────────────────────────────────────────────

type DocTab = 'start' | 'api' | 'icons' | 'distribution'

const DOC_TABS: { id: DocTab; label: string; icon: IconToken }[] = [
  { id: 'start',        label: 'Getting Started', icon: 'graduation-cap' },
  { id: 'api',          label: 'API Reference',   icon: 'zap'            },
  { id: 'icons',        label: 'Icon Packs',      icon: 'palette'        },
  { id: 'distribution', label: 'Distribution',    icon: 'store'          },
]

// ─── Tab content ──────────────────────────────────────────────────────────────

function TabGettingStarted() {
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
`}
        </Code>
        <p className="text-xs text-[rgb(var(--text-3))]">
          Plugins can also store their own data here via <InlineCode>api.writePluginData(filename, content)</InlineCode>.
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
`}
        </Code>
        <div className="space-y-1.5">
          <PropRow name="id"          desc="Must match the vault folder name. Lowercase, hyphens only." />
          <PropRow name="name"        desc="Display name shown in the Plugins list." />
          <PropRow name="version"     desc='Semver string — e.g. "1.0.0".' />
          <PropRow name="entryPoint"  desc="Path to your JS bundle, relative to the plugin folder." />
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

  api.registerPage({
    path: '/my-plugin',
    navLabel: 'My Plugin',
    component: MyPage,
  })

  api.on('note:created', (note) => {
    console.log('New note:', note.title)
  })
}
`}
        </Code>
        <CalloutNote>
          No bundler required for simple plugins — just a plain <InlineCode>.js</InlineCode> file using the <InlineCode>api.React</InlineCode> and <InlineCode>api.components</InlineCode> already provided by the host.
        </CalloutNote>
      </Collapsible>
    </div>
  )
}

function TabApiReference() {
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
            <p className="pl-2 text-[rgb(var(--text-3))]">Adds a section to the Settings sidebar and panel. Requires <InlineCode>ui:settings</InlineCode>.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.registerIconRules(rules)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Maps note titles, folders, or tags to emoji icons. Requires <InlineCode>ui:icons</InlineCode>.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.registerIconPack(pack)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Replaces any builtin icon token with an SVG string or URL. See the Icon Packs tab for the full guide.</p>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Event bus" iconName="zap">
        <div className="space-y-3 text-xs">
          <div>
            <div className="mb-1"><InlineCode>api.on(event, handler)</InlineCode> / <InlineCode>api.off(event, handler)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Subscribe or unsubscribe from app events. Requires <InlineCode>events</InlineCode> permission.</p>
          </div>
          <div>
            <div className="mb-1"><InlineCode>api.emit(event, payload?)</InlineCode></div>
            <p className="pl-2 text-[rgb(var(--text-3))]">Emit a custom event that other plugins can listen to.</p>
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
          <PropRow name="api.notes.list()"                         desc="Returns all notes as NoteListItem[]." />
          <PropRow name="api.notes.get(id)"                        desc="Returns a single NoteView, or null." />
          <PropRow name="await api.notes.create({ title, content })" desc="Creates a new note, returns its id." />
          <PropRow name="await api.notes.update(id, patch)"        desc="Patches title, content, or tags." />
          <PropRow name="await api.notes.delete(id)"               desc="Permanently deletes a note." />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          Reads require <InlineCode>read:notes</InlineCode>, mutations require <InlineCode>write:notes</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="Kanban API" iconName="square-kanban">
        <div className="space-y-1.5 text-xs">
          <PropRow name="api.kanban.getBoards()"                              desc="Lists all boards as BoardSummary[]." />
          <PropRow name="api.kanban.createTask(boardId, columnId, title)"     desc="Adds a task to a column, returns its id." />
          <PropRow name="api.kanban.updateTask(boardId, taskId, updates)"     desc="Patches title, priority, due, or tags." />
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          Reads require <InlineCode>read:kanban</InlineCode>, mutations require <InlineCode>write:kanban</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="Plugin data storage" iconName="save">
        <div className="space-y-1.5 text-xs">
          <PropRow name="await api.readPluginData(filename)"  desc="Reads a file from {vault}/plugins/{id}/{filename}. Returns null if missing." />
          <PropRow name="await api.writePluginData(filename, content)" desc="Writes a file to the same location." />
        </div>
        <Code>{`
const raw = await api.readPluginData('settings.json')
const cfg = raw ? JSON.parse(raw) : { enabled: true }
await api.writePluginData('settings.json', JSON.stringify(cfg))
`}
        </Code>
      </Collapsible>

      <Collapsible title="Shared UI components" iconName="layers">
        <p className="mb-2 text-xs text-[rgb(var(--text-3))]">
          Available via <InlineCode>api.components</InlineCode> — React and MindVault UI are already loaded by the host:
        </p>
        <div className="grid grid-cols-3 gap-1">
          {['Button', 'Pill', 'PriorityDot', 'ProgressBar', 'Select', 'TagBadge', 'TagChip', 'SectionCard', 'Field', 'Dropdown', 'ColorPicker'].map(c => (
            <InlineCode key={c}>{c}</InlineCode>
          ))}
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
          React itself is available as <InlineCode>api.React</InlineCode>.
        </p>
      </Collapsible>
    </div>
  )
}

function TabIconPacks() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-3 text-xs text-[rgb(var(--text-2))] leading-relaxed">
        Icon packs let users swap every icon in MindVault without writing React — just SVG files and a JSON map. The system works like VS Code's icon themes: data-driven, zero runtime overhead.
      </div>

      <Collapsible title="Folder structure" iconName="folder-open" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Declare <InlineCode>ui:icons</InlineCode> in your manifest permissions, then ship your SVGs alongside a mapping file:
        </p>
        <Code>{`
{vault}/plugins/my-icon-pack/
├── manifest.json
├── icons.json      ← maps token names → SVG file paths
└── icons/
    ├── file-text.svg
    ├── folder-open.svg
    ├── trash-2.svg
    └── ...
`}
        </Code>
      </Collapsible>

      <Collapsible title="icons.json format" iconName="file-json">
        <p className="text-xs text-[rgb(var(--text-2))]">
          Each key is an icon token name; the value is either a relative path to an SVG file or an inline SVG string:
        </p>
        <Code>{`
{
  "file-text":   "icons/file-text.svg",
  "folder-open": "icons/folder-open.svg",
  "trash-2":     "icons/trash-2.svg",
  "search":      "<svg xmlns='http://www.w3.org/2000/svg' ...>...</svg>"
}
`}
        </Code>
        <CalloutNote>
          You only need to provide the tokens you want to override — all others fall back to the builtin Lucide icons automatically.
        </CalloutNote>
      </Collapsible>

      <Collapsible title="Registering the pack in index.js" iconName="code-2">
        <p className="text-xs text-[rgb(var(--text-2))]">
          In your plugin's <InlineCode>setup()</InlineCode>, read <InlineCode>icons.json</InlineCode> and pass it to <InlineCode>api.registerIconPack</InlineCode>:
        </p>
        <Code>{`
export default async function setup(api) {
  // Load the mapping file from your plugin's data folder
  const raw = await api.readPluginData('icons.json')
  if (!raw) return

  const iconMap = JSON.parse(raw)
  // { "file-text": "icons/file-text.svg", ... }

  // Register — values can be SVG strings or URLs
  api.registerIconPack(iconMap)
}
`}
        </Code>
        <p className="mt-1 text-xs text-[rgb(var(--text-3))]">
          Requires <InlineCode>ui:icons</InlineCode> permission in <InlineCode>manifest.json</InlineCode>.
        </p>
      </Collapsible>

      <Collapsible title="SVG authoring tips" iconName="image">
        <div className="space-y-2 text-xs text-[rgb(var(--text-2))]">
          <div>
            <p className="font-medium text-[rgb(var(--text))]">Use currentColor for theme-aware icons</p>
            <p className="mt-0.5 text-[rgb(var(--text-3))]">
              Set <InlineCode>stroke="currentColor"</InlineCode> or <InlineCode>fill="currentColor"</InlineCode> in your SVGs. MindVault renders inline SVGs inside a <InlineCode>{'<span>'}</InlineCode> that inherits the parent's text color, so your icon automatically adapts to light/dark themes.
            </p>
          </div>
          <Code>{`
<!-- Good: inherits color from className="text-red-500" etc. -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2">
  <path d="M21 15v4a2 2 0 0 1-2 2H5..." />
</svg>
`}
          </Code>
          <div>
            <p className="font-medium text-[rgb(var(--text))]">Keep a square viewBox</p>
            <p className="mt-0.5 text-[rgb(var(--text-3))]">
              Use <InlineCode>viewBox="0 0 24 24"</InlineCode> (or any square). MindVault sizes icons via CSS — the SVG's <InlineCode>width</InlineCode>/<InlineCode>height</InlineCode> attributes are overridden at render time.
            </p>
          </div>
          <div>
            <p className="font-medium text-[rgb(var(--text))]">URL vs inline SVG</p>
            <p className="mt-0.5 text-[rgb(var(--text-3))]">
              Strings starting with <InlineCode>{'<svg'}</InlineCode> are rendered inline (supports <InlineCode>currentColor</InlineCode>). All other strings are treated as a URL and rendered as <InlineCode>{'<img src>'}</InlineCode> (color theming won't apply).
            </p>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="All overridable token names" iconName="list">
        <p className="mb-2 text-xs text-[rgb(var(--text-3))]">Any of these tokens can be replaced in your icon pack:</p>
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

function TabDistribution() {
  return (
    <div className="space-y-3">
      <Collapsible title="Manual install (local)" iconName="folder-input" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Drop the plugin folder directly into <InlineCode>{'{vault}/plugins/'}</InlineCode> and restart MindVault. No install flow needed — ideal for development and personal plugins.
        </p>
      </Collapsible>

      <Collapsible title="Marketplace" iconName="store">
        <div className="space-y-2 text-xs text-[rgb(var(--text-2))]">
          <p>Host your <InlineCode>manifest.json</InlineCode> and <InlineCode>index.js</InlineCode> on a public URL, then submit to the marketplace. Users find and install your plugin from Settings › Marketplace.</p>
          <p className="text-[rgb(var(--text-3))]">The marketplace iframe posts a structured install message to the host app, which downloads and registers the plugin without requiring manual file placement.</p>
        </div>
      </Collapsible>

      <Collapsible title="Deep link (desktop)" iconName="link">
        <p className="mb-2 text-xs text-[rgb(var(--text-2))]">Link directly from your own site to trigger an install prompt:</p>
        <Code>{`mindvault://install?id=my-plugin&source=https://your-cdn.com`}</Code>
        <p className="mt-2 mb-1 text-xs text-[rgb(var(--text-3))]">Web fallback (when MindVault is open in a browser):</p>
        <Code>{`https://app.mindvault.app?installPlugin=my-plugin&source=https://your-cdn.com`}</Code>
        <CalloutNote>
          The app fetches <InlineCode>{'{source}/plugins/{id}/manifest.json'}</InlineCode> and <InlineCode>{'{source}/plugins/{id}/index.js'}</InlineCode> from the given base URL.
        </CalloutNote>
      </Collapsible>
    </div>
  )
}

// ─── Developer guide ──────────────────────────────────────────────────────────

function DeveloperGuide() {
  const [activeTab, setActiveTab] = useState<DocTab>('start')

  return (
    <SectionCard title="Build a Plugin">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-1">
        {DOC_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm'
                : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]'
            }`}
          >
            <Icon name={tab.icon} size={12} className="shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'start'        && <TabGettingStarted />}
      {activeTab === 'api'          && <TabApiReference />}
      {activeTab === 'icons'        && <TabIconPacks />}
      {activeTab === 'distribution' && <TabDistribution />}

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
        <Icon name="external-link" size={13} className="shrink-0 text-[rgb(var(--accent))]" />
        <p className="text-xs text-[rgb(var(--text-2))]">
          Full docs and an example plugin at{' '}
          <a
            href="https://github.com/AjilJagadeesh7/mindvault"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[rgb(var(--accent))] hover:underline"
          >
            github.com/AjilJagadeesh7/mindvault
          </a>
        </p>
      </div>
    </SectionCard>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PluginsSection() {
  return (
    <div className="space-y-5">
      <InstalledPlugins />
      <DeveloperGuide />
    </div>
  )
}
