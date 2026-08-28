'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Plus, Close, Trash } from './Icons';
import Portal from './Portal';
import { money, salaryReport, monthLabel } from '@/lib/finance';

// 1st, 2nd, 3rd, 4th … 21st, 31st
const ordinal = (n) => {
  const v = Math.round(n);
  const s = ['th', 'st', 'nd', 'rd'][(v % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][v % 100] || 'th';
  return v + s;
};

export default function SalaryView() {
  const { salary, addSalary, updateSalary, deleteSalary } = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const r = useMemo(() => salaryReport(salary), [salary]);
  const peak = r.count ? r.highest : 1;

  return (
    <>
      <div className="hero paarihero" style={{ marginTop: 14 }}>
        <div className="eyebrow">
          <span className="dot" />
          {r.count ? <>{r.count} months on record</> : <>Nothing recorded yet</>}
        </div>
        <div className="bignum">
          <span className="cur">₹</span>
          {Math.round(r.latest ? Number(r.latest.amount) : 0).toLocaleString('en-IN')}
        </div>
        <div className="sublabel">
          {r.latest
            ? <>latest · {monthLabel(r.latest.for_month.slice(0, 7))}, credited {new Date(r.latest.credited_on + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>
            : <>add a month to get started</>}
        </div>

        {r.count > 0 && (
          <div className="paarigrid">
            <div className="pg">
              <span className="k">{r.fy.label}</span>
              <span className="v">{money(r.fy.total)}</span>
              <span className="d">{r.fy.count} months</span>
            </div>
            <div className="pg">
              <span className="k">Average</span>
              <span className="v">{money(r.average)}</span>
              <span className="d">per month</span>
            </div>
            <div className="pg">
              <span className="k">Usually paid</span>
              <span className="v">{ordinal(r.avgDay)}</span>
              <span className="d">{r.earliestDay}–{r.latestDay} range</span>
            </div>
          </div>
        )}
      </div>

      <div className="btnrow" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setAdding(true)}>
          <Plus width="15" height="15" /> Add a month
        </button>
      </div>

      {r.count > 0 && (
        <div className="stable" style={{ marginTop: 14 }}>
          <div className="sthead" style={{ gridTemplateColumns: '62px 1fr auto' }}>
            <span>Month</span><span>Credited</span><span className="ta-r">Net paid</span>
          </div>
          {r.list.map((s) => (
            <button className="strow salrow" key={s.id} style={{ gridTemplateColumns: '62px 1fr auto' }}
                    onClick={() => setEditing(s)}>
              <span className="stdate">
                <b style={{ fontSize: 12 }}>{monthLabel(s.for_month.slice(0, 7)).split(' ')[0]}</b>
                <em>{monthLabel(s.for_month.slice(0, 7)).split(' ')[1]}</em>
              </span>
              <span className="stmain">
                <span className="salbar">
                  <i style={{ width: (Number(s.amount) / peak) * 100 + '%' }} />
                </span>
                <span className="sttime">
                  {new Date(s.credited_on + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}day {s.day}
                </span>
              </span>
              <span className="stright">
                <span className="stamt">{money(s.amount)}</span>
                {s.diff !== null && s.diff !== 0 && (
                  <span className={'stpill ' + (s.diff > 0 ? 'attended' : 'missed')}>
                    {s.diff > 0 ? '+' : '−'}{money(Math.abs(s.diff))}
                  </span>
                )}
              </span>
            </button>
          ))}
          <div className="stfoot">
            <span>{r.count} months recorded</span>
            <b>{money(r.total)}</b>
          </div>
        </div>
      )}

      {(adding || editing) && (
        <SalarySheet
          row={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={async (v) => {
            if (editing) await updateSalary(editing.id, v);
            else await addSalary(v);
            setAdding(false); setEditing(null);
          }}
          onDelete={editing ? async () => { await deleteSalary(editing.id); setEditing(null); } : null}
        />
      )}
    </>
  );
}

function SalarySheet({ row, onClose, onSave, onDelete }) {
  const now = new Date();
  const [f, setF] = useState({
    for_month: row ? row.for_month.slice(0, 7) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    credited_on: row ? row.credited_on : now.toISOString().slice(0, 10),
    amount: row ? String(Number(row.amount) || '') : '',
    employer: row?.employer || '',
    note: row?.note || '',
  });
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.for_month && f.credited_on && Number(f.amount) > 0;

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 12 }}>
          <div className="sheettitle">{row ? 'Edit month' : 'Add a month'}</div>
          <div className="spacer" />
          {row && (
            <button className="icobtn" onClick={() => setConfirm(true)} aria-label="Delete">
              <Trash width="15" height="15" />
            </button>
          )}
          <button className="icobtn" onClick={onClose} aria-label="Close">
            <Close width="15" height="15" />
          </button>
        </div>

        {confirm ? (
          <>
            <div className="sheetsub">Remove this month from the record?</div>
            <button className="btn danger" onClick={onDelete}>Yes, remove it</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Keep it</button>
          </>
        ) : (
          <>
            <div className="field">
              <label>Salary for which month</label>
              <input type="month" value={f.for_month} onChange={set('for_month')} />
            </div>
            <div className="field">
              <label>Credited on</label>
              <input type="date" value={f.credited_on} onChange={set('credited_on')} />
            </div>
            <div className="field">
              <label>Amount credited, after tax (₹)</label>
              <input type="number" inputMode="decimal" step="0.01" value={f.amount}
                     onChange={set('amount')} placeholder="0.00" />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input value={f.note} onChange={set('note')} placeholder="Includes bonus, arrears…" />
            </div>
            <button className="btn" disabled={!valid}
                    onClick={() => onSave({
                      for_month: f.for_month + '-01',
                      credited_on: f.credited_on,
                      amount: Number(f.amount) || 0,
                      employer: f.employer,
                      note: f.note,
                    })}>
              {row ? 'Save changes' : 'Add month'}
            </button>
          </>
        )}
      </div>
    </Portal>
  );
}
