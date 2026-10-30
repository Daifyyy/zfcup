// Tlačítko „Sdílet“ na Přehledu → nabídka grafik turnaje (Vlna 1, bod 3).
// Data bere z TournamentDataContext (nic nenačítá); grafiky jsou líně načtené dialogy.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ImageIcon, ListOrdered, Medal, Share2, Trophy, Users } from 'lucide-react'
import { useTournamentData } from '../../lib/TournamentDataContext'
import { bestTeamScopes, finalStandingsOf, playDaysOf } from '../../lib/tournamentGraphics'
import { defaultDay } from '../../lib/dayDigest'
import { getSportDef } from '../../lib/sports'
import { withAccessCode } from '../../lib/share'
import { ShareBestTeamDialog, ShareChampionDialog, ShareDayDialog, ShareFinalStandingsDialog } from './lazy'

type Kind = 'program' | 'summary' | 'champion' | 'standings' | 'best'

export default function GraphicsMenu({ onTournament, showToast }: {
  /** Původní grafika turnaje (pozvánka s QR) — řeší Přehled */
  onTournament: () => void
  showToast?: (msg: string) => void
}) {
  const d = useTournamentData()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Nabídka je v portálu (hero Přehledu ořezává přesah) → pozice podle tlačítka
  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.min(Math.max(8, r.right - 260), window.innerWidth - 268) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setOpen(false); return }
      if (e.type === 'mousedown' && (ref.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node))) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close)
    }
  }, [open])

  // Výpočty jen když je nabídka nebo grafika otevřená
  const active = open || kind !== null
  const days = useMemo(() => (active ? playDaysOf(d) : []), [active, d])
  const standings = useMemo(() => (active ? finalStandingsOf(d) : null), [active, d])
  const scopes = useMemo(() => (active ? bestTeamScopes(d) : []), [active, d])

  const t = d.tournament
  const url = `${window.location.origin}/${t.id}`
  const base = { tournament: t, sponsors: d.sponsors ?? [], onClose: () => setKind(null), showToast, url, codeUrl: withAccessCode(url, t) }
  const anyPlayed = days.some(x => x.fixtures.some(f => f.played))

  const items: { key: Kind | 'tournament'; label: string; hint: string; icon: JSX.Element; show: boolean }[] = [
    { key: 'tournament', label: 'Pozvánka na turnaj', hint: 'Název, čísla a QR kód', icon: <ImageIcon size={16} />, show: true },
    { key: 'program', label: 'Program dne', hint: 'Rozpis zápasů s časy', icon: <CalendarDays size={16} />, show: days.length > 0 },
    { key: 'summary', label: 'Výsledky dne', hint: 'Všechny výsledky v jedné grafice', icon: <ListOrdered size={16} />, show: anyPlayed },
    { key: 'champion', label: 'Vítěz turnaje', hint: 'Gratulace vítězi', icon: <Trophy size={16} />, show: !!standings?.decided },
    { key: 'standings', label: 'Konečné pořadí', hint: 'Pódium a další místa', icon: <Medal size={16} />, show: !!standings?.decided },
    { key: 'best', label: d.tournament.schedule_mode === 'season' ? 'Tým turnaje / kola' : 'Tým turnaje', hint: 'Nejlepší sestava podle výkonů', icon: <Users size={16} />, show: scopes.length > 0 },
  ]

  return (
    <div className="ui-menu" ref={ref}>
      <button type="button" className="ui-btn ui-btn--chrome ui-btn--sm" aria-haspopup="menu" aria-expanded={open} onClick={toggle} title="Grafiky na sítě">
        <Share2 size={16} />Sdílet<ChevronDown size={14} />
      </button>
      {open && pos && createPortal(
        <div ref={listRef} className="ui-menu__list" role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left, right: 'auto' }}>
          {items.filter(i => i.show).map(i => (
            <button key={i.key} type="button" role="menuitem" className="ui-menu__item"
              onClick={() => { setOpen(false); if (i.key === 'tournament') onTournament(); else setKind(i.key) }}>
              <span className="ui-menu__icon">{i.icon}</span>
              <span><b>{i.label}</b><small>{i.hint}</small></span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {(kind === 'program' || kind === 'summary') && days.length > 0 && (
        <ShareDayDialog {...base} mode={kind} days={days} teams={d.teams}
          initialDate={defaultDay(days, kind)?.date ?? days[0].date} />
      )}
      {kind === 'champion' && standings?.decided && (
        <ShareChampionDialog {...base} champion={standings.champion} runnerUp={standings.rows.find(r => r.from === 2)?.team} finalScore={standings.finalScore} />
      )}
      {kind === 'standings' && standings?.decided && <ShareFinalStandingsDialog {...base} rows={standings.rows} />}
      {kind === 'best' && scopes.length > 0 && (
        <ShareBestTeamDialog {...base} scopes={scopes} initialScope={scopes[0].value} hockey={getSportDef(t.sport).id === 'hockey'} />
      )}
    </div>
  )
}
