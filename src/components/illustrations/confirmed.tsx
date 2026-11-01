/** Celebratory illustration for the booking confirmation: a calendar with a check mark. Decorative only. */
export function ConfirmedIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true" className={className}>
      <circle cx="100" cy="80" r="70" className="fill-mint" />
      <circle cx="38" cy="34" r="6" className="fill-coral" />
      <circle cx="170" cy="46" r="4" className="fill-primary" />
      <circle cx="160" cy="128" r="7" className="fill-coral-soft" />
      <path d="M30 116l6 6m0-6l-6 6" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <rect x="56" y="38" width="88" height="84" rx="14" className="fill-card stroke-border" strokeWidth="2" />
      <path d="M56 52a14 14 0 0 1 14-14h60a14 14 0 0 1 14 14v8H56z" className="fill-primary" />
      <rect x="74" y="30" width="6" height="16" rx="3" className="fill-teal-900" />
      <rect x="120" y="30" width="6" height="16" rx="3" className="fill-teal-900" />
      <circle cx="100" cy="92" r="20" className="fill-coral" />
      <path
        d="M90 92l7 7 13-14"
        fill="none"
        className="stroke-white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
