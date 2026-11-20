import { describe, expect, it } from 'vitest'
import { parseBestmove, parseInfo } from '../src/engine/uci'

describe('UCI output', () => {
  it('reads a complete MultiPV line including negative centipawns', () => {
    expect(
      parseInfo(
        'info depth 12 seldepth 19 multipv 2 score cp -31 nodes 20662 nps 81281 hashfull 9 pv g1f3 d7d5',
      ),
    ).toEqual({
      depth: 12,
      multipv: 2,
      score: { kind: 'cp', value: -31 },
      nodes: 20662,
      nps: 81281,
      pv: ['g1f3', 'd7d5'],
    })
  })

  it('reads mate scores and ignores bounds and diagnostic messages', () => {
    expect(parseInfo('info depth 7 score mate -3 pv e8f7')?.score).toEqual({
      kind: 'mate',
      value: -3,
    })
    expect(
      parseInfo('info depth 7 score cp -35 upperbound pv e8f7')?.score,
    ).toBeUndefined()
    expect(parseInfo('info string nodes 123')).toBeNull()
  })

  it('reads best moves, promotions, ponder moves, and terminal positions', () => {
    expect(parseBestmove('bestmove e7e8n ponder h7h6')).toEqual({
      bestMove: 'e7e8n',
      ponder: 'h7h6',
    })
    for (const terminal of ['(none)', '0000']) {
      expect(parseBestmove(`bestmove ${terminal}`)).toEqual({
        bestMove: null,
        ponder: null,
      })
    }
    expect(parseBestmove('bestmove e2e9')).toBeNull()
  })
})
