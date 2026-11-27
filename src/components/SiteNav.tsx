import { changeLocale, locale, translate } from '../i18n/locale'
import { onlineEnabled } from '../pages/Online/feature'
import { openingTrainerEnabled } from '../pages/Opening/feature'
import { puzzlesEnabled } from '../pages/Puzzles/feature'

const links = [
  {
    page: 'play',
    href: './',
    label: translate('เล่นกับบอท', 'Play Bot'),
    enabled: true,
  },
  {
    page: 'review',
    href: '?view=review',
    label: translate('รีวิวเกม', 'Game Review'),
    enabled: true,
  },
  {
    page: 'opening',
    href: '?view=opening',
    label: translate('ฝึกเปิดเกม', 'Openings'),
    enabled: openingTrainerEnabled,
  },
  {
    page: 'puzzles',
    href: '?view=puzzles',
    label: translate('โจทย์หมากรุก', 'Puzzles'),
    enabled: puzzlesEnabled,
  },
  {
    page: 'online',
    href: '?view=online',
    label: translate('เล่นกับเพื่อน', 'Play a Friend'),
    enabled: onlineEnabled,
  },
  {
    page: 'account',
    href: '?view=account',
    label: translate('บัญชี', 'Account'),
    enabled: true,
  },
  {
    page: 'smoke',
    href: '?view=smoke',
    label: translate('ทดสอบ Stockfish', 'Stockfish Test'),
    enabled: true,
  },
] as const

export function SiteNav({
  current,
}: {
  current: (typeof links)[number]['page']
}) {
  return (
    <header className="mx-auto w-full max-w-[79rem] px-4 pt-3 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <a
          href="./"
          className="text-xl font-extrabold text-accent hover:underline"
        >
          ChessLens
        </a>
        <label className="ml-auto md:order-3 md:ml-0">
          <span className="sr-only">{translate('ภาษา', 'Language')}</span>
          <select
            className="control min-h-10"
            value={locale}
            onChange={(event) =>
              changeLocale(event.target.value === 'en' ? 'en' : 'th')
            }
          >
            <option value="th" lang="th">
              ไทย
            </option>
            <option value="en" lang="en">
              English
            </option>
          </select>
        </label>
        <nav
          aria-label={translate('เมนูหลัก', 'Main navigation')}
          className="order-2 flex w-full min-w-0 flex-wrap items-center gap-1 sm:gap-2 md:w-auto md:flex-1 md:justify-end"
        >
          {links
            .filter(({ enabled }) => enabled)
            .map(({ page, href, label }) => (
              <a
                key={page}
                href={href}
                aria-current={page === current ? 'page' : undefined}
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-muted hover:bg-raised hover:text-accent aria-[current=page]:bg-accent aria-[current=page]:text-canvas aria-[current=page]:hover:bg-accent aria-[current=page]:hover:text-canvas"
              >
                {label}
              </a>
            ))}
        </nav>
      </div>
    </header>
  )
}
