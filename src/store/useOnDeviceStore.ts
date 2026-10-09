/**
 * On-device model settings (Full build only): which model, and whether its
 * verified file is on disk. Device-local, never synced. The file itself lives
 * in the app's data folder, managed by the native download manager.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultModelId } from '../ai/onDevice/models'
import { isMobile } from '../utils/platform'

interface OnDeviceState {
  modelId: string
  /** Path of the verified model file, or null when it isn't downloaded. */
  readyPath: string | null
  setModelId: (id: string) => void
  setReadyPath: (path: string | null) => void
}

export const useOnDeviceStore = create<OnDeviceState>()(
  persist(
    (set) => ({
      modelId: defaultModelId(isMobile()),
      readyPath: null,
      // Another model means another file: it must be downloaded and verified first.
      setModelId: (modelId) => set((s) => (s.modelId === modelId ? s : { modelId, readyPath: null })),
      setReadyPath: (readyPath) => set({ readyPath }),
    }),
    { name: 'kairos-ai-ondevice' },
  ),
)
