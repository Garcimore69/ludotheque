import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './lib/store'
import { applyTheme, type Theme } from './pages/SettingsPage'

try {
  applyTheme((JSON.parse(localStorage.getItem('ludo-theme') ?? '"auto"') as Theme) ?? 'auto')
} catch {
  /* thème par défaut */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
