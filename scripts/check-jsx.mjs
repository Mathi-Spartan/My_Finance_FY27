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

console.log(bad === 0 ? 'check-jsx: all components resolve' : `check-jsx: ${bad} unresolved`);
process.exit(bad === 0 ? 0 : 1);
