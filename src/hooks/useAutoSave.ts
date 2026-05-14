import { useCallback, useEffect, useState } from 'react'
import type { SaveStatus } from '../types'

type AutoSaveOptions = {
  title: string
  content: string
  noteTitle: string   // initial title to compare against
  noteContent: string // initial content to compare against
  onSave: () => Promise<void>
  debounceMs?: number
}

export function useAutoSave({
  title, content, noteTitle, noteContent, onSave, debounceMs = 2000,
}: AutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const triggerSave = useCallback(async () => {
    setSaveStatus('saving')
    await onSave()
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
  }, [onSave])

  useEffect(() => {
    if (title === noteTitle && content === noteContent) return
    setSaveStatus('dirty')
    const handle = window.setTimeout(() => void triggerSave(), debounceMs)
    return () => window.clearTimeout(handle)
  }, [title, content]) // eslint-disable-line react-hooks/exhaustive-deps

  return { saveStatus, setSaveStatus, triggerSave }
}
