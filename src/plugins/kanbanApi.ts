import { useKanbanStore } from '../store/useKanbanStore'
import { gate } from './permissionGate'
import type { PluginManifest, KairosPluginAPI } from './types'

export function buildKanbanApi(manifest: PluginManifest): KairosPluginAPI['kanban'] {
  return {
    getBoards() {
      gate(manifest, 'read:kanban', 'kanban.getBoards')
      return useKanbanStore.getState().boards.map(({ id, title }) => ({ id, title }))
    },

    createTask(boardId: string, columnId: string, title: string): string {
      gate(manifest, 'write:kanban', 'kanban.createTask')
      return useKanbanStore.getState().createTask(boardId, columnId, title)
    },

    updateTask(
      boardId: string,
      taskId: string,
      updates: Parameters<KairosPluginAPI['kanban']['updateTask']>[2],
    ): void {
      gate(manifest, 'write:kanban', 'kanban.updateTask')
      useKanbanStore.getState().updateTask(boardId, taskId, updates)
    },
  }
}
