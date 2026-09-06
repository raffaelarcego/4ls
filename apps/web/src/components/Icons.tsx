/**
 * Icones inline. Sao poucos e sempre os mesmos, entao nao vale uma dependencia:
 * todos herdam `currentColor` e o tamanho vem do `className`.
 */
type IconProps = { className?: string };

function base(className = 'h-6 w-6') {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function CardsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="6" width="13" height="14" rx="2.5" />
      <path d="M8 3h10a3 3 0 0 1 3 3v10" />
      <path d="M7 11h5M7 15h3" />
    </svg>
  );
}

export function PuzzleIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10 3h4a1 1 0 0 1 1 1v1.5a2 2 0 1 0 4 0V4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1.5a2 2 0 1 0 0 4H20a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4" />
      <path d="M10 3a1 1 0 0 0-1 1v1.5a2 2 0 1 1-4 0V4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1.5a2 2 0 1 1 0 4H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h6" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z" />
      <path d="M9 12h.01M13 12h.01M17 12h.01" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 12 20 4l-8 16-2-6-6-2Z" />
    </svg>
  );
}
