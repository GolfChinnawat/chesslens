import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { PlayPage, SmokeTestPage } from './pages'
import { openingTrainerEnabled } from './pages/Opening/feature'
import { puzzlesEnabled } from './pages/Puzzles/feature'
import { onlineEnabled } from './pages/Online/feature'
import { SiteNav } from './components/SiteNav'
import './styles.css'

const AccountPage = lazy(() => import('./pages/Account'))
const OpeningPage = lazy(() => import('./pages/Opening'))
const PuzzlesPage = lazy(() => import('./pages/Puzzles'))
const OnlinePage = lazy(() => import('./pages/Online'))
const ReviewPage = lazy(() => import('./pages/Review'))
const view = new URLSearchParams(window.location.search).get('view')

const pages = {
  play: PlayPage,
  review: ReviewPage,
  smoke: SmokeTestPage,
  account: AccountPage,
  ...(openingTrainerEnabled && { opening: OpeningPage }),
  ...(puzzlesEnabled && { puzzles: PuzzlesPage }),
  ...(onlineEnabled && { online: OnlinePage }),
}
const current =
  view && Object.hasOwn(pages, view) ? (view as keyof typeof pages) : 'play'
const Page = pages[current] ?? PlayPage

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    <div className="site-shell">
      <SiteNav current={current} />
      <Suspense>
        <Page />
      </Suspense>
    </div>
  </StrictMode>,
)
