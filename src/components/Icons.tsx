import type { ReactNode, SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}
const svg = (children: ReactNode, extra?: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...extra}>
    {children}
  </svg>
)

const icons = {
  sleep: () => svg(<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />),
  feed: () =>
    svg(
      <>
        <path d="M9 3h6M10 3v3l-2 3v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9l-2-3V3" />
        <path d="M8 13h8" />
      </>,
    ),
  diaper: () => svg(<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z" />),
  note: () =>
    svg(
      <>
        <path d="M5 4h10l4 4v12H5z" />
        <path d="M9 12h6M9 16h4" />
      </>,
    ),
  food: () =>
    svg(
      <>
        <path d="M12 7c-1.5-1.6-5-1.8-6.5.6C4 10 5 15 7.5 18.5c1.3 1.8 2.8 2 4.5 1 1.7 1 3.2.8 4.5-1C19 15 20 10 18.5 7.6 17 5.2 13.5 5.4 12 7z" />
        <path d="M12 7c0-2 1-3.5 3-4" />
      </>,
    ),
  today: () =>
    svg(
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>,
    ),
  trends: () => svg(<path d="M5 20V12M10 20V6M15 20v-9M20 20V9" />),
  ai: () =>
    svg(
      <>
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
      </>,
    ),
  mic: () =>
    svg(
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>,
    ),
  gear: () =>
    svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>,
    ),
  prev: () => svg(<path d="M15 5l-7 7 7 7" />, { strokeWidth: 2.4 }),
  next: () => svg(<path d="M9 5l7 7-7 7" />, { strokeWidth: 2.4 }),
}

export type IconName = keyof typeof icons

export function Icon({ name }: { name: IconName }) {
  return icons[name]()
}
