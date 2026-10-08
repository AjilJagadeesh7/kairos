/**
 * P0 acceptance check: `generateJSON` must return schema-valid output for a
 * test schema 20/20 times. Runs from the debug chat against the selected
 * provider, so it can be measured on desktop and on a phone.
 */
import { ProviderError } from '../providers/errors'
import type { JSONSchema, LLMProvider } from '../../types'

export const JSON_CHECK_RUNS = 20

export const JSON_CHECK_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 120 },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    estimateHours: { type: 'number', minimum: 0, maximum: 200 },
  },
  required: ['title', 'priority', 'tags', 'estimateHours'],
  additionalProperties: false,
}

const PROMPT = 'Turn this into a task: "Ship the Android build before the Friday demo — it is urgent, ' +
  'probably about six hours of work. Tag it release and mobile."'

export interface JsonCheckResult {
  passed: number
  failed: number
  errors: string[]
}

export async function runJsonCheck(
  provider: LLMProvider,
  onProgress: (r: JsonCheckResult) => void,
  shouldStop: () => boolean,
): Promise<JsonCheckResult> {
  const result: JsonCheckResult = { passed: 0, failed: 0, errors: [] }
  for (let i = 0; i < JSON_CHECK_RUNS && !shouldStop(); i++) {
    try {
      await provider.generateJSON([{ role: 'user', content: PROMPT }], JSON_CHECK_SCHEMA, {
        maxTokens: 300, temperature: 0.7, thinking: false,
      })
      result.passed++
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'aborted') break
      result.failed++
      result.errors.push(err instanceof Error ? err.message : String(err))
    }
    onProgress({ ...result, errors: [...result.errors] })
  }
  return result
}
