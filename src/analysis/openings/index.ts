import { Chess, DEFAULT_POSITION } from 'chess.js'
import source from './lines.tsv?raw'

export type Opening = { eco: string; name: string }
const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ')
let positions: Map<string, Opening> | undefined

export function findOpening(fen: string): Opening | undefined {
  if (!positions) {
    positions = new Map()
    for (const row of source.trim().split('\n')) {
      const [eco, name, san] = row.split('\t')
      const game = new Chess(DEFAULT_POSITION)
      for (const move of san.split(' ')) {
        game.move(move)
        const position = epd(game.fen())
        if (!positions.has(position)) positions.set(position, { eco, name })
      }
      positions.set(epd(game.fen()), { eco, name })
    }
  }
  return positions.get(epd(fen))
}
