import type { Color } from 'chess.js'
import type { UciScore } from '../engine/uci'

export const reviewDepths = [12, 16, 18, 20] as const
export type ReviewDepth = (typeof reviewDepths)[number]

export type ReviewScore = UciScore & { winner?: Color }

export type ImportedGame = {
  pgn: string
  username?: string
  headers: Partial<
    Record<
      'White' | 'Black' | 'Result' | 'Date' | 'ECO' | 'TimeControl' | 'Opening',
      string
    >
  >
}

export type ReviewPosition = {
  fen: string
  turn: Color
  move?: { uci: string; san: string; number: number; color: Color }
  terminal?: ReviewScore
}

export type AnalysisLine = {
  rank: number
  depth: number
  score: ReviewScore
  moves: { uci: string; san: string }[]
}

export type PositionEval = { lines: AnalysisLine[]; score: ReviewScore | null }

export type GameReview = {
  game: ImportedGame
  depth: ReviewDepth
  positions: ReviewPosition[]
  evaluations: PositionEval[]
}
