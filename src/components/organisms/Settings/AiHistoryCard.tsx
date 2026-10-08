import { useAiStore } from '../../../store/useAiStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { clearChats, sweepChats } from '../../../ai/history/chatStore'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { Select, type SelectOption } from '../../atoms/Select'
import type { ChatRetention } from '../../../types'

const OPTIONS: SelectOption<ChatRetention>[] = [
  { value: 'keep', label: 'Keep' },
  { value: '30d', label: '30 days' },
  { value: 'never', label: 'Never save' },
]

/** Settings → AI → Chat history: retention (keep / 30 days / never) and Clear all. */
export function AiHistoryCard() {
  const retention = useAiStore((s) => s.chatRetention)
  const setRetention = useAiStore((s) => s.setChatRetention)
  const confirm = useConfirmStore((s) => s.confirm)

  async function change(next: ChatRetention) {
    if (next !== 'keep') {
      const ok = await confirm({
        title: next === 'never' ? 'Stop saving chats?' : 'Keep chats for 30 days?',
        message: next === 'never' ? 'Saved conversations are deleted now, and new ones are not saved.' : 'Conversations not touched in 30 days are deleted now and from then on.',
        confirmLabel: 'Continue',
        danger: next === 'never',
      })
      if (!ok) return
    }
    setRetention(next)
    await sweepChats(next)
  }

  async function clearAll() {
    const ok = await confirm({ title: 'Delete all AI conversations?', message: 'Global chats and saved bubble conversations are removed from this device. Notes and cards are not affected.', confirmLabel: 'Delete all', danger: true })
    if (ok) await clearChats()
  }

  return (
    <SectionCard title="Chat history">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-text">Keep conversations</p>
            <p className="text-[11px] text-text3">Stored on this device only, never synced.</p>
          </div>
          <Select value={retention} options={OPTIONS} onChange={(v) => void change(v)} />
        </div>
        <Button variant="hollow" size="sm" onClick={() => void clearAll()}>Clear all</Button>
      </div>
    </SectionCard>
  )
}
