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
}: {
  data: ReturnType<typeof classifyReview>
}) {
  const { white, black } = data
  const accuracy = (value: number | null) =>
    value === null ? '—' : value.toFixed(1) + '%'
  return (
    <section className="panel">
      <h3 className="font-semibold">{t.summary}</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr>
            <th scope="col" aria-label={t.summary} />
            <th scope="col">{reviewText.white}</th>
            <th scope="col">{reviewText.black}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="py-2 text-left">
              {t.accuracy}
            </th>
            <td className="text-center font-mono">
              {accuracy(white.accuracy)}
            </td>
            <td className="text-center font-mono">
              {accuracy(black.accuracy)}
            </td>
          </tr>
          <tr>
            <th scope="row" className="pb-2 text-left">
              {t.rating}
            </th>
            <td className="text-center">{white.rating ?? '—'}</td>
            <td className="text-center">{black.rating ?? '—'}</td>
          </tr>
          {moveClasses.map((kind) => (
            <tr key={kind} className="border-t border-slate-700">
              <th scope="row" className="py-1 text-left font-normal">
                <span className="flex items-center gap-2">
                  <GradeIcon kind={kind} /> {t.grade[kind]}
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
      <p className="mt-2 text-xs text-slate-300">{t.ratingNote}</p>
    </section>
  )
}
