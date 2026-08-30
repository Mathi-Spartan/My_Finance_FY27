// Where the iPhone Shortcut posts to. Apple gives no web access to Health, so
// the Shortcut reads the samples and sends them here.
//
// POST /api/health-sync
//   headers: x-sync-key: <the key from Settings>
//   body:    { "days": [ { "date":"2026-08-30", "steps":8412, "sleep_min":408, ... } ] }
//   or a single day at the top level, which is what the simplest Shortcut sends.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = [
  'steps', 'distance_km', 'flights', 'active_kcal', 'exercise_min', 'stand_hours',
  'sleep_min', 'sleep_deep_min', 'sleep_rem_min', 'resting_hr', 'hrv',
  'weight_kg', 'body_fat',
];

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const isoDate = (v) => {
  if (!v) return new Date().toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

export async function POST(req) {
  const key = req.headers.get('x-sync-key') || '';
  if (!key) return Response.json({ message: 'Missing x-sync-key' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return Response.json({ message: 'Sync is not configured on the server' }, { status: 500 });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ message: 'Body must be JSON' }, { status: 400 }); }

  const incoming = Array.isArray(body?.days) ? body.days : [body];
  const rows = incoming
    .map((d) => {
      const row = { on_date: isoDate(d?.date || d?.on_date) };
      let any = false;
      FIELDS.forEach((f) => {
        const v = num(d?.[f]);
        if (v !== null) { row[f] = v; any = true; }
      });
      // a Shortcut often sends sleep in hours
      if (row.sleep_min === undefined && num(d?.sleep_hours) !== null) {
        row.sleep_min = Math.round(num(d.sleep_hours) * 60); any = true;
      }
      return any ? row : null;
    })
    .filter(Boolean);

  if (!rows.length) return Response.json({ message: 'Nothing usable in that payload' }, { status: 400 });

  // The key never leaves the server as credentials: a database function checks
  // it and writes only to the account it belongs to.
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.rpc('sync_health', { p_key: key, p_days: rows });
  if (error) return Response.json({ message: error.message }, { status: 500 });
  if (!data?.ok) return Response.json({ message: data?.message || 'Rejected' }, { status: 401 });

  return Response.json({ ok: true, saved: data.saved, dates: rows.map((r) => r.on_date) });
}
