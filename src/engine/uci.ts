export type UciScore = { kind: 'cp' | 'mate'; value: number }
export type UciInfo = {
  depth?: number
  multipv?: number
  score?: UciScore
  pv?: string[]
  nodes?: number
  nps?: number
}

export function parseInfo(line: string): UciInfo | null {
  if (!line.startsWith('info ') || line.startsWith('info string ')) return null
  const fields: UciInfo = {}
  const stats = line.split(' pv ')[0]
  for (const key of ['depth', 'multipv', 'nodes', 'nps'] as const) {
    const match = stats.match(new RegExp(`\\b${key} (\\d+)\\b`))
    if (match) fields[key] = Number(match[1])
  }
  const score = stats.match(
    /\bscore (cp|mate) (-?\d+)\b(?! (?:lowerbound|upperbound))/,
  )
  if (score)
    fields.score = {
      kind: score[1] === 'cp' ? 'cp' : 'mate',
      value: Number(score[2]),
    }
  const pv = line.match(/\bpv (.+)$/)
  if (pv) fields.pv = pv[1].trim().split(/\s+/)
  return fields
}

export function parseBestmove(line: string) {
  const match = line.match(
    /^bestmove ([a-h][1-8][a-h][1-8][qrbn]?|\(none\)|0000)(?: ponder ([a-h][1-8][a-h][1-8][qrbn]?))?$/,
  )
  if (!match) return null
  return {
    bestMove: match[1] === '(none)' || match[1] === '0000' ? null : match[1],
    ponder: match[2] ?? null,
  }
}
