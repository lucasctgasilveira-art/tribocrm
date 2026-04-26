import { useState } from 'react'

function ProblematicComponent() {
  // Lança erro REAL durante render — capturado por ErrorBoundary
  throw new Error('Teste L10 Sentry frontend - ' + new Date().toISOString())
  return null
}

export default function DebugSentry() {
  const [shouldCrash, setShouldCrash] = useState(false)

  if (shouldCrash) {
    return <ProblematicComponent />
  }

  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '600px',
      margin: '4rem auto'
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        Debug Sentry — TriboCRM
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Página de teste. Clique no botão pra disparar um erro real
        que será capturado pelo Sentry.
      </p>
      <button
        onClick={() => setShouldCrash(true)}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#f97316',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 500
        }}
      >
        Disparar erro frontend
      </button>
    </div>
  )
}
