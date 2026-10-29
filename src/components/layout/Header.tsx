import { ChevronDown, ChevronLeft, History, Lock, LockOpen, MonitorPlay, Printer, Tv } from 'lucide-react'
import type { Tab } from '../../App'
import type { Tournament } from '../../hooks/useTournament'
import type { Sponsor } from '../../hooks/useSponsors'
import { getSportDef } from '../../lib/sports'
import { BRAND } from '../../lib/brand'
import { Tabs } from '../ui/Tabs'

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
  /** Generální partner — zobrazí se jako „presented by“ */
  presentedBy?: Sponsor | null
  mediaEnabled?: boolean
  /** Soutěž, do které ročník patří (migrace 09) */
  competition?: { name: string; slug: string } | null
  /** Předchozí / další ročník soutěže */
  /** Ročníky soutěže (od nejnovějšího) pro rozbalovací výběr */
  editionOptions?: { id: string; edition: number; label: string; name: string }[]
  onOpenTournament?: (id: string) => void
  onOpenCompetition?: (slug: string) => void
}

export const HEADER_HEIGHT_DESKTOP = 104

export function buildPublicTabs({ showBracket = true, tipsEnabled, sponsorsEnabled, mediaEnabled }: {
  showBracket?: boolean; tipsEnabled?: boolean; sponsorsEnabled?: boolean; mediaEnabled?: boolean
}): { value: Tab; label: string }[] {
  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview',   label: 'Přehled' },
    { value: 'results',    label: 'Zápasy' },
    { value: 'standings',  label: 'Tabulka' },
    { value: 'statistics', label: 'Statistiky' },
    { value: 'teams',      label: 'Týmy' },
  ]
  if (showBracket) tabs.push({ value: 'bracket', label: 'Pavouk' })
  tabs.push({ value: 'rules', label: 'Pravidla' })
  if (tipsEnabled) tabs.push({ value: 'tips', label: 'Tipovačka' })
  if (sponsorsEnabled) tabs.push({ value: 'sponsors', label: 'Partneři' })
  if (mediaEnabled) tabs.push({ value: 'media', label: 'Média' })
  return tabs
}

function HeaderAction({ icon, label, title, onClick }: { icon: React.ReactNode; label: string; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title} className="hdr-action">
      {icon}
      <span className="hdr-action__label">{label}</span>
    </button>
  )
}

export default function Header({
  tournament, tab, onTab, onAdmin, onKiosk, onScoreboard, onPrint, onHome, isAdmin,
  tipsEnabled, showBracket = true, sponsorsEnabled, presentedBy, mediaEnabled, competition, onOpenCompetition, editionOptions = [], onOpenTournament,
}: Props) {
  const tabs = buildPublicTabs({ showBracket, tipsEnabled, sponsorsEnabled, mediaEnabled })
  const meta = [tournament?.subtitle, tournament?.date, tournament?.venue].filter(Boolean).join(' · ')
  const sport = getSportDef(tournament?.sport)
  const SportIcon = sport.Icon

  return (
    <header className="hdr">
      <div className="hdr__top">
        <div className="hdr__inner">
          {onHome && (
            <button type="button" onClick={onHome} title="Zpět na přehled turnajů" className="hdr-back">
              <ChevronLeft size={18} />
              <span className="hide-mobile">Turnaje</span>
            </button>
          )}

          <div className="hdr__crest">
            {tournament?.logo_url
              ? <img src={tournament.logo_url} alt="" />
              : <SportIcon size={22} />}
          </div>

          {/* Název turnaje — line-clamp 2, minWidth 130 (jinak ho vytlačí akce) */}
          <div className="hdr__title">
            <h1 className="hdr__name">{tournament?.name || BRAND.name}</h1>
            {competition ? (
              <div className="hdr__comp-row">
                {editionOptions.length > 1 && tournament ? (
                  <label className="hdr__edsel" title="Přepnout ročník">
                    <select
                      value={tournament.id}
                      onChange={e => onOpenTournament?.(e.target.value)}
                      aria-label="Ročník soutěže"
                    >
                      {editionOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={12} />
                  </label>
                ) : tournament?.edition ? <span className="hdr__edtxt">{tournament.edition}. ročník</span> : null}
                <button type="button" className="hdr__comp" onClick={() => onOpenCompetition?.(competition.slug)} title="Historie soutěže — síň slávy, věčná tabulka, rekordy">
                  <History size={12} />{competition.name}
                </button>
              </div>
            ) : meta && <div className="hdr__meta">{meta}</div>}
          </div>

          {presentedBy?.logo_url && (
            <div className="hdr__presented desktop-only" title={presentedBy.name}>
              <span>Presented by</span>
              <img src={presentedBy.logo_url} alt={presentedBy.name} />
            </div>
          )}

          <div className="hdr__actions desktop-only">
            <HeaderAction icon={<MonitorPlay size={16} />} label="Tabule" title="Výsledková tabule — fullscreen přehled skupin, zápasů a pavouka" onClick={onScoreboard} />
            {onPrint && <HeaderAction icon={<Printer size={16} />} label="Bulletin" title="Tisknutelný bulletin — program turnaje pro tisk" onClick={onPrint} />}
            <HeaderAction icon={<Tv size={16} />} label="TV" title="Kiosk / TV mode — fullscreen, auto-rotace záložek" onClick={onKiosk} />
          </div>

          <button
            type="button"
            onClick={onAdmin}
            title={isAdmin ? 'Administrace (přihlášen)' : 'Administrace (Ctrl+Shift+A)'}
            className={isAdmin ? 'hdr-admin hdr-admin--on' : 'hdr-admin'}
          >
            {isAdmin ? <LockOpen size={16} /> : <Lock size={16} />}
          </button>
        </div>
      </div>

      <div className="hdr__nav desktop-only">
        <div className="hdr__inner">
          <Tabs items={tabs} value={tab} onChange={onTab} variant="chrome" ariaLabel="Sekce turnaje" />
        </div>
      </div>
    </header>
  )
}
