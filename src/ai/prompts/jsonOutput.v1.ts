/**
 * Prompts for structured output. Versioned: change wording in a new file
 * (jsonOutput.v2.ts) and switch the import, so eval runs stay comparable.
 */
import type { JSONSchema, ToolDef } from '../../types'

export const JSON_OUTPUT_PROMPT_VERSION = 'jsonOutput.v1'

/** Appended to the system prompt whenever JSON output is requested. */
export function jsonInstruction(schema: JSONSchema): string {
  return [
    'Respond with a single JSON value that matches this JSON Schema.',
    'Output only the JSON — no prose, no code fences.',
    '',
    JSON.stringify(schema),
  ].join('\n')
}

/** Sent as a user turn after output failed validation (one retry, per PRD). */
export function jsonRetryMessage(errors: string[]): string {
  return [
    'Your previous output was not valid for the schema:',
    ...errors.slice(0, 10).map((e) => `- ${e}`),
    'Respond again with corrected JSON only.',
  ].join('\n')
}

/** Schema-in-prompt tool calling for servers without native tools. */
export function toolFallbackInstruction(tools: ToolDef[]): string {
  const catalog = tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))
  return [
    'You can call these tools. Decide which calls (if any) answer the request.',
    'Respond with JSON: {"tool_calls":[{"name":"<tool name>","arguments":{...}}]}.',
    'Use an empty list when no tool applies. Output only the JSON.',
    '',
    JSON.stringify(catalog),
  ].join('\n')
}
