import { playerSide } from '../analysis/account-stats'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { classifyReview } from '../analysis/classify'
import type { GameReview } from '../types/review'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const cloud =
  url && typeof key === 'string' && key.startsWith('sb_publishable_')
    ? createClient(url, key, { auth: { flowType: 'pkce' } })
    : null

const score = z.object({
  kind: z.enum(['cp', 'mate']),
  value: z.number(),
  winner: z.enum(['w', 'b']).optional(),
})
const move = z.object({
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  san: z.string().max(32),
})
export const reviewSchema = z
  .object({
    game: z.object({
      pgn: z.string().min(1).max(2097152),
      username: z.string().optional(),
      headers: z.record(z.string(), z.string()),
    }),
    depth: z.union([
      z.literal(12),
      z.literal(16),
      z.literal(18),
      z.literal(20),
    ]),
    positions: z
      .array(
        z.object({
          fen: z.string().min(1).max(150),
          turn: z.enum(['w', 'b']),
          terminal: score.optional(),
          move: move
            .extend({
              color: z.enum(['w', 'b']),
              number: z.number().int().positive(),
            })
            .optional(),
        }),
      )
      .min(2)
      .max(2001),
    evaluations: z
      .array(
        z.object({
          score: score.nullable(),
          lines: z
            .array(
              z.object({
                rank: z.number().int(),
                depth: z.number().int(),
                score,
                moves: z.array(move).max(256),
              }),
            )
            .max(5),
        }),
      )
      .min(2)
      .max(2001),
  })
  .refine((review) => review.positions.length === review.evaluations.length)

export function cloudReview(value: unknown): GameReview {
  return reviewSchema.parse(value)
}

function pgnDate(date?: string) {
  if (!date || !/^\d{4}\.\d{2}\.\d{2}$/.test(date)) return null
  const iso = date.replaceAll('.', '-')
  const parsed = new Date(iso)
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().startsWith(iso)
    ? iso
    : null
}

export async function saveCloudReview(review: GameReview, source?: 'local') {
  if (!cloud) throw new Error('Cloud unavailable')
  const payload = cloudReview(review)
  const { Result, ECO, Opening, TimeControl, Date: date } = payload.game.headers
  const classification = classifyReview(payload)
  const settings = payload.game.username
    ? null
    : await cloud.from('settings').select('display_name').maybeSingle()
  if (settings?.error) throw settings.error
  const side = playerSide(payload, settings?.data?.display_name)
  const mistakes = classification.grades.flatMap((grade, ply) => {
    const played = payload.positions[ply]?.move?.uci
    const prior = payload.positions[ply - 1]
    const best = payload.evaluations[ply - 1]?.lines[0]?.moves[0]?.uci
    if (
      !grade ||
      !prior ||
      !side ||
      payload.positions[ply]?.move?.color !== side ||
      !played ||
      !best ||
      played === best ||
      !['mistake', 'blunder'].includes(grade.kind)
    )
      return []
    return [{ ply, fen: prior.fen, played, best, class: grade.kind }]
  })
  const { error } = await cloud.rpc('save_review', {
    game_pgn: payload.game.pgn,
    game_source: source ?? (payload.game.username ? 'public' : 'pgn'),
    game_result:
      Result && ['1-0', '0-1', '1/2-1/2'].includes(Result) ? Result : '*',
    game_opening: classification.opening?.name ?? Opening ?? ECO ?? null,
    game_time_control: TimeControl ?? null,
    game_date: pgnDate(date),
    review_depth: payload.depth,
    review_payload: payload,
    mistakes,
  })
  if (error) throw error
}
