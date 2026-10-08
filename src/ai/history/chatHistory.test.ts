import { describe, it, expect } from 'vitest'
import { bubbleChatRecord, bubbleChatTitle } from './chatHistory'
import type { BubbleMessage } from '../../types'

const at = '2026-10-08T09:00:00Z'
const msg = (m: Omit<BubbleMessage, 'id' | 'createdAt'>, id: string): BubbleMessage => ({ id, createdAt: at, ...m })

describe('bubbleChatRecord', () => {
  const base = {
    id: 's1',
    source: { kind: 'note' as const, id: 'n1', title: 'Meeting notes 12 Oct' },
    provider: { id: 'p', name: 'Ollama', model: 'qwen3:4b', location: 'self-hosted' as const },
    createdAt: at,
    now: '2026-10-08T09:05:00Z',
  }

  it('labels the chat with its source page and keeps the page id', () => {
    const rec = bubbleChatRecord({
      ...base,
      messages: [
        msg({ role: 'user', content: 'Tighten' }, 'a'),
        msg({ role: 'assistant', content: 'Short.', action: 'rewrite', suggestion: { kind: 'replace', style: 'shorter', original: 'Long.', originalText: 'Long.', proposed: 'Short.', state: 'accepted' } }, 'b'),
        msg({ role: 'notice', content: 'Stopped.' }, 'c'),
        msg({ role: 'error', content: 'boom' }, 'd'),
      ],
    })
    expect(rec).toMatchObject({
      title: 'Bubble · Meeting notes 12 Oct',
      surface: 'bubble',
      source: { kind: 'note', id: 'n1' },
      attachedChatIds: [],
      updatedAt: '2026-10-08T09:05:00Z',
    })
    expect(rec!.messages).toEqual([
      { role: 'user', content: 'Tighten', createdAt: at },
      { role: 'assistant', content: 'Short.', createdAt: at, action: 'rewrite', outcome: 'accepted' },
    ])
  })

  it('records title and tag options with what was applied', () => {
    const rec = bubbleChatRecord({
      ...base,
      messages: [
        msg({ role: 'user', content: 'Suggest tags' }, 'a'),
        msg({ role: 'assistant', content: 'Tag ideas:', action: 'suggest_tags', suggestion: { kind: 'tags', options: ['release', 'beta'], applied: ['beta'] } }, 'b'),
      ],
    })
    expect(rec!.messages[1]).toMatchObject({ content: 'Tag ideas: release · beta', outcome: 'added: beta' })
  })

  it('saves nothing when the user never asked anything', () => {
    expect(bubbleChatRecord({ ...base, messages: [] })).toBeNull()
    expect(bubbleChatTitle('  ')).toBe('Bubble · Untitled')
  })
})
