// Turns an experiment plus the days it covers into a verdict: how much has
// been kept, what is still possible, when it ends, and what else moved while
// it ran. All arithmetic — nothing is inferred beyond what the rules say.

import { byDate, isoDay, series, stats, METRICS } from './health.js';

const dayMs = 86400000;
const n = (x) => Number(x) || 0;

export const COMPARATORS = {
  gte: { id: 'gte', label: 'At least', test: (v, t) => v >= t },
  lte: { id: 'lte', label: 'At most',  test: (v, t) => v <= t },
  eq:  { id: 'eq',  label: 'Exactly',  test: (v, t) => Math.abs(v - t) < 0.001 },
};

export const EXP_METRICS = [
  { key: 'steps',        label: 'Steps',    unit: '' },
  { key: 'sleep_min',    label: 'Sleep',    unit: 'min' },
  { key: 'active_kcal',  label: 'Move',     unit: 'kcal' },
  { key: 'exercise_min', label: 'Exercise', unit: 'min' },
  { key: 'resting_hr',   label: 'Heart',    unit: 'bpm' },
  { key: 'weight_kg',    label: 'Weight',   unit: 'kg' },
  { key: 'manual',       label: 'Manual',   unit: '' },
];

const dateRange = (from, count) => {
  const out = [];
  const start = new Date(from + 'T12:00:00');
  for (let i = 0; i < count; i++) out.push(isoDay(new Date(start.getTime() + i * dayMs)));
  return out;
};

/* ---------- one experiment, fully evaluated ---------- */
export function evaluate(exp, days, logs) {
  const health = byDate(days);
  const logMap = Object.fromEntries(
    (logs || []).filter((l) => l.experiment_id === exp.id).map((l) => [l.on_date, l])
  );
  const cmp = COMPARATORS[exp.comparator] || COMPARATORS.gte;
  const dates = dateRange(exp.started_on, exp.days);
  const today = isoDay(new Date());

  const marks = dates.map((iso) => {
    const past = iso < today;
    const isToday = iso === today;

    if (exp.metric === 'manual') {
      const l = logMap[iso];
      return { iso, past, isToday, value: null,
        state: l ? (l.kept ? 'hit' : 'miss') : past ? 'miss' : isToday ? 'today' : 'future' };
    }

    const row = health[iso];
    const v = row ? row[exp.metric] : null;
    if (v === null || v === undefined) {
      return { iso, past, isToday, value: null, state: past ? 'nodata' : isToday ? 'today' : 'future' };
    }
    const ok = cmp.test(Number(v), Number(exp.target));
    // within 10% of the target reads as "close" rather than a flat miss
    const near = !ok && Math.abs(Number(v) - Number(exp.target)) / Math.max(1, Number(exp.target)) < 0.1;
    return { iso, past, isToday, value: Number(v),
      state: ok ? 'hit' : near ? 'near' : 'miss' };
  });

  const decided = marks.filter((m) => m.past && m.state !== 'nodata' && m.state !== 'future');
  const hits = decided.filter((m) => m.state === 'hit').length;
  const misses = decided.filter((m) => m.state === 'miss' || m.state === 'near').length;
  const elapsed = decided.length;
  const adherence = elapsed ? (hits / elapsed) * 100 : null;

  // longest run, and the run still going
  let best = 0, run = 0;
  marks.forEach((m) => {
    if (m.state === 'hit') { run++; best = Math.max(best, run); } else if (m.past) run = 0;
  });
  let current = 0;
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (m.state === 'future' || m.state === 'today') continue;
    if (m.state === 'hit') current++; else break;
  }

  const endDate = new Date(new Date(exp.started_on + 'T12:00:00').getTime() + (exp.days - 1) * dayMs);
  const daysLeft = Math.max(0, Math.ceil((endDate - new Date()) / dayMs));
  const finished = daysLeft === 0 && elapsed >= exp.days - 1;

  // what is still mathematically possible
  const allowed = n(exp.allowed_misses);
  const missesLeft = allowed - misses;
  const remaining = exp.days - elapsed;
  const status =
    finished ? (misses <= allowed ? 'done' : 'failed')
      : missesLeft < 0 ? 'failed'
        : missesLeft === 0 ? 'perfect'
          : missesLeft <= 1 ? 'risk'
            : adherence !== null && adherence < 60 ? 'risk' : 'on';

  const values = marks.map((m) => m.value).filter((v) => v !== null);
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

  return {
    exp, marks, dates, hits, misses, elapsed, adherence,
    bestStreak: best, streak: current,
    daysLeft, endDate, finished, status,
    missesLeft, remaining,
    needsAll: missesLeft === 0 && remaining > 0,
    average: avg,
    best: values.length ? Math.max(...values) : null,
    worst: values.length ? Math.min(...values) : null,
  };
}

/* ---------- did anything else move while it ran? ---------- */
export function sideEffects(exp, days) {
  const start = exp.started_on;
  const before = (days || []).filter((d) => d.on_date < start);
  const during = (days || []).filter((d) => d.on_date >= start);
  if (before.length < 5 || during.length < 5) return [];

  const watch = ['resting_hr', 'sleep_min', 'weight_kg', 'steps', 'hrv'];
  return watch
    .filter((m) => m !== exp.metric)
    .map((m) => {
      const b = stats(before.map((d) => d[m] === null ? null : Number(d[m])));
      const a = stats(during.map((d) => d[m] === null ? null : Number(d[m])));
      if (b.avg === null || a.avg === null) return null;
      const delta = a.avg - b.avg;
      const meta = METRICS[m];
      const better = meta.dir === 'up' ? delta > 0 : delta < 0;
      return { metric: m, label: meta.label, unit: meta.unit,
        before: b.avg, after: a.avg, delta, better,
        pct: b.avg !== 0 ? (delta / b.avg) * 100 : null };
    })
    .filter(Boolean)
    .filter((x) => Math.abs(x.pct ?? 0) > 1.5)
    .sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0));
}

/* ---------- how hard would this be, judged on your own history? ---------- */
export function feasibility({ metric, comparator, target, days, window = 21, allowed = 0, length = 30 }) {
  if (metric === 'manual' || !target) return null;
  const cmp = COMPARATORS[comparator] || COMPARATORS.gte;
  const s = series(days, metric, window).filter((d) => d.value !== null);
  if (s.length < 5) return { known: false };

  const hits = s.filter((d) => cmp.test(d.value, Number(target)));
  const rate = hits.length / s.length;
  const marks = s.map((d) => cmp.test(d.value, Number(target)));

  // at that rate, when would the allowed misses run out?
  const missRate = 1 - rate;
  const breakDay = missRate > 0 ? Math.ceil((allowed + 1) / missRate) : null;

  // a target you would have hit on about three quarters of days
  const vals = s.map((d) => d.value).sort((a, b) => a - b);
  const idx = cmp.id === 'lte' ? Math.floor(vals.length * 0.75) : Math.floor(vals.length * 0.25);
  const fairer = vals[Math.max(0, Math.min(vals.length - 1, idx))];

  return {
    known: true, rate, hits: hits.length, of: s.length, marks,
    breakDay: breakDay && breakDay <= length ? breakDay : null,
    fairer,
    verdict: rate >= 0.8 ? 'easy' : rate >= 0.55 ? 'fair' : rate >= 0.3 ? 'hard' : 'unrealistic',
  };
}

/* ---------- a sentence about when the pattern breaks ---------- */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function weakestDay(result) {
  const byDay = DAYS.map((name, i) => ({ name, i, hit: 0, total: 0 }));
  result.marks.forEach((m) => {
    if (m.state === 'future' || m.state === 'today' || m.state === 'nodata') return;
    const d = new Date(m.iso + 'T12:00:00').getDay();
    byDay[d].total++;
    if (m.state === 'hit') byDay[d].hit++;
  });
  const seen = byDay.filter((d) => d.total >= 2);
  if (seen.length < 3) return null;
  const worst = seen.slice().sort((a, b) => (a.hit / a.total) - (b.hit / b.total))[0];
  if (worst.hit === worst.total) return null;
  return { ...worst, rate: worst.hit / worst.total };
}
