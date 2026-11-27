import { useEffect, useId, useRef } from 'react'
import type { Color } from 'chess.js'
import { translate } from '../i18n/locale'

export function MatchResult({
  result,
  reason,
  side,
  onReview,
}: {
  result: string
  reason: string
  side: Color
  onReview?: () => void
}) {
  const headingId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const title =
    result === '1/2-1/2'
      ? translate('เสมอ', 'Draw')
      : result === (side === 'w' ? '1-0' : '0-1')
        ? translate('คุณชนะ', 'You won')
        : translate('คุณแพ้', 'You lost')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <>
      <button className="control" onClick={() => dialog.current?.showModal()}>
        {translate('ดูผลการแข่งขัน', 'Show game result')}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        className="panel m-auto w-[min(24rem,calc(100%-2rem))] space-y-4 text-foreground backdrop:bg-black/70"
      >
        <h2 id={headingId} className="text-3xl font-bold text-accent">
          {title}
        </h2>
        <p className="text-secondary">
          {translate('ผล', 'Result')} {result} · {reason}
        </p>
        <div className="flex flex-wrap gap-2">
          {onReview && (
            <button className="control primary-control" onClick={onReview}>
              {translate('รีวิวเกมนี้', 'Review this game')}
            </button>
          )}
          <form method="dialog">
            <button className="control">
              {translate('ปิดผลการแข่งขัน', 'Close game result')}
            </button>
          </form>
        </div>
      </dialog>
    </>
  )
}
