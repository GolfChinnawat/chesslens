import {
  moveClasses,
  type MoveClass,
  type classifyReview,
} from '../../analysis/classify'
import { classificationText as t } from '../../i18n/classification-th'
import { reviewText } from '../../i18n/review-th'

const iconStyle: Record<MoveClass, [string, string]> = {
  brilliant: ['#55e5d8', '!!'],
  great: ['#7abfff', '!'],
  best: ['#80dd72', '★'],
  excellent: ['#c0eb86', '✓'],
  good: ['#acc4aa', '•'],
  book: ['#deb68c', '≡'],
  inaccuracy: ['#f8da6b', '?!'],
  mistake: ['#ffad69', '?'],
  miss: ['#ff916e', '×'],
  blunder: ['#ff8989', '??'],
  forced: ['#cbd5e1', '→'],
}

export function GradeIcon({ kind }: { kind: MoveClass }) {
  const [color, symbol] = iconStyle[kind]
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      role="img"
      aria-label={t.grade[kind]}
      className="shrink-0"
    >
      <title>{t.grade[kind]}</title>
      <rect x="1" y="1" width="22" height="22" rx="7" fill={color} />
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        fill="#101827"
      >
        {symbol}
      </text>
    </svg>
  )
}

export function GradeSummary({
  data,
  names,
}: {
  data: ReturnType<typeof classifyReview>
  names?: [string | undefined, string | undefined]
}) {
  const { white, black } = data
  const accuracy = (value: number | null) =>
    value === null ? '—' : value.toFixed(1) + '%'
  return (
    <section className="panel">
      <h3 className="font-semibold">{t.summary}</h3>
      <table className="mt-2 w-full table-fixed text-sm">
        <thead>
          <tr>
            <th scope="col" aria-label={t.summary} />
            <th scope="col" className="w-[24%] px-1">
              <span className="block truncate" title={names?.[0]}>
                {names?.[0] && names[0] !== '?' ? names[0] : reviewText.white}
              </span>
            </th>
            <th scope="col" className="w-[24%] px-1">
              <span className="block truncate" title={names?.[1]}>
                {names?.[1] && names[1] !== '?' ? names[1] : reviewText.black}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="py-2 text-left">
              {t.accuracy}
            </th>
            <td className="text-center font-mono font-bold text-cyan-100">
              {accuracy(white.accuracy)}
            </td>
            <td className="text-center font-mono font-bold text-cyan-100">
              {accuracy(black.accuracy)}
            </td>
          </tr>
          {moveClasses.map((kind) => (
            <tr key={kind} className="border-t border-slate-700">
              <th scope="row" className="py-1 text-left font-normal">
                <span className="flex items-center gap-2">
                  <GradeIcon kind={kind} /> {t.grade[kind].split(' · ')[0]}
                </span>
              </th>
              <td className="text-center tabular-nums">
                {white.counts.get(kind) ?? 0}
              </td>
              <td className="text-center tabular-nums">
                {black.counts.get(kind) ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="mt-3 border-t border-slate-700 pt-2 text-sm">
        <summary className="cursor-pointer text-slate-300">{t.rating}</summary>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <dt>{reviewText.white}</dt>
            <dd>{white.rating ?? '—'}</dd>
          </div>
          <div>
            <dt>{reviewText.black}</dt>
            <dd>{black.rating ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-300">{t.ratingNote}</p>
      </details>
    </section>
  )
}
