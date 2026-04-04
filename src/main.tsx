import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

try {
  const rawSettings = localStorage.getItem('car-diary.settings')
  const parsed = rawSettings ? JSON.parse(rawSettings) : null
  document.documentElement.dataset.theme = parsed?.theme === 'light' ? 'light' : 'dark'
} catch {
  document.documentElement.dataset.theme = 'dark'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
