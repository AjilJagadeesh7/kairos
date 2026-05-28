
import { useState } from 'react'
import { SectionCard } from '../../molecules/SectionCard'
import { logger } from '../../../logger/logger'
import { Icon } from '../../../icons/Icon'

export function LogsSection() {
  const [copied, setCopied] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const entries = logger.getEntries()
  const errorCount = entries.filter(e => e.level === 'error').length
  const warnCount  = entries.filter(e => e.level === 'warn').length

  function handleCopy() {
    const text = logger.getFormatted() || '(no entries)'
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleClear() {
    logger.clear()
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Diagnostic Log">
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[rgb(var(--text-3))]">
            Errors and warnings are logged locally on your device only — nothing is sent anywhere.
            Copy the log to attach it to a{' '}
            <a
              href="https://github.com/AjilJagadeesh7/kairos/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[rgb(var(--accent))] hover:underline"
            >
              GitHub issue
            </a>.
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2">
            <Icon name="scroll-text" size={13} className="shrink-0 text-[rgb(var(--text-3))]" />
            <span className="flex-1 text-xs text-[rgb(var(--text-2))]">
              {entries.length} entries this session
              {errorCount > 0 && (
                <span className="ml-2 text-red-400">· {errorCount} error{errorCount !== 1 ? 's' : ''}</span>
              )}
              {warnCount > 0 && (
                <span className="ml-2 text-yellow-400">· {warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
              )}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.4)] hover:text-[rgb(var(--accent))]"
            >
              <Icon name="clipboard-copy" size={12} />
              {copied ? 'Copied!' : 'Copy log'}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))]"
            >
              {expanded ? 'Hide preview' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-2))] transition hover:border-red-500/40 hover:text-red-400"
            >
              <Icon name="trash-2" size={12} />
              {cleared ? 'Cleared' : 'Clear'}
            </button>
          </div>

          {expanded && (
            <pre className="max-h-96 overflow-y-auto rounded-lg bg-[rgb(var(--surface-2))] p-3 text-[10px] leading-relaxed text-[rgb(var(--text-3))]">
              {entries.length === 0
                ? '(no entries)'
                : entries.slice(-50).map(e => JSON.stringify(e)).join('\n')}
            </pre>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
