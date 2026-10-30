// Diplomy jedním klikem (modul `diplomas`) — tisk / PDF z prohlížeče, A4 na šířku, jeden diplom na stranu.
// V barvách turnaje (--brand), s logem turnaje, týmu a partnery. Výpočet příjemců: src/lib/diplomas.ts.
// Tisková šablona má vlastní barvy medailí (výjimka z pravidla tokenů, stejně jako sdílecí grafiky).
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Trophy, X } from 'lucide-react'
import { useTournamentData } from '../../lib/TournamentDataContext'
import { useBackClose } from '../../lib/useBackClose'
import { DEFAULT_DIPLOMA_OPTIONS, diplomaList, type Diploma, type DiplomaOptions } from '../../lib/diplomas'
import { getTitlePartner, sortByTier } from '../../lib/partners'
import { TeamLogo } from '../ui/TeamLogo'

const MEDAL = { 1: '#d4a017', 2: '#9ca3af', 3: '#b87333' } as const

const CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  #root { display: none !important; }
  .dp-print { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
  .dp-bar, .no-print { display: none !important; }
  .dp-sheet { margin: 0 !important; box-shadow: none !important; }
}
.dp-print { position: fixed; inset: 0; z-index: 2000; overflow-y: auto; background: #e5e7eb; padding: 1rem; color: #0b1220; font-family: var(--font-body), Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dp-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: .6rem .9rem; max-width: 297mm; margin: 0 auto 1rem; padding: .7rem .9rem; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
.dp-bar__title { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; text-transform: uppercase; margin-right: auto; }
.dp-bar select, .dp-bar input[type=text] { font: inherit; font-size: .85rem; padding: .35rem .5rem; border: 1px solid #cbd5e1; border-radius: 6px; }
.dp-bar label { display: inline-flex; align-items: center; gap: .35rem; font-size: .85rem; }
.dp-hint { max-width: 297mm; margin: -.5rem auto 1rem; font-size: .8rem; color: #475569; }
.dp-hint--warn { color: #b45309; font-weight: 600; }
.dp-sheet { width: 297mm; height: 210mm; margin: 0 auto 6mm; background: #fff; position: relative; box-shadow: 0 2px 10px rgba(0,0,0,.15); break-after: page; page-break-after: always; overflow: hidden; box-sizing: border-box; padding: 12mm; }
.dp-frame { position: absolute; inset: 8mm; border: 2.2mm solid var(--brand); }
.dp-frame::after { content: ''; position: absolute; inset: 2.5mm; border: .5mm solid color-mix(in srgb, var(--brand) 45%, #fff); }
.dp-corner { position: absolute; width: 38mm; height: 38mm; background: var(--brand); clip-path: polygon(0 0, 100% 0, 0 100%); }
.dp-body { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10mm 22mm 8mm; box-sizing: border-box; }
.dp-head { display: flex; align-items: center; gap: 5mm; }
.dp-head img { height: 20mm; max-width: 40mm; object-fit: contain; }
.dp-tname { font-family: var(--font-display); font-weight: 800; font-size: 15pt; text-transform: uppercase; line-height: 1.05; }
.dp-tmeta { font-size: 9.5pt; color: #475569; margin-top: 1mm; }
.dp-word { margin-top: 7mm; font-family: var(--font-display); font-weight: 800; font-size: 64pt; letter-spacing: .14em; line-height: 1; color: var(--brand); text-transform: uppercase; }
.dp-title { margin-top: 3mm; font-size: 17pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.dp-recipient { margin-top: 6mm; display: flex; align-items: center; justify-content: center; gap: 6mm; }
.dp-name { font-family: var(--font-display); font-weight: 800; font-size: 40pt; line-height: 1; text-transform: uppercase; }
.dp-team { margin-top: 2.5mm; font-size: 13pt; color: #334155; display: inline-flex; align-items: center; gap: 2.5mm; }
.dp-detail { margin-top: 2mm; font-size: 12pt; font-weight: 700; color: var(--brand); }
.dp-medal { width: 26mm; height: 26mm; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 22pt; box-shadow: inset 0 0 0 1.5mm rgba(255,255,255,.35); flex-shrink: 0; }
.dp-foot { margin-top: auto; width: 100%; display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
.dp-sign { width: 58mm; flex-shrink: 0; border-top: .4mm solid #0b1220; padding-top: 1.5mm; font-size: 9pt; color: #334155; }
.dp-partners { display: flex; flex-direction: column; align-items: center; gap: 2mm; min-width: 0; flex: 1; }
.dp-partners small { font-size: 7pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #64748b; }
.dp-partners div { display: flex; align-items: center; justify-content: center; gap: 4mm; flex-wrap: nowrap; }
.dp-partners img { height: 8mm; max-width: 22mm; object-fit: contain; flex-shrink: 0; }
.dp-partners img.dp-title-partner { height: 13mm; max-width: 50mm; }
`

export default function Diplomas({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose, 'diplomas')
  const d = useTournamentData()
  const [opts, setOpts] = useState<DiplomaOptions>(DEFAULT_DIPLOMA_OPTIONS)
  const [signer, setSigner] = useState('Ředitel turnaje')
  const { decided, diplomas } = useMemo(() => diplomaList(d, opts), [d, opts])
  const t = d.tournament
  const sponsors = d.sponsors ?? []
  const titlePartner = getTitlePartner(sponsors)
  // jeden řádek pod generálním partnerem — víc log by se nevešlo mezi podpisy
  const others = sortByTier(sponsors).filter(s => s.logo_url && s.id !== titlePartner?.id).slice(0, 4)
  const meta = [t.date, t.venue].filter(Boolean).join(' · ')

  const sheet = (x: Diploma) => (
    <div key={x.key} className="dp-sheet">
      <div className="dp-frame" />
      <div className="dp-corner" style={{ left: '8mm', top: '8mm' }} />
      <div className="dp-corner" style={{ right: '8mm', bottom: '8mm', transform: 'rotate(180deg)' }} />
      <div className="dp-body">
        <div className="dp-head">
          {t.logo_url && <img src={t.logo_url} alt="" />}
          <div style={{ textAlign: t.logo_url ? 'left' : 'center' }}>
            <div className="dp-tname">{t.name}</div>
            {meta && <div className="dp-tmeta">{meta}</div>}
          </div>
        </div>
        <div className="dp-word">Diplom</div>
        <div className="dp-title">{x.title}</div>
        <div className="dp-recipient">
          {x.medal && <span className="dp-medal" style={{ background: MEDAL[x.medal] }}>{x.medal}.</span>}
          {!x.medal && x.kind === 'place' && x.team && <TeamLogo team={x.team} size={80} radius={10} />}
          {x.kind !== 'place' && <Trophy size={64} color="var(--brand)" strokeWidth={1.75} />}
          <div className="dp-name">{x.recipient}</div>
          {x.medal && x.team && <TeamLogo team={x.team} size={80} radius={10} />}
        </div>
        {x.kind !== 'place' && x.team && (
          <div className="dp-team"><TeamLogo team={x.team} size={28} radius={5} />{x.team.name}</div>
        )}
        {x.detail && <div className="dp-detail">{x.detail}</div>}
        <div className="dp-foot">
          <div className="dp-sign">{signer || ' '}</div>
          {(titlePartner?.logo_url || others.length > 0) && (
            <div className="dp-partners">
              <small>{titlePartner?.logo_url ? 'Presented by' : 'Partneři'}</small>
              {titlePartner?.logo_url && <img className="dp-title-partner" src={titlePartner.logo_url} alt={titlePartner.name} />}
              {others.length > 0 && <div>{others.map(s => <img key={s.id} src={s.logo_url} alt={s.name} />)}</div>}
            </div>
          )}
          <div className="dp-sign">Datum</div>
        </div>
      </div>
    </div>
  )

  return createPortal(
    <div className="dp-print">
      <style>{CSS}</style>
      <div className="dp-bar">
        <span className="dp-bar__title">Diplomy</span>
        <select value={opts.places} onChange={e => setOpts(o => ({ ...o, places: e.target.value as DiplomaOptions['places'] }))} aria-label="Umístění">
          <option value="podium">Umístění 1.–3.</option>
          <option value="all">Všechna umístění</option>
          <option value="none">Bez umístění</option>
        </select>
        <label><input type="checkbox" checked={opts.scorer} onChange={e => setOpts(o => ({ ...o, scorer: e.target.checked }))} />Nejlepší střelec</label>
        <label><input type="checkbox" checked={opts.player} onChange={e => setOpts(o => ({ ...o, player: e.target.checked }))} />Hráč turnaje</label>
        <label><input type="checkbox" checked={opts.keeper} onChange={e => setOpts(o => ({ ...o, keeper: e.target.checked }))} />Nejlepší brankář</label>
        <label>Podpis: <input type="text" value={signer} onChange={e => setSigner(e.target.value)} maxLength={60} style={{ width: '12rem' }} /></label>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => { if (diplomas.length) window.print() }} style={{ opacity: diplomas.length ? 1 : 0.5 }}>
          <Printer size={15} />Tisknout ({diplomas.length})
        </button>
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={onClose}><X size={15} />Zavřít</button>
      </div>
      <p className="dp-hint no-print">
        Tisk na A4 na šířku bez okrajů (v dialogu tisku „Okraje: žádné“, „Grafika na pozadí“ zapnout). Do PDF přes „Uložit jako PDF“.
        Hráče a brankáře turnaje můžete určit ručně v Admin → Střelci → Tým turnaje (hráč na místě 1 = hráč turnaje).
      </p>
      {!decided && (
        <p className="dp-hint dp-hint--warn no-print">
          Turnaj ještě není rozhodnutý — diplomy za umístění se objeví po finále (u ligy po posledním zápase). Střelec a hráči jsou podle průběžného stavu.
        </p>
      )}
      {diplomas.length === 0 && <p className="dp-hint no-print">Pro tento výběr zatím nejsou žádné diplomy.</p>}
      {diplomas.map(sheet)}
    </div>,
    document.body,
  )
}
