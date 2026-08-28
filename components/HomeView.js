'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Search, Trash } from './Icons';
import {
  rupees, safeToSpend, runway, dailySpend, daysInMonth, monthTotals,
  accountBalances, dayLabel, timeLabel, isoDay, initials, colorOf,
} from '@/lib/finance';

export default function HomeView({ context, setContext, theme, toggleTheme }) {
  const { accounts, categories, txs, recurring, settings, deleteTx } = useStore();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);

  const scoped = useMemo(() => txs.filter((t) => t.context === context), [txs, context]);
  const sts = useMemo(() => safeToSpend({ accounts, txs, recurring, settings, context }), [accounts, txs, recurring, settings, context]);
  const rw = useMemo(() => runway({ accounts, txs: scoped, recurring }), [accounts, scoped, recurring]);
  const spendByDay = useMemo(() => dailySpend(scoped), [scoped]);
  const totals = useMemo(() => monthTotals(scoped), [scoped]);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const acctName = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);

  const today = new Date().getDate();
  const dim = daysInMonth();
  const avg = spendByDay.slice(0, today).reduce((a, b) => a + b, 0) / today || 1;

  const monthPct = Math.round((today / dim) * 100);
  const moneyPct = totals.in > 0 ? Math.round((totals.out / totals.in) * 100) : null;

  const visible = useMemo(() => {
    const list = q
      ? txs.filter((t) =>
          (t.merchant || '').toLowerCase().includes(q.toLowerCase()) ||
          (catName[t.category_id] || '').toLowerCase().includes(q.toLowerCase()))
      : scoped;
    return list.slice(0, 120);
  }, [q, txs, scoped, catName]);

  const groups = useMemo(() => {
    const g = {};
    visible.forEach((t) => {
      const k = isoDay(t.occurred_at);
      (g[k] = g[k] || []).push(t);
    });
    return Object.entries(g);
  }, [visible]);

  const whole = Math.floor(Math.abs(sts.perDay));
  const cents = String(Math.round((Math.abs(sts.perDay) % 1) * 100)).padStart(2, '0');

  return (
    <div className="body">
      <div className="apphead">
        <div className="seg">
          <button className={context === 'business' ? 'on' : ''} onClick={() => setContext('business')}>Business</button>
          <button className={context === 'personal' ? 'on' : ''} onClick={() => setContext('personal')}>Personal</button>
        </div>
        <div className="spacer" />
        <button className="icobtn" onClick={() => setSearching((s) => !s)} aria-label="Search">
          <Search width="16" height="16" />
        </button>
      </div>

      {searching && (
        <div className="field">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" />
        </div>
      )}

      <div className="hero">
        <div className="eyebrow">
          <span className={'dot' + (sts.perDay < 0 ? ' warn' : '')} />
          Safe to spend today
        </div>
        <div className={'bignum' + (sts.perDay < 0 ? ' neg' : '')}>
          <span className="cur">{sts.perDay < 0 ? '−₹' : '₹'}</span>
          {whole.toLocaleString('en-IN')}
          <span className="cent">.{cents}</span>
        </div>
        <p className="herosub">
          {sts.perDay < 0
            ? <>You're over. Commitments and the savings target already claim more than the cash on hand.</>
            : <>You've used <b>{monthPct}%</b> of the month{moneyPct !== null && <> and <b>{moneyPct}%</b> of what came in</>}.</>}
        </p>

        <div className="runway">
          <div className="runlabels">
            <span>1</span><span>TODAY · {today}</span><span>{dim}</span>
          </div>
          <div className="bars">
            {spendByDay.map((v, i) => {
              const h = Math.max(6, Math.min(100, (v / Math.max(avg * 2, 1)) * 100));
              const cls = i + 1 === today ? 'today' : i + 1 > today ? '' : v > avg * 1.6 ? 'over' : 'spent';
              return <div key={i} className={'bar ' + cls}
                          style={{ height: (i + 1 > today ? 6 : h) + '%', animationDelay: i * 12 + 'ms' }}
                          title={`${i + 1}: ${rupees(v, { decimals: false })}`} />;
            })}
          </div>
          <div className="runfoot">
            <span>
              {rw.days === null
                ? 'Add a few entries to see your runway'
                : <>At this pace, cash lasts to <b>{rw.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b></>}
            </span>
            {rw.days !== null && (
              <span className={'pill' + (rw.days > 45 ? ' good' : rw.days < 15 ? ' bad' : '')}>{rw.days} DAYS</span>
            )}
          </div>
        </div>
      </div>

      <div className="rail">
        {accounts.filter((a) => !a.archived).map((a) => (
          <div key={a.id} className="acct">
            <div className="nm">{a.name}</div>
            <div className="bal" style={{ color: (balances[a.id] || 0) < 0 ? 'var(--out)' : undefined }}>
              {rupees(balances[a.id] || 0, { decimals: false })}
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <b>Nothing filed yet</b>
          Tap Add and put in the last thing you paid for. Two taps, four seconds — that's the whole habit.
        </div>
      ) : groups.map(([day, list]) => (
        <div key={day}>
          <div className="sechead">
            <h4>{dayLabel(day)}</h4>
            <span>{list.length} {list.length === 1 ? 'ENTRY' : 'ENTRIES'}</span>
          </div>
          {list.map((t) => {
            const c = colorOf(catName[t.category_id] || t.merchant);
            const isIn = t.direction === 'in';
            const isTr = t.direction === 'transfer';
            return (
              <div key={t.id}>
                <button className="row" onClick={() => setOpen(open === t.id ? null : t.id)}>
                  <span className="av" style={{
                    background: isIn ? 'var(--in-soft)' : isTr ? 'var(--brand-soft)' : `var(--${c}-soft)`,
                    color: isIn ? 'var(--in)' : isTr ? 'var(--brand)' : `var(--${c})`,
                  }}>{initials(t.merchant)}</span>
                  <span className="rmain">
                    <span className="rtop">
                      <span className="rname">{t.merchant}</span>
                      <span className={'ramt' + (isIn ? ' in' : '')}>
                        {isIn ? '+' : isTr ? '' : '−'}{rupees(t.amount, { decimals: false })}
                      </span>
                    </span>
                    <span className="rbot">
                      <span className="tag">{isTr ? 'Moved' : catName[t.category_id] || 'Uncategorised'}</span>
                      <span className="rmeta">{acctName[t.account_id] || '—'} · {timeLabel(t.occurred_at)}</span>
                    </span>
                  </span>
                </button>
                {open === t.id && (
                  <div className="btnrow" style={{ margin: '-2px 0 12px' }}>
                    <button className="btn danger" onClick={() => { deleteTx(t.id); setOpen(null); }}>
                      Delete this entry
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
