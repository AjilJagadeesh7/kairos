/**
 * JSON Schema → llama.cpp GBNF grammar, for the subset our prompts use
 * (objects, arrays, strings, numbers, integers, booleans, null, enums).
 * The on-device runtime decodes under this grammar, so its JSON is valid by
 * construction (PRD); length bounds are left to the validator that runs
 * afterwards.
 */
import type { JSONSchema } from '../../types'

const PRIMITIVES = [
  'ws ::= [ \\t\\n]{0,20}',
  'string ::= "\\"" ( [^"\\\\\\x7F\\x00-\\x1F] | "\\\\" ( ["\\\\/bfnrt] | "u" [0-9a-fA-F]{4} ) )* "\\"" ws',
  'number ::= "-"? ( [0-9] | [1-9] [0-9]{0,15} ) ( "." [0-9]+ )? ( [eE] [-+]? [0-9]+ )? ws',
  'integer ::= "-"? ( [0-9] | [1-9] [0-9]{0,15} ) ws',
  'boolean ::= ( "true" | "false" ) ws',
  'null ::= "null" ws',
  // Any JSON value, for schemas that leave a part open (e.g. tool arguments in the fallback).
  'value ::= object | array | string | number | boolean | null',
  'object ::= "{" ws ( string ":" ws value ( "," ws string ":" ws value )* )? "}" ws',
  'array ::= "[" ws ( value ( "," ws value )* )? "]" ws',
]

/** A GBNF string literal for exact text. */
function lit(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

export function schemaToGbnf(schema: JSONSchema): string {
  const rules = new Map<string, string>()
  let n = 0
  const fresh = (hint: string) => `${hint.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'r'}-${n++}`

  function rule(s: JSONSchema, hint: string): string {
    if (s.enum?.length) {
      const name = fresh(`${hint}-enum`)
      rules.set(name, `( ${s.enum.map((v) => lit(JSON.stringify(v))).join(' | ')} ) ws`)
      return name
    }
    switch (s.type) {
      case 'string': return 'string'
      case 'number': return 'number'
      case 'integer': return 'integer'
      case 'boolean': return 'boolean'
      case 'null': return 'null'
      case 'array': {
        if (!s.items) return 'array'
        const item = rule(s.items, `${hint}-item`)
        const min = Math.max(0, s.minItems ?? 0)
        const max = s.maxItems
        const name = fresh(`${hint}-arr`)
        const more = max === undefined ? `( "," ws ${item} )*` : `( "," ws ${item} ){${Math.max(0, min - 1)},${Math.max(0, max - 1)}}`
        const body = `${item} ${min > 1 && max === undefined ? `( "," ws ${item} ){${min - 1}} ` : ''}${more}`
        rules.set(name, `"[" ws ${min > 0 ? body : `( ${body} )?`} "]" ws`)
        return name
      }
      case 'object':
      default: {
        const props = Object.entries(s.properties ?? {})
        if (!props.length) return 'object'
        const required = new Set(s.required ?? [])
        const kv = (k: string, v: JSONSchema) => `${lit(JSON.stringify(k))} ws ":" ws ${rule(v, `${hint}-${k}`)}`
        const req = props.filter(([k]) => required.has(k)).map(([k, v]) => kv(k, v))
        const opt = props.filter(([k]) => !required.has(k)).map(([k, v]) => kv(k, v))
        const name = fresh(`${hint}-obj`)
        let inner: string
        if (req.length) {
          inner = [req.join(' "," ws '), ...opt.map((o) => `( "," ws ${o} )?`)].join(' ')
        } else {
          // No required keys: any optional one may come first, the later ones each optional after it.
          const alts = opt.map((o, i) => [o, ...opt.slice(i + 1).map((p) => `( "," ws ${p} )?`)].join(' '))
          inner = `( ${alts.map((a) => `( ${a} )`).join(' | ')} )?`
        }
        rules.set(name, `"{" ws ${inner} "}" ws`)
        return name
      }
    }
  }

  const root = rule(schema, 'root')
  return [`root ::= ws ${root}`, ...[...rules].map(([k, v]) => `${k} ::= ${v}`), ...PRIMITIVES].join('\n')
}
