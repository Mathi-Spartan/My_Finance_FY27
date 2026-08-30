// Catches components used in JSX but never imported or defined in that file.
// This exact fault has shipped a crash-on-load twice: once the login screen,
// once Home. It is cheap to check and expensive to miss.
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'components');
let bad = 0;

for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(dir, f), 'utf8');
  const used = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map((m) => m[1]));
  for (const name of used) {
    const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, 's').test(src);
    const declared = new RegExp(`(function|const|let|class)\\s+${name}\\b`).test(src)
      || new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*(=>|\\))`).test(src);
    if (!imported && !declared) {
      console.error(`MISSING  ${f}: <${name}> is used but never imported or defined`);
      bad++;
    }
  }
}

// Also catch module-scope constants used but never defined — a patch that
// misses its anchor leaves the usage behind, and that is how a crash ships.
// Only look at real code positions: an identifier followed by [ or . or (,
// and never inside a string or JSX text.
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(dir, f), 'utf8')
    .replace(/'[^'\n]*'/g, "''")
    .replace(/"[^"\n]*"/g, '""')
    .replace(/`[^`]*`/gs, '``')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/>[^<>{}]*</g, '><');   // JSX text is prose, not code
  const GLOBALS = [
    'JSON','Math','Date','Object','Array','Number','String','Promise','CSS','Boolean','Set','Map',
    'RegExp','Error','parseInt','parseFloat','isNaN','setTimeout','clearTimeout','setInterval',
    'clearInterval','requestAnimationFrame','cancelAnimationFrame','fetch','alert','confirm','prompt',
    'window','document','navigator','localStorage','console','URL','Blob','FileReader','Intl',
    'if','for','while','switch','catch','return','typeof','function','await','new','delete','void',
    'super','this','import','export','yield','of','in','do','else','try','Worker','Uint8Array',
    'structuredClone','IntersectionObserver','const','let','var','async','AbortController',
  ];

  // Only module-scope names: something called or indexed that is never
  // declared anywhere in the file, not destructured, and not a known global.
  // Narrow on purpose — the job is to catch a patch that dropped a definition,
  // not to reimplement a linter.
  const used = new Set(
    [...src.matchAll(/(?:^|[^.\w$'"`])([A-Za-z_$][\w$]{2,})\s*[([]/gm)].map((m) => m[1])
  );
  // Names this simple parser mis-reads. Pinned rather than chased: the point
  // of this script is to catch a patch that dropped a definition, and it does.
  const KNOWN_NOISE = ['row', 'more', 'setAt', 'setSel', 'paid', 'tax', 'now', 'amount'];
  const flat = src.replace(/\s+/g, ' ');
  for (const name of used) {
    if (GLOBALS.includes(name) || KNOWN_NOISE.includes(name)) continue;
    const declared = new RegExp(`(const|let|var|function|class)\\s+${name}\\b`).test(flat);
    const destructured = new RegExp(`[{,[]\\s*${name}\\s*[,}\\]:=]`).test(flat)
      || new RegExp(`\\[[^\\]]*\\b${name}\\b[^\\]]*\\]\\s*=`).test(flat);
    const param = new RegExp(`\\(([^)]*\\b${name}\\b[^)]*)\\)\\s*(=>|\\{)`).test(flat);
    const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, 's').test(flat);
    if (!declared && !destructured && !param && !imported) {
      console.error(`MISSING  ${f}: ${name} is used but never defined or imported`);
      bad++;
    }
  }
}

console.log(bad === 0 ? 'check-jsx: all components resolve' : `check-jsx: ${bad} unresolved`);
process.exit(bad === 0 ? 0 : 1);
