'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash, Close, Check } from './Icons';
import Portal from './Portal';
import { evaluate, prettyExpr, prettyNumber, canAppend, autoClose } from '@/lib/calc';

const PADS = {
  basic: [
    ['AC', 'fn'], ['(', 'fn'], [')', 'fn'], ['÷', 'op'],
    ['7', ''],    ['8', ''],   ['9', ''],   ['×', 'op'],
    ['4', ''],    ['5', ''],   ['6', ''],   ['−', 'op'],
    ['1', ''],    ['2', ''],   ['3', ''],   ['+', 'op'],
    ['%', 'fn'],  ['0', ''],   ['.', ''],   ['=', 'eq'],
  ],
  more: [
    ['√', 'fn'], ['^', 'fn'], ['1/x', 'fn'], ['÷', 'op'],
    ['7', ''],   ['8', ''],   ['9', ''],     ['×', 'op'],
    ['4', ''],   ['5', ''],   ['6', ''],     ['−', 'op'],
    ['1', ''],   ['2', ''],   ['3', ''],     ['+', 'op'],
    ['±', 'fn'], ['0', ''],   ['.', ''],     ['=', 'eq'],
  ],
};

// Quick answers that actually come up when you're logging money.
const QUICK = [
  { label: '+5% GST', apply: (e) => `(${e})×1.05` },
  { label: '+12%', apply: (e) => `(${e})×1.12` },
  { label: '+18%', apply: (e) => `(${e})×1.18` },
  { label: '÷2', apply: (e) => `(${e})÷2` },
  { label: '÷3', apply: (e) => `(${e})÷3` },
  { label: '×12', apply: (e) => `(${e})×12` },
];

export default function CalculatorView({ onUse }) {
  const [expr, setExpr] = useState('');
  const [pad, setPad] = useState('basic');
  const [history, setHistory] = useState([]);
  const [showTape, setShowTape] = useState(false);
  const [mem, setMem] = useState(0);
  const [copied, setCopied] = useState(false);
  const [justSolved, setJustSolved] = useState(false);
  const [ripples, setRipples] = useState([]);
  const exprRef = useRef(null);

  // The answer, recomputed on every keystroke — this is the whole point.
  const live = useMemo(() => {
    if (!expr) return { ok: true, value: 0, empty: true };
    try {
      return { ok: true, value: evaluate(autoClose(expr)) };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }, [expr]);

  // keep the long expression scrolled to where you're typing
  useEffect(() => {
    if (exprRef.current) exprRef.current.scrollLeft = exprRef.current.scrollWidth;
  }, [expr]);

  const ripple = (e) => {
    // Read everything off the event synchronously: React pools the event and
    // currentTarget is null by the time the state updater runs.
    const el = e.currentTarget;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const key = el.dataset.k;
    const x = (e.clientX ?? box.left + box.width / 2) - box.left;
    const y = (e.clientY ?? box.top + box.height / 2) - box.top;
    const id = Date.now() + Math.random();
    setRipples((r) => [...r.slice(-8), { id, x, y, key }]);
    setTimeout(() => setRipples((r) => r.filter((v) => v.id !== id)), 520);
  };

  const solve = useCallback(() => {
    if (!expr || !live.ok) return;
    const closed = autoClose(expr);
    const result = prettyNumber(live.value).replace(/,/g, '').replace('−', '-');
    setHistory((h) => [{ id: Date.now(), expr: closed, result }, ...h].slice(0, 40));
    setExpr(result);
    setJustSolved(true);
    setTimeout(() => setJustSolved(false), 600);
    if (navigator.vibrate) navigator.vibrate(14);
  }, [expr, live]);

  const press = useCallback((key) => {
    if (navigator.vibrate) navigator.vibrate(5);

    if (key === 'AC') { setExpr(''); return; }
    if (key === '⌫') { setExpr((e) => e.slice(0, -1)); return; }
    if (key === '=') { solve(); return; }
    if (key === '1/x') { setExpr((e) => (e ? `1÷(${e})` : '')); return; }
    if (key === '±') {
      setExpr((e) => (e.startsWith('−') ? e.slice(1) : e ? `−${e}` : ''));
      return;
    }
    if (key === 'MR') { setExpr((e) => e + String(mem)); return; }
    if (key === 'M+') { if (live.ok) setMem((m) => m + live.value); return; }
    if (key === 'M−') { if (live.ok) setMem((m) => m - live.value); return; }
    if (key === 'MC') { setMem(0); return; }

    setExpr((e) => {
      // a fresh result gets replaced by a digit, but continued by an operator
      const base = justSolved && /[0-9.]/.test(key) ? '' : e;
      const allow = canAppend(base, key);
      if (allow === 'replace') return base.slice(0, -1) + key;
      if (!allow) return base;
      return base + key;
    });
    setJustSolved(false);
  }, [solve, mem, live, justSolved]);

  // physical keyboard
  useEffect(() => {
    const map = { '*': '×', x: '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'AC' };
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey) return;
      const k = map[e.key] || e.key;
      if (/^[0-9.()%^]$/.test(k) || ['×', '÷', '−', '+', '=', '⌫', 'AC'].includes(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(live.ok ? prettyNumber(live.value).replace(/,/g, '') : '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch { /* clipboard unavailable */ }
  };

  // swipe left across the display to delete
  const touch = useRef(null);
  const onTouchStart = (e) => (touch.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touch.current === null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (dx < -46) press('⌫');
    touch.current = null;
  };

  const resultText = live.empty ? '0' : live.ok ? prettyNumber(live.value) : '—';
  const size = resultText.length > 13 ? 'sm' : resultText.length > 9 ? 'md' : 'lg';

  return (
    <div className="body calcbody">
      <div className="pagehead calchead">
        <h2>Calculator</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {mem !== 0 && <button className="mini ghosty" onClick={() => press('MR')}>M {prettyNumber(mem)}</button>}
          <button className="mini ghosty" onClick={() => setShowTape(true)} disabled={!history.length}>
            History{history.length ? ` · ${history.length}` : ''}
          </button>
        </div>
      </div>

      {/* display: expression on top, live answer underneath */}
      <div className={'calcdisplay v2' + (justSolved ? ' solved' : '')}
           onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="exprline" ref={exprRef}>
          {expr ? prettyExpr(expr) : <span className="ph">Start typing</span>}
          <span className="caret" />
        </div>

        <div className={'resultline ' + size + (live.ok ? '' : ' bad')}>
          {!live.empty && live.ok && <span className="eq">=</span>}
          <span className="rv">{resultText}</span>
        </div>

        <div className="dispacts">
          <button className="mini" onClick={() => press('⌫')}>⌫</button>
          <button className="mini" onClick={() => press('MC')} disabled={mem === 0}>MC</button>
          <button className="mini" onClick={() => press('M+')}>M+</button>
          <button className="mini" onClick={() => press('M−')}>M−</button>
          <span className="spacer" />
          <button className="mini" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          {onUse && live.ok && !live.empty && (
            <button className="mini solid" onClick={() => onUse(Math.abs(live.value))}>Use</button>
          )}
        </div>
      </div>

      {/* one-tap common maths */}
      <div className="quickrail">
        {QUICK.map((q) => (
          <button key={q.label} className="qchip" disabled={!expr || !live.ok}
                  onClick={() => { setExpr(q.apply(autoClose(expr))); setJustSolved(false); }}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="padswitch">
        <button className={pad === 'basic' ? 'on' : ''} onClick={() => setPad('basic')}>Basic</button>
        <button className={pad === 'more' ? 'on' : ''} onClick={() => setPad('more')}>More</button>
      </div>

      <div className={'calcpad v2 ' + pad} key={pad}>
        {PADS[pad].map(([k, kind], i) => (
          <button
            key={k + i}
            data-k={k}
            className={`ckey ${kind}`}
            style={{ animationDelay: i * 12 + 'ms' }}
            onPointerDown={ripple}
            onClick={() => press(k)}
          >
            <span className="klabel">{k}</span>
            {ripples.filter((r) => r.key === k).map((r) => (
              <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
            ))}
          </button>
        ))}
      </div>

      {showTape && (
        <Portal>
          <div className="scrim" onClick={() => setShowTape(false)} />
          <div className="sheet tapesheet">
            <div className="grab" />
            <div className="flowhead" style={{ marginBottom: 14 }}>
              <div className="sheettitle">History</div>
              <div className="spacer" />
              <button className="mini ghosty" onClick={() => { setHistory([]); setShowTape(false); }}>
                <Trash width="13" height="13" /> Clear
              </button>
              <button className="icobtn" onClick={() => setShowTape(false)} aria-label="Close">
                <Close width="15" height="15" />
              </button>
            </div>
            <div className="tapelist">
              {history.map((h) => (
                <button key={h.id} className="tapeline"
                        onClick={() => { setExpr(h.result); setShowTape(false); setJustSolved(true); }}>
                  <span className="tl">{prettyExpr(h.expr)}</span>
                  <span className="tr">{prettyNumber(Number(h.result))}</span>
                </button>
              ))}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
