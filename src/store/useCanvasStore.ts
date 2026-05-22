import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLoaderStore } from './useLoaderStore'
import type { Canvas, CanvasNode, CanvasEdge } from '../types'

interface CanvasState {
  canvases: Canvas[]
  isLoaded: boolean

  loadCanvases: () => Promise<void>
  createCanvas: (title?: string) => string
  updateCanvasTitle: (canvasId: string, title: string) => void
  deleteCanvas: (canvasId: string) => void
  updateNodes: (canvasId: string, nodes: CanvasNode[]) => void
  updateEdges: (canvasId: string, edges: CanvasEdge[]) => void
  updateNodeData: (canvasId: string, nodeId: string, data: Partial<CanvasNode['data']>) => void
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      canvases: [],
      isLoaded: false,

      loadCanvases: async () => {
        const { readAllCanvases, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) { set({ isLoaded: true }); return }
        await useLoaderStore.getState().run('load-canvases', async () => {
          try {
            const canvases = await readAllCanvases()
            canvases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            set({ canvases, isLoaded: true })
          } catch (err) {
            console.warn('[canvas] loadCanvases failed:', err)
            set({ isLoaded: true })
          }
        })
      },

      createCanvas: (title = 'Untitled canvas') => {
        const id  = crypto.randomUUID()
        const now = new Date().toISOString()
        const canvas: Canvas = { id, title, nodes: [], edges: [], createdAt: now, updatedAt: now }
        set(s => ({ canvases: [canvas, ...s.canvases] }))
        void fsUpsert(canvas)
        return id
      },

      updateCanvasTitle: (canvasId, title) => {
        const now = new Date().toISOString()
        set(s => ({
          canvases: s.canvases.map(c => c.id === canvasId ? { ...c, title, updatedAt: now } : c),
        }))
        const canvas = get().canvases.find(c => c.id === canvasId)
        if (canvas) void fsUpsert(canvas)
      },

      deleteCanvas: (canvasId) => {
        set(s => ({ canvases: s.canvases.filter(c => c.id !== canvasId) }))
        void fsDel(canvasId)
      },

      updateNodes: (canvasId, nodes) => {
        const now = new Date().toISOString()
        set(s => ({
          canvases: s.canvases.map(c => c.id === canvasId ? { ...c, nodes, updatedAt: now } : c),
        }))
        const canvas = get().canvases.find(c => c.id === canvasId)
        if (canvas) void fsUpsert(canvas)
      },

      updateEdges: (canvasId, edges) => {
        const now = new Date().toISOString()
        set(s => ({
          canvases: s.canvases.map(c => c.id === canvasId ? { ...c, edges, updatedAt: now } : c),
        }))
        const canvas = get().canvases.find(c => c.id === canvasId)
        if (canvas) void fsUpsert(canvas)
      },

      updateNodeData: (canvasId, nodeId, data) => {
        const now = new Date().toISOString()
        set(s => ({
          canvases: s.canvases.map(c => {
            if (c.id !== canvasId) return c
            return {
              ...c,
              updatedAt: now,
              nodes: c.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n),
            }
          }),
        }))
        const canvas = get().canvases.find(c => c.id === canvasId)
        if (canvas) void fsUpsert(canvas)
      },
    }),
    {
      name: 'mindvault-canvas',
      partialize: () => ({}),
    },
  ),
)

async function fsUpsert(canvas: Canvas): Promise<void> {
  const { writePlainCanvas, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePlainCanvas(canvas).catch(e => console.warn('[canvas] save failed:', e))
  }
}

async function fsDel(id: string): Promise<void> {
  const { deletePlainCanvas, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    deletePlainCanvas(id).catch(e => console.warn('[canvas] delete failed:', e))
  }
}
