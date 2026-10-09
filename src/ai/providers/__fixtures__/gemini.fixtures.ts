/**
 * Gemini API responses, shaped as documented on ai.google.dev/api
 * (generateContent, streamGenerateContent?alt=sse, batchEmbedContents,
 * models.list), Oct 2026.
 */
import { sse } from './transport'

const chunk = (parts: unknown[], usage?: Record<string, number>, finishReason?: string) => ({
  candidates: [{ content: { role: 'model', parts }, ...(finishReason ? { finishReason } : {}), index: 0 }],
  ...(usage ? { usageMetadata: usage } : {}),
})

export const textStream = sse([
  { data: chunk([{ text: 'Thinking about it', thought: true }], { promptTokenCount: 30, candidatesTokenCount: 0, thoughtsTokenCount: 4 }) },
  { data: chunk([{ text: 'Hel' }], { promptTokenCount: 30, candidatesTokenCount: 1, thoughtsTokenCount: 4 }) },
  { data: chunk([{ text: 'lo!' }], { promptTokenCount: 30, candidatesTokenCount: 3, thoughtsTokenCount: 4 }, 'STOP') },
])

export const functionCallResponse = JSON.stringify(chunk(
  [{ functionCall: { name: 'move_card', args: { cardId: 'KAI-4', toColumn: 'Done' } } }, { functionCall: { id: 'fc_2', name: 'move_card', args: { cardId: 'KAI-2', toColumn: 'Done' } } }],
  { promptTokenCount: 800, candidatesTokenCount: 40 }, 'STOP',
))

export const jsonResponse = JSON.stringify(chunk([{ text: '{"intent":"question"}' }], { promptTokenCount: 50, candidatesTokenCount: 6 }, 'STOP'))
export const okResponse = JSON.stringify(chunk([{ text: 'OK' }], { promptTokenCount: 5, candidatesTokenCount: 1 }, 'STOP'))

export const blockedPrompt = JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: { promptTokenCount: 12 } })

export const thinkingRejected = JSON.stringify({ error: { code: 400, message: 'Thinking budget is not supported for this model.', status: 'INVALID_ARGUMENT' } })
export const quotaExceeded = JSON.stringify({ error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' } })

export const models = JSON.stringify({
  models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-embedding-001', displayName: 'Gemini Embedding', supportedGenerationMethods: ['embedContent'] },
  ],
})

export function embeddings(n: number, dims = 3): string {
  return JSON.stringify({ embeddings: Array.from({ length: n }, (_, i) => ({ values: Array.from({ length: dims }, (_, d) => i + d / 10) })) })
}
