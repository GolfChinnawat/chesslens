import { Chess, type Color } from 'chess.js'
import { importGames } from './pgn'

export const openingPlies = 16
export const maxOpeningPgnSize = 500_000
const startFen = new Chess().fen()
const intervals = [1, 2, 4, 8, 16]

export type OpeningLine = {
  id: string
  label: string
  positions: { fen: string; san: string; uci: string }[]
}

export type OpeningMode = 'repertoire' | 'line'
type OpeningPosition = OpeningLine['positions'][number]

export function openingPositionKey(fen: string) {
  // Halfmove and fullmove counters do not affect opening move choices.
  return fen.split(' ', 4).join(' ')
}

export function openingChoices(lines: OpeningLine[]) {
  const choices = new Map<string, Map<string, string>>()
  for (const { positions } of lines) {
    for (const { fen, uci, san } of positions) {
      const key = openingPositionKey(fen)
      const moves = choices.get(key) ?? new Map<string, string>()
      moves.set(uci, san)
      choices.set(key, moves)
    }
  }
  return choices
}

export function openingAnswer(
  position: OpeningPosition,
  move: string,
  mode: OpeningMode,
  choices: ReturnType<typeof openingChoices>,
) {
  const played = new Chess(position.fen).move(move)
  const alternatives = choices.get(openingPositionKey(position.fen))
  const correct =
    played.lan === position.uci ||
    (mode === 'repertoire' && alternatives?.has(played.lan) === true)
  return { played, correct }
}

export type OpeningProgress = Record<
  string,
  { box: number; attempts: number; correct: number; due: number }
>

export function openingLines(pgn: string, side: Color): OpeningLine[] {
  if (pgn.length > maxOpeningPgnSize) throw new Error('PGN is too large')
  const lines = new Map<string, OpeningLine>()
  for (const game of importGames(pgn)) {
    const chess = new Chess()
    chess.loadPgn(game.pgn)
    const moves = chess.history({ verbose: true }).slice(0, openingPlies)
    if (moves[0]?.before !== startFen) continue
    while (moves.length && moves.at(-1)?.color !== side) moves.pop()
    if (!moves.length) continue
    const id = side + ':' + moves.map((move) => move.lan).join(' ')
    if (lines.has(id)) continue
    lines.set(id, {
      id,
      label: [game.headers.White, game.headers.Black]
        .filter((name) => name && name !== '?')
        .join(' – '),
      positions: moves
        .filter((move) => move.color === side)
        .map(({ before, san, lan }) => ({ fen: before, san, uci: lan })),
    })
  }
  return [...lines.values()]
}

export function scheduleOpening(
  previous: OpeningProgress[string] | undefined,
  correct: boolean,
  now: number,
): OpeningProgress[string] {
  const box = correct
    ? Math.min((previous?.box ?? -1) + 1, intervals.length - 1)
    : 0
  return {
    box,
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + Number(correct),
    due: now + (correct ? intervals[box] * 86_400_000 : 600_000),
  }
}
