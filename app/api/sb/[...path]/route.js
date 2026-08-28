// Same-origin proxy to Supabase.
//
// Some networks silently drop POST requests to supabase.co while letting GETs
// through, which hangs sign-in with no error. The browser talks only to this
// app's own domain; the server does the Supabase call.

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

const FORWARD_REQ = [
  'apikey',
  'authorization',
  'content-type',
  'accept',
  'accept-profile',
  'content-profile',
  'prefer',
  'range',
  'x-client-info',
  'x-supabase-api-version',
];

const FORWARD_RES = [
  'content-type',
  'content-range',
  'content-location',
  'x-supabase-api-version',
];

async function handler(req, ctx) {
  if (!BASE) {
    return Response.json({ message: 'Supabase URL is not configured' }, { status: 500 });
  }

  const params = await ctx.params;
  const path = (params?.path || []).join('/');
  const search = new URL(req.url).search;
  const target = `${BASE}/${path}${search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQ) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();

  let upstream;
  try {
    upstream = await fetch(target, { method, headers, body, cache: 'no-store', redirect: 'manual' });
  } catch (e) {
    return Response.json(
      { message: `Could not reach Supabase: ${e?.message || 'unknown error'}` },
      { status: 502 }
    );
  }

  const out = new Headers();
  for (const name of FORWARD_RES) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  const location = upstream.headers.get('location');
  if (location) out.set('location', location);
  out.set('cache-control', 'no-store');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;

export const dynamic = 'force-dynamic';
