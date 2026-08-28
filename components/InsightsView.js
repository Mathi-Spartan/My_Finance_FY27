'use client';
import { useMemo, useState } from 'react';
import { Refresh } from './Icons';
import SalaryView from './SalaryView';
import { useStore } from '@/lib/store';
import {
  rupees, money, totals, lastMonthTotals, whereItWent, biggestChanges,
  spendingRhythm, repeatPayments, initials, colorOf,
} from '@/lib/finance';

export default function InsightsView() {
  const { txs, categories, reload, loading } = useStore();
  const [tab, setTab] = useState('spending');

  const month = useMemo(() => totals(txs), [txs]);
  const prev = useMemo(() => lastMonthTotals(txs), [txs]);
  const spend = useMemo(() => whereItWent(txs, categories), [txs, categories]);
  const changes = useMemo(() => biggestChanges(txs, categories), [txs, categories]);
  const rhythm = useMemo(() => spendingRhythm(txs), [txs]);
  const repeats = useMemo(() => repeatPayments(txs), [txs]);

  if (txs.length === 0) {
    return (
      <div className="body">
        <div className="pagehead">
        <h2>Patterns</h2>
        <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()}
                aria-label="Refresh" disabled={loading}>
          <Refresh width="16" height="16" />
        </button>
      </div>
        <div className="card">
          <p className="note" style={{ margin: 0 }}>
            Nothing to read yet. Add a few entries and this fills in on its own.
          </p>
        </div>
      </div>
    );
  }

  const outChange = prev.out > 0 ? Math.round(((month.out - prev.out) / prev.out) * 100) : null;
  const inChange = prev.in > 0 ? Math.round(((month.in - prev.in) / prev.in) * 100) : null;
  const savedPct = month.in > 0 ? Math.round((month.net / month.in) * 100) : null;
  const steady = repeats.filter((r) => r.steady);
  const monthlyRepeat = steady.reduce((s, r) => s + r.avg, 0);

  return (
    <div className="body">
      <div className="pagehead">
        <h2>Patterns</h2>
        <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()}
                aria-label="Refresh" disabled={loading}>
          <Refresh width="16" height="16" />
        </button>
      </div>

      <div className="seg modeseg">
        <button className={tab === 'spending' ? 'on' : ''} onClick={() => setTab('spending')}>Spending</button>
        <button className={tab === 'salary' ? 'on' : ''} onClick={() => setTab('salary')}>Salary</button>
      </div>

      {tab === 'salary' ? <SalaryView /> : txs.length === 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="note" style={{ margin: 0 }}>Nothing to read yet. Add a few entries and this fills in on its own.</p>
        </div>
      ) : <>

      {/* headline */}
      <div className="card">
        <div className="cardhead"><h4>This month</h4><span>{month.count} entries</span></div>
        <div className="statgrid">
          <div className="stat">
            <div className="k">In</div>
            <div className="v" style={{ color: 'var(--in)' }}>{money(month.in)}</div>
            <div className="d">{inChange === null ? 'no last month to compare' : `${inChange >= 0 ? '+' : ''}${inChange}% vs last month`}</div>
          </div>
          <div className="stat">
            <div className="k">Out</div>
            <div className="v" style={{ color: 'var(--out)' }}>{money(month.out)}</div>
            <div className="d">{outChange === null ? 'no last month to compare' : `${outChange >= 0 ? '+' : ''}${outChange}% vs last month`}</div>
          </div>
          <div className="stat">
            <div className="k">Kept</div>
            <div className="v" style={{ color: month.net >= 0 ? 'var(--in)' : 'var(--out)' }}>
              {month.net < 0 ? '−' : ''}{money(month.net)}
            </div>
            <div className="d">{savedPct === null ? 'nothing came in yet' : `${savedPct}% of what came in`}</div>
          </div>
          <div className="stat">
            <div className="k">Per day</div>
            <div className="v">{money(rhythm.perDay)}</div>
            <div className="d">average over 60 days</div>
          </div>
        </div>
      </div>

      {/* where it goes */}
      {spend.length > 0 && (
        <div className="card">
          <div className="cardhead"><h4>Where it goes</h4><span>this month</span></div>
          {spend.slice(0, 8).map((c) => (
            <div className="drift" key={c.id}>
              <div className="drifttop">
                <span className="lab">{c.name}</span>
                <span className="val">{Math.round(c.share)}% · {money(c.total)}</span>
              </div>
              <div className="track">
                <div className="fillbar" style={{
                  width: Math.max(3, c.share) + '%',
                  background: `linear-gradient(90deg,var(--g1),var(--g3))`,
                }} />
              </div>
              <div className="driftfoot">{c.count} {c.count === 1 ? 'payment' : 'payments'}</div>
            </div>
          ))}
        </div>
      )}

      {/* what moved */}
      {changes.length > 0 && prev.out > 0 && (
        <div className="card">
          <div className="cardhead"><h4>What moved</h4><span>vs last month</span></div>
          {changes.slice(0, 5).map((c) => (
            <div className="moveline" key={c.id}>
              <span className="mname">{c.name}</span>
              <span className={'mval ' + (c.diff > 0 ? 'up' : 'down')}>
                {c.diff > 0 ? '+' : '−'}{money(Math.abs(c.diff))}
                {c.pct !== null && <small> ({c.pct > 0 ? '+' : ''}{c.pct}%)</small>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* rhythm */}
      {rhythm.count > 0 && (
        <div className="card">
          <div className="cardhead"><h4>Your rhythm</h4><span>last 60 days</span></div>
          <div className="dowrow">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => {
              const max = Math.max(...rhythm.byDow, 1);
              return (
                <div className="dowbar" key={i}>
                  <div className="dowfill" style={{ height: Math.max(6, (rhythm.byDow[i] / max) * 100) + '%' }} />
                  <span>{l}</span>
                </div>
              );
            })}
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            {rhythm.peakDay
              ? <>Most of your spending lands on <b>{rhythm.peakDay}</b> — {money(rhythm.peakAmount)} over the period. Typical payment is {money(rhythm.perEntry)}.</>
              : <>Not enough spending yet to see a pattern.</>}
          </p>
        </div>
      )}

      {/* repeats */}
      {repeats.length > 0 && (
        <div className="card">
          <div className="cardhead"><h4>Paid again and again</h4><span>3+ times</span></div>
          {repeats.slice(0, 6).map((r) => {
            const c = colorOf(r.name);
            return (
              <div className="row" key={r.name} style={{ marginBottom: 8 }}>
                <span className="av" style={{ background: `var(--${c}-soft)`, color: `var(--${c})` }}>
                  {initials(r.name)}
                </span>
                <span className="rmain">
                  <span className="rtop">
                    <span className="rname">{r.name}</span>
                    <span className="ramt">{money(r.total)}</span>
                  </span>
                  <span className="rbot">
                    <span className="tag">{r.times} times{r.steady ? ' · same amount' : ''}</span>
                    <span className="rmeta">{money(r.avg)} each</span>
                  </span>
                </span>
              </div>
            );
          })}
          {steady.length > 0 && (
            <div className="summary">
              <span>{steady.length} look like regular payments</span>
              <b>{money(monthlyRepeat)}</b>
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
