import { DEFAULT_POSITION } from 'chess.js'
import { StockfishEngine } from './stockfish'

export const smokeDepth = 10

export class SmokeTestError extends Error {
  constructor(readonly reason: 'failed' | 'timeout' | 'noMove') {
    super(reason)
  }
}

export async function runSmokeTest(signal: AbortSignal): Promise<string> {
  const engine = new StockfishEngine()
  try {
    const { bestMove, ponder } = await engine.analyze(DEFAULT_POSITION, {
      depth: smokeDepth,
      signal,
    })
    if (!bestMove) throw new SmokeTestError('noMove')
    return `bestmove ${bestMove}${ponder ? ` ponder ${ponder}` : ''}`
  } finally {
    engine.destroy()
  }
}
