// Where the iPhone Shortcut posts. Apple gives no web access to Health, so the
// Shortcut reads the samples and sends them here.
//
// No server secrets are needed: the Shortcut sends the same email and password
// you sign in with, this route signs in as you against Supabase, and writes as
// you. Row-level security then applies exactly as it does in the browser — the
// request can only ever touch your own rows. That avoids putting a service-role
// key anywhere, which would have been able to touch everyone's.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const FIELDS = [
  'steps', 'distance_km', 'flights', 'active_kcal', 'exercise_min', 'stand_hours',
  'sleep_min', 'sleep_deep_min', 'sleep_rem_min', 'resting_hr', 'hrv',
  'weight_kg', 'body_fat',
];

// Shortcuts sends whatever the phone's locale gives: 30/8/2026, 30-08-2026,
// or an ISO timestamp. Take all of them.
const asDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Shortcuts sends sleep as minutes, but people type "7:15" or "7.25" — take all three
const minutes = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const hm = s.match(/^(\d{1,2})[:h](\d{1,2})/i);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = num(s);
  if (n === null) return null;
  return n < 24 ? Math.round(n * 60) : Math.round(n);   // under 24 means hours
};

// Adding six fields in the Shortcuts editor is tedious on a phone, so this
// also accepts one line of free text: "steps 8412 sleep 6:48 weight 74.2".
// Credentials can ride in the URL, leaving the body with a single field.
const ALIASES = {
  steps: 'steps', step: 'steps',
  sleep: 'sleep_min', sleep_min: 'sleep_min', asleep: 'sleep_min',
  hr: 'resting_hr', heart: 'resting_hr', resting: 'resting_hr', resting_hr: 'resting_hr',
  weight: 'weight_kg', kg: 'weight_kg', weight_kg: 'weight_kg',
  move: 'active_kcal', kcal: 'active_kcal', calories: 'active_kcal', active_kcal: 'active_kcal',
  distance: 'distance_km', km: 'distance_km', distance_km: 'distance_km',
  exercise: 'exercise_min', exercise_min: 'exercise_min',
  flights: 'flights', stairs: 'flights',
  hrv: 'hrv', fat: 'body_fat', body_fat: 'body_fat',
  stand: 'stand_hours', stand_hours: 'stand_hours',
  deep: 'sleep_deep_min', sleep_deep_min: 'sleep_deep_min',
  rem: 'sleep_rem_min', sleep_rem_min: 'sleep_rem_min',
  date: 'date', day: 'date',
};

// A Health Samples variable arrives as raw text: "8412 count", or many
// samples in a row like "1,234 count 2,001 count 5,177 count". Strip units and
// thousands separators, then sum what should be summed and average the rest.
const SUMMED = ['steps', 'active_kcal', 'distance_km', 'flights', 'exercise_min'];
const KEYWORDS = Object.keys(ALIASES).sort((a, b) => b.length - a.length).join('|');

function fromText(text) {
  const out = {};
  const s = String(text)
    .replace(/(\d),(?=\d{3}\b)/g, '$1')                 // 1,234 -> 1234
    .replace(/[;\n]+/g, ' ')
    // units that trail a number; 'hr' is deliberately absent, it means heart rate
    .replace(/(\d)\s*(count|steps?|kcal|cal|kg|bpm|km|mi|hours?|mins?|minutes?)\b/gi, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const re = new RegExp(
    `\\b(${KEYWORDS})\\b\\s*[:=]?\\s*(\\d+:\\d{1,2}|(?:\\d+(?:\\.\\d+)?\\s*)+)`, 'gi');
  let m;
  while ((m = re.exec(s))) {
    const key = ALIASES[m[1].toLowerCase()];
    if (!key) continue;
    const nums = m[2].trim().split(/\s+/);
    if (key === 'date') { out.date = nums[0]; continue; }
    if (nums.length === 1) { out[key] = nums[0]; continue; }
    const vals = nums.map(Number).filter((v) => !Number.isNaN(v));
    if (!vals.length) { out[key] = nums[0]; continue; }
    out[key] = SUMMED.includes(key)
      ? String(vals.reduce((a, b) => a + b, 0))
      : String(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}

// Health Auto Export posts its own shape, and needs no Shortcut built by hand:
//   { data: { metrics: [ { name:'step_count', units:'count',
//                          data:[{ date:'2026-08-30 00:00:00 +0530', qty: 8412 }] } ] } }
// Metric names follow HealthKit, so map them onto our columns.
const HAE = {
  step_count: 'steps',
  apple_exercise_time: 'exercise_min',
  active_energy: 'active_kcal',
  basal_energy_burned: null,
  walking_running_distance: 'distance_km',
  flights_climbed: 'flights',
  resting_heart_rate: 'resting_hr',
  heart_rate_variability: 'hrv',
  weight_body_mass: 'weight_kg',
  body_fat_percentage: 'body_fat',
  sleep_analysis: 'sleep_min',
  apple_stand_hour: 'stand_hours',
  apple_stand_time: 'stand_hours',
};

// its sleep entries carry asleep/deep/rem in hours
function fromAutoExport(payload) {
  const metrics = payload?.data?.metrics || payload?.metrics;
  if (!Array.isArray(metrics)) return null;

  const byDate = {};
  const put = (date, key, value) => {
    if (!date || value === null || value === undefined || Number.isNaN(value)) return;
    byDate[date] = byDate[date] || { date };
    byDate[date][key] = key === 'steps' || key === 'flights' || key === 'active_kcal'
      ? Math.round((byDate[date][key] || 0) + value)          // counts add up
      : value;                                                // measurements replace
  };

  for (const m of metrics) {
    const col = HAE[String(m.name || '').toLowerCase()];
    if (!col) continue;
    for (const row of m.data || []) {
      const date = String(row.date || '').slice(0, 10);
      if (col === 'sleep_min') {
        const asleep = Number(row.asleep ?? row.totalSleep ?? row.qty);
        if (!Number.isNaN(asleep)) put(date, 'sleep_min', Math.round(asleep * 60));
        const deep = Number(row.deep);
        if (!Number.isNaN(deep)) put(date, 'sleep_deep_min', Math.round(deep * 60));
        const rem = Number(row.rem);
        if (!Number.isNaN(rem)) put(date, 'sleep_rem_min', Math.round(rem * 60));
        continue;
      }
      const qty = Number(row.qty ?? row.Avg ?? row.avg);
      if (Number.isNaN(qty)) continue;
      put(date, col, col === 'distance_km' || col === 'weight_kg' || col === 'hrv' || col === 'body_fat'
        ? Math.round(qty * 100) / 100
        : Math.round(qty));
    }
  }

  const days = Object.values(byDate);
  return days.length ? days : null;
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return Response.json({ message: 'Supabase is not configured on this deployment' }, { status: 500 });
  }

  const qs = new URL(req.url).searchParams;
  const raw = await req.text();

  let body = {};
  if (raw && raw.trim().startsWith('{')) {
    try { body = JSON.parse(raw); } catch { body = {}; }
  } else if (raw && raw.trim().startsWith('[')) {
    try { body = { days: JSON.parse(raw) }; } catch { body = {}; }
  } else if (raw && raw.trim()) {
    body = fromText(raw);              // plain text posted straight in
  }

  // one free-text field is far easier to build in Shortcuts than six
  if (typeof body.data === 'string') Object.assign(body, fromText(body.data));
  if (typeof body.text === 'string') Object.assign(body, fromText(body.text));

  // A sync key is the safe way in: it can only add health days, it carries no
  // password, and it can be revoked from Settings without changing anything
  // else. Email and password still work, but the key is what should be used
  // anywhere a third-party app or a URL is involved.
  const key = body.key || qs.get('key') || req.headers.get('x-sync-key');
  const email = body.email || qs.get('email') || req.headers.get('x-email');
  const password = body.password || qs.get('password') || req.headers.get('x-password');
  if (!key && (!email || !password)) {
    // Telling you what arrived is the difference between fixing this in one
    // try and guessing at it.
    return Response.json({
      message: 'Send email and password, the same ones you sign in with',
      received_keys: body && typeof body === 'object' ? Object.keys(body) : typeof body,
      hint: 'In Shortcuts the Request Body must be JSON, and the field names must be exactly email and password, all lowercase.',
    }, { status: 401 });
  }

  const sb = createClient(url, anon, { auth: { persistSession: false } });

  let userId = null;
  if (!key) {
    const { data: auth, error: authError } = await sb.auth.signInWithPassword({ email, password });
    if (authError || !auth?.user) {
      return Response.json({ message: 'Those credentials were not accepted' }, { status: 401 });
    }
    userId = auth.user.id;
  }

  // Health Auto Export sends its own structure; take it whole if we see it
  const autoExport = fromAutoExport(body);
  const rows = autoExport
    || (Array.isArray(body.days) ? body.days : Array.isArray(body) ? body : [body]);
  const clean = [];
  const rejected = [];

  for (const r of rows) {
    // no date sent at all means today, which is what a daily automation wants
    const date = asDate(r.date || r.on_date) || new Date().toISOString().slice(0, 10);

    const out = { on_date: date };
    if (userId) { out.user_id = userId; out.source = 'shortcut'; out.updated_at = new Date().toISOString(); }
    let any = false;
    for (const f of FIELDS) {
      const v = f.endsWith('_min') ? minutes(r[f]) : num(r[f]);
      if (v !== null) { out[f] = v; any = true; }
    }
    // a couple of friendlier aliases
    if (out.sleep_min === undefined && r.sleep !== undefined) {
      const v = minutes(r.sleep); if (v !== null) { out.sleep_min = v; any = true; }
    }
    if (out.weight_kg === undefined && r.weight !== undefined) {
      const v = num(r.weight); if (v !== null) { out.weight_kg = v; any = true; }
    }
    if (!any) { rejected.push({ why: 'no readable measurements', date }); continue; }
    clean.push(out);
  }

  if (!clean.length) {
    if (userId) await sb.auth.signOut();
    return Response.json({ message: 'Nothing usable in that payload', rejected }, { status: 400 });
  }

  if (key) {
    // goes through a function that can only ever write this key owner's days
    const { data, error } = await sb.rpc('health_ingest', { p_token: key, p_rows: clean });
    if (error) return Response.json({ message: error.message }, { status: 500 });
    if (!data?.ok) return Response.json({ message: data?.message || 'Key not accepted' }, { status: 401 });
    return Response.json({
      saved: data.saved,
      dates: clean.map((c) => c.on_date),
      rejected: rejected.length,
      ...(rejected.length ? { why: rejected } : {}),
    });
  }

  const { data, error } = await sb
    .from('health_days')
    .upsert(clean, { onConflict: 'user_id,on_date' })
    .select('on_date');

  await sb.auth.signOut();

  if (error) return Response.json({ message: error.message }, { status: 500 });

  return Response.json({
    saved: data?.length || 0,
    dates: (data || []).map((d) => d.on_date),
    rejected: rejected.length,
    ...(rejected.length ? { why: rejected } : {}),
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    how: 'POST JSON with your email and password, plus one day or a list of days.',
    example: {
      email: 'you@example.com',
      password: '••••••',
      days: [{ date: '2026-08-30', steps: 11240, sleep_min: 408, resting_hr: 61, weight_kg: 74.2 }],
    },
    fields: FIELDS,
  });
}
