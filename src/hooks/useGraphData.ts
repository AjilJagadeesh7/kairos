import { useEffect, useMemo, useRef, useState } from 'react'
import { parseWikilinks } from '../utils/wikilinks'
import { computeSimilarityPairs } from '../utils/similarityWorkerClient'
import { colorForIndex } from '../utils/colorForIndex'
import { TAG_COLOR_PALETTE } from '../utils/kanban'
import { useKanbanStore } from '../store/useKanbanStore'
import { useCanvasStore } from '../store/useCanvasStore'
import type { Note, GNode, GLink } from '../types'

function hashTagColor(tag: string): string {
  let h = 5381
  for (let i = 0; i < tag.length; i++) h = ((h << 5) + h) ^ tag.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function useGraphData(
  notes: Note[],
  embeddingMap: Map<string, number[]>,
  rerenderKey: number,
  selectedNoteId: string | null,
  showTasks: boolean,
) {
  const boards   = useKanbanStore(s => s.boards)
  const canvases = useCanvasStore(s => s.canvases)

  // Async semantic links — computed in Web Worker off main thread
  const [semanticLinks, setSemanticLinks] = useState<GLink[]>([])
  const embeddingMapRef = useRef(embeddingMap)
  embeddingMapRef.current = embeddingMap

  useEffect(() => {
    let cancelled = false
    void computeSimilarityPairs(embeddingMap).then(pairs => {
      if (cancelled) return
      setSemanticLinks(
        pairs.map(p => ({ source: p.source, target: p.target, kind: 'semantic' as const })),
      )
    }).catch(() => { /* cancelled or worker error — keep previous links */ })
    return () => { cancelled = true }
  // embeddingMap identity changes when notes are saved; rerenderKey covers manual refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embeddingMap, rerenderKey])

  const tagColorMap = useMemo(() => {
    const map = new Map<string, string>()
    notes.forEach(n => n.tags.forEach(tag => { if (!map.has(tag)) map.set(tag, hashTagColor(tag)) }))
    return map
  }, [notes])

  const { linksNodes, linksLinks, tagsNodes, tagsLinks } = useMemo(() => {
    if (!notes?.length) return {
      linksNodes: [] as GNode[], linksLinks: [] as GLink[],
      tagsNodes:  [] as GNode[], tagsLinks:  [] as GLink[],
    }

    const titleMap = new Map(notes.map(n => [n.title.trim().toLowerCase(), n.id]))

    // Links graph
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
    // Canvas edges: connect note nodes whose canvas edge endpoints are both note-type nodes
    for (const canvas of canvases) {
      const noteNodeMap = new Map<string, string>() // canvasNodeId → noteId
      for (const node of canvas.nodes) {
        if (node.type === 'note' && 'noteId' in node.data) {
          noteNodeMap.set(node.id, (node.data as { noteId: string }).noteId)
        }
      }
      for (const edge of canvas.edges) {
        const srcNoteId = noteNodeMap.get(edge.source)
        const tgtNoteId = noteNodeMap.get(edge.target)
        if (srcNoteId && tgtNoteId && srcNoteId !== tgtNoteId) {
          const key = [srcNoteId, tgtNoteId].sort().join('|')
          if (!linksSeen.has(key)) {
            linksSeen.add(key)
            linksLinks.push({ source: srcNoteId, target: tgtNoteId, kind: 'canvas' })
            linksInc(srcNoteId); linksInc(tgtNoteId)
          }
        }
      }
    }

    const linksNodes: GNode[] = notes.map((n, i) => ({
      id:       n.id,
      label:    n.title || 'Untitled',
      color:    colorForIndex(i),
      val:      Math.max(1, Math.min((linksDeg.get(n.id) ?? 0) * 1.5 + 1, 14)),
      tags:     n.tags ?? [],
      nodeType: 'note' as const,
    }))

    // Tags graph
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
      id:       n.id,
      label:    n.title || 'Untitled',
      color:    colorForIndex(i),
      val:      Math.max(1, Math.min((tagsDeg.get(n.id) ?? 0) * 1.5 + 1, 14)),
      tags:     n.tags ?? [],
      nodeType: 'note' as const,
    }))

    return { linksNodes, linksLinks, tagsNodes, tagsLinks }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, rerenderKey, canvases])

  // Canvas nodes and canvas→note edges
  const { canvasNodes, canvasLinks } = useMemo(() => {
    const noteIds = new Set(notes.map(n => n.id))
    const canvasNodes: GNode[] = canvases.map(canvas => ({
      id:       canvas.id,
      label:    canvas.title,
      color:    '#f59e0b',
      val:      5,
      tags:     [],
      nodeType: 'canvas' as const,
      canvasId: canvas.id,
    }))
    const canvasLinks: GLink[] = []
    const seen = new Set<string>()
    for (const canvas of canvases) {
      for (const node of canvas.nodes) {
        if (node.type === 'note' && 'noteId' in node.data) {
          const noteId = (node.data as { noteId: string }).noteId
          if (noteIds.has(noteId)) {
            const key = `${canvas.id}|${noteId}`
            if (!seen.has(key)) { seen.add(key); canvasLinks.push({ source: canvas.id, target: noteId, kind: 'canvas-note' }) }
          }
        }
      }
    }
    return { canvasNodes, canvasLinks }
  }, [canvases, notes])

  // Task nodes and edges (only when showTasks=true)
  const { taskNodes, taskLinks } = useMemo(() => {
    if (!showTasks || !boards.length) return { taskNodes: [] as GNode[], taskLinks: [] as GLink[] }

    const taskNodes: GNode[] = []
    const taskLinks: GLink[] = []
    const noteIds = new Set(notes.map(n => n.id))

    for (const board of boards) {
      const colMap = new Map(board.columns.map(c => [c.id, c]))
      for (const task of board.tasks) {
        const col   = colMap.get(task.columnId)
        const color = col?.color ?? '#6b7280'
        taskNodes.push({
          id:       task.id,
          label:    task.title,
          color,
          val:      3,
          tags:     task.tags ?? [],
          nodeType: 'task' as const,
          taskId:   task.id,
          boardId:  board.id,
        })
        for (const noteId of (task.linkedNotes ?? [])) {
          if (noteIds.has(noteId)) {
            taskLinks.push({ source: task.id, target: noteId, kind: 'task-note' })
          }
        }
        for (const linkedTaskId of (task.linkedTasks ?? [])) {
          taskLinks.push({ source: task.id, target: linkedTaskId, kind: 'task-task' })
        }
      }
    }
    return { taskNodes, taskLinks }
  }, [showTasks, boards, notes])

  const tagLegendItems = useMemo(() => {
    const tagSet = new Set<string>()
    for (const link of tagsLinks) for (const t of (link.sharedTags ?? [])) tagSet.add(t)
    const all = Array.from(tagSet)
    return { shown: all.slice(0, 10), total: all.length }
  }, [tagsLinks])

  const selectedNote = useMemo(
    () => notes?.find(n => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  const allLinksLinks = useMemo(
    () => [...linksLinks, ...semanticLinks],
    [linksLinks, semanticLinks],
  )

  return {
    tagColorMap,
    linksNodes, linksLinks: allLinksLinks,
    tagsNodes, tagsLinks,
    taskNodes, taskLinks,
    canvasNodes, canvasLinks,
    tagLegendItems,
    selectedNote,
  }
}
