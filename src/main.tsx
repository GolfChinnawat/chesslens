import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { PlayPage, SmokeTestPage } from './pages'
import { openingTrainerEnabled } from './pages/Opening/feature'
import { puzzlesEnabled } from './pages/Puzzles/feature'
import './styles.css'

const AccountPage = lazy(() => import('./pages/Account'))
const OpeningPage = lazy(() => import('./pages/Opening'))
const PuzzlesPage = lazy(() => import('./pages/Puzzles'))
const ReviewPage = lazy(() => import('./pages/Review'))
const view = new URLSearchParams(window.location.search).get('view')

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    <Suspense>
      {view === 'puzzles' && puzzlesEnabled ? (
        <PuzzlesPage />
      ) : view === 'opening' && openingTrainerEnabled ? (
        <OpeningPage />
      ) : view === 'account' ? (
        <AccountPage />
      ) : view === 'review' ? (
        <ReviewPage />
      ) : view === 'smoke' ? (
        <SmokeTestPage />
      ) : (
        <PlayPage />
      )}
    </Suspense>
  </StrictMode>,
)
