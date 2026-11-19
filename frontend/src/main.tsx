// App entry point — initializes providers, router, and seeds demo data
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { seedIfEmpty } from './mock/seed'
import { ErrorBoundary } from './components/ErrorBoundary'

// Seed demo data on first load
seedIfEmpty().catch(console.error)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

