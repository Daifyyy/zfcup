// Drobné ikony událostí zápasu: gól (míč / puk podle sportu), asistence „A“, trestné minuty.
import type { SportDef } from '../../lib/sports'

export function GoalMark({ sport, size = 15 }: { sport: SportDef; size?: number }) {
  const Icon = sport.GoalIcon
  return <span className="ev-mark ev-mark--goal" title="Gól" aria-label="Gól"><Icon size={size} strokeWidth={1.9} /></span>
}

export function AssistMark() {
  return <span className="ev-mark ev-mark--assist" title="Asistence" aria-label="Asistence">A</span>
}

export function PimMark({ minutes }: { minutes: number }) {
  return <span className="ev-mark ev-mark--pim" title="Trestné minuty" aria-label={`${minutes} trestných minut`}>{minutes}′</span>
}
