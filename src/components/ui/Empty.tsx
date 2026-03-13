interface Props {
  icon: string
  text: string
}

export default function Empty({ icon, text }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.2rem', opacity: .35, marginBottom: '.65rem' }}>{icon}</div>
      <div style={{ fontSize: '.83rem' }}>{text}</div>
    </div>
  )
}
