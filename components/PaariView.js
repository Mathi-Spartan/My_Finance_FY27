'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Check, Close, Plus, Back } from './Icons';
import Portal from './Portal';
import ImportSchedule from './ImportSchedule';
import { money } from '@/lib/finance';

const THERAPY_TONE = { Speech: 'th-speech', Occupational: 'th-occ' };

const fmtDay = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return {
    num: d.getDate(),
    dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    long: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    month: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    key: iso.slice(0, 7),
  };
};

export default function PaariView() {
  const { appointments, setAppointmentStatus, addAppointment, importAppointments, reload, loading, say } = useStore();
  const [monthKey, setMonthKey] = useState('2026-09');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState(null);

  const months = useMemo(() => {
    const set = [...new Set(appointments.map((a) => a.on_date.slice(0, 7)))].sort();
    return set.length ? set : ['2026-09'];
  }, [appointments]);

  const inMonth = useMemo(
    () => appointments
      .filter((a) => a.on_date.startsWith(monthKey))
      .sort((a, b) => (a.on_date === b.on_date ? a.slot.localeCompare(b.slot) : a.on_date.localeCompare(b.on_date))),
    [appointments, monthKey]
  );

  const shown = useMemo(
    () => (filter === 'all' ? inMonth : inMonth.filter((a) => a.status === filter)),
    [inMonth, filter]
  );

  // Everything is paid up front. Missing a class burns the money; a trainer
  // cancellation comes back in full.
  const sums = useMemo(() => {
    const s = {
      planned: 0, attended: 0, missed: 0, cancelled: 0,
      attendedAmt: 0, missedAmt: 0, plannedAmt: 0, refundAmt: 0, total: 0,
    };
    inMonth.forEach((a) => {
      const amt = Number(a.amount) || 0;
      s.total += amt;
      s[a.status] = (s[a.status] || 0) + 1;
      if (a.status === 'attended') s.attendedAmt += amt;
      else if (a.status === 'missed') s.missedAmt += amt;
      else if (a.status === 'cancelled') s.refundAmt += amt;
      else s.plannedAmt += amt;
    });
    return s;
  }, [inMonth]);

  // refunds owed across every month, not just the one on screen
  const refundAll = useMemo(() => {
    const list = appointments.filter((a) => a.status === 'cancelled');
    return { count: list.length, amount: list.reduce((t, a) => t + (Number(a.amount) || 0), 0) };
  }, [appointments]);

  const byTherapy = useMemo(() => {
    const m = {};
    inMonth.forEach((a) => {
      if (!m[a.therapy]) m[a.therapy] = { name: a.therapy, count: 0, total: 0, attended: 0 };
      m[a.therapy].count++;
      m[a.therapy].total += Number(a.amount) || 0;
      if (a.status === 'attended') m[a.therapy].attended++;
    });
    return Object.values(m);
  }, [inMonth]);


  const idx = months.indexOf(monthKey);
  const label = fmtDay(monthKey + '-01').month;
  const done = sums.attended + sums.missed;
  const progress = inMonth.length ? (done / inMonth.length) * 100 : 0;

  return (
    <div className="body">
      <div className="pagehead">
        <h2>Paari</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
            <Refresh width="16" height="16" />
          </button>
          <button className="mini ghosty" onClick={() => setImporting(true)}>Import</button>
          <button className="icobtn" onClick={() => setAdding(true)} aria-label="Add session">
            <Plus width="16" height="16" />
          </button>
        </div>
      </div>

      <div className="periodbar">
        <button className="icobtn" disabled={idx <= 0} onClick={() => setMonthKey(months[idx - 1])} aria-label="Previous month">
          <Back width="15" height="15" />
        </button>
        <div className="periodtitle"><span>{label}</span></div>
        <button className="icobtn" disabled={idx >= months.length - 1} onClick={() => setMonthKey(months[idx + 1])} aria-label="Next month">
          <Back width="15" height="15" style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>

      <div className="hero paarihero">
        <div className="eyebrow"><span className="dot" />{inMonth.length} sessions · paid in advance</div>
        <div className="bignum">
          <span className="cur">₹</span>{Math.round(sums.total).toLocaleString('en-IN')}
        </div>
        <div className="sublabel">paid for {label}</div>

        <div className="attbar">
          <span className="attfill used" style={{ width: (sums.total ? (sums.attendedAmt / sums.total) * 100 : 0) + '%' }} />
          <span className="attfill lost" style={{ width: (sums.total ? (sums.missedAmt / sums.total) * 100 : 0) + '%' }} />
          <span className="attfill back" style={{ width: (sums.total ? (sums.refundAmt / sums.total) * 100 : 0) + '%' }} />
        </div>

        <div className="paarigrid">
          <div className="pg">
            <span className="k">Used</span>
            <span className="v">{money(sums.attendedAmt)}</span>
            <span className="d">{sums.attended} attended</span>
          </div>
          <div className="pg">
            <span className="k">Lost</span>
            <span className="v">{money(sums.missedAmt)}</span>
            <span className="d">{sums.missed} missed · no refund</span>
          </div>
          <div className="pg">
            <span className="k">Coming back</span>
            <span className="v">{money(sums.refundAmt)}</span>
            <span className="d">{sums.cancelled} cancelled</span>
          </div>
        </div>

        <div className="netline" style={{ marginTop: 12 }}>
          {byTherapy.map((t) => (
            <span key={t.name} className="thchip">
              {t.name} · {t.attended}/{t.count}
            </span>
          ))}
        </div>
      </div>

      {refundAll.count > 0 && (
        <div className="refundbar">
          <span className="rbk">Refund balance</span>
          <span className="rbv">{money(refundAll.amount)}</span>
          <span className="rbd">
            {refundAll.count} cancelled {refundAll.count === 1 ? 'session' : 'sessions'} across all months
          </span>
        </div>
      )}

      <div className="filterrail">
        {[
          ['all', `All ${inMonth.length}`],
          ['planned', `To go ${sums.planned}`],
          ['attended', `Attended ${sums.attended}`],
          ['missed', `Missed ${sums.missed}`],
          ['cancelled', `Cancelled ${sums.cancelled}`],
        ].map(([k, l]) => (
          <button key={k} className={'fchip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="note" style={{ margin: 0 }}>Nothing here for this filter.</p>
        </div>
      ) : (
        <div className="stable">
          <div className="sthead">
            <span>Date</span>
            <span>Session</span>
            <span className="ta-r">Amount</span>
          </div>

          {shown.map((a) => {
            const d = fmtDay(a.on_date);
            const isOpen = openId === a.id;
            return (
              <div key={a.id} className={'strow-wrap' + (isOpen ? ' open' : '')}>
                <button
                  className={'strow s-' + a.status}
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                >
                  <span className="stdate">
                    <b>{d.num}</b>
                    <em>{d.dow}</em>
                  </span>

                  <span className="stmain">
                    <span className="stname">
                      <i className={'tdot ' + (THERAPY_TONE[a.therapy] || '')} />
                      {a.therapy}
                    </span>
                    <span className="sttime">{a.slot}</span>
                  </span>

                  <span className="stright">
                    <span className="stamt">{money(a.amount)}</span>
                    <span className={'stpill ' + a.status}>
                      {a.status === 'attended' ? 'Attended'
                        : a.status === 'missed' ? 'Missed'
                        : a.status === 'cancelled' ? 'Refund'
                        : '—'}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="stacts">
                    <button className={'sessbtn yes' + (a.status === 'attended' ? ' on' : '')}
                            onClick={() => { setAppointmentStatus(a.id, a.status === 'attended' ? 'planned' : 'attended'); setOpenId(null); }}>
                      <Check width="13" height="13" /> Attended
                    </button>
                    <button className={'sessbtn no' + (a.status === 'missed' ? ' on' : '')}
                            onClick={() => { setAppointmentStatus(a.id, a.status === 'missed' ? 'planned' : 'missed'); setOpenId(null); }}>
                      <Close width="12" height="12" /> I missed
                    </button>
                    <button className={'sessbtn back' + (a.status === 'cancelled' ? ' on' : '')}
                            onClick={() => { setAppointmentStatus(a.id, a.status === 'cancelled' ? 'planned' : 'cancelled'); setOpenId(null); }}>
                      Trainer off
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="stfoot">
            <span>{shown.length} {shown.length === 1 ? 'session' : 'sessions'}</span>
            <b>{money(shown.reduce((t, a) => t + (Number(a.amount) || 0), 0))}</b>
          </div>
        </div>
      )}

      {importing && (
        <ImportSchedule
          onClose={() => setImporting(false)}
          onImport={(rows) => importAppointments(rows)}
        />
      )}

      {adding && (
        <AddSession
          onClose={() => setAdding(false)}
          onSave={async (row) => { await addAppointment(row); setAdding(false); say('Session added'); }}
        />
      )}
    </div>
  );
}

function AddSession({ onSave, onClose }) {
  const [f, setF] = useState({
    therapy: 'Speech',
    on_date: new Date().toISOString().slice(0, 10),
    slot: '11.30 - 12.15',
    amount: '600',
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <div className="sheettitle">Add a session</div>
        <div className="sheetsub">For a session that isn&apos;t on the monthly sheet.</div>

        <div className="field">
          <label>Therapy</label>
          <select value={f.therapy} onChange={(e) => {
            const t = e.target.value;
            setF((p) => ({ ...p, therapy: t, amount: t === 'Speech' ? '600' : '400' }));
          }}>
            <option>Speech</option>
            <option>Occupational</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={f.on_date} onChange={set('on_date')} />
        </div>
        <div className="field">
          <label>Time</label>
          <input value={f.slot} onChange={set('slot')} placeholder="11.30 - 12.15" />
        </div>
        <div className="field">
          <label>Amount (₹)</label>
          <input type="number" inputMode="decimal" value={f.amount} onChange={set('amount')} />
        </div>

        <button className="btn" onClick={() => onSave({ ...f, amount: Number(f.amount) || 0, person: 'Paari' })}>
          Add session
        </button>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </Portal>
  );
}
