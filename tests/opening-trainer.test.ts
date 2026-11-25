import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { openingLines, scheduleOpening } from '../src/analysis/opening-trainer'

const ruy = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'
const sicilian = '[White "Alice"]\n[Black "Carol"]\n\n1. e4 c5 2. Nf3 d6 *'

describe('opening trainer', () => {
  it('deduplicates identical lines and keeps distinct responses in separate lines', () => {
    const lines = openingLines([ruy, ruy, sicilian].join('\n\n'), 'b')
    expect(lines.map((line) => line.positions.map((move) => move.san))).toEqual(
      [
        ['e5', 'Nc6', 'a6'],
        ['c5', 'd6'],
      ],
    )
    const opening = new Chess()
    opening.move('e4')
    expect(lines[0].positions[0]).toEqual({
      fen: opening.fen(),
      san: 'e5',
      uci: 'e7e5',
    })
  })

  it('trains only the selected side and only the first eight turns', () => {
    const [line] = openingLines(
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 *',
      'w',
    )
    expect(line.positions.map((move) => move.san)).toEqual([
      'e4',
      'Nf3',
      'Bb5',
      'Ba4',
      'O-O',
      'Re1',
      'Bb3',
      'c3',
    ])
    expect(openingLines('1. e4 *', 'b')).toEqual([])
    expect(() => openingLines('1. e9 *', 'w')).toThrow()
  })

  it('schedules longer intervals for successive correct answers and retries misses', () => {
    const day = 86_400_000
    const first = scheduleOpening(undefined, true, 0)
    expect(first).toEqual({ box: 0, attempts: 1, correct: 1, due: day })
    const second = scheduleOpening(first, true, day)
    expect(second).toEqual({ box: 1, attempts: 2, correct: 2, due: 3 * day })
    expect(scheduleOpening(second, false, 3 * day)).toEqual({
      box: 0,
      attempts: 3,
      correct: 2,
      due: 3 * day + 600_000,
    })
  })
})
