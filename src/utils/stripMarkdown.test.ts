import { describe, it, expect } from 'vitest'
import { stripMarkdown } from './stripMarkdown'

describe('stripMarkdown', () => {
  it('removes heading markers', () => {
    expect(stripMarkdown('# Title')).toBe('Title')
    expect(stripMarkdown('## Section')).toBe('Section')
    expect(stripMarkdown('### Deep')).toBe('Deep')
  })

  it('removes bold/italic markers', () => {
    expect(stripMarkdown('**bold** and _italic_')).toBe('bold and italic')
  })

  it('removes backticks', () => {
    expect(stripMarkdown('use `code` here')).toBe('use code here')
  })

  it('removes strikethrough', () => {
    expect(stripMarkdown('~~deleted~~')).toBe('deleted')
  })

  it('unwraps wikilinks', () => {
    expect(stripMarkdown('see [[My Note]] for details')).toBe('see My Note for details')
  })

  it('collapses multiple newlines into a space', () => {
    expect(stripMarkdown('line one\n\nline two')).toBe('line one line two')
  })

  it('trims leading and trailing whitespace', () => {
    expect(stripMarkdown('  hello  ')).toBe('hello')
  })

  it('returns empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('')
  })

  it('leaves plain text unchanged', () => {
    expect(stripMarkdown('just plain text')).toBe('just plain text')
  })
})
