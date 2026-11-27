import { SiteNav } from '../../components/SiteNav'
import { Chess } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayBoard } from '../../components/play-board'
import { cloud } from '../../lib/cloud'

type Room = {
  id: string
  room_code: string
  white_id: string
  black_id: string | null
  revision: number
  turn_started_at: string | null
  white_ms: number
  black_ms: number
  pgn: string
  result: string | null
  reason: string | null
}

const errors: Record<string, string> = {
  invalid_code: 'รหัสห้องต้องมี 10 ตัว',
  room_unavailable: 'ห้องนี้เต็มแล้วหรือไม่พบห้อง',
  room_changed: 'ห้องมีการอัปเดต กรุณาลองอีกครั้ง',
  room_not_playing: 'เกมนี้ยังไม่เริ่มหรือจบแล้ว',
  illegal_move: 'ตานี้เดินไม่ได้',
  not_your_turn: 'ยังไม่ถึงตาของคุณ',
  sign_in: 'กรุณาเข้าสู่ระบบใหม่',
}
const reasons: Record<string, string> = {
  mate: 'รุกฆาต',
  draw: 'เสมอ',
  timeout: 'หมดเวลา',
  resign: 'ยอมแพ้',
}

function clock(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000)
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

function MatchClock({
  color,
  ms,
  active,
  yours,
}: {
  color: 'w' | 'b'
  ms: number
  active: boolean
  yours: boolean
}) {
  const label = color === 'w' ? 'ขาว' : 'ดำ'
  const low = ms <= 30_000
  return (
    <div
      className={`min-w-0 rounded-lg border px-3 py-2 ${active ? 'border-accent bg-accent/10' : 'border-line bg-surface'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold">
        <span>
          ฝ่าย{label}
          {yours ? ' · คุณ' : ''}
        </span>
        {active && <span className="text-xs text-accent">กำลังนับ</span>}
      </div>
      <span
        aria-label={`เวลาฝ่าย${label}`}
        className={`block font-mono text-3xl font-bold tabular-nums sm:text-4xl ${low ? 'text-rose-300' : 'text-foreground'}`}
      >
        {clock(ms)}
      </span>
    </div>
  )
}

function MatchResult({
  result,
  reason,
  side,
  onReview,
}: {
  result: string
  reason: string
  side: 'w' | 'b'
  onReview?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title =
    result === '1/2-1/2'
      ? 'เสมอ'
      : result === (side === 'w' ? '1-0' : '0-1')
        ? 'คุณชนะ'
        : 'คุณแพ้'

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <>
      <button className="control" onClick={() => dialog.current?.showModal()}>
        ดูผลการแข่งขัน
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="match-result-heading"
        className="panel m-auto w-[min(24rem,calc(100%-2rem))] space-y-4 text-foreground backdrop:bg-black/70"
      >
        <h2
          id="match-result-heading"
          className="text-3xl font-bold text-accent"
        >
          {title}
        </h2>
        <p className="text-secondary">
          ผล {result} · {reason}
        </p>
        <div className="flex flex-wrap gap-2">
          {onReview && (
            <button className="control primary-control" onClick={onReview}>
              รีวิวเกมนี้
            </button>
          )}
          <form method="dialog">
            <button className="control">ปิดผลการแข่งขัน</button>
          </form>
        </div>
      </dialog>
    </>
  )
}

export default function OnlinePage() {
  const [id, setId] = useState(
    () => new URLSearchParams(location.search).get('room') ?? '',
  )
  const [code, setCode] = useState('')
  const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase()
  const [user, setUser] = useState<string>()
  const [checking, setChecking] = useState(true)
  const [room, setRoom] = useState<Room>()
  const [minutes, setMinutes] = useState(10)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendingMove, setSendingMove] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [now, setNow] = useState(Date.now)
  const clockOffset = useRef(0)
  const pending = useRef(false)
  const flagged = useRef<number>()
  const activeRoom = room?.id === id ? room : undefined
  const pgn = activeRoom?.pgn ?? ''
  const chess = useMemo(() => {
    const game = new Chess()
    if (pgn) game.loadPgn(pgn)
    return game
  }, [pgn])

  useEffect(() => {
    if (!cloud) {
      setChecking(false)
      return
    }
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.id)
      setRoom((current) =>
        current &&
        (current.white_id === session?.user.id ||
          current.black_id === session?.user.id)
          ? current
          : undefined,
      )
      setChecking(false)
    })
    const connection = () => setOnline(navigator.onLine)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
    }
  }, [])

  useEffect(() => {
    if (
      !cloud ||
      !id ||
      !user ||
      !online ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
    )
      return
    const client = cloud
    let live = true
    const started = Date.now()
    void client.rpc('online_clock').then(({ data }) => {
      if (!live || typeof data !== 'string') return
      const server = Date.parse(data)
      if (Number.isFinite(server)) {
        clockOffset.current = server - (started + Date.now()) / 2
        setNow(Date.now())
      }
    })

    async function refresh() {
      const { data } = await client
        .from('online_rooms')
        .select()
        .eq('id', id)
        .maybeSingle()
      if (live && data)
        setRoom((current) =>
          current?.id === id && current.revision > data.revision
            ? current
            : data,
        )
    }
    const channel = client
      .channel('online-room:' + id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'online_rooms',
          filter: 'id=eq.' + id,
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh()
      })
    void refresh()
    const fallback = window.setInterval(() => void refresh(), 10_000)
    return () => {
      live = false
      window.clearInterval(fallback)
      void client.removeChannel(channel)
    }
  }, [id, user, online])

  const running = !!activeRoom?.turn_started_at && !activeRoom.result
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [running])

  async function send(action: string, move?: string) {
    if (!cloud || pending.current || !navigator.onLine) return
    pending.current = true
    setBusy(true)
    setSendingMove(action === 'move')
    setMessage('')
    try {
      const { data, error } = await cloud.functions.invoke<{
        room: Room
        now: number
      }>('chess-room', {
        body: {
          action,
          move,
          room: id,
          code: action === 'join' && !id ? normalizedCode : undefined,
          minutes,
          revision: activeRoom?.revision,
        },
      })
      if (error || !data?.room) {
        const payload =
          error?.context instanceof Response
            ? await error.context.json().catch(() => null)
            : null
        if (id) {
          const refreshed = await cloud
            .from('online_rooms')
            .select()
            .eq('id', id)
            .maybeSingle()
          if (refreshed.data)
            setRoom((current) =>
              current?.id === id && current.revision > refreshed.data.revision
                ? current
                : refreshed.data,
            )
        }
        setMessage(errors[payload?.error as string] ?? 'ติดต่อห้องไม่ได้ ลองอีกครั้ง')
        return
      }
      clockOffset.current = data.now - Date.now()
      if (action !== 'timeout') flagged.current = undefined
      setNow(Date.now())
      const next = data.room
      setRoom((current) =>
        current?.id === next.id && current.revision > next.revision
          ? current
          : next,
      )
      setId(next.id)
      const url = new URL(window.location.href)
      url.searchParams.set('room', next.id)
      window.history.replaceState(null, '', url)
    } catch {
      setMessage('ติดต่อห้องไม่ได้ ลองอีกครั้ง')
    } finally {
      setBusy(false)
      setSendingMove(false)
      pending.current = false
    }
  }

  const lastMove = useMemo(
    () => chess.history({ verbose: true }).at(-1),
    [chess],
  )
  const side = activeRoom?.black_id === user ? 'b' : 'w'
  const elapsed = running
    ? Math.max(
        0,
        now + clockOffset.current - Date.parse(activeRoom!.turn_started_at!),
      )
    : 0
  const white =
    (activeRoom?.white_ms ?? 0) - (chess.turn() === 'w' ? elapsed : 0)
  const black =
    (activeRoom?.black_ms ?? 0) - (chess.turn() === 'b' ? elapsed : 0)
  const expired = running && (white <= 0 || black <= 0)
  const timeout = useRef<() => void>(() => {})
  useEffect(() => {
    timeout.current = () => void send('timeout')
  })
  useEffect(() => {
    if (
      expired &&
      online &&
      !busy &&
      activeRoom &&
      flagged.current !== activeRoom.revision
    ) {
      flagged.current = activeRoom.revision
      timeout.current()
    }
  }, [activeRoom, busy, expired, online])

  function review() {
    try {
      sessionStorage.setItem('chesslens.online-review', pgn)
      location.href = '?view=review&online=1'
    } catch {
      setMessage('ส่งเกมเข้ารีวิวไม่ได้ กรุณาเปิดให้เบราว์เซอร์บันทึกข้อมูล')
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-8">
      <header className="space-y-3 mb-4">
        <SiteNav current="online" />
        <h1 className="text-2xl font-semibold sm:text-3xl">เล่นกับเพื่อน</h1>
      </header>
      {!online && (
        <p role="status" className="panel">
          การเชื่อมต่อหลุด · นาฬิกาเกมยังเดิน เมื่อกลับมาออนไลน์ระบบจะโหลดห้องล่าสุด
        </p>
      )}
      {message && (
        <p role="status" className="panel">
          {message}
        </p>
      )}
      {checking ? (
        <p role="status">กำลังตรวจบัญชี…</p>
      ) : !user ? (
        <p className="panel">
          เข้าสู่ระบบผ่าน{' '}
          <a
            className="text-accent underline"
            href="?view=account"
            target="_blank"
            rel="noopener noreferrer"
          >
            บัญชี ChessLens
          </a>{' '}
          แล้วกลับมาที่แท็บนี้
        </p>
      ) : !activeRoom ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="panel space-y-3">
            <h2 className="font-semibold">
              {id ? 'เข้าห้องที่ได้รับเชิญ' : 'สร้างห้องส่วนตัว'}
            </h2>
            {!id && (
              <label className="block">
                เวลาต่อฝ่าย{' '}
                <select
                  className="control"
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                >
                  {[3, 5, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} นาที
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="control primary-control"
              disabled={busy || !online}
              onClick={() => void send(id ? 'join' : 'create')}
            >
              {id ? 'เข้าห้อง' : 'สร้างห้อง'}
            </button>
          </section>
          {!id && (
            <form
              className="panel space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (/^[0-9A-F]{10}$/.test(normalizedCode)) void send('join')
              }}
            >
              <h2 className="font-semibold">เข้าห้องด้วยรหัส</h2>
              <label className="block">
                รหัสห้อง
                <input
                  className="control mt-1 block w-full font-mono uppercase"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="เช่น A7F32-B0D91"
                  maxLength={24}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                className="control primary-control"
                disabled={
                  busy || !online || !/^[0-9A-F]{10}$/.test(normalizedCode)
                }
              >
                เข้าห้องด้วยรหัส
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section
            className="w-full max-w-xl space-y-2"
            aria-label="กระดานออนไลน์"
          >
            <div className="grid grid-cols-2 gap-2">
              <MatchClock
                color="w"
                ms={white}
                active={running && chess.turn() === 'w'}
                yours={side === 'w'}
              />
              <MatchClock
                color="b"
                ms={black}
                active={running && chess.turn() === 'b'}
                yours={side === 'b'}
              />
            </div>
            <div className="panel">
              <PlayBoard
                game={chess}
                fen={chess.fen()}
                orientation={side}
                lastMove={lastMove}
                canMove={
                  online &&
                  running &&
                  !expired &&
                  !busy &&
                  chess.turn() === side
                }
                play={({ from, to, promotion }) => {
                  void send('move', from + to + (promotion ?? ''))
                  return false
                }}
              />
            </div>
          </section>
          <section className="panel space-y-3">
            <h2 className="font-semibold">
              ห้องส่วนตัว · คุณเล่นฝ่าย{side === 'w' ? 'ขาว' : 'ดำ'}
            </h2>
            <p
              role="status"
              className="rounded-lg bg-raised px-3 py-2 font-semibold"
            >
              {activeRoom.result
                ? activeRoom.result +
                  ' · ' +
                  (reasons[activeRoom.reason ?? ''] ?? 'จบเกม')
                : sendingMove
                  ? 'กำลังส่งตาเดิน…'
                  : !activeRoom.black_id
                    ? 'รอเพื่อนเข้าห้อง'
                    : expired
                      ? 'รอยืนยันผลหมดเวลา'
                      : chess.turn() === side
                        ? 'ตาของคุณ'
                        : 'รอคู่แข่งเดิน'}
            </p>
            {lastMove && (
              <p className="text-sm text-secondary">
                เดินล่าสุด · ฝ่าย{lastMove.color === 'w' ? 'ขาว' : 'ดำ'}{' '}
                <strong className="font-mono text-foreground">
                  {lastMove.san}
                </strong>
              </p>
            )}
            {running &&
              !expired &&
              (side === 'w' ? white : black) <= 30_000 && (
                <p
                  role="status"
                  className="text-sm font-semibold text-rose-300"
                >
                  เวลาของคุณเหลือ 30 วินาทีหรือน้อยกว่า
                </p>
              )}
            {!activeRoom.black_id && (
              <>
                {activeRoom.room_code && (
                  <div className="space-y-2">
                    <p>
                      รหัสห้อง{' '}
                      <strong className="font-mono text-accent">
                        {activeRoom.room_code.slice(0, 5)}-
                        {activeRoom.room_code.slice(5)}
                      </strong>
                    </p>
                    <button
                      className="control"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(activeRoom.room_code)
                          .then(
                            () => setMessage('คัดลอกรหัสห้องแล้ว'),
                            () => setMessage('พิมพ์รหัสที่แสดงให้เพื่อนได้เลย'),
                          )
                      }
                    >
                      คัดลอกรหัสห้อง
                    </button>
                  </div>
                )}
                <button
                  className="control primary-control"
                  onClick={() =>
                    void navigator.clipboard.writeText(location.href).then(
                      () => setMessage('คัดลอกลิงก์แล้ว'),
                      () => setMessage('คัดลอก URL จากแถบที่อยู่ของเบราว์เซอร์ได้เลย'),
                    )
                  }
                >
                  คัดลอกลิงก์เชิญ
                </button>
                <p className="text-sm text-secondary">
                  ส่งรหัสห้องหรือลิงก์ให้เพื่อนที่มีบัญชี ChessLens คนแรกที่กดเข้าห้องจะได้ฝั่งดำ
                </p>
              </>
            )}
            {activeRoom.result ? (
              <div className="flex flex-wrap gap-2">
                <MatchResult
                  key={activeRoom.id}
                  result={activeRoom.result}
                  reason={reasons[activeRoom.reason ?? ''] ?? 'จบเกม'}
                  side={side}
                  onReview={lastMove ? review : undefined}
                />
                <a href="?view=online" className="control">
                  สร้างห้องใหม่
                </a>
              </div>
            ) : (
              running && (
                <button
                  className="control"
                  disabled={busy || !online}
                  onClick={() => {
                    if (window.confirm('ยืนยันยอมแพ้เกมนี้?')) void send('resign')
                  }}
                >
                  ยอมแพ้
                </button>
              )
            )}
          </section>
        </div>
      )}
    </main>
  )
}
