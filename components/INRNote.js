'use client';

// Stylised Indian notes: the real denomination colours and proportions,
// deliberately simplified rather than a faithful reproduction of the design.
export const DENOMS = [
  { v: 500, body: '#8C8579', ink: '#FFFFFF', edge: '#6E685E' },  // stone grey
  { v: 200, body: '#F2B441', ink: '#4A3410', edge: '#D0942A' },  // bright yellow
  { v: 100, body: '#A78BC4', ink: '#2E2140', edge: '#8A6FA8' },  // lavender
  { v: 50,  body: '#63B3D6', ink: '#123043', edge: '#4794B8' },  // fluorescent blue
  { v: 20,  body: '#C9CE55', ink: '#3A3D10', edge: '#A9AE3C' },  // greenish yellow
  { v: 10,  body: '#A9835C', ink: '#3B2A18', edge: '#8B6844' },  // chocolate brown
];

const byValue = Object.fromEntries(DENOMS.map((d) => [d.v, d]));

// Which notes you'd actually be handed for an amount.
export function notesFor(amount, max = 6) {
  let left = Math.max(0, Math.round(Number(amount) || 0));
  const out = [];
  for (const d of DENOMS) {
    while (left >= d.v && out.length < max) {
      out.push(d.v);
      left -= d.v;
    }
  }
  if (out.length === 0) out.push(10);
  return out;
}

export default function INRNote({ denom = 500, className, style }) {
  const d = byValue[denom] || byValue[500];
  const id = 'n' + denom;
  return (
    <svg className={className} style={style} viewBox="0 0 66 30" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={d.body} />
          <stop offset="100%" stopColor={d.edge} />
        </linearGradient>
      </defs>

      <rect x="0.5" y="0.5" width="65" height="29" rx="2.5" fill={`url(#${id})`} />
      <rect x="2.4" y="2.4" width="61.2" height="25.2" rx="1.6"
            fill="none" stroke={d.ink} strokeWidth="0.5" opacity=".35" />

      {/* portrait panel */}
      <rect x="4.5" y="5" width="15" height="20" rx="1.4" fill={d.ink} opacity=".16" />
      <circle cx="12" cy="12.5" r="3.6" fill={d.ink} opacity=".3" />
      <path d="M7.4 22.5c0-3 2-5 4.6-5s4.6 2 4.6 5" fill={d.ink} opacity=".3" />

      {/* denomination */}
      <text x="42" y="17.4" textAnchor="middle" fill={d.ink}
            fontFamily="'IBM Plex Mono', monospace" fontSize="11" fontWeight="700">
        {denom}
      </text>
      <text x="42" y="24" textAnchor="middle" fill={d.ink} opacity=".7"
            fontFamily="'IBM Plex Mono', monospace" fontSize="4.6" letterSpacing="0.4">
        RUPEES
      </text>

      {/* rupee mark, small, top right */}
      <text x="61" y="9.6" textAnchor="end" fill={d.ink} opacity=".85"
            fontFamily="'IBM Plex Mono', monospace" fontSize="6" fontWeight="700">
        ₹
      </text>

      {/* security thread and guilloche hints */}
      <path d="M23.5 3v24" stroke={d.ink} strokeWidth="0.7" strokeDasharray="1.6 1.2" opacity=".45" />
      <path d="M27 7h10M27 9h7" stroke={d.ink} strokeWidth="0.5" opacity=".3" />
      <path d="M56 21h6M52 23h10" stroke={d.ink} strokeWidth="0.5" opacity=".28" />
    </svg>
  );
}
