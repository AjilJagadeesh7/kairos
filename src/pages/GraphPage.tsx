import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { parseWikilinks } from '../utils/wikilinks'
import { cosineSimilarity } from '../utils/similarity'
import { colorForIndex } from '../utils/colorForIndex'
import { useAppStore } from '../store/useAppStore'
import { GraphSidebar } from '../components/organisms/Graph/GraphSidebar'
import { GraphView } from '../components/organisms/Graph/GraphView'
import type { GNode, GLink } from '../types'

type GraphMode = 'links' | 'tags'

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return `rgba(251,191,36,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function GraphPage() {
  const navigate             = useNavigate()
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  const notes      = useLiveQuery(() => db.notes.toArray(), [], [])
  const tagRecords = useLiveQuery(() => db.tags.toArray(),  [], [])

  const [graphMode,      setGraphMode]      = useState<GraphMode>('links')
  const [rerenderKey,    setRerenderKey]    = useState(0)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const tagColorMap = useMemo(
    () => new Map((tagRecords ?? []).map(t => [t.name, t.color])),
    [tagRecords],
  )

  const { linksNodes, linksLinks, tagsNodes, tagsLinks } = useMemo(() => {
    if (!notes?.length) return {
      linksNodes: [] as GNode[], linksLinks: [] as GLink[],
      tagsNodes:  [] as GNode[], tagsLinks:  [] as GLink[],
    }

    const titleMap = new Map(notes.map(n => [n.title.trim().toLowerCase(), n.id]))

    // ── Links graph ──────────────────────────────────────────────────────────
    const linksDeg  = new Map<string, number>()
    const linksInc  = (id: string) => linksDeg.set(id, (linksDeg.get(id) ?? 0) + 1)
    const linksSeen = new Set<string>()
    const linksLinks: GLink[] = []

    for (const note of notes) {
      for (const lnk of parseWikilinks(note.content)) {
        const tid = titleMap.get(lnk.trim().toLowerCase())
        if (!tid || tid === note.id) continue
        const key = [note.id, tid].sort().join('|')
        if (linksSeen.has(key)) continue
        linksSeen.add(key)
        linksLinks.push({ source: note.id, target: tid, kind: 'wikilink' })
        linksInc(note.id); linksInc(tid)
      }
    }
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i]; const b = notes[j]
        if (!a.embedding?.length || !b.embedding?.length) continue
        if (cosineSimilarity(a.embedding!, b.embedding!) > 0.75) {
          linksLinks.push({ source: a.id, target: b.id, kind: 'semantic' })
          linksInc(a.id); linksInc(b.id)
        }
      }
    }
    const linksNodes: GNode[] = notes.map((n, i) => ({
      id:    n.id,
      label: n.title || 'Untitled',
      color: colorForIndex(i),
      val:   Math.max(1, Math.min((linksDeg.get(n.id) ?? 0) * 1.5 + 1, 14)),
      tags:  n.tags ?? [],
    }))

    // ── Tags graph ───────────────────────────────────────────────────────────
    const tagsDeg  = new Map<string, number>()
    const tagsInc  = (id: string) => tagsDeg.set(id, (tagsDeg.get(id) ?? 0) + 1)
    const tagsSeen = new Set<string>()
    const tagsLinks: GLink[] = []

    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i]; const b = notes[j]
        const sharedTags = (a.tags ?? []).filter(t => (b.tags ?? []).includes(t))
        if (sharedTags.length === 0) continue
        const key = [a.id, b.id].sort().join('|')
        if (tagsSeen.has(key)) continue
        tagsSeen.add(key)
        tagsLinks.push({ source: a.id, target: b.id, kind: 'tag', sharedTags })
        tagsInc(a.id); tagsInc(b.id)
      }
    }
    const tagsNodes: GNode[] = notes.map((n, i) => ({
      id:    n.id,
      label: n.title || 'Untitled',
      color: colorForIndex(i),
      val:   Math.max(1, Math.min((tagsDeg.get(n.id) ?? 0) * 1.5 + 1, 14)),
      tags:  n.tags ?? [],
    }))

    return { linksNodes, linksLinks, tagsNodes, tagsLinks }
  }, [notes, rerenderKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = graphMode === 'links' ? linksNodes : tagsNodes
  const links = graphMode === 'links' ? linksLinks : tagsLinks

  const wikilinkCount = linksLinks.filter(l => l.kind === 'wikilink').length
  const semanticCount = linksLinks.filter(l => l.kind === 'semantic').length

  const tagLegendItems = useMemo(() => {
    const tagSet = new Set<string>()
    for (const link of tagsLinks) {
      for (const t of (link.sharedTags ?? [])) tagSet.add(t)
    }
    const all = Array.from(tagSet)
    return { shown: all.slice(0, 10), total: all.length }
  }, [tagsLinks])

  const selectedNote = useMemo(
    () => notes?.find(n => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  const handleModeChange = (mode: GraphMode) => {
    setSelectedNoteId(null)
    setGraphMode(mode)
    setRerenderKey(k => k + 1)
  }

  const handleOpenNote = (noteId: string) => {
    navigate(`/notes/${noteId}`)
  }

  return (
    <main className="relative flex h-full overflow-hidden">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[280px] xl:flex-shrink-0 xl:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <GraphSidebar
          graphMode={graphMode}
          onModeChange={handleModeChange}
          nodes={nodes}
          links={links}
          wikilinkCount={wikilinkCount}
          semanticCount={semanticCount}
          tagLegendItems={tagLegendItems}
          tagColorMap={tagColorMap}
          selectedNote={selectedNote}
          onOpenNote={handleOpenNote}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Graph canvas */}
      <section className="flex min-w-0 flex-1 flex-col border-l border-border">
        <GraphView
          nodes={nodes}
          links={links}
          graphMode={graphMode}
          tagColorMap={tagColorMap}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onOpenNote={handleOpenNote}
          rerenderKey={rerenderKey}
          onRelayout={() => { setSelectedNoteId(null); setRerenderKey(k => k + 1) }}
        />
      </section>
    </main>
  )
}
