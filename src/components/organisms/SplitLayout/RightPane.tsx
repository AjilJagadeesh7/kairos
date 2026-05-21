import { useMemo } from 'react'
import {
  UNSAFE_NavigationContext,
  UNSAFE_LocationContext,
  NavigationType,
  type To,
} from 'react-router-dom'
import { useSplitStore } from '../../../store/useSplitStore'
import { AppRoutes } from '../../../routes'

// Provides an independent navigation context for the right pane without
// nesting a second <Router> (which React Router forbids). UNSAFE_ contexts
// are the stable, intentionally-exported way to do this.
export function RightPane({ initialPath: _initialPath }: { initialPath: string }) {
  const rightPath    = useSplitStore(s => s.rightPath)
  const setRightPath = useSplitStore(s => s.setRightPath)

  // Navigator: right-pane navigation updates the store (no browser URL change)
  const navigator = useMemo(() => ({
    createHref: (to: To) => {
      if (typeof to === 'string') return to
      return (to.pathname ?? '/') + (to.search ?? '') + (to.hash ?? '')
    },
    go: (_delta: number) => {},
    push: (to: To) => {
      const path = typeof to === 'string' ? to : (to.pathname ?? '/')
      setRightPath(path)
    },
    replace: (to: To) => {
      const path = typeof to === 'string' ? to : (to.pathname ?? '/')
      setRightPath(path)
    },
  }), [setRightPath])

  const navigationCtx = useMemo(() => ({
    basename: '',
    navigator,
    static: false,
    unstable_useTransitions: undefined as boolean | undefined,
    future: {} as Record<string, never>,
  }), [navigator])

  const location = useMemo(() => ({
    pathname: rightPath,
    search: '',
    hash: '',
    state: null,
    key: 'right',
  }), [rightPath])

  const locationCtx = useMemo(() => ({
    location,
    navigationType: NavigationType.Pop,
  }), [location])

  return (
    <UNSAFE_NavigationContext.Provider value={navigationCtx}>
      <UNSAFE_LocationContext.Provider value={locationCtx}>
        <AppRoutes />
      </UNSAFE_LocationContext.Provider>
    </UNSAFE_NavigationContext.Provider>
  )
}
