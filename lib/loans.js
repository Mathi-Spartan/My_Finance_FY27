// Debt maths. Kept separate from the UI so it can be checked on its own.

const n = (x) => Number(x) || 0;

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// The EMI date for a given month, clamped so the 31st still works in February.
export function dueDateFor(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

// Every EMI date from the loan's start up to `monthsAhead` from today.
export function schedule(loan, monthsAhead = 3) {
  const out = [];
  const start = loan.start_date ? new Date(loan.start_date + 'T12:00:00') : new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + monthsAhead);

  let y = start.getFullYear();
  let m = start.getMonth();
  for (let i = 0; i < 480; i++) {           // 40 years is plenty
    const d = dueDateFor(y, m, loan.emi_day || 5);
    if (d > end) break;
    if (d >= start || i === 0) out.push(isoDay(d));
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

// How many EMIs are left, given the balance, the payment and the rate.
// Returns null when the payment can never clear the interest.
export function monthsToClear(outstanding, emi, annualRate) {
  const P = n(outstanding);
  const E = n(emi);
  if (P <= 0) return 0;
  if (E <= 0) return null;

  const r = n(annualRate) / 12 / 100;
  if (r === 0) return Math.ceil(P / E);

  const monthlyInterest = P * r;
  if (E <= monthlyInterest) return null;    // the balance never falls

  return Math.ceil(-Math.log(1 - (P * r) / E) / Math.log(1 + r));
}

// Interest still to pay if nothing changes.
export function interestRemaining(outstanding, emi, annualRate) {
  const months = monthsToClear(outstanding, emi, annualRate);
  if (months === null) return null;
  if (n(annualRate) === 0) return 0;
  // the final instalment is usually a part payment, so this is close, not exact
  return Math.max(0, n(emi) * months - n(outstanding));
}

export function payoffDate(outstanding, emi, annualRate, from = new Date()) {
  const months = monthsToClear(outstanding, emi, annualRate);
  if (months === null) return null;
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

// This month's split between interest and principal.
export function splitThisMonth(outstanding, emi, annualRate) {
  const r = n(annualRate) / 12 / 100;
  const interest = Math.min(n(emi), n(outstanding) * r);
  return { interest, principal: Math.max(0, n(emi) - interest) };
}

export function loanReport(loans, payments, opts = {}) {
  const live = (loans || []).filter((l) => !l.closed);
  const paidKeys = new Set((payments || []).filter((p) => p.paid).map((p) => `${p.loan_id}|${p.due_date}`));
  const today = new Date();
  const todayIso = isoDay(today);

  const rows = live.map((l) => {
    const months = monthsToClear(l.outstanding, l.emi_amount, l.rate);
    const interest = interestRemaining(l.outstanding, l.emi_amount, l.rate);
    const payoff = payoffDate(l.outstanding, l.emi_amount, l.rate);
    const split = splitThisMonth(l.outstanding, l.emi_amount, l.rate);

    const due = schedule(l, 2);
    const overdue = due.filter((d) => d < todayIso && !paidKeys.has(`${l.id}|${d}`));
    const upcoming = due.filter((d) => d >= todayIso && !paidKeys.has(`${l.id}|${d}`));
    const nextDue = upcoming[0] || null;
    const paidCount = due.filter((d) => paidKeys.has(`${l.id}|${d}`)).length;

    const cleared = n(l.principal) > 0 ? Math.max(0, n(l.principal) - n(l.outstanding)) : 0;
    const progress = n(l.principal) > 0 ? (cleared / n(l.principal)) * 100 : 0;

    return {
      ...l,
      months, interest, payoff, split,
      nextDue,
      overdue,
      paidCount,
      cleared,
      progress,
      neverClears: months === null,
      daysToNext: nextDue ? Math.round((new Date(nextDue + 'T12:00:00') - today) / 86400000) : null,
    };
  });

  const totalOutstanding = rows.reduce((s, l) => s + n(l.outstanding), 0);
  const totalEmi = rows.reduce((s, l) => s + n(l.emi_amount), 0);
  const totalPrincipal = rows.reduce((s, l) => s + n(l.principal), 0);
  const totalInterest = rows.reduce((s, l) => s + (l.interest === null ? 0 : l.interest), 0);
  const anyNeverClears = rows.some((l) => l.neverClears);
  const monthlyInterest = rows.reduce((s, l) => s + l.split.interest, 0);

  const dated = rows.filter((l) => l.payoff).map((l) => l.payoff);
  const debtFree = dated.length && dated.length === rows.length
    ? new Date(Math.max(...dated.map((d) => +d)))
    : null;

  // Highest rate first is the cheapest order to clear debt in.
  const prepayOrder = rows.slice().sort((a, b) => n(b.rate) - n(a.rate));

  const income = n(opts.monthlyIncome);
  return {
    rows,
    count: rows.length,
    totalOutstanding,
    totalEmi,
    totalPrincipal,
    totalInterest,
    totalCleared: Math.max(0, totalPrincipal - totalOutstanding),
    progress: totalPrincipal > 0 ? ((totalPrincipal - totalOutstanding) / totalPrincipal) * 100 : 0,
    monthlyInterest,
    anyNeverClears,
    debtFree,
    prepayOrder,
    overdueCount: rows.reduce((s, l) => s + l.overdue.length, 0),
    nextUp: rows.filter((l) => l.nextDue).sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0] || null,
    emiToIncome: income > 0 ? (totalEmi / income) * 100 : null,
  };
}
