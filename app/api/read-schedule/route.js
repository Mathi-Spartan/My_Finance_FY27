// Reads a photographed schedule into text using Claude's vision model.
// Needs ANTHROPIC_API_KEY in the environment; without it we say so plainly
// rather than failing in a way that looks like a bug.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROMPT = `This image is a therapy session schedule. Transcribe every session row as plain text, one per line, in this exact shape:

DATE | WEEKDAY | TIME | AMOUNT

Rules:
- Keep the date exactly as printed (for example 02/09/2026).
- Keep the time range exactly as printed (for example 11.30 - 12.15).
- Amount as digits only, no currency symbol.
- Before each group of rows, put the therapy name on its own line, exactly as printed (for example "Speech Therapy").
- Do not include total rows, headers, signatures or any commentary.
- If a cell is unreadable, leave it empty but keep the separators.

Output only those lines and nothing else.`;

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({
      error: 'no_key',
      message: 'Reading images needs an ANTHROPIC_API_KEY set in the Vercel project. Paste the text instead, or add the key and redeploy.',
    }, { status: 400 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ message: 'Bad request' }, { status: 400 }); }

  const { image, mediaType } = body || {};
  if (!image) return Response.json({ message: 'No image supplied' }, { status: 400 });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: image } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ message: data?.error?.message || 'The vision request failed' }, { status: 502 });
    }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return Response.json({ text });
  } catch (e) {
    return Response.json({ message: e?.message || 'Could not reach the vision API' }, { status: 502 });
  }
}
