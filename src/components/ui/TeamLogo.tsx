import { useState } from 'react'

interface Props {
  team: { color: string; logo_url: string | null; name?: string }
  size?: number
  radius?: number
}

function initials(name?: string): string {
  if (!name) return ''
  const words = name.replace(/^(FC|HC|SK|TJ|HK|FK|AC)\s+/i, '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Čitelná barva textu na barvě týmu (WCAG relativní jas). */
function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? '')
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  return L > 0.45 ? '#0b1220' : '#fff'
}

export function TeamLogo({ team, size = 18, radius = 4 }: Props) {
  const [imgError, setImgError] = useState(false)
  if (team.logo_url && !imgError) {
    return (
      <img
        src={team.logo_url}
        alt=""
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'contain', flexShrink: 0, display: 'block' }}
      />
    )
  }
  const text = size >= 22 ? initials(team.name) : ''
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: size >= 22 ? Math.max(radius, 4) : '50%',
        background: team.color,
        color: inkFor(team.color),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: Math.round(size * 0.42), lineHeight: 1, letterSpacing: '.02em',
      }}
    >
      {text}
    </span>
  )
}
