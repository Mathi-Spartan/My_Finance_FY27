'use client';

// The mark: the two bars of ₹, and the leg redrawn as a line that falls
// then climbs — money going out, then coming back. Readable at 16px.
export function Mark({ size = 40, className, rounded = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="kk-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--g1, #063E73)" />
          <stop offset="55%" stopColor="var(--g2, #0F7BC4)" />
          <stop offset="100%" stopColor="var(--g3, #3FA9E5)" />
        </linearGradient>
      </defs>

      {rounded && <rect width="64" height="64" rx="17" fill="url(#kk-g)" />}

      <g strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M16 19 H46" stroke="#fff" />
        <path d="M16 28 H46" stroke="#fff" />
        <path d="M22 28 L29 47" stroke="#fff" />
        <path d="M29 47 L49 17" stroke="#7BF0C0" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 22, showMark = true }) {
  return (
    <span className="wordmark" style={{ ['--wm']: size + 'px' }}>
      {showMark && <Mark size={size * 1.35} />}
      <span className="wmtext">
        Kanakku
        <em>ledger</em>
      </span>
    </span>
  );
}

export default Mark;
