import type { Note } from './note.types'
import type { S3Config, WebDAVConfig, SyncStatus, StorageTarget, SyncRules, SyncCategory, SyncProviderId, SyncDirection } from './sync.types'
import type { SearchMode, ThemeMode, FontOption, FontWeight, FontSize, VaultStatus } from './ui.types'
import type { CustomCallout } from './settings.types'

/** The shape of `useAppStore` — shared with the action slices in `src/store/app/`. */
export type AppState = {
  notes: Note[]
  isNotesLoaded: boolean
  activeNoteId?: string
  query: string
  searchMode: SearchMode
  syncStatus: SyncStatus
  storageChoices: StorageTarget[]
  theme: ThemeMode
  font: FontOption
  fontWeight: FontWeight
  fontSize: FontSize
  /** Days a deleted item stays in the trash before auto-purge; 0 = keep forever. */
  trashRetentionDays: number
  aiUrl: string
  s3Config: S3Config | null
  webdavConfig: WebDAVConfig | null
  syncRules: SyncRules
  mobileSidebarOpen: boolean
  noteTagColors: Record<string, string>
  calloutColors: Record<string, string>
  customCallouts: CustomCallout[]
  sidebarOpen: boolean
  sidebarWidth: number
  editorZoom: number
  userName: string
  newTabPage: string
  onboardingDone: boolean
  /** True once the sample notes have been created — stops replays duplicating them. */
  onboardingSeeded: boolean
  vaultStatus: VaultStatus
  lastSyncTime: string | null
  keyBindings: Record<string, string>
  folderList: string[]  // explicitly created folder paths (includes empty folders)
  pinnedNoteIds: string[]

  setUserName: (name: string) => void
  setNewTabPage: (path: string) => void
  completeOnboarding: () => void
  markOnboardingSeeded: () => void
  setVaultStatus: (status: VaultStatus) => void

  setTheme: (t: ThemeMode) => void
  setFont: (f: FontOption) => void
  setFontWeight: (w: FontWeight) => void
  setFontSize: (s: FontSize) => void
  setTrashRetentionDays: (days: number) => void
  setAiUrl: (url: string) => void
  setSearchMode: (mode: SearchMode) => void
  setQuery: (query: string) => void
  setSyncStatus: (status: SyncStatus) => void
  setS3Config: (cfg: S3Config | null) => void
  setWebDAVConfig: (cfg: WebDAVConfig | null) => void
  setSyncRule: (category: SyncCategory, provider: SyncProviderId, direction: keyof SyncDirection, value: boolean) => void
  applySharedSettings: (patch: Partial<Pick<AppState, 'theme' | 'font' | 'fontWeight' | 'fontSize' | 'trashRetentionDays' | 'aiUrl' | 'noteTagColors' | 'calloutColors' | 'customCallouts' | 'keyBindings' | 'userName' | 'newTabPage'>>) => void
  setActiveNoteId: (id?: string) => void
  setMobileSidebarOpen: (open: boolean) => void
  setStorageChoices: (choices: StorageTarget[]) => void
  setNoteTagColor: (tagName: string, color: string) => void
  removeNoteTag: (tagName: string) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  setEditorZoom: (zoom: number) => void
  setCalloutColor: (type: string, color: string) => void
  resetCalloutColor: (type: string) => void
  addCustomCallout: (callout: CustomCallout) => void
  removeCustomCallout: (type: string) => void
  updateCustomCallout: (type: string, patch: Partial<Omit<CustomCallout, 'type'>>) => void
  setKeyBinding: (id: string, key: string) => void
  resetKeyBinding: (id: string) => void
  pinNote: (id: string) => void
  unpinNote: (id: string) => void

  loadNotes: () => Promise<void>
  loadFolders: () => Promise<void>
  createNote: (initial?: { title?: string; content?: string; folder?: string }) => Promise<string>
  updateActiveNote: (patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  updateNote: (noteId: string, patch: Pick<Note, 'title' | 'content' | 'embedding'> & { contentHash: string }) => Promise<void>
  updateNoteTags: (noteId: string, tags: string[]) => Promise<void>
  setNoteNoSync: (noteId: string, value: boolean) => Promise<void>
  updateNoteFrontmatter: (noteId: string, fm: Record<string, unknown>) => Promise<void>
  appendWikilink: (noteId: string, targetTitle: string) => Promise<void>
  deleteNoteById: (id: string) => Promise<void>
  moveNoteToFolder: (noteId: string, folder: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  renameFolder: (oldPath: string, newPath: string) => Promise<void>
  deleteFolder: (path: string) => Promise<void>
}

/** Zustand's setter/getter, narrowed to what the action slices use. */
export type AppSet = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void
export type AppGet = () => AppState
