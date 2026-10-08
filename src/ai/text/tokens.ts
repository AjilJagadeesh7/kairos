/**
 * Token estimate without a tokenizer. Deliberately pessimistic (3.5 chars per
 * token for Latin text, one token per CJK character) so prompts built from it
 * stay inside the budget on every provider.
 */
const CHARS_PER_TOKEN = 3.5

export function estimateTokens(text: string): number {
  let wide = 0
  for (const ch of text) {
    if (ch.codePointAt(0)! >= 0x2e80) wide++
  }
  return Math.ceil((text.length - wide) / CHARS_PER_TOKEN + wide)
}

/** Roughly how many characters fit in `tokens` (inverse of the estimate, Latin text). */
export function charsForTokens(tokens: number): number {
  return Math.floor(tokens * CHARS_PER_TOKEN)
}
