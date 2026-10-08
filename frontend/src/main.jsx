import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Optional error tracking: loaded only when a DSN is configured, so it costs nothing otherwise
const dsn = import.meta.env.VITE_SENTRY_DSN
if (dsn) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn, sendDefaultPii: false, tracesSampleRate: 0, environment: import.meta.env.MODE })
    window.__nivraReportError = (error, extra) => Sentry.captureException(error, { extra })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
