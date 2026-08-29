'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Search, Refresh, Back, Trash } from './Icons';
import Portal from './Portal';
import {
  money, rangeOf, inRange, rangeTotals, monthGrid, dailyMap,
  isoDay, dayLabel, timeLabel, initials, colorOf,
} from '@/lib/finance';

const MODES = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']];

export default function EntriesView({ onEdit }) {
  const { txs, accounts, categories, reload, loading, deleteMany, justAdded } = useStore();
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [wipe, setWipe] = useState(false);
  const [wiping, setWiping] = useState(false);


  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const acctName = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name.split('—')[0].trim()])), [accounts]);
  const perDay = useMemo(() => dailyMap(txs), [txs]);

  const [from, to] = useMemo(() => rangeOf(mode, anchor), [mode, anchor]);

  const scoped = useMemo(() => {
    let list = inRange(txs, from, to);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((t) =>
        (t.merchant || '').toLowerCase().includes(s) ||
        (catName[t.category_id] || '').toLowerCase().includes(s));
    }
    return list.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
  }, [txs, from, to, q, catName]);

  const sums = useMemo(() => rangeTotals(scoped), [scoped]);

  const groups = useMemo(() => {
    const g = {};
    scoped.forEach((t) => {
      const k = isoDay(t.occurred_at);
      (g[k] = g[k] || []).push(t);
    });
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [scoped]);

  const step = (dir) => {
    const d = new Date(anchor);
    if (mode === 'day') d.setDate(d.getDate() + dir);
    else if (mode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const title = useMemo(() => {
    if (mode === 'day') {
      return anchor.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (mode === 'week') {
      const opts = { day: 'numeric', month: 'short' };
      return `${from.toLocaleDateString('en-IN', opts)} – ${to.toLocaleDateString('en-IN', opts)}`;
    }
    return anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [mode, anchor, from, to]);

  const isThisPeriod = useMemo(() => {
    const now = new Date();
    return now >= from && now <= to;
  }, [from, to]);

  return (
    <div className="body">
      <div className="pagehead">
        <h2>Entries</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
            <Refresh width="16" height="16" />
          </button>
          <button className="icobtn" onClick={() => setSearching((s) => !s)} aria-label="Search">
            <Search width="16" height="16" />
          </button>
          <button className="icobtn" onClick={() => setWipe(true)} aria-label="Clear entries"
                  disabled={scoped.length === 0}>
            <Trash width="16" height="16" />
          </button>
        </div>
      </div>

      {searching && (
        <div className="field" style={{ marginBottom: 10 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" />
        </div>
      )}

      {/* period control: scale on the left, stepper on the right */}
      <div className="toolbar">
        <div className="scaleseg">
          {MODES.map(([id, label]) => (
            <button key={id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>
        <div className="stepper">
          <button onClick={() => step(-1)} aria-label="Previous"><Back width="14" height="14" /></button>
          <button onClick={() => step(1)} aria-label="Next">
            <Back width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>

      {/* the period itself, with its numbers on one surface */}
      <div className="periodcard">
        <div className="pctop">
          <div className="pctitle">
            <b>{title}</b>
            {!isThisPeriod && <button className="jump" onClick={() => setAnchor(new Date())}>Today</button>}
          </div>
          <div className="pcnet">
            <span className={sums.net >= 0 ? 'up' : 'down'}>
              {sums.net < 0 ? '−' : '+'}{money(sums.net)}
            </span>
            <em>{sums.count} {sums.count === 1 ? 'entry' : 'entries'}</em>
          </div>
        </div>

        <div className="splitbar">
          <span className="sp in" style={{ flexGrow: Math.max(sums.in, 0.0001) }} />
          <span className="sp out" style={{ flexGrow: Math.max(sums.out, 0.0001) }} />
        </div>

        <div className="pcflow">
          <span className="pf in"><i />In {money(sums.in)}</span>
          <span className="pf out"><i />Out {money(sums.out)}</span>
        </div>
      </div>

      {mode === 'month' && (
        <MonthGrid anchor={anchor} perDay={perDay} onPick={(d) => { setAnchor(d); setMode('day'); }} />
      )}

      {mode === 'week' && (
        <WeekRow anchor={anchor} from={from} perDay={perDay} onPick={(d) => { setAnchor(d); setMode('day'); }} />
      )}

      {groups.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="note" style={{ margin: 0 }}>
            No entries in this {mode}. Use the arrows to look at another one.
          </p>
        </div>
      ) : (
        groups.map(([day, list]) => {
          const dayPeak = Math.max(...list.map((t) => Number(t.amount) || 0), 1);
          const t = rangeTotals(list);
          return (
            <div key={day}>
              <div className="sechead">
                <h4>{dayLabel(day)}</h4>
                <span>
                  {t.in > 0 && <em className="pin">+{money(t.in)}</em>}
                  {t.out > 0 && <em className="pout">−{money(t.out)}</em>}
                </span>
              </div>
              {list.map((tx) => {
                const c = colorOf(catName[tx.category_id] || tx.merchant);
                const isIn = tx.direction === 'in';
                return (
                  <div key={tx.id} className={'rowwrap' + (openId === tx.id ? ' open' : '') + (justAdded === tx.id ? ' fresh' : '')}>
                    <button
                      className={'row compact ' + (isIn ? 'r-in' : 'r-out') + (openId === tx.id ? ' open' : '')}
                      onClick={() => setOpenId(openId === tx.id ? null : tx.id)}
                    >
                      <span className="rowsize" style={{ width: ((Number(tx.amount) || 0) / dayPeak) * 100 + '%' }} />
                      <span className={'dirbadge ' + (isIn ? 'in' : 'out')}>
                        {isIn ? '↓' : '↑'}
                      </span>
                      <span className="rmain">
                        <span className="rname">{tx.merchant}</span>
                        <span className="rsub">
                          {acctName[tx.account_id] || '—'}
                          {catName[tx.category_id] ? ` · ${catName[tx.category_id]}` : ''}
                        </span>
                      </span>
                      <span className="rside">
                        <span className={'ramt' + (isIn ? ' in' : '')}>
                          {isIn ? '+' : '−'}{money(tx.amount)}
                        </span>
                        <span className="rtime">{timeLabel(tx.occurred_at)}</span>
                      </span>
                    </button>

                    {openId === tx.id && (
                      <div className="rowdetail">
                        <div className="rdgrid">
                          <span className="rdk">Account</span>
                          <span className="rdv">{acctName[tx.account_id] || '—'}</span>
                          <span className="rdk">Category</span>
                          <span className="rdv">{catName[tx.category_id] || 'Uncategorised'}</span>
                          <span className="rdk">Time</span>
                          <span className="rdv">
                            {new Date(tx.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}{timeLabel(tx.occurred_at)}
                          </span>
                        </div>
                        <button className="rdedit" onClick={() => { onEdit(tx); setOpenId(null); }}>
                          Edit entry
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {wipe && (
        <Portal>
          <div className="scrim" onClick={() => setWipe(false)} />
          <div className="sheet">
            <div className="grab" />
            <div className="sheettitle">
              Clear {scoped.length} {scoped.length === 1 ? 'entry' : 'entries'}?
            </div>
            <div className="sheetsub">
              Everything in <b>{title}</b> will be deleted — {money(sums.in)} in and{' '}
              {money(sums.out)} out. Account balances will change. This can&apos;t be undone.
            </div>
            <button className="btn danger" disabled={wiping}
                    onClick={async () => {
                      setWiping(true);
                      await deleteMany(scoped.map((t) => t.id));
                      setWiping(false);
                      setWipe(false);
                    }}>
              {wiping ? 'Deleting…' : `Yes, delete these ${scoped.length}`}
            </button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setWipe(false)}>
              Keep them
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}

function MonthGrid({ anchor, perDay, onPick }) {
  const weeks = useMemo(() => monthGrid(anchor), [anchor]);
  const today = isoDay(new Date());

  const peak = useMemo(() => {
    let m = 0;
    weeks.flat().forEach((c) => {
      const d = perDay[isoDay(c.date)];
      if (!d) return;
      m = Math.max(m, d.in || 0, d.out || 0);
    });
    return m || 1;
  }, [weeks, perDay]);

  // A day is red if only money left, green if only money came in, amber when
  // both happened — the colour tells you the shape of the day at a glance.
  const toneOf = (d) => {
    if (!d) return null;
    const hasIn = (d.in || 0) > 0;
    const hasOut = (d.out || 0) > 0;
    if (hasIn && hasOut) return 'mixed';
    if (hasOut) return 'out';
    if (hasIn) return 'in';
    return null;
  };

  return (
    <div className="calendar v2">
      <div className="calhead">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>

      {weeks.map((w, wi) => (
        <div className="calrow" key={wi}>
          {w.map((c, ci) => {
            const iso = isoDay(c.date);
            const d = perDay[iso];
            const tone = toneOf(d);
            const weight = d ? Math.max(d.in || 0, d.out || 0) / peak : 0;
            const isToday = iso === today;
            return (
              <button
                key={ci}
                className={
                  'cell' + (c.outside ? ' outside' : '') + (isToday ? ' today' : '') +
                  (tone ? ' t-' + tone : '')
                }
                onClick={() => onPick(c.date)}
                style={{
                  animationDelay: (wi * 7 + ci) * 14 + 'ms',
                  '--w': weight.toFixed(3),
                }}
                title={d ? `In ${money(d.in || 0)} · Out ${money(d.out || 0)}` : ''}
              >
                <span className="cwash" />
                <span className="cnum">{c.date.getDate()}</span>
                {d && (
                  <span className="cbars">
                    {(d.in || 0) > 0 && (
                      <i className="cb in" style={{ height: Math.max(3, ((d.in || 0) / peak) * 13) + 'px' }} />
                    )}
                    {(d.out || 0) > 0 && (
                      <i className="cb out" style={{ height: Math.max(3, ((d.out || 0) / peak) * 13) + 'px' }} />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div className="callegend">
        <span><i className="lg in" />Money in</span>
        <span><i className="lg out" />Money out</span>
        <span><i className="lg mixed" />Both</span>
      </div>
    </div>
  );
}

function WeekRow({ from, perDay, onPick, anchor }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return d;
  }), [from]);
  const today = isoDay(new Date());
  const picked = isoDay(anchor);

  return (
    <div className="weekstrip">
      {days.map((d, i) => {
        const iso = isoDay(d);
        const rec = perDay[iso];
        return (
          <button
            key={iso}
            className={'day' + (iso === today ? ' today' : '') + (iso === picked ? ' picked' : '')}
            style={{ animationDelay: i * 40 + 'ms' }}
            onClick={() => onPick(d)}
          >
            <span className="dow">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
            <span className="num">{d.getDate()}</span>
            {rec ? <span className="tick" /> : null}
          </button>
        );
      })}
    </div>
  );
}
