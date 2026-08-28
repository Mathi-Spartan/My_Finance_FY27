'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh } from './Icons';
import {
  money, totals, totalCash, accountBalances, accountFlow,
  splitName, cardStatus, isCard,
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
  const { accounts, txs, reload, loading } = useStore();

  const month = useMemo(() => totals(txs), [txs]);
  const balance = useMemo(() => totalCash(accounts, txs), [accounts, txs]);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const flow = useMemo(() => accountFlow(txs), [txs]);

  const shown = useCountUp(Math.abs(balance));
  const whole = Math.floor(shown);
  const cents = String(Math.round((shown % 1) * 100)).padStart(2, '0');

  const live = accounts.filter((a) => !a.archived);

  return (
    <div className="body">
      <div className="apphead">
        <div className="hi"><span className="k">Total balance</span></div>
        <div className="spacer" />
        <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
          <Refresh width="16" height="16" />
        </button>
      </div>

      <div className="hero">
        <div className="eyebrow"><span className="dot" />Across {live.length} accounts</div>
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

      <div className="accounts">
        {live.map((a, i) => {
          const nm = splitName(a.name);
          const f = flow[a.id] || { in: 0, out: 0 };
          const card = isCard(a) ? cardStatus(a, balances) : null;
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
                {card ? (
                  <span className="abal">{money(card.available)}<small>available</small></span>
                ) : (
                  <span className="abal" style={{ color: (balances[a.id] || 0) < 0 ? 'var(--out)' : undefined }}>
                    {money(balances[a.id] || 0)}
                  </span>
                )}
              </span>

              {card && card.limit > 0 && (
                <span className="limitwrap">
                  <span className="limitbar">
                    <span className="limitfill" style={{ width: card.used + '%' }} />
                  </span>
                  <span className="limitmeta">
                    <span>{money(card.owed)} used</span>
                    <span>of {money(card.limit)}</span>
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
    </div>
  );
}
