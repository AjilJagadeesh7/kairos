import { Component, type ErrorInfo, type ReactNode } from 'react'

import { logger } from '../../logger/logger'
import { Icon } from '../../icons/Icon'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** When any of these values change, the boundary resets automatically */
  resetKeys?: unknown[]
}

interface State {
  error: Error | null
  errorKey: number
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
    logger.error(error.message, 'ErrorBoundary', error)
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKeys !== this.props.resetKeys) {
      const changed = (this.props.resetKeys ?? []).some(
        (k, i) => k !== (prevProps.resetKeys ?? [])[i],
      )
      if (changed) this.reset()
    }
  }

  reset(): void {
    this.setState(s => ({ error: null, errorKey: s.errorKey + 1 }))
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <Icon name="alert-triangle" size={22} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--text))]">Something went wrong</p>
          <p className="mt-1 max-w-sm text-xs text-[rgb(var(--text-3))]">
            {this.state.error.message || 'An unexpected error occurred in this section.'}
          </p>
        </div>
        <button
          onClick={() => this.reset()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]"
        >
          <Icon name="refresh-cw" size={12} /> Try again
        </button>
        <details className="max-w-sm text-left">
          <summary className="cursor-pointer text-[11px] text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]">
            Show details
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-[rgb(var(--surface-2))] p-3 text-[10px] leading-relaxed text-[rgb(var(--text-3))]">
            {this.state.error.stack}
          </pre>
        </details>
      </div>
    )
  }
}
