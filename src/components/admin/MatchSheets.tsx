// Zápis o utkání pro rozhodčí — tisk / PDF z prohlížeče.
// Jeden zápas = list A5 na šířku (2 na A4, rozstřihnout), přeložený napůl na kapesní A6:
// vlevo domácí, vpravo hosté. 15 řádků na tým (u větší soupisky se řádky zmenší).
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { useTournamentData } from '../../lib/TournamentDataContext'
import { buildFixtures } from '../../lib/fixtures'
import { fixtureId, findMatchDetail, type MatchDetail } from '../../lib/details'
import { getSportDef } from '../../lib/sports'
import { formatDateShort } from '../../lib/dates'
import { useBackClose } from '../../lib/useBackClose'
import type { Player } from '../../hooks/usePlayers'

const MIN_ROWS = 15
const MAX_ROWS = 22

const SHEET_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  #root { display: none !important; }
  .ms-print { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
  .ms-bar, .no-print { display: none !important; }
  .ms-sheet { margin: 0 !important; box-shadow: none !important; }
}
.ms-print { position: fixed; inset: 0; z-index: 2000; overflow-y: auto; background: #e5e7eb; padding: 1rem; color: #000; font-family: var(--font-body), Arial, sans-serif; }
.ms-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; max-width: 210mm; margin: 0 auto 1rem; padding: .7rem .9rem; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
.ms-bar__title { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; text-transform: uppercase; margin-right: auto; }
.ms-bar select { font: inherit; font-size: .85rem; padding: .35rem .5rem; border: 1px solid #cbd5e1; border-radius: 6px; }
.ms-bar label { display: inline-flex; align-items: center; gap: .35rem; font-size: .85rem; }
.ms-hint { max-width: 210mm; margin: -.5rem auto 1rem; font-size: .8rem; color: #475569; }
.ms-sheet { width: 210mm; height: 148.5mm; margin: 0 auto 6mm; background: #fff; display: flex; position: relative; box-shadow: 0 2px 10px rgba(0,0,0,.15); break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
.ms-sheet:nth-of-type(2n) { break-after: page; page-break-after: always; }
.ms-sheet::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; border-bottom: 1px dashed #9ca3af; }
.ms-panel { width: 105mm; height: 100%; padding: 6mm 6mm 5mm; display: flex; flex-direction: column; box-sizing: border-box; }
.ms-panel + .ms-panel { border-left: 1px dashed #9ca3af; }
.ms-top { display: flex; justify-content: space-between; gap: 2mm; font-size: 6.5pt; color: #374151; text-transform: uppercase; letter-spacing: .04em; }
.ms-top b { color: #000; }
.ms-top span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ms-top span:last-child { flex-shrink: 0; }
.ms-match { margin-top: 1.2mm; font-family: var(--font-display); font-weight: 800; font-size: 10pt; line-height: 1.05; text-transform: uppercase; }
.ms-meta { display: flex; flex-wrap: wrap; gap: .5mm 3mm; margin-top: 1mm; font-size: 7pt; }
.ms-team { margin-top: 2mm; padding: 1mm 1.5mm; background: #000; color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 9.5pt; text-transform: uppercase; display: flex; justify-content: space-between; gap: 2mm; }
.ms-team span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ms-table { width: 100%; border-collapse: collapse; table-layout: fixed; flex: 1; }
.ms-table th { font-size: 6pt; text-transform: uppercase; color: #374151; font-weight: 700; padding: .6mm .5mm; border-bottom: 1px solid #000; }
.ms-table td { border-bottom: .5px solid #9ca3af; border-right: .5px solid #d1d5db; font-size: 7.5pt; padding: 0 .8mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-table td:last-child { border-right: none; }
.ms-num { width: 7mm; text-align: center; font-weight: 700; }
.ms-box { width: 8mm; }
.ms-foot { margin-top: 2mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 3mm; font-size: 7pt; }
.ms-score { display: flex; align-items: center; gap: 1.5mm; font-family: var(--font-display); font-weight: 800; font-size: 9pt; text-transform: uppercase; }
.ms-score i { display: inline-block; width: 9mm; height: 7mm; border: 1px solid #000; }
.ms-sign { flex: 1; border-bottom: 1px solid #000; height: 6mm; position: relative; }
.ms-sign span { position: absolute; left: 0; bottom: -3.2mm; font-size: 5.5pt; color: #374151; text-transform: uppercase; }
.ms-checks { display: flex; gap: 2.5mm; font-size: 6.5pt; }
.ms-checks span::before { content: ''; display: inline-block; width: 2.6mm; height: 2.6mm; border: .6px solid #000; margin-right: .8mm; vertical-align: -.4mm; }
`

function rosterRows(players: Player[], teamId: string | null): (Player | null)[] {
  const list = teamId
    ? players.filter(p => p.team_id === teamId).sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'cs'))
    : []
  const n = Math.min(MAX_ROWS, Math.max(MIN_ROWS, list.length))
  return Array.from({ length: n }, (_, i) => list[i] ?? null)
}

export default function MatchSheets({ onClose, initialScope = 'all' }: { onClose: () => void; initialScope?: string }) {
  useBackClose(true, onClose, 'match-sheets')
  const data = useTournamentData()
  const { tournament, teams, players, groups, matches, bracketRounds, bracketSlots } = data
  const sport = getSportDef(tournament.sport)
  const hockey = sport.discipline === 'penaltyMinutes'
  const [scope, setScope] = useState(initialScope)
  const [onlyUnplayed, setOnlyUnplayed] = useState(true)

  const sheets = useMemo(() => {
    const fx = buildFixtures(matches, groups, bracketRounds, bracketSlots)
    return fx
      .filter(f => scope === 'all' || (scope === 'playoff' ? f.kind === 'playoff' : f.kind === 'group' && matches.find(m => `m-${m.id}` === f.key)?.group_id === scope))
      .filter(f => !onlyUnplayed || !f.played)
      .map(f => findMatchDetail(data, fixtureId(f)))
      .filter((m): m is MatchDetail => !!m)
  }, [data, matches, groups, bracketRounds, bracketSlots, scope, onlyUnplayed])

  const teamName = (id: string | null) => (id ? teams.find(t => t.id === id)?.name : null) ?? 'Určí se'

  const panel = (m: MatchDetail, side: 'home' | 'away') => {
    const teamId = side === 'home' ? m.home_id : m.away_id
    const rows = rosterRows(players, teamId)
    const rowH = Math.min(5.2, 82 / rows.length)
    return (
      <div className="ms-panel">
        <div className="ms-top">
          <span><b>Zápis o utkání</b> · {tournament.name}</span>
          <span>{side === 'home' ? 'Domácí' : 'Hosté'}</span>
        </div>
        <div className="ms-match">{teamName(m.home_id)} – {teamName(m.away_id)}</div>
        <div className="ms-meta">
          <span>{m.label}</span>
          {m.match_date && <span>{formatDateShort(m.match_date)}</span>}
          <span>{sport.terms.kickoffLabel} {m.scheduled_time || '____'}</span>
          {m.pitch && <span>{m.pitch}</span>}
          <span>Rozhodčí: {m.referee || '______________'}</span>
        </div>
        <div className="ms-team"><span>{teamName(teamId)}</span><span>{side === 'home' ? 'D' : 'H'}</span></div>
        <table className="ms-table">
          <thead>
            <tr>
              <th className="ms-num">#</th>
              <th style={{ textAlign: 'left' }}>Hráč</th>
              <th className="ms-box">Gól</th>
              <th className="ms-box">As.</th>
              {hockey
                ? <th className="ms-box" style={{ width: '11mm' }}>Tr. min</th>
                : <><th className="ms-box">ŽK</th><th className="ms-box">ČK</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i} style={{ height: `${rowH}mm` }}>
                <td className="ms-num">{p?.number ?? ''}</td>
                <td>{p?.name ?? ''}</td>
                <td /><td />
                {hockey ? <td /> : <><td /><td /></>}
              </tr>
            ))}
          </tbody>
        </table>
        {side === 'home' ? (
          <div className="ms-foot">
            <span>Góly týmu celkem: ______</span>
          </div>
        ) : (
          <div className="ms-foot" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '3mm' }}>
              <div className="ms-score">Výsledek <i /> : <i /></div>
              {sport.standings.allowDraws
                ? <div className="ms-checks"><span>Poločas __:__</span></div>
                : <div className="ms-checks"><span>Prodl.</span><span>Nájezdy</span></div>}
            </div>
            <div style={{ display: 'flex', gap: '4mm', marginTop: '2.5mm' }}>
              <div className="ms-sign"><span>Podpis rozhodčího</span></div>
              <div className="ms-sign"><span>Kapitáni</span></div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return createPortal(
    <div className="ms-print">
      <style>{SHEET_CSS}</style>
      <div className="ms-bar">
        <span className="ms-bar__title">Zápisy o utkání</span>
        <select value={scope} onChange={e => setScope(e.target.value)} aria-label="Které zápasy">
          <option value="all">Všechny zápasy</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          {bracketSlots.length > 0 && <option value="playoff">Play-off</option>}
        </select>
        <label><input type="checkbox" checked={onlyUnplayed} onChange={e => setOnlyUnplayed(e.target.checked)} />Jen neodehrané</label>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => window.print()} style={{ opacity: sheets.length ? 1 : 0.5 }}>
          <Printer size={15} />Tisknout ({sheets.length})
        </button>
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={onClose}><X size={15} />Zavřít</button>
      </div>
      <p className="ms-hint no-print">
        Tisk na A4 na výšku bez okrajů (v dialogu tisku „Okraje: žádné“, měřítko 100 %). Každý list rozstřihněte podél čárkované čáry
        na dvě karty a každou přeložte napůl — vznikne kapesní zápis A6 (domácí / hosté). Uložit do PDF lze přes „Uložit jako PDF“.
      </p>
      {sheets.length === 0 && <p className="ms-hint no-print">Žádné zápasy pro tento výběr.</p>}
      {sheets.map(m => (
        <div key={m.id} className="ms-sheet">
          {panel(m, 'home')}
          {panel(m, 'away')}
        </div>
      ))}
    </div>,
    document.body,
  )
}
