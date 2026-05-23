import React from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.8rem', marginBottom: '.5rem' }}>
            Aplikace narazila na chybu
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '.9rem' }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '.65rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}
          >
            Obnovit stránku
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
