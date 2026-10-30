// Report pro partnery po akci (modul partner_reach) — tisk / PDF, A4 na výšku, jedna strana na partnera.
// Data: součty z partner_stats (RPC partner_report, jen vlastník turnaje) — skeny QR, zobrazení
// spotu na TV, minuty běhu TV, návštěvy webu. Tisková šablona má vlastní barvy grafu (výjimka z tokenů).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { useTournamentData } from '../../lib/TournamentDataContext'
import { useBackClose } from '../../lib/useBackClose'
import { fetchReport, REACH_SOURCE_LABEL, type ReachReport } from '../../lib/partnerReach'
import { sortByTier, tierLabel, tierOf, type PartnerTier } from '../../lib/partners'
import type { Sponsor } from '../../hooks/useSponsors'

const CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  #root { display: none !important; }
  .pr-print { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
  .pr-bar, .no-print { display: none !important; }
  .pr-sheet { margin: 0 !important; box-shadow: none !important; }
}
.pr-print { position: fixed; inset: 0; z-index: 2000; overflow-y: auto; background: #e5e7eb; padding: 1rem; color: #0b1220; font-family: var(--font-body), Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pr-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; max-width: 210mm; margin: 0 auto 1rem; padding: .7rem .9rem; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
.pr-bar__title { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; text-transform: uppercase; margin-right: auto; }
.pr-bar select { font: inherit; font-size: .85rem; padding: .35rem .5rem; border: 1px solid #cbd5e1; border-radius: 6px; }
.pr-hint { max-width: 210mm; margin: -.5rem auto 1rem; font-size: .8rem; color: #475569; }
.pr-sheet { width: 210mm; min-height: 297mm; margin: 0 auto 6mm; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); break-after: page; page-break-after: always; box-sizing: border-box; padding: 16mm 16mm 14mm; position: relative; }
.pr-sheet::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4mm; background: var(--brand); }
.pr-top { display: flex; justify-content: space-between; align-items: center; gap: 6mm; font-size: 9pt; color: #475569; }
.pr-top img { height: 12mm; max-width: 30mm; object-fit: contain; }
.pr-kicker { margin-top: 9mm; font-size: 9pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--brand); }
.pr-partner { display: flex; align-items: center; gap: 6mm; margin-top: 3mm; }
.pr-partner img { height: 20mm; max-width: 60mm; object-fit: contain; }
.pr-partner h1 { font-family: var(--font-display); font-weight: 800; font-size: 26pt; line-height: 1; text-transform: uppercase; margin: 0; }
.pr-partner small { display: block; margin-top: 1.5mm; font-size: 10pt; color: #475569; }
.pr-period { margin-top: 4mm; font-size: 9.5pt; color: #334155; }
.pr-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 7mm; }
.pr-tile { border: .3mm solid #e2e8f0; border-top: 1.2mm solid var(--brand); border-radius: 2mm; padding: 3mm; }
.pr-tile b { display: block; font-family: var(--font-display); font-weight: 800; font-size: 24pt; line-height: 1; }
.pr-tile span { display: block; margin-top: 1.5mm; font-size: 8pt; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
.pr-h2 { margin: 8mm 0 3mm; font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.pr-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
.pr-table td { padding: 1.6mm 0; border-bottom: .3mm solid #e2e8f0; }
.pr-table td:last-child { text-align: right; font-weight: 700; }
.pr-chart { display: flex; align-items: flex-end; gap: 1.2mm; height: 32mm; border-bottom: .3mm solid #94a3b8; }
.pr-chart div { flex: 1; background: var(--brand); border-radius: .8mm .8mm 0 0; min-height: .5mm; }
.pr-chart-labels { display: flex; gap: 1.2mm; font-size: 6.5pt; color: #64748b; margin-top: 1mm; }
.pr-chart-labels span { flex: 1; text-align: center; overflow: hidden; }
.pr-list { margin: 0; padding-left: 5mm; font-size: 10pt; line-height: 1.6; }
.pr-note { margin-top: 8mm; font-size: 7.5pt; color: #64748b; line-height: 1.5; }
`

/** Kde se logo partnera objevilo (podle úrovně a zapnutých modulů turnaje). */
function placements(tier: PartnerTier, opts: { tv: boolean; spots: boolean; press: boolean }): string[] {
  const out: string[] = []
  if (tier === 'title') out.push('Hlavička webu turnaje „Presented by“ a úvodní stránka turnaje (Přehled)')
  out.push('Stránka Partneři na webu turnaje')
  if (opts.tv) out.push('Lišta partnerů v TV režimu a na TV tabuli')
  if (opts.spots) out.push('Spot přes celou obrazovku v rotaci TV režimu')
  out.push(tier === 'title' ? 'Sdílecí grafiky na sociální sítě („Presented by“ v patičce, s QR akcí)' : 'Sdílecí grafiky na sociální sítě (patička s partnery)')
  out.push('Boční loga na webu na velkých obrazovkách')
  if (opts.press) out.push('Mediální servis a bulletin turnaje')
  return out
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit' })

export default function PartnerReport({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose, 'partner-report')
  const d = useTournamentData()
  const t = d.tournament
  const [report, setReport] = useState<ReachReport | null>(null)
  const [error, setError] = useState('')
  const [only, setOnly] = useState('all')

  useEffect(() => {
    let cancelled = false
    fetchReport(t.id).then(r => { if (!cancelled) ('error' in r ? setError(r.error) : setReport(r)) })
    return () => { cancelled = true }
  }, [t.id])

  const sponsors = sortByTier(d.sponsors ?? []).filter(s => only === 'all' || s.id === only)
  const tvHours = report ? Math.round((report.tvMinutes / 60) * 10) / 10 : 0

  const sheet = (s: Sponsor) => {
    const p = report?.partners.get(s.id)
    const tier = tierOf(s)
    const hours = p?.scansByHour ?? []
    const max = Math.max(1, ...hours.map(h => h.count))
    return (
      <div key={s.id} className="pr-sheet">
        <div className="pr-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4mm' }}>
            {t.logo_url && <img src={t.logo_url} alt="" />}
            <div><b style={{ color: '#0b1220' }}>{t.name}</b><br />{[t.date, t.venue].filter(Boolean).join(' · ')}</div>
          </div>
          <div>Report pro partnera</div>
        </div>
        <div className="pr-kicker">{tierLabel(tier)}</div>
        <div className="pr-partner">
          {s.logo_url && <img src={s.logo_url} alt="" />}
          <div><h1>{s.name}</h1><small>Přehled viditelnosti a odezvy na turnaji</small></div>
        </div>
        <div className="pr-period">Období měření: {fmt(report?.from ?? null)} – {fmt(report?.to ?? null)}</div>

        <div className="pr-tiles">
          <div className="pr-tile"><b>{p?.scans ?? 0}</b><span>Naskenování QR akce</span></div>
          <div className="pr-tile"><b>{p?.tvSpots ?? 0}</b><span>Zobrazení spotu na TV</span></div>
          <div className="pr-tile"><b>{tvHours.toString().replace('.', ',')} h</b><span>Logo na TV obrazovce</span></div>
          <div className="pr-tile"><b>{report?.visits ?? 0}</b><span>Návštěv webu turnaje</span></div>
        </div>

        {p && p.scansBySource.length > 0 && (
          <>
            <div className="pr-h2">Odkud lidé QR akci otevřeli</div>
            <table className="pr-table"><tbody>
              {p.scansBySource.map(x => <tr key={x.source}><td>{REACH_SOURCE_LABEL[x.source] ?? x.source}</td><td>{x.count}</td></tr>)}
            </tbody></table>
          </>
        )}
        {hours.length > 1 && (
          <>
            <div className="pr-h2">Skeny v průběhu dne</div>
            <div className="pr-chart">{hours.map(h => <div key={h.hour} style={{ height: `${(h.count / max) * 100}%` }} title={`${h.count}`} />)}</div>
            <div className="pr-chart-labels">{hours.map(h => <span key={h.hour}>{hourLabel(h.hour)}</span>)}</div>
          </>
        )}

        <div className="pr-h2">Kde se logo objevilo</div>
        <ul className="pr-list">
          {placements(tier, { tv: (report?.tvMinutes ?? 0) > 0, spots: (p?.tvSpots ?? 0) > 0, press: t.press_enabled ?? false }).map(x => <li key={x}>{x}</li>)}
        </ul>

        <div className="pr-note">
          Měření bez cookies a bez sledování osob: ukládají se jen součty po hodinách. Sken = otevření QR kódu nebo odkazu akce
          (náhledy odkazů v aplikacích se nepočítají). Návštěva = první otevření webu turnaje v prohlížeči během jedné relace.
          Čas na TV se počítá po 5 minutách, kdy byla TV obrazovka turnaje spuštěná. Měří se jen při zapnutém dosahu partnera.
        </div>
      </div>
    )
  }

  return createPortal(
    <div className="pr-print">
      <style>{CSS}</style>
      <div className="pr-bar">
        <span className="pr-bar__title">Report pro partnery</span>
        <select value={only} onChange={e => setOnly(e.target.value)} aria-label="Partner">
          <option value="all">Všichni partneři</option>
          {sortByTier(d.sponsors ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => { if (report && sponsors.length) window.print() }} style={{ opacity: report && sponsors.length ? 1 : 0.5 }}>
          <Printer size={15} />Tisknout ({sponsors.length})
        </button>
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={onClose}><X size={15} />Zavřít</button>
      </div>
      <p className="pr-hint no-print">Tisk na A4 na výšku bez okrajů („Grafika na pozadí“ zapnout). Do PDF přes „Uložit jako PDF“ a pošlete partnerovi.</p>
      {error && <p className="pr-hint no-print" style={{ color: '#b45309', fontWeight: 600 }}>{error}</p>}
      {!report && !error && <p className="pr-hint no-print">Načítám data…</p>}
      {report && !(d.sponsors ?? []).length && <p className="pr-hint no-print">Turnaj nemá partnery (nebo je modul Partneři vypnutý).</p>}
      {report && sponsors.map(sheet)}
    </div>,
    document.body,
  )
}
