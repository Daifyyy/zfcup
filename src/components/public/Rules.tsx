import type { Tournament } from '../../hooks/useTournament'
import type { RuleItem } from '../../hooks/useRuleItems'
import { sanitizeHtml } from '../../lib/sanitize'
import { SectionHeader } from '../ui/Card'
import Empty from '../ui/Empty'

interface Props {
  tournament: Tournament | null
  ruleItems: RuleItem[]
}

export default function Rules({ tournament, ruleItems }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionHeader
        title="Pravidla soutěže"
        subtitle={tournament?.name ? `${tournament.name}${tournament.subtitle ? ` · ${tournament.subtitle}` : ''}` : undefined}
      />

      {ruleItems.length > 0 ? (
        <ol className="rl-list">
          {ruleItems.map((r, i) => (
            <li key={r.id} className="rl-item">
              <span className="rl-item__num">{String(i + 1).padStart(2, '0')}</span>
              <div className="rl-item__body">
                {r.title && <h3 className="rl-item__title">{r.title}</h3>}
                {r.body && <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.body) }} />}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty text="Pravidla soutěže zatím nebyla zveřejněna." />
      )}
    </div>
  )
}
