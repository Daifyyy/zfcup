import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BRAND } from '../../lib/brand'
import { calcGroupStandings } from '../../lib/standings'
import { getSportDef, sportHasOvertime } from '../../lib/sports'
import { compareRounds } from '../../lib/leagueSchedule'
import { formatDateShort } from '../../lib/dates'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import { copyrightLine } from '../layout/SiteFooter'

interface Props {
  tournament: Tournament
  teams: Team[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  onClose: () => void
}

// Tisková šablona — barvy jsou pro papír záměrně natvrdo (jako sdílecí šablony).
// Bulletin se vykresluje přes portál do <body>; v tisku se skryje #root (aplikace)
// a vytiskne se jen bulletin.
const PRINT_CSS = `
@page { size: A4 portrait; margin: 1.2cm 1.4cm; }
@media print {
  #root { display: none !important; }
  .print-bulletin { position: static !important; overflow: visible !important; padding: 0 !important; z-index: auto !important; }
  .no-print { display: none !important; }
}
.print-bulletin { color: #111; font-family: var(--font-body), Arial, sans-serif; }
.bulletin-inner { max-width: 820px; margin: 0 auto; }
.bulletin-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
.bulletin-table th, .bulletin-table td { border: 1px solid #ccc; padding: 3px 6px; }
.bulletin-table th { background: #f0f0f0; font-weight: 700; }
.bulletin-table tr { break-inside: avoid; }
.bulletin-section { margin-bottom: 18px; }
.bulletin-section-title { font-size: 13px; font-weight: 700; border-bottom: 2px solid #333; margin-bottom: 6px; padding-bottom: 2px; break-after: avoid; }
.bulletin-c { text-align: center; }
.bulletin-nowrap { white-space: nowrap; }
`

const DECIDED: Record<string, string> = { ot: ' PP', so: ' SN' }

function scoreText(m: { played: boolean; home_score: number | null; away_score: number | null; decided_in?: string | null }) {
  if (!m.played) return '–:–'
  return `${m.home_score ?? 0}:${m.away_score ?? 0}${DECIDED[m.decided_in ?? ''] ?? ''}`
}

export default function PrintBulletin({ tournament, teams, groups, matches, bracketRounds, bracketSlots, onClose }: Props) {
  const sportDef = getSportDef(tournament.sport)
  const hasOt = sportHasOvertime(sportDef)
  const allowDraws = sportDef.standings.allowDraws
  const isLeague = tournament.format === 'league'
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const tn = (id: string | null, empty = '—') => (id ? teamName.get(id) ?? '?' : empty)

  const hasDates = matches.some(m => m.match_date) || bracketSlots.some(s => s.match_date)

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const sortedRounds = [...bracketRounds].sort((a, b) => a.position - b.position)

  const groupMatches = (groupId: string) =>
    matches.filter(m => m.group_id === groupId).sort((a, b) =>
      (a.match_date ?? '').localeCompare(b.match_date ?? '')
      || compareRounds(a.round ?? '', b.round ?? '')
      || (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))

  const groupSections = sortedGroups
    .map(g => {
      const gMatches = groupMatches(g.id)
      const standings = calcGroupStandings(g, gMatches, sportDef)
      return { g, gMatches, standings }
    })
    // Prázdné skupiny (bez týmů i zápasů) do bulletinu nepatří.
    .filter(s => s.gMatches.length > 0 || s.standings.length > 0)

  const roundSections = sortedRounds
    .map(round => ({
      round,
      slots: bracketSlots.filter(s => s.round_id === round.id).sort((a, b) => a.position - b.position),
    }))
    .filter(r => r.slots.length > 0)

  const isEmpty = groupSections.length === 0 && roundSections.length === 0

  // Automatický tisk jen jednou za otevření (a jen když je co tisknout).
  const printed = useRef(false)
  useEffect(() => {
    if (printed.current || isEmpty) return
    const timer = setTimeout(() => { printed.current = true; window.print() }, 400)
    return () => clearTimeout(timer)
  }, [isEmpty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const scheduleHead = (
    <tr>
      {hasDates && <th style={{ width: 52 }}>Datum</th>}
      <th style={{ width: 44 }}>Čas</th>
      <th>Domácí</th>
      <th className="bulletin-c" style={{ width: 64 }}>Výsledek</th>
      <th>Hosté</th>
    </tr>
  )

  const content = (
    <div className="print-bulletin" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#fff', overflowY: 'auto', padding: '2rem' }}>
      <style>{PRINT_CSS}</style>
      <div className="bulletin-inner">
        <div className="no-print" style={{ marginBottom: '1rem', display: 'flex', gap: '.75rem' }}>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => window.print()}>Tisknout</button>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose}>Zavřít</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>{tournament.name}</div>
          {tournament.subtitle && <div style={{ fontSize: 13 }}>{tournament.subtitle}</div>}
          <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
            {[tournament.date, tournament.venue].filter(Boolean).join(' · ')}
          </div>
        </div>

        {isEmpty && (
          <div style={{ textAlign: 'center', color: '#555', fontSize: 13, padding: '2rem 0' }}>
            Rozpis zápasů zatím není k dispozici.
          </div>
        )}

        {groupSections.map(({ g, gMatches, standings }) => (
          <div key={g.id} className="bulletin-section">
            <div className="bulletin-section-title">
              {isLeague ? 'Liga' : /^skupina\b/i.test(g.name) ? g.name : `Skupina ${g.name}`}
            </div>

            {gMatches.length > 0 && (
              <table className="bulletin-table" style={{ marginBottom: 8 }}>
                <thead>{scheduleHead}</thead>
                <tbody>
                  {gMatches.map(m => (
                    <tr key={m.id}>
                      {hasDates && <td className="bulletin-nowrap">{formatDateShort(m.match_date) || '—'}</td>}
                      <td className="bulletin-nowrap">{m.scheduled_time || '—'}</td>
                      <td>{tn(m.home_id)}</td>
                      <td className="bulletin-c bulletin-nowrap" style={{ fontWeight: 700 }}>{scoreText(m)}</td>
                      <td>{tn(m.away_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {standings.length > 0 && (
              <table className="bulletin-table">
                <thead>
                  <tr>
                    <th className="bulletin-c" style={{ width: 24 }}>#</th>
                    <th>Tým</th>
                    <th className="bulletin-c" style={{ width: 28 }}>Z</th>
                    <th className="bulletin-c" style={{ width: 28 }}>V</th>
                    {hasOt && <th className="bulletin-c" style={{ width: 28 }}>VP</th>}
                    {allowDraws && <th className="bulletin-c" style={{ width: 28 }}>R</th>}
                    {hasOt && <th className="bulletin-c" style={{ width: 28 }}>PP</th>}
                    <th className="bulletin-c" style={{ width: 28 }}>P</th>
                    <th className="bulletin-c" style={{ width: 48 }}>Skóre</th>
                    <th className="bulletin-c" style={{ width: 36 }}>Body</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.id} style={{ background: i === 0 ? '#f0fff4' : 'transparent' }}>
                      <td className="bulletin-c">{i + 1}</td>
                      <td>{tn(row.id, '?')}</td>
                      <td className="bulletin-c">{row.played}</td>
                      <td className="bulletin-c">{row.w}</td>
                      {hasOt && <td className="bulletin-c">{row.otw}</td>}
                      {allowDraws && <td className="bulletin-c">{row.d}</td>}
                      {hasOt && <td className="bulletin-c">{row.otl}</td>}
                      <td className="bulletin-c">{row.l}</td>
                      <td className="bulletin-c bulletin-nowrap">{row.gf}:{row.ga}</td>
                      <td className="bulletin-c" style={{ fontWeight: 700 }}>{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {roundSections.length > 0 && (
          <div className="bulletin-section">
            <div className="bulletin-section-title">Play-off</div>
            {roundSections.map(({ round, slots }) => (
              <div key={round.id} style={{ marginBottom: 10, breakInside: 'avoid' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{round.name}</div>
                <table className="bulletin-table">
                  <thead>{scheduleHead}</thead>
                  <tbody>
                    {slots.map(s => (
                      <tr key={s.id}>
                        {hasDates && <td className="bulletin-nowrap">{formatDateShort(s.match_date) || '—'}</td>}
                        <td className="bulletin-nowrap">{s.scheduled_time || '—'}</td>
                        <td>{tn(s.home_id, 'Určí se')}</td>
                        <td className="bulletin-c bulletin-nowrap" style={{ fontWeight: 700 }}>{scoreText(s)}</td>
                        <td>{tn(s.away_id, 'Určí se')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 20 }}>
          Generováno aplikací {BRAND.name} · {copyrightLine()}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
