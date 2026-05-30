import type { Tournament } from '../../hooks/useTournament'
import type { RuleItem } from '../../hooks/useRuleItems'
import { sanitizeHtml } from '../../lib/sanitize'

interface Props {
  tournament: Tournament | null
  ruleItems: RuleItem[]
}

export default function Rules({ tournament, ruleItems }: Props) {
  return (
    <div>
      <div className="sec-head">
        <h2 className="sec-title">Pravidla soutěže</h2>
        {tournament?.name && (
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', marginTop: '.25rem' }}>
            {tournament.name}{tournament.subtitle ? ` · ${tournament.subtitle}` : ''}
          </div>
        )}
      </div>

      {ruleItems.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
          {ruleItems.map(r => (
            <div key={r.id} className="card" style={{ padding: 'var(--pad-card)' }}>
              {r.title && (
                <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs-body) + .05rem)', marginBottom: r.body ? '.5rem' : 0 }}>
                  {r.title}
                </div>
              )}
              {r.body && (
                <div
                  className="rich-content"
                  style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.body) }}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="card-bordered"
          style={{
            padding: 'var(--pad-card)',
            fontSize: 'var(--fs-body)',
            color: 'var(--muted)',
            lineHeight: 1.75,
            textAlign: 'center',
          }}
        >
          📋 Pravidla soutěže zatím nebyla přidána.
        </div>
      )}
    </div>
  )
}
