import type { Sponsor } from '../../hooks/useSponsors'

interface Props {
  sponsors: Sponsor[]
}

export default function Sponsors({ sponsors }: Props) {
  if (!sponsors.length) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 1rem', fontFamily: 'DM Sans, sans-serif' }}>
        Žádní sponzoři zatím nebyli přidáni.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
        {sponsors.map(s => (
          <SponsorCard key={s.id} sponsor={s} />
        ))}
      </div>
    </div>
  )
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const content = (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '1.25rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '.75rem',
      boxShadow: 'var(--shadow-card)',
      transition: 'box-shadow .15s, border-color .15s',
      cursor: sponsor.website_url ? 'pointer' : 'default',
    }}
      onMouseEnter={e => {
        if (!sponsor.website_url) return
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 4px 16px rgba(37,99,235,.12)'
        el.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = 'var(--shadow-card)'
        el.style.borderColor = 'var(--border)'
      }}
    >
      {sponsor.logo_url ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          style={{ width: 120, height: 70, objectFit: 'contain' }}
        />
      ) : (
        <div style={{
          width: 120, height: 70,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-dim)', borderRadius: 8,
          fontSize: '.8rem', fontWeight: 600, color: 'var(--accent)',
          fontFamily: 'DM Sans, sans-serif', textAlign: 'center', padding: '.25rem',
        }}>
          {sponsor.name}
        </div>
      )}
      {sponsor.name && (
        <div style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '.78rem',
          color: 'var(--muted)',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          {sponsor.name}
        </div>
      )}
    </div>
  )

  if (sponsor.website_url) {
    return (
      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        {content}
      </a>
    )
  }
  return content
}
