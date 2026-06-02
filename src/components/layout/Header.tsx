import type { Tab } from '../../App'
import type { Tournament } from '../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
  tab: Tab
  onTab: (t: Tab) => void
  onAdmin: () => void
  onKiosk: () => void
  onScoreboard: () => void
  onPrint?: () => void
  onHome?: () => void
  isAdmin: boolean
  tipsEnabled?: boolean
  showBracket?: boolean
  cardsEnabled?: boolean
  sponsorsEnabled?: boolean
}

const BASE_TABS: [Tab, string][] = [
  ['overview',    'Přehled'],
  ['teams',       'Týmy'],
  ['results',     'Zápasy'],
  ['standings',   'Tabulka'],
  ['statistics',  'Statistiky'],
  ['bracket',     'Pavouk'],
  ['rules',       'Pravidla'],
]

export default function Header({ tournament, tab, onTab, onAdmin, onKiosk, onScoreboard, onPrint, onHome, isAdmin, tipsEnabled, showBracket = true, cardsEnabled, sponsorsEnabled }: Props) {
  const baseTabs: [Tab, string][] = showBracket ? BASE_TABS : BASE_TABS.filter(([key]) => key !== 'bracket')
  let TABS: [Tab, string][] = [...baseTabs]
  if (tipsEnabled) TABS = [...TABS, ['tips', 'Tipy']]
  if (sponsorsEnabled) TABS = [...TABS, ['sponsors', 'Sponzoři']]
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
        gap: '.9rem', minHeight: 64, padding: '.5rem 2rem',
      }}>
        {/* Admin button */}
        <button
          type="button"
          onClick={onAdmin}
          title={isAdmin ? 'Admin panel (přihlášen)' : 'Admin panel (Ctrl+Shift+A)'}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#f1f5f9',
            border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, cursor: 'pointer', flexShrink: 0,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9' }}
        >
          ⚽
        </button>

        {/* Back to tournament list */}
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            title="Zpět na přehled turnajů"
            style={{
              height: 38, borderRadius: 10,
              background: '#f1f5f9',
              border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '.3rem',
              padding: '0 .65rem',
              fontSize: '.7rem', fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '.07em',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = '#e2e8f0'
              el.style.color = 'var(--accent)'
              el.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = '#f1f5f9'
              el.style.color = 'var(--muted)'
              el.style.borderColor = 'var(--border)'
            }}
          >
            <span style={{ fontSize: '.85rem' }}>←</span>
            <span className="hide-mobile">Turnaje</span>
          </button>
        )}

        {/* Tournament name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(1.1rem, 2.8vw, 1.5rem)', letterSpacing: '.05em',
            lineHeight: 1.1,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'break-word',
            color: 'var(--text)',
          }}>
            {tournament?.name || 'Turnajník'}
          </h1>
          {meta && (
            <div style={{ fontSize: '.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.12em', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta}
            </div>
          )}
        </div>

        {/* Scoreboard button — desktop only */}
        <button
          type="button"
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

        {/* Print bulletin button — desktop only */}
        {onPrint && (
          <button
            type="button"
            className="desktop-only"
            onClick={onPrint}
            title="Tisknutelný bulletin — program turnaje pro tisk"
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
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>🖨️</span>
            <span className="hide-mobile">Bulletin</span>
          </button>
        )}

        {/* Kiosk button — desktop only */}
        <button
          type="button"
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
              type="button"
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
