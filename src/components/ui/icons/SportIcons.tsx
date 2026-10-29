// Vlastní sportovní ikony v čárovém stylu lucide (24×24, stroke = currentColor).
interface IconProps {
  size?: number
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

export function FootballIcon({ size = 20, strokeWidth = 1.75, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" />
      <path d="M12 7.2V2.5M15.6 9.8l4.4-1.5M14.2 14l2.8 3.9M9.8 14L7 17.9M8.4 9.8L4 8.3" />
    </svg>
  )
}

export function HockeyIcon({ size = 20, strokeWidth = 1.75, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M5 2.5l7.2 14.2a2 2 0 0 0 1.8 1.1H20" />
      <path d="M20 15.3v5" />
      <ellipse cx="7" cy="19.3" rx="3.5" ry="1.4" />
      <path d="M3.5 19.3v1.1c0 .8 1.6 1.4 3.5 1.4s3.5-.6 3.5-1.4v-1.1" />
    </svg>
  )
}

/** Puk (hokejový gól) — plný válec v barvě textu */
export function PuckIcon({ size = 20, strokeWidth = 1.75, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M3 10v4c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5v-4" fill="currentColor" fillOpacity=".25" />
      <ellipse cx="12" cy="10" rx="9" ry="3.5" fill="currentColor" fillOpacity=".55" />
    </svg>
  )
}

export type SportIconComponent = (props: IconProps) => JSX.Element
