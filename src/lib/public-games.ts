export type Provider = 'chesscom' | 'lichess'
type Query = {
  provider: Provider
  username: string
  limit: number
  speed: string
  since?: number
  until?: number
}

async function request(
  url: string,
  signal: AbortSignal,
  accept = 'application/json',
) {
  const response = await fetch(url, { signal, headers: { Accept: accept } })
  if (!response.ok) throw new Error(String(response.status))
  return response
}

async function archive<T>(url: string, signal: AbortSignal): Promise<T> {
  const key = 'chesslens.archive:' + url
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (cached && Date.now() - cached.time < 900_000) return cached.value
  } catch {
    /* Storage can be unavailable. */
  }
  const value: T = await (await request(url, signal)).json()
  try {
    localStorage.setItem(key, JSON.stringify({ time: Date.now(), value }))
  } catch {
    /* Import still works. */
  }
  return value
}

export async function publicGames(
  query: Query,
  signal: AbortSignal,
): Promise<string> {
  const { provider, limit, speed, since, until } = query
  const name = query.username.trim().toLowerCase()
  if (!/^[a-z0-9_-]{1,40}$/.test(name)) throw new Error('username')
  if (provider === 'lichess') {
    const params = new URLSearchParams({
      max: String(limit),
      pgnInJson: 'true',
      clocks: 'false',
      evals: 'false',
      opening: 'true',
      finished: 'true',
      ongoing: 'false',
    })
    params.set(
      'perfType',
      speed || 'bullet,blitz,rapid,classical,correspondence',
    )
    if (since !== undefined) params.set('since', String(since))
    if (until !== undefined) params.set('until', String(until))
    const response = await request(
      'https://lichess.org/api/games/user/' + name + '?' + params,
      signal,
      'application/x-ndjson',
    )
    return (await response.text())
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line).pgn)
      .filter((pgn): pgn is string => typeof pgn === 'string')
      .join('\n\n')
  }

  const base = 'https://api.chess.com/pub/player/' + name + '/games'
  const { archives } = await archive<{ archives: string[] }>(
    base + '/archives',
    signal,
  )
  const result: string[] = []
  for (const url of [...archives].reverse()) {
    const month = url.slice(base.length)
    if (!url.startsWith(base) || !/^\/\d{4}\/\d{2}$/.test(month)) continue
    const start = Date.parse(month.slice(1).replace('/', '-') + '-01T00:00:00Z')
    const nextMonth = new Date(start)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    if (since !== undefined && nextMonth.getTime() <= since) break
    if (until !== undefined && start > until) continue
    const { games } = await archive<{
      games: {
        rules: string
        pgn?: string
        time_class: string
        end_time: number
      }[]
    }>(url, signal)
    for (const game of [...games].reverse()) {
      const time = game.end_time * 1000
      if (
        game.rules !== 'chess' ||
        !game.pgn ||
        (speed && speed !== game.time_class) ||
        (since !== undefined && time < since) ||
        (until !== undefined && time > until)
      )
        continue
      result.push(game.pgn)
      if (result.length >= limit) return result.join('\n\n')
    }
  }
  return result.join('\n\n')
}
