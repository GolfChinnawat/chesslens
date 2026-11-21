import type { GameReview, ImportedGame, ReviewDepth } from '../types/review'

const prefix = 'chesslens.review.v1.'
const latest = prefix + 'latest'
const limit = 6

export async function reviewKey(
  game: ImportedGame,
  depth: ReviewDepth,
  multiPV = 3,
) {
  const data = new TextEncoder().encode(
    JSON.stringify([game.pgn, depth, ...(multiPV === 3 ? [] : [multiPV])]),
  )
  const hash = await crypto.subtle.digest('SHA-256', data)
  return (
    prefix +
    Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  )
}

export function readReview(key?: string): GameReview | null {
  try {
    const target = key ?? localStorage.getItem(latest)
    if (!target?.startsWith(prefix) || target === latest) return null
    const review: GameReview = JSON.parse(
      localStorage.getItem(target) ?? 'null',
    )
    return review?.positions?.length &&
      review.positions.length === review.evaluations?.length
      ? review
      : null
  } catch {
    return null
  }
}

export function saveReview(key: string, review: GameReview) {
  try {
    localStorage.setItem(key, JSON.stringify(review))
    localStorage.setItem(latest, key)
    const older = Object.keys(localStorage).filter(
      (name) => name.startsWith(prefix) && name !== latest && name !== key,
    )
    for (const name of older.slice(0, Math.max(0, older.length - limit + 1)))
      localStorage.removeItem(name)
    return true
  } catch {
    return false
  }
}
