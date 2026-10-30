// Hotové sdílecí dialogy. Načítají se líně (viz lazy.tsx), aby html-to-image
// nebylo v hlavním balíku aplikace.
import { useState, type ComponentProps } from 'react'
import type { Team } from '../../hooks/useTeams'
import type { PlaceRow } from '../../lib/finalStandings'
import type { BestTeam } from '../../lib/bestTeam'
import { paginate, programOf, summaryOf, type DayOption } from '../../lib/dayDigest'
import { formatDateWeekday } from '../../lib/dates'
import { BestTeamGraphic, ChampionGraphic, DAY_PER_PAGE, DayGraphic, FinalStandingsGraphic, MvpGraphic, type DayRow } from './templatesExtra'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Tournament } from '../../hooks/useTournament'
import type { StandingRow } from '../../lib/standings'
import ShareModal from './ShareModal'
import type { SideEvents } from '../../lib/details'
import { LeadersGraphic, MatchGraphic, TableGraphic, TournamentGraphic, defaultShareStyle, type LeaderRow } from './templates'

interface Base {
  tournament: Tournament | null
  sponsors: Sponsor[]
  onClose: () => void
  showToast?: (msg: string) => void
  /** Odkaz pro „Kopírovat odkaz“ */
  url?: string
  /** Soukromý turnaj: odkaz s přístupovým kódem (volba v okně sdílení) */
  codeUrl?: string | null
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grafika'
}

export function ShareMatch(p: Base & {
  home?: Team; away?: Team; homeScore: number; awayScore: number; label: string
  decidedIn?: 'regulation' | 'ot' | 'so' | null
  live?: boolean
  /** Zápas ještě nezačal → grafika „Hrajeme“ s časem místo skóre */
  upcoming?: boolean
  time?: string | null
  events?: { home: SideEvents; away: SideEvents }
}) {
  const title = p.upcoming
    ? `${p.home?.name ?? 'Určí se'} – ${p.away?.name ?? 'Určí se'}`
    : `${p.home?.name ?? '—'} ${p.homeScore}:${p.awayScore} ${p.away?.name ?? '—'}`
  return (
    <ShareModal
      title={title}
      fileName={slug(`vysledek-${p.home?.name}-${p.away?.name}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, _c, style, photo) => <MatchGraphic format={format} style={style} photo={photo} {...p} />}
    />
  )
}

export function ShareTable(p: Base & { groupName: string; rows: StandingRow[]; teams: Team[]; allowDraws: boolean }) {
  return (
    <ShareModal
      title={`Tabulka · ${p.groupName}`}
      fileName={slug(`tabulka-${p.groupName}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, _c, style, photo) => <TableGraphic format={format} style={style} photo={photo} {...p} />}
    />
  )
}

export function ShareLeaders(p: Base & { title: string; unit?: string; rows: LeaderRow[] }) {
  return (
    <ShareModal
      title={p.title}
      fileName={slug(p.title)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, _c, style, photo) => <LeadersGraphic format={format} style={style} photo={photo} {...p} />}
    />
  )
}

export function ShareTournament(p: Base & { teamCount: number; matchCount: number; goalCount: number; url: string }) {
  return (
    <ShareModal
      title={p.tournament?.name ?? 'Turnaj'}
      fileName={slug(p.tournament?.name ?? 'turnaj')}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, withCode, style, photo) => <TournamentGraphic format={format} style={style} photo={photo} {...p} url={withCode && p.codeUrl ? p.codeUrl : p.url} />}
    />
  )
}

// ── Vlna 1, bod 3: program/souhrn dne, vítěz, konečné pořadí, hráč zápasu, nejlepší sestava ──

/** Malý výběr uvnitř okna sdílení (den, strana, kolo). */
function Picker<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: { value: T; label: string }[]; onChange: (v: T) => void }) {
  if (items.length < 2) return null
  return (
    <select className="field-input field-select" aria-label={label} value={value} onChange={e => onChange(e.target.value as T)}
      style={{ width: 'auto', fontSize: '.82rem', padding: '.3rem .55rem' }}>
      {items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
    </select>
  )
}

export function ShareDay(p: Base & { mode: 'program' | 'summary'; days: DayOption[]; initialDate: string; teams: Team[] }) {
  const [date, setDate] = useState(p.initialDate)
  const [page, setPage] = useState(1)
  const day = p.days.find(d => d.date === date) ?? p.days[0]
  const teamById = new Map(p.teams.map(t => [t.id, t]))
  const list = day ? (p.mode === 'program' ? programOf(day) : summaryOf(day)) : []
  const pages = paginate(list, DAY_PER_PAGE)
  const cur = Math.min(page, pages.length)
  const rows: DayRow[] = pages[cur - 1].map(f => ({
    key: f.key,
    home: f.home_id ? teamById.get(f.home_id) : undefined,
    away: f.away_id ? teamById.get(f.away_id) : undefined,
    homeScore: f.home_score, awayScore: f.away_score, played: f.played,
    time: f.scheduled_time, label: f.label, decidedIn: f.decided_in,
  }))
  const dayLabel = day?.date ? formatDateWeekday(day.date) : ''
  const name = p.mode === 'program' ? 'Program' : 'Výsledky dne'
  return (
    <ShareModal
      title={[name, dayLabel || p.tournament?.name].filter(Boolean).join(' · ')}
      fileName={slug(`${p.mode === 'program' ? 'program' : 'vysledky'}-${day?.date || 'turnaj'}-${cur}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      variantKey={`${day?.date}|${cur}`}
      controls={<>
        <Picker label="Den" value={day?.date ?? ''} onChange={v => { setDate(v); setPage(1) }}
          items={p.days.map(d => ({ value: d.date, label: d.date ? formatDateWeekday(d.date) : 'Celý turnaj' }))} />
        <Picker label="Strana" value={String(cur)} onChange={v => setPage(Number(v))}
          items={pages.map((_, i) => ({ value: String(i + 1), label: `Strana ${i + 1} z ${pages.length}` }))} />
      </>}
      render={(format, _c, style, photo) => <DayGraphic format={format} style={style} photo={photo} tournament={p.tournament} sponsors={p.sponsors} mode={p.mode} dayLabel={dayLabel} rows={rows} page={cur} pages={pages.length} />}
    />
  )
}

export function ShareChampion(p: Base & { champion?: Team; runnerUp?: Team; finalScore?: string }) {
  return (
    <ShareModal
      title={`Vítěz · ${p.champion?.name ?? ''}`}
      fileName={slug(`vitez-${p.champion?.name}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, _c, style, photo) => <ChampionGraphic format={format} style={style} photo={photo} {...p} />}
    />
  )
}

export function ShareFinalStandings(p: Base & { rows: PlaceRow[] }) {
  return (
    <ShareModal
      title="Konečné pořadí"
      fileName={slug(`konecne-poradi-${p.tournament?.name}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, _c, style, photo) => <FinalStandingsGraphic format={format} style={style} photo={photo} {...p} />}
    />
  )
}

export function ShareMvp(p: Base & Omit<ComponentProps<typeof MvpGraphic>, 'format' | 'style' | 'photo'>) {
  return (
    <ShareModal
      title={`Hráč zápasu · ${p.name}`}
      fileName={slug(`hrac-zapasu-${p.name}`)}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      render={(format, _c, style, photo) => <MvpGraphic {...p} format={format} style={style} photo={photo} />}
    />
  )
}

export function ShareBestTeam(p: Base & { scopes: { value: string; label: string; team: BestTeam }[]; initialScope: string; hockey: boolean }) {
  const [scope, setScope] = useState(p.initialScope)
  const cur = p.scopes.find(s => s.value === scope) ?? p.scopes[0]
  return (
    <ShareModal
      title={cur?.label ?? 'Tým turnaje'}
      fileName={slug(cur?.label ?? 'tym-turnaje')}
      onClose={p.onClose}
      showToast={p.showToast}
      url={p.url}
      codeUrl={p.codeUrl}
      defaultStyle={defaultShareStyle(p.tournament)}
      defaultPhoto={p.tournament?.share_photo_url ?? null}
      variantKey={cur?.value}
      controls={<Picker label="Sestava" value={cur?.value ?? ''} onChange={setScope} items={p.scopes.map(s => ({ value: s.value, label: s.label }))} />}
      render={(format, _c, style, photo) => cur
        ? <BestTeamGraphic format={format} style={style} photo={photo} tournament={p.tournament} sponsors={p.sponsors} title={cur.label} team={cur.team} hockey={p.hockey} />
        : <div />}
    />
  )
}
