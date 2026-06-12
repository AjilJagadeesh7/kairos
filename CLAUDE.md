# Kairos — Claude Instructions

## Stack quick-reference

- **UI**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **State**: Zustand stores in `src/store/`
- **Local DB**: Dexie.js (IndexedDB) — schema in `src/db/schema.ts`
- **Desktop shell**: Tauri v2 — capabilities in `src-tauri/capabilities/default.json`
- **Routing**: `react-router-dom` with `MemoryRouter` (no URL bar on desktop)
- **Editor**: Milkdown/Crepe (ProseMirror) — StrictMode is intentionally OFF (see `src/main.tsx`)

## Content types

| Type                | Store            | Route               | Storage                  |
|---------------------|------------------|---------------------|--------------------------|
| Notes               | `useAppStore`    | `/notes/:id`        | `vault/notes/*.md`       |
| Journal             | `useJournalStore`| `/journal/:date`    | `vault/journal/*.md`     |
| Kanban boards/tasks | `useKanbanStore` | `/kanban/:boardId`  | `vault/kanban/*.json`    |
| Canvases            | `useCanvasStore` | `/canvas/:canvasId` | `vault/canvas/*.json`    |
| Graph               | —                | `/graph`            | derived from notes       |

## Adding a new feature — command palette checklist

Every new content type or route MUST be wired into the command palette. Omitting any step means users cannot search or navigate to it via `Cmd+K`.

### 1. Navigation entry (always required)

Add a line to `NAV_ITEMS` in `src/components/organisms/CommandPalette.tsx`:

```ts
{ kind: 'nav', id: 'nav-myfeature', label: 'My Feature', hint: 'Short description', iconName: 'icon-name', path: '/myfeature' },
```

Use the same icon as the ActivityBar (`src/components/organisms/ActivityBar/ActivityBar.tsx`).

For a new **Settings tab**, add instead:

```ts
{ kind: 'nav', id: 'nav-s-myfeature', label: 'Settings → My Feature', hint: 'Description', iconName: 'settings', path: '/settings?section=myfeature' },
```

### 2. Search index — `src/search/universalSearch.ts`

Add the kind, a doc builder, and call it in `buildUniversalIndex`:

```ts
// 1. Extend the union
export type ResultKind = 'note' | 'journal' | 'task' | 'canvas' | 'myfeature'

// 2. Doc builder
function myFeatureDoc(item: MyFeature): UnifiedDoc {
  return { id: `myfeature:${item.id}`, kind: 'myfeature', title: item.title,
           meta: 'context words', body: '', updatedAt: item.updatedAt }
}

// 3. Add parameter + loop in buildUniversalIndex
for (const item of myFeatures) docs.push(myFeatureDoc(item))
```

### 3. Wire up in `CommandPalette.tsx`

- Read from store: `const myFeatures = useMyFeatureStore(s => s.items)`
- Build lookup map: `const myFeatureMap = useMemo(() => new Map(myFeatures.map(i => [i.id, i])), [myFeatures])`
- Extend `ResultItem` union: `| { kind: 'myfeature'; item: MyFeature; score: number }`
- Extend `itemKey()`: `if (item.kind === 'myfeature') return 'myfeature:' + item.item.id`
- Extend `groupResults()`: add `{ label: 'My Features', items: items.filter(i => i.kind === 'myfeature') }`
- Add a `ResultRow` branch with the matching icon
- Handle the search hit: `else if (hit.kind === 'myfeature') { const item = myFeatureMap.get(hit.id.slice(10)); if (item) ... }`
- Pass to `buildUniversalIndex(..., myFeatures)`
- Navigate in `activate()`: `else if (item.kind === 'myfeature') navigate('/myfeature/' + item.item.id)`

## Graph view — WebKitGTK notes

- `react-force-graph-2d` runs on CPU canvas on Linux (no GPU acceleration)
- **Do NOT use `linkDirectionalParticles`** — sets `__photons` on links which forces 60fps redraw permanently
- `useGraphData` computes cosine similarity **synchronously** in `useMemo` — do not move it back to an async worker (that causes double graphData updates → double ForceGraph2D inits → freeze)
- The RAF loop is explicitly stopped on GraphView unmount via `useEffect(() => () => fgRef.current?.pauseAnimation(), [])`
- `posCache` stores only `{ x, y }` — **never `fx/fy`**. Dragging pins a node for the current session only (`node.fx = node.x` on the live object). Persisting `fx/fy` causes previously-dragged nodes to be frozen on re-visits while others animate, making behavior inconsistent.

## Modularization rules

These rules are enforced across the entire codebase. Apply them when adding or editing any file.

### File size limit: 300 lines

No component, hook, or module file may exceed 300 lines. When a file grows past this, split it:

- **Sub-components** → extract to a sibling file in the same folder (e.g. `MyFeatureToolbar.tsx` next to `MyFeature.tsx`)
- **Custom hooks** → extract to `src/hooks/useMyHook.ts`
- **Pure utilities / helpers** → extract to an adjacent `.ts` file (e.g. `myFeatureUtils.ts`)
- **Static data / large config objects** → extract to an adjacent `.ts` or `.tsx` file (e.g. `myFeatureData.tsx` when JSX is needed for icons)

### Types must live in `src/types/`

Shared or exported TypeScript types and interfaces must **not** be defined inside component files. Instead:

1. Add the type to the relevant file in `src/types/` (e.g. `note.types.ts`, `graph.types.ts`, `editor.types.ts`).
2. Re-export it from `src/types/index.ts`.
3. Import it as `import type { MyType } from '../../../types'` (or the equivalent relative path).

Types that are genuinely private to a single file and never exported are exempt.

### File/folder placement

| What                       | Where                                                        |
|----------------------------|--------------------------------------------------------------|
| Shared/exported types      | `src/types/<domain>.types.ts`                                |
| Custom React hooks         | `src/hooks/use<Name>.ts` (or `.tsx` if JSX)                  |
| Page-level components      | `src/pages/<Name>Page.tsx`                                   |
| Organism-level components  | `src/components/organisms/<Feature>/<Name>.tsx`              |
| Molecule/atom components   | `src/components/molecules/` or `atoms/`                      |
| Pure utility functions     | `src/utils/<name>.ts`                                        |
| Static data used by one UI | Adjacent to the component, e.g. `<name>Data.tsx`             |

### Reusable atoms — always use these, never inline the pattern

- **`Button`** (`atoms/Button`) — all text buttons; variant: `submit` (filled accent, defaults `type="submit"`), `primary` (same style, `type="button"`), `hollow` (bordered outline), `link` (accent text, hover underline), `ghost`, `danger` (red filled), `pill`; size: xs/sm/md/lg (24/28/34/40px fixed heights); `fullWidth` prop for w-full. Size conventions: **md** for modal footers and page-level actions, **sm** for compact inline actions, **xs** for micro actions inside dense panels, **lg** for onboarding/mobile CTAs. Forwards refs.
- **`IconButton`** (`atoms/IconButton`) — icon-only buttons; size xs/sm/md = h-6/h-7/h-8; use `iconClassName` for icon-level styles like `animate-spin`
- **`ToggleSwitch`** (`atoms/ToggleSwitch`) — on/off toggles with `role="switch"`; size sm/md
- **`SectionLabel`** (`atoms/SectionLabel`) — `uppercase tracking-widest` section headers; use `className` prop for margin/padding
- **`KbdKey`** (`atoms/KbdKey`) — keyboard shortcut display (`<kbd>` element)
- **`Divider`** (`atoms/Divider`) — horizontal `border-t border-border` separator
- **`Pill`** (`atoms/Pill`) — pill/tab toggle buttons
- **`TagBadge`** (`atoms/TagBadge`) — colored tag display
- **`TagChip`** (`atoms/TagChip`) — removable tag chips

When you find yourself writing any of these patterns inline, extract to the atom instead.

### Reusable molecules — always use these, never inline the pattern

- **`ModalShell`** (`molecules/ModalShell`) — all modals; wraps `createPortal` + backdrop + card; props: `onClose`, `maxWidth`, `zIndex`, `blur`, `className`. Pass `className="overflow-hidden p-0"` when the card controls its own padding.
- **`EmptyState`** (`molecules/EmptyState`) — icon + title + optional description + optional action button for empty lists/panels
- **`InlineEditInput`** (`molecules/InlineEditInput`) — autoFocus input with Enter/Escape/blur commit; use for rename and create-folder flows; `onClick` stops propagation automatically

When you find yourself writing a modal backdrop + card, an inline editing input, or an empty-list placeholder, use these molecules instead.

## Key architectural rules

- Platform detection: `src/utils/platform.ts` — `isDesktop()` for Tauri-only features
- Self-write guard: `src/sync/selfWriteGuard.ts` — suppress vault watcher during app writes
- Vault watcher: `src/hooks/useVaultWatcher.ts` — debounced, desktop-only
- Paste sanitization plugin: strips hostile HTML on paste in the editor
- All Tauri permissions must be listed in `src-tauri/capabilities/default.json`
