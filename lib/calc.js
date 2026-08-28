// A small recursive-descent evaluator so the calculator can hold a whole
// expression — with precedence and brackets — instead of one running total.
// That's what lets us show a live answer while you're still typing.

const isDigit = (c) => c >= '0' && c <= '9';

export function tokenize(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (isDigit(c) || c === '.') {
      let n = '';
      while (i < src.length && (isDigit(src[i]) || src[i] === '.')) n += src[i++];
      t.push({ type: 'num', value: n });
      continue;
    }
    if ('+-×÷^'.includes(c)) { t.push({ type: 'op', value: c }); i++; continue; }
    if (c === '−') { t.push({ type: 'op', value: '-' }); i++; continue; }
    if (c === '(' || c === ')') { t.push({ type: 'paren', value: c }); i++; continue; }
    if (c === '%') { t.push({ type: 'pct' }); i++; continue; }
    if (c === '√') { t.push({ type: 'fn', value: 'sqrt' }); i++; continue; }
    i++; // ignore anything else
  }
  return t;
}

// grammar:
//   expr   := term (('+' | '-') term)*
//   term   := unary (('×' | '÷') unary)*
//   unary  := '-' unary | '√' unary | power
//   power  := atom ('^' unary)?
//   atom   := number postfix* | '(' expr ')'
//   postfix:= '%'
export function evaluate(src) {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p];
  const eat = (pred) => (peek() && pred(peek()) ? t[p++] : null);

  function expr() {
    let left = term();
    for (;;) {
      const op = eat((x) => x.type === 'op' && (x.value === '+' || x.value === '-'));
      if (!op) return left;
      const right = term();
      // 200 + 10% means 10% of 200, which is how every calculator behaves
      if (right && right.pct) left = op.value === '+' ? left + (left * right.value) / 100 : left - (left * right.value) / 100;
      else left = op.value === '+' ? left + val(right) : left - val(right);
    }
  }

  function term() {
    let left = unary();
    for (;;) {
      const op = eat((x) => x.type === 'op' && (x.value === '×' || x.value === '÷'));
      if (!op) return left;
      const right = unary();
      const r = val(right);
      if (op.value === '÷') {
        if (r === 0) throw new Error('divide by zero');
        left = val(left) / r;
      } else left = val(left) * r;
    }
  }

  function unary() {
    if (eat((x) => x.type === 'op' && x.value === '-')) return -val(unary());
    if (eat((x) => x.type === 'fn' && x.value === 'sqrt')) {
      const v = val(unary());
      if (v < 0) throw new Error('root of a negative');
      return Math.sqrt(v);
    }
    return power();
  }

  function power() {
    const base = atom();
    if (eat((x) => x.type === 'op' && x.value === '^')) return Math.pow(val(base), val(unary()));
    return base;
  }

  function atom() {
    if (eat((x) => x.type === 'paren' && x.value === '(')) {
      const v = expr();
      eat((x) => x.type === 'paren' && x.value === ')');
      return v;
    }
    const n = eat((x) => x.type === 'num');
    if (!n) throw new Error('incomplete');
    let v = Number(n.value);
    if (Number.isNaN(v)) throw new Error('bad number');
    // trailing % on its own is just /100, unless a + or - claims it above
    if (peek() && peek().type === 'pct') {
      p++;
      return { pct: true, value: v, valueOf: () => v / 100 };
    }
    return v;
  }

  const val = (x) => (x && typeof x === 'object' && 'pct' in x ? x.value / 100 : x);

  const out = val(expr());
  if (!isFinite(out)) throw new Error('not a number');
  return out;
}

// Round away binary floating point noise: 0.1 + 0.2 should be 0.3.
export const tidy = (n) => {
  const r = Math.round(n * 1e10) / 1e10;
  return String(r);
};

// What a person would type next — used to stop nonsense like "5++".
export function canAppend(expr, key) {
  const last = expr[expr.length - 1];
  const ops = '+−×÷^';
  if (ops.includes(key)) {
    if (expr === '') return key === '−';
    if (ops.includes(last)) return 'replace';
    if (last === '(') return key === '−';
    return true;
  }
  if (key === '.') {
    const tail = expr.split(/[+−×÷^()]/).pop();
    return !tail.includes('.');
  }
  if (key === ')') {
    const open = (expr.match(/\(/g) || []).length;
    const close = (expr.match(/\)/g) || []).length;
    return open > close && last !== '(' && !ops.includes(last);
  }
  if (key === '%') return expr !== '' && (isDigit(last) || last === ')' || last === '%');
  return true;
}

export function autoClose(expr) {
  const open = (expr.match(/\(/g) || []).length;
  const close = (expr.match(/\)/g) || []).length;
  return expr + ')'.repeat(Math.max(0, open - close));
}

// Group the integer part Indian-style without disturbing what's being typed.
export function prettyExpr(expr) {
  return expr.replace(/\d+(\.\d*)?/g, (m) => {
    const [w, d] = m.split('.');
    const gw = Number(w).toLocaleString('en-IN');
    return d === undefined ? gw : `${gw}.${d}`;
  });
}

export function prettyNumber(n, maxDec = 6) {
  if (!isFinite(n)) return 'Error';
  const neg = n < 0;
  const v = Math.abs(n);
  let s = String(Math.round(v * 1e10) / 1e10);
  if (s.includes('e')) return (neg ? '−' : '') + v.toExponential(4);
  let [w, d] = s.split('.');
  if (d && d.length > maxDec) {
    s = v.toFixed(maxDec).replace(/0+$/, '').replace(/\.$/, '');
    [w, d] = s.split('.');
  }
  const gw = Number(w).toLocaleString('en-IN');
  return (neg ? '−' : '') + (d ? `${gw}.${d}` : gw);
}
