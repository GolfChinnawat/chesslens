import { DEFAULT_POSITION } from 'chess.js'
import { afterEach, expect, it, vi } from 'vitest'
import { StockfishEngine } from '../src/engine'

class TestWorker {
  static instance: TestWorker
  onmessage?: (message: { data: string }) => void
  commands: string[] = []

  constructor() {
    TestWorker.instance = this
  }

  postMessage(command: string) {
    this.commands.push(command)
    if (command === 'uci') queueMicrotask(() => this.emit('uciok'))
    if (command === 'isready') queueMicrotask(() => this.emit('readyok'))
  }

  emit(data: string) {
    this.onmessage?.({ data })
  }

  terminate() {}
}

afterEach(() => vi.unstubAllGlobals())

it('drains a cancelled search before starting the next and protects cached results', async () => {
  vi.stubGlobal('Worker', TestWorker)
  vi.stubGlobal('document', { baseURI: 'http://localhost/' })
  const engine = new StockfishEngine()
  try {
    await engine.init()
    const worker = TestWorker.instance
    const first = engine.analyze(DEFAULT_POSITION, { depth: 10 })
    const aborted = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(worker.commands).toContain('go depth 10'))

    const second = engine.analyze(DEFAULT_POSITION, { depth: 11 })
    expect(worker.commands.at(-1)).toBe('stop')
    expect(worker.commands).not.toContain('go depth 11')

    worker.emit('bestmove e2e4')
    await aborted
    await vi.waitFor(() => expect(worker.commands).toContain('go depth 11'))
    worker.emit('info depth 11 score cp 28 pv d2d4')
    worker.emit('bestmove d2d4')
    const result = await second
    expect(result.bestMove).toBe('d2d4')
    result.lines[0].pv?.push('a7a5')

    const before = worker.commands.length
    expect(
      (await engine.analyze(DEFAULT_POSITION, { depth: 11 })).lines[0].pv,
    ).toEqual(['d2d4'])
    expect(worker.commands).toHaveLength(before)
  } finally {
    engine.destroy()
  }
})
