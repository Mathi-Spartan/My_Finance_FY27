// Reading the health data. Everything is arithmetic over health_days rows.

const n = (x) => (x === null || x === undefined ? null : Number(x));
export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

export const METRICS = {
  steps:      { key: 'steps', label: 'Steps', unit: '', colour: 'move', goal: 10000, better: 'up' },
  sleep_min:  { key: 'sleep_min', label: 'Sleep', unit: 'min', colour: 'sleep', goal: 420, better: 'up' },
  resting_hr: { key: 'resting_hr', label: 'Resting heart', unit: 'bpm', colour: 'heart', goal: null, better: 'down' },
  weight_kg:  { key: 'weight_kg', label: 'Weight', unit: 'kg', colour: 'body', goal: null, better: 'down' },
  active_kcal:{ key: 'active_kcal', label: 'Move', unit: 'kcal', colour: 'move', goal: 500, better: 'up' },
  distance_km:{ key: 'distance_km', label: 'Distance', unit: 'km', colour: 'move', goal: null, better: 'up' },
  exercise_min:{ key: 'exercise_min', label: 'Exercise', unit: 'min', colour: 'move', goal: 30, better: 'up' },
  flights:    { key: 'flights', label: 'Flights', unit: '', colour: 'move', goal: null, better: 'up' },
  hrv:        { key: 'hrv', label: 'HRV', unit: 'ms', colour: 'heart', goal: null, better: 'up' },
  body_fat:   { key: 'body_fat', label: 'Body fat', unit: '%', colour: 'body', goal: null, better: 'down' },
};

export const hhmm = (mins) => {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export function series(days, key, count = 30) {
  const byDay = {};
  days.forEach((d) => { if (d[key] !== null && d[key] !== undefined) byDay[d.on_date] = n(d[key]); });
  const out = [];
  const today = new Date(); today.setHours(12, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const iso = isoDay(new Date(today.getTime() - i * 86400000));
    out.push({ iso, value: byDay[iso] ?? null });
  }
  return out;
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export function healthReport(days) {
  const sorted = (days || []).slice().sort((a, b) => a.on_date.localeCompare(b.on_date));
  const today = isoDay(new Date());
  const latest = sorted[sorted.length - 1] || null;
  const todayRow = sorted.find((d) => d.on_date === today) || null;

  const window = (key, count) => sorted
    .slice(-count)
    .map((d) => n(d[key]))
    .filter((v) => v !== null && !Number.isNaN(v));

  const stat = (key) => {
    const recent = window(key, 30);
    const older = sorted.slice(-60, -30).map((d) => n(d[key])).filter((v) => v !== null);
    const cur = todayRow ? n(todayRow[key]) : null;
    const last = [...sorted].reverse().find((d) => n(d[key]) !== null);
    return {
      ...METRICS[key],
      today: cur,
      latest: last ? n(last[key]) : null,
      latestOn: last ? last.on_date : null,
      avg30: avg(recent),
      avg60: avg(older),
      change: avg(recent) !== null && avg(older) ? ((avg(recent) - avg(older)) / avg(older)) * 100 : null,
      best: recent.length ? Math.max(...recent) : null,
      low: recent.length ? Math.min(...recent) : null,
      count: recent.length,
    };
  };

  const stepDays = sorted.filter((d) => n(d.steps) !== null);
  const goalHits = stepDays.slice(-30).filter((d) => n(d.steps) >= 10000).length;

  // longest run of days meeting the step goal
  let run = 0, best = 0;
  stepDays.forEach((d) => {
    if (n(d.steps) >= 10000) { run++; best = Math.max(best, run); } else run = 0;
  });

  return {
    days: sorted,
    count: sorted.length,
    today: todayRow,
    latest,
    steps: stat('steps'),
    sleep: stat('sleep_min'),
    heart: stat('resting_hr'),
    weight: stat('weight_kg'),
    move: stat('active_kcal'),
    distance: stat('distance_km'),
    exercise: stat('exercise_min'),
    flights: stat('flights'),
    goalHits,
    goalRate: stepDays.slice(-30).length ? (goalHits / stepDays.slice(-30).length) * 100 : null,
    streak: run,
    bestStreak: best,
    weekday: [0,1,2,3,4,5,6].map((i) => {
      const vals = sorted
        .filter((d) => new Date(d.on_date + 'T12:00:00').getDay() === i)
        .map((d) => n(d.steps)).filter((v) => v !== null);
      return { day: i, avg: avg(vals), count: vals.length };
    }),
  };
}

/* ---------- experiments ---------- */
export function experimentState(exp, days, logs) {
  const start = new Date(exp.started_on + 'T12:00:00');
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const elapsed = Math.min(exp.days, Math.floor((today - start) / 86400000) + 1);
  const endDate = new Date(start.getTime() + (exp.days - 1) * 86400000);

  const byDate = {};
  (days || []).forEach((d) => { byDate[d.on_date] = d; });
  const logByDate = {};
  (logs || []).filter((l) => l.experiment_id === exp.id).forEach((l) => { logByDate[l.on_date] = l; });

  const meets = (value) => {
    if (value === null || value === undefined) return null;
    const t = Number(exp.target);
    if (exp.comparator === 'lte') return value <= t;
    if (exp.comparator === 'eq') return Math.abs(value - t) < 0.001;
    return value >= t;
  };

  const marks = [];
  for (let i = 0; i < exp.days; i++) {
    const iso = isoDay(new Date(start.getTime() + i * 86400000));
    const future = iso > isoDay(today);
    let kept = null;
    let value = null;

    if (exp.metric === 'manual') {
      const l = logByDate[iso];
      kept = l ? l.kept : null;
    } else {
      const row = byDate[iso];
      value = row ? n(row[exp.metric]) : null;
      kept = meets(value);
      const l = logByDate[iso];              // a manual tick overrides the reading
      if (l) kept = l.kept;
    }
    marks.push({ iso, kept, value, future, today: iso === isoDay(today) });
  }

  const done = marks.filter((m) => !m.future);
  const hits = done.filter((m) => m.kept === true).length;
  const misses = done.filter((m) => m.kept === false).length;
  const unknown = done.filter((m) => m.kept === null).length;

  let run = 0, bestRun = 0;
  done.forEach((m) => { if (m.kept) { run++; bestRun = Math.max(bestRun, run); } else if (m.kept === false) run = 0; });

  const remaining = exp.days - done.length;
  const missesLeft = Math.max(0, exp.allowed_misses - misses);
  const failed = misses > exp.allowed_misses;
  const rate = done.length ? (hits / done.length) * 100 : null;

  // where it lands if the current rate holds
  const projectedHits = hits + remaining * (rate === null ? 1 : rate / 100);
  const needed = exp.days - exp.allowed_misses;
  const status = failed ? 'failed'
    : remaining === 0 ? (hits >= needed ? 'passed' : 'failed')
      : projectedHits < needed ? 'at risk'
        : rate !== null && rate < 80 ? 'wobbling' : 'on track';

  const values = done.map((m) => m.value).filter((v) => v !== null);

  return {
    marks, done: done.length, hits, misses, unknown, remaining,
    rate, streak: run, bestStreak: bestRun,
    missesLeft, needed, status, failed,
    endDate, elapsed,
    average: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
    best: values.length ? Math.max(...values) : null,
    mustKeepAll: remaining > 0 && missesLeft === 0,
  };
}

// Did anything else move while this ran?
export function sideEffects(exp, days) {
  const start = exp.started_on;
  const before = (days || []).filter((d) => d.on_date < start).slice(-30);
  const during = (days || []).filter((d) => d.on_date >= start);
  const pick = ['resting_hr', 'sleep_min', 'weight_kg', 'steps', 'hrv'];

  return pick
    .filter((k) => k !== exp.metric)
    .map((k) => {
      const a = before.map((d) => n(d[k])).filter((v) => v !== null);
      const b = during.map((d) => n(d[k])).filter((v) => v !== null);
      if (a.length < 3 || b.length < 3) return null;
      const from = avg(a), to = avg(b);
      const delta = to - from;
      const m = METRICS[k];
      const better = m.better === 'up' ? delta > 0 : delta < 0;
      return { key: k, label: m.label, unit: m.unit, from, to, delta, better, colour: m.colour };
    })
    .filter(Boolean)
    .filter((x) => Math.abs(x.delta) > 0.01);
}

// How often you already meet a proposed rule — so nobody starts a doomed one.
export function feasibility(days, metric, comparator, target, lookback = 21) {
  if (metric === 'manual') return null;
  const recent = (days || []).slice(-lookback);
  const marks = recent.map((d) => {
    const v = n(d[metric]);
    if (v === null) return null;
    const t = Number(target);
    return comparator === 'lte' ? v <= t : comparator === 'eq' ? Math.abs(v - t) < 0.001 : v >= t;
  });
  const known = marks.filter((m) => m !== null);
  if (!known.length) return null;
  const hits = known.filter(Boolean).length;
  return { marks, days: known.length, hits, rate: (hits / known.length) * 100 };
}
