'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Plus, Close, Gear } from './Icons';
import Portal from './Portal';
import { healthReport, series, hhmm, METRICS, isoDay } from '@/lib/health';

const num = (v, dp = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: dp });

export default function HealthView({ tab, goTo }) {
  const { healthDays, saveHealthDay, reload, loading } = useStore();
  const [adding, setAdding] = useState(false);
  const r = useMemo(() => healthReport(healthDays || []), [healthDays]);

  if (!r.count) {
    return (
      <div className="body">
        <div className="pagehead">
          <h2>Nalam</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icobtn" onClick={() => setAdding(true)} aria-label="Add a day">
              <Plus width="16" height="16" />
            </button>
            <button className="icobtn" onClick={() => goTo && goTo('settings')} aria-label="Settings">
              <Gear width="16" height="16" />
            </button>
          </div>
        </div>
        <div className="card">
          <div className="cardhead"><h4>Nothing here yet</h4><span>waiting for data</span></div>
          <p className="note" style={{ marginTop: 0 }}>
            Two ways to fill this. Set up the iPhone Shortcut so Health posts here on its
            own — Settings explains how — or add a day by hand to see the screens working.
          </p>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => setAdding(true)}>Add today by hand</button>
        </div>
        {adding && <DaySheet onClose={() => setAdding(false)} onSave={saveHealthDay} />}
      </div>
    );
  }

  return (
    <div className="body">
      <div className="pagehead">
        <h2>{tab === 'sleep' ? 'Sleep' : tab === 'body' ? 'Body' : tab === 'trends' ? 'Trends' : 'Today'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
            <Refresh width="16" height="16" />
          </button>
          <button className="icobtn" onClick={() => setAdding(true)} aria-label="Add a day">
            <Plus width="16" height="16" />
          </button>
          <button className="icobtn" onClick={() => goTo && goTo('settings')} aria-label="Settings">
            <Gear width="16" height="16" />
          </button>
        </div>
      </div>

      {tab === 'sleep' ? <SleepTab r={r} /> :
        tab === 'body' ? <BodyTab r={r} /> :
          tab === 'trends' ? <TrendsTab r={r} /> : <TodayTab r={r} />}

      {adding && <DaySheet onClose={() => setAdding(false)} onSave={saveHealthDay} />}
    </div>
  );
}

/* ---------- today ---------- */
function TodayTab({ r }) {
  const steps = r.steps.today ?? r.steps.latest;
  const goal = 10000;
  const pct = steps ? Math.min(100, (steps / goal) * 100) : 0;
  const short = Math.max(0, goal - (steps || 0));
  const line = useMemo(() => series(r.days, 'steps', 30), [r.days]);

  return (
    <>
      <div className="hero paarihero">
        <div className="eyebrow"><span className="dot" />Steps {r.steps.today !== null ? 'today' : `on ${r.steps.latestOn || ''}`}</div>
        <div className="bignum">{num(steps)}<span className="cur" style={{ fontSize: '.36em', marginLeft: 8 }}>/ {num(goal)}</span></div>
        <div className="sublabel">
          {short > 0 ? <><b>{num(short)} to go</b> · roughly {Math.round(short / 90)} minutes of walking</> : <>Goal met · {num((steps || 0) - goal)} over</>}
        </div>
        <div className="attbar" style={{ marginTop: 16 }}>
          <span className="attfill used" style={{ width: pct + '%' }} />
        </div>
        <div className="paarigrid">
          <div className="pg"><span className="k">Move</span><span className="v">{num(r.move.today ?? r.move.latest)}</span><span className="d">kcal</span></div>
          <div className="pg"><span className="k">Sleep</span><span className="v">{hhmm(r.sleep.today ?? r.sleep.latest)}</span><span className="d">last night</span></div>
          <div className="pg"><span className="k">Resting</span><span className="v">{num(r.heart.today ?? r.heart.latest)}</span><span className="d">bpm</span></div>
        </div>
      </div>

      <Spark data={line} label="Thirty days of steps" colour="var(--g3)" />

      <div className="card">
        <div className="cardhead"><h4>Against your goal</h4><span>last 30 days</span></div>
        <div className="factgrid" style={{ marginTop: 0 }}>
          <Fact k="Days at 10k" v={String(r.goalHits)} d={r.goalRate !== null ? `${Math.round(r.goalRate)}% of measured days` : ''} tone="in" />
          <Fact k="Current run" v={`${r.streak} days`} d={`best ${r.bestStreak}`} />
          <Fact k="Daily average" v={num(r.steps.avg30)} d={r.steps.change !== null ? `${r.steps.change > 0 ? '+' : ''}${Math.round(r.steps.change)}% vs before` : ''} tone={r.steps.change > 0 ? 'in' : ''} />
          <Fact k="Best day" v={num(r.steps.best)} d={`lowest ${num(r.steps.low)}`} />
        </div>
      </div>

      <div className="card">
        <div className="cardhead"><h4>Your week</h4><span>average steps by day</span></div>
        <div className="dowrow">
          {r.weekday.map((w, i) => {
            const max = Math.max(...r.weekday.map((x) => x.avg || 0), 1);
            return (
              <div className="dowbar" key={i}>
                <div className="dowfill" style={{ height: Math.max(4, ((w.avg || 0) / max) * 100) + '%' }} />
                <span>{'SMTWTFS'[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- sleep ---------- */
function SleepTab({ r }) {
  const line = useMemo(() => series(r.days, 'sleep_min', 30), [r.days]);
  const last = r.sleep.latest;
  const deep = r.days.slice(-1)[0]?.sleep_deep_min;
  const rem = r.days.slice(-1)[0]?.sleep_rem_min;

  return (
    <>
      <div className="hero paarihero">
        <div className="eyebrow"><span className="dot" />Time asleep</div>
        <div className="bignum">{hhmm(last)}</div>
        <div className="sublabel">
          30-day average {hhmm(r.sleep.avg30)}
          {r.sleep.change !== null && <> · {r.sleep.change > 0 ? '+' : ''}{Math.round(r.sleep.change)}% against before</>}
        </div>
        <div className="paarigrid">
          <div className="pg"><span className="k">Deep</span><span className="v">{hhmm(deep)}</span><span className="d">{deep && last ? Math.round((deep / last) * 100) + '% of the night' : '—'}</span></div>
          <div className="pg"><span className="k">REM</span><span className="v">{hhmm(rem)}</span><span className="d">{rem && last ? Math.round((rem / last) * 100) + '%' : '—'}</span></div>
          <div className="pg"><span className="k">Nights</span><span className="v">{r.sleep.count}</span><span className="d">measured</span></div>
        </div>
      </div>

      <Spark data={line} label="Thirty nights" colour="#7B8CFF" fmt={hhmm} />

      <div className="card">
        <div className="cardhead"><h4>How it holds up</h4><span>last 30 nights</span></div>
        <div className="factgrid" style={{ marginTop: 0 }}>
          <Fact k="Longest night" v={hhmm(r.sleep.best)} d="in this window" tone="in" />
          <Fact k="Shortest" v={hhmm(r.sleep.low)} d="in this window" tone="out" />
          <Fact k="Nights over 7h" v={String(r.days.filter((d) => (d.sleep_min || 0) >= 420).length)} d={`of ${r.sleep.count} measured`} />
          <Fact k="Typical" v={hhmm(r.sleep.avg30)} d="the 30-day mean" />
        </div>
      </div>
    </>
  );
}

/* ---------- body ---------- */
function BodyTab({ r }) {
  const line = useMemo(() => series(r.days, 'weight_kg', 90), [r.days]);
  const known = line.filter((p) => p.value !== null);
  const first = known[0], last = known[known.length - 1];
  const delta = first && last ? last.value - first.value : null;
  const perMonth = delta !== null && known.length > 1
    ? (delta / Math.max(1, (new Date(last.iso) - new Date(first.iso)) / 86400000)) * 30.44 : null;

  return (
    <>
      <div className="hero paarihero">
        <div className="eyebrow"><span className="dot" />Weight</div>
        <div className="bignum">{num(r.weight.latest, 1)}<span className="cur" style={{ fontSize: '.36em', marginLeft: 6 }}>kg</span></div>
        <div className="sublabel">
          {delta !== null ? <><b>{delta > 0 ? '+' : ''}{delta.toFixed(1)} kg</b> across {known.length} weigh-ins</> : 'Add a weight to start tracking'}
          {perMonth !== null && <> · {perMonth > 0 ? '+' : ''}{perMonth.toFixed(2)} a month</>}
        </div>
      </div>

      <Spark data={line} label="Ninety days" colour="#FFC15E" fmt={(v) => v.toFixed(1) + ' kg'} />

      <div className="card">
        <div className="cardhead"><h4>Readings</h4><span>{known.length} logged</span></div>
        <div className="factgrid" style={{ marginTop: 0 }}>
          <Fact k="Highest" v={num(r.weight.best, 1) + ' kg'} d="in this window" />
          <Fact k="Lowest" v={num(r.weight.low, 1) + ' kg'} d="in this window" tone="in" />
          <Fact k="Rate" v={perMonth !== null ? `${perMonth > 0 ? '+' : ''}${perMonth.toFixed(2)}` : '—'} d="kg a month" tone={perMonth < 0 ? 'in' : ''} />
          <Fact k="Logged" v={String(known.length)} d="days with a reading" />
        </div>
      </div>
    </>
  );
}

/* ---------- trends ---------- */
function TrendsTab({ r }) {
  const rows = [r.steps, r.sleep, r.heart, r.weight, r.move, r.exercise].filter((m) => m.avg30 !== null);
  return (
    <>
      <div className="hero paarihero">
        <div className="eyebrow"><span className="dot" />{r.count} days recorded</div>
        <div className="bignum">{num(r.steps.avg30)}</div>
        <div className="sublabel">
          steps a day on average
          {r.steps.change !== null && <> · <b>{r.steps.change > 0 ? '+' : ''}{Math.round(r.steps.change)}%</b> against the 30 before</>}
        </div>
      </div>

      <div className="card">
        <div className="cardhead"><h4>What moved</h4><span>last 30 vs previous 30</span></div>
        {rows.map((m) => {
          const fmt = m.key === 'sleep_min' ? hhmm : (v) => num(v, m.key === 'weight_kg' ? 1 : 0);
          const good = m.change === null ? null : (m.better === 'up' ? m.change > 0 : m.change < 0);
          return (
            <div className="rtrow" key={m.key}>
              <span className="rtname">{m.label}</span>
              <span className="rtmeta">
                <b>{fmt(m.avg30)}</b>
                <em className={good === null ? '' : good ? 'up' : 'down'}>
                  {m.change === null ? `${m.count} days` : `${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%`}
                </em>
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="cardhead"><h4>Every day</h4><span>steps</span></div>
        <Bars data={series(r.days, 'steps', 60)} />
      </div>
    </>
  );
}

/* ---------- shared pieces ---------- */
function Spark({ data, label, colour, fmt }) {
  const pts = data.filter((p) => p.value !== null);
  if (pts.length < 2) return null;
  const W = 300, H = 84;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const xy = data.map((p, i) => [
    (i / (data.length - 1)) * W,
    p.value === null ? null : H - ((p.value - min) / span) * (H - 12) - 6,
  ]);
  let d = '';
  xy.forEach(([x, y]) => { if (y !== null) d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; });
  const lastPt = [...xy].reverse().find(([, y]) => y !== null);

  return (
    <div className="card">
      <div className="cardhead"><h4>{label}</h4><span>{fmt ? fmt(max) : num(max)} high</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart" preserveAspectRatio="none" style={{ height: 88 }}>
        <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={colour} opacity=".14" />
        <path d={d} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round"
              strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {lastPt && <circle cx={lastPt[0]} cy={lastPt[1]} r="3.4" fill={colour} />}
      </svg>
      <div className="chartaxis">
        <span>{data[0].iso.slice(8)}/{data[0].iso.slice(5, 7)}</span>
        <span>{fmt ? fmt(min) : num(min)} low</span>
      </div>
    </div>
  );
}

function Bars({ data }) {
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  return (
    <div className="daybars" style={{ height: 92 }}>
      {data.map((d) => (
        <span key={d.iso}
              className={'daybar' + (d.value === null ? ' empty' : '')}
              style={{ height: d.value ? Math.max(3, (d.value / max) * 100) + '%' : '2px' }}
              title={`${d.iso} · ${num(d.value)}`} />
      ))}
    </div>
  );
}

function Fact({ k, v, d, tone }) {
  return (
    <div className={'fact' + (tone ? ' ' + tone : '')}>
      <span className="fk">{k}</span><span className="fv">{v}</span><span className="fd">{d}</span>
    </div>
  );
}

/* ---------- adding a day by hand ---------- */
function DaySheet({ onClose, onSave }) {
  const [f, setF] = useState({
    on_date: isoDay(new Date()), steps: '', sleep_min: '', resting_hr: '', weight_kg: '', active_kcal: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 10 }}>
          <div className="sheettitle">Add a day</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>
        <p className="sheetsub">Leave anything blank that you do not have.</p>

        <div className="field"><label>Date</label><input type="date" value={f.on_date} onChange={set('on_date')} /></div>
        <div className="tworow">
          <div className="field"><label>Steps</label><input type="number" inputMode="numeric" value={f.steps} onChange={set('steps')} placeholder="0" /></div>
          <div className="field"><label>Move (kcal)</label><input type="number" inputMode="numeric" value={f.active_kcal} onChange={set('active_kcal')} placeholder="0" /></div>
        </div>
        <div className="tworow">
          <div className="field"><label>Sleep (minutes)</label><input type="number" inputMode="numeric" value={f.sleep_min} onChange={set('sleep_min')} placeholder="420" /></div>
          <div className="field"><label>Resting heart</label><input type="number" inputMode="numeric" value={f.resting_hr} onChange={set('resting_hr')} placeholder="62" /></div>
        </div>
        <div className="field"><label>Weight (kg)</label><input type="number" inputMode="decimal" step="0.1" value={f.weight_kg} onChange={set('weight_kg')} placeholder="74.2" /></div>

        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true);
          const row = { on_date: f.on_date, source: 'manual' };
          ['steps', 'sleep_min', 'resting_hr', 'active_kcal'].forEach((k) => { if (f[k] !== '') row[k] = Number(f[k]); });
          if (f.weight_kg !== '') row.weight_kg = Number(f.weight_kg);
          await onSave(row);
          setBusy(false);
          onClose();
        }}>{busy ? 'Saving…' : 'Save this day'}</button>
      </div>
    </Portal>
  );
}
