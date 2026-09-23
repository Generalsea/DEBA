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
      <img
        src="/brand/deba-logo.png"
        alt={title}
        width={180}
        height={60}
        className="deba-logo-image"
        decoding="async"
      />
    </span>
  )

  return href ? <Link href={href} aria-label={title}>{content}</Link> : content
}
