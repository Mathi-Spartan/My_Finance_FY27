// Reads an Indian bank statement that has been turned into text, and works out
// what it says. Everything here is plain arithmetic and pattern matching — no
// model, no service, nothing leaves the device.

const n = (x) => Number(String(x).replace(/[^0-9.-]/g, '')) || 0;

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

// 01/08/2026 · 01-08-26 · 01 Aug 2026 · 2026-08-01
function readDate(s) {
  let m = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    let [, d, mo, y] = m;
    y = +y < 100 ? 2000 + +y : +y;
    const dt = new Date(y, +mo - 1, +d);
    return isNaN(dt) ? null : dt;
  }
  m = s.match(/\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]*(\d{2,4})?\b/i);
  if (m) {
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(y, MONTHS[m[2].toLowerCase()], +m[1]);
  }
  m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

// A zero balance prints as ".00" on Axis statements, which no money pattern
// with a leading digit will match — and missing it desynchronises every row
// that follows, because the running balance stops being right.
const normalise = (l) => l.replace(/(^|\s)\.(\d{2})(?=\s|$)/g, '$10.$2');

// every money-looking token on the line
function amounts(rawLine) {
  const line = normalise(rawLine);
  return [...line.matchAll(/(?:^|[\s(])(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+\.\d{1,2})(?=[\s)]|$|cr|dr)/gi)]
    .map((m) => ({ raw: m[1], value: n(m[1]), index: m.index }))
    // zero is kept: a balance can legitimately be 0.00, and dropping it breaks
    // the running balance for every row after it
    .filter((a) => a.value >= 0);
}

const CR = /\b(cr|credit|deposit|by transfer|received|refund|reversal|salary|interest)\b/i;
const DR = /\b(dr|debit|withdraw|paid|purchase|payment|atm|pos|upi\/|imps|neft|charge|emi)\b/i;

// Statements wrap a row over several lines. Anything starting with a date opens
// a new row; the rest is continuation.
// Once the ledger ends, everything after is summary and boilerplate. Reading
// on glues a "TRANSACTION TOTAL" line onto the last real row.
const END = /^(transaction total|closing balance|legends|\+{3,}|unless the constituent|this is a system generated)/i;
// Lines that are never part of a transaction, even mid-table.
const NOISE = /^(page \d|statement of|tran date|opening balance|registered (mobile|email)|customer id|ifsc|micr|nominee|scheme|currency|joint holder|branch address|registered office|with effect from|deposit insurance|in compliance|to ensure you)/i;

function rows(text) {
  const raw = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  let cur = null;
  let opening = null;

  for (const line of raw) {
    if (END.test(line)) break;
    if (/^opening balance/i.test(line)) {
      const m = normalise(line).match(/(\d[\d,]*\.\d{2})\s*$/);
      if (m) opening = Number(m[1].replace(/,/g, ''));
      continue;
    }
    if (NOISE.test(line)) { continue; }
    if (/^(date|txn|particulars|description|narration|balance|opening|closing|statement|page \d|account (no|number)|ifsc|branch|customer|address)/i.test(line)
        && !readDate(line)) { continue; }

    const d = readDate(line);
    const startsWithDate = d && /^\s*\d{1,2}[\/\-. ]|^\s*\d{4}-/.test(line);

    if (startsWithDate) {
      if (cur) out.push(cur);
      cur = { date: d, text: line };
    } else if (cur) {
      cur.text += ' ' + line;
    }
  }
  if (cur) out.push(cur);
  out.opening = opening;
  return out;
}

export function parseStatement(text) {
  const parsed = [];
  const skipped = [];
  const all = rows(text);
  let prevBalance = all.opening;

  for (const r of all) {
    const amts = amounts(r.text);
    if (!amts.length) { skipped.push(r.text.slice(0, 90)); continue; }

    let amount = null, balance = null, direction = null;

    // Statement rows end with a branch code as often as a balance, so rather
    // than guessing by position, find the pair that reconciles: a balance whose
    // move from the previous balance equals another figure on the same line.
    if (prevBalance !== null && prevBalance !== undefined) {
      for (let j = amts.length - 1; j >= 0 && balance === null; j--) {
        const delta = amts[j].value - prevBalance;
        if (Math.abs(delta) < 0.005) continue;
        for (let i = 0; i < amts.length; i++) {
          if (i === j || amts[i].value <= 0) continue;
          if (Math.abs(Math.abs(delta) - amts[i].value) < 0.02) {
            balance = amts[j].value;
            amount = amts[i].value;
            direction = delta > 0 ? 'in' : 'out';
            break;
          }
        }
      }
    }

    // Nothing reconciled — fall back to reading the columns by position.
    if (amount === null) {
      if (amts.length >= 2) { balance = amts[amts.length - 1].value; amount = amts[amts.length - 2].value; }
      else { amount = amts[0].value; }
      const hasCr = CR.test(r.text);
      const hasDr = DR.test(r.text);
      direction = hasCr && !hasDr ? 'in' : hasDr && !hasCr ? 'out' : (hasCr ? 'in' : 'out');
    }

    if (!amount || amount <= 0) { skipped.push(r.text.slice(0, 90)); continue; }
    if (balance !== null) prevBalance = balance;

    parsed.push({
      date: r.date,
      iso: r.date.toISOString().slice(0, 10),
      amount,
      balance,
      direction,
      description: clean(r.text),
      raw: r.text,
    });
  }

  parsed.sort((a, b) => a.date - b.date);
  return { rows: parsed, skipped };
}

function clean(t) {
  return t
    .replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})\b/g, ' ')
    .replace(/\b(ref|rrn|txn|utr|chq)[:\s#]*[a-z0-9]+/gi, ' ')
    .replace(/\b\d{8,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
}

// A merchant name worth grouping on, pulled out of the narration.
export function merchantOf(desc) {
  let s = desc;
  const upi = s.match(/(?:upi[\/-])?([a-z0-9._-]{3,})@[a-z]+/i);
  if (upi) return tidy(upi[1]);
  const pos = s.match(/\b(?:pos|ecom|card)\s*(?:purchase)?\s*[-\/]?\s*([a-z][a-z .&'-]{2,})/i);
  if (pos) return tidy(pos[1]);
  const to = s.match(/\b(?:to|paid to|towards)\s+([a-z][a-z .&'-]{2,})/i);
  if (to) return tidy(to[1]);
  s = s.replace(/\b(upi|imps|neft|rtgs|pos|ecom|atm|nfs|mmt|ach|dr|cr|inb|bil|tpt)\b/gi, ' ');
  const words = s.split(/[\s\/|,-]+/).filter((w) => /^[a-z][a-z.&'-]{2,}$/i.test(w));
  return words.length ? tidy(words.slice(0, 3).join(' ')) : 'Unnamed';
}

const tidy = (s) =>
  s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').slice(0, 28);

// Keyword buckets. Deliberately visible so it can be corrected by eye.
const BUCKETS = [
  ['Food & dining', /swiggy|zomato|dominos|pizza|restaurant|cafe|hotel|bakery|biriyani|kfc|mcdonald|starbucks|barbeque|dineout|eatfit|bowl/i],
  ['Groceries',     /bigbasket|blinkit|zepto|dmart|d-mart|grofers|jiomart|supermarket|kirana|reliance fresh|more retail|spencer|nilgiri/i],
  ['Transport',     /uber|ola|rapido|irctc|redbus|metro|petrol|fuel|hpcl|bpcl|iocl|indian oil|shell|parking|toll|fastag|namma yatri/i],
  ['Shopping',      /amazon|flipkart|myntra|ajio|meesho|nykaa|croma|reliance digital|decathlon|lifestyle|westside|pantaloon|tata cliq/i],
  ['Bills & recharge', /jio|airtel|vodafone|vi |bsnl|electricity|tneb|eb bill|water|gas|broadband|act fibernet|hathway|dth|tatasky|recharge/i],
  ['Subscriptions', /netflix|prime|spotify|hotstar|youtube|google|apple|microsoft|adobe|zoho|canva|openai|chatgpt|icloud|dropbox|figma/i],
  ['Health',        /pharmacy|apollo|medplus|netmeds|1mg|pharmeasy|hospital|clinic|diagnostic|lab|medical|dental|therapy/i],
  ['Education',     /school|college|tuition|course|udemy|coursera|byju|unacademy|vedantu|fee/i],
  ['Cash',          /atm|cash withdrawal|cwdr|nfs/i],
  ['Transfers',     /upi|imps|neft|rtgs|transfer|tpt|sent to/i],
  ['Loans & EMI',   /emi|loan|hdfc ltd|bajaj|finance|creditcard|card payment|cc payment/i],
  ['Investments',   /zerodha|groww|upstox|kuvera|mutual fund|sip|nps|ppf|lic|insurance|policy|premium/i],
  ['Charges',       /charge|fee|gst|penalty|annual|amc|sms alert|min bal|interest debit/i],
];

export function categorise(desc) {
  for (const [name, re] of BUCKETS) if (re.test(desc)) return name;
  return 'Other';
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function analyse(rows) {
  const spend = rows.filter((r) => r.direction === 'out');
  const income = rows.filter((r) => r.direction === 'in');
  const totalOut = spend.reduce((s, r) => s + r.amount, 0);
  const totalIn = income.reduce((s, r) => s + r.amount, 0);

  const from = rows.length ? rows[0].date : null;
  const to = rows.length ? rows[rows.length - 1].date : null;
  const days = from && to ? Math.max(1, Math.round((to - from) / 86400000) + 1) : 1;

  const group = (list, key) => {
    const m = {};
    list.forEach((r) => {
      const k = key(r);
      if (!m[k]) m[k] = { key: k, total: 0, count: 0, items: [] };
      m[k].total += r.amount; m[k].count++; m[k].items.push(r);
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  };

  const byCategory = group(spend, (r) => categorise(r.description));
  const byMerchant = group(spend, (r) => merchantOf(r.description));
  const byDay = group(spend, (r) => r.iso);
  const byWeekday = DAYS.map((name, i) => {
    const items = spend.filter((r) => r.date.getDay() === i);
    return { key: name, total: items.reduce((s, r) => s + r.amount, 0), count: items.length };
  });
  const byMonth = group(spend, (r) => r.iso.slice(0, 7));

  // paid to the same name three or more times at a steady amount
  const repeats = byMerchant.filter((m) => m.count >= 3).map((m) => {
    const a = m.items.map((r) => r.amount);
    const avg = m.total / m.count;
    const spread = Math.max(...a) - Math.min(...a);
    return { ...m, avg, steady: avg > 0 && spread / avg < 0.2 };
  });

  const peakDay = byDay[0] || null;
  const busiestWeekday = byWeekday.slice().sort((a, b) => b.total - a.total)[0];
  const quietestWeekday = byWeekday.filter((d) => d.count > 0).sort((a, b) => a.total - b.total)[0];
  const biggest = spend.slice().sort((a, b) => b.amount - a.amount)[0] || null;
  const smallest = spend.slice().sort((a, b) => a.amount - b.amount)[0] || null;

  // days in the window with no spending at all
  const spentDays = new Set(spend.map((r) => r.iso));
  const noSpendDays = Math.max(0, days - spentDays.size);

  const small = spend.filter((r) => r.amount <= 200);
  const smallTotal = small.reduce((s, r) => s + r.amount, 0);

  return {
    count: rows.length, spendCount: spend.length, incomeCount: income.length,
    totalOut, totalIn, net: totalIn - totalOut,
    from, to, days,
    perDay: totalOut / days,
    perTransaction: spend.length ? totalOut / spend.length : 0,
    byCategory, byMerchant, byDay, byWeekday, byMonth, repeats,
    peakDay, busiestWeekday, quietestWeekday, biggest, smallest,
    noSpendDays, spentDays: spentDays.size,
    smallSpends: { count: small.length, total: smallTotal },
    openingBalance: rows.find((r) => r.balance !== null)?.balance ?? null,
    closingBalance: [...rows].reverse().find((r) => r.balance !== null)?.balance ?? null,
  };
}
