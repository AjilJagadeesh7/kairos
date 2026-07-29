import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SYNC_RULES } from '../types'
import { noteActions } from './app/noteActions'
import { folderActions } from './app/folderActions'
import { settingsActions } from './app/settingsActions'
import type { AppState, StorageTarget, ThemeMode, FontOption, FontWeight, FontSize } from '../types'

export type { AppState }

function readLegacyStorageChoices(): StorageTarget[] {
  try {
    const raw = localStorage.getItem('kairos_storage_choices')
    if (raw) return JSON.parse(raw) as StorageTarget[]
  } catch { /* ignore */ }
  const legacy = localStorage.getItem('kairos_storage_choice')
  return legacy === 'local' ? ['indexdb', 'local'] : ['indexdb']
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      notes: [],
      isNotesLoaded: false,
      query: '',
      searchMode: 'fulltext',
      syncStatus: 'idle',
      s3Config: null,
      webdavConfig: null,
      syncRules: DEFAULT_SYNC_RULES,
      mobileSidebarOpen: false,
      noteTagColors: {},
      calloutColors: {},
      customCallouts: [],
      sidebarOpen: true,
      sidebarWidth: 260,
      editorZoom: 1,
      storageChoices: readLegacyStorageChoices(),
      theme: (localStorage.getItem('kairos.theme') as ThemeMode | null) ?? 'light',
      font: (localStorage.getItem('kairos.font') as FontOption | null) ?? 'manrope',
      fontWeight: (localStorage.getItem('kairos.fontWeight') as FontWeight | null) ?? 'regular',
      fontSize: (localStorage.getItem('kairos.fontSize') as FontSize | null) ?? 'default',
      trashRetentionDays: 30,
      aiUrl: 'http://localhost:11434',
      userName: '',
      newTabPage: '/',
      onboardingDone: false,
      onboardingSeeded: false,
      vaultStatus: 'loading',
      lastSyncTime: null,
      keyBindings: {},
      folderList: [],
      pinnedNoteIds: [],

      ...settingsActions(set),
      ...noteActions(set, get),
      ...folderActions(set, get),
    }),
    {
      name: 'kairos-ui-store',
      partialize: (state) => ({
        activeNoteId:    state.activeNoteId,
        searchMode:      state.searchMode,
        s3Config:        state.s3Config,
        webdavConfig:    state.webdavConfig,
        syncRules:       state.syncRules,
        storageChoices:  state.storageChoices,
        noteTagColors:   state.noteTagColors,
        calloutColors:   state.calloutColors,
        customCallouts:  state.customCallouts,
        sidebarOpen:     state.sidebarOpen,
        sidebarWidth:    state.sidebarWidth,
        editorZoom:      state.editorZoom,
        theme:           state.theme,
        font:            state.font,
        fontWeight:      state.fontWeight,
        fontSize:        state.fontSize,
        trashRetentionDays: state.trashRetentionDays,
        aiUrl:           state.aiUrl,
        userName:        state.userName,
        newTabPage:      state.newTabPage,
        onboardingDone:  state.onboardingDone,
        onboardingSeeded: state.onboardingSeeded,
        keyBindings:     state.keyBindings,
        pinnedNoteIds:   state.pinnedNoteIds,
      }),
      // Deep-merge syncRules so categories added in newer versions (e.g. pennote)
      // gain their on-by-default rule instead of being absent (which canPush/
      // canPull would read as "off").
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<typeof current>
        return {
          ...current,
          ...p,
          syncRules: { ...DEFAULT_SYNC_RULES, ...(p.syncRules ?? {}) },
        }
      },
    },
  ),
)
