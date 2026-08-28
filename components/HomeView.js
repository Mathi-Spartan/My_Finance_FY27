'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Search, Trash } from './Icons';
import {
  rupees, safeToSpend, runway, dailySpend, daysInMonth, monthTotals,
  accountBalances, dayLabel, timeLabel, isoDay, initials, colorOf,
} from '@/lib/finance';


// Counts a number up on mount so the hero lands rather than just appears.
function useCountUp(target, ms = 800) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(a + (target - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export default function HomeView({ context, setContext, goTo, onAdd }) {
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

  const shown = useCountUp(Math.abs(sts.perDay));
  const whole = Math.floor(shown);
  const cents = String(Math.round((shown % 1) * 100)).padStart(2, '0');
  const hasData = txs.length > 0;
  const hasTargets = Number(settings?.monthly_income) > 0 || Number(settings?.savings_target) > 0;

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

      <div className="hero rise d1">
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
          <div className={'bars' + (hasData ? '' : ' idle')}>
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

      <div className="rail rise d2">
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
        <div className="startcard rise d3 full">
          <h3>Three things and it starts working</h3>
          <p className="lede">
            Safe-to-spend, drift and runway all read from your own numbers. Give it these
            and the screen above stops showing zero.
          </p>
          <div className="steps">
            <button className={'step' + (hasTargets ? ' done' : '')} onClick={() => goTo && goTo('settings')}>
              <span className="n">1</span>
              <span>
                <span className="t">Set your income and what you want to keep</span>
                <span className="s">These two numbers are what safe-to-spend divides up. Without them it has nothing to work from.</span>
              </span>
            </button>
            <button className="step" onClick={() => goTo && goTo('settings')}>
              <span className="n">2</span>
              <span>
                <span className="t">Put today's balance on each account</span>
                <span className="s">HDFC, UPI, card, cash. Enter what they actually hold right now and entries take it from there.</span>
              </span>
            </button>
            <button className="step" onClick={() => onAdd && onAdd()}>
              <span className="n">3</span>
              <span>
                <span className="t">File the last thing you paid for</span>
                <span className="s">Amount, who it was for, done. Four seconds. That single habit is the whole point of this.</span>
              </span>
            </button>
          </div>
        </div>
      ) : groups.map(([day, list]) => (
        <div key={day}>
          <div className="sechead full">
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
