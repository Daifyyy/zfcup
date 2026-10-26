import { AlertTriangle } from 'lucide-react'
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
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
          <div style={{ marginBottom: '1rem', color: 'var(--warn)', display: 'flex', justifyContent: 'center' }}><AlertTriangle size={40} strokeWidth={1.5} /></div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '.5rem' }}>
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
