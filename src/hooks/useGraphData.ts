import { useMemo } from 'react'
import { parseWikilinks } from '../utils/wikilinks'
import { cosineSimilarity } from '../utils/similarity'
import { colorForIndex } from '../utils/colorForIndex'
import { TAG_COLOR_PALETTE } from '../utils/kanban'
import type { Note, GNode, GLink } from '../types'

function hashTagColor(tag: string): string {
  let h = 5381
  for (let i = 0; i < tag.length; i++) h = ((h << 5) + h) ^ tag.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function useGraphData(notes: Note[], rerenderKey: number, selectedNoteId: string | null) {
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
      id:    n.id,
      label: n.title || 'Untitled',
      color: colorForIndex(i),
      val:   Math.max(1, Math.min((tagsDeg.get(n.id) ?? 0) * 1.5 + 1, 14)),
      tags:  n.tags ?? [],
    }))

    return { linksNodes, linksLinks, tagsNodes, tagsLinks }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, rerenderKey])

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

  return { tagColorMap, linksNodes, linksLinks, tagsNodes, tagsLinks, tagLegendItems, selectedNote }
}
