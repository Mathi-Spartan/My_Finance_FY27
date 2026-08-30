'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Plus, Gear, Palette, Moon, Sun, Eye, EyeOff } from './Icons';
import { Mark } from './Logo';
import INRNote, { notesFor } from './INRNote';
import {
  money, totals, totalCash, accountBalances, accountFlow,
  splitName, cardStatus, isCard, sessionReport, balanceTrend,
} from '@/lib/finance';

const TONES = ['tone-a', 'tone-b', 'tone-c', 'tone-d', 'tone-e', 'tone-f'];


function useCountUp(target, ms = 700) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      setV(a + (target - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export default function HomeView({ onAddTo, goTo, onShuffle, onThemes, theme, toggleTheme }) {
  const { accounts, txs, appointments, reload, loading } = useStore();
  const [focus, setFocus] = useState(null); // null = everything
  const [burst, setBurst] = useState(null);
  const prev = useRef(null);

  const live = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const paari = useMemo(() => sessionReport(appointments || []), [appointments]);
  const trend = useMemo(() => balanceTrend(txs, accounts, 30), [txs, accounts]);
  const [hidden, setHidden] = useState(false);
  const month = useMemo(() => totals(txs), [txs]);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const flow = useMemo(() => accountFlow(txs), [txs]);
  const total = useMemo(() => totalCash(accounts, txs), [accounts, txs]);

  const selected = focus ? live.find((a) => a.id === focus) : null;
  const card = selected && isCard(selected) ? cardStatus(selected, balances) : null;

  // What the hero is showing right now
  const headline = selected
    ? (card ? card.available : (balances[selected.id] || 0))
    : total;
  const flowNow = selected
    ? (flow[selected.id] || { in: 0, out: 0 })
    : { in: month.in, out: month.out };

  // Money arriving deserves to look like money arriving.
  useEffect(() => {
    if (prev.current !== null && headline > prev.current + 0.005) {
      const gain = headline - prev.current;
      const id = Date.now();
      // fly the notes you'd actually be handed for that amount
      setBurst({ id, notes: notesFor(gain) });
      const t = setTimeout(() => setBurst((b) => (b && b.id === id ? null : b)), 2100);
      prev.current = headline;
      return () => clearTimeout(t);
    }
    prev.current = headline;
  }, [headline]);

  const shown = useCountUp(Math.abs(headline));
  const whole = Math.floor(shown);
  const cents = String(Math.round((shown % 1) * 100)).padStart(2, '0');

  // Segments: only accounts that actually hold money, sized by share.
  const spread = useMemo(() => {
    const holders = live
      .filter((a) => !isCard(a))
      .map((a, i) => ({ a, i, v: Math.max(0, balances[a.id] || 0) }));
    const sum = holders.reduce((s, h) => s + h.v, 0);
    return { holders, sum };
  }, [live, balances]);

  return (
    <div className="body">
      {/* the gradient runs off the top of the screen; the sheet slides over it */}
      <div className="skytop">
        <div className="apphead onsky">
          <div className="brandbar">
            <Mark size={30} />
            <span className="bbtext">
              Kanakku
              <em>{selected ? 'account' : 'every rupee accounted for'}</em>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className={'skybtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
              <Refresh width="16" height="16" />
            </button>
            <button className="skybtn" onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to day' : 'Switch to night'}>
              {theme === 'dark' ? <Sun width="16" height="16" /> : <Moon width="16" height="16" />}
            </button>
            <button className="skybtn" onClick={onShuffle}
                    onContextMenu={(e) => { e.preventDefault(); onThemes && onThemes(); }}
                    aria-label="Next theme">
              <Palette width="16" height="16" />
            </button>
            <button className="skybtn" onClick={() => goTo && goTo('settings')} aria-label="Settings">
              <Gear width="16" height="16" />
            </button>
          </div>
        </div>

        <div className="skylabel">
          {selected ? splitName(selected.name).title : `Across ${live.length} accounts`}
        </div>

        <button className="skybal" onClick={() => setHidden((v) => !v)}>
          <span className="sbnum">
            {hidden ? '₹ • • • • •' : <>₹{Math.floor(shown).toLocaleString('en-IN')}<em>.{String(Math.round((shown % 1) * 100)).padStart(2, '0')}</em></>}
          </span>
          <span className="sbeye">{hidden ? <EyeOff width="15" height="15" /> : <Eye width="15" height="15" />}</span>
        </button>

        <Spark data={trend} />

        <div className="skytiles">
          <div className="skytile">
            <span className="stk">In this month</span>
            <span className="stv">{hidden ? '••••' : money(flowNow.in)}</span>
          </div>
          <div className="skytile">
            <span className="stk">Out this month</span>
            <span className="stv">{hidden ? '••••' : money(flowNow.out)}</span>
          </div>
        </div>
      </div>

      <div className="sheetup">
        <span className="sheetgrab" />

        {paari.total.sessions > 0 && (
          <button className="paaristrip" onClick={() => goTo && goTo('paari')}>
            <span className="psleft">
              <span className="psk">Paari · therapy</span>
              <span className="psv">{hidden ? '••••' : money(paari.total.netPaid)}</span>
              <span className="psd">{paari.months.length} months · {paari.total.sessions} sessions</span>
            </span>
            <span className="psright">
              <span className="psbar">
                <i className="pb used" style={{ flexGrow: Math.max(paari.total.attendedAmt, 0.001) }} />
                <i className="pb lost" style={{ flexGrow: Math.max(paari.total.missedAmt, 0.001) }} />
                <i className="pb open" style={{ flexGrow: Math.max(paari.total.plannedAmt, 0.001) }} />
              </span>
              <span className="pstags">
                <em className="ok">{paari.total.attended} attended</em>
                {paari.total.missed > 0 && <em className="bad">{paari.total.missed} missed</em>}
                {paari.total.refund > 0 && <em className="ref">−{money(paari.total.refund)} refunded</em>}
                {paari.total.planned > 0 && <em>{paari.total.planned} to mark</em>}
              </span>
            </span>
          </button>
        )}

      <div className="chipsrail">
        <button className={'acctchip' + (!focus ? ' on' : '')} onClick={() => setFocus(null)}>
          <span className="cdotall" />
          <span className="cname">All</span>
          <span className="cval">{money(total)}</span>
        </button>
        {live.map((a, i) => {
          const nm = splitName(a.name);
          const c = isCard(a) ? cardStatus(a, balances) : null;
          return (
            <button
              key={a.id}
              className={'acctchip ' + TONES[i % TONES.length] + (focus === a.id ? ' on' : '')}
              style={{ animationDelay: i * 40 + 'ms' }}
              onClick={() => setFocus(focus === a.id ? null : a.id)}
            >
              <span className="cdot" />
              <span className="cname">
                {nm.title}
                {nm.sub && <em>{nm.sub}</em>}
              </span>
              <span className="cval">{money(c ? c.available : (balances[a.id] || 0))}</span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

/* A 30-day line of where the balance has been. No axes, no labels — it is
   there to show shape, not to be read off. */
function Spark({ data }) {
  if (!data || data.length < 2) return null;
  const W = 300, H = 54;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * W,
    H - ((d.value - min) / span) * (H - 10) - 5,
  ]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity=".28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#sparkfill)" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            className="sparkline" />
      <circle cx={last[0]} cy={last[1]} r="3.6" fill="#fff" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
