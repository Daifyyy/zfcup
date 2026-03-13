import type { Tab } from '../../App'
import type { Tournament } from '../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
  tab: Tab
  onTab: (t: Tab) => void
  onAdmin: () => void
  onKiosk: () => void
  onScoreboard: () => void
  isAdmin: boolean
}

const TABS: [Tab, string][] = [
  ['overview',  'Přehled'],
  ['teams',     'Týmy'],
  ['results',   'Výsledky'],
  ['standings', 'Tabulka'],
  ['scorers',   'Střelci'],
  ['bracket',   'Pavouk'],
]

export default function Header({ tournament, tab, onTab, onAdmin, onKiosk, onScoreboard, isAdmin }: Props) {
  const meta = [tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).join(' · ')

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,.96)',
      backdropFilter: 'blur(16px)',
      borderBottom: '2px solid var(--border)',
      boxShadow: '0 2px 12px rgba(0,0,0,.06)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        display: 'flex', alignItems: 'center',
        gap: '.9rem', height: 64, padding: '0 2rem',
      }}>
        {/* Logo */}
        <button
          onClick={onAdmin}
          title={isAdmin ? 'Admin panel (přihlášen)' : 'Admin panel (Ctrl+Shift+A)'}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--accent)',
            border: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 3px 10px rgba(37,99,235,.4)',
            transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 5px 16px rgba(37,99,235,.5)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = ''
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(37,99,235,.4)'
          }}
        >
          ⚽
        </button>

        {/* Tournament name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.5rem', letterSpacing: '.05em',
            lineHeight: 1.05, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            color: 'var(--text)',
          }}>
            {tournament?.name || 'Firemní turnaj'}
          </h1>
          {meta && (
            <div style={{ fontSize: '.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.12em', marginTop: 1 }}>
              {meta}
            </div>
          )}
        </div>

        {/* Scoreboard button — desktop only */}
        <button
          className="desktop-only"
          onClick={onScoreboard}
          title="Výsledková tabule — fullscreen přehled skupin, zápasů a pavouka"
          style={{
            background: 'none', border: '1.5px solid var(--border)',
            borderRadius: 9, color: 'var(--muted)',
            fontSize: '.72rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.07em',
            padding: '.35rem .85rem', cursor: 'pointer',
            transition: 'all .15s', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '.35rem',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--accent)'
            el.style.color = 'var(--accent)'
            el.style.background = 'var(--accent-dim)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--border)'
            el.style.color = 'var(--muted)'
            el.style.background = 'none'
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>📋</span>
          <span className="hide-mobile">Tabule</span>
        </button>

        {/* Kiosk button — desktop only */}
        <button
          className="desktop-only"
          onClick={onKiosk}
          title="Kiosk / TV mode — fullscreen, auto-rotace záložek"
          style={{
            background: 'none', border: '1.5px solid var(--border)',
            borderRadius: 9, color: 'var(--muted)',
            fontSize: '.72rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.07em',
            padding: '.35rem .85rem', cursor: 'pointer',
            transition: 'all .15s', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '.35rem',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--accent)'
            el.style.color = 'var(--accent)'
            el.style.background = 'var(--accent-dim)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--border)'
            el.style.color = 'var(--muted)'
            el.style.background = 'none'
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>📺</span>
          <span className="hide-mobile">TV / Kiosk</span>
        </button>

        {/* Nav — desktop only */}
        <nav className="desktop-only" style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto' }}>
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => onTab(key)}
              style={{
                background: 'none', border: 'none',
                color: tab === key ? 'var(--accent)' : 'var(--muted)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '.74rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.09em',
                padding: '0 .85rem', height: 64,
                cursor: 'pointer', transition: 'color .2s',
                whiteSpace: 'nowrap', flexShrink: 0,
                borderBottom: tab === key ? '3px solid var(--accent)' : '3px solid transparent',
                marginBottom: tab === key ? 0 : 0,
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
