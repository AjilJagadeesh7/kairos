import { useMemo } from 'react'
import { parseWikilinks } from '../utils/wikilinks'
import type { Note } from '../types'

export interface BacklinkEntry {
  note: Note
  context: string
}

const WIKILINK_RAW = /\\?\[\\?\[([^\]\\]+?)\\?\]\\?\]/g

function extractContext(content: string, title: string): string {
  const lower = content.toLowerCase()
  const target = title.toLowerCase()

  // Find position of the [[title]] match
  WIKILINK_RAW.lastIndex = 0
  let match: RegExpExecArray | null
  let matchStart = -1
  while ((match = WIKILINK_RAW.exec(content)) !== null) {
    if (match[1]?.trim().toLowerCase() === target) {
      matchStart = match.index
      break
    }
  }

  if (matchStart < 0) {
    // Fallback: plain text search
    matchStart = lower.indexOf(target)
    if (matchStart < 0) return ''
  }

  const start = Math.max(0, matchStart - 80)
  const end   = Math.min(content.length, matchStart + title.length + 80)
  let snippet = content.slice(start, end).replace(/\n+/g, ' ').trim()
  if (start > 0) snippet = '…' + snippet
  if (end < content.length) snippet += '…'
  return snippet
}

export function useBacklinks(noteTitle: string, notes: Note[]): BacklinkEntry[] {
  return useMemo(() => {
    if (!noteTitle.trim()) return []
    const titleLower = noteTitle.trim().toLowerCase()

    const results: BacklinkEntry[] = []
    for (const note of notes) {
      const links = parseWikilinks(note.content)
      if (links.some(l => l.toLowerCase() === titleLower)) {
        results.push({ note, context: extractContext(note.content, noteTitle) })
      }
    }
    return results
  }, [noteTitle, notes])
}
