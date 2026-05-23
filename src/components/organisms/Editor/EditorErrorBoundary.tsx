import { Component, type ReactNode } from 'react'
import { Icon } from '../../atoms/../../../icons/Icon'

interface Props {
  noteId: string
  content: string
  onSaveRaw: (content: string) => void
  children: ReactNode
}

interface State {
  crashed: boolean
  draftContent: string
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { crashed: false, draftContent: props.content }
  }

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[MindVault] Editor crashed:', error)
  }

  // Reset when the note changes so a good note doesn't stay in fallback mode
  componentDidUpdate(prevProps: Props) {
    if (prevProps.noteId !== this.props.noteId) {
      this.setState({ crashed: false, draftContent: this.props.content })
    }
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
          <Icon name="alert-triangle" size={15} className="shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Editor failed to load</p>
            <p className="mt-0.5 text-[11px] text-amber-600/80 dark:text-amber-500/80">
              Showing raw markdown so your content is safe. Try the retry button or reload the app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ crashed: false })}
            className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
          >
            Retry
          </button>
        </div>

        <textarea
          className="min-h-0 flex-1 resize-none rounded-xl border border-border bg-surface p-4 font-mono text-sm text-text outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
          value={this.state.draftContent}
          onChange={e => this.setState({ draftContent: e.target.value })}
          spellCheck={false}
        />

        <button
          type="button"
          onClick={() => this.props.onSaveRaw(this.state.draftContent)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90"
        >
          <Icon name="save" size={14} /> Save raw markdown
        </button>
      </div>
    )
  }
}
