'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Check, Close, Plus, Back } from './Icons';
import Portal from './Portal';
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
  const { appointments, setAppointmentStatus, addAppointment, reload, loading, say } = useStore();
  const [monthKey, setMonthKey] = useState('2026-09');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);

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

  const sums = useMemo(() => {
    const s = { planned: 0, attended: 0, missed: 0, attendedAmt: 0, missedAmt: 0, plannedAmt: 0, total: 0 };
    inMonth.forEach((a) => {
      const amt = Number(a.amount) || 0;
      s.total += amt;
      s[a.status] = (s[a.status] || 0) + 1;
      if (a.status === 'attended') s.attendedAmt += amt;
      else if (a.status === 'missed') s.missedAmt += amt;
      else s.plannedAmt += amt;
    });
    return s;
  }, [inMonth]);

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

  const groups = useMemo(() => {
    const g = {};
    shown.forEach((a) => (g[a.on_date] = g[a.on_date] || []).push(a));
    return Object.entries(g);
  }, [shown]);

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
        <div className="eyebrow"><span className="dot" />{inMonth.length} sessions this month</div>
        <div className="bignum">
          <span className="cur">₹</span>{Math.round(sums.attendedAmt).toLocaleString('en-IN')}
        </div>
        <div className="sublabel">attended · {money(sums.total)} scheduled</div>

        <div className="attbar">
          <span className="attfill" style={{ width: progress + '%' }} />
        </div>
        <div className="attmeta">
          <span>{sums.attended} attended</span>
          <span>{sums.missed} missed</span>
          <span>{sums.planned} to go</span>
        </div>

        <div className="netline" style={{ marginTop: 12 }}>
          {byTherapy.map((t) => (
            <span key={t.name} className="thchip">
              {t.name} · {t.attended}/{t.count}
            </span>
          ))}
        </div>
      </div>

      <div className="seg modeseg" style={{ marginTop: 16 }}>
        {[['all', `All ${inMonth.length}`], ['attended', 'Attended'], ['missed', 'Missed'], ['planned', 'To go']].map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="note" style={{ margin: 0 }}>Nothing here for this filter.</p>
        </div>
      ) : groups.map(([iso, list]) => {
        const d = fmtDay(iso);
        return (
          <div key={iso}>
            <div className="sechead">
              <h4>{d.long}</h4>
              <span>{list.length} {list.length === 1 ? 'SESSION' : 'SESSIONS'}</span>
            </div>
            {list.map((a) => (
              <div key={a.id} className={'sesscard ' + (THERAPY_TONE[a.therapy] || '') + ' s-' + a.status}>
                <div className="sessmain">
                  <div className="sesstop">
                    <span className="sessname">{a.therapy} therapy</span>
                    <span className="sessamt">{money(a.amount)}</span>
                  </div>
                  <div className="sessbot">
                    <span className="sesstime">{a.slot}</span>
                    <span className={'sessstat ' + a.status}>
                      {a.status === 'attended' ? 'Attended' : a.status === 'missed' ? 'Missed' : 'Not marked'}
                    </span>
                  </div>
                </div>
                <div className="sessacts">
                  <button
                    className={'sessbtn yes' + (a.status === 'attended' ? ' on' : '')}
                    onClick={() => setAppointmentStatus(a.id, a.status === 'attended' ? 'planned' : 'attended')}
                  >
                    <Check width="14" height="14" /> Attended
                  </button>
                  <button
                    className={'sessbtn no' + (a.status === 'missed' ? ' on' : '')}
                    onClick={() => setAppointmentStatus(a.id, a.status === 'missed' ? 'planned' : 'missed')}
                  >
                    <Close width="13" height="13" /> Missed
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

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
