import { validateJSON } from '../json/validate'
import type { JSONSchema, ToolCall, ToolDef } from '../../types'

/** The model never sees more than this many tools in one call (PRD). */
export const MAX_TOOLS_PER_CALL = 10

export interface RawToolCall {
  id: string
  name: string
  /** JSON string (native tool calling) or already-parsed value (JSON fallback). */
  arguments: unknown
}

/** Checks names and argument schemas; returns parsed calls or the errors to feed back. */
export function validateToolCalls(raw: RawToolCall[], tools: ToolDef[]): { calls: ToolCall[]; errors: string[] } {
  const byName = new Map(tools.map((t) => [t.name, t]))
  const calls: ToolCall[] = []
  const errors: string[] = []
  raw.forEach((call, i) => {
    const tool = byName.get(call.name)
    if (!tool) {
      errors.push(`call ${i + 1}: unknown tool "${call.name}" (allowed: ${tools.map((t) => t.name).join(', ')})`)
      return
    }
    let args: unknown = call.arguments
    if (typeof args === 'string') {
      try { args = args.trim() === '' ? {} : JSON.parse(args) } catch {
        errors.push(`call ${i + 1} (${call.name}): arguments are not valid JSON`)
        return
      }
    }
    const result = validateJSON(args, tool.parameters)
    if (!result.ok) {
      errors.push(...result.errors.map((e) => `call ${i + 1} (${call.name}): ${e}`))
      return
    }
    calls.push({ id: call.id, name: call.name, args: args as Record<string, unknown> })
  })
  return { calls, errors }
}

/** Schema for the JSON-fallback form: {"tool_calls":[{"name","arguments"}]}. */
export function toolFallbackSchema(tools: ToolDef[]): JSONSchema {
  return {
    type: 'object',
    properties: {
      tool_calls: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: tools.map((t) => t.name) },
            arguments: { type: 'object' },
          },
          required: ['name', 'arguments'],
        },
      },
    },
    required: ['tool_calls'],
  }
}
