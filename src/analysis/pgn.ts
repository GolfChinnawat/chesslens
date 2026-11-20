import { Chess } from 'chess.js'
import { moveUci } from '../lib/game'
import type { ImportedGame, ReviewPosition } from '../types/review'

// Match PGN lexical units so a result inside a comment or variation never splits a game.
const units =
  /\[(?:[^"\]\\]|"(?:[^"\\]|\\.)*")*\]|\{[^}]*\}|;[^\r\n]*|^%[^\r\n]*|[()]|[^\s[\]{}();]+|[[\]{}]/gm
const result = /^(?:1-0|0-1|1\/2-1\/2|\*)$/

export function importGames(input: string): ImportedGame[] {
  const source = input.replace(/^\uFEFF/, '').trim()
  const games: ImportedGame[] = []
  let start = 0
  let nesting = 0
  let moves = false
  let end: number | undefined

  function add(stop: number) {
    const pgn = source.slice(start, stop).trim()
    const chess = new Chess()
    chess.loadPgn(pgn)
    if (!chess.history().length) throw new Error('PGN has no moves')
    const headers = chess.getHeaders()
    games.push({ pgn: chess.pgn(), headers })
  }

  for (const match of source.matchAll(units)) {
    const token = match[0]
    const index = match.index
    if (/^[{;%]/.test(token) && token !== '{') continue
    if (token === '(') {
      nesting++
      continue
    }
    if (token === ')') {
      if (--nesting < 0) throw new Error('Unmatched PGN variation')
      continue
    }
    if (nesting) continue
    if ((token.startsWith('[') && moves) || end !== undefined) {
      add(end ?? index)
      start = index
      end = undefined
      moves = false
    }
    if (result.test(token)) end = index + token.length
    else if (!token.startsWith('[')) moves = true
  }
  if (nesting) throw new Error('Unclosed PGN variation')
  add(end ?? source.length)
  return games
}

function terminal(chess: Chess): ReviewPosition['terminal'] {
  if (chess.isCheckmate())
    return { kind: 'mate', value: 0, winner: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate() || chess.isInsufficientMaterial())
    return { kind: 'cp', value: 0 }
}

export function buildPositions(pgn: string): ReviewPosition[] {
  const loaded = new Chess()
  loaded.loadPgn(pgn)
  const moves = loaded.history({ verbose: true })
  const game = new Chess(moves[0]?.before ?? loaded.fen())
  const positions: ReviewPosition[] = [
    { fen: game.fen(), turn: game.turn(), terminal: terminal(game) },
  ]
  for (const move of moves) {
    const number = Number(move.before.split(' ')[5])
    game.move(moveUci(move))
    positions.push({
      fen: game.fen(),
      turn: game.turn(),
      terminal: terminal(game),
      move: { uci: moveUci(move), san: move.san, number, color: move.color },
    })
  }
  return positions
}
