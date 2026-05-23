import type { Tournament } from '../../hooks/useTournament'

interface Props {
  tournament: Tournament | null
}

export default function Rules({ tournament }: Props) {
  const hasRules = !!tournament?.rules_content?.trim()

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

      {hasRules ? (
        <div
          className="card"
          style={{
            padding: 'var(--pad-card)',
            fontSize: 'var(--fs-body)',
            lineHeight: 1.85,
            whiteSpace: 'pre-wrap',
            color: 'var(--text)',
          }}
        >
          {tournament!.rules_content}
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
