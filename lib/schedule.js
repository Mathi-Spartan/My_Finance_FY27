// Turns a pasted therapy schedule into session rows.
//
// The sheets come as two blocks — Speech, then Occupational — each a list of
// date / weekday / time / amount. Rows are tolerant about separators because
// copied text arrives with tabs, pipes, or runs of spaces depending on source.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const THERAPY_WORDS = [
  [/speech/i, 'Speech'],
  [/occupation|\bot\b/i, 'Occupational'],
  [/behav/i, 'Behavioural'],
  [/physio/i, 'Physio'],
  [/special\s*ed/i, 'Special education'],
];

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function detectTherapy(line) {
  for (const [re, name] of THERAPY_WORDS) if (re.test(line)) return name;
  return null;
}

// Time ranges look exactly like dates once you allow "-" as a separator:
// 11:30-12:15 reads as 30/12. Strip times before looking for a date.
const TIME_RE = /\d{1,2}\s*[.:]\s*\d{2}\s*(?:-|–|—|to)\s*\d{1,2}\s*[.:]\s*\d{2}/gi;

// 02/09/2026, 2-9-26, 02/09, or "2 Sep"
function parseDate(text, fallbackYear, fallbackMonth) {
  let m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (m) {
    const d = +m[1];
    const mo = +m[2];
    let y = m[3] ? +m[3] : fallbackYear;
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return { d, mo, y };
  }
  m = text.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (m) return { d: +m[1], mo: MONTHS[m[2].toLowerCase()], y: fallbackYear };
  m = text.match(/^\s*(\d{1,2})\b/);
  if (m && fallbackMonth) return { d: +m[1], mo: fallbackMonth, y: fallbackYear };
  return null;
}

// 11.30 - 12.15 / 11:30-12:15 / 11.30 to 12.15
function parseSlot(text) {
  const m = text.match(/(\d{1,2}[.:]\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}[.:]\d{2})/i);
  if (!m) return '';
  return `${m[1].replace(':', '.')} - ${m[2].replace(':', '.')}`;
}

function parseAmount(text) {
  const all = [...text.matchAll(/(?:₹|rs\.?|inr)?\s*(\d{2,6}(?:\.\d{1,2})?)\b/gi)]
    .map((x) => Number(x[1]))
    .filter((n) => n >= 50 && n <= 100000);
  return all.length ? all[all.length - 1] : null;
}

export function parseSchedule(raw, opts = {}) {
  const year = opts.year || new Date().getFullYear();
  const lines = String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let therapy = opts.defaultTherapy || null;
  let month = opts.month || null;
  const rows = [];
  const problems = [];

  // a month named anywhere in the text sets the default
  for (const l of lines) {
    const m = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
    if (m && !month) month = MONTHS[m[1].toLowerCase()];
  }

  for (const line of lines) {
    // a heading switches which therapy the rows below belong to
    const head = detectTherapy(line);
    const looksLikeRow = /\d{1,2}\s*[.:]\s*\d{2}/.test(line) || /\d{1,2}[\/\-.]\d{1,2}/.test(line);
    if (head && !looksLikeRow) { therapy = head; continue; }

    if (/^(date|day|time|amount|total|s\.?no)/i.test(line) && !looksLikeRow) continue;

    const withoutTime = line.replace(TIME_RE, ' ');
    const date = parseDate(withoutTime, year, month);
    if (!date) continue;

    const slot = parseSlot(line);
    const amount = parseAmount(
      withoutTime.replace(/\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/, ' ')
    );
    const inlineTherapy = detectTherapy(line);

    if (!slot && !amount) continue; // a stray number, not a session

    const iso = `${date.y}-${String(date.mo).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    const real = new Date(iso + 'T00:00:00');
    if (Number.isNaN(real.getTime())) { problems.push(`Could not read a date from: ${line}`); continue; }

    // if the sheet names a weekday, check it against the real calendar
    const named = DAYS.find((d) => new RegExp(d.slice(0, 3), 'i').test(line));
    let warn = null;
    if (named) {
      const actual = DAYS[real.getDay()];
      if (!actual.startsWith(named.slice(0, 3))) {
        warn = `${iso} is a ${actual[0].toUpperCase() + actual.slice(1)}, the sheet says ${named}`;
      }
    }

    rows.push({
      on_date: iso,
      therapy: inlineTherapy || therapy || 'Session',
      slot,
      amount: amount || 0,
      warn,
    });
  }

  // same therapy, same date, same slot twice is a duplicate
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    const k = `${r.on_date}|${r.therapy}|${r.slot}`;
    if (seen.has(k)) { problems.push(`Skipped a duplicate: ${r.therapy} on ${r.on_date}`); continue; }
    seen.add(k);
    unique.push(r);
  }

  unique.sort((a, b) => (a.on_date === b.on_date ? a.slot.localeCompare(b.slot) : a.on_date.localeCompare(b.on_date)));

  const totals = {};
  unique.forEach((r) => {
    totals[r.therapy] = totals[r.therapy] || { count: 0, amount: 0 };
    totals[r.therapy].count++;
    totals[r.therapy].amount += r.amount;
  });

  return { rows: unique, problems, totals };
}
