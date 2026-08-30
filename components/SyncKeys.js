'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Trash, Check } from './Icons';

// A key can only add health days for its owner. It cannot read anything, touch
// your money, or sign in — so it is safe to paste into another app, and safe to
// throw away the moment you stop trusting that app.
export default function SyncKeys() {
  const { syncKeys, makeSyncKey, revokeSyncKey } = useStore();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const base = typeof window !== 'undefined' ? window.location.origin : '';

  const urlFor = (k) => `${base}/api/health-sync?key=${k.token}`;

  return (
    <div className="card">
      <div className="cardhead"><h4>Automatic sync</h4><span>{syncKeys.length} key{syncKeys.length === 1 ? '' : 's'}</span></div>
      <p className="note" style={{ marginTop: 0 }}>
        A sync key lets another app send your Health data here without ever
        knowing your password. It can only add health days — it cannot read
        anything, cannot see your money, and cannot sign in. Revoke it any time
        and it stops working immediately.
      </p>

      {syncKeys.map((k) => (
        <div className="keyrow" key={k.token}>
          <div className="keytop">
            <b>{k.label || 'Sync key'}</b>
            <button className="icobtn" onClick={() => revokeSyncKey(k.token)} aria-label="Revoke">
              <Trash width="14" height="14" />
            </button>
          </div>
          <div className="keyurl">{urlFor(k)}</div>
          <div className="keyfoot">
            <span>
              {k.uses > 0
                ? `used ${k.uses} time${k.uses === 1 ? '' : 's'}${k.last_used ? ` · last ${new Date(k.last_used).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`
                : 'never used yet'}
            </span>
            <button className="mini solid" onClick={async () => {
              try {
                await navigator.clipboard.writeText(urlFor(k));
                setCopied(k.token);
                setTimeout(() => setCopied(null), 1500);
              } catch { /* clipboard unavailable */ }
            }}>
              {copied === k.token ? <><Check width="11" height="11" /> Copied</> : 'Copy the URL'}
            </button>
          </div>
        </div>
      ))}

      <button className="btn ghost" style={{ marginTop: syncKeys.length ? 10 : 0 }} disabled={busy}
              onClick={async () => { setBusy(true); await makeSyncKey('iPhone'); setBusy(false); }}>
        {busy ? 'Making one…' : 'Make a new sync key'}
      </button>
    </div>
  );
}
