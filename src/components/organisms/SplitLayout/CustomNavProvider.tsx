import { useMemo, type ReactNode } from 'react'
import {
  UNSAFE_NavigationContext,
  UNSAFE_LocationContext,
  NavigationType,
  type To,
} from 'react-router-dom'
import { usePaneStore } from '../../../store/usePaneStore'

interface Props {
  paneId: string
  children: ReactNode
}

/**
 * Provides isolated routing context for one pane without nesting a <Router>.
 * Navigation calls update the pane's active tab path in usePaneStore.
 */
export function CustomNavProvider({ paneId, children }: Props) {
  const path = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === paneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  const navigator = useMemo(() => ({
    createHref: (to: To) =>
      typeof to === 'string' ? to : (to.pathname ?? '/') + (to.search ?? '') + (to.hash ?? ''),
    go: (_delta: number) => {},
    // Preserve search + hash so query-param navigation (e.g. ?view=list) works.
    push: (to: To) => {
      const p = typeof to === 'string' ? to : (to.pathname ?? '/') + (to.search ?? '') + (to.hash ?? '')
      usePaneStore.getState().navigatePane(paneId, p)
    },
    replace: (to: To) => {
      const p = typeof to === 'string' ? to : (to.pathname ?? '/') + (to.search ?? '') + (to.hash ?? '')
      usePaneStore.getState().navigatePane(paneId, p)
    },
  }), [paneId])

  const navigationCtx = useMemo(() => ({
    basename: '',
    navigator,
    static: false,
    useTransitions: undefined as boolean | undefined,
    future: {} as Record<string, never>,
  }), [navigator])

  const qIdx = path.indexOf('?')
  const pathname = qIdx >= 0 ? path.slice(0, qIdx) : path
  const search   = qIdx >= 0 ? path.slice(qIdx)   : ''

  const location = useMemo(() => ({
    pathname,
    search,
    hash: '',
    state: null,
    key: paneId,
    unstable_mask: undefined,
  }), [path, paneId])

  const locationCtx = useMemo(() => ({
    location,
    navigationType: NavigationType.Pop,
  }), [location])

  return (
    <UNSAFE_NavigationContext.Provider value={navigationCtx}>
      <UNSAFE_LocationContext.Provider value={locationCtx}>
        {children}
      </UNSAFE_LocationContext.Provider>
    </UNSAFE_NavigationContext.Provider>
  )
}
