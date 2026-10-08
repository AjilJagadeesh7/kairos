/** Cleanup applied to model output before it is shown or proposed. */

/**
 * Removes `<think>…</think>` reasoning that some servers inline into the
 * content. An unclosed `<think>` (still streaming) hides everything after it.
 */
export function stripThinking(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '')
  const open = out.indexOf('<think>')
  if (open !== -1) out = out.slice(0, open)
  return out
}

const PREAMBLE = /^(?:sure[,!.]?\s*)?(?:here(?:'s| is| are)[^\n:]{0,60}:|rewritten(?: text)?:|revised(?: text)?:)\s*\n+/i

/**
 * Text the model proposes for insertion: no reasoning, no "Here is…:" preamble,
 * no wrapping code fence or quotes unless the original had them.
 */
export function cleanProposal(text: string, original = ''): string {
  let out = stripThinking(text).trim().replace(PREAMBLE, '')
  const fenced = out.match(/^```[\w-]*\n([\s\S]*?)\n```$/)
  if (fenced && !original.trimStart().startsWith('```')) out = fenced[1]
  const quoted = out.match(/^["“]([\s\S]*)["”]$/)
  if (quoted && !/^["“]/.test(original.trim())) out = quoted[1]
  return out.trim()
}
