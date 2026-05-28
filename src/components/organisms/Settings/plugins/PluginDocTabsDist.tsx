import { Code, InlineCode, Collapsible, CalloutNote } from './PluginDocPrimitives'

// ─── Distribution tab ─────────────────────────────────────────────────────────
// Covers: icon packs + install methods + marketplace

export function TabDistribution() {
  return (
    <div className="space-y-3">

      {/* Install methods */}
      <Collapsible title="Manual install (local development)" iconName="folder-input" defaultOpen>
        <p className="text-xs text-[rgb(var(--text-2))]">
          Drop your plugin folder into <InlineCode>{'{vault}/plugins/'}</InlineCode> and restart Kairos. The app scans that folder on startup and auto-registers any plugin it finds.
        </p>
        <Code>{`
{vault}/plugins/
└── my-plugin/
    ├── manifest.json
    └── index.js
`}</Code>
        <p className="mt-1.5 text-xs text-[rgb(var(--text-3))]">
          No settings needed — if the folder has a valid <InlineCode>manifest.json</InlineCode>, it appears in the Installed Plugins list automatically.
        </p>
      </Collapsible>

      <Collapsible title="Marketplace" iconName="store">
        <div className="space-y-2 text-xs text-[rgb(var(--text-2))]">
          <p>Host your <InlineCode>manifest.json</InlineCode> and <InlineCode>index.js</InlineCode> at any public URL, then submit to the marketplace.</p>
          <p className="text-[rgb(var(--text-3))]">
            The marketplace sends a structured install message to the host app, which downloads and registers the plugin — no manual file placement required for end users.
          </p>
        </div>
      </Collapsible>

      <Collapsible title="Deep link (desktop)" iconName="link">
        <p className="mb-2 text-xs text-[rgb(var(--text-2))]">
          Link directly from your site or documentation to trigger an install prompt in the desktop app:
        </p>
        <Code>{`kairos://install?id=my-plugin&source=https://your-cdn.com`}</Code>
        <p className="mt-2 mb-1 text-xs text-[rgb(var(--text-3))]">Web / PWA fallback:</p>
        <Code>{`https://app.kairos.app?installPlugin=my-plugin&source=https://your-cdn.com`}</Code>
        <CalloutNote>
          The app fetches <InlineCode>{'{source}/plugins/{id}/manifest.json'}</InlineCode> and <InlineCode>{'{source}/plugins/{id}/index.js'}</InlineCode> — keep those paths consistent.
        </CalloutNote>
      </Collapsible>

      {/* Icon packs */}
      <Collapsible title="Icon packs — override built-in icons" iconName="palette">
        <p className="mb-2 text-xs text-[rgb(var(--text-2))]">
          Icon packs swap any of Kairos's built-in icons without writing React — just SVG files and a JSON map.
        </p>
        <Code>{`
{vault}/plugins/my-icon-pack/
├── manifest.json     ← permissions: ["ui:icons"]
├── icons.json        ← maps token names → SVG paths or inline SVG
└── icons/
    ├── file-text.svg
    └── ...
`}</Code>
        <Code>{`
// icons.json
{
  "file-text":   "icons/file-text.svg",
  "folder-open": "icons/folder-open.svg",
  "search": "<svg xmlns='http://www.w3.org/2000/svg' ...>...</svg>"
}
`}</Code>
        <Code>{`
// index.js — register the pack
export default async function setup(api) {
  const raw = await api.readPluginData('icons.json')
  if (raw) api.registerIconPack(JSON.parse(raw))
}
`}</Code>
        <CalloutNote>
          You only need to provide icons you want to override — all others fall back to the built-in Lucide set.
        </CalloutNote>
      </Collapsible>

      <Collapsible title="Icon token names (all overridable)" iconName="list">
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
