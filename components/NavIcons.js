'use client';

// Each nav icon exists twice: a 2.1-weight outline for rest, and a solid
// silhouette for the active tab. Swapping shape rather than only colour is
// what makes the current tab unmistakable at a glance.

const out = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.1,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const NavHome = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M11.3 2.6a1.1 1.1 0 011.4 0l8.1 6.6c.3.2.4.5.4.9V20a1.5 1.5 0 01-1.5 1.5h-4.2V15a1 1 0 00-1-1h-2.8a1 1 0 00-1 1v6.5H4.3A1.5 1.5 0 012.8 20V10.1c0-.4.1-.7.4-.9z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...out} {...p}>
      <path d="M3.4 10.2L12 3.3l8.6 6.9V20a1 1 0 01-1 1h-4.4v-6.4H8.8V21H4.4a1 1 0 01-1-1z" />
    </svg>
  );

export const NavEntries = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M7 2.4a1 1 0 011 1V4h8v-.6a1 1 0 112 0V4h1.2A2.8 2.8 0 0122 6.8v1.4H2V6.8A2.8 2.8 0 014.8 4H6v-.6a1 1 0 011-1z" fill="currentColor" />
      <path d="M2 10.2h20v8A2.8 2.8 0 0119.2 21H4.8A2.8 2.8 0 012 18.2z" fill="currentColor" opacity=".45" />
      <rect x="6" y="13" width="4.4" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="13.6" y="13" width="4.4" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...out} {...p}>
      <rect x="3" y="4.6" width="18" height="16.4" rx="3" />
      <path d="M3 9.6h18M8 2.6v4M16 2.6v4M7.4 14h4M14 14h2.6" />
    </svg>
  );

export const NavPaari = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M12 21c-.3 0-.6-.1-.8-.3C7.5 17.9 3 14.2 3 10.1A4.9 4.9 0 0112 7.4a4.9 4.9 0 019 2.7c0 4.1-4.5 7.8-8.2 10.6-.2.2-.5.3-.8.3z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...out} {...p}>
      <path d="M12 20.2S3.8 15.2 3.8 10.1A4.1 4.1 0 0112 7.6a4.1 4.1 0 018.2 2.5c0 5.1-8.2 10.1-8.2 10.1z" />
    </svg>
  );

export const NavDrivers = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M6.3 5.8A2.6 2.6 0 018.7 4h6.6a2.6 2.6 0 012.4 1.8l1.4 4.1H4.9z" fill="currentColor" opacity=".45" />
      <path d="M3.4 11.4h17.2a1.6 1.6 0 011.6 1.6v3.6a1.6 1.6 0 01-1.6 1.6h-.6a2.6 2.6 0 01-5.1 0H9.1a2.6 2.6 0 01-5.1 0h-.6A1.6 1.6 0 011.8 16.6V13a1.6 1.6 0 011.6-1.6z" fill="currentColor" />
      <circle cx="6.6" cy="18.2" r="1.9" fill="currentColor" />
      <circle cx="17.4" cy="18.2" r="1.9" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...out} {...p}>
      <path d="M4.2 16.6v-4a2 2 0 01.2-.9l1.9-4A2.2 2.2 0 018.3 6.4h7.4a2.2 2.2 0 012 1.3l1.9 4c.1.3.2.6.2.9v4" />
      <path d="M2.8 12.4h18.4" />
      <circle cx="7.4" cy="16.8" r="1.8" />
      <circle cx="16.6" cy="16.8" r="1.8" />
    </svg>
  );

export const NavPatterns = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="3" y="12.6" width="4.4" height="8.4" rx="1.6" fill="currentColor" opacity=".45" />
      <rect x="9.8" y="3" width="4.4" height="18" rx="1.6" fill="currentColor" />
      <rect x="16.6" y="8.6" width="4.4" height="12.4" rx="1.6" fill="currentColor" opacity=".7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...out} {...p}>
      <path d="M5.2 20.4v-7M12 20.4V3.6M18.8 20.4V9.4" />
    </svg>
  );

export const NavCalc = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="4" y="2.2" width="16" height="19.6" rx="3.4" fill="currentColor" opacity=".45" />
      <rect x="6.8" y="5" width="10.4" height="3.6" rx="1.2" fill="currentColor" />
      <circle cx="8.4" cy="12" r="1.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <circle cx="15.6" cy="12" r="1.25" fill="currentColor" />
      <circle cx="8.4" cy="15.8" r="1.25" fill="currentColor" />
      <circle cx="12" cy="15.8" r="1.25" fill="currentColor" />
      <rect x="14.35" y="14.55" width="2.5" height="4.5" rx="1.25" fill="currentColor" />
      <rect x="7.15" y="18.05" width="5.6" height="2.5" rx="1.25" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...out} {...p}>
      <rect x="4.4" y="2.8" width="15.2" height="18.4" rx="3.2" />
      <path d="M8 6.8h8M8.3 11.6h.01M12 11.6h.01M15.7 11.6h.01M8.3 15.6h.01M12 15.6h.01M15.7 15.6v3.2M8.3 18.4h4" />
    </svg>
  );


export const NavScan = ({ solid, ...p }) =>
  solid ? (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M6.4 2.2h7l5.4 5.4v14.2a1.2 1.2 0 01-1.2 1.2H6.4a1.2 1.2 0 01-1.2-1.2V3.4a1.2 1.2 0 011.2-1.2z" fill="currentColor" opacity=".45" />
      <path d="M13.4 2.2l5.4 5.4h-4.2a1.2 1.2 0 01-1.2-1.2z" fill="currentColor" />
      <rect x="8" y="16.4" width="2.1" height="3.4" rx="1.05" fill="currentColor" />
      <rect x="11" y="13.4" width="2.1" height="6.4" rx="1.05" fill="currentColor" />
      <rect x="14" y="10.6" width="2.1" height="9.2" rx="1.05" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...{ fill:'none', stroke:'currentColor', strokeWidth:2.1, strokeLinecap:'round', strokeLinejoin:'round' }} {...p}>
      <path d="M13.4 2.8H6.6a1.8 1.8 0 00-1.8 1.8v14.8a1.8 1.8 0 001.8 1.8h10.8a1.8 1.8 0 001.8-1.8V8.4z" />
      <path d="M13.4 2.8v4.4a1.2 1.2 0 001.2 1.2h4.6" />
      <path d="M9 18v-2.4M12 18v-4.8M15 18v-7.2" />
    </svg>
  );

export const NAV_ICONS = {
  home: NavHome,
  entries: NavEntries,
  paari: NavPaari,
  drivers: NavDrivers,
  insights: NavPatterns,
  calc: NavCalc,
  scan: NavScan,
};
