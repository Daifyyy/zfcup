interface Props {
  message: string
  show: boolean
}

export default function Toast({ message, show }: Props) {
  return (
    <div style={{ position: 'fixed', bottom: '1.2rem', right: '1.3rem', zIndex: 3000, pointerEvents: 'none' }}>
      <div style={{
        background: '#0f172a',
        color: '#fff',
        padding: '.58rem 1.1rem',
        borderRadius: 9,
        fontSize: '.79rem',
        boxShadow: '0 4px 24px rgba(0,0,0,.18)',
        transform: show ? 'translateY(0)' : 'translateY(16px)',
        opacity: show ? 1 : 0,
        transition: 'all .25s',
        border: '1px solid rgba(37,99,235,.3)',
      }}>
        {message}
      </div>
    </div>
  )
}
