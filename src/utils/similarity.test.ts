import { describe, it, expect } from 'vitest'
import { cosineSimilarity, topKSimilar } from './similarity'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 2, 3]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0]
    const b = [-1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0]
    const b = [0, 1]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('returns 0 for mismatched lengths or empty vectors', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
  })
})

describe('topKSimilar', () => {
  it('returns top k closest ids sorted by similarity score', () => {
    const query = [1, 0]
    const vectors = [
      { id: 'orthogonal', vector: [0, 1] },
      { id: 'close', vector: [0.9, 0.1] },
      { id: 'opposite', vector: [-1, 0] },
      { id: 'exact', vector: [1, 0] },
    ]
    const result = topKSimilar(query, vectors, 2)
    expect(result).toEqual(['exact', 'close'])
  })
})
