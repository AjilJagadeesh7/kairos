/**
 * Incremental Server-Sent Events parser. Chunks may split lines and events
 * anywhere; yields the `data` payload of each complete event.
 */
export async function* parseSSE(chunks: AsyncIterable<string>): AsyncIterable<string> {
  let buffer = ''
  let data: string[] = []

  function* drainLines(final: boolean): Generator<string> {
    for (;;) {
      const nl = buffer.search(/\r\n|\r|\n/)
      if (nl === -1) {
        if (!final || buffer === '') return
        // A trailing line with no newline at EOF.
        yield* handleLine(buffer)
        buffer = ''
        return
      }
      const line = buffer.slice(0, nl)
      // A lone '\r' at the end of the buffer may be half of '\r\n' — wait for more.
      if (!final && buffer[nl] === '\r' && nl === buffer.length - 1) return
      const sepLen = buffer.startsWith('\r\n', nl) ? 2 : 1
      buffer = buffer.slice(nl + sepLen)
      yield* handleLine(line)
    }
  }

  function* handleLine(line: string): Generator<string> {
    if (line === '') {
      if (data.length > 0) yield data.join('\n')
      data = []
      return
    }
    if (line.startsWith(':')) return // comment / keep-alive
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') data.push(value)
  }

  for await (const chunk of chunks) {
    buffer += chunk
    yield* drainLines(false)
  }
  yield* drainLines(true)
  if (data.length > 0) yield data.join('\n')
}
