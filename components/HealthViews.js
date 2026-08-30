'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Plus, Close } from './Icons';
import Portal from './Portal';
import {
  METRICS, series, stats, compare, today as todayRow, standoutHealth, hhmm, isoDay, todayIso,
} from '@/lib/health';

const fmtN = (v, d = 0) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });
const shortDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/* ───────────────── Today ───────────────── */
export function HealthToday() {
  const { healthDays, saveHealthDay, reload, loading } = useStore();
  const [adding, setAdding] = useState(false);
  const t = useMemo(() => todayRow(healthDays), [healthDays]);
  const note = useMemo(() => standoutHealth(healthDays), [healthDays]);
  const week = useMemo(() => series(healthDays, 'steps', 7), [healthDays]);
  const peak = Math.max(...week.map((d) => d.value || 0), METRICS.steps.goal);

  const steps = t?.steps ?? null;
  const pct = steps ? Math.min(100, (steps / METRICS.steps.goal) * 100) : 0;

  return (
    <div className="body">
      <div className="skytop nalam">
        <div className="apphead onsky">
          <div className="brandbar">
            <span className="worldmark">நலம்</span>
            <span className="bbtext">Nalam<em>what your body has been doing</em></span>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className={'skybtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
              <Refresh width="16" height="16" />
            </button>
            <button className="skybtn" onClick={() => setAdding(true)} aria-label="Add a reading">
              <Plus width="16" height="16" />
            </button>
          </div>
        </div>

        <div className="skylabel">Steps today</div>
        <div className="skybal" style={{ pointerEvents: 'none' }}>
          <span className="sbnum">{steps === null ? '—' : fmtN(steps)}
            <em> / {fmtN(METRICS.steps.goal)}</em></span>
        </div>
        <div className="skysub">{note.headline} · {note.detail}</div>

        <div className="goalbar"><i style={{ width: pct + '%' }} /></div>

        <div className="weekbars">
          {week.map((d) => (
            <div className="wb" key={d.iso}>
              <span className="wbtrack">
                <i style={{ height: Math.max(4, ((d.value || 0) / peak) * 100) + '%' }} />
              </span>
              <span className="wbl">{new Date(d.iso + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sheetup">
        <span className="sheetgrab" />

        <div className="tiles3">
          <Tile k="Move" v={t?.active_kcal ?? null} unit="kcal" goal={METRICS.active_kcal.goal} tone="move" />
          <Tile k="Sleep" v={t?.sleep_min ?? null} fmt={hhmm} goal={METRICS.sleep_min.goal} tone="sleep" />
          <Tile k="Resting" v={t?.resting_hr ?? null} unit="bpm" goal={null} tone="heart" />
        </div>

        {healthDays.length === 0 ? (
          <div className="card">
            <div className="cardhead"><h4>Nothing synced yet</h4><span>set up the shortcut</span></div>
            <p className="note" style={{ marginTop: 0 }}>
              Nalam reads what your iPhone already records. Set up the Shortcut once and it
              posts each day here on its own. Until then you can add readings by hand with
              the + button.
            </p>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="cardhead"><h4>Last fourteen days</h4><span>steps</span></div>
              <Spark days={healthDays} metric="steps" />
            </div>

            <div className="card">
              <div className="cardhead"><h4>Where it stands</h4><span>vs the fortnight before</span></div>
              <Delta days={healthDays} metric="steps" />
              <Delta days={healthDays} metric="sleep_min" fmt={hhmm} />
              <Delta days={healthDays} metric="resting_hr" />
              <Delta days={healthDays} metric="weight_kg" d={1} />
            </div>
          </>
        )}
      </div>

      {adding && <ReadingSheet onClose={() => setAdding(false)} onSave={saveHealthDay} />}
    </div>
  );
}

function Tile({ k, v, unit, goal, tone, fmt }) {
  const pct = goal && v ? Math.min(100, (v / goal) * 100) : v ? 60 : 0;
  return (
    <div className="tile3">
      <span className="t3k">{k}</span>
      <span className="t3v">{v === null ? '—' : fmt ? fmt(v) : fmtN(v)}{unit && v !== null && <em> {unit}</em>}</span>
      <span className="t3bar"><i className={tone} style={{ width: pct + '%' }} /></span>
      <span className="t3d">{goal ? `${Math.round(pct)}% of ${fmt ? fmt(goal) : fmtN(goal)}` : 'today'}</span>
    </div>
  );
}

function Spark({ days, metric }) {
  const s = series(days, metric, 14);
  const vals = s.map((d) => d.value).filter((v) => v !== null);
  if (!vals.length) return <p className="note" style={{ margin: 0 }}>No readings yet.</p>;
  const max = Math.max(...vals), min = Math.min(...vals);
  const span = max - min || 1;
  const W = 300, H = 70;
  const pts = s.map((d, i) => [
    (i / (s.length - 1)) * W,
    d.value === null ? null : H - ((d.value - min) / span) * (H - 12) - 6,
  ]);
  const path = pts.filter((p) => p[1] !== null)
    .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="hspark" preserveAspectRatio="none">
        <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#hg)" />
        <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity=".32" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient></defs>
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chartaxis"><span>{shortDate(s[0].iso)}</span><span>avg {fmtN(stats(vals).avg)}</span><span>{shortDate(s[s.length - 1].iso)}</span></div>
    </>
  );
}

function Delta({ days, metric, fmt, d = 0 }) {
  const c = compare(days, metric, 14);
  const meta = METRICS[metric];
  if (c.now.avg === null) return null;
  const better = c.delta === null ? null : (meta.dir === 'up' ? c.delta > 0 : c.delta < 0);
  return (
    <div className="mrow">
      <span className={'mico ' + meta.colour}>{meta.label[0]}</span>
      <span className="mmain">
        <b>{meta.label}</b>
        <em>{fmt ? fmt(c.now.avg) : fmtN(c.now.avg, d)} now · {c.then.avg !== null ? (fmt ? fmt(c.then.avg) : fmtN(c.then.avg, d)) : '—'} before</em>
      </span>
      <span className="mval">
        <b>{c.pct === null ? '—' : `${c.pct > 0 ? '+' : ''}${c.pct.toFixed(0)}%`}</b>
        {better !== null && <em className={better ? 'up' : 'down'}>{better ? 'better' : 'worse'}</em>}
      </span>
    </div>
  );
}

/* ───────────────── Trends ───────────────── */
export function HealthTrends() {
  const { healthDays } = useStore();
  const [metric, setMetric] = useState('steps');
  const s = useMemo(() => series(healthDays, metric, 90), [healthDays, metric]);
  const vals = s.map((d) => d.value).filter((v) => v !== null);
  const st = stats(vals);
  const meta = METRICS[metric];
  const peak = st.max || 1;

  return (
    <div className="body">
      <div className="pagehead"><h2>Trends</h2></div>

      <div className="metricrail">
        {['steps', 'sleep_min', 'resting_hr', 'weight_kg', 'active_kcal'].map((m) => (
          <button key={m} className={'mchip' + (metric === m ? ' on' : '')} onClick={() => setMetric(m)}>
            {METRICS[m].label}
          </button>
        ))}
      </div>

      {!vals.length ? (
        <div className="card"><p className="note" style={{ margin: 0 }}>No {meta.label.toLowerCase()} readings yet.</p></div>
      ) : (
        <>
          <div className="card">
            <div className="cardhead"><h4>{meta.label}</h4><span>90 days</span></div>
            <div className="statline">
              <div><span>Average</span><b>{metric === 'sleep_min' ? hhmm(st.avg) : fmtN(st.avg, 1)}</b></div>
              <div><span>Best</span><b>{metric === 'sleep_min' ? hhmm(st.max) : fmtN(st.max, 1)}</b></div>
              <div><span>Days</span><b>{st.count}</b></div>
            </div>
            <div className="colbars">
              {s.map((d) => (
                <i key={d.iso} className={d.value === null ? 'gap' : ''}
                   style={{ height: d.value === null ? '3px' : Math.max(3, (d.value / peak) * 100) + '%' }}
                   title={`${shortDate(d.iso)} · ${d.value ?? 'no reading'}`} />
              ))}
            </div>
            <div className="chartaxis"><span>{shortDate(s[0].iso)}</span><span>{shortDate(s[s.length - 1].iso)}</span></div>
          </div>

          <div className="card">
            <div className="cardhead"><h4>By weekday</h4><span>which days differ</span></div>
            <Weekday days={healthDays} metric={metric} />
          </div>
        </>
      )}
    </div>
  );
}

const DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function Weekday({ days, metric }) {
  const buckets = DAYNAMES.map((name, i) => {
    const vals = (days || [])
      .filter((d) => new Date(d.on_date + 'T12:00:00').getDay() === i && d[metric] !== null && d[metric] !== undefined)
      .map((d) => Number(d[metric]));
    return { name, avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null, n: vals.length };
  });
  const max = Math.max(...buckets.map((b) => b.avg || 0), 1);
  return (
    <>
      <div className="dowrow">
        {buckets.map((b) => (
          <div className="dowbar" key={b.name}>
            <div className="dowfill" style={{ height: Math.max(4, ((b.avg || 0) / max) * 100) + '%' }} />
            <span>{b.name[0]}</span>
          </div>
        ))}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        {(() => {
          const seen = buckets.filter((b) => b.n >= 2);
          if (seen.length < 3) return 'A few more weeks and the pattern shows.';
          const hi = seen.slice().sort((a, b) => b.avg - a.avg)[0];
          const lo = seen.slice().sort((a, b) => a.avg - b.avg)[0];
          const f = metric === 'sleep_min' ? hhmm : (v) => fmtN(v, 1);
          return `${hi.name}s are highest at ${f(hi.avg)}, ${lo.name}s lowest at ${f(lo.avg)}.`;
        })()}
      </p>
    </>
  );
}

/* ───────────────── Body ───────────────── */
export function HealthBody() {
  const { healthDays, saveHealthDay } = useStore();
  const [adding, setAdding] = useState(false);
  const s = useMemo(() => series(healthDays, 'weight_kg', 90).filter((d) => d.value !== null), [healthDays]);
  const st = stats(s.map((d) => d.value));

  // a straight-line fit, so the projection is honest about its own quality
  const fit = useMemo(() => {
    if (s.length < 4) return null;
    const t0 = new Date(s[0].iso + 'T12:00:00').getTime();
    const pts = s.map((d) => [(new Date(d.iso + 'T12:00:00').getTime() - t0) / 86400000, d.value]);
    const n = pts.length;
    const sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
    const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
    const intercept = (sy - slope * sx) / n;
    const mean = sy / n;
    const ssTot = pts.reduce((a, p) => a + (p[1] - mean) ** 2, 0);
    const ssRes = pts.reduce((a, p) => a + (p[1] - (slope * p[0] + intercept)) ** 2, 0);
    return { perDay: slope, perMonth: slope * 30.44, r2: ssTot ? 1 - ssRes / ssTot : 0 };
  }, [s]);

  return (
    <div className="body">
      <div className="pagehead">
        <h2>Body</h2>
        <button className="icobtn" onClick={() => setAdding(true)} aria-label="Add"><Plus width="16" height="16" /></button>
      </div>

      {!s.length ? (
        <div className="card"><p className="note" style={{ margin: 0 }}>No weight recorded yet. Tap + to add one.</p></div>
      ) : (
        <>
          <div className="hero paarihero">
            <div className="eyebrow"><span className="dot" />weight today</div>
            <div className="bignum">{fmtN(st.last, 1)}<span className="cur" style={{ fontSize: '.4em' }}> kg</span></div>
            <div className="sublabel">
              {fit && `${fit.perMonth > 0 ? '+' : ''}${fit.perMonth.toFixed(2)} kg a month · from ${fmtN(s[0].value, 1)} on ${shortDate(s[0].iso)}`}
            </div>
            <div className="paarigrid">
              <div className="pg"><span className="k">Lightest</span><span className="v">{fmtN(st.min, 1)}</span><span className="d">in this window</span></div>
              <div className="pg"><span className="k">Heaviest</span><span className="v">{fmtN(st.max, 1)}</span><span className="d">in this window</span></div>
              <div className="pg"><span className="k">Readings</span><span className="v">{st.count}</span><span className="d">of 90 days</span></div>
            </div>
          </div>

          <div className="card">
            <div className="cardhead"><h4>The line</h4><span>{s.length} readings</span></div>
            <Spark days={healthDays} metric="weight_kg" />
          </div>

          {fit && (
            <div className="card">
              <div className="cardhead"><h4>Where it is heading</h4><span>straight-line fit</span></div>
              <div className="mrow">
                <span className="mico body">R</span>
                <span className="mmain"><b>Rate</b><em>kilograms per month</em></span>
                <span className="mval"><b>{fit.perMonth > 0 ? '+' : ''}{fit.perMonth.toFixed(2)}</b></span>
              </div>
              <div className="mrow">
                <span className="mico body">F</span>
                <span className="mmain"><b>How well it fits</b><em>R² of the line</em></span>
                <span className="mval">
                  <b>{fit.r2.toFixed(2)}</b>
                  <em className={fit.r2 > 0.6 ? 'up' : 'down'}>{fit.r2 > 0.6 ? 'steady' : 'noisy'}</em>
                </span>
              </div>
              <p className="note">
                {fit.r2 > 0.6
                  ? 'The trend is consistent enough to project from.'
                  : 'The readings swing too much to project from with any confidence yet.'}
              </p>
            </div>
          )}
        </>
      )}

      {adding && <ReadingSheet onClose={() => setAdding(false)} onSave={saveHealthDay} only="weight_kg" />}
    </div>
  );
}

/* ───────────────── Sleep ───────────────── */
export function HealthSleep() {
  const { healthDays } = useStore();
  const s = useMemo(() => series(healthDays, 'sleep_min', 14), [healthDays]);
  const vals = s.map((d) => d.value).filter((v) => v !== null);
  const st = stats(vals);
  const t = todayRow(healthDays);
  const peak = st.max || 480;

  return (
    <div className="body">
      <div className="pagehead"><h2>Sleep</h2></div>

      {!vals.length ? (
        <div className="card"><p className="note" style={{ margin: 0 }}>No sleep recorded yet.</p></div>
      ) : (
        <>
          <div className="hero paarihero sleephero">
            <div className="eyebrow"><span className="dot" />last night</div>
            <div className="bignum">{hhmm(t?.sleep_min ?? st.last)}</div>
            <div className="sublabel">
              fortnight average {hhmm(st.avg)} · best {hhmm(st.max)}
            </div>
            <div className="paarigrid">
              <div className="pg"><span className="k">Deep</span><span className="v">{t?.sleep_deep_min ? hhmm(t.sleep_deep_min) : '—'}</span><span className="d">last night</span></div>
              <div className="pg"><span className="k">REM</span><span className="v">{t?.sleep_rem_min ? hhmm(t.sleep_rem_min) : '—'}</span><span className="d">last night</span></div>
              <div className="pg"><span className="k">Nights</span><span className="v">{st.count}</span><span className="d">of 14</span></div>
            </div>
          </div>

          <div className="card">
            <div className="cardhead"><h4>Fourteen nights</h4><span>hours asleep</span></div>
            <div className="nightbars">
              {s.map((d) => (
                <div className="nb2" key={d.iso}>
                  <span className="nbt">
                    <i style={{ height: d.value === null ? '2px' : Math.max(4, (d.value / peak) * 100) + '%' }}
                       className={d.value !== null && d.value >= 420 ? 'good' : ''} />
                  </span>
                  <span className="nbl">{new Date(d.iso + 'T12:00:00').getDate()}</span>
                </div>
              ))}
            </div>
            <p className="note" style={{ marginTop: 12 }}>
              {vals.filter((v) => v >= 420).length} of {vals.length} nights reached seven hours.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────── add a reading by hand ───────────────── */
function ReadingSheet({ onClose, onSave, only }) {
  const [f, setF] = useState({ on_date: todayIso(), steps: '', sleep_h: '', sleep_m: '', resting_hr: '', weight_kg: '', active_kcal: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const show = (k) => !only || only === k;

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 12 }}>
          <div className="sheettitle">Add a reading</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>

        <div className="field">
          <label>Date</label>
          <input type="date" value={f.on_date} onChange={set('on_date')} />
        </div>

        {show('steps') && (
          <div className="field"><label>Steps</label>
            <input type="number" inputMode="numeric" value={f.steps} onChange={set('steps')} placeholder="0" /></div>
        )}
        {show('sleep_min') && !only && (
          <div className="tworow">
            <div className="field"><label>Slept (hours)</label>
              <input type="number" inputMode="numeric" value={f.sleep_h} onChange={set('sleep_h')} placeholder="7" /></div>
            <div className="field"><label>and minutes</label>
              <input type="number" inputMode="numeric" value={f.sleep_m} onChange={set('sleep_m')} placeholder="00" /></div>
          </div>
        )}
        {show('weight_kg') && (
          <div className="field"><label>Weight (kg)</label>
            <input type="number" inputMode="decimal" step="0.1" value={f.weight_kg} onChange={set('weight_kg')} placeholder="0.0" /></div>
        )}
        {show('resting_hr') && !only && (
          <div className="field"><label>Resting heart rate</label>
            <input type="number" inputMode="numeric" value={f.resting_hr} onChange={set('resting_hr')} placeholder="bpm" /></div>
        )}
        {show('active_kcal') && !only && (
          <div className="field"><label>Move (kcal)</label>
            <input type="number" inputMode="numeric" value={f.active_kcal} onChange={set('active_kcal')} placeholder="0" /></div>
        )}

        <button className="btn" onClick={async () => {
          const row = { on_date: f.on_date, source: 'manual' };
          if (f.steps !== '') row.steps = Number(f.steps);
          if (f.weight_kg !== '') row.weight_kg = Number(f.weight_kg);
          if (f.resting_hr !== '') row.resting_hr = Number(f.resting_hr);
          if (f.active_kcal !== '') row.active_kcal = Number(f.active_kcal);
          if (f.sleep_h !== '' || f.sleep_m !== '') row.sleep_min = Number(f.sleep_h || 0) * 60 + Number(f.sleep_m || 0);
          await onSave(row);
          onClose();
        }}>Save reading</button>
      </div>
    </Portal>
  );
}
