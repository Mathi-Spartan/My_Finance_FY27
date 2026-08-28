'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Plus, Gear } from './Icons';
import INRNote, { notesFor } from './INRNote';
import {
  money, totals, totalCash, accountBalances, accountFlow,
  splitName, cardStatus, isCard, sessionReport,
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

export default function HomeView({ onAddTo, goTo }) {
  const { accounts, txs, appointments, reload, loading } = useStore();
  const [focus, setFocus] = useState(null); // null = everything
  const [burst, setBurst] = useState(null);
  const prev = useRef(null);

  const live = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const paari = useMemo(() => sessionReport(appointments || []), [appointments]);
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
      <div className="apphead">
        <div className="hi">
          <span className="k">{selected ? 'Account' : 'Everything'}</span>
        </div>
        <div className="spacer" />
        <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
          <Refresh width="16" height="16" />
        </button>
        <button className="icobtn" onClick={() => goTo && goTo('settings')} aria-label="Settings">
          <Gear width="16" height="16" />
        </button>
      </div>

      <div className={'hero wallet' + (selected ? ' focused' : '')}>
        {/* ambient notes drifting behind the figures */}
        <div className="drift-notes" aria-hidden="true">
          {[500, 200, 100, 50, 20].map((v, i) => (
            <INRNote key={v} denom={v} className={'dnote dn' + i} />
          ))}
        </div>

        {/* a short flurry whenever the balance goes up */}
        {burst && (
          <div className="cashfly" key={burst.id} aria-hidden="true">
            {burst.notes.map((v, i) => (
              <INRNote key={i} denom={v} className={'flynote fn' + i} />
            ))}
          </div>
        )}

        <div className="eyebrow">
          <span className="dot" />
          {selected
            ? <>{splitName(selected.name).title} · {splitName(selected.name).sub || (card ? 'Credit card' : 'Account')}</>
            : <>Across {live.length} accounts</>}
        </div>

        <div className={'bignum' + (headline < 0 ? ' neg' : '')} key={focus || 'all'}>
          <span className="cur">{headline < 0 ? '−₹' : '₹'}</span>
          {whole.toLocaleString('en-IN')}
          <span className="cent">.{cents}</span>
        </div>
        {card && <div className="sublabel">available of {money(card.limit)}</div>}

        {/* the money itself, as one bar */}
        {!selected && (
          <div className="spread">
            {spread.sum > 0
              ? spread.holders.filter((h) => h.v > 0).map((h) => {
                  const share = (h.v / spread.sum) * 100;
                  return (
                    <button
                      key={h.a.id}
                      className={'seg-piece ' + TONES[h.i % TONES.length]}
                      style={{ flexGrow: Math.max(h.v, spread.sum * 0.04) }}
                      onClick={() => setFocus(h.a.id)}
                      title={`${splitName(h.a.name).title} · ${money(h.v)}`}
                    >
                      {/* a label only where there's room for one */}
                      {share >= 9 && <span className="segshare">{Math.round(share)}%</span>}
                    </button>
                  );
                })
              : <div className="seg-empty" />}
          </div>
        )}

        <div className="flow">
          <div className="flowcell">
            <span className="fl">In this month</span>
            <span className="fv in">+{money(flowNow.in)}</span>
          </div>
          <div className="flowdiv" />
          <div className="flowcell">
            <span className="fl">Out this month</span>
            <span className="fv out">−{money(flowNow.out)}</span>
          </div>
        </div>

        <div className="netline">
          {selected ? (
            <>
              <button className="ghostchip" onClick={() => setFocus(null)}>← All accounts</button>
              <button className="solidchip" onClick={() => onAddTo && onAddTo(selected.id)}>
                <Plus width="13" height="13" /> Add here
              </button>
            </>
          ) : (
            <>
              <span>Net this month</span>
              <b>{month.net < 0 ? '−' : '+'}{money(month.net)}</b>
            </>
          )}
        </div>
      </div>

      {/* the accounts, as tabs on the one surface */}
      {paari.total.sessions > 0 && (
        <button className="paaristrip" onClick={() => goTo && goTo('paari')}>
          <span className="psleft">
            <span className="psk">Paari · therapy</span>
            <span className="psv">{money(paari.total.netPaid)}</span>
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
  );
}
