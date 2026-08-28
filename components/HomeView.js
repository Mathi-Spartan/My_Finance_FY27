'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Search } from './Icons';
import {
  rupees, money, totals, totalCash, accountBalances, accountFlow, splitName, cardStatus, isCard,
  dayLabel, timeLabel, isoDay, initials, colorOf,
} from '@/lib/finance';

function useCountUp(target, ms = 750) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      setV(a + (target - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export default function HomeView({ onAddTo }) {
  const { accounts, categories, txs, deleteTx } = useStore();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [pickedDay, setPickedDay] = useState(null);

  const month = useMemo(() => totals(txs), [txs]);
  const balance = useMemo(() => totalCash(accounts, txs), [accounts, txs]);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const flow = useMemo(() => accountFlow(txs), [txs]);
  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const acctName = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);

  const shown = useCountUp(Math.abs(balance));
  const whole = Math.floor(shown);
  const cents = String(Math.round((shown % 1) * 100)).padStart(2, '0');

  const week = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        iso: isoDay(d),
        dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        num: d.getDate(),
        isToday: isoDay(d) === isoDay(now),
        future: d > now,
      };
    });
  }, []);

  const spentOn = useMemo(() => {
    const m = {};
    txs.forEach((t) => {
      if (t.direction !== 'out') return;
      const k = isoDay(t.occurred_at);
      m[k] = (m[k] || 0) + Number(t.amount);
    });
    return m;
  }, [txs]);

  const visible = useMemo(() => {
    let list = txs;
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((t) =>
        (t.merchant || '').toLowerCase().includes(s) ||
        (catName[t.category_id] || '').toLowerCase().includes(s));
    }
    if (pickedDay) list = list.filter((t) => isoDay(t.occurred_at) === pickedDay);
    return list.slice(0, 150);
  }, [txs, q, pickedDay, catName]);

  const groups = useMemo(() => {
    const g = {};
    visible.forEach((t) => {
      const k = isoDay(t.occurred_at);
      (g[k] = g[k] || []).push(t);
    });
    return Object.entries(g);
  }, [visible]);

  return (
    <div className="body">
      <div className="apphead">
        <div className="hi">
          <span className="k">Total balance</span>
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
        <div className="eyebrow"><span className="dot" />Across {accounts.length} accounts</div>
        <div className={'bignum' + (balance < 0 ? ' neg' : '')}>
          <span className="cur">{balance < 0 ? '−₹' : '₹'}</span>
          {whole.toLocaleString('en-IN')}
          <span className="cent">.{cents}</span>
        </div>

        <div className="flow">
          <div className="flowcell">
            <span className="fl">Money in</span>
            <span className="fv in">+{money(month.in)}</span>
          </div>
          <div className="flowdiv" />
          <div className="flowcell">
            <span className="fl">Money out</span>
            <span className="fv out">−{money(month.out)}</span>
          </div>
        </div>

        <div className="netline">
          <span>This month</span>
          <b className={month.net >= 0 ? 'up' : 'down'}>
            {month.net >= 0 ? '+' : '−'}{money(month.net)}
          </b>
        </div>
      </div>

      <div className="weekstrip">
        {week.map((d, i) => (
          <button
            key={d.iso}
            className={'day' + (d.isToday ? ' today' : '') + (pickedDay === d.iso ? ' picked' : '') + (d.future ? ' future' : '')}
            style={{ animationDelay: i * 45 + 'ms' }}
            onClick={() => setPickedDay(pickedDay === d.iso ? null : d.iso)}
          >
            <span className="dow">{d.dow}</span>
            <span className="num">{d.num}</span>
            {spentOn[d.iso] ? <span className="tick" /> : null}
          </button>
        ))}
      </div>

      <div className="accounts">
        {accounts.filter((a) => !a.archived).map((a, i) => {
          const nm = splitName(a.name);
          const f = flow[a.id] || { in: 0, out: 0 };
          return (
            <button
              key={a.id}
              className="acctcard"
              style={{ animationDelay: i * 50 + 'ms' }}
              onClick={() => onAddTo && onAddTo(a.id)}
            >
              <span className="ahead">
                <span className="atitle">
                  {nm.title}
                  {nm.sub && <small>{nm.sub}</small>}
                </span>
                {isCard(a) ? (
                  <span className="abal">
                    {money(cardStatus(a, balances).available)}
                    <small>available</small>
                  </span>
                ) : (
                  <span className="abal" style={{ color: (balances[a.id] || 0) < 0 ? 'var(--out)' : undefined }}>
                    {money(balances[a.id] || 0)}
                  </span>
                )}
              </span>

              {isCard(a) && cardStatus(a, balances).limit > 0 && (
                <span className="limitwrap">
                  <span className="limitbar">
                    <span className="limitfill" style={{ width: cardStatus(a, balances).used + '%' }} />
                  </span>
                  <span className="limitmeta">
                    <span>{money(cardStatus(a, balances).owed)} used</span>
                    <span>of {money(cardStatus(a, balances).limit)}</span>
                  </span>
                </span>
              )}

              <span className="aflow">
                <span className="af in">↓ {money(f.in)}</span>
                <span className="af out">↑ {money(f.out)}</span>
                <span className="aplus">+ Add</span>
              </span>
            </button>
          );
        })}
      </div>

      {pickedDay && (
        <button className="clearday" onClick={() => setPickedDay(null)}>
          Showing {new Date(pickedDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })} · tap to clear
        </button>
      )}

      {groups.map(([day, list]) => (
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
                        {isIn ? '+' : isTr ? '' : '−'}{money(t.amount)}
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
