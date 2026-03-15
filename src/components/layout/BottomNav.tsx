import type { Tab } from '../../App'

const BASE_TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'overview',  icon: '🏠', label: 'Přehled'  },
  { key: 'teams',     icon: '👥', label: 'Týmy'      },
  { key: 'results',   icon: '📋', label: 'Zápasy'    },
  { key: 'standings', icon: '📊', label: 'Tabulka'   },
  { key: 'scorers',   icon: '⚽', label: 'Střelci'   },
  { key: 'bracket',   icon: '🏆', label: 'Pavouk'    },
]

interface Props {
  tab: Tab
  onTab: (t: Tab) => void
  tipsEnabled?: boolean
}

export default function BottomNav({ tab, onTab, tipsEnabled }: Props) {
  const TABS = tipsEnabled
    ? [...BASE_TABS, { key: 'tips' as Tab, icon: '🎯', label: 'Tipy' }]
    : BASE_TABS

  return (
    <nav
      className="mobile-only"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -2px 16px rgba(0,0,0,.08)',
        display: 'flex',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)',
      }}
    >
      {TABS.map(t => {
        const active = tab === t.key
        return (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '.15rem',
              padding: '.6rem .1rem .55rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--accent)' : '#94a3b8',
              transition: 'color .15s',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute',
                top: 0, left: '20%', right: '20%',
                height: 2,
                background: 'var(--accent)',
                borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: '.58rem', fontWeight: active ? 700 : 500,
              textTransform: 'uppercase', letterSpacing: '.05em',
              lineHeight: 1,
            }}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
