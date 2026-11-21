export const classificationConfig = {
  winSlope: 0.00368208,
  mateCentipawns: 10_000,
  loss: { best: 0.3, excellent: 2, good: 5, inaccuracy: 10, mistake: 20 },
  decided: { low: 3, high: 97 },
  miss: { winBefore: 70, loss: 10 },
  accuracy: { multiplier: 103.1668, decay: 0.04354, offset: 3.1669 },
  book: { maxPly: 16 },
  great: { gap: 10, decided: 90, losing: 35, winning: 65 },
  brilliant: { maxBefore: 80, minAfter: 50, minPly: 8, obviousGap: 25 },
  sacrifice: {
    minLoss: 2,
    replyPlies: 3,
    pieces: { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 },
  },
  // A display estimate on a familiar scale, based only on this game's accuracy.
  rating: { floor: 400, ceiling: 2800, exponent: 1.8, minMoves: 5 },
} as const
