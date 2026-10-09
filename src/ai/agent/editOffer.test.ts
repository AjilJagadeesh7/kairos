import { describe, expect, it } from 'vitest'
import { OFFER_MARKER, decideOffer, isAffirmative, isRefusal, looksLikeChange } from './editOffer'
import { runNoteInstruction } from './noteAgent'
import { fakeBridge, fakeEnv, fakeProvider } from './__fixtures__/fakes'

const NOTE = '# Money\n\n- Clear CC debt by Dec\n- Build an emergency fund'

describe('edit offer detection', () => {
  it('tells change requests from questions', () => {
    for (const s of ['can you improve the format, make it more simple', 'clean this up', 'turn it into a table', 'please fix the typos', 'make it shorter'])
      expect(looksLikeChange(s), s).toBe(true)
    for (const s of ['what can you tell me about this', 'how do I fix my budget?', 'explain the second point', 'when is the deadline'])
      expect(looksLikeChange(s), s).toBe(false)
  })

  it('spots refusals to edit', () => {
    expect(isRefusal('I don\'t have access to the note\'s formatting or a way to change it.')).toBe(true)
    expect(isRefusal('I can\'t edit the note directly.')).toBe(true)
    expect(isRefusal('I am unable to modify files.')).toBe(true)
    expect(isRefusal('You can\'t go wrong with an index fund.')).toBe(false)
  })

  it('accepts a short yes', () => {
    for (const s of ['yes', 'Yes please', 'ok', 'go ahead!', 'do it', 'sure, thanks']) expect(isAffirmative(s), s).toBe(true)
    for (const s of ['yes but only the first list', 'no', 'what would you change?']) expect(isAffirmative(s), s).toBe(false)
  })

  it('decides: nothing, offer, or edit straight away when allowed', () => {
    expect(decideOffer('when is it due?', 'Friday.', false)).toEqual({ kind: 'none', content: 'Friday.' })
    expect(decideOffer('make it simpler', `I'd shorten each bullet.\n${OFFER_MARKER}`, false)).toEqual({ kind: 'offer', content: 'I\'d shorten each bullet.' })
    expect(decideOffer('improve the format', 'I don\'t have access to change it.', false)).toEqual({ kind: 'offer', content: 'I can make that change in the note.' })
    expect(decideOffer('improve the format', 'I don\'t have access to change it.', true).kind).toBe('edit')
  })

  it('never skips the offer on the model\'s word alone', () => {
    // A marker (which note text could provoke) on a plain question still only offers.
    expect(decideOffer('what is this about?', `Money goals.\n${OFFER_MARKER}`, true)).toEqual({ kind: 'offer', content: 'Money goals.' })
  })
})

describe('bubble: answer → offer → edit', () => {
  it('turns a refusal to a change request into an edit offer, and edits nothing yet', async () => {
    const { bridge, state } = fakeBridge()
    const { provider, calls } = fakeProvider({ tools: () => [], generate: () => 'I don\'t have access to the note\'s formatting or a way to change it.' })
    const { env, messages } = fakeEnv(provider, { content: NOTE }, { bridge })
    await runNoteInstruction(env, 'can you improve the format, make it more simple')
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('I can make that change in the note.')
    expect(messages[0].editOffer).toEqual({ instruction: 'can you improve the format, make it more simple', target: 'note', state: 'pending' })
    expect(state.preview).toBeNull()
    // The question prompt tells the model it may offer edits, instead of "answer only".
    expect(JSON.stringify(calls[1].messages)).toContain(OFFER_MARKER)
  })

  it('with "always allow", goes straight to a previewed edit that still needs Accept', async () => {
    const { bridge, state } = fakeBridge()
    let n = 0
    const { provider } = fakeProvider({
      tools: () => [],
      generate: () => (n++ === 0 ? `I'll turn the list into short headings.\n${OFFER_MARKER}` : '## Debt\nClear CC by Dec\n\n## Savings\nEmergency fund'),
    })
    const { env, messages } = fakeEnv(provider, { content: NOTE }, { bridge })
    env.editsAllowed = () => true
    await runNoteInstruction(env, 'improve the format')
    expect(messages[0]).toMatchObject({ content: 'I\'ll turn the list into short headings.', editOffer: { state: 'granted' } })
    expect(messages[1].suggestion).toMatchObject({ kind: 'replace', instruction: 'improve the format', state: 'pending' })
    expect(state.preview?.proposed).toContain('## Savings')
    expect(state.applied).toEqual([])
  })

  it('leaves plain answers alone', async () => {
    const { provider } = fakeProvider({ tools: () => [], generate: () => 'Four money goals, led by clearing card debt.' })
    const { env, messages } = fakeEnv(provider, { content: NOTE })
    await runNoteInstruction(env, 'what can you tell me about this')
    expect(messages[0].editOffer).toBeUndefined()
  })
})
