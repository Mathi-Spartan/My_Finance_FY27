'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Plus, Close, Check, Trash } from './Icons';
import Portal from './Portal';
import { evaluate, sideEffects, feasibility, weakestDay, EXP_METRICS, COMPARATORS } from '@/lib/experiments';
import { METRICS, hhmm, isoDay, todayIso } from '@/lib/health';

const fmt = (v, d = 0) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });
const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

const valueOf = (metric, v) =>
  v === null || v === undefined ? '—' : metric === 'sleep_min' ? hhmm(v) : fmt(v, metric === 'weight_kg' ? 1 : 0);

const STATUS = {
  on:      { label: 'on track', cls: 'on' },
  perfect: { label: 'no room left', cls: 'warn' },
  risk:    { label: 'at risk', cls: 'bad' },
  failed:  { label: 'broken', cls: 'bad' },
  done:    { label: 'completed', cls: 'on' },
};

/* ───────────────── the list ───────────────── */
export function LabView() {
  const { experiments, experimentLogs, healthDays, addExperiment, logExperiment, deleteExperiment } = useStore();
  const [making, setMaking] = useState(false);
  const [open, setOpen] = useState(null);

  const live = (experiments || []).filter((e) => !e.archived);
  const results = useMemo(
    () => live.map((e) => evaluate(e, healthDays, experimentLogs)),
    [live, healthDays, experimentLogs]
  );

  const dueToday = results.filter((r) => !r.finished);
  const keptToday = dueToday.filter((r) => r.marks.find((m) => m.isToday)?.state === 'hit').length;

  if (open) {
    const r = results.find((x) => x.exp.id === open);
    if (r) return <LabDetail result={r} onBack={() => setOpen(null)} onDelete={async () => { await deleteExperiment(open); setOpen(null); }} onLog={logExperiment} />;
  }

  return (
    <div className="body">
      <div className="skytop lab">
        <div className="apphead onsky">
          <div className="brandbar">
            <span className="worldmark">சோதனை</span>
            <span className="bbtext">The Lab<em>things you are testing</em></span>
          </div>
          <button className="skybtn" onClick={() => setMaking(true)} aria-label="New experiment">
            <Plus width="16" height="16" />
          </button>
        </div>

        <div className="skylabel">Kept today</div>
        <div className="skybal" style={{ pointerEvents: 'none' }}>
          <span className="sbnum">{keptToday}<em> / {dueToday.length}</em></span>
        </div>
        <div className="skysub">
          {live.length === 0 ? 'Nothing running. Start one and it tracks itself.'
            : dueToday.length - keptToday === 0 ? 'All of them kept today.'
              : `${dueToday.length - keptToday} still open today.`}
        </div>
      </div>

      <div className="sheetup">
        <span className="sheetgrab" />

        {live.length === 0 ? (
          <div className="card">
            <div className="cardhead"><h4>How this works</h4><span>the idea</span></div>
            <p className="note" style={{ marginTop: 0 }}>
              Set a rule — at least seven hours of sleep, at most one coffee after two — and a
              window to run it for. If the rule uses something Health records, it is checked
              for you every day. When it ends you get told what else moved while it ran.
            </p>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setMaking(true)}>
              Start the first one
            </button>
          </div>
        ) : results.map((r) => (
          <button className={'xp ' + (r.exp.colour || 'lime')} key={r.exp.id} onClick={() => setOpen(r.exp.id)}>
            <span className="xptop">
              <span className="xpname">
                {r.exp.name}
                <em>DAY {Math.min(r.elapsed + 1, r.exp.days)} OF {r.exp.days} · {r.exp.metric === 'manual' ? 'MANUAL' : METRICS[r.exp.metric]?.label.toUpperCase()}</em>
              </span>
              <span className={'chip ' + STATUS[r.status].cls}>
                {r.adherence === null ? STATUS[r.status].label : `${Math.round(r.adherence)}% kept`}
              </span>
            </span>

            <span className="dots">
              {r.marks.map((m) => <i key={m.iso} className={m.state} />)}
            </span>

            <span className="xpfoot">
              <span>{r.hits} of {r.elapsed} kept · streak <b>{r.streak}</b></span>
              <span>{r.finished ? 'finished' : r.daysLeft === 0 ? 'ends today' : `${r.daysLeft} days left`}</span>
            </span>
          </button>
        ))}
      </div>

      {making && (
        <NewExperiment
          healthDays={healthDays}
          onClose={() => setMaking(false)}
          onSave={async (row) => { await addExperiment(row); setMaking(false); }}
        />
      )}
    </div>
  );
}

/* ───────────────── one experiment ───────────────── */
function LabDetail({ result: r, onBack, onDelete, onLog }) {
  const { healthDays } = useStore();
  const [confirm, setConfirm] = useState(false);
  const effects = useMemo(() => sideEffects(r.exp, healthDays), [r.exp, healthDays]);
  const weak = useMemo(() => weakestDay(r), [r]);
  const todayMark = r.marks.find((m) => m.isToday);

  return (
    <div className="body">
      <div className="pagehead">
        <button className="backworld" style={{ position: 'static' }} onClick={onBack}>← All experiments</button>
        <button className="icobtn" onClick={() => setConfirm(true)} aria-label="Delete"><Trash width="15" height="15" /></button>
      </div>

      <div className="hero paarihero">
        <div className="eyebrow"><span className={'dot' + (r.status === 'risk' || r.status === 'failed' ? ' warn' : '')} />
          {r.exp.name}</div>
        <div className="bignum">{r.hits}<span className="cur" style={{ fontSize: '.36em' }}> / {r.elapsed} days</span></div>
        <div className="sublabel">
          {r.adherence === null ? 'no days decided yet' : `${Math.round(r.adherence)}% kept`}
          {' · '}streak {r.streak} · best {r.bestStreak}
        </div>

        <div className="attbar" style={{ marginTop: 16 }}>
          <span className="attfill used" style={{ width: (r.elapsed / r.exp.days) * 100 + '%' }} />
        </div>
        <div className="attmeta">
          <span>{r.exp.metric === 'manual' ? 'ticked by hand' : `${COMPARATORS[r.exp.comparator].label.toLowerCase()} ${valueOf(r.exp.metric, r.exp.target)}`}</span>
          <span>{r.finished ? 'finished' : `ends ${shortDate(r.endDate)}`}</span>
        </div>
      </div>

      {r.needsAll && !r.finished && (
        <div className="alertbar warn">
          <b>No misses left</b>
          <span>Every one of the remaining {r.remaining} days has to be kept for this to stand.</span>
        </div>
      )}
      {r.status === 'failed' && (
        <div className="alertbar bad">
          <b>Past the allowance</b>
          <span>{r.misses} missed against {r.exp.allowed_misses} allowed. Worth restarting with a target you would actually hit.</span>
        </div>
      )}

      {r.exp.metric === 'manual' && todayMark && (
        <div className="card">
          <div className="cardhead"><h4>Today</h4><span>tick it off</span></div>
          <div className="btnrow">
            <button className="btn" onClick={() => onLog(r.exp.id, todayIso(), true)}>Kept it</button>
            <button className="btn ghost" onClick={() => onLog(r.exp.id, todayIso(), false)}>Missed it</button>
          </div>
        </div>
      )}

      <div className="bigstat">
        <div className="bs"><span className="bsk">Average</span>
          <span className="bsv">{valueOf(r.exp.metric, r.average)}</span>
          <span className="bsd">across the run</span></div>
        <div className="bs"><span className="bsk">Best</span>
          <span className="bsv">{valueOf(r.exp.metric, r.exp.comparator === 'lte' ? r.worst : r.best)}</span>
          <span className="bsd">single day</span></div>
        <div className="bs"><span className="bsk">Missed</span>
          <span className="bsv">{r.misses}</span>
          <span className="bsd">of {r.exp.allowed_misses} allowed</span></div>
      </div>

      <div className="card">
        <div className="cardhead"><h4>Every day</h4><span>kept · close · missed</span></div>
        <div className="cal">
          {r.marks.map((m) => (
            <i key={m.iso} className={m.state} title={`${m.iso}${m.value !== null ? ' · ' + valueOf(r.exp.metric, m.value) : ''}`} />
          ))}
        </div>
      </div>

      {weak && (
        <div className="insight">
          <b>{weak.name}s are where it slips</b>
          <p>
            Kept on {weak.hit} of {weak.total} {weak.name}s — {Math.round(weak.rate * 100)}% against
            {' '}{Math.round(r.adherence)}% overall. If this run breaks, that is the day it breaks on.
          </p>
        </div>
      )}

      {effects.length > 0 && (
        <div className="card">
          <div className="cardhead"><h4>What else changed</h4><span>since it started</span></div>
          {effects.map((e) => (
            <div className="mrow" key={e.metric}>
              <span className={'mico ' + METRICS[e.metric].colour}>{e.label[0]}</span>
              <span className="mmain">
                <b>{e.label}</b>
                <em>{valueOf(e.metric, e.before)} → {valueOf(e.metric, e.after)}</em>
              </span>
              <span className="mval">
                <b>{e.pct > 0 ? '+' : ''}{e.pct.toFixed(0)}%</b>
                <em className={e.better ? 'up' : 'down'}>{e.better ? 'better' : 'worse'}</em>
              </span>
            </div>
          ))}
          <p className="note">
            These moved alongside the experiment. That is not proof it caused them — other
            things changed too — but it is what the numbers did.
          </p>
        </div>
      )}

      {confirm && (
        <Portal>
          <div className="scrim" onClick={() => setConfirm(false)} />
          <div className="sheet importsheet">
            <div className="grab" />
            <div className="sheettitle">Delete this experiment?</div>
            <p className="sheetsub">{r.exp.name} and every day recorded against it. This cannot be undone.</p>
            <button className="btn danger" onClick={onDelete}>Yes, delete it</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Keep it</button>
          </div>
        </Portal>
      )}
    </div>
  );
}

/* ───────────────── setting one up ───────────────── */
function NewExperiment({ onClose, onSave, healthDays }) {
  const [f, setF] = useState({
    name: '', metric: 'steps', comparator: 'gte', target: '10000',
    days: 30, allowed_misses: 2, colour: 'lime',
  });

  const feas = useMemo(
    () => feasibility({
      metric: f.metric, comparator: f.comparator, target: Number(f.target),
      days: healthDays, allowed: Number(f.allowed_misses), length: Number(f.days),
    }),
    [f.metric, f.comparator, f.target, f.allowed_misses, f.days, healthDays]
  );

  const unit = EXP_METRICS.find((m) => m.key === f.metric)?.unit;
  const valid = f.name.trim() && (f.metric === 'manual' || Number(f.target) > 0);

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 12 }}>
          <div className="sheettitle">New experiment</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>

        <div className="field">
          <label>Call it</label>
          <input autoFocus value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
                 placeholder="Sleep seven hours" />
        </div>

        <div className="field">
          <label>Measure</label>
          <div className="driverpick">
            {EXP_METRICS.map((m) => (
              <button key={m.key} className={'dchip' + (f.metric === m.key ? ' on' : '')}
                      onClick={() => setF((p) => ({ ...p, metric: m.key }))}>{m.label}</button>
            ))}
          </div>
        </div>

        {f.metric !== 'manual' && (
          <>
            <div className="field">
              <label>The rule</label>
              <div className="driverpick" style={{ marginBottom: 9 }}>
                {Object.values(COMPARATORS).map((c) => (
                  <button key={c.id} className={'dchip' + (f.comparator === c.id ? ' on' : '')}
                          onClick={() => setF((p) => ({ ...p, comparator: c.id }))}>{c.label}</button>
                ))}
              </div>
              <input type="number" inputMode="decimal" value={f.target}
                     onChange={(e) => setF((p) => ({ ...p, target: e.target.value }))}
                     placeholder={unit ? `value in ${unit}` : 'value'} />
              {f.metric === 'sleep_min' && (
                <p className="note" style={{ marginTop: 6 }}>In minutes — seven hours is 420.</p>
              )}
            </div>
          </>
        )}

        <div className="field">
          <label>For how long</label>
          <div className="driverpick">
            {[7, 14, 21, 30, 60, 90].map((d) => (
              <button key={d} className={'dchip' + (Number(f.days) === d ? ' on' : '')}
                      onClick={() => setF((p) => ({ ...p, days: d }))}>{d} days</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Allowed misses</label>
          <div className="driverpick">
            {[0, 2, 4, 8].map((m) => (
              <button key={m} className={'dchip' + (Number(f.allowed_misses) === m ? ' on' : '')}
                      onClick={() => setF((p) => ({ ...p, allowed_misses: m }))}>
                {m === 0 ? 'None' : m}
              </button>
            ))}
          </div>
        </div>

        {feas && feas.known && (
          <div className="feas">
            <div className="feask">How hard this will be</div>
            <div className="feasbar">
              {feas.marks.map((ok, i) => <i key={i} className={ok ? 'y' : 'n'} />)}
            </div>
            <p className="feastext">
              You met this on <b>{feas.hits} of the last {feas.of} days</b> — {Math.round(feas.rate * 100)}%.
              {feas.breakDay && <> At that rate the misses run out around <b>day {feas.breakDay}</b>.</>}
              {feas.verdict !== 'easy' && feas.fairer && (
                <span style={{ color: 'var(--brand)' }}>
                  {' '}{valueOf(f.metric, Math.round(feas.fairer))} would be a fairer first target.
                </span>
              )}
            </p>
          </div>
        )}
        {feas && !feas.known && (
          <div className="feas">
            <div className="feask">How hard this will be</div>
            <p className="feastext">Not enough history yet to judge. Run it and find out.</p>
          </div>
        )}

        <button className="btn" style={{ marginTop: 14 }} disabled={!valid}
                onClick={() => onSave({
                  name: f.name.trim(),
                  metric: f.metric,
                  comparator: f.comparator,
                  target: f.metric === 'manual' ? 0 : Number(f.target) || 0,
                  started_on: todayIso(),
                  days: Number(f.days),
                  allowed_misses: Number(f.allowed_misses),
                  colour: f.metric === 'sleep_min' ? 'sleep' : f.metric === 'weight_kg' ? 'body' : 'lime',
                })}>
          Start the experiment
        </button>
        <p className="note" style={{ textAlign: 'center', marginTop: 10 }}>
          {f.metric === 'manual' ? 'You tick this one off yourself.' : 'Checked automatically from your readings.'}
        </p>
      </div>
    </Portal>
  );
}
