import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { REWRITE_STYLES } from '../../../../ai/prompts/noteBubble.v1'
import type { IconToken } from '../../../../icons/tokens'
import type { RewriteStyle } from '../../../../types'

interface Props {
  disabled: boolean
  onSummarize: () => void
  onContinue: () => void
  onTitle: () => void
  onTags: () => void
  onTasks: () => void
  onRewrite: (style: RewriteStyle) => void
}

const STYLES = Object.keys(REWRITE_STYLES) as RewriteStyle[]

/** Keeps the editor's selection: a mousedown on these must not move focus. */
const keepSelection = (e: React.MouseEvent) => e.preventDefault()

function Action({ icon, label, onClick, disabled }: { icon?: IconToken; label: string; onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="hollow" size="xs" disabled={disabled} onMouseDown={keepSelection} onClick={onClick}>
      {icon && <Icon name={icon} size={12} />}
      {label}
    </Button>
  )
}

export function BubbleQuickActions({ disabled, onSummarize, onContinue, onTitle, onTags, onTasks, onRewrite }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        <Action icon="scroll-text" label="Summarize" onClick={onSummarize} disabled={disabled} />
        <Action icon="pen-line" label="Continue" onClick={onContinue} disabled={disabled} />
        <Action icon="type" label="Title" onClick={onTitle} disabled={disabled} />
        <Action icon="tag" label="Tags" onClick={onTags} disabled={disabled} />
        <Action icon="check-square" label="Tasks" onClick={onTasks} disabled={disabled} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wider text-text3">Selection</span>
        {STYLES.map((s) => (
          <Action key={s} label={REWRITE_STYLES[s].label} onClick={() => onRewrite(s)} disabled={disabled} />
        ))}
      </div>
    </div>
  )
}
