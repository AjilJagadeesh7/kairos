import { useEffect, useState } from 'react'
import { embedText } from '../utils/embeddingClient'
import { cosineSimilarity } from '../utils/similarity'
import { db } from '../db/schema'
import type { Note, SearchMode } from '../types'

export function useSemanticSearch(
  filtered: Note[],
  query: string,
  searchMode: SearchMode,
) {
  const [semanticResults, setSemanticResults] = useState<Note[] | null>(null)

  useEffect(() => {
    let mounted = true
    async function run() {
      const q = query.trim()
      if (!q || searchMode !== 'semantic') { if (mounted) setSemanticResults(null); return }
      const queryEmbedding = (await embedText('semantic-query', q)).embedding
      const allEmbeddings = await db.embeddings.toArray()
      const embeddingMap = new Map(allEmbeddings.map((r) => [r.noteId, r.data]))
      const ranked = filtered
        .map((note) => {
          const emb = embeddingMap.get(note.id) ?? []
          return { note, score: emb.length > 0 ? cosineSimilarity(queryEmbedding, emb) : -1 }
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30)
        .map((item) => item.note)
      if (mounted) setSemanticResults(ranked)
    }
    void run()
    return () => { mounted = false }
  }, [query, searchMode, filtered])

  return semanticResults
}
