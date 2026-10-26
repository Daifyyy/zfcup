/** Malá „fyzická“ kartička (žlutá / červená / žlutá+červená), volitelně s počtem. */
export function CardChip({ kind, count }: { kind: 'yellow' | 'red' | 'yellow_red'; count?: number }) {
  const title = kind === 'yellow' ? 'Žlutá karta' : kind === 'red' ? 'Červená karta' : 'Druhá žlutá → červená'
  return (
    <span className="st-cardchip" title={title}>
      {kind === 'yellow_red'
        ? <><i className="st-card st-card--y" /><i className="st-card st-card--r" style={{ marginLeft: -4 }} /></>
        : <i className={`st-card ${kind === 'yellow' ? 'st-card--y' : 'st-card--r'}`} />}
      {count !== undefined && <b>{count}</b>}
    </span>
  )
}
