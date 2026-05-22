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

// ─── Code block helper ────────────────────────────────────────────────────────

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

// ─── Collapsible section ──────────────────────────────────────────────────────

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
        {open
          ? <Icon name="chevron-down" size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
          : <Icon name="chevron-right" size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
        }
      </button>
      {open && (
        <div className="border-t border-[rgb(var(--border))] px-4 py-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Developer guide ──────────────────────────────────────────────────────────

function DeveloperGuide() {
  return (
    <SectionCard title="Build a Plugin">
      <p className="mb-4 text-sm text-[rgb(var(--text-2))]">
        MindVault plugins are plain JavaScript (ESM) files stored in your vault folder. No build tools required for simple plugins — just drop two files in and reload.
      </p>

      <div className="space-y-3">

        {/* Vault structure */}
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
            Plugins can also write their own data files here via <InlineCode>api.writePluginData(filename, content)</InlineCode>.
          </p>
        </Collapsible>

        {/* manifest.json */}
        <Collapsible title="manifest.json — required fields" iconName="book-open">
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
            {[
              ['id', 'Must match the vault folder name. Lowercase, hyphens only.'],
              ['name', 'Display name shown in the Plugins list.'],
              ['version', 'Semver string — e.g. "1.0.0".'],
              ['entryPoint', 'Path to your JS bundle, relative to the plugin folder.'],
              ['permissions', 'Declare what the plugin needs (shown to user on install).'],
            ].map(([field, desc]) => (
              <div key={field} className="flex gap-2 text-xs">
                <InlineCode>{field as string}</InlineCode>
                <span className="text-[rgb(var(--text-3))]">{desc as string}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-[rgb(var(--text-2))]">Available permissions:</p>
          <div className="grid grid-cols-2 gap-1">
            {['read:notes', 'write:notes', 'read:kanban', 'write:kanban', 'ui:page', 'ui:settings', 'ui:header', 'events'].map(p => (
              <InlineCode key={p}>{p}</InlineCode>
            ))}
          </div>
        </Collapsible>

        {/* index.js */}
        <Collapsible title="index.js — plugin entry point" iconName="code-2">
          <p className="text-xs text-[rgb(var(--text-2))]">
            Your entry point must export a default function that receives the <InlineCode>api</InlineCode> object:
          </p>
          <Code>{`
export default function setup(api) {
  const { React, components: { Button, SectionCard } } = api

  // Register a new page in the header nav
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

  // Register a settings section
  function MySettings() {
    return React.createElement(SectionCard, { title: 'My Plugin' },
      React.createElement('p', { className: 'text-sm' }, 'Settings here')
    )
  }

  api.registerSettingsSection({
    id: 'my-plugin',
    label: 'My Plugin',
    component: MySettings,
  })

  // Subscribe to app events
  api.on('note:created', (note) => {
    console.log('New note created:', note.title)
  })
}
`}
          </Code>
        </Collapsible>

        {/* Full API reference */}
        <Collapsible title="Full API reference" iconName="zap">
          <div className="space-y-4 text-xs">

            <div>
              <p className="mb-1.5 font-semibold text-[rgb(var(--text))]">UI registration</p>
              <div className="space-y-1.5">
                <div><InlineCode>api.registerPage({'{ path, navLabel, navIcon?, component }'})</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Adds a route + nav link in the header. <InlineCode>component</InlineCode> is any React component.</p>
                <div><InlineCode>api.registerSettingsSection({'{ id, label, icon?, component }'})</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Adds a section to the Settings sidebar and panel.</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-semibold text-[rgb(var(--text))]">Event bus</p>
              <div className="space-y-1.5">
                <div><InlineCode>api.on(event, handler)</InlineCode> / <InlineCode>api.off(event, handler)</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Subscribe/unsubscribe to app events.</p>
                <div><InlineCode>api.emit(event, payload?)</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Emit a custom event (other plugins can listen).</p>
              </div>
              <p className="mt-2 font-medium text-[rgb(var(--text-2))]">Available events:</p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {['note:created', 'note:updated', 'note:deleted', 'kanban:taskMoved', 'kanban:taskCreated', 'vault:connected', 'app:ready'].map(e => (
                  <InlineCode key={e}>{e}</InlineCode>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-semibold text-[rgb(var(--text))]">Store access</p>
              <div className="space-y-1.5">
                <div><InlineCode>api.getAppStore()</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Returns the Zustand notes store. Use <InlineCode>.getState()</InlineCode> to read, <InlineCode>.subscribe()</InlineCode> to watch.</p>
                <div><InlineCode>api.getKanbanStore()</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Returns the Zustand kanban store.</p>
              </div>
              <Code>{`
// Read all notes
const notes = api.getAppStore().getState().notes

// Watch for changes
const unsub = api.getAppStore().subscribe(
  state => state.notes,
  notes => console.log('Notes changed:', notes.length)
)
`}
              </Code>
            </div>

            <div>
              <p className="mb-1.5 font-semibold text-[rgb(var(--text))]">Plugin data storage</p>
              <div className="space-y-1.5">
                <div><InlineCode>await api.readPluginData(filename)</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Reads a file from <InlineCode>{'{vault}/plugins/{id}/{filename}'}</InlineCode>. Returns <InlineCode>null</InlineCode> if not found.</p>
                <div><InlineCode>await api.writePluginData(filename, content)</InlineCode></div>
                <p className="pl-2 text-[rgb(var(--text-3))]">Writes a file to the same location.</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-semibold text-[rgb(var(--text))]">Shared UI components</p>
              <p className="mb-1 text-[rgb(var(--text-3))]">
                Available via <InlineCode>api.components</InlineCode> — no need to bundle React or MindVault UI:
              </p>
              <div className="grid grid-cols-3 gap-1">
                {['Button', 'Pill', 'PriorityDot', 'ProgressBar', 'Select', 'TagBadge', 'TagChip', 'SectionCard', 'Field', 'Dropdown', 'ColorPicker'].map(c => (
                  <InlineCode key={c}>{c}</InlineCode>
                ))}
              </div>
              <p className="mt-1.5 text-[rgb(var(--text-3))]">
                React itself is available as <InlineCode>api.React</InlineCode>.
              </p>
            </div>

          </div>
        </Collapsible>

        {/* Install methods */}
        <Collapsible title="How users install your plugin" iconName="store">
          <div className="space-y-3 text-xs text-[rgb(var(--text-2))]">
            <div>
              <p className="font-medium text-[rgb(var(--text))]">1. Manual (local)</p>
              <p className="mt-0.5 text-[rgb(var(--text-3))]">
                Drop the plugin folder into <InlineCode>{'{vault}/plugins/'}</InlineCode> and restart MindVault. No install flow needed.
              </p>
            </div>
            <div>
              <p className="font-medium text-[rgb(var(--text))]">2. Marketplace iframe</p>
              <p className="mt-0.5 text-[rgb(var(--text-3))]">
                Host your <InlineCode>manifest.json</InlineCode> and <InlineCode>index.js</InlineCode> on a public URL. Submit to the marketplace. Users click Install inside Settings › Marketplace.
              </p>
            </div>
            <div>
              <p className="font-medium text-[rgb(var(--text))]">3. Deep link (desktop)</p>
              <p className="mt-0.5 text-[rgb(var(--text-3))]">
                Link from your own site using:
              </p>
              <Code>{`mindvault://install?id=my-plugin&source=https://your-cdn.com`}</Code>
              <p className="mt-1 text-[rgb(var(--text-3))]">
                Web fallback (when app is open in browser):
              </p>
              <Code>{`https://app.mindvault.app?installPlugin=my-plugin&source=https://your-cdn.com`}</Code>
              <p className="mt-1 text-[rgb(var(--text-3))]">
                The app expects <InlineCode>{'{source}/plugins/{id}/manifest.json'}</InlineCode> and <InlineCode>{'{source}/plugins/{id}/index.js'}</InlineCode> to exist at the given URL.
              </p>
            </div>
          </div>
        </Collapsible>

        <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
          <Icon name="external-link" size={13} className="shrink-0 text-[rgb(var(--accent))]" />
          <p className="text-xs text-[rgb(var(--text-2))]">
            Full docs and an example plugin are available at{' '}
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
