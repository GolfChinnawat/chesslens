import { Chess, type Color } from 'chess.js'
import type { StockfishEngine } from '../engine'
import type { UciInfo } from '../engine/uci'
import { normalizeScore } from './score'
import { buildPositions } from './pgn'
import type {
  AnalysisLine,
  GameReview,
  ImportedGame,
  PositionEval,
  ReviewDepth,
} from '../types/review'

export function decodeEvaluation(
  fen: string,
  turn: Color,
  entries: UciInfo[],
): PositionEval {
  const lines = entries.flatMap((line): AnalysisLine[] => {
    if (!line.pv?.length || !line.score || line.depth === undefined) return []
    const variation = new Chess(fen)
    const moves: AnalysisLine['moves'] = []
    for (const uci of line.pv) {
      try {
        moves.push({ uci, san: variation.move(uci).san })
      } catch {
        break
      }
    }
    return moves.length
      ? [
          {
            rank: line.multipv ?? 1,
            depth: line.depth,
            score: normalizeScore(line.score, turn),
            moves,
          },
        ]
      : []
  })
  return { lines, score: lines[0]?.score ?? null }
}

export async function analyzeGame(
  engine: Pick<StockfishEngine, 'analyze'>,
  game: ImportedGame,
  depth: ReviewDepth,
  signal: AbortSignal,
  onProgress: (done: number, total: number, seconds: number) => void,
  options: { multiPV?: number; onPartial?: (review: GameReview) => void } = {},
): Promise<GameReview> {
  const positions = buildPositions(game.pgn)
  const evaluations: GameReview['evaluations'] = []
  const history: string[] = []
  const start = performance.now()
  onProgress(0, positions.length, 0)
  for (const position of positions) {
    signal.throwIfAborted()
    if (position.move) history.push(position.move.uci)
    if (position.terminal) {
      evaluations.push({ lines: [], score: position.terminal })
    } else {
      const response = await engine.analyze(positions[0].fen, {
        depth,
        multiPV: options.multiPV ?? 3,
        signal,
        moves: [...history],
      })
      signal.throwIfAborted()
      const evaluation = decodeEvaluation(
        position.fen,
        position.turn,
        response.lines,
      )
      if (!evaluation.lines.length)
        throw new Error('Stockfish returned no scored lines')
      evaluations.push(evaluation)
    }
    const done = evaluations.length
    const seconds =
      ((performance.now() - start) / 1000 / done) * (positions.length - done)
    onProgress(done, positions.length, seconds)
    if (options.onPartial && done < positions.length)
      options.onPartial({
        game,
        depth,
        positions: positions.slice(0, done),
        evaluations: [...evaluations],
      })
  }
  return { game, depth, positions, evaluations }
}
