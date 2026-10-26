import { useState } from 'react'
import { Download, FileSpreadsheet, Mail, Phone, Printer, User } from 'lucide-react'
import type { Tournament } from '../../hooks/useTournament'
import type { Sponsor } from '../../hooks/useSponsors'
import type { Match } from '../../hooks/useMatches'
import type { Group } from '../../hooks/useGroups'
import type { Team } from '../../hooks/useTeams'
import type { Player } from '../../hooks/usePlayers'
import type { Goal } from '../../hooks/useGoals'
import type { BracketGoal } from '../../hooks/useBracketGoals'
import type { BracketRound, BracketSlot } from '../../hooks/useBracket'
import { Card, SectionHeader } from '../ui/Card'
import { getSportDef } from '../../lib/sports'
import { groupByTier } from '../../lib/partners'

interface Props {
  tournament: Tournament | null
  sponsors: Sponsor[]
  matches: Match[]
  groups: Group[]
  teams: Team[]
  players: Player[]
  goals: Goal[]
  bracketGoals: BracketGoal[]
  bracketRounds: BracketRound[]
  bracketSlots: BracketSlot[]
  onPrint?: () => void
  showToast?: (msg: string) => void
}

function AssetLink({ href, label, preview }: { href: string; label: string; preview: string }) {
  return (
    <a className="md-asset" href={href} target="_blank" rel="noopener noreferrer" download>
      <div className="md-asset__img"><img src={preview} alt={label} loading="lazy" /></div>
      <div className="md-asset__label"><Download size={13} />{label}</div>
    </a>
  )
}

/** Veřejná záložka pro novináře: kontakt, podklady ke stažení, výsledkový servis. */
export default function Media(p: Props) {
  const { tournament, sponsors, onPrint, showToast } = p
  const [exporting, setExporting] = useState(false)
  const sportDef = getSportDef(tournament?.sport)
  const hasContact = !!(tournament?.press_contact_name || tournament?.press_contact_email || tournament?.press_contact_phone)
  const partnerGroups = groupByTier(sponsors.filter(s => s.logo_url))

  async function exportXlsx() {
    if (exporting) return
    setExporting(true)
    try {
      const { exportPressResults } = await import('../../lib/exportPress')
      await exportPressResults({
        tournamentName: tournament?.name ?? 'turnaj', sportDef,
        matches: p.matches, groups: p.groups, teams: p.teams, players: p.players,
        goals: p.goals, bracketGoals: p.bracketGoals, bracketRounds: p.bracketRounds, bracketSlots: p.bracketSlots,
      })
    } catch {
      showToast?.('Export se nepodařil')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader title="Pro média" subtitle="Kontakt, oficiální podklady a výsledkový servis turnaje." />

      <div className="md-grid">
        <Card title="Kontakt pro média">
          {hasContact ? (
            <ul className="md-contact">
              {tournament?.press_contact_name && <li><User size={16} />{tournament.press_contact_name}</li>}
              {tournament?.press_contact_email && <li><Mail size={16} /><a href={`mailto:${tournament.press_contact_email}`}>{tournament.press_contact_email}</a></li>}
              {tournament?.press_contact_phone && <li><Phone size={16} /><a href={`tel:${tournament.press_contact_phone.replace(/\s+/g, '')}`}>{tournament.press_contact_phone}</a></li>}
            </ul>
          ) : (
            <div style={{ color: 'var(--ink-muted)', fontSize: '.86rem' }}>Kontakt bude doplněn.</div>
          )}
          {tournament?.press_note && <p style={{ marginTop: '.8rem', fontSize: '.86rem', color: 'var(--ink-muted)', whiteSpace: 'pre-wrap' }}>{tournament.press_note}</p>}
        </Card>

        <Card title="Výsledkový servis">
          <p style={{ fontSize: '.86rem', color: 'var(--ink-muted)', marginBottom: '.9rem' }}>
            Aktuální výsledky, tabulky, play-off a {sportDef.terms.scorersLabel.toLowerCase()} v jednom souboru — připraveno pro zpracování v redakci.
          </p>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="ui-btn ui-btn--primary" onClick={exportXlsx} style={{ opacity: exporting ? 0.6 : 1 }}>
              <FileSpreadsheet size={16} />{exporting ? 'Připravuji…' : 'Stáhnout Excel'}
            </button>
            {onPrint && (
              <button type="button" className="ui-btn ui-btn--secondary" onClick={onPrint}>
                <Printer size={16} />Tisknutelný bulletin
              </button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Loga ke stažení">
        <div className="md-assets">
          {tournament?.logo_url && <AssetLink href={tournament.logo_url} label="Logo turnaje" preview={tournament.logo_url} />}
          {partnerGroups.flatMap(g => g.items).map(s => (
            <AssetLink key={s.id} href={s.logo_url} label={s.name} preview={s.logo_url} />
          ))}
        </div>
        {!tournament?.logo_url && partnerGroups.length === 0 && (
          <div style={{ color: 'var(--ink-muted)', fontSize: '.86rem' }}>Podklady budou doplněny.</div>
        )}
        <p style={{ marginTop: '.9rem', fontSize: '.74rem', color: 'var(--ink-faint)' }}>
          Loga partnerů používejte pouze v souvislosti s turnajem a bez úprav.
        </p>
      </Card>
    </div>
  )
}
