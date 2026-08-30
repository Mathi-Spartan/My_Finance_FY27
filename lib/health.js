// Everything the health screens need, derived from one row per day.

const n = (x) => (x === null || x === undefined ? null : Number(x));
const dayMs = 86400000;

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
export const todayIso = () => isoDay(new Date());

export const METRICS = {
  steps:       { key: 'steps',       label: 'Steps',          unit: '',     colour: 'move',  goal: 10000, dir: 'up' },
  sleep_min:   { key: 'sleep_min',   label: 'Sleep',          unit: 'min',  colour: 'sleep', goal: 420,   dir: 'up' },
  resting_hr:  { key: 'resting_hr',  label: 'Resting heart',  unit: 'bpm',  colour: 'heart', goal: 60,    dir: 'down' },
  weight_kg:   { key: 'weight_kg',   label: 'Weight',         unit: 'kg',   colour: 'body',  goal: null,  dir: 'down' },
  active_kcal: { key: 'active_kcal', label: 'Move',           unit: 'kcal', colour: 'move',  goal: 500,   dir: 'up' },
  distance_km: { key: 'distance_km', label: 'Distance',       unit: 'km',   colour: 'move',  goal: null,  dir: 'up' },
  exercise_min:{ key: 'exercise_min',label: 'Exercise',       unit: 'min',  colour: 'move',  goal: 30,    dir: 'up' },
  flights:     { key: 'flights',     label: 'Flights',        unit: '',     colour: 'move',  goal: null,  dir: 'up' },
  hrv:         { key: 'hrv',         label: 'HRV',            unit: 'ms',   colour: 'heart', goal: null,  dir: 'up' },
};

export const hhmm = (mins) => {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const byDate = (days) =>
  Object.fromEntries((days || []).map((d) => [d.on_date, d]));

// a continuous series for one metric, gaps left as null so charts break
export function series(days, metric, len = 30, end = new Date()) {
  const map = byDate(days);
  const out = [];
  for (let i = len - 1; i >= 0; i--) {
    const iso = isoDay(new Date(end.getTime() - i * dayMs));
    const row = map[iso];
    out.push({ iso, value: row ? n(row[metric]) : null });
  }
  return out;
}

const clean = (a) => a.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

export function stats(values) {
  const a = clean(values);
  if (!a.length) return { count: 0, avg: null, min: null, max: null, last: null };
  const sum = a.reduce((s, v) => s + v, 0);
  return {
    count: a.length,
    avg: sum / a.length,
    min: Math.min(...a),
    max: Math.max(...a),
    last: a[a.length - 1],
    total: sum,
  };
}

// this window against the one before it
export function compare(days, metric, len = 30) {
  const now = series(days, metric, len).map((d) => d.value);
  const then = series(days, metric, len, new Date(Date.now() - len * dayMs)).map((d) => d.value);
  const a = stats(now), b = stats(then);
  if (a.avg === null || b.avg === null) return { now: a, then: b, delta: null, pct: null };
  const delta = a.avg - b.avg;
  return { now: a, then: b, delta, pct: b.avg !== 0 ? (delta / b.avg) * 100 : null };
}

// the hour-by-hour shape of a day, when the sync provides it
export function hourly(row) {
  if (!row || !row.hours) return null;
  try { return typeof row.hours === 'string' ? JSON.parse(row.hours) : row.hours; }
  catch { return null; }
}

export function today(days) {
  const map = byDate(days);
  return map[todayIso()] || null;
}

export function streakOf(days, metric, test) {
  const map = byDate(days);
  let run = 0;
  for (let i = 0; i < 400; i++) {
    const iso = isoDay(new Date(Date.now() - i * dayMs));
    const row = map[iso];
    const v = row ? n(row[metric]) : null;
    if (v === null) { if (i === 0) continue; break; }
    if (!test(v)) break;
    run++;
  }
  return run;
}

// one sentence about the day, chosen from what the numbers actually say
export function standoutHealth(days) {
  const t = today(days);
  const s = compare(days, 'steps', 14);
  const sl = compare(days, 'sleep_min', 14);

  if (!days || !days.length) {
    return { headline: 'Nothing synced yet', detail: 'Run the shortcut on your phone and this fills in.' };
  }
  if (t && t.steps !== null && t.steps !== undefined) {
    const goal = METRICS.steps.goal;
    if (t.steps >= goal) {
      return { headline: 'Target met', detail: `${t.steps.toLocaleString('en-IN')} steps today, ${(t.steps - goal).toLocaleString('en-IN')} past the goal.` };
    }
    const left = goal - t.steps;
    const mins = Math.round(left / 90);
    return { headline: `${left.toLocaleString('en-IN')} steps to go`, detail: `About ${mins} minutes of walking would close it.` };
  }
  if (sl.pct !== null && Math.abs(sl.pct) > 6) {
    return {
      headline: sl.pct > 0 ? 'Sleeping more lately' : 'Sleeping less lately',
      detail: `${hhmm(sl.now.avg)} a night against ${hhmm(sl.then.avg)} in the fortnight before.`,
    };
  }
  if (s.pct !== null) {
    return { headline: 'Holding steady', detail: `${Math.round(s.now.avg).toLocaleString('en-IN')} steps a day over the last fortnight.` };
  }
  return { headline: 'Building a picture', detail: 'A few more days of data and the comparisons start working.' };
}
