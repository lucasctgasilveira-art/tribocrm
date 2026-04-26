import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './index.css'

// Sentry frontend monitoring
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,  // 'production' | 'development'
    tracesSampleRate: 0,  // tracing desabilitado nesta etapa
    replaysSessionSampleRate: 0,  // session replay desabilitado
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,  // LGPD-friendly
  })
  console.log('[Sentry] Frontend inicializado')
}

// ErrorBoundary fallback genérico
function ErrorFallback({ error: _error }: { error: unknown }) {
  return (
    <div style={{
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        Algo deu errado
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        A equipe foi notificada. Tente recarregar a página.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.5rem 1.5rem',
          background: '#f97316',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Recarregar
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
