'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Close, Trash } from './Icons';
import { money, isoDay, splitName } from '@/lib/finance';

export default function EditSheet({ tx, onClose }) {
  const { accounts, categories, updateTx, deleteTx, say } = useStore();

  const [dir, setDir] = useState(tx.direction === 'in' ? 'in' : 'out');
  const [amount, setAmount] = useState(String(Number(tx.amount) || ''));
  const [merchant, setMerchant] = useState(tx.merchant === 'Unnamed' ? '' : (tx.merchant || ''));
  const [catId, setCatId] = useState(tx.category_id || '');
  const [acctId, setAcctId] = useState(tx.account_id || '');
  const [date, setDate] = useState(isoDay(tx.occurred_at));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const live = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const cats = useMemo(
    () => categories.filter((c) => !c.archived && c.direction === (dir === 'in' ? 'in' : 'out')),
    [categories, dir]
  );

  const value = Number(amount) || 0;
  const changed =
    dir !== tx.direction ||
    value !== Number(tx.amount) ||
    merchant.trim() !== (tx.merchant === 'Unnamed' ? '' : tx.merchant || '') ||
    (catId || null) !== (tx.category_id || null) ||
    acctId !== tx.account_id ||
    date !== isoDay(tx.occurred_at);

  const save = async () => {
    if (value <= 0) { say('Enter an amount above zero'); return; }
    if (!acctId) { say('Pick an account'); return; }
    setBusy(true);
    // keep the original time of day, only move the date
    const when = new Date(date);
    const orig = new Date(tx.occurred_at);
    when.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds());
    await updateTx(tx.id, {
      direction: dir,
      amount: value,
      merchant: merchant.trim() || 'Unnamed',
      category_id: catId || null,
      account_id: acctId,
      occurred_at: when.toISOString(),
    });
    setBusy(false);
    say('Entry updated');
    onClose();
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Edit entry">
        <div className="grab" />

        <div className="flowhead">
          <button className="icobtn" onClick={onClose} aria-label="Close">
            <Close width="15" height="15" />
          </button>
          <div className="dirseg">
            <button className={dir === 'in' ? 'on-in' : ''} onClick={() => { setDir('in'); setCatId(''); }}>In</button>
            <button className={dir === 'out' ? 'on-out' : ''} onClick={() => { setDir('out'); setCatId(''); }}>Out</button>
          </div>
          <button className="icobtn" onClick={() => setConfirm(true)} aria-label="Delete">
            <Trash width="15" height="15" />
          </button>
        </div>

        {confirm ? (
          <div style={{ marginTop: 18 }}>
            <div className="sheettitle">Delete this entry?</div>
            <div className="sheetsub">
              {tx.merchant} · {money(tx.amount)}. This can&apos;t be undone.
            </div>
            <button className="btn danger" onClick={async () => { await deleteTx(tx.id); onClose(); }}>
              Yes, delete it
            </button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <>
            <div className={'amount' + (dir === 'in' ? ' credit' : '')} style={{ marginBottom: 16 }}>
              <span className="sgn">{dir === 'in' ? '+' : '−'}</span>₹{value.toLocaleString('en-IN', {
                minimumFractionDigits: value % 1 ? 2 : 0,
                maximumFractionDigits: 2,
              })}
            </div>

            <div className="field">
              <label>Amount (₹)</label>
              <input type="number" inputMode="decimal" step="0.01" value={amount}
                     onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div className="field">
              <label>{dir === 'in' ? 'Where did it come from?' : 'What was it for?'}</label>
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)}
                     placeholder={dir === 'in' ? 'Salary, refund, transfer…' : 'Rent, EMI, groceries…'} />
            </div>

            <div className="field">
              <label>Account</label>
              <select value={acctId} onChange={(e) => setAcctId(e.target.value)}>
                {live.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Category</label>
              <select value={catId} onChange={(e) => setCatId(e.target.value)}>
                <option value="">Uncategorised</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Date</label>
              <input type="date" value={date}
                     min={`${new Date().getFullYear() - 20}-01-01`}
                     max={`${new Date().getFullYear() + 20}-12-31`}
                     onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>

            <button className="btn" onClick={save} disabled={busy || !changed}>
              {busy ? 'Saving…' : changed ? 'Save changes' : 'Nothing changed yet'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
