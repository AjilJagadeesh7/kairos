/**
 * Spots vault text that talks to an AI ("ignore previous instructions",
 * "SYSTEM:", "call move_card…"). Such text is never followed — it only ever
 * reaches the model inside a data block — but a plan made after reading it
 * is flagged and starts with nothing selected, so every change needs the
 * user's own tick.
 */
const PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+|any\s+)?(?:the\s+|your\s+)?(?:previous|prior|above|earlier|other)\s+(?:instructions?|prompts?|messages?)/i,
  /\bignore\s+the\s+user\b/i,
  /\b(?:instructions?|notes?|message)\s+(?:to|for)\s+(?:the\s+|any\s+)?(?:ai|assistant|model|llm|chatbot)\b/i,
  /^\s*(?:system|assistant)\s*:/im,
  /\bnew\s+instructions\b/i,
  /\b(?:call|use|run)\s+(?:the\s+)?(?:move_card|create_card|update_card|create_note|link_notes|web_search|fetch_url)\b/i,
  /\bpre-?approved\b/i,
  /<\/?(?:vault|sources|tool_results|facts_data|board|note|earlier_conversations|web_content)>/i,
]

export function looksLikeInjection(text: string): boolean {
  return PATTERNS.some((re) => re.test(text))
}
