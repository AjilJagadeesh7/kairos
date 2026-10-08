/**
 * Wraps untrusted text (note content, selections) in a delimited block. Any
 * occurrence of the closing tag inside the text is neutralised so note content
 * can't end the block early and pose as instructions.
 */
export function dataBlock(tag: string, text: string): string {
  const safe = text.replace(new RegExp(`<(/?)(${tag})>`, 'gi'), '‹$1$2›')
  return `<${tag}>\n${safe}\n</${tag}>`
}
