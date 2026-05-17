import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useGraphData } from '../hooks/useGraphData'
import { GraphSidebar } from '../components/organisms/Graph/GraphSidebar'
import { GraphView } from '../components/organisms/Graph/GraphView'

type GraphMode = 'links' | 'tags'

export function GraphPage() {
  const navigate             = useNavigate()
  const notes                = useAppStore(s => s.notes)
  const mobileSidebarOpen    = useAppStore(s => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore(s => s.setMobileSidebarOpen)

  const [graphMode,      setGraphMode]      = useState<GraphMode>('links')
  const [rerenderKey,    setRerenderKey]    = useState(0)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const { tagColorMap, linksNodes, linksLinks, tagsNodes, tagsLinks, tagLegendItems, selectedNote } =
    useGraphData(notes, rerenderKey, selectedNoteId)

  const nodes = graphMode === 'links' ? linksNodes : tagsNodes
  const links = graphMode === 'links' ? linksLinks : tagsLinks
  const wikilinkCount = linksLinks.filter(l => l.kind === 'wikilink').length
  const semanticCount = linksLinks.filter(l => l.kind === 'semantic').length

  function handleModeChange(mode: GraphMode) {
    setSelectedNoteId(null)
    setGraphMode(mode)
    setRerenderKey(k => k + 1)
  }

  return (
    <main className="relative flex h-full overflow-hidden">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[280px] xl:flex-shrink-0 xl:translate-x-0 ${
        mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
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
          onOpenNote={id => navigate(`/notes/${id}`)}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      <section className="flex min-w-0 flex-1 flex-col border-l border-border">
        <GraphView
          nodes={nodes}
          links={links}
          graphMode={graphMode}
          tagColorMap={tagColorMap}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onOpenNote={id => navigate(`/notes/${id}`)}
          rerenderKey={rerenderKey}
          onRelayout={() => { setSelectedNoteId(null); setRerenderKey(k => k + 1) }}
        />
      </section>
    </main>
  )
}
