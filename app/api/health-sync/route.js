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

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return Response.json({ message: 'Supabase is not configured on this deployment' }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ message: 'Body must be JSON' }, { status: 400 }); }

  const email = body.email || req.headers.get('x-email');
  const password = body.password || req.headers.get('x-password');
  if (!email || !password) {
    // Telling you what arrived is the difference between fixing this in one
    // try and guessing at it.
    return Response.json({
      message: 'Send email and password, the same ones you sign in with',
      received_keys: body && typeof body === 'object' ? Object.keys(body) : typeof body,
      hint: 'In Shortcuts the Request Body must be JSON, and the field names must be exactly email and password, all lowercase.',
    }, { status: 401 });
  }

  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await sb.auth.signInWithPassword({ email, password });
  if (authError || !auth?.user) {
    return Response.json({ message: 'Those credentials were not accepted' }, { status: 401 });
  }

  const rows = Array.isArray(body.days) ? body.days : Array.isArray(body) ? body : [body];
  const clean = [];
  const rejected = [];

  for (const r of rows) {
    const date = asDate(r.date || r.on_date);
    if (!date) { rejected.push({ why: 'could not read that date', got: r.date ?? r.on_date ?? null }); continue; }

    const out = {
      user_id: auth.user.id, on_date: date,
      source: 'shortcut', updated_at: new Date().toISOString(),
    };
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
    await sb.auth.signOut();
    return Response.json({ message: 'Nothing usable in that payload', rejected }, { status: 400 });
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
