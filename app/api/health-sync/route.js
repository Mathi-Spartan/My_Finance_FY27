// Where the iPhone Shortcut posts. Apple gives no web access to Health, so the
// Shortcut reads the samples and sends them here. Accepts one day or many, and
// upserts so re-sending the same day corrects rather than duplicates.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

const FIELDS = [
  'steps', 'distance_km', 'flights', 'active_kcal', 'exercise_min', 'stand_hours',
  'sleep_min', 'sleep_deep_min', 'sleep_rem_min', 'resting_hr', 'hrv',
  'weight_kg', 'body_fat',
];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export async function POST(req) {
  const token = req.headers.get('x-sync-key');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  const expected = process.env.HEALTH_SYNC_KEY;
  const userId = process.env.HEALTH_SYNC_USER;

  if (!url || !service || !expected || !userId) {
    return Response.json({
      message: 'Sync is not configured. Set HEALTH_SYNC_KEY, HEALTH_SYNC_USER and SUPABASE_SERVICE_ROLE.',
    }, { status: 500 });
  }
  if (token !== expected) {
    return Response.json({ message: 'Wrong or missing x-sync-key' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ message: 'Body must be JSON' }, { status: 400 }); }

  const rows = Array.isArray(body) ? body : [body];
  const clean = [];
  const rejected = [];

  for (const r of rows) {
    const date = String(r.date || r.on_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { rejected.push({ row: r, why: 'no valid date' }); continue; }
    const out = { user_id: userId, on_date: date, source: 'shortcut', updated_at: new Date().toISOString() };
    let any = false;
    for (const f of FIELDS) {
      const v = num(r[f]);
      if (v !== null) { out[f] = v; any = true; }
    }
    if (!any) { rejected.push({ row: r, why: 'no readable measurements' }); continue; }
    clean.push(out);
  }

  if (!clean.length) {
    return Response.json({ message: 'Nothing usable in that payload', rejected }, { status: 400 });
  }

  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('health_days')
    .upsert(clean, { onConflict: 'user_id,on_date' })
    .select('on_date');

  if (error) return Response.json({ message: error.message }, { status: 500 });

  return Response.json({
    saved: data?.length || 0,
    dates: (data || []).map((d) => d.on_date),
    rejected: rejected.length,
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    how: 'POST JSON here with x-sync-key. One object or an array of them.',
    shape: { date: 'YYYY-MM-DD', ...Object.fromEntries(FIELDS.map((f) => [f, 'number'])) },
  });
}
