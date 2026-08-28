'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash } from './Icons';

const MAX_DIGITS = 12;

// Trim floating point noise: 0.1 + 0.2 should read 0.3, not 0.30000000000000004.
const clean = (n) => {
  if (!isFinite(n)) return 'Error';
  const r = Math.round(n * 1e10) / 1e10;
  return String(r);
};

const group = (s) => {
  if (s === 'Error') return s;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [w, d] = body.split('.');
  const gw = Number(w).toLocaleString('en-IN');
  return (neg ? '−' : '') + (d === undefined ? gw : `${gw}.${d}`);
};

const apply = (a, b, op) => {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
};

export default function CalculatorView({ onUse }) {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);
  const [mem, setMem] = useState(0);
  const [history, setHistory] = useState([]);
  const [flash, setFlash] = useState(null);
  const [copied, setCopied] = useState(false);
  const tape = useRef(null);

  const value = Number(display) || 0;

  const digit = useCallback((d) => {
    setDisplay((cur) => {
      if (fresh) return d === '.' ? '0.' : d;
      if (d === '.') return cur.includes('.') ? cur : cur + '.';
      if (cur === '0') return d;
      if (cur.replace(/[-.]/g, '').length >= MAX_DIGITS) return cur;
      return cur + d;
    });
    setFresh(false);
  }, [fresh]);

  const chooseOp = useCallback((next) => {
    const v = Number(display) || 0;
    if (acc !== null && op && !fresh) {
      const r = apply(acc, v, op);
      setAcc(r);
      setDisplay(clean(r));
    } else {
      setAcc(v);
    }
    setOp(next);
    setFresh(true);
  }, [display, acc, op, fresh]);

  const equals = useCallback(() => {
    if (acc === null || !op) return;
    const v = Number(display) || 0;
    const r = apply(acc, v, op);
    const line = `${clean(acc)} ${op} ${clean(v)}`;
    setHistory((h) => [{ line, result: clean(r), id: Date.now() }, ...h].slice(0, 30));
    setDisplay(clean(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }, [acc, op, display]);

  const percent = useCallback(() => {
    const v = Number(display) || 0;
    // 200 + 10% means 10% of 200; 200 × 10% just means 0.1
    const r = (op === '+' || op === '−') && acc !== null ? (acc * v) / 100 : v / 100;
    setDisplay(clean(r));
    setFresh(false);
  }, [display, op, acc]);

  const clearAll = () => { setDisplay('0'); setAcc(null); setOp(null); setFresh(true); };
  const clearEntry = () => { setDisplay('0'); setFresh(true); };
  const back = () => setDisplay((c) => (c.length <= 1 || (c.length === 2 && c.startsWith('-')) ? '0' : c.slice(0, -1)));
  const sign = () => setDisplay((c) => (c.startsWith('-') ? c.slice(1) : c === '0' ? c : '-' + c));

  const press = (key) => {
    setFlash(key);
    setTimeout(() => setFlash(null), 140);
    if (navigator.vibrate) navigator.vibrate(6);

    if (/^[0-9.]$/.test(key)) return digit(key);
    if (['+', '−', '×', '÷'].includes(key)) return chooseOp(key);
    if (key === '=') return equals();
    if (key === '%') return percent();
    if (key === 'AC') return clearAll();
    if (key === 'C') return clearEntry();
    if (key === '⌫') return back();
    if (key === '±') return sign();
    if (key === 'M+') return setMem((m) => m + value);
    if (key === 'M−') return setMem((m) => m - value);
    if (key === 'MR') { setDisplay(clean(mem)); setFresh(false); return; }
    if (key === 'MC') return setMem(0);
  };

  // physical keyboard, for when you're on a laptop
  useEffect(() => {
    const map = { '*': '×', 'x': '×', '/': '÷', '-': '−', 'Enter': '=', '=': '=', 'Backspace': '⌫', 'Escape': 'AC', '%': '%' };
    const onKey = (e) => {
      const k = map[e.key] || e.key;
      if (/^[0-9.]$/.test(k) || ['+', '−', '×', '÷', '=', '%', 'AC', '⌫'].includes(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked, no harm */ }
  };

  const size = display.length > 12 ? 'sm' : display.length > 8 ? 'md' : 'lg';

  const KEYS = [
    ['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'],
    ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
    ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
    ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
    ['0', 'wide'], ['.', ''], ['=', 'eq'],
  ];

  return (
    <div className="body calcbody">
      <div className="pagehead">
        <h2>Calculator</h2>
        {history.length > 0 && (
          <button className="icobtn" onClick={() => setHistory([])} aria-label="Clear history">
            <Trash width="15" height="15" />
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="tape" ref={tape}>
          {history.map((h) => (
            <button key={h.id} className="tapeline" onClick={() => { setDisplay(h.result); setFresh(true); }}>
              <span className="tl">{h.line}</span>
              <span className="tr">{group(h.result)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="calcdisplay">
        <div className="calcmeta">
          {mem !== 0 && <span className="mchip">M {group(clean(mem))}</span>}
          {acc !== null && op && <span className="pending">{group(clean(acc))} {op}</span>}
          <span className="spacer" />
          <button className="mini" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          {onUse && (
            <button className="mini solid" onClick={() => onUse(Math.abs(value))}>Use as entry</button>
          )}
        </div>
        <div className={'calcvalue ' + size} key={display}>{group(display)}</div>
      </div>

      <div className="memrow">
        {['MC', 'MR', 'M+', 'M−'].map((k) => (
          <button key={k} className={'memkey' + (flash === k ? ' hit' : '')} onClick={() => press(k)}>{k}</button>
        ))}
      </div>

      <div className="calcpad">
        {KEYS.map(([k, kind]) => (
          <button
            key={k}
            className={`ckey ${kind} ${flash === k ? 'hit' : ''}`}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
        <button className={'ckey fn del' + (flash === '⌫' ? ' hit' : '')} onClick={() => press('⌫')}>⌫</button>
      </div>
    </div>
  );
}
