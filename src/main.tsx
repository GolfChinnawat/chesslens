import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlayPage, SmokeTestPage } from './pages'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get('view') === 'smoke' ? (
      <SmokeTestPage />
    ) : (
      <PlayPage />
    )}
  </StrictMode>,
)
