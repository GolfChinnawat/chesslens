import { Chess, DEFAULT_POSITION, type Color } from 'chess.js'
import type { ReviewScore, GameReview } from '../types/review'
import { scoreForMover } from './score'
import { classificationConfig as config } from './classificationConfig'
import { isSacrifice } from './sacrifice'
import { findOpening, type Opening } from './openings'

export const moveClasses = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
  'forced',
] as const
export type MoveClass = (typeof moveClasses)[number]
export type MoveGrade = {
  kind: MoveClass
  winBefore: number
  winAfter: number
  loss: number
  accuracy: number | null
  bestSan?: string
}

export const missedClasses: ReadonlySet<MoveClass> = new Set([
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
])

export function winPercent(score: ReviewScore, mover: Color): number {
  const { kind, value } = scoreForMover(score, mover)
  // Map mate distance to a signed centipawn sentinel, then apply the logistic curve.
  const cp =
    kind === 'mate'
      ? (value < 0 || Object.is(value, -0) ? -1 : 1) *
        (config.mateCentipawns - Math.abs(value))
      : value
  return 50 + 50 * (2 / (1 + Math.exp(-config.winSlope * cp)) - 1)
}

export function moveAccuracy(loss: number) {
  const { multiplier, decay, offset } = config.accuracy
  // Exponential penalty on lost percentage points, clamped to a 0–100 score.
  return Math.max(
    0,
    Math.min(100, multiplier * Math.exp(-decay * Math.max(0, loss)) - offset),
  )
}

export function basicClass(
  loss: number,
  playedBest: boolean,
  before: number,
  after: number,
  previous?: MoveClass,
): MoveClass {
  const cut = config.loss
  if (playedBest || loss <= cut.best) return 'best'
  if (
    (before > config.decided.high && after > config.decided.high) ||
    (before < config.decided.low && after < config.decided.low)
  )
    return 'good'
  if (
    (previous === 'mistake' || previous === 'blunder') &&
    before >= config.miss.winBefore &&
    loss >= config.miss.loss
  )
    return 'miss'
  if (loss <= cut.excellent) return 'excellent'
  if (loss <= cut.good) return 'good'
  if (loss <= cut.inaccuracy) return 'inaccuracy'
  if (loss <= cut.mistake) return 'mistake'
  return 'blunder'
}

export function onlyGoodMove(best: number, alternative: number) {
  const { gap, losing, winning } = config.great
  return (
    best - alternative >= gap ||
    (alternative < losing && best >= losing) ||
    (alternative <= winning && best > winning)
  )
}

export function classifyReview(review: GameReview) {
  const grades: (MoveGrade | undefined)[] = [undefined]
  let opening: Opening | undefined
  const totals = {
    w: { sum: 0, moves: 0, counts: new Map<MoveClass, number>() },
    b: { sum: 0, moves: 0, counts: new Map<MoveClass, number>() },
  }
  const standardStart = review.positions[0]?.fen === DEFAULT_POSITION
  for (let ply = 1; ply < review.positions.length; ply++) {
    const position = review.positions[ply]
    const move = position.move
    const before = review.evaluations[ply - 1]
    const after = review.evaluations[ply]
    const top = before.lines[0]?.moves[0]
    const score = before.lines[0]?.score ?? before.score
    if (!move || !score || !after.score) {
      grades.push(undefined)
      continue
    }
    const board = new Chess(review.positions[ply - 1].fen)
    const forced = board.moves().length === 1
    const winBefore = winPercent(score, move.color)
    const winAfter = winPercent(after.score, move.color)
    const loss = Math.max(0, winBefore - winAfter)
    const book =
      standardStart && ply <= config.book.maxPly
        ? findOpening(position.fen)
        : undefined
    if (book) opening = book
    const playedBest = move.uci === top?.uci
    let kind = forced
      ? 'forced'
      : book
        ? 'book'
        : basicClass(
            loss,
            playedBest,
            winBefore,
            winAfter,
            grades[ply - 1]?.kind,
          )
    if (kind === 'best' || kind === 'excellent') {
      const wasInCheck = board.isCheck()
      const played = board.move(move.uci)
      const previous = review.positions[ply - 1].move?.uci
      const recapture = !!played.captured && previous?.slice(2, 4) === played.to
      const alternativeScore = before.lines[1]?.score
      const alternative = alternativeScore
        ? winPercent(alternativeScore, move.color)
        : undefined
      const line = before.lines.find(
        (candidate) => candidate.moves[0]?.uci === move.uci,
      )
      const obvious =
        wasInCheck &&
        !!played.captured &&
        alternative !== undefined &&
        winBefore - alternative >= config.brilliant.obviousGap
      if (
        !recapture &&
        !obvious &&
        ply > config.brilliant.minPly &&
        loss <= config.loss.excellent &&
        winBefore <= config.brilliant.maxBefore &&
        winAfter >= config.brilliant.minAfter &&
        line &&
        isSacrifice(
          played.before,
          move.uci,
          line.moves.map(({ uci }) => uci),
        )
      ) {
        kind = 'brilliant'
      } else if (
        !recapture &&
        playedBest &&
        winBefore <= config.great.decided &&
        alternative !== undefined &&
        onlyGoodMove(winBefore, alternative)
      ) {
        kind = 'great'
      }
    }
    const accuracy = forced ? null : moveAccuracy(loss)
    const total = totals[move.color]
    total.counts.set(kind, (total.counts.get(kind) ?? 0) + 1)
    if (accuracy !== null) {
      total.sum += accuracy
      total.moves++
    }
    grades.push({
      kind,
      winBefore,
      winAfter,
      loss,
      accuracy,
      bestSan: top?.san,
    })
  }
  function summary(color: Color) {
    const { sum, moves, counts } = totals[color]
    const accuracy = moves ? sum / moves : null
    const { floor, ceiling, exponent, minMoves } = config.rating
    const rating =
      accuracy !== null && moves >= minMoves
        ? Math.round(floor + (ceiling - floor) * (accuracy / 100) ** exponent)
        : null
    return { accuracy, rating, counts }
  }
  return { grades, opening, white: summary('w'), black: summary('b') }
}
