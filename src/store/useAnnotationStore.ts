import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Annotation } from '../types'

interface AnnotationState {
  /** Annotations keyed by docId (note id or journal date). */
  byDoc: Record<string, Annotation[]>
  add: (a: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => string
  setComment: (docId: string, id: string, comment: string) => void
  setColor: (docId: string, id: string, color: string) => void
  remove: (docId: string, id: string) => void
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      byDoc: {},

      add: (a) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const ann: Annotation = { ...a, id, createdAt: now, updatedAt: now }
        set((s) => ({ byDoc: { ...s.byDoc, [a.docId]: [...(s.byDoc[a.docId] ?? []), ann] } }))
        return id
      },

      setComment: (docId, id, comment) => set((s) => ({
        byDoc: {
          ...s.byDoc,
          [docId]: (s.byDoc[docId] ?? []).map((a) =>
            a.id === id ? { ...a, comment, updatedAt: new Date().toISOString() } : a),
        },
      })),

      setColor: (docId, id, color) => set((s) => ({
        byDoc: {
          ...s.byDoc,
          [docId]: (s.byDoc[docId] ?? []).map((a) =>
            a.id === id ? { ...a, color, updatedAt: new Date().toISOString() } : a),
        },
      })),

      remove: (docId, id) => set((s) => ({
        byDoc: { ...s.byDoc, [docId]: (s.byDoc[docId] ?? []).filter((a) => a.id !== id) },
      })),
    }),
    { name: 'kairos-annotations' },
  ),
)
