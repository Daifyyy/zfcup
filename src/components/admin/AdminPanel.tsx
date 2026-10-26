import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Tournament } from '../../hooks/useTournament'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Group } from '../../hooks/useGroups'
import type { Match } from '../../hooks/useMatches'
import type { Goal } from '../../hooks/useGoals'
import type { Assist } from '../../hooks/useAssists'
import type { Card } from '../../hooks/useCards'
import type { Penalty } from '../../hooks/usePenalties'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketAssist } from '../../hooks/useBracketAssists'
import type { BracketCard } from '../../hooks/useBracketCards'
import type { BracketPenalty } from '../../hooks/useBracketPenalties'
import type { Announcement } from '../../hooks/useAnnouncements'
import type { RuleItem } from '../../hooks/useRuleItems'
import type { Referee } from '../../hooks/useReferees'
import InfoTab from './tabs/InfoTab'
import AnnouncementsTab from './tabs/AnnouncementsTab'
import RuleItemsTab from './tabs/RuleItemsTab'
import TeamsTab from './tabs/TeamsTab'
import GroupsTab from './tabs/GroupsTab'
import MatchesTab from './tabs/MatchesTab'
import ScorersTab from './tabs/ScorersTab'
import BracketTab from './tabs/BracketTab'
import SettingsTab from './tabs/SettingsTab'
import TipsAdminTab from './tabs/TipsAdminTab'
import RefereesTab from './tabs/RefereesTab'
import SponsorsTab from './tabs/SponsorsTab'
import type { Sponsor } from '../../hooks/useSponsors'
import {
  BookOpen, CalendarClock, Gavel, GitBranch, Handshake, Info, Layers, LogOut, Megaphone,
  Settings, Target, Trophy, Users, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ATab = 'info' | 'announcements' | 'rules' | 'teams' | 'referees' | 'groups' | 'matches' | 'scorers' | 'bracket' | 'tips' | 'sponsors' | 'settings'

// Pořadí odpovídá CLAUDE.md (Info → … → Nastavení), jen seskupené do bloků.
const ADMIN_NAV: { group: string; items: { id: ATab; label: string; icon: LucideIcon }[] }[] = [
  { group: 'Obsah', items: [
    { id: 'info',          label: 'Info',      icon: Info },
    { id: 'announcements', label: 'Oznámení',  icon: Megaphone },
    { id: 'rules',         label: 'Pravidla',  icon: BookOpen },
  ] },
  { group: 'Soutěž', items: [
    { id: 'teams',    label: 'Týmy',     icon: Users },
    { id: 'referees', label: 'Rozhodčí', icon: Gavel },
    { id: 'groups',   label: 'Skupiny',  icon: Layers },
    { id: 'scorers',  label: 'Střelci',  icon: Trophy },
  ] },
  { group: 'Průběh turnaje', items: [
    { id: 'matches', label: 'Zápasy',    icon: CalendarClock },
    { id: 'bracket', label: 'Play-off',  icon: GitBranch },
    { id: 'tips',    label: 'Tipovačka', icon: Target },
  ] },
  { group: 'Komerce', items: [
    { id: 'sponsors', label: 'Partneři', icon: Handshake },
  ] },
  { group: 'Systém', items: [
    { id: 'settings', label: 'Nastavení', icon: Settings },
  ] },
]

// Záložky aktivně používané při turnaji — zvýraznit
const ACTION_TABS: ATab[] = ['matches', 'bracket', 'tips']

interface Props {
  session: Session | null
  tournamentId: string
  tournament: Tournament | null
  teams: Team[]
  players: Player[]
  groups: Group[]
  matches: Match[]
  goals: Goal[]
  assists: Assist[]
  cards: Card[]
  penalties: Penalty[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  announcements: Announcement[]
  ruleItems: RuleItem[]
  bracketGoals: BracketGoal[]
  bracketAssists: BracketAssist[]
  bracketCards: BracketCard[]
  bracketPenalties: BracketPenalty[]
  referees: Referee[]
  refetchTournament: () => void
  refetchTeams: () => void
  refetchPlayers: () => void
  refetchGroups: () => void
  refetchMatches: () => void
  refetchGoals: () => void
  refetchAssists: () => void
  refetchCards: () => void
  refetchPenalties: () => void
  refetchBracketPenalties: () => void
  refetchBracket: () => void
  refetchBracketGoals: () => void
  refetchBracketAssists: () => void
  refetchBracketCards: () => void
  refetchReferees: () => void
  refetchAnnouncements: () => void
  refetchRuleItems: () => void
  sponsors: Sponsor[]
  refetchSponsors: () => void
  showToast: (msg: string) => void
  onClose: () => void
}

export default function AdminPanel(props: Props) {
  const { session, onClose, showToast, refetchMatches, refetchGoals, refetchBracket, refetchBracketGoals } = props
  const [aTab, setATab] = useState<ATab>('info')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const login = async () => {
    if (!email || !password) { setErr('Vyplňte email a heslo.'); return }
    setLoading(true); setErr('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErr('Špatné přihlašovací údaje.')
      else { setEmail(''); setPassword('') }
    } catch {
      setErr('Chyba připojení. Zkuste znovu.')
    } finally {
      setLoading(false)
    }
  }

  const sendReset = async () => {
    if (!resetEmail) { setErr('Zadej e-mail.'); return }
    setResetLoading(true); setErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    })
    setResetLoading(false)
    if (error) { setErr(error.message); return }
    setResetSent(true)
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    showToast(error ? 'Chyba odhlášení: ' + error.message : 'Odhlášen')
  }

  const tabProps = { ...props, showToast, refetchMatches, refetchGoals, refetchBracket, refetchBracketGoals }
  const isLeagueNoPlayoff = props.tournament?.format === 'league' && !(props.tournament?.league_has_playoff ?? true)
  const nav = ADMIN_NAV
    .map(g => ({ ...g, items: g.items.filter(it => !isLeagueNoPlayoff || it.id !== 'bracket') }))
    .filter(g => g.items.length > 0)
  const current = nav.flatMap(g => g.items).find(it => it.id === aTab)
  const mouseDownOnBackdrop = useRef(false)

  return (
    <div
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget }}
      onClick={e => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose() }}
      className="adm"
    >
      <div className={session ? 'adm__panel' : 'adm__panel adm__panel--narrow'}>

        {/* Header */}
        <header className="adm__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="adm__eyebrow">Administrace</div>
            <h2 className="adm__title">{props.tournament?.name ?? 'Turnaj'}</h2>
          </div>
          {session && (
            <span className="adm__user" title={session.user.email ?? ''}>
              <span className="adm__user-dot" />{session.user.email}
            </span>
          )}
          {session && (
            <button type="button" onClick={logout} className="adm__hbtn" title="Odhlásit">
              <LogOut size={15} /><span className="hide-mobile">Odhlásit</span>
            </button>
          )}
          <button type="button" onClick={onClose} className="adm__hbtn" title="Zavřít (Esc)">
            <X size={16} /><span className="hide-mobile">Zavřít</span>
          </button>
        </header>

        {!session ? (
          /* Login form */
          <div style={{ padding: '1.7rem', display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', textTransform: 'uppercase' }}>Přihlášení pořadatele</h3>
            <p style={{ fontSize: '.84rem', color: 'var(--ink-muted)', marginTop: '-.4rem' }}>Správa turnaje je dostupná jen pro pořadatele.</p>
            <div className="field-group">
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="admin@firma.cz"
                autoFocus
              />
            </div>
            <div className="field-group">
              <label className="field-label">Heslo</label>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="••••••••"
              />
            </div>
            <button type="button" className="btn btn-p btn-full" onClick={login} style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Přihlašuji…' : 'Přihlásit'}
            </button>
            {err && <p style={{ color: 'var(--danger)', fontSize: '.78rem' }}>{err}</p>}
            {!resetMode ? (
              <button type="button" onClick={() => { setResetMode(true); setErr('') }} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontFamily: 'var(--font-body)', fontSize: '.82rem',
                cursor: 'pointer', padding: 0, textDecoration: 'underline', alignSelf: 'flex-start',
              }}>
                Zapomenuté heslo?
              </button>
            ) : resetSent ? (
              <div className="info-box" style={{ marginBottom: 0 }}>
                E-mail s odkazem pro reset hesla byl odeslán. Zkontroluj schránku (včetně spamu).
                <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setResetEmail('') }} style={{ display: 'block', marginTop: '.5rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '.82rem', padding: 0, textDecoration: 'underline' }}>
                  Zpět na přihlášení
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '.85rem', border: '1px solid var(--border)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '.82rem', margin: 0, color: 'var(--ink-muted)' }}>
                  Zadej svůj e-mail a pošleme ti odkaz pro reset hesla.
                </p>
                <input
                  className="field-input"
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="admin@firma.cz"
                />
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button type="button" className="btn btn-p" onClick={sendReset} style={{ flex: 1, opacity: resetLoading ? 0.6 : 1 }}>
                    {resetLoading ? 'Odesílám…' : 'Odeslat reset'}
                  </button>
                  <button type="button" className="btn btn-d" onClick={() => { setResetMode(false); setErr(''); setResetEmail('') }}>
                    Zrušit
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="adm__body">
              <nav className="adm__nav" aria-label="Sekce administrace">
                {nav.map(g => (
                  <div key={g.group} className="adm__nav-group">
                    <div className={g.group === 'Průběh turnaje' ? 'adm__nav-label adm__nav-label--live' : 'adm__nav-label'}>{g.group}</div>
                    {g.items.map(it => {
                      const Icon = it.icon
                      const active = aTab === it.id
                      const action = ACTION_TABS.includes(it.id)
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => setATab(it.id)}
                          className={['adm__nav-btn', active && 'adm__nav-btn--active', action && 'adm__nav-btn--action'].filter(Boolean).join(' ')}
                        >
                          <Icon size={16} strokeWidth={1.9} />
                          <span>{it.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </nav>

            {/* Obsah záložky */}
            <div className="adm__content">
              {current && <h3 className="adm__content-title">{current.label}</h3>}
              {aTab === 'info'          && <InfoTab {...tabProps} />}
              {aTab === 'announcements' && <AnnouncementsTab {...tabProps} />}
              {aTab === 'rules'         && <RuleItemsTab ruleItems={props.ruleItems} tournament={props.tournament} refetchRuleItems={props.refetchRuleItems} showToast={showToast} />}
              {aTab === 'teams'         && <TeamsTab {...tabProps} />}
              {aTab === 'referees'      && <RefereesTab referees={props.referees} tournament={props.tournament} refetchReferees={props.refetchReferees} showToast={showToast} />}
              {aTab === 'groups'        && <GroupsTab {...tabProps} />}
              {aTab === 'matches'       && <MatchesTab {...tabProps} />}
              {aTab === 'scorers'       && <ScorersTab {...tabProps} />}
              {aTab === 'bracket'       && <BracketTab {...tabProps} />}
              {aTab === 'tips'          && <TipsAdminTab showToast={showToast} tournament={props.tournament} teams={props.teams} players={props.players} groups={props.groups} matches={props.matches} bracketSlots={props.bracketSlots} bracketRounds={props.bracketRounds} />}
              {aTab === 'sponsors'      && <SponsorsTab sponsors={props.sponsors} tournament={props.tournament} refetchSponsors={props.refetchSponsors} showToast={showToast} />}
              {aTab === 'settings'      && <SettingsTab {...tabProps} />}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
