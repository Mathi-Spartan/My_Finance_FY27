// All money maths lives here so the screens stay dumb.

export const rupees = (n, opts = {}) => {
  const v = Math.abs(Number(n) || 0);
  const s = v.toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  });
  return '₹' + s;
};

export const compact = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'k';
  return '₹' + v.toFixed(0);
};

export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
export const daysInMonth = (d = new Date()) => endOfMonth(d).getDate();
export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

export const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (isoDay(d) === isoDay(today)) return 'Today';
  if (isoDay(d) === isoDay(y)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

const num = (x) => Number(x) || 0;

// ---------- account balances ----------
export function accountBalances(accounts, txs) {
  const map = {};
  accounts.forEach((a) => (map[a.id] = num(a.opening)));
  txs.forEach((t) => {
    if (t.direction === 'in') map[t.account_id] = (map[t.account_id] || 0) + num(t.amount);
    else if (t.direction === 'out') map[t.account_id] = (map[t.account_id] || 0) - num(t.amount);
    else if (t.direction === 'transfer') {
      map[t.account_id] = (map[t.account_id] || 0) - num(t.amount);
      if (t.transfer_to) map[t.transfer_to] = (map[t.transfer_to] || 0) + num(t.amount);
    }
  });
  return map;
}

export const totalCash = (accounts, txs) => {
  const b = accountBalances(accounts, txs);
  return accounts.filter((a) => !a.archived && a.kind !== 'card')
    .reduce((s, a) => s + (b[a.id] || 0), 0);
};

// ---------- the number that matters ----------
// Safe to spend today = (cash on hand − commitments still due this month
//                        − savings target still owed) ÷ days left
export function safeToSpend({ accounts, txs, recurring, settings, context }) {
  const now = new Date();
  const dim = daysInMonth(now);
  const daysLeft = dim - now.getDate() + 1;
  const scoped = context ? txs.filter((t) => t.context === context) : txs;

  const cash = totalCash(accounts, txs);          // cash is shared across contexts
  const { in: earned, out: spent } = monthTotals(scoped);

  // What this month is allowed to consume. Prefer the stated salary, fall back
  // to what actually arrived, and only then to the balance in the accounts.
  const stated = num(settings?.monthly_income);
  const basis = stated > 0 ? stated : earned > 0 ? earned : cash + spent;

  // Commitments that haven't left the account yet this month
  const dueLater = (recurring || [])
    .filter((r) => r.status === 'tracked' && r.direction === 'out' && r.day_of_month >= now.getDate())
    .reduce((s, r) => s + num(r.amount), 0);

  // Savings still owed against this month's target
  const target = num(settings?.savings_target);
  const savingsOwed = Math.max(0, target - Math.max(0, earned - spent));

  // Never offer more than the money actually sitting in the accounts.
  const pool = Math.min(basis - spent - dueLater - savingsOwed, cash - dueLater);

  return {
    perDay: pool / Math.max(1, daysLeft),
    pool, daysLeft, cash, basis, spent, earned, dueLater, savingsOwed,
  };
}

// how long the cash lasts at the current burn rate
export function runway({ accounts, txs, recurring }) {
  const cash = totalCash(accounts, txs);
  const burn = burnRate(txs).perDay;
  const committedPerDay =
    (recurring || []).filter((r) => r.status === 'tracked' && r.direction === 'out')
      .reduce((s, r) => s + num(r.amount), 0) / 30;
  const daily = burn + committedPerDay;
  if (daily <= 0) return { days: null, date: null };
  const days = Math.floor(cash / daily);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return { days, date };
}

export function monthTotals(txs, ref = new Date()) {
  const s = startOfMonth(ref), e = endOfMonth(ref);
  let inn = 0, out = 0;
  txs.forEach((t) => {
    const d = new Date(t.occurred_at);
    if (d < s || d > e) return;
    if (t.direction === 'in') inn += num(t.amount);
    if (t.direction === 'out') out += num(t.amount);
  });
  return { in: inn, out };
}

// daily spend for the current month, index 0 = 1st
export function dailySpend(txs, ref = new Date()) {
  const dim = daysInMonth(ref);
  const arr = new Array(dim).fill(0);
  const s = startOfMonth(ref), e = endOfMonth(ref);
  txs.forEach((t) => {
    if (t.direction !== 'out') return;
    const d = new Date(t.occurred_at);
    if (d < s || d > e) return;
    arr[d.getDate() - 1] += num(t.amount);
  });
  return arr;
}

export function burnRate(txs, days = 30) {
  const cut = new Date();
  cut.setDate(cut.getDate() - days);
  const spent = txs
    .filter((t) => t.direction === 'out' && new Date(t.occurred_at) >= cut)
    .reduce((s, t) => s + num(t.amount), 0);
  return { total: spent, perDay: spent / days };
}

// ---------- category drift vs the user's own 3-month average ----------
export function categoryDrift(txs, categories, ref = new Date()) {
  const thisStart = startOfMonth(ref);
  const prevStart = new Date(ref.getFullYear(), ref.getMonth() - 3, 1);

  const cur = {}, prior = {}, counts = {};
  txs.forEach((t) => {
    if (t.direction !== 'out' || !t.category_id) return;
    const d = new Date(t.occurred_at);
    if (d >= thisStart) {
      cur[t.category_id] = (cur[t.category_id] || 0) + num(t.amount);
      counts[t.category_id] = (counts[t.category_id] || 0) + 1;
    } else if (d >= prevStart) {
      prior[t.category_id] = (prior[t.category_id] || 0) + num(t.amount);
    }
  });

  return Object.keys(cur)
    .map((id) => {
      const cat = categories.find((c) => c.id === id);
      const avg = (prior[id] || 0) / 3;
      const spent = cur[id];
      const pct = avg > 0 ? Math.round(((spent - avg) / avg) * 100) : null;
      return { id, name: cat?.name || 'Uncategorised', color: cat?.color || 'slate',
               spent, avg, pct, count: counts[id], budget: num(cat?.budget) };
    })
    .sort((a, b) => b.spent - a.spent);
}

export function topMerchants(txs, ref = new Date(), limit = 5) {
  const s = startOfMonth(ref);
  const m = {};
  txs.forEach((t) => {
    if (t.direction !== 'out' || new Date(t.occurred_at) < s) return;
    const key = (t.merchant || 'Unnamed').trim();
    if (!m[key]) m[key] = { name: key, total: 0, count: 0 };
    m[key].total += num(t.amount);
    m[key].count += 1;
  });
  return Object.values(m).sort((a, b) => b.total - a.total).slice(0, limit);
}

// merchants ranked by how often you use them — powers the recall chips
export function frequentMerchants(txs, direction = 'out', limit = 6) {
  const m = {};
  txs.forEach((t) => {
    if (t.direction !== direction) return;
    const key = (t.merchant || '').trim();
    if (!key) return;
    if (!m[key]) m[key] = { name: key, count: 0, last: t.occurred_at, category_id: t.category_id, account_id: t.account_id };
    m[key].count += 1;
    if (new Date(t.occurred_at) > new Date(m[key].last)) {
      m[key].last = t.occurred_at;
      m[key].category_id = t.category_id;
      m[key].account_id = t.account_id;
    }
  });
  return Object.values(m).sort((a, b) => b.count - a.count).slice(0, limit);
}

// ---------- pattern detection ----------
// A merchant charged in 3+ distinct months, at a steady amount, that isn't
// already tracked, is almost certainly a subscription.
export function detectRecurring(txs, recurring) {
  const known = new Set((recurring || []).map((r) => r.name.toLowerCase().trim()));
  const groups = {};

  txs.forEach((t) => {
    if (t.direction !== 'out') return;
    const key = (t.merchant || '').trim().toLowerCase();
    if (!key || known.has(key)) return;
    (groups[key] = groups[key] || []).push(t);
  });

  const found = [];
  Object.entries(groups).forEach(([key, list]) => {
    const months = new Set(list.map((t) => new Date(t.occurred_at).toISOString().slice(0, 7)));
    if (months.size < 3) return;
    const amounts = list.map((t) => num(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const spread = Math.max(...amounts) - Math.min(...amounts);
    if (avg === 0 || spread / avg > 0.15) return; // amount must be steady
    const days = list.map((t) => new Date(t.occurred_at).getDate());
    const day = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    found.push({
      key,
      name: list[list.length - 1].merchant,
      amount: Math.round(avg * 100) / 100,
      day_of_month: Math.min(28, day),
      months: months.size,
      category_id: list[0].category_id,
      account_id: list[0].account_id,
    });
  });
  return found.sort((a, b) => b.amount - a.amount);
}

// tracked commitments you're paying but no longer using
export function dormant(recurring, txs, months = 3) {
  const cut = new Date();
  cut.setMonth(cut.getMonth() - months);
  return (recurring || [])
    .filter((r) => r.status === 'tracked' && r.direction === 'out')
    .map((r) => {
      const hits = txs.filter(
        (t) => (t.merchant || '').toLowerCase().trim() === r.name.toLowerCase().trim()
      );
      const last = hits.length ? new Date(Math.max(...hits.map((t) => +new Date(t.occurred_at)))) : null;
      const paid = hits.reduce((s, t) => s + num(t.amount), 0);
      return { ...r, lastUsed: last, paid, hits: hits.length };
    })
    // Only a commitment we have actually seen going out, and haven't seen
    // lately, counts as dormant. Never-seen ones are usually standing orders
    // that simply don't appear as entries — flagging those would be noise.
    .filter((r) => r.hits > 0 && r.lastUsed && r.lastUsed < cut);
}

// next N days of tracked commitments
export function upcoming(recurring, days = 14) {
  const now = new Date();
  const out = [];
  (recurring || []).filter((r) => r.status === 'tracked').forEach((r) => {
    for (let m = 0; m < 2; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, r.day_of_month);
      const diff = Math.ceil((d - now) / 86400000);
      if (diff >= 0 && diff <= days) out.push({ ...r, due: d, inDays: diff });
    }
  });
  return out.sort((a, b) => a.due - b.due);
}

export const committedMonthly = (recurring) =>
  (recurring || []).filter((r) => r.status === 'tracked' && r.direction === 'out')
    .reduce((s, r) => s + num(r.amount), 0);

export const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const colorOf = (key) => {
  const list = ['violet', 'blue', 'green', 'amber', 'red', 'slate'];
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return list[h % list.length];
};

// ---------- CSV ----------
export function toCSV(txs, accounts, categories) {
  const a = Object.fromEntries(accounts.map((x) => [x.id, x.name]));
  const c = Object.fromEntries(categories.map((x) => [x.id, x.name]));
  const head = ['date', 'time', 'merchant', 'direction', 'amount', 'category', 'account', 'context', 'note'];
  const rows = txs.map((t) => [
    isoDay(t.occurred_at),
    timeLabel(t.occurred_at),
    t.merchant,
    t.direction,
    num(t.amount).toFixed(2),
    c[t.category_id] || '',
    a[t.account_id] || '',
    t.context,
    (t.note || '').replace(/"/g, "'"),
  ]);
  return [head, ...rows]
    .map((r) => r.map((f) => `"${String(f ?? '')}"`).join(','))
    .join('\n');
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const split = (line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).filter(Boolean).map((l) => {
    const cells = split(l);
    const o = {};
    head.forEach((h, i) => (o[h] = cells[i]));
    return o;
  });
}

/* ============================================================
   SIMPLE MODEL — money in, money out, and what it says
   ============================================================ */

const n2 = (x) => Number(x) || 0;

export function totals(txs, ref = new Date()) {
  const s = startOfMonth(ref), e = endOfMonth(ref);
  let inn = 0, out = 0, count = 0;
  txs.forEach((t) => {
    const d = new Date(t.occurred_at);
    if (d < s || d > e) return;
    if (t.direction === 'in') { inn += n2(t.amount); count++; }
    if (t.direction === 'out') { out += n2(t.amount); count++; }
  });
  return { in: inn, out, net: inn - out, count };
}

export function lastMonthTotals(txs) {
  const d = new Date();
  return totals(txs, new Date(d.getFullYear(), d.getMonth() - 1, 15));
}

// Where the money went: share of spend by category.
export function whereItWent(txs, categories, ref = new Date()) {
  const s = startOfMonth(ref), e = endOfMonth(ref);
  const by = {};
  let total = 0;
  txs.forEach((t) => {
    if (t.direction !== 'out') return;
    const d = new Date(t.occurred_at);
    if (d < s || d > e) return;
    const id = t.category_id || 'none';
    if (!by[id]) by[id] = { id, total: 0, count: 0 };
    by[id].total += n2(t.amount);
    by[id].count++;
    total += n2(t.amount);
  });
  return Object.values(by)
    .map((r) => ({
      ...r,
      name: categories.find((c) => c.id === r.id)?.name || 'Uncategorised',
      share: total > 0 ? (r.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// Which categories moved most against last month.
export function biggestChanges(txs, categories) {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const a = whereItWent(txs, categories, now);
  const b = whereItWent(txs, categories, prev);
  const prevBy = Object.fromEntries(b.map((r) => [r.id, r.total]));
  return a
    .map((r) => {
      const was = prevBy[r.id] || 0;
      const diff = r.total - was;
      const pct = was > 0 ? Math.round((diff / was) * 100) : null;
      return { ...r, was, diff, pct };
    })
    .filter((r) => Math.abs(r.diff) > 0)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

// Which weekday costs the most, and the daily average.
export function spendingRhythm(txs, days = 60) {
  const cut = new Date();
  cut.setDate(cut.getDate() - days);
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let total = 0, count = 0;
  txs.forEach((t) => {
    if (t.direction !== 'out') return;
    const d = new Date(t.occurred_at);
    if (d < cut) return;
    byDow[d.getDay()] += n2(t.amount);
    total += n2(t.amount);
    count++;
  });
  const peak = byDow.indexOf(Math.max(...byDow));
  return {
    perDay: total / days,
    perEntry: count ? total / count : 0,
    count,
    total,
    peakDay: Math.max(...byDow) > 0 ? names[peak] : null,
    peakAmount: byDow[peak],
    byDow,
  };
}

// Anything paid to the same name three or more times.
export function repeatPayments(txs) {
  const by = {};
  txs.forEach((t) => {
    if (t.direction !== 'out') return;
    const k = (t.merchant || '').trim().toLowerCase();
    if (!k) return;
    (by[k] = by[k] || []).push(t);
  });
  return Object.values(by)
    .filter((list) => list.length >= 3)
    .map((list) => {
      const amounts = list.map((t) => n2(t.amount));
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const spread = Math.max(...amounts) - Math.min(...amounts);
      return {
        name: list[list.length - 1].merchant,
        times: list.length,
        avg,
        total: amounts.reduce((a, b) => a + b, 0),
        steady: avg > 0 && spread / avg < 0.2,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// Money in and out per account for a month.
export function accountFlow(txs, ref = new Date()) {
  const s = startOfMonth(ref), e = endOfMonth(ref);
  const m = {};
  txs.forEach((t) => {
    const d = new Date(t.occurred_at);
    if (d < s || d > e) return;
    const id = t.account_id;
    if (!id) return;
    if (!m[id]) m[id] = { in: 0, out: 0 };
    if (t.direction === 'in') m[id].in += n2(t.amount);
    if (t.direction === 'out') m[id].out += n2(t.amount);
    if (t.direction === 'transfer') {
      m[id].out += n2(t.amount);
      if (t.transfer_to) {
        if (!m[t.transfer_to]) m[t.transfer_to] = { in: 0, out: 0 };
        m[t.transfer_to].in += n2(t.amount);
      }
    }
  });
  return m;
}

// "Axis Bank — Salary" -> { title, sub }
export function splitName(name) {
  const parts = String(name || '').split('—');
  return { title: (parts[0] || '').trim(), sub: (parts[1] || '').trim() };
}

// Credit card view: what's owed, what's left to spend.
export function cardStatus(account, balances) {
  const limit = n2(account.credit_limit);
  const bal = n2(balances[account.id]);        // negative once you've spent
  const owed = Math.max(0, -bal);
  const available = Math.max(0, limit - owed);
  const used = limit > 0 ? Math.min(100, (owed / limit) * 100) : 0;
  return { limit, owed, available, used };
}

export const isCard = (a) => a?.kind === 'card';
export const isCash = (a) => a?.kind === 'cash';

// Show paise only when there are any — ₹540.75 stays exact, ₹7,600 stays clean.
export const money = (n) => {
  const v = Number(n) || 0;
  const hasPaise = Math.round(Math.abs(v) * 100) % 100 !== 0;
  return rupees(v, { decimals: hasPaise });
};

/* ---------- period helpers for the entries screen ---------- */
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
export const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
export const startOfWeek = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
export const endOfWeek   = (d) => { const x = startOfWeek(d); x.setDate(x.getDate() + 6); return endOfDay(x); };

export function rangeOf(mode, anchor) {
  if (mode === 'day')  return [startOfDay(anchor), endOfDay(anchor)];
  if (mode === 'week') return [startOfWeek(anchor), endOfWeek(anchor)];
  return [startOfMonth(anchor), endOfMonth(anchor)];
}

export function inRange(txs, from, to) {
  return txs.filter((t) => {
    const d = new Date(t.occurred_at);
    return d >= from && d <= to;
  });
}

export function rangeTotals(txs) {
  let inn = 0, out = 0;
  txs.forEach((t) => {
    if (t.direction === 'in') inn += n2(t.amount);
    if (t.direction === 'out') out += n2(t.amount);
  });
  return { in: inn, out, net: inn - out, count: txs.length };
}

// Weeks of a month as a calendar grid, padded to whole weeks.
export function monthGrid(anchor) {
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const cells = [];
  const lead = first.getDay();
  for (let i = 0; i < lead; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (lead - i));
    cells.push({ date: d, outside: true });
  }
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push({ date: new Date(anchor.getFullYear(), anchor.getMonth(), day), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(cells[cells.length - 1].date);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, outside: true });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// per-day in/out totals, keyed by ISO date
export function dailyMap(txs) {
  const m = {};
  txs.forEach((t) => {
    const k = isoDay(t.occurred_at);
    if (!m[k]) m[k] = { in: 0, out: 0, count: 0 };
    if (t.direction === 'in') m[k].in += n2(t.amount);
    if (t.direction === 'out') m[k].out += n2(t.amount);
    m[k].count++;
  });
  return m;
}

/* ---------- therapy sessions, across every month ---------- */
export function sessionReport(appointments) {
  const all = appointments || [];
  const base = () => ({ sessions: 0, paid: 0, attended: 0, attendedAmt: 0, missed: 0, missedAmt: 0, cancelled: 0, refund: 0, planned: 0, plannedAmt: 0 });

  const add = (acc, a) => {
    const amt = n2(a.amount);
    acc.sessions++; acc.paid += amt;
    if (a.status === 'attended') { acc.attended++; acc.attendedAmt += amt; }
    else if (a.status === 'missed') { acc.missed++; acc.missedAmt += amt; }
    else if (a.status === 'cancelled') { acc.cancelled++; acc.refund += amt; }
    else { acc.planned++; acc.plannedAmt += amt; }
    return acc;
  };

  const total = all.reduce(add, base());
  const byMonth = {};
  const byTherapy = {};
  all.forEach((a) => {
    const k = a.on_date.slice(0, 7);
    byMonth[k] = add(byMonth[k] || base(), a);
    byTherapy[a.therapy] = add(byTherapy[a.therapy] || base(), a);
  });

  const settled = total.attended + total.missed + total.cancelled;
  const held = total.attended + total.missed;   // sessions the centre actually kept

  // A trainer cancellation is refunded straight away, so it stops being spend.
  // Net paid is what the month actually cost: used + lost + still to come.
  total.netPaid = total.paid - total.refund;
  Object.values(byMonth).forEach((m) => { m.netPaid = m.paid - m.refund; });
  Object.values(byTherapy).forEach((t) => { t.netPaid = t.paid - t.refund; });

  return {
    total,
    settled,
    attendanceRate: held > 0 ? (total.attended / held) * 100 : null,
    months: Object.entries(byMonth)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    therapies: Object.entries(byTherapy)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.paid - a.paid),
  };
}

export const monthLabel = (key) =>
  new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

/* ---------- driver trips ---------- */
export function driverReport(trips, drivers, from, to) {
  const inWindow = trips.filter((t) => {
    if (!from && !to) return true;
    const d = new Date(t.on_date + 'T12:00:00');
    return d >= from && d <= to;
  });

  const nameOf = Object.fromEntries((drivers || []).map((d) => [d.id, d.name]));

  const byDriver = {};
  const byRoute = {};
  const byDay = {};
  let total = 0;

  inWindow.forEach((t) => {
    const amt = n2(t.amount);
    total += amt;

    const key = t.driver_id || 'none';
    if (!byDriver[key]) byDriver[key] = { id: key, name: nameOf[key] || 'Unassigned', trips: 0, amount: 0, last: null };
    byDriver[key].trips++;
    byDriver[key].amount += amt;
    if (!byDriver[key].last || t.on_date > byDriver[key].last) byDriver[key].last = t.on_date;

    const route = `${(t.from_place || '?').trim()} → ${(t.to_place || '?').trim()}`;
    if (!byRoute[route]) byRoute[route] = { route, trips: 0, amount: 0 };
    byRoute[route].trips++;
    byRoute[route].amount += amt;

    byDay[t.on_date] = (byDay[t.on_date] || 0) + amt;
  });

  const drivers_ = Object.values(byDriver).sort((a, b) => b.amount - a.amount);
  const routes = Object.values(byRoute).sort((a, b) => b.amount - a.amount);

  return {
    trips: inWindow,
    count: inWindow.length,
    total,
    perTrip: inWindow.length ? total / inWindow.length : 0,
    drivers: drivers_,
    routes,
    byDay,
    days: Object.keys(byDay).length,
  };
}

/* ---------- salary ---------- */
// Indian financial year: April to March. FY27 means Apr 2026 – Mar 2027.
export function fyOf(dateish) {
  const d = new Date(dateish);
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return { startYear, label: `FY${String((startYear + 1) % 100).padStart(2, '0')}`,
           from: new Date(startYear, 3, 1), to: new Date(startYear + 1, 2, 31, 23, 59, 59) };
}

export function salaryReport(rows) {
  const list = (rows || []).slice().sort((a, b) => b.for_month.localeCompare(a.for_month));
  if (!list.length) return { list: [], count: 0 };

  const amounts = list.map((r) => n2(r.amount));
  const total = amounts.reduce((a, b) => a + b, 0);

  // how late in the month it usually lands
  const days = list.map((r) => new Date(r.credited_on + 'T12:00:00').getDate());
  const avgDay = days.reduce((a, b) => a + b, 0) / days.length;

  const fy = fyOf(new Date());
  const thisFy = list.filter((r) => {
    const d = new Date(r.for_month + 'T12:00:00');
    return d >= fy.from && d <= fy.to;
  });

  const withDelta = list.map((r, i) => {
    const prev = list[i + 1];
    const diff = prev ? n2(r.amount) - n2(prev.amount) : null;
    const pct = prev && n2(prev.amount) > 0 ? (diff / n2(prev.amount)) * 100 : null;
    return { ...r, diff, pct, day: new Date(r.credited_on + 'T12:00:00').getDate() };
  });

  return {
    list: withDelta,
    count: list.length,
    total,
    average: total / list.length,
    latest: withDelta[0],
    highest: Math.max(...amounts),
    lowest: Math.min(...amounts),
    avgDay,
    earliestDay: Math.min(...days),
    latestDay: Math.max(...days),
    fy: { ...fy, count: thisFy.length, total: thisFy.reduce((s, r) => s + n2(r.amount), 0) },
  };
}
