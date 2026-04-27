import { useState } from 'react'

interface Props {
  team: { color: string; logo_url: string | null }
  size?: number
  radius?: number
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
  return <span className="team-dot" style={{ background: team.color, width: size, height: size, flexShrink: 0 }} />
}
