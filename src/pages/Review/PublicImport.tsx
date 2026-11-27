import { translate } from '../../i18n/locale'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { publicGames, type Provider } from '../../lib/public-games'

export function PublicImport({
  onLoad,
}: {
  onLoad: (pgn: string, username: string) => void
}) {
  const [provider, setProvider] = useState<Provider>('chesscom')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const pending = useRef<AbortController>()
  useEffect(() => () => pending.current?.abort(), [])

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username')).trim()
    const first = String(form.get('since'))
    const last = String(form.get('until'))
    if (first && last && first > last) {
      setStatus(
        translate(
          'วันที่เริ่มต้องมาก่อนได้ถึงวันสิ้นสุด',
          'The start date must be on or before the end date',
        ),
      )
      return
    }
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setStatus(translate('กำลังโหลดเกม…', 'Loading games…'))
    try {
      const pgn = await publicGames(
        {
          provider,
          username,
          limit: Number(form.get('limit')),
          speed: String(form.get('speed')),
          since: first ? Date.parse(first) : undefined,
          until: last ? Date.parse(last) + 86_399_999 : undefined,
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]),
      )
      if (controller.signal.aborted) return
      if (pgn) {
        onLoad(pgn, username)
        setStatus(
          translate(
            'โหลดแล้ว เลือกเกมด้านล่างได้เลย',
            'Games loaded. Select one below.',
          ),
        )
      } else setStatus(translate('ไม่พบเกมตามเงื่อนไข', 'No matching games'))
    } catch (error) {
      if (controller.signal.aborted) return
      const code = (error as Error).message
      setStatus(
        code === '404'
          ? translate('ไม่พบชื่อผู้ใช้', 'Username not found')
          : code === '429'
            ? translate(
                'ขอข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง',
                'Too many requests. Wait a moment and try again.',
              )
            : code === 'username'
              ? translate('ชื่อผู้ใช้ไม่ถูกต้อง', 'Invalid username')
              : translate(
                  'โหลดเกมไม่ได้ ลองใหม่หรือใช้ไฟล์ PGN',
                  'Could not load games. Try again or import a PGN file.',
                ),
      )
    } finally {
      pending.current = undefined
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void load(event)}
      className="panel mb-4 max-w-3xl"
    >
      <h2 className="mb-3 font-semibold">
        {translate('นำเข้าจากชื่อผู้ใช้', 'Import by username')}
      </h2>
      <fieldset
        disabled={busy}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        <label className="text-sm">
          {translate('แพลตฟอร์ม', 'Platform')}
          <select
            className="control mt-1 block w-full"
            value={provider}
            onChange={(event) => setProvider(event.target.value as Provider)}
          >
            <option value="chesscom">Chess.com</option>
            <option value="lichess">Lichess</option>
          </select>
        </label>
        <label className="text-sm">
          {translate('ชื่อผู้ใช้', 'Username')}
          <input
            required
            name="username"
            maxLength={40}
            className="control mt-1 block w-full"
          />
        </label>
        <label className="text-sm">
          {translate('จำนวนเกม', 'Number of games')}
          <select name="limit" className="control mt-1 block w-full">
            <option>10</option>
            <option>25</option>
            <option>50</option>
          </select>
        </label>
        <label className="text-sm">
          {translate('ประเภทเวลา', 'Time control')}
          <select
            key={provider}
            name="speed"
            className="control mt-1 block w-full"
          >
            <option value="">{translate('ทั้งหมด', 'All')}</option>
            {(provider === 'lichess'
              ? ['bullet', 'blitz', 'rapid', 'classical', 'correspondence']
              : ['bullet', 'blitz', 'rapid', 'daily']
            ).map((speed) => (
              <option key={speed}>{speed}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {translate('ตั้งแต่ (UTC)', 'From (UTC)')}
          <input
            name="since"
            type="date"
            className="control mt-1 block w-full min-w-0"
          />
        </label>
        <label className="text-sm">
          {translate('ถึง (UTC)', 'To (UTC)')}
          <input
            name="until"
            type="date"
            className="control mt-1 block w-full min-w-0"
          />
        </label>
        <button className="control primary-control" type="submit">
          {translate('ค้นหาเกม', 'Find games')}
        </button>
      </fieldset>
      {status && (
        <p className="mt-2 text-sm" role="status">
          {status}
        </p>
      )}
    </form>
  )
}
