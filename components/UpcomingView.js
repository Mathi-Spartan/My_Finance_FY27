'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Plus, Trash } from './Icons';
import {
  rupees, detectRecurring, upcoming, dormant, committedMonthly,
  initials, colorOf, safeToSpend,
} from '@/lib/finance';

export default function UpcomingView({ context }) {
  const { txs, recurring, accounts, categories, settings, saveRecurring, removeRecurring, say } = useStore();
  const [ignored, setIgnored] = useState([]);
  const [adding, setAdding] = useState(false);

  const found = useMemo(
    () => detectRecurring(txs, recurring).filter((f) => !ignored.includes(f.key)),
    [txs, recurring, ignored]
  );
  const next = useMemo(() => upcoming(recurring, 14), [recurring]);
  const idle = useMemo(() => dormant(recurring, txs), [recurring, txs]);
  const committed = committedMonthly(recurring);
  const sts = safeToSpend({ accounts, txs, recurring, settings, context });
  const hit = found[0];

  const track = async (f) => {
    await saveRecurring({
      name: f.name, amount: f.amount, day_of_month: f.day_of_month,
      account_id: f.account_id, category_id: f.category_id,
      direction: 'out', status: 'tracked',
    });
    say(`${f.name} is now committed`);
  };

  return (
    <div className="body">
      <div className="apphead">
        <div className="seg"><button className="on">Commitments</button></div>
        <div className="spacer" />
        <button className="icobtn" onClick={() => setAdding(true)} aria-label="Add commitment">
          <Plus width="16" height="16" />
        </button>
      </div>

      {hit && (
        <div className="detect">
          <div className="eb">Pattern found</div>
          <h4>{hit.name}, {rupees(hit.amount, { decimals: false })}</h4>
          <p>
            Charged around the {hit.day_of_month}th, {hit.months} months running. It isn't in your committed
            total yet — which means safe-to-spend is showing {rupees(hit.amount / 30, { decimals: false })} a day
            more than you actually have.
          </p>
          <div className="acts">
            <button className="primary" onClick={() => track(hit)}>Track it</button>
            <button className="ghostb" onClick={() => setIgnored((p) => [...p, hit.key])}>Not recurring</button>
          </div>
        </div>
      )}

      <div className="card rise d2">
        <div className="cardhead">
          <h4>Next 14 days</h4>
          <span>{rupees(committed, { decimals: false })} / mo committed</span>
        </div>
        {next.length === 0 ? (
          <div className="empty" style={{ padding: '18px 0' }}>
            Nothing due in the next fortnight. Add rent, EMIs and subscriptions here so they stop being surprises.
          </div>
        ) : (
          <>
            <div className="tl">
              {next.map((r, i) => (
                <div className={'tlrow' + (r.inDays <= 3 ? ' soon' : '')} key={r.id + i}>
                  <span className="when">{r.due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()}</span>
                  <span className="nm">
                    {r.name}
                    <small>{r.inDays === 0 ? 'Due today' : `in ${r.inDays} days`}</small>
                  </span>
                  <span className="amt">{rupees(r.amount, { decimals: false })}</span>
                </div>
              ))}
            </div>
            <div className="summary">
              <span>Free to spend after these</span>
              <b style={{ color: sts.pool < 0 ? 'var(--out)' : undefined }}>
                {rupees(sts.pool, { decimals: false })}
              </b>
            </div>
          </>
        )}
      </div>

      {recurring.length > 0 && (
        <div className="card">
          <div className="cardhead"><h4>All commitments</h4><span>{recurring.length} tracked</span></div>
          {recurring.map((r) => (
            <div className="row" key={r.id} style={{ marginBottom: 8 }}>
              <span className="av" style={{ background: `var(--${colorOf(r.name)}-soft)`, color: `var(--${colorOf(r.name)})` }}>
                {initials(r.name)}
              </span>
              <span className="rmain">
                <span className="rtop">
                  <span className="rname">{r.name}</span>
                  <span className="ramt">{rupees(r.amount, { decimals: false })}</span>
                </span>
                <span className="rbot">
                  <span className="tag">Day {r.day_of_month} each month</span>
                  <span className="rmeta">{r.status}</span>
                </span>
              </span>
              <button className="icobtn" onClick={() => removeRecurring(r.id)} aria-label="Remove">
                <Trash width="15" height="15" />
              </button>
            </div>
          ))}
        </div>
      )}

      {idle.length > 0 && (
        <div className="card">
          <div className="cardhead"><h4>Paying, not using</h4><span>no entries in 3 months</span></div>
          {idle.map((r) => (
            <div className="row" key={r.id} style={{ marginBottom: 8 }}>
              <span className="av" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                {initials(r.name)}
              </span>
              <span className="rmain">
                <span className="rtop">
                  <span className="rname">{r.name}</span>
                  <span className="ramt">{rupees(r.amount, { decimals: false })}/mo</span>
                </span>
                <span className="rbot">
                  <span className="tag">{r.hits === 0 ? 'Never seen in entries' : 'Last used ' + r.lastUsed.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>
                  <span className="rmeta">{rupees(r.amount * 12, { decimals: false })}/yr</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddCommitment
          accounts={accounts} categories={categories}
          onClose={() => setAdding(false)}
          onSave={async (row) => { await saveRecurring(row); setAdding(false); say('Commitment added'); }}
        />
      )}
    </div>
  );
}

function AddCommitment({ accounts, categories, onSave, onClose }) {
  const [f, setF] = useState({ name: '', amount: '', day_of_month: 1, account_id: accounts[0]?.id, category_id: '', direction: 'out', status: 'tracked' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <div className="sheettitle">New commitment</div>
        <div className="sheetsub">Rent, an EMI, a subscription — anything that leaves on a fixed day.</div>
        <div className="field"><label>Name</label><input value={f.name} onChange={set('name')} placeholder="Rent" /></div>
        <div className="field"><label>Amount (₹)</label><input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="18000" /></div>
        <div className="field"><label>Day of month</label><input type="number" min="1" max="28" value={f.day_of_month} onChange={set('day_of_month')} /></div>
        <div className="field"><label>Account</label>
          <select value={f.account_id || ''} onChange={set('account_id')}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Category</label>
          <select value={f.category_id || ''} onChange={set('category_id')}>
            <option value="">None</option>
            {categories.filter((c) => c.direction === 'out').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn" onClick={() => {
          if (!f.name || !Number(f.amount)) return;
          onSave({ ...f, amount: Number(f.amount), day_of_month: Number(f.day_of_month), category_id: f.category_id || null });
        }}>Save commitment</button>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
