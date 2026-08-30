// Two cards' worth of thinking. Nothing here is generated or guessed — every
// line is arithmetic over what is already in the app, so if a figure appears
// it can be traced back to a row you entered.

import { schedule, isoDay } from './loans';

const n = (x) => Number(x) || 0;
const dayMs = 86400000;

/* ---------- what is due next ---------- */
export function upcoming({ loans = [], loanPayments = [], appointments = [], salary = [] }, limit = 5) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = isoDay(today);
  const paid = new Set(loanPayments.filter((p) => p.paid).map((p) => `${p.loan_id}|${p.due_date}`));
  const out = [];

  loans.filter((l) => !l.closed).forEach((l) => {
    schedule(l, 2)
      .filter((d) => d >= todayIso && !paid.has(`${l.id}|${d}`))
      .slice(0, 2)
      .forEach((d) => out.push({
        kind: 'emi', title: l.lender_name, sub: 'EMI due',
        amount: n(l.emi_amount), iso: d,
      }));
  });

  appointments
    .filter((a) => a.on_date >= todayIso && a.status === 'planned')
    .slice(0, 4)
    .forEach((a) => out.push({
      kind: 'session', title: a.therapy, sub: `Paari · ${a.slot || 'session'}`,
      amount: n(a.amount), iso: a.on_date,
    }));

  // salary lands on roughly the same day each month
  if (salary.length) {
    const days = salary.map((s) => new Date(s.credited_on + 'T12:00:00').getDate());
    const usual = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
    const amt = salary.reduce((s, r) => s + n(r.amount), 0) / salary.length;
    const next = new Date(today.getFullYear(), today.getMonth(), usual);
    if (next < today) next.setMonth(next.getMonth() + 1);
    out.push({ kind: 'salary', title: 'Salary', sub: 'usually around this day', amount: amt, iso: isoDay(next) });
  }

  return out
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(0, limit)
    .map((x) => {
      const d = new Date(x.iso + 'T12:00:00');
      const days = Math.round((d - today) / dayMs);
      return {
        ...x, days,
        when: days === 0 ? 'Today' : days === 1 ? 'Tomorrow'
          : days < 7 ? `In ${days} days`
            : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      };
    });
}

/* ---------- the one thing worth saying about this month ---------- */
export function standout({ txs = [], appointments = [], loans = [], accounts = [] }) {
  const now = new Date();
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const outOf = (key) => txs
    .filter((t) => t.direction === 'out' && String(t.occurred_at).slice(0, 7) === key)
    .reduce((s, t) => s + n(t.amount), 0);

  const thisOut = outOf(thisKey);
  const lastOut = outOf(prevKey);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = (dayOfMonth / daysInMonth) * 100;

  // spending against where the month has got to
  const paceRatio = lastOut > 0 ? (thisOut / lastOut) * 100 : null;
  const projected = dayOfMonth > 0 ? (thisOut / dayOfMonth) * daysInMonth : 0;

  let headline, detail;
  if (thisOut === 0) {
    headline = 'Nothing recorded this month yet';
    detail = 'Add an entry and this starts tracking against last month.';
  } else if (lastOut > 0 && projected < lastOut * 0.9) {
    headline = 'Spending less than last month';
    detail = `On track for ${fmt(projected)} against ${fmt(lastOut)} last month — about ${Math.round((1 - projected / lastOut) * 100)}% lower.`;
  } else if (lastOut > 0 && projected > lastOut * 1.1) {
    headline = 'Ahead of last month';
    detail = `On track for ${fmt(projected)} against ${fmt(lastOut)} — roughly ${Math.round((projected / lastOut - 1) * 100)}% more.`;
  } else if (lastOut > 0) {
    headline = 'Holding steady';
    detail = `On track for ${fmt(projected)}, close to last month's ${fmt(lastOut)}.`;
  } else {
    headline = `${fmt(thisOut)} out so far`;
    detail = `Day ${dayOfMonth} of ${daysInMonth}. On track for ${fmt(projected)}.`;
  }

  const unmarked = appointments.filter((a) => a.status === 'planned' && a.on_date < isoDay(now)).length;
  if (unmarked > 0) {
    detail += ` ${unmarked} therapy ${unmarked === 1 ? 'session is' : 'sessions are'} still unmarked.`;
  }

  return { headline, detail, monthProgress, paceRatio, thisOut, lastOut, projected, dayOfMonth, daysInMonth };
}

const fmt = (v) => '₹' + Math.round(v).toLocaleString('en-IN');
