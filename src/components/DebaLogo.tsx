import Link from 'next/link'

type Props = {
  href?: string
  compact?: boolean
  className?: string
  title?: string
}

export default function DebaLogo({ href = '/', compact = false, className = '', title = 'DEBA' }: Props) {
  const content = (
    <span className={'deba-logo-lockup ' + (compact ? 'is-compact ' : '') + className}>
      <svg className="deba-logo-mark-svg" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="deba-logo-gradient" x1="8" y1="7" x2="39" y2="41" gradientUnits="userSpaceOnUse">
            <stop offset="0" />
            <stop offset="1" />
          </linearGradient>
        </defs>
        <path
          d="M14 8h11.5C34.6 8 41 14.4 41 23.8S34.6 40 25.5 40H14V8Zm8 7v18h3.2c5 0 8.8-3.1 8.8-9.2S30.2 15 25.2 15H22Z"
          fill="currentColor"
        />
        <path d="M8 24h17" stroke="url(#deba-logo-gradient)" strokeWidth="4" strokeLinecap="round" opacity=".95" />
      </svg>
      <span className="deba-logo-wordmark" aria-label={title}>DEBA</span>
    </span>
  )

  return href ? <Link href={href} aria-label={title}>{content}</Link> : content
}
