import type { Color } from 'chess.js'
import type { UciScore } from '../engine/uci'
import type { ReviewScore } from '../types/review'

export function normalizeScore(score: UciScore, turn: Color): ReviewScore {
  const value = score.value === 0 || turn === 'w' ? score.value : -score.value
  if (score.kind === 'cp') return { kind: 'cp', value }
  return {
    kind: 'mate',
    value,
    winner: value > 0 || (value === 0 && turn === 'b') ? 'w' : 'b',
  }
}

export function scoreForMover(score: ReviewScore, mover: Color): UciScore {
  const value =
    score.kind === 'mate' && score.value === 0 && score.winner === 'b'
      ? -0
      : score.value
  return { kind: score.kind, value: mover === 'w' ? value : -value }
}

// ±400 cp maps to about ±76%. Mates reserve the endpoints of the same scale.
export function evaluationScale(score: ReviewScore | null): number | null {
  if (!score) return null
  if (score.kind === 'mate')
    return score.winner === 'b' || score.value < 0 ? -100 : 100
  return 100 * Math.tanh(score.value / 400)
}

export function formatScore(score: ReviewScore): string {
  if (score.kind === 'mate')
    return `${score.winner === 'b' || score.value < 0 ? '−' : ''}M${Math.abs(score.value)}`
  const rounded = Math.round(score.value / 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`
}
