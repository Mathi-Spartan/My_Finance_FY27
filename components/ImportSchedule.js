'use client';
import { useMemo, useRef, useState } from 'react';
import Portal from './Portal';
import { Close, Check } from './Icons';
import { parseSchedule } from '@/lib/schedule';
import { money } from '@/lib/finance';

export default function ImportSchedule({ onClose, onImport }) {
  const [text, setText] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const file = useRef(null);

  const parsed = useMemo(
    () => (text.trim() ? parseSchedule(text, { year: Number(year) || undefined }) : null),
    [text, year]
  );

  const readImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1]);
        r.onerror = () => rej(new Error('Could not read that file'));
        r.readAsDataURL(f);
      });
      const res = await fetch('/api/read-schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: b64, mediaType: f.type || 'image/png' }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ t: 'err', m: data.message || 'That image could not be read.' }); }
      else { setText(data.text || ''); setMsg({ t: 'ok', m: 'Read the image — check the rows below before saving.' }); }
    } catch (err) {
      setMsg({ t: 'err', m: err?.message || 'Something went wrong reading that image.' });
    }
    setBusy(false);
    e.target.value = '';
  };

  const warnings = parsed?.rows.filter((r) => r.warn) || [];
  const missingAmount = parsed?.rows.filter((r) => !r.amount).length || 0;

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 12 }}>
          <div className="sheettitle">Import a schedule</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close">
            <Close width="15" height="15" />
          </button>
        </div>

        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        <div className="btnrow" style={{ marginBottom: 10 }}>
          <button className="btn ghost" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Reading the image…' : 'Upload a photo'}
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={readImage} />
        </div>

        <div className="field">
          <label>Or paste the schedule</label>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Speech Therapy\n01/07/2026  Wednesday  11.30 - 12.15  600\n06/07/2026  Monday     12.15 - 1.00   600'}
          />
        </div>

        <div className="field">
          <label>Year (used when the sheet omits it)</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>

        {parsed && (
          <>
            <div className="parsehead">
              <b>{parsed.rows.length}</b> {parsed.rows.length === 1 ? 'session' : 'sessions'} found
              {Object.entries(parsed.totals).map(([k, v]) => (
                <span key={k} className="ptot">{k} {v.count} · {money(v.amount)}</span>
              ))}
            </div>

            {(warnings.length > 0 || missingAmount > 0 || parsed.problems.length > 0) && (
              <div className="parsewarn">
                {warnings.map((w, i) => <div key={i}>⚠ {w.warn}</div>)}
                {missingAmount > 0 && <div>⚠ {missingAmount} row(s) have no amount — they will save as ₹0.</div>}
                {parsed.problems.map((p, i) => <div key={'p' + i}>⚠ {p}</div>)}
              </div>
            )}

            <div className="parselist">
              {parsed.rows.map((r, i) => (
                <div className="prow" key={i}>
                  <span className="pd">{r.on_date.slice(8)}/{r.on_date.slice(5, 7)}</span>
                  <span className="pt">{r.therapy}</span>
                  <span className="ps">{r.slot || '—'}</span>
                  <span className="pa">{money(r.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          className="btn"
          disabled={!parsed || parsed.rows.length === 0 || saving}
          onClick={async () => {
            setSaving(true);
            const n = await onImport(parsed.rows.map(({ warn, ...r }) => r));
            setSaving(false);
            if (n !== false) onClose();
          }}
        >
          {saving ? 'Saving…' : parsed ? `Add these ${parsed.rows.length}` : 'Nothing to add yet'}
        </button>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </Portal>
  );
}
