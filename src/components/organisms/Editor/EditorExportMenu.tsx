import { useState } from 'react'
import { exportNoteAsMarkdown, exportNoteAsHTML } from '../../../utils/publishSiteGenerator'
import { Icon } from '../../../icons/Icon'
import type { EditorDraftProps } from '../../../types'

export interface ExportMenuProps {
  note: EditorDraftProps['note']
  size: 'sm' | 'md'
}

type FeedbackState = 'idle' | 'saving' | 'saved' | 'error'

export function ExportMenu({ note, size }: ExportMenuProps) {
  const [mdState,   setMdState]   = useState<FeedbackState>('idle')
  const [htmlState, setHtmlState] = useState<FeedbackState>('idle')

  const iconSize = size === 'sm' ? 13 : 14
  const cls = size === 'sm'
    ? 'flex w-full items-center gap-2.5 px-3 py-2 text-xs text-text2 hover:bg-surface2 hover:text-text transition-colors disabled:opacity-50'
    : 'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text2 hover:bg-surface2 hover:text-text transition-colors disabled:opacity-50'

  const runExport = async (
    fn: () => Promise<'saved' | 'cancelled'>,
    setState: (s: FeedbackState) => void,
  ) => {
    setState('saving')
    try {
      const res = await fn()
      setState(res === 'saved' ? 'saved' : 'idle')
      if (res === 'saved') setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label = (state: FeedbackState, idle: string) => {
    if (state === 'saving') return 'Saving…'
    if (state === 'saved')  return '✓ Exported'
    if (state === 'error')  return '✗ Failed'
    return idle
  }

  return (
    <div className="w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
      <button
        type="button"
        disabled={mdState === 'saving'}
        className={`${cls} ${mdState === 'saved' ? 'text-emerald-500' : ''} ${mdState === 'error' ? 'text-red-500' : ''}`}
        onClick={() => void runExport(() => exportNoteAsMarkdown(note), setMdState)}
      >
        <Icon
          name={mdState === 'saving' ? 'loader-2' : 'file-text'}
          size={iconSize}
          className={`shrink-0 text-text3 ${mdState === 'saving' ? 'animate-spin' : ''}`}
        />
        {label(mdState, 'Markdown (.md)')}
      </button>

      <button
        type="button"
        disabled={htmlState === 'saving'}
        className={`${cls} ${htmlState === 'saved' ? 'text-emerald-500' : ''} ${htmlState === 'error' ? 'text-red-500' : ''}`}
        onClick={() => void runExport(() => exportNoteAsHTML(note), setHtmlState)}
      >
        <Icon
          name={htmlState === 'saving' ? 'loader-2' : 'globe'}
          size={iconSize}
          className={`shrink-0 text-text3 ${htmlState === 'saving' ? 'animate-spin' : ''}`}
        />
        {label(htmlState, 'HTML (.html)')}
      </button>
    </div>
  )
}
