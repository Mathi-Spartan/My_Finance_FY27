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

// A transaction block in these statements reads:
//
//     UPI/P2M/933404853352/MADHU PRAVEEN          <- narration, no date
//     29-05-2026  FUEL ST/Paymen/YES BANK  3000.00  204418.97  4034
//
// The date sits on the LAST line of the block with the tail of the narration
// and the figures. So undated lines belong to the row that FOLLOWS them, not
// the one before — getting this backwards splices each payee onto the wrong
// transaction.
function rows(text) {
  const raw = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  let buffer = [];
  let opening = null;

  for (const line of raw) {
    if (END.test(line)) break;
    if (/^opening balance/i.test(line)) {
      const m = normalise(line).match(/(\d[\d,]*\.\d{2})\s*$/);
      if (m) opening = Number(m[1].replace(/,/g, ''));
      buffer = [];
      continue;
    }
    if (NOISE.test(line)) { buffer = []; continue; }

    const d = readDate(line);
    const startsWithDate = d && /^\s*\d{1,2}[\/\-. ]|^\s*\d{4}-/.test(line);

    if (startsWithDate) {
      const head = line.replace(/^\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*/, '');
      out.push({ date: d, text: (buffer.join(' ') + ' ' + head).trim(), amountText: line });
      buffer = [];
    } else {
      buffer.push(line);
      if (buffer.length > 4) buffer.shift();   // never carry stale fragments
    }
  }

  out.opening = opening;
  return out;
}

export function parseStatement(text) {
  const parsed = [];
  const skipped = [];
  const all = rows(text);
  let prevBalance = all.opening;

  for (const r of all) {
    const amts = amounts(r.amountText || r.text);
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

// Indian bank narrations are structured, not free text. Reading the fields
// properly is the difference between "Limit Paymen Axis" and "Muthoot Fincorp".
//
//   UPI/P2M/<ref>/<NAME>/<purpose>/<BANK>
//   IMPS/P2A/<ref>/<NAME>/<acct>/<BANK>
//   NEFT/<ref>/<NAME>/<BANK>/...
//   ACH-DR-<LENDER><refs>
//   POS/<MERCHANT>/...
export function merchantOf(desc) {
  const d = desc.trim();

  // The narration wraps across lines in the PDF, so the UPI block can sit
  // anywhere in the assembled row rather than at the start. Search the whole
  // string and take the name field, which is the one after the reference.
  let m = d.match(/(?:UPI|IMPS)\s*\/\s*(?:P2M|P2A)\s*\/\s*\d{6,}\s*\/\s*([^\/]{2,40})/i);
  if (m && !/^[\d.\s]+$/.test(m[1])) return tidy(m[1]);

  m = d.match(/NEFT\/[A-Z0-9]+\/([^\/]{3,40})/i);
  if (m) return tidy(m[1]);

  m = d.match(/ACH-(?:DR|CR)-([A-Z&. ]{3,30})/i);
  if (m) return tidy(m[1]);

  m = d.match(/POS\/([A-Z][^\/]{2,30})/i);
  if (m) return tidy(m[1].replace(/\*/g, ' '));

  if (/ATM-CASH/i.test(d)) return 'ATM withdrawal';
  if (/SELF CASH DEP/i.test(d)) return 'Cash deposit';
  if (/CreditCard Payment/i.test(d)) return 'Credit card payment';
  if (/_EMI_/i.test(d)) return 'Loan EMI';
  if (/MOB\/SELFFT/i.test(d)) return 'Own account';
  if (/Chrgs Incl GST|Decline Chrgs/i.test(d)) return 'Bank charges';
  if (/Int\.Pd|Interest/i.test(d)) return 'Interest paid';
  if (/Loan Disbursement/i.test(d)) return 'Loan disbursement';
  if (/IFT\//i.test(d)) { const p = d.split('/'); return tidy(p[4] || p[3] || 'Transfer'); }

  // last resort: the longest run of words that is not a bank name
  const words = d.replace(/\d+/g, ' ').split(/[\s\/|,-]+/)
    .filter((w) => /^[a-z][a-z.&']{2,}$/i.test(w));
  return words.length ? tidy(words.slice(0, 3).join(' ')) : 'Unnamed';
}

const NOISE_WORDS = /\b(paymen|payment|paid via|upi|upiqr|upiint|p2m|p2a|mandatee|executio|static|verifi|pay to|qrcode|collec|revers|reques|subscrip|whmcs|pay vi|ltd|limited|private|pvt|the|axis|hdfc|icici|kotak|canara|federal|indusind|yes bank|ybs|sbi|state bank|union bank|indian bank|city union|ciub|tmbl|kvbl|ioba|cnrb|utib|kkbk|idib|apbl|tsab|indb|ibkl|sbin|citi|allahabadbank|indianoverseasbank|kotakmahindrabankltd|cityunionbank|tamilnadmercantile|bank)\b/gi;

const tidy = (s) =>
  s.replace(NOISE_WORDS, ' ')
    .replace(/[^a-z0-9&. ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 26) || 'Unnamed';

// Money moving between accounts the same person owns is not spending, and
// leaving it in makes every other figure meaningless.
const SELF = /mathivan|madhivan|mathiva|kmadhiva|self ?ft|selfft|own account|cash deposit|ppiw/i;

const BUCKETS = [
  ['Own accounts',  /mathivan|madhivan|mathiva|kmadhiva|selfft|ppiw|cash deposit/i],
  ['Loans & EMI',   /muthoot|stashfin|kreditbee|kbaubl|smfg|dmi ?finance|bajaj ?finance|northern ?arc|lendenclub|l&t ?finance|l and t finance|credit ?saison|kisetsu|instamoney|innofin|akaracap|akara|_emi_|kotakmahprime|loan disburse|balancehero|nebliote/i],
  ['Credit card',   /creditcard payment|credit card/i],
  ['Cash',          /atm[- ]?cash|cash withdrawal|cwdr/i],
  ['Groceries',     /malligai|aavin|milk agency|kirana|maligai|nilgiri|dmart|d-mart|bigbasket|blinkit|zepto|amazon pay groceries|suguna chicken|vinayaga malligai/i],
  ['Fuel',          /fuel|petrol|filling|hpcl|bpcl|iocl|indian oil|shell|thirumurugan fuels|mangai fuels|sai sakthi|chendur/i],
  ['Food & dining', /hotel|restaurant|bakes|bakery|sweets|cafe|canteen|kfc|biryan|biriyani|annapoorna|juice|foods|mess|iyengar|arthah|chip|salem cafe|jd hotel|thoothukudi/i],
  ['Health',        /pharmacy|medical|medicals|hospital|clinic|apollo|bharani|veda|muthu pharmacy|a p pharmacy|apple med|shankar naraya|mohan medicals/i],
  ['Subscriptions', /netflix|google|youtube|apple|zee ?enter|jiohotsta|hotstar|spotify|prime|anthropic|claude|openai|dotpapa|amay holdings|trading v/i],
  ['Bills & recharge', /jio recharge|airtel|recharge|electricity|tneb|broadband|gas bill|goods and service tax|equitas/i],
  ['Shopping',      /amazon|flipkart|ekart|myntra|ajio|meesho|garments|sportswear|kushals|darling digital|fashion factory|golden mandhir|pranav|techno|luxsum|sangeetha|universal publishing/i],
  ['Transport',     /uber|ola|rapido|irctc|redbus|lorry|travels|bike st|toll|fastag/i],
  ['Charges',       /chrgs incl gst|bank charges|decline chrgs|txn chrgs|penalty/i],
  ['People',        /^(mr|mrs|ms|dr)\b|ranjitha|thamarai|alagarasan|saranya|selvaraj|jaganathan|pachiyappan|nandhakumar|kathirvel|shanthik|loganathan|vendhan|karthi|mohanavalli|sathya|senthil|jagadeesh|dinesh|krishna|ekambaram|bharathikanal|janani|matilda|kumaresan|ramesh|mekala|natarajan|prabu|sathishkumar|santhoshkumar/i],
];

export function categorise(desc) {
  const m = merchantOf(desc);
  for (const [name, re] of BUCKETS) if (re.test(desc) || re.test(m)) return name;
  return 'Other';
}

export const isSelfTransfer = (desc) => SELF.test(desc) || SELF.test(merchantOf(desc));

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function analyse(rows, opts = {}) {
  const excludeSelf = opts.excludeSelf !== false;   // on by default

  const all = rows;
  const selfRows = all.filter((r) => isSelfTransfer(r.description));
  const kept = excludeSelf ? all.filter((r) => !isSelfTransfer(r.description)) : all;

  const spend = kept.filter((r) => r.direction === 'out');
  const income = kept.filter((r) => r.direction === 'in');
  const totalOut = sum(spend);
  const totalIn = sum(income);

  const from = all.length ? all[0].date : null;
  const to = all.length ? all[all.length - 1].date : null;
  const days = from && to ? Math.max(1, Math.round((to - from) / 86400000) + 1) : 1;
  const months = Math.max(1, days / 30.44);

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
  const byMonth = group(spend, (r) => r.iso.slice(0, 7));
  const incomeByMonth = group(income, (r) => r.iso.slice(0, 7));
  const byWeekday = DAYS.map((name, i) => {
    const items = spend.filter((r) => r.date.getDay() === i);
    return { key: name, short: name.slice(0, 3), total: sum(items), count: items.length };
  });

  // Money that leaves and does not come back: debt, bills, living. Repayments
  // to lenders are the part most worth separating from everyday spending.
  const debt = spend.filter((r) => /Loans & EMI|Credit card/.test(categorise(r.description)));
  const living = spend.filter((r) => !/Loans & EMI|Credit card|People/.test(categorise(r.description)));
  const people = spend.filter((r) => categorise(r.description) === 'People');

  const repeats = byMerchant.filter((m) => m.count >= 3).map((m) => {
    const a = m.items.map((r) => r.amount);
    const avg = m.total / m.count;
    const spread = Math.max(...a) - Math.min(...a);
    return { ...m, avg, steady: avg > 0 && spread / avg < 0.15 };
  });

  const peakDay = byDay[0] || null;
  const sortedWeekday = byWeekday.filter((d) => d.count > 0).sort((a, b) => b.total - a.total);
  const biggest = spend.slice().sort((a, b) => b.amount - a.amount)[0] || null;
  const smallest = spend.slice().sort((a, b) => a.amount - b.amount)[0] || null;
  const biggestIn = income.slice().sort((a, b) => b.amount - a.amount)[0] || null;

  const spentDays = new Set(spend.map((r) => r.iso));
  const small = spend.filter((r) => r.amount <= 200);
  const big = spend.filter((r) => r.amount >= 10000);

  const median = (() => {
    const a = spend.map((r) => r.amount).sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  })();

  const balances = all.filter((r) => r.balance !== null).map((r) => r.balance);
  const lowBalanceDays = new Set(
    all.filter((r) => r.balance !== null && r.balance < 1000).map((r) => r.iso)
  );

  return {
    count: all.length, spendCount: spend.length, incomeCount: income.length,
    totalOut, totalIn, net: totalIn - totalOut,
    from, to, days, months,
    perDay: totalOut / days, perMonth: totalOut / months,
    perTransaction: spend.length ? totalOut / spend.length : 0,
    median,
    byCategory, byMerchant, byDay, byMonth, incomeByMonth, byWeekday, repeats,
    peakDay,
    busiestWeekday: sortedWeekday[0] || byWeekday[0],
    quietestWeekday: sortedWeekday[sortedWeekday.length - 1] || byWeekday[0],
    biggest, smallest, biggestIn,
    noSpendDays: Math.max(0, days - spentDays.size),
    spentDays: spentDays.size,
    smallSpends: { count: small.length, total: sum(small) },
    bigSpends: { count: big.length, total: sum(big) },
    debt: { count: debt.length, total: sum(debt) },
    living: { count: living.length, total: sum(living) },
    people: { count: people.length, total: sum(people) },
    self: { count: selfRows.length, total: sum(selfRows.filter((r) => r.direction === 'out')) },
    excluded: excludeSelf,
    openingBalance: all.find((r) => r.balance !== null)?.balance ?? null,
    closingBalance: [...all].reverse().find((r) => r.balance !== null)?.balance ?? null,
    lowestBalance: balances.length ? Math.min(...balances) : null,
    highestBalance: balances.length ? Math.max(...balances) : null,
    lowBalanceDays: lowBalanceDays.size,
  };
}

const sum = (a) => a.reduce((s, r) => s + r.amount, 0);
