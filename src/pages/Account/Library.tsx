import { accountStats } from '../../analysis/account-stats'
import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { classifyReview } from '../../analysis/classify'
import { analyzeGame } from '../../analysis/review'
import { StockfishEngine } from '../../engine'
import { cloud, cloudReview, saveCloudReview } from '../../lib/cloud'
import { localReviews } from '../../store/review-cache'
import type { GameReview, ReviewDepth } from '../../types/review'
import { ReviewBoard } from '../Review/ReviewBoard'
import { Training, type Card } from './Training'

type Row = {
  id: string
  pgn: string
  result: string
  opening: string | null
  saved_at: string
  played_at: string | null
  reviews: { depth: ReviewDepth; payload: unknown }[]
}

async function pages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const all: T[] = []
  const batch = 100
  for (let from = 0; ; from += batch) {
    const { data, error } = await fetchPage(from, from + batch - 1)
    if (error || !data) throw error ?? new Error('Missing data')
    all.push(...data)
    if (data.length < batch) return all
  }
}

function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Library({ session }: { session: Session }) {
  const [rows, setRows] = useState<Row[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('')
  const [mistakes, setMistakes] = useState(false)
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [version, refresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState<GameReview>()
  const [local] = useState(localReviews)
  const [imported, setImported] = useState(false)

  useEffect(() => {
    if (!cloud) return
    const controller = new AbortController()
    const client = cloud
    void Promise.all([
      pages<Row>((from, to) =>
        client
          .from('games')
          .select('*,reviews(depth,payload)')
          .order('saved_at', { ascending: false })
          .order('id')
          .range(from, to)
          .abortSignal(controller.signal),
      ),
      pages<Card>((from, to) =>
        client
          .from('mistake_positions')
          .select('*')
          .order('due_at')
          .order('game_id')
          .order('ply')
          .range(from, to)
          .abortSignal(controller.signal),
      ),
      client
        .from('settings')
        .select('display_name')
        .abortSignal(controller.signal)
        .maybeSingle(),
    ])
      .then(([games, positions, settings]) => {
        if (controller.signal.aborted) return
        if (settings.error) throw settings.error
        setRows(games)
        setCards(positions)
        setName(settings.data?.display_name ?? '')
        setReady(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage('โหลดคลังเกมไม่สำเร็จ')
      })
    return () => controller.abort()
  }, [version])

  async function run(
    action: () => Promise<unknown>,
    success: string,
    reload = true,
  ) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      setMessage(success)
      if (reload) refresh((value) => value + 1)
    } catch {
      setMessage('ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }
  const recorded = useMemo(
    () =>
      rows.map((row) => {
        try {
          const review = cloudReview(
            [...row.reviews].sort((a, b) => b.depth - a.depth)[0]?.payload,
          )
          return { row, review, analysis: classifyReview(review) }
        } catch {
          return { row }
        }
      }),
    [rows],
  )
  const stats = useMemo(
    () =>
      accountStats(
        [...recorded]
          .sort((a, b) =>
            (a.row.played_at ?? a.row.saved_at).localeCompare(
              b.row.played_at ?? b.row.saved_at,
            ),
          )
          .flatMap(({ row, review }) =>
            review
              ? [{ review, result: row.result, opening: row.opening }]
              : [],
          ),
        name,
      ),
    [recorded, name],
  )
  const filtered = recorded.filter(
    ({ row, review, analysis }) =>
      (!result || row.result === result) &&
      (!mistakes ||
        (!!analysis &&
          [analysis.white, analysis.black].some(
            (side) =>
              (side.counts.get('blunder') ?? 0) +
                (side.counts.get('mistake') ?? 0) >
              0,
          ))) &&
      [
        row.opening,
        review?.game.headers.White,
        review?.game.headers.Black,
      ].some((item) =>
        (item ?? '').toLowerCase().includes(query.trim().toLowerCase()),
      ),
  )
  return (
    <div className="space-y-4">
      <section className="panel space-y-3">
        <h2 className="font-semibold">โปรไฟล์</h2>
        <p className="break-all text-sm">{session.user.email}</p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const display_name = String(
              new FormData(event.currentTarget).get('name'),
            ).trim()
            void run(async () => {
              const { error } = await cloud!
                .from('settings')
                .upsert({ user_id: session.user.id, display_name })
              if (error) throw error
            }, 'บันทึกโปรไฟล์แล้ว')
          }}
        >
          <label>
            ชื่อที่ใช้เล่นหมากรุก{' '}
            <input
              key={name}
              defaultValue={name}
              name="name"
              className="control"
              maxLength={60}
            />
          </label>
          <button className="control" disabled={busy || !ready}>
            บันทึก
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button
            className="control"
            disabled={busy}
            onClick={() =>
              void run(
                async () => {
                  const { error } = await cloud!.auth.signOut()
                  if (error) throw error
                },
                '',
                false,
              )
            }
          >
            ออกจากระบบ
          </button>
          <button
            className="control"
            disabled={!ready}
            onClick={() =>
              saveFile(
                'chesslens-account.json',
                JSON.stringify(
                  {
                    account: { id: session.user.id, email: session.user.email },
                    rows,
                    cards,
                    settings: { display_name: name },
                  },
                  null,
                  2,
                ),
                'application/json',
              )
            }
          >
            ส่งออก JSON
          </button>
          <button
            className="control"
            disabled={!rows.length}
            onClick={() =>
              saveFile(
                'chesslens-games.pgn',
                rows.map(({ pgn }) => pgn).join('\n\n'),
                'application/x-chess-pgn',
              )
            }
          >
            ส่งออก PGN
          </button>
          <button
            className="control"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('ลบบัญชีและข้อมูลออนไลน์ทั้งหมดอย่างถาวร?')) return
              void run(
                async () => {
                  const { error } = await cloud!.rpc('delete_my_account')
                  if (error) throw error
                  await cloud!.auth.signOut({ scope: 'local' })
                },
                'ลบบัญชีแล้ว',
                false,
              )
            }}
          >
            ลบบัญชี
          </button>
        </div>
      </section>
      {!!local.length && !imported && (
        <section className="panel">
          <button
            className="control"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                for (const review of local)
                  await saveCloudReview(review, 'local')
                setImported(true)
              }, 'นำเข้ารีวิวจากเครื่องนี้แล้ว')
            }
          >
            นำเข้ารีวิวจากเครื่องนี้ ({local.length})
          </button>
        </section>
      )}
      {message && <p role="status">{message}</p>}
      <section className="panel space-y-3">
        <h2 className="font-semibold">สถิติของฉัน</h2>
        {!stats.trend.length ? (
          <p className="text-sm">
            ยังไม่มีรีวิวที่ระบุฝ่ายของคุณ ตั้งชื่อในโปรไฟล์ให้ตรงกับชื่อใน PGN
          </p>
        ) : (
          <>
            <p>
              ขาว ชนะ / เสมอ / แพ้: {stats.outcomes.w.join(' / ')} · ดำ:{' '}
              {stats.outcomes.b.join(' / ')}
            </p>
            <div className="h-44" aria-label="ความแม่นยำตามลำดับเกม">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.trend}>
                  <XAxis dataKey="game" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    dataKey="accuracy"
                    name="Accuracy"
                    stroke="var(--color-accent)"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm">
              อัตรา Blunder ·{' '}
              {(
                [
                  ['opening', 'เปิดเกม'],
                  ['middle', 'กลางเกม'],
                  ['end', 'ท้ายเกม'],
                ] as const
              )
                .map(([id, label]) => {
                  const phase = stats.phases[id]
                  return (
                    label +
                    ' ' +
                    (phase.moves
                      ? ((100 * phase.blunders) / phase.moves).toFixed(1) + '%'
                      : '—')
                  )
                })
                .join(' · ')}
            </p>
            {stats.trend.some(({ rating }) => rating !== null) && (
              <details>
                <summary className="cursor-pointer">
                  เรตเกมประมาณการเทียบกับ Accuracy
                </summary>
                <ol className="mt-2 max-h-40 overflow-auto text-sm">
                  {stats.trend.map(({ game, accuracy, rating }) => (
                    <li key={game}>
                      เกม {game} · {rating ?? '—'} /{' '}
                      {accuracy?.toFixed(1) ?? '—'}%
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {!!stats.openings.length && (
              <ul className="text-sm">
                {stats.openings.map(([opening, { games, points }]) => (
                  <li key={opening}>
                    {opening} · {games} เกม · ได้{' '}
                    {((points / games) * 100).toFixed(1)}% ของคะแนน
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <section className="panel space-y-3">
        <h2 className="font-semibold">คลังเกมของฉัน</h2>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="ค้นหาคลังเกม"
            placeholder="ชื่อผู้เล่นหรือชื่อเปิดเกม"
            className="control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="กรองผลเกม"
            className="control"
            value={result}
            onChange={(event) => setResult(event.target.value)}
          >
            <option value="">ทุกผลเกม</option>
            <option>1-0</option>
            <option>0-1</option>
            <option>1/2-1/2</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={mistakes}
              onChange={(event) => setMistakes(event.target.checked)}
            />{' '}
            มี Mistake หรือ Blunder
          </label>
        </div>
        {!filtered.length && <p>{ready ? 'ไม่พบเกม' : 'กำลังโหลด…'}</p>}
        {filtered.map(({ row, review }) => (
          <div
            className="flex flex-wrap items-center gap-2 border-t border-line pt-2"
            key={row.id}
          >
            <span className="grow break-words">
              {review?.game.headers.White ?? '?'} –{' '}
              {review?.game.headers.Black ?? '?'} · {row.result} {row.opening}
            </span>
            {review && (
              <button className="control" onClick={() => setOpen(review)}>
                เปิดรีวิว
              </button>
            )}
            {review && (
              <select
                aria-label="วิเคราะห์เกมใหม่ที่ความลึก"
                className="control"
                disabled={busy}
                value=""
                onChange={(event) => {
                  const depth = Number(event.target.value) as ReviewDepth
                  if (!depth) return
                  void run(async () => {
                    const engine = new StockfishEngine()
                    try {
                      const next = await analyzeGame(
                        engine,
                        review.game,
                        depth,
                        new AbortController().signal,
                        () => {},
                      )
                      await saveCloudReview(next)
                      setOpen(next)
                    } finally {
                      engine.destroy()
                    }
                  }, 'วิเคราะห์และบันทึกแล้ว')
                }}
              >
                <option value="">วิเคราะห์ใหม่</option>
                {[12, 16, 18, 20].map((depth) => (
                  <option key={depth}>{depth}</option>
                ))}
              </select>
            )}
            <button
              className="control"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('ลบเกมนี้ออกจากคลัง?')) return
                void run(async () => {
                  const { error } = await cloud!
                    .from('games')
                    .delete()
                    .eq('id', row.id)
                  if (error) throw error
                  setOpen(undefined)
                }, 'ลบเกมแล้ว')
              }}
            >
              ลบเกม
            </button>
          </div>
        ))}
      </section>
      <section className="panel space-y-3">
        <h2 className="font-semibold">ชุดฝึกตามกำหนด</h2>
        <Training cards={cards} onDone={() => refresh((value) => value + 1)} />
      </section>
      {open && (
        <section>
          <button className="control mb-3" onClick={() => setOpen(undefined)}>
            ปิดรีวิว
          </button>
          <ReviewBoard key={open.game.pgn + open.depth} review={open} />
        </section>
      )}
    </div>
  )
}
