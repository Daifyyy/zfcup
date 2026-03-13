import { QRCodeSVG } from 'qrcode.react'

interface Props {
  size?: number
  url?: string
}

export default function QRCode({ size = 80, url }: Props) {
  const href = url ?? window.location.origin + window.location.pathname
  return (
    <div style={{
      background: '#fff',
      padding: 6,
      borderRadius: 8,
      display: 'inline-block',
      boxShadow: '0 1px 4px rgba(0,0,0,.1)',
      lineHeight: 0,
    }}>
      <QRCodeSVG value={href} size={size} fgColor="#0f172a" bgColor="#ffffff" />
    </div>
  )
}
