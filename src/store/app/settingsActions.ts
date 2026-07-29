import type { AppSet, AppState } from '../../types'

type SettingsActions = Omit<AppState,
  // everything that isn't a settings action: state fields + the note/folder slices
  | 'notes' | 'isNotesLoaded' | 'activeNoteId' | 'query' | 'searchMode' | 'syncStatus'
  | 'storageChoices' | 'theme' | 'font' | 'fontWeight' | 'fontSize' | 'trashRetentionDays'
  | 'aiUrl' | 's3Config' | 'webdavConfig' | 'syncRules' | 'mobileSidebarOpen'
  | 'noteTagColors' | 'calloutColors' | 'customCallouts' | 'sidebarOpen' | 'sidebarWidth'
  | 'editorZoom' | 'userName' | 'newTabPage' | 'onboardingDone' | 'onboardingSeeded'
  | 'vaultStatus' | 'lastSyncTime' | 'keyBindings' | 'folderList' | 'pinnedNoteIds'
  | 'loadNotes' | 'createNote' | 'updateNote' | 'updateActiveNote' | 'updateNoteTags'
  | 'setNoteNoSync' | 'updateNoteFrontmatter' | 'appendWikilink' | 'deleteNoteById'
  | 'moveNoteToFolder' | 'loadFolders' | 'createFolder' | 'renameFolder' | 'deleteFolder'>

/** Settings written by the user travel with the vault, so every appearance-ish
 *  change re-saves the shared settings file. */
function saveShared(): void {
  void import('../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
}

/** Preference, appearance and UI-chrome actions for `useAppStore`. */
export function settingsActions(set: AppSet): SettingsActions {
  return {
    setUserName: (userName) => set({ userName }),
    setNewTabPage: (newTabPage) => set({ newTabPage }),
    completeOnboarding: () => set({ onboardingDone: true }),
    markOnboardingSeeded: () => set({ onboardingSeeded: true }),
    setVaultStatus: (vaultStatus) => set({ vaultStatus }),

    setTheme:      (theme)      => { set({ theme });      saveShared() },
    setFont:       (font)       => { set({ font });       saveShared() },
    setFontWeight: (fontWeight) => { set({ fontWeight }); saveShared() },
    setFontSize:   (fontSize)   => { set({ fontSize });   saveShared() },
    setTrashRetentionDays: (days) => {
      set({ trashRetentionDays: Math.max(0, Math.round(days)) })
      saveShared()
    },

    setAiUrl: (aiUrl) => set({ aiUrl }),
    setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
    setSearchMode: (searchMode) => set({ searchMode }),
    setQuery: (query) => set({ query }),
    setSyncStatus: (syncStatus) => {
      const updates: Partial<AppState> = { syncStatus }
      if (syncStatus === 'ok') updates.lastSyncTime = new Date().toISOString()
      set(updates)
    },
    setS3Config: (s3Config) => set({ s3Config }),
    setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),
    setSyncRule: (category, provider, direction, value) => set((s) => ({
      syncRules: {
        ...s.syncRules,
        [category]: {
          ...s.syncRules[category],
          [provider]: { ...s.syncRules[category][provider], [direction]: value },
        },
      },
    })),
    applySharedSettings: (patch) => set((s) => ({
      theme:          patch.theme          ?? s.theme,
      font:           patch.font           ?? s.font,
      fontWeight:     patch.fontWeight     ?? s.fontWeight,
      fontSize:       patch.fontSize       ?? s.fontSize,
      trashRetentionDays: patch.trashRetentionDays ?? s.trashRetentionDays,
      aiUrl:          patch.aiUrl          ?? s.aiUrl,
      noteTagColors:  patch.noteTagColors  ?? s.noteTagColors,
      calloutColors:  patch.calloutColors  ?? s.calloutColors,
      customCallouts: patch.customCallouts ?? s.customCallouts,
      keyBindings:    patch.keyBindings    ?? s.keyBindings,
      userName:       patch.userName       ?? s.userName,
      newTabPage:     patch.newTabPage     ?? s.newTabPage,
    })),
    setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
    setStorageChoices: (storageChoices) => set({ storageChoices }),
    setNoteTagColor: (tagName, color) => set(s => ({ noteTagColors: { ...s.noteTagColors, [tagName]: color } })),
    removeNoteTag: (tagName) => set(s => {
      const { [tagName]: _, ...rest } = s.noteTagColors
      return { noteTagColors: rest }
    }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: Math.max(180, Math.min(520, sidebarWidth)) }),
    setEditorZoom: (editorZoom) => set({ editorZoom: Math.round(Math.max(0.7, Math.min(2, editorZoom)) * 100) / 100 }),
    setCalloutColor: (type, color) => set(s => ({ calloutColors: { ...s.calloutColors, [type]: color } })),
    resetCalloutColor: (type) => set(s => {
      const { [type]: _, ...rest } = s.calloutColors
      return { calloutColors: rest }
    }),
    addCustomCallout: (callout) => set(s => {
      if (s.customCallouts.some(c => c.type === callout.type)) return s
      return { customCallouts: [...s.customCallouts, callout] }
    }),
    removeCustomCallout: (type) => set(s => ({
      customCallouts: s.customCallouts.filter(c => c.type !== type),
    })),
    updateCustomCallout: (type, patch) => set(s => ({
      customCallouts: s.customCallouts.map(c => c.type === type ? { ...c, ...patch } : c),
    })),
    setKeyBinding: (id, key) => set(s => ({ keyBindings: { ...s.keyBindings, [id]: key } })),
    resetKeyBinding: (id) => set(s => {
      const { [id]: _, ...rest } = s.keyBindings
      return { keyBindings: rest }
    }),
    pinNote: (id) => set(s => ({ pinnedNoteIds: s.pinnedNoteIds.includes(id) ? s.pinnedNoteIds : [...s.pinnedNoteIds, id] })),
    unpinNote: (id) => set(s => ({ pinnedNoteIds: s.pinnedNoteIds.filter(x => x !== id) })),
  }
}
