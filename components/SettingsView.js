'use client';
import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Moon, Sun, Plus } from './Icons';
import { rupees, toCSV, parseCSV, isoDay, accountBalances } from '@/lib/finance';

export default function SettingsView({ theme, toggleTheme }) {
  const {
    accounts, categories, txs, settings, session,
    saveAccount, saveCategory, saveSettings, bulkTx, signOut, say,
  } = useStore();
  const [tab, setTab] = useState('money');
  const [newAcct, setNewAcct] = useState('');
  
  const file = useRef(null);
  const [importing, setImporting] = useState(false);
  const balances = accountBalances(accounts, txs);

  const exportCSV = () => {
    const blob = new Blob([toCSV(txs, accounts, categories)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledgerline-${isoDay(new Date())}.csv`;
    a.click();
  };

  const importCSV = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    const rows = parseCSV(await f.text());
    const acctBy = Object.fromEntries(accounts.map((a) => [a.name.toLowerCase(), a.id]));
    const catBy = Object.fromEntries(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const fallback = accounts[0]?.id;
    const mapped = rows.map((r) => {
      const amt = Math.abs(Number(String(r.amount || r.debit || r.credit || 0).replace(/[^0-9.\-]/g, '')));
      const dir = r.direction ? String(r.direction).toLowerCase()
        : Number(r.credit) > 0 ? 'in' : 'out';
      return {
        merchant: r.merchant || r.description || r.narration || 'Imported',
        amount: amt,
        direction: dir === 'in' || dir === 'credit' ? 'in' : 'out',
        occurred_at: new Date(r.date || r.occurred_at || Date.now()).toISOString(),
        account_id: acctBy[String(r.account || '').toLowerCase()] || fallback,
        category_id: catBy[String(r.category || '').toLowerCase()] || null,
        context: (r.context || 'personal').toLowerCase() === 'business' ? 'business' : 'personal',
        note: r.note || '',
      };
    }).filter((r) => r.amount > 0);
    const ok = await bulkTx(mapped);
    setImporting(false);
    if (ok) say(`Imported ${mapped.length} entries`);
    e.target.value = '';
  };

  return (
    <div className="body">
      <div className="apphead">
        <div className="seg">
          <button className={tab === 'money' ? 'on' : ''} onClick={() => setTab('money')}>Money</button>
          <button className={tab === 'app' ? 'on' : ''} onClick={() => setTab('app')}>App</button>
        </div>
        <div className="spacer" />
        <button className="icobtn" onClick={toggleTheme} aria-label="Switch theme">
          {theme === 'dark' ? <Sun width="16" height="16" /> : <Moon width="16" height="16" />}
        </button>
      </div>

      {tab === 'money' && (
        <>
          <div className="card">
            <div className="cardhead"><h4>Accounts</h4><span>{accounts.length}</span></div>
            {accounts.map((a) =>
              a.kind === 'card' ? (
                <CardEditor key={a.id} account={a} onSave={saveAccount} />
              ) : (
                <div className="field" key={a.id}>
                  <label>{a.name} · {rupees(balances[a.id] || 0, { decimals: false })}</label>
                  <input type="number" inputMode="decimal" defaultValue={a.opening}
                         onBlur={(e) => saveAccount({ id: a.id, opening: Number(e.target.value) || 0 })}
                         placeholder="Balance today" />
                </div>
              )
            )}
            <div className="field">
              <label>Add another</label>
              <input value={newAcct} onChange={(e) => setNewAcct(e.target.value)}
                     placeholder="Name, e.g. Cash — Wallet" />
            </div>
            <div className="btnrow">
              {[['bank', 'Bank'], ['cash', 'Cash'], ['card', 'Credit card']].map(([k, label]) => (
                <button key={k} className="btn ghost" style={{ padding: '12px 10px', fontSize: 13 }}
                        onClick={() => {
                          if (!newAcct.trim()) { say('Give it a name first'); return; }
                          saveAccount({ name: newAcct.trim(), kind: k, sort: accounts.length + 1 });
                          setNewAcct('');
                        }}>
                  Add {label}
                </button>
              ))}
            </div>
            <p className="note">Set each balance to what the account actually holds today. Entries take it from there.</p>
          </div>
        </>
      )}

      {tab === 'app' && (
        <>
          <div className="card">
            <div className="cardhead"><h4>Your data</h4><span>{txs.length} entries</span></div>
            <button className="btn ghost" onClick={exportCSV}>Export everything as CSV</button>
            <button className="btn ghost" style={{ marginTop: 8 }} disabled={importing}
                    onClick={() => file.current?.click()}>
              {importing ? 'Importing…' : 'Import bank CSV'}
            </button>
            <input ref={file} type="file" accept=".csv" hidden onChange={importCSV} />
            <p className="note">
              Import looks for columns named date, merchant (or description / narration), amount,
              and optionally direction, category, account and context. Anything it can't match lands
              in your first account, uncategorised, for you to fix.
            </p>
          </div>

          <div className="card">
            <div className="cardhead"><h4>Lock</h4><span>on this device</span></div>
            <div className="field">
              <label>4-digit PIN (blank to disable)</label>
              <input type="number" defaultValue={settings?.pin || ''} placeholder="––––"
                     onBlur={(e) => saveSettings({ pin: e.target.value.slice(0, 4) })} />
            </div>
            <p className="note">Asked for each time the app opens. It guards the screen, not the database.</p>
          </div>

          <div className="card">
            <div className="cardhead"><h4>Account</h4><span>signed in</span></div>
            <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>{session?.user?.email}</p>
            <button className="btn danger" onClick={signOut}>Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}


// Limit and available balance have to move together: computing the amount
// already owed needs both numbers at once, so a stale prop here silently
// produces a zero outstanding.
function CardEditor({ account, onSave }) {
  const [limit, setLimit] = useState(String(Number(account.credit_limit) || ''));
  const [avail, setAvail] = useState(
    String(Math.max(0, Number(account.credit_limit || 0) + Number(account.opening || 0)) || '')
  );

  const commit = (nextLimit, nextAvail) => {
    const L = Number(nextLimit) || 0;
    const A = Number(nextAvail) || 0;
    if (!L && !A) return;
    onSave({ id: account.id, credit_limit: L, opening: -Math.max(0, L - A) });
  };

  return (
    <div className="acctedit">
      <div className="aename">{account.name}</div>
      <div className="field">
        <label>Total credit limit (₹)</label>
        <input type="number" inputMode="decimal" value={limit} placeholder="e.g. 200000"
               onChange={(e) => setLimit(e.target.value)}
               onBlur={(e) => commit(e.target.value, avail)} />
      </div>
      <div className="field">
        <label>Available limit right now (₹)</label>
        <input type="number" inputMode="decimal" value={avail} placeholder="e.g. 175000"
               onChange={(e) => setAvail(e.target.value)}
               onBlur={(e) => commit(limit, e.target.value)} />
      </div>
      <p className="note" style={{ marginTop: 4 }}>
        Enter both once. After that every card spend lowers the available limit and every
        payment raises it, on its own.
      </p>
    </div>
  );
}
