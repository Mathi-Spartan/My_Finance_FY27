'use client';
import { useState } from 'react';
import { WORLD_LIST } from '@/lib/worlds';
import { Mark } from './Logo';

// Shown before sign-in. Picking a world sets the identity of everything that
// follows, so it is worth a screen of its own rather than a dropdown.
export default function WorldPicker({ onPick }) {
  const [going, setGoing] = useState(null);

  const choose = (w) => {
    setGoing(w.id);
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => onPick(w.id), 260);
  };

  return (
    <div className="picker">
      <div className="pickhead">
        <Mark size={40} />
        <div className="pickttl">
          <b>Three things, one account</b>
          <span>Pick where you are going</span>
        </div>
      </div>

      <div className="worlds">
        {WORLD_LIST.map((w, i) => (
          <button
            key={w.id}
            className={'world' + (going === w.id ? ' going' : '') + (going && going !== w.id ? ' fading' : '')}
            style={{
              '--wa': w.accent,
              '--w1': w.g[0], '--w2': w.g[1], '--w3': w.g[2],
              animationDelay: i * 70 + 'ms',
            }}
            onClick={() => choose(w)}
          >
            <span className="wglow" />
            <span className="wtop">
              <span className="wtamil">{w.tamil}</span>
              <span className="warrow">→</span>
            </span>
            <span className="wname">{w.name}</span>
            <span className="wtag">{w.tagline}</span>
            <span className="wblurb">{w.blurb}</span>
          </button>
        ))}
      </div>

      <p className="picknote">The same email and password opens all three.</p>
    </div>
  );
}
