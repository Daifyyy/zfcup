interface Props {
  message: string
  show: boolean
}

export default function Toast({ message, show }: Props) {
  return (
    <div style={{ position: 'fixed', bottom: '1.2rem', right: '1.3rem', zIndex: 3000, pointerEvents: 'none' }}>
      <div
        role="status"
        aria-live="polite"
        style={{
          background: 'var(--chrome)',
          color: 'var(--chrome-ink)',
          padding: '.65rem 1.1rem',
          borderRadius: 'var(--radius)',
          borderLeft: '3px solid var(--brand)',
          fontSize: '.82rem',
          fontWeight: 500,
          boxShadow: 'var(--shadow-lg)',
          transform: show ? 'translateY(0)' : 'translateY(16px)',
          opacity: show ? 1 : 0,
          transition: 'all .25s',
        }}
      >
        {message}
      </div>
    </div>
  )
}
