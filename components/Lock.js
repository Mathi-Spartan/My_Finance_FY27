'use client';
import { useState } from 'react';

export default function Lock({ pin, onUnlock }) {
  const [entry, setEntry] = useState('');
  const [bad, setBad] = useState(false);

  const press = (k) => {
    if (k === 'del') { setEntry((p) => p.slice(0, -1)); setBad(false); return; }
    const next = (entry + k).slice(0, 4);
    setEntry(next);
    if (next.length === 4) {
      if (next === String(pin)) onUnlock();
      else { setBad(true); setTimeout(() => { setEntry(''); setBad(false); }, 600); }
    }
  };

  return (
    <div className="center">
      <div className="loginbox">
        <div className="mark" style={{ textAlign: 'center' }}>Ledgerline</div>
        <p className="tag2" style={{ textAlign: 'center' }}>
          {bad ? 'Wrong PIN. Try again.' : 'Enter your PIN'}
        </p>
        <div className="pindots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={'pindot' + (entry.length > i ? ' on' : '')}
                  style={bad ? { borderColor: 'var(--out)', background: entry.length > i ? 'var(--out)' : '' } : {}} />
          ))}
        </div>
        <div className="pad">
          {['1','2','3','4','5','6','7','8','9'].map((k) => (
            <button key={k} className="key" onClick={() => press(k)}>{k}</button>
          ))}
          <span />
          <button className="key" onClick={() => press('0')}>0</button>
          <button className="key" onClick={() => press('del')}>⌫</button>
        </div>
      </div>
    </div>
  );
}
