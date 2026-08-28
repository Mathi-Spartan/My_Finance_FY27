'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Sheets must not live inside a view whose animation uses transform: that
// creates a stacking context and traps them under the bottom nav, which
// silently makes buttons unclickable. Render them straight into body.
export default function Portal({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
