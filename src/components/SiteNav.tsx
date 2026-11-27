import { onlineEnabled } from '../pages/Online/feature'
import { openingTrainerEnabled } from '../pages/Opening/feature'
import { puzzlesEnabled } from '../pages/Puzzles/feature'

const links = [
  { page: 'play', href: './', label: 'เล่นกับบอท', enabled: true },
  { page: 'review', href: '?view=review', label: 'รีวิวเกม', enabled: true },
  {
    page: 'opening',
    href: '?view=opening',
    label: 'ฝึกเปิดเกม',
    enabled: openingTrainerEnabled,
  },
  {
    page: 'puzzles',
    href: '?view=puzzles',
    label: 'โจทย์หมากรุก',
    enabled: puzzlesEnabled,
  },
  {
    page: 'online',
    href: '?view=online',
    label: 'เล่นกับเพื่อน',
    enabled: onlineEnabled,
  },
  {
    page: 'account',
    href: '?view=account',
    label: 'บัญชี',
    enabled: true,
  },
  {
    page: 'smoke',
    href: '?view=smoke',
    label: 'ทดสอบ Stockfish',
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
        <nav
          aria-label="เมนูหลัก"
          className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2"
        >
          {links
            .filter(({ enabled }) => enabled)
            .map(({ page, href, label }) => (
              <a
                key={page}
                href={href}
                aria-current={page === current ? 'page' : undefined}
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-muted hover:bg-raised hover:text-accent aria-current:bg-raised aria-current:text-accent"
              >
                {label}
              </a>
            ))}
        </nav>
      </div>
    </header>
  )
}
