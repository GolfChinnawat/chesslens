import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { PlayPage, SmokeTestPage } from './pages'
import './styles.css'

const ReviewPage = lazy(() => import('./pages/Review'))
const view = new URLSearchParams(window.location.search).get('view')

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    <Suspense>
      {view === 'review' ? (
        <ReviewPage />
      ) : view === 'smoke' ? (
        <SmokeTestPage />
      ) : (
        <PlayPage />
      )}
    </Suspense>
  </StrictMode>,
)
