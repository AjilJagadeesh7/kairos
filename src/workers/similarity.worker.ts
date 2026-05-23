// Cosine similarity worker — runs the O(n²) pair computation off the main thread

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na  += a[i] * a[i]
    nb  += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

self.onmessage = (e: MessageEvent<{
  embeddings: Array<{ id: string; data: number[] }>
  threshold: number
}>) => {
  const { embeddings, threshold } = e.data
  const pairs: Array<{ source: string; target: string }> = []

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      if (cosine(embeddings[i].data, embeddings[j].data) > threshold) {
        pairs.push({ source: embeddings[i].id, target: embeddings[j].id })
      }
    }
  }

  self.postMessage({ pairs })
}
