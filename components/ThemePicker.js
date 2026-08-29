'use client';
import { useState } from 'react';
import Portal from './Portal';
import { Close, Check } from './Icons';
import { THEMES, GROUPS, swatch } from '@/lib/themes';

export default function ThemePicker({ current, mode, onPick, onClose }) {
  const [preview, setPreview] = useState(current);

  const choose = (id) => {
    setPreview(id);
    onPick(id);              // applied live, so you judge it on the real screen
  };

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet themesheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 6 }}>
          <div className="sheettitle">Themes</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close">
            <Close width="15" height="15" />
          </button>
        </div>
        <p className="sheetsub">
          Tap any palette to try it — the screen behind changes as you go.
        </p>

        {GROUPS.map((group) => (
          <div key={group}>
            <div className="tgroup">{group}</div>
            <div className="tgrid">
              {THEMES.filter((t) => t.group === group).map((t) => {
                const s = swatch(t, mode);
                const on = preview === t.id;
                return (
                  <button key={t.id} className={'tcard' + (on ? ' on' : '')} onClick={() => choose(t.id)}>
                    <span className="tswatch" style={{ background: s.paper }}>
                      <span className="tmini" style={{ background: s.card }} />
                      <span className="tdot2" style={{ background: s.accent }} />
                      {on && <span className="tcheck"><Check width="13" height="13" /></span>}
                    </span>
                    <span className="tname">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Portal>
  );
}
