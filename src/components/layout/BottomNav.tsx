import { useState } from 'react'
import {
  BarChart3, BookOpen, CalendarDays, GitBranch, Handshake, Home, ListOrdered,
  MoreHorizontal, Newspaper, Target, Users, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Tab } from '../../App'
import { buildPublicTabs } from './Header'

const ICONS: Record<string, LucideIcon> = {
  overview: Home,
  results: CalendarDays,
  standings: ListOrdered,
  statistics: BarChart3,
  teams: Users,
  bracket: GitBranch,
  rules: BookOpen,
  tips: Target,
  sponsors: Handshake,
  media: Newspaper,
}

// Hlavní lišta: Přehled, Zápasy, Tabulka, Pavouk (bez pavouka → Statistiky); zbytek ve „Více“
const PRIMARY_BASE: Tab[] = ['overview', 'results', 'standings']

interface Props {
  tab: Tab
  onTab: (t: Tab) => void
  tipsEnabled?: boolean
  showBracket?: boolean
  cardsEnabled?: boolean
  sponsorsEnabled?: boolean
  mediaEnabled?: boolean
}

export default function BottomNav({ tab, onTab, tipsEnabled, showBracket = true, sponsorsEnabled, mediaEnabled }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const all = buildPublicTabs({ showBracket, tipsEnabled, sponsorsEnabled, mediaEnabled })
  const PRIMARY: Tab[] = [...PRIMARY_BASE, all.some(t => t.value === 'bracket') ? 'bracket' : 'statistics']
  const primary = PRIMARY.map(v => all.find(t => t.value === v)).filter((t): t is (typeof all)[number] => !!t)
  const secondary = all.filter(t => !PRIMARY.includes(t.value))
  const moreActive = secondary.some(t => t.value === tab)

  function go(t: Tab) {
    setMoreOpen(false)
    onTab(t)
  }

  return (
    <>
      {moreOpen && (
        <div className="bnav-sheet mobile-only" onClick={() => setMoreOpen(false)}>
          <div className="bnav-sheet__panel" onClick={e => e.stopPropagation()}>
            <div className="bnav-sheet__head">
              <span>Další sekce</span>
              <button type="button" className="bnav-sheet__close" onClick={() => setMoreOpen(false)} aria-label="Zavřít">
                <X size={18} />
              </button>
            </div>
            <div className="bnav-sheet__grid">
              {secondary.map(t => {
                const Icon = ICONS[t.value] ?? Home
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => go(t.value)}
                    className={t.value === tab ? 'bnav-sheet__item bnav-sheet__item--active' : 'bnav-sheet__item'}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="bnav mobile-only" aria-label="Navigace">
        {primary.map(t => {
          const Icon = ICONS[t.value] ?? Home
          const active = tab === t.value
          return (
            <button key={t.value} type="button" onClick={() => go(t.value)} className={active ? 'bnav__btn bnav__btn--active' : 'bnav__btn'}>
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              <span>{t.label}</span>
            </button>
          )
        })}
        {secondary.length > 0 && (
          <button type="button" onClick={() => setMoreOpen(o => !o)} className={moreActive || moreOpen ? 'bnav__btn bnav__btn--active' : 'bnav__btn'}>
            <MoreHorizontal size={20} strokeWidth={moreActive ? 2.25 : 1.75} />
            <span>Více</span>
          </button>
        )}
      </nav>
    </>
  )
}
