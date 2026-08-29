// Pulls the text out of a PDF on the server, where the JavaScript engine is a
// known quantity. Doing this in the browser proved unreliable across phones.
// The file is read in memory and never written anywhere.
//
// The node: prefix matters — plain 'module' gets rewritten by the bundler into
// a wrapper whose createRequire is undefined.
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Any literal passed to .resolve() gets replaced by the bundler with a stub
// that throws, so the path is assembled at runtime from parts instead.
const PKG = ['pdfjs-dist', 'legacy', 'build'];
function findFile(name) {
  const roots = [process.cwd(), join(process.cwd(), '..'), '/var/task'];
  for (const root of roots) {
    const p = join(root, 'node_modules', ...PKG, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  let body;
  try {
    body = await req.arrayBuffer();
  } catch {
    return Response.json({ message: 'Could not read the upload' }, { status: 400 });
  }
  if (!body || body.byteLength === 0) {
    return Response.json({ message: 'Empty file' }, { status: 400 });
  }
  if (body.byteLength > 25 * 1024 * 1024) {
    return Response.json({ message: 'That PDF is larger than 25 MB' }, { status: 413 });
  }

  const password = req.headers.get('x-pdf-password') || undefined;

  try {
    // Webpack rewrites and minifies anything it can see, which breaks pdf.js.
    // Resolve the real file on disk and import it at runtime so the bundler
    // leaves it alone entirely.
    const main = findFile('pdf.mjs');
    if (!main) {
      return Response.json({ message: 'The PDF engine is missing from this deployment.' }, { status: 500 });
    }
    const pdfjs = await import(/* webpackIgnore: true */ pathToFileURL(main).href);
    const worker = findFile('pdf.worker.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = worker || '';
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(body),
      password,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
    }).promise;

    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // PDFs carry no line breaks; rebuild rows from the y position of each run
      const lines = {};
      for (const item of content.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5]);
        (lines[y] = lines[y] || []).push({ x: item.transform[4], s: item.str });
      }
      Object.keys(lines)
        .sort((a, b) => b - a)
        .forEach((y) => {
          text += lines[y].sort((a, b) => a.x - b.x).map((o) => o.s).join(' ') + '\n';
        });
      page.cleanup();
    }
    if (typeof doc.cleanup === 'function') doc.cleanup();

    return Response.json({ text, pages: doc.numPages });
  } catch (e) {
    const m = e?.message || String(e);
    if (/password/i.test(m) || e?.name === 'PasswordException') {
      return Response.json({ error: 'password', message: 'This statement needs a password.' }, { status: 401 });
    }
    return Response.json({ message: m.slice(0, 300)}, { status: 422 });
  }
}
