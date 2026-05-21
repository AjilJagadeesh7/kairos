import { createContext, useContext } from 'react'

/** The ID of the pane that wraps this component. */
export const PaneIdContext = createContext<string>('')
export const usePaneId = () => useContext(PaneIdContext)

/** Single shared sidebar DOM slot (null when only one pane exists). */
export const SidebarSlotContext = createContext<HTMLDivElement | null>(null)
export const useSidebarSlot = () => useContext(SidebarSlotContext)
