'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Plus, Close, Trash, Check, Gear } from './Icons';
import Portal from './Portal';
import { experimentState, sideEffects, feasibility, METRICS, hhmm, isoDay } from '@/lib/health';

const fmtVal = (metric, v) => {
  if (v === null || v === undefined) return '—';
  if (metric === 'sleep_min') return hhmm(v);
  if (metric === 'weight_kg') return Number(v).toFixed(1) + ' kg';
  return Number(v).toLocaleString('en-IN');
};
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function LabView({ tab, goTo }) {
  const { experiments, experimentLogs, healthDays, addExperiment, deleteExperiment, logExperiment } = useStore();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);

  const live = (experiments || []).filter((e) => !e.archived);
  const states = useMemo(() => {
    const m = {};
    live.forEach((e) => { m[e.id] = experimentState(e, healthDays || [], experimentLogs || []); });
    return m;
  }, [live, healthDays, experimentLogs]);

  const running = live.filter((e) => states[e.id].remaining > 0 && !states[e.id].failed);
  const finished = live.filter((e) => states[e.id].remaining === 0 || states[e.id].failed);
  const shown = tab === 'running' ? running : tab === 'done' ? finished : live;

  const keptToday = live.filter((e) => {
    const t = states[e.id].marks.find((m) => m.today);
    return t && t.kept === true;
  }).length;

  const detail = open ? live.find((e) => e.id === open) : null;

  return (
    <div className="body">
      <div className="pagehead">
        <h2>{tab === 'running' ? 'Running' : tab === 'done' ? 'Finished' : 'The Lab'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icobtn" onClick={() => setAdding(true)} aria-label="New experiment">
            <Plus width="16" height="16" />
          </button>
          <button className="icobtn" onClick={() => goTo && goTo('settings')} aria-label="Settings">
            <Gear width="16" height="16" />
          </button>
        </div>
      </div>

      {live.length === 0 ? (
        <div className="card">
          <div className="cardhead"><h4>No experiments yet</h4><span>start one</span></div>
          <p className="note" style={{ marginTop: 0 }}>
            An experiment is a rule and a window. Ten thousand steps a day for thirty days.
            Seven hours of sleep for three weeks. Anything Health measures is checked for you;
            anything it cannot, you tick yourself.
          </p>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => setAdding(true)}>Set one up</button>
        </div>
      ) : (
        <>
          {tab === 'lab' && (
            <div className="hero paarihero">
              <div className="eyebrow"><span className="dot" />{running.length} running · {finished.length} finished</div>
              <div className="bignum">{keptToday}<span className="cur" style={{ fontSize: '.36em', marginLeft: 8 }}>/ {running.length}</span></div>
              <div className="sublabel">kept today</div>
            </div>
          )}

          {shown.map((e) => {
            const s = states[e.id];
            return (
              <button className={'xp ' + toneOf(s)} key={e.id} onClick={() => setOpen(e.id)}>
                <span className="xptop">
                  <span className="xpname">
                    {e.name}
                    <em>DAY {Math.min(s.done + (s.remaining ? 1 : 0), e.days)} OF {e.days} · {ruleText(e)}</em>
                  </span>
                  <span className={'chip ' + chipOf(s)}>{s.status}</span>
                </span>

                <span className="dots">
                  {s.marks.map((m, i) => (
                    <i key={i} className={m.today ? 'today' : m.kept === true ? 'hit' : m.kept === false ? 'miss' : ''} />
                  ))}
                </span>

                <span className="xpfoot">
                  <span>{s.hits} of {s.done} kept · streak <b>{s.streak}</b></span>
                  <span>{s.remaining > 0 ? `${s.remaining} days left` : 'finished'}</span>
                </span>
              </button>
            );
          })}
        </>
      )}

      {adding && (
        <NewExperiment
          days={healthDays || []}
          onClose={() => setAdding(false)}
          onSave={async (row) => { await addExperiment(row); setAdding(false); }}
        />
      )}

      {detail && (
        <ExperimentSheet
          exp={detail}
          state={states[detail.id]}
          days={healthDays || []}
          onClose={() => setOpen(null)}
          onLog={logExperiment}
          onDelete={async () => { await deleteExperiment(detail.id); setOpen(null); }}
        />
      )}
    </div>
  );
}

const toneOf = (s) => (s.failed ? 'risk' : s.status === 'at risk' ? 'risk' : s.status === 'wobbling' ? 'body' : '');
const chipOf = (s) => (s.failed || s.status === 'at risk' ? 'bad' : s.status === 'wobbling' ? 'warn' : 'on');
const ruleText = (e) => {
  if (e.metric === 'manual') return 'TICKED BY HAND';
  const m = METRICS[e.metric];
  const word = e.comparator === 'lte' ? 'AT MOST' : e.comparator === 'eq' ? 'EXACTLY' : 'AT LEAST';
  return `${word} ${fmtVal(e.metric, e.target).toUpperCase()}`;
};

/* ---------- one experiment ---------- */
function ExperimentSheet({ exp, state: s, days, onClose, onLog, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const effects = useMemo(() => sideEffects(exp, days), [exp, days]);
  const today = s.marks.find((m) => m.today);
  const pct = exp.days ? (s.done / exp.days) * 100 : 0;

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 8 }}>
          <div className="sheettitle">{exp.name}</div>
          <div className="spacer" />
          <button className="icobtn" onClick={() => setConfirm(true)} aria-label="Delete"><Trash width="15" height="15" /></button>
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>

        {confirm ? (
          <>
            <div className="sheetsub">Delete this experiment and everything logged against it?</div>
            <button className="btn danger" onClick={onDelete}>Yes, delete it</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Keep it</button>
          </>
        ) : (
          <>
            <p className="sheetsub">{ruleText(exp)} · started {fmtDate(exp.started_on)}</p>

            <div className="proj">
              <i style={{ width: pct + '%' }} />
              <span className="pin" style={{ left: Math.min(96, pct) + '%' }}>
                {s.remaining > 0 ? `${s.remaining} left` : 'done'}
              </span>
            </div>

            <div className="factgrid" style={{ marginTop: 0 }}>
              <Fact k="Kept" v={`${s.hits} / ${s.done}`} d={s.rate !== null ? `${Math.round(s.rate)}%` : ''} tone="in" />
              <Fact k="Current run" v={`${s.streak} days`} d={`best ${s.bestStreak}`} />
              <Fact k="Misses left" v={String(s.missesLeft)} d={`${s.misses} used of ${exp.allowed_misses}`} tone={s.missesLeft === 0 ? 'out' : ''} />
              <Fact k="Average" v={fmtVal(exp.metric, s.average)} d={s.best !== null ? `best ${fmtVal(exp.metric, s.best)}` : ''} />
            </div>

            {s.mustKeepAll && (
              <div className="alertbar bad">
                <b>No slack left</b>
                <span>Every one of the remaining {s.remaining} days has to be kept.</span>
              </div>
            )}
            {s.failed && (
              <div className="alertbar warn">
                <b>This one did not hold</b>
                <span>{s.misses} missed against {exp.allowed_misses} allowed. Worth restarting with an easier target.</span>
              </div>
            )}

            {exp.metric === 'manual' && today && (
              <div className="btnrow" style={{ marginTop: 12 }}>
                <button className={'btn' + (today.kept === true ? '' : ' ghost')}
                        onClick={() => onLog(exp.id, isoDay(new Date()), true)}>Kept it today</button>
                <button className={'btn ghost'} style={{ marginTop: 8 }}
                        onClick={() => onLog(exp.id, isoDay(new Date()), false)}>Missed today</button>
              </div>
            )}

            <div className="card" style={{ marginTop: 14 }}>
              <div className="cardhead"><h4>Every day</h4><span>kept · missed · to come</span></div>
              <div className="cal">
                {s.marks.map((m, i) => (
                  <i key={i}
                     className={m.today ? 'today' : m.kept === true ? 'hit' : m.kept === false ? 'miss' : ''}
                     title={`${m.iso}${m.value !== null ? ' · ' + fmtVal(exp.metric, m.value) : ''}`} />
                ))}
              </div>
            </div>

            {effects.length > 0 && (
              <div className="card">
                <div className="cardhead"><h4>What else changed</h4><span>since it began</span></div>
                {effects.map((e) => (
                  <div className="rtrow" key={e.key}>
                    <span className="rtname">{e.label}</span>
                    <span className="rtmeta">
                      <b>{fmtVal(e.key, e.from)} → {fmtVal(e.key, e.to)}</b>
                      <em className={e.better ? 'up' : 'down'}>
                        {e.delta > 0 ? '+' : ''}{e.key === 'sleep_min' ? Math.round(e.delta) + 'm' : e.delta.toFixed(1)}
                      </em>
                    </span>
                  </div>
                ))}
                <p className="note" style={{ marginTop: 12, marginBottom: 0 }}>
                  These moved alongside the experiment. That is not proof it caused them — other
                  things changed too — but it is what the numbers did.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Portal>
  );
}

/* ---------- setting one up ---------- */
const PRESETS = [
  { name: 'Walk 10,000 steps', metric: 'steps', comparator: 'gte', target: 10000, days: 30 },
  { name: 'Sleep seven hours', metric: 'sleep_min', comparator: 'gte', target: 420, days: 21 },
  { name: 'Move 500 kcal', metric: 'active_kcal', comparator: 'gte', target: 500, days: 30 },
  { name: 'Exercise 30 minutes', metric: 'exercise_min', comparator: 'gte', target: 30, days: 30 },
];

function NewExperiment({ days, onClose, onSave }) {
  const [f, setF] = useState({
    name: '', metric: 'steps', comparator: 'gte', target: 10000,
    days: 30, allowed_misses: 2, started_on: isoDay(new Date()),
  });
  const [busy, setBusy] = useState(false);

  const feas = useMemo(
    () => feasibility(days, f.metric, f.comparator, f.target),
    [days, f.metric, f.comparator, f.target]
  );

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && (f.metric === 'manual' || Number(f.target) > 0);

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 10 }}>
          <div className="sheettitle">New experiment</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>

        <div className="field">
          <label>Call it</label>
          <input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)}
                 placeholder="Walk ten thousand steps" />
        </div>

        <div className="field">
          <label>Or start from one of these</label>
          <div className="driverpick">
            {PRESETS.map((p) => (
              <button key={p.name} className="dchip"
                      onClick={() => setF((s) => ({ ...s, ...p }))}>{p.name}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Measure</label>
          <div className="driverpick">
            {['steps', 'sleep_min', 'active_kcal', 'exercise_min', 'weight_kg', 'resting_hr', 'manual'].map((m) => (
              <button key={m} className={'dchip' + (f.metric === m ? ' on' : '')} onClick={() => set('metric', m)}>
                {m === 'manual' ? 'By hand' : METRICS[m].label}
              </button>
            ))}
          </div>
        </div>

        {f.metric !== 'manual' && (
          <>
            <div className="field">
              <label>The rule</label>
              <div className="driverpick" style={{ marginBottom: 9 }}>
                {[['gte', 'At least'], ['lte', 'At most'], ['eq', 'Exactly']].map(([k, l]) => (
                  <button key={k} className={'dchip' + (f.comparator === k ? ' on' : '')} onClick={() => set('comparator', k)}>{l}</button>
                ))}
              </div>
              <input type="number" inputMode="decimal" value={f.target}
                     onChange={(e) => set('target', Number(e.target.value))} />
              <p className="note" style={{ marginTop: 7, marginBottom: 0 }}>
                {METRICS[f.metric].label}{METRICS[f.metric].unit ? ` in ${METRICS[f.metric].unit}` : ''}
                {f.metric === 'sleep_min' && ` — 420 is seven hours`}
              </p>
            </div>
          </>
        )}

        <div className="tworow">
          <div className="field">
            <label>For how many days</label>
            <input type="number" inputMode="numeric" value={f.days} onChange={(e) => set('days', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Misses allowed</label>
            <input type="number" inputMode="numeric" value={f.allowed_misses} onChange={(e) => set('allowed_misses', Number(e.target.value))} />
          </div>
        </div>

        {feas && (
          <div className="feas">
            <div className="feask">How hard this will be</div>
            <div className="feasbar">
              {feas.marks.map((m, i) => <i key={i} className={m === null ? '' : m ? 'y' : 'n'} />)}
            </div>
            <p className="feastext">
              You met this on <b>{feas.hits} of the last {feas.days} days</b> — {Math.round(feas.rate)}%.
              {feas.rate < 60 && Number(f.allowed_misses) < f.days * 0.3 && (
                <span style={{ color: 'var(--brand)' }}> At that rate you would use every allowed miss early. Consider an easier target or more slack.</span>
              )}
              {feas.rate >= 85 && <span style={{ color: 'var(--in)' }}> You already do this most days — you could aim higher.</span>}
            </p>
          </div>
        )}

        <button className="btn" style={{ marginTop: 14 }} disabled={!valid || busy}
                onClick={async () => { setBusy(true); await onSave(f); setBusy(false); }}>
          {busy ? 'Starting…' : 'Start the experiment'}
        </button>
        <p className="note" style={{ textAlign: 'center', marginTop: 10 }}>
          {f.metric === 'manual' ? 'You tick this one off yourself.' : 'Checked automatically from your health data.'}
        </p>
      </div>
    </Portal>
  );
}

function Fact({ k, v, d, tone }) {
  return (
    <div className={'fact' + (tone ? ' ' + tone : '')}>
      <span className="fk">{k}</span><span className="fv">{v}</span><span className="fd">{d}</span>
    </div>
  );
}
