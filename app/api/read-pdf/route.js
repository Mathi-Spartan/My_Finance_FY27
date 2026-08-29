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
// pdf.js expects a handful of browser globals even when only reading text.
// These are the minimum it touches; none of them affect the extracted text.
function shim() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init) {
        const v = Array.isArray(init) ? init
          : typeof init === 'string' ? init.replace(/matrix\(|\)/g, '').split(',').map(Number)
          : [1, 0, 0, 1, 0, 0];
        [this.a, this.b, this.c, this.d, this.e, this.f] =
          v.length === 6 ? v : [1, 0, 0, 1, 0, 0];
      }
      static fromMatrix(m) { return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]); }
      multiply(o) {
        return new DOMMatrix([
          this.a * o.a + this.c * o.b,
          this.b * o.a + this.d * o.b,
          this.a * o.c + this.c * o.d,
          this.b * o.c + this.d * o.d,
          this.a * o.e + this.c * o.f + this.e,
          this.b * o.e + this.d * o.f + this.f,
        ]);
      }
      translate(x = 0, y = 0) { return this.multiply(new DOMMatrix([1, 0, 0, 1, x, y])); }
      scale(x = 1, y = x) { return this.multiply(new DOMMatrix([x, 0, 0, y, 0, 0])); }
      inverse() {
        const det = this.a * this.d - this.b * this.c;
        if (!det) return new DOMMatrix();
        return new DOMMatrix([
          this.d / det, -this.b / det, -this.c / det, this.a / det,
          (this.c * this.f - this.d * this.e) / det,
          (this.b * this.e - this.a * this.f) / det,
        ]);
      }
      invertSelf() { return Object.assign(this, this.inverse()); }
      transformPoint(p = { x: 0, y: 0 }) {
        return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f };
      }
      toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class Path2D {
      constructor() {} addPath() {} moveTo() {} lineTo() {} bezierCurveTo() {}
      quadraticCurveTo() {} closePath() {} rect() {} arc() {}
    };
  }
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      constructor(d, w, h) { this.data = d; this.width = w; this.height = h; }
    };
  }
}

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
    shim();
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
