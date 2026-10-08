/**
 * Response fixtures in the shape OpenAI-compatible servers send (Ollama
 * /v1/chat/completions, OpenAI). Written from the documented wire format,
 * not captured from a live server — replace with real captures when available.
 */

const chunk = (content: string) =>
  `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`

export const STREAM_HELLO =
  chunk('Hel') +
  chunk('lo, ') +
  ': keep-alive\n\n' +
  chunk('wörld') +
  `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n` +
  `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 } })}\n\n` +
  'data: [DONE]\n\n'

export function completion(content: string | null, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'c2',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 40, completion_tokens: 9, total_tokens: 49 },
  })
}

export const TOOL_CALL_NATIVE = completion(null, {
  tool_calls: [{
    id: 'call_abc',
    type: 'function',
    function: { name: 'move_card', arguments: '{"cardId":"KAI-4","toColumn":"Done"}' },
  }],
})

/** Ollama sends tool arguments as an object, not a string. */
export const TOOL_CALL_OBJECT_ARGS = completion('', {
  tool_calls: [{ function: { name: 'move_card', arguments: { cardId: 'KAI-4', toColumn: 'Done' } } }],
})

export const MODELS = JSON.stringify({
  object: 'list',
  data: [{ id: 'qwen3:4b', object: 'model' }, { id: 'llama3.2:3b', object: 'model' }],
})

export const ERR_TOOLS_UNSUPPORTED = JSON.stringify({
  error: { message: 'registry.ollama.ai/library/gemma2:2b does not support tools', type: 'api_error' },
})

export const ERR_MAX_TOKENS = JSON.stringify({
  error: {
    message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    type: 'invalid_request_error', param: 'max_tokens', code: 'unsupported_parameter',
  },
})

export const ERR_BAD_KEY = JSON.stringify({
  error: { message: 'Incorrect API key provided', type: 'invalid_request_error', code: 'invalid_api_key' },
})

export const ERR_QUOTA = JSON.stringify({
  error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' },
})
