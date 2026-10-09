/**
 * Anthropic Messages API responses, shaped as documented on
 * platform.claude.com/docs (messages, streaming, models), Oct 2026.
 */
import { sse } from './transport'

export const textStream = sse([
  { event: 'message_start', data: { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [], model: 'claude-sonnet-5-5', stop_reason: null, stop_sequence: null, usage: { input_tokens: 25, output_tokens: 1 } } } },
  { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } } },
  { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Let me think.' } } },
  { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
  { event: 'content_block_start', data: { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } } },
  { event: 'ping', data: { type: 'ping' } },
  { event: 'content_block_delta', data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Hello' } } },
  { event: 'content_block_delta', data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '!' } } },
  { event: 'content_block_stop', data: { type: 'content_block_stop', index: 1 } },
  { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 15 } } },
  { event: 'message_stop', data: { type: 'message_stop' } },
])

export const errorStream = sse([
  { event: 'message_start', data: { type: 'message_start', message: { usage: { input_tokens: 5, output_tokens: 1 } } } },
  { event: 'error', data: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } },
])

export const toolUseMessage = JSON.stringify({
  id: 'msg_2', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
  content: [
    { type: 'text', text: 'Moving the card.' },
    { type: 'tool_use', id: 'toolu_01', name: 'move_card', input: { cardId: 'KAI-4', toColumn: 'Done' } },
  ],
  stop_reason: 'tool_use', stop_sequence: null,
  usage: { input_tokens: 900, output_tokens: 60 },
})

export const jsonMessage = JSON.stringify({
  id: 'msg_3', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
  content: [{ type: 'text', text: '{"intent":"summarize"}' }],
  stop_reason: 'end_turn', usage: { input_tokens: 40, output_tokens: 8 },
})

export const okMessage = JSON.stringify({
  id: 'msg_4', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 1 },
})

export const temperatureRejected = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'temperature: not supported for this model' } })
export const authError = JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
export const overloaded = JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })

export const models = JSON.stringify({
  data: [{ type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' }, { type: 'model', id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }],
  has_more: false, first_id: 'claude-opus-5-5', last_id: 'claude-sonnet-5-5',
})
