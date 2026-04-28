import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import type { Tournament } from '../../hooks/useTournament'
import type { Group } from '../../hooks/useGroups'

interface Props {
  tournament: Tournament | null
  groups: Group[]
  onClose: () => void
}

const PRINT_CSS = `
@media print {
  #root { display: none !important; }
  .tg-wrap {
    position: static !important;
    background: white !important;
    padding: 0 !important;
    overflow: visible !important;
    z-index: auto !important;
    display: block !important;
  }
  .tg-chrome { display: none !important; }
  .tg-page {
    max-width: none !important;
    width: 100% !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
  }
  .tg-a4 { padding: 1.2cm 1.5cm !important; }
  .tg-pts-box { background: #f0f4ff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .tg-step-num { background: #2563eb !important; color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .tg-qr-box { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`

export default function TipsGuideModal({ tournament, groups, onClose }: Props) {
  const [url, setUrl] = useState(window.location.origin + window.location.pathname)

  // Inject + cleanup print CSS
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = PRINT_CSS
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const tname = tournament?.name || 'ZF CUP'
  const tmeta = [tournament?.date, tournament?.venue].filter(Boolean).join(' · ')
  const isLeague = tournament?.format === 'league'

  // Group names for special tips section
  const nonLigaGroups = groups.filter(g => g.name !== 'Liga')

  const content = (
    <div
      className="tg-wrap"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.55)',
        zIndex: 2000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '1.5rem 1rem',
        overflow: 'auto',
      }}
    >
      <div
        className="tg-page"
        style={{
          background: '#fff', borderRadius: 12,
          width: 'min(580px, 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
          display: 'flex', flexDirection: 'column',
          marginBottom: '1.5rem',
        }}
      >
        {/* Chrome — URL input + buttons */}
        <div
          className="tg-chrome"
          style={{
            padding: '.75rem 1rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: '.5rem',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
            URL:
          </span>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{
              flex: 1, fontSize: '.75rem', padding: '.28rem .5rem',
              border: '1px solid #e2e8f0', borderRadius: 6,
              fontFamily: 'monospace', color: '#0f172a',
            }}
          />
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: '.38rem .85rem',
              background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '.75rem', fontWeight: 700,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            🖨️ Tisknout / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '.38rem .6rem',
              background: '#f1f5f9', color: '#64748b',
              border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer',
              fontSize: '.8rem', fontWeight: 700, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* A4 content */}
        <div
          className="tg-a4"
          style={{ padding: '1.75rem', fontFamily: "'DM Sans', sans-serif", color: '#0f172a' }}
        >
          {/* Header */}
          <div style={{ borderBottom: '3px solid #2563eb', paddingBottom: '.65rem', marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.9rem', letterSpacing: '.06em', lineHeight: 1.1 }}>
              {tname}
            </div>
            {tmeta && (
              <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: '.2rem' }}>{tmeta}</div>
            )}
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.55rem', letterSpacing: '.12em', color: '#2563eb' }}>
              TIPOVAČKA — JAK HRÁT
            </div>
            <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: '.15rem' }}>
              Tipuj výsledky zápasů a sbírej body · vítěz získá slávu navěky
            </div>
          </div>

          {/* QR + URL */}
          <div
            className="tg-qr-box"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '.6rem', marginBottom: '1.4rem',
              padding: '1.1rem', background: '#f8fafc',
              borderRadius: 12, border: '1px solid #e2e8f0',
            }}
          >
            <QRCodeSVG
              value={url || 'https://example.com'}
              size={164}
              fgColor="#0f172a"
              bgColor="#f8fafc"
            />
            <div style={{ fontSize: '.68rem', color: '#64748b', textAlign: 'center', wordBreak: 'break-all', maxWidth: 320 }}>
              {url}
            </div>
            <div style={{ fontSize: '.67rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Skenuj QR kód nebo navštiv adresu výše
            </div>
          </div>

          {/* Steps */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#94a3b8', marginBottom: '.65rem' }}>
              Postup
            </div>
            {[
              {
                title: 'Otevřete stránku turnaje',
                desc: 'Naskenujte QR kód fotoaparátem nebo napište adresu do prohlížeče.'
              },
              {
                title: 'Klepněte na záložku „Tipy"',
                desc: 'Záložka je v dolní navigaci. Pokud ji nevidíte, tipy ještě nebyly otevřeny administrátorem.'
              },
              {
                title: 'Zaregistrujte se nebo přihlaste',
                desc: 'Zadejte křestní jméno a příjmení, zvolte si 4místný PIN. PIN si zapamatujte — slouží k přihlášení na každém zařízení.'
              },
              {
                title: 'Zadejte speciální tipy',
                desc: `Vítěz turnaje, ${isLeague ? 'vítěz a poslední ligové fáze' : nonLigaGroups.length ? `vítěz a poslední každé skupiny (${nonLigaGroups.map(g => g.name).join(', ')})` : 'vítěz a poslední skupiny'}. Zamknou se po prvním odehraném zápase.`
              },
              {
                title: 'Tipujte výsledky zápasů',
                desc: 'Zadejte předpokládané skóre každého zápasu. Tipy se automaticky uloží. Každý zápas se uzamkne v čas výkopu.'
              },
              {
                title: 'Sledujte žebříček',
                desc: 'Body se přičítají automaticky po každém odehraném zápase. Pořadí vidíte v záložce Tipy → Žebříček.'
              },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '.65rem', marginBottom: '.6rem', alignItems: 'flex-start' }}>
                <div
                  className="tg-step-num"
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#2563eb', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '.82rem',
                    flexShrink: 0, marginTop: 1,
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: 700, lineHeight: 1.3 }}>{s.title}</div>
                  <div style={{ fontSize: '.73rem', color: '#64748b', lineHeight: 1.45 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Points table */}
          <div
            className="tg-pts-box"
            style={{
              background: '#f0f4ff', borderRadius: 10,
              padding: '.9rem 1rem', marginBottom: '.9rem',
              border: '1px solid rgba(37,99,235,.15)',
            }}
          >
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '.88rem', letterSpacing: '.1em', color: '#2563eb', marginBottom: '.55rem' }}>
              BODOVÉ OHODNOCENÍ
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.74rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(37,99,235,.2)' }}>
                  <th style={{ textAlign: 'left', padding: '.18rem .3rem', fontWeight: 700 }}>Kategorie</th>
                  <th style={{ textAlign: 'center', padding: '.18rem .3rem', fontWeight: 700, color: '#16a34a' }}>Přesný výsledek</th>
                  <th style={{ textAlign: 'center', padding: '.18rem .3rem', fontWeight: 700, color: '#64748b' }}>Správný vítěz / X</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Skupinové / ligové zápasy', exact: '3 b.', dir: '1 b.' },
                  { label: 'Play-off zápasy', exact: '5 b.', dir: '2 b.' },
                  { label: 'Finále', exact: '8 b.', dir: '3 b.' },
                ].map(row => (
                  <tr key={row.label} style={{ borderBottom: '1px solid rgba(37,99,235,.1)' }}>
                    <td style={{ padding: '.22rem .3rem' }}>{row.label}</td>
                    <td style={{ padding: '.22rem .3rem', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{row.exact}</td>
                    <td style={{ padding: '.22rem .3rem', textAlign: 'center', color: '#64748b' }}>{row.dir}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '.55rem', fontSize: '.72rem', color: '#64748b', lineHeight: 1.5 }}>
              <strong style={{ color: '#0f172a' }}>Speciální tipy: </strong>
              Vítěz turnaje <strong>10 b.</strong>
              {' · '}
              {isLeague ? 'Vítěz ligy' : 'Vítěz skupiny'} <strong>5 b.</strong>
              {' · '}
              {isLeague ? 'Poslední v lize' : 'Poslední skupiny'} <strong>3 b.</strong>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ fontSize: '.7rem', color: '#64748b', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '.7rem', lineHeight: 1.5 }}>
            ⏰ Tipy na každý zápas se uzamknou automaticky v čas výkopu — sleduj čas začátku!
            <br />
            📱 Funguje v mobilním prohlížeči na jakémkoliv telefonu, bez instalace.
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
