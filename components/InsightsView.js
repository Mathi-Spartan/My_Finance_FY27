'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  rupees, categoryDrift, burnRate, monthTotals, topMerchants,
  committedMonthly, initials, colorOf,
} from '@/lib/finance';

export default function InsightsView({ context }) {
  const { txs, categories, recurring } = useStore();
  const [scope, setScope] = useState('month');

  const scoped = useMemo(() => txs.filter((t) => t.context === context), [txs, context]);
  const drift = useMemo(() => categoryDrift(scoped, categories), [scoped, categories]);
  const burn = useMemo(() => burnRate(scoped), [scoped]);
  const prevBurn = useMemo(() => {
    const cut1 = new Date(); cut1.setDate(cut1.getDate() - 60);
    const cut2 = new Date(); cut2.setDate(cut2.getDate() - 30);
    const spent = scoped.filter((t) => t.direction === 'out' &&
      new Date(t.occurred_at) >= cut1 && new Date(t.occurred_at) < cut2)
      .reduce((s, t) => s + Number(t.amount), 0);
    return spent / 30;
  }, [scoped]);
  const totals = useMemo(() => monthTotals(scoped), [scoped]);
  const leaks = useMemo(() => topMerchants(scoped), [scoped]);
  const committed = committedMonthly(recurring);
  const saved = totals.in - totals.out;
  const savedPct = totals.in > 0 ? Math.round((saved / totals.in) * 100) : 0;
  const maxDrift = Math.max(...drift.map((d) => Math.max(d.spent, d.avg)), 1);

  if (scoped.length === 0) {
    return (
      <div className="body">
        <div className="apphead"><div className="seg"><button className="on">Insights</button></div></div>
        <div className="empty">
          <b>Nothing to read yet</b>
          Insights compare this month against your own three-month average. File entries for a few weeks and this fills in.
        </div>
      </div>
    );
  }

  return (
    <div className="body">
      <div className="apphead">
        <div className="seg">
          <button className={scope === 'month' ? 'on' : ''} onClick={() => setScope('month')}>This month</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All time</button>
        </div>
      </div>

      <div className="wide">
        <div>
          <div className="card rise d1">
            <div className="cardhead"><h4>Category drift</h4><span>vs your 3-mo avg</span></div>
            {drift.slice(0, 7).map((d) => {
              const w = Math.max(4, (d.spent / maxDrift) * 100);
              const mark = Math.max(2, Math.min(98, (d.avg / maxDrift) * 100));
              const tone = d.pct === null ? 'var(--ink-3)'
                : d.pct > 40 ? 'var(--out)' : d.pct > 10 ? 'var(--amber)'
                : d.pct < -10 ? 'var(--in)' : 'var(--ink-3)';
              return (
                <div className="drift" key={d.id}>
                  <div className="drifttop">
                    <span className="lab">{d.name}</span>
                    <span className={'val ' + (d.pct > 0 ? 'up' : d.pct < 0 ? 'down' : '')}>
                      {d.pct === null ? 'new' : (d.pct > 0 ? '+' : '') + d.pct + '%'} · {rupees(d.spent, { decimals: false })}
                    </span>
                  </div>
                  <div className="track">
                    <div className="fillbar" style={{ width: w + '%', background: tone }} />
                    {d.avg > 0 && <div className="avgmark" style={{ left: mark + '%' }} />}
                  </div>
                  <div className="driftfoot">
                    {d.count} {d.count === 1 ? 'entry' : 'entries'}
                    {d.avg > 0 && ` · usually ${rupees(d.avg, { decimals: false })}`}
                    {d.budget > 0 && ` · budget ${rupees(d.budget, { decimals: false })}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="cardhead"><h4>Burn rate</h4><span>last 30 days</span></div>
            <div className="statgrid">
              <div className="stat">
                <div className="k">Per day</div>
                <div className="v">{rupees(burn.perDay, { decimals: false })}</div>
                <div className="d">{prevBurn > 0
                  ? `was ${rupees(prevBurn, { decimals: false })} the month before`
                  : 'no earlier data yet'}</div>
              </div>
              <div className="stat">
                <div className="k">Committed</div>
                <div className="v">{rupees(committed, { decimals: false })}</div>
                <div className="d">fixed every month</div>
              </div>
              <div className="stat">
                <div className="k">In this month</div>
                <div className="v" style={{ color: 'var(--in)' }}>{rupees(totals.in, { decimals: false })}</div>
                <div className="d">across {scoped.filter((t) => t.direction === 'in').length} entries</div>
              </div>
              <div className="stat">
                <div className="k">Kept</div>
                <div className="v" style={{ color: saved >= 0 ? 'var(--in)' : 'var(--out)' }}>
                  {saved < 0 ? '−' : ''}{rupees(saved, { decimals: false })}
                </div>
                <div className="d">{savedPct}% of what came in</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardhead"><h4>Biggest leaks</h4><span>this month</span></div>
            {leaks.map((m) => {
              const c = colorOf(m.name);
              return (
                <div className="row" key={m.name} style={{ marginBottom: 8 }}>
                  <span className="av" style={{ background: `var(--${c}-soft)`, color: `var(--${c})` }}>
                    {initials(m.name)}
                  </span>
                  <span className="rmain">
                    <span className="rtop">
                      <span className="rname">{m.name}</span>
                      <span className="ramt">{rupees(m.total, { decimals: false })}</span>
                    </span>
                    <span className="rbot">
                      <span className="tag">{m.count} {m.count === 1 ? 'time' : 'times'}</span>
                      <span className="rmeta">{rupees(m.total / m.count, { decimals: false })} avg</span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
