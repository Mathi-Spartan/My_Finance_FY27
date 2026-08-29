'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Close, Arrow, Check, Bolt } from './Icons';
import Portal from './Portal';
import {
  rupees, frequentMerchants, isoDay, totals,
} from '@/lib/finance';

export default function AddSheet({ onClose, presetAccount, presetAmount }) {
  const { accounts, categories, txs, addTx, say } = useStore();

  const [dir, setDir] = useState('out');
  const [raw, setRaw] = useState(presetAmount ? String(presetAmount) : '');
  const [merchant, setMerchant] = useState('');
  const [catId, setCatId] = useState(null);
  const [autoCat, setAutoCat] = useState(false);
  const [acctId, setAcctId] = useState(presetAccount || accounts[0]?.id || null);
  const [toAcctId, setToAcctId] = useState(accounts[1]?.id || null);
  const [date, setDate] = useState(isoDay(new Date()));
  const [picker, setPicker] = useState(null); // 'cat' | 'acct' | 'to' | 'date'
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState('idle');   // idle | saving | done
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [again, setAgain] = useState(false);

  const amount = Number(raw || 0) || 0;
  // Show the number exactly as typed, only grouping the rupee part.
  const typed = (() => {
    if (raw === '') return { whole: '0', dec: null };
    const [w, d] = raw.split('.');
    const grouped = w === '' ? '0' : Number(w).toLocaleString('en-IN');
    return { whole: grouped, dec: d === undefined ? null : d };
  })();

  const live = accounts.filter((a) => !a.archived);
  const cats = categories.filter((c) => !c.archived && (dir === 'in' ? c.direction === 'in' : c.direction === 'out'));
  const recall = useMemo(() => frequentMerchants(txs, dir, 5), [txs, dir]);

  useEffect(() => { setCatId(null); setAutoCat(false); }, [dir]);
  useEffect(() => { if (!acctId && live.length) setAcctId(live[0].id); }, [acctId, live]);

  // typing a known merchant fills its usual category and account
  useEffect(() => {
    const key = merchant.trim().toLowerCase();
    if (!key) return;
    const hit = txs.find((t) => t.direction === dir && (t.merchant || '').trim().toLowerCase() === key);
    if (hit && !catId) { setCatId(hit.category_id); setAutoCat(true); if (hit.account_id) setAcctId(hit.account_id); }
  }, [merchant, txs, dir, catId]);

  const cat = cats.find((c) => c.id === catId);
  const acct = live.find((a) => a.id === acctId);
  const toAcct = live.find((a) => a.id === toAcctId);

  // what this entry does to your day
  // What this entry does to the month's running totals.
  const impact = useMemo(() => {
    const m = totals(txs);
    const nextIn = dir === 'in' ? m.in + amount : m.in;
    const nextOut = dir === 'out' ? m.out + amount : m.out;
    return { nextIn, nextOut, net: nextIn - nextOut };
  }, [txs, dir, amount]);

  const press = (k) => {
    if (k === 'del') { setRaw((p) => p.slice(0, -1)); return; }

    setRaw((p) => {
      if (k === '.') {
        if (p.includes('.')) return p;       // only one decimal point
        return p === '' ? '0.' : p + '.';
      }
      const [whole = '', dec] = p.split('.');
      if (dec !== undefined) {
        if (dec.length >= 2) return p;       // paise stop at two digits
        return p + k;
      }
      if (whole.replace(/\D/g, '').length >= 9) return p;
      if (p === '0') return k;               // no leading zeros
      return p + k;
    });
  };

  const reset = () => {
    setRaw('');
    setMerchant('');
    setCatId(null);
    setAutoCat(false);
    setNote('');
    setShowNote(false);
  };

  const commit = async () => {
    if (phase !== 'idle') return;
    if (amount <= 0) { say('Enter an amount first'); bump(); return; }
    if (!acctId) { say('Pick an account'); bump(); return; }

    setPhase('saving');
    setSaving(true);
    const when = new Date(date);
    const now = new Date();
    when.setHours(now.getHours(), now.getMinutes());
    const row = {
      account_id: acctId,
      category_id: dir === 'transfer' ? null : catId,
      merchant: merchant.trim() || (dir === 'transfer' ? `To ${toAcct?.name || ''}` : 'Unnamed'),
      direction: dir,
      amount,
      occurred_at: when.toISOString(),
      context: 'personal',
      note: note.trim(),
      transfer_to: dir === 'transfer' ? toAcctId : null,
    };
    const ok = await addTx(row);
    setSaving(false);

    if (!ok) { setPhase('idle'); return; }
    setPhase('done');
    if (navigator.vibrate) navigator.vibrate([8, 40, 14]);
    setTimeout(() => {
      if (again) { reset(); setPhase('idle'); }
      else onClose();
    }, 700);
  };

  // a small shake when something is missing
  const [shake, setShake] = useState(0);
  const bump = () => { setShake((n) => n + 1); if (navigator.vibrate) navigator.vibrate(30); };

  const quick = (n) => {
    setRaw((p) => {
      const next = (Number(p || 0) || 0) + n;
      return String(next);
    });
  };

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Add entry">
        <div className="grab" />

        {picker ? (
          <Picker
            kind={picker}
            cats={cats} accounts={live} date={date}
            onPick={(v) => {
              if (picker === 'cat') { setCatId(v); setAutoCat(false); }
              if (picker === 'acct') setAcctId(v);
              if (picker === 'to') setToAcctId(v);
              if (picker === 'date') setDate(v);
              setPicker(null);
            }}
            onBack={() => setPicker(null)}
          />
        ) : (
          <>
            <div className="flowhead">
              <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
              <div className={'dirseg slide pos-' + dir}>
                <span className="dirpill" />
                <button className={dir === 'in' ? 'sel' : ''} onClick={() => setDir('in')}>In</button>
                <button className={dir === 'out' ? 'sel' : ''} onClick={() => setDir('out')}>Out</button>
                <button className={dir === 'transfer' ? 'sel' : ''} onClick={() => setDir('transfer')}>Move</button>
              </div>
              <div style={{ width: 36 }} />
            </div>

            <div className={'amount' + (dir === 'in' ? ' credit' : '')}>
              {dir !== 'transfer' && <span className="sgn">{dir === 'in' ? '+' : '−'}</span>}
              <span className="digits">
                {('₹' + typed.whole).split('').map((ch, i) => (
                  <span key={ch + i} className="dg">{ch}</span>
                ))}
              </span>
              {typed.dec !== null && (
                <span className="ghost digits">
                  {('.' + typed.dec).split('').map((ch, i) => (
                    <span key={'d' + ch + i} className="dg">{ch}</span>
                  ))}
                </span>
              )}
            </div>

            <div className="who">
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder={dir === 'in' ? 'Where did it come from?' : dir === 'transfer' ? 'Note (optional)' : 'What was it for?'}
                enterKeyHint="done"
              />
            </div>

            {recall.length > 0 && dir !== 'transfer' && (
              <div className="chips">
                {recall.map((m) => (
                  <button key={m.name} className="chip small" onClick={() => {
                    setMerchant(m.name);
                    if (m.category_id) { setCatId(m.category_id); setAutoCat(true); }
                    if (m.account_id) setAcctId(m.account_id);
                  }}>{m.name}</button>
                ))}
              </div>
            )}

            <div className="chips">
              {dir === 'transfer' ? (
                <>
                  <button className="chip" onClick={() => setPicker('acct')}>From {acct?.name || 'account'}</button>
                  <button className="chip" onClick={() => setPicker('to')}>To {toAcct?.name || 'account'}</button>
                </>
              ) : (
                <>
                  <button className={'chip' + (autoCat ? ' auto' : '')} onClick={() => setPicker('cat')}>
                    {autoCat && <Bolt width="12" height="12" />}
                    {cat?.name || 'Category'}
                  </button>
                  <button className="chip" onClick={() => setPicker('acct')}>{acct?.name || 'Account'}</button>
                </>
              )}
              <button className="chip" onClick={() => setPicker('date')}>
                {date === isoDay(new Date()) ? 'Today' : new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </button>
            </div>

            {dir !== 'transfer' && amount > 0 && (
              <div className="impact">
                {dir === 'in' ? 'In' : 'Out'} this month becomes{' '}
                <b className={dir === 'in' ? 'ok' : ''}>
                  {rupees(dir === 'in' ? impact.nextIn : impact.nextOut, { decimals: false })}
                </b>
                {' · net '}
                <b className={impact.net >= 0 ? 'ok' : ''}>
                  {impact.net < 0 ? '−' : ''}{rupees(impact.net, { decimals: false })}
                </b>
              </div>
            )}

            <div className="pad">
              {['1','2','3','4','5','6','7','8','9','.','0'].map((k) => (
                <button key={k} className="key" onClick={() => press(k)}>{k}</button>
              ))}
              <button className="key" onClick={() => press('del')} aria-label="Delete">⌫</button>
            </div>

            {/* quick amounts */}
            <div className="quickamts">
              {[100, 500, 1000, 5000].map((n) => (
                <button key={n} className="qamt" onClick={() => quick(n)}>+{n >= 1000 ? (n / 1000) + 'k' : n}</button>
              ))}
              <button className="qamt ghost" onClick={() => setRaw('')} disabled={!raw}>Clear</button>
            </div>

            {/* optional note */}
            {showNote ? (
              <div className="field notefield">
                <input autoFocus value={note} onChange={(e) => setNote(e.target.value)}
                       placeholder="Note — what was this for exactly?" />
              </div>
            ) : (
              <button className="addnote" onClick={() => setShowNote(true)}>+ Add a note</button>
            )}

            <div className="actionrow">
              <button
                className={'morph ' + phase + (dir === 'in' ? ' in' : '')}
                onClick={commit}
                disabled={phase !== 'idle'}
                key={shake}
              >
                <span className="mlabel">
                  {dir === 'in' ? 'Add money in' : dir === 'transfer' ? 'Move money' : 'Add money out'}
                </span>
                <span className="mspin" />
                <span className="mtick"><Check width="22" height="22" /></span>
              </button>
            </div>

            <button className={'againtoggle' + (again ? ' on' : '')} onClick={() => setAgain((v) => !v)}>
              <span className="box">{again ? <Check width="11" height="11" /> : null}</span>
              Keep the sheet open for another
            </button>
          </>
        )}
      </div>
    </Portal>
  );
}

function Picker({ kind, cats, accounts, date, onPick, onBack }) {
  const title = { cat: 'Category', acct: 'Account', to: 'Move to', date: 'Date' }[kind];
  return (
    <div>
      <div className="flowhead" style={{ marginBottom: 14 }}>
        <button className="icobtn" onClick={onBack} aria-label="Back"><Close width="15" height="15" /></button>
        <div className="sheettitle">{title}</div>
        <div style={{ width: 36 }} />
      </div>
      {kind === 'date' ? (
        <div>
          <div className="field">
            <input
              type="date"
              autoFocus
              defaultValue={date}
              min={`${new Date().getFullYear() - 20}-01-01`}
              max={`${new Date().getFullYear() + 20}-12-31`}
              onChange={(e) => e.target.value && onPick(e.target.value)}
            />
          </div>
          <div className="quickdates">
            {[
              ['Today', 0], ['Yesterday', -1], ['2 days ago', -2],
              ['A week ago', -7], ['A month ago', -30],
            ].map(([label, off]) => {
              const d = new Date();
              d.setDate(d.getDate() + off);
              const iso = d.toISOString().slice(0, 10);
              return (
                <button key={label} className="chip small" onClick={() => onPick(iso)}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="picker">
          {(kind === 'cat' ? cats : accounts).map((x) => (
            <button key={x.id} className="pick" onClick={() => onPick(x.id)}>
              <span>
                {x.name}
                {kind === 'cat' && Number(x.budget) > 0 && (
                  <span className="sub">Budget {rupees(x.budget, { decimals: false })}/mo</span>
                )}
                {kind !== 'cat' && <span className="sub">{x.kind === 'card' ? 'Credit card' : 'Bank account'}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
