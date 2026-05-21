import { create } from 'zustand'

type SplitStore = {
  isSplit: boolean
  focusedPane: 'left' | 'right'
  rightPath: string

  enableSplit: (initialPath: string) => void
  disableSplit: () => void
  setFocusedPane: (pane: 'left' | 'right') => void
  setRightPath: (path: string) => void
  navigateRight: (path: string) => void
}

export const useSplitStore = create<SplitStore>((set) => ({
  isSplit: false,
  focusedPane: 'left',
  rightPath: '/',

  enableSplit(initialPath) {
    set(s => ({
      isSplit: true,
      focusedPane: 'right',
      rightPath: s.rightPath && s.rightPath !== '/' ? s.rightPath : initialPath,
    }))
  },

  disableSplit() {
    set({ isSplit: false, focusedPane: 'left' })
  },

  setFocusedPane(focusedPane) { set({ focusedPane }) },

  setRightPath(rightPath) { set({ rightPath }) },

  navigateRight(path) { set({ rightPath: path }) },
}))
