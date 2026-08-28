'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Plus, Close, Trash, Check } from './Icons';
import Portal from './Portal';
import { money, salaryReport } from '@/lib/finance';
import { loanReport, schedule, isoDay } from '@/lib/loans';

const LENDERS = [
  ['bank', 'Bank'],
  ['nbfc', 'NBFC'],
  ['app', 'Loan app'],
  ['private', 'Private'],
];
const LENDER_LABEL = Object.fromEntries(LENDERS);

const fmtDue = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function LoansView() {
  const { loans, loanPayments, salary, addLoan, updateLoan, deleteLoan, setEmiPaid } = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);

  const income = useMemo(() => {
    const r = salaryReport(salary);
    return r.count ? r.average : 0;
  }, [salary]);

  const r = useMemo(
    () => loanReport(loans, loanPayments, { monthlyIncome: income }),
    [loans, loanPayments, income]
  );

  const paidKey = useMemo(
    () => new Set((loanPayments || []).filter((p) => p.paid).map((p) => `${p.loan_id}|${p.due_date}`)),
    [loanPayments]
  );

  if (r.count === 0) {
    return (
      <>
        <div className="card" style={{ marginTop: 14 }}>
          <p className="note" style={{ margin: 0 }}>
            No loans recorded. Add one and this becomes a full debt report — what you owe,
            what it costs in interest, and when you are free of it.
          </p>
        </div>
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setAdding(true)}>
            <Plus width="15" height="15" /> Add a loan
          </button>
        </div>
        {adding && <LoanSheet onClose={() => setAdding(false)} onSave={async (v) => { await addLoan(v); setAdding(false); }} />}
      </>
    );
  }

  return (
    <>
      {/* the headline: what you owe */}
      <div className="hero paarihero" style={{ marginTop: 14 }}>
        <div className="eyebrow">
          <span className={'dot' + (r.overdueCount ? ' warn' : '')} />
          {r.count} {r.count === 1 ? 'loan' : 'loans'} · total outstanding
        </div>
        <div className="bignum">
          <span className="cur">₹</span>{Math.round(r.totalOutstanding).toLocaleString('en-IN')}
        </div>
        <div className="sublabel">
          {money(r.totalEmi)} a month
          {r.emiToIncome !== null && <> · {Math.round(r.emiToIncome)}% of your salary</>}
        </div>

        {r.totalPrincipal > 0 && (
          <>
            <div className="attbar" style={{ marginTop: 16 }}>
              <span className="attfill used" style={{ width: r.progress + '%' }} />
            </div>
            <div className="attmeta">
              <span>{money(r.totalCleared)} cleared</span>
              <span>{Math.round(r.progress)}% of {money(r.totalPrincipal)}</span>
            </div>
          </>
        )}

        <div className="paarigrid">
          <div className="pg">
            <span className="k">Interest left</span>
            <span className="v">{money(r.totalInterest)}</span>
            <span className="d">if nothing changes</span>
          </div>
          <div className="pg">
            <span className="k">This month</span>
            <span className="v">{money(r.monthlyInterest)}</span>
            <span className="d">goes to interest</span>
          </div>
          <div className="pg">
            <span className="k">Debt free</span>
            <span className="v">{r.debtFree ? r.debtFree.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</span>
            <span className="d">{r.debtFree ? 'at this pace' : 'not on track'}</span>
          </div>
        </div>
      </div>

      {/* the things that need acting on */}
      {r.anyNeverClears && (
        <div className="alertbar bad">
          <b>An EMI is not covering its interest</b>
          <span>
            {r.rows.filter((l) => l.neverClears).map((l) => l.lender_name).join(', ')} —
            the balance grows every month at this payment. Raise the EMI or prepay.
          </span>
        </div>
      )}
      {r.overdueCount > 0 && (
        <div className="alertbar warn">
          <b>{r.overdueCount} EMI{r.overdueCount > 1 ? 's' : ''} not marked paid</b>
          <span>Open the loan below and tick them off, or they keep showing as due.</span>
        </div>
      )}
      {r.nextUp && (
        <div className="alertbar ok">
          <b>Next: {r.nextUp.lender_name} · {money(r.nextUp.emi_amount)}</b>
          <span>
            due {fmtDue(r.nextUp.nextDue)}
            {r.nextUp.daysToNext === 0 ? ' — today' : r.nextUp.daysToNext > 0 ? ` — in ${r.nextUp.daysToNext} days` : ''}
          </span>
        </div>
      )}

      {/* each loan */}
      {r.rows.map((l) => {
        const open = openId === l.id;
        const due = schedule(l, 1).slice(-8).reverse();
        return (
          <div className={'loancard' + (open ? ' open' : '')} key={l.id}>
            <button className="loanhead" onClick={() => setOpenId(open ? null : l.id)}>
              <span className="lhtop">
                <span className="lhname">
                  {l.lender_name}
                  <em>{LENDER_LABEL[l.lender_type] || l.lender_type}{l.rate > 0 ? ` · ${l.rate}%` : ''}</em>
                </span>
                <span className="lhout">
                  {money(l.outstanding)}
                  <em>outstanding</em>
                </span>
              </span>

              {l.principal > 0 && (
                <span className="lhbar">
                  <i style={{ width: Math.min(100, l.progress) + '%' }} />
                </span>
              )}

              <span className="lhfoot">
                <span>{money(l.emi_amount)} on the {l.emi_day}{l.emi_day === 1 ? 'st' : l.emi_day === 2 ? 'nd' : l.emi_day === 3 ? 'rd' : 'th'}</span>
                <span className={l.neverClears ? 'never' : ''}>
                  {l.neverClears
                    ? 'never clears'
                    : `${l.months} left · ${l.payoff.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                </span>
              </span>
            </button>

            {open && (
              <div className="loanbody">
                <div className="statgrid">
                  <div className="stat">
                    <div className="k">Borrowed</div>
                    <div className="v">{money(l.principal)}</div>
                    <div className="d">{money(l.cleared)} repaid</div>
                  </div>
                  <div className="stat">
                    <div className="k">Interest left</div>
                    <div className="v">{l.interest === null ? '—' : money(l.interest)}</div>
                    <div className="d">{l.rate > 0 ? `at ${l.rate}%` : 'add a rate to see this'}</div>
                  </div>
                  <div className="stat">
                    <div className="k">This EMI</div>
                    <div className="v">{money(l.split.principal)}</div>
                    <div className="d">principal, {money(l.split.interest)} interest</div>
                  </div>
                  <div className="stat">
                    <div className="k">Paid so far</div>
                    <div className="v">{l.paidCount}</div>
                    <div className="d">EMIs ticked off</div>
                  </div>
                </div>

                <div className="emihead">Recent and upcoming EMIs</div>
                <div className="emilist">
                  {due.map((d) => {
                    const isPaid = paidKey.has(`${l.id}|${d}`);
                    const isPast = d < isoDay(new Date());
                    return (
                      <button
                        key={d}
                        className={'emirow' + (isPaid ? ' paid' : isPast ? ' late' : '')}
                        onClick={() => setEmiPaid(l.id, d, !isPaid, Number(l.emi_amount))}
                      >
                        <span className="ebox">{isPaid ? <Check width="12" height="12" /> : null}</span>
                        <span className="edate">{fmtDue(d)}</span>
                        <span className="eamt">{money(l.emi_amount)}</span>
                        <span className="estat">{isPaid ? 'Paid' : isPast ? 'Unpaid' : 'Due'}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="btnrow" style={{ marginTop: 12 }}>
                  <button className="btn ghost" onClick={() => setEditing(l)}>Edit loan</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* which to kill first */}
      {r.count > 1 && (
        <div className="card">
          <div className="cardhead"><h4>Clear these first</h4><span>costliest rate first</span></div>
          <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
            Every spare rupee does the most work on the highest rate. Paying these down in
            this order costs you the least interest overall.
          </p>
          {r.prepayOrder.map((l, i) => (
            <div className="prow" key={l.id} style={{ gridTemplateColumns: '26px 1fr auto' }}>
              <span className="pd">{i + 1}</span>
              <span className="pt">{l.lender_name}<em style={{ display: 'block', fontWeight: 500, fontSize: 10, color: 'var(--ink-3)' }}>{l.rate > 0 ? `${l.rate}% a year` : 'no rate set'}</em></span>
              <span className="pa">{money(l.outstanding)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="btnrow" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setAdding(true)}>
          <Plus width="15" height="15" /> Add a loan
        </button>
      </div>

      {(adding || editing) && (
        <LoanSheet
          loan={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={async (v) => {
            if (editing) await updateLoan(editing.id, v); else await addLoan(v);
            setAdding(false); setEditing(null);
          }}
          onDelete={editing ? async () => { await deleteLoan(editing.id); setEditing(null); setOpenId(null); } : null}
        />
      )}
    </>
  );
}

function LoanSheet({ loan, onClose, onSave, onDelete }) {
  const [f, setF] = useState({
    lender_type: loan?.lender_type || 'bank',
    lender_name: loan?.lender_name || '',
    principal: loan ? String(Number(loan.principal) || '') : '',
    outstanding: loan ? String(Number(loan.outstanding) || '') : '',
    emi_amount: loan ? String(Number(loan.emi_amount) || '') : '',
    emi_day: String(loan?.emi_day || 5),
    rate: loan ? String(Number(loan.rate) || '') : '',
    start_date: loan?.start_date || isoDay(new Date()),
    note: loan?.note || '',
  });
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.lender_name.trim() && Number(f.outstanding) > 0 && Number(f.emi_amount) > 0;

  // warn before saving something that can never be repaid
  const warn = useMemo(() => {
    const o = Number(f.outstanding) || 0;
    const e = Number(f.emi_amount) || 0;
    const rr = (Number(f.rate) || 0) / 12 / 100;
    if (o > 0 && e > 0 && rr > 0 && e <= o * rr) {
      return `At ${f.rate}%, interest alone is about ${money(o * rr)} a month. An EMI of ${money(e)} will never clear this.`;
    }
    return null;
  }, [f.outstanding, f.emi_amount, f.rate]);

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 12 }}>
          <div className="sheettitle">{loan ? 'Edit loan' : 'Add a loan'}</div>
          <div className="spacer" />
          {loan && (
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
            <div className="sheetsub">
              Delete {loan.lender_name} and every EMI ticked against it? This can&apos;t be undone.
            </div>
            <button className="btn danger" onClick={onDelete}>Yes, delete it</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Keep it</button>
          </>
        ) : (
          <>
            <div className="field">
              <label>Lender type</label>
              <div className="driverpick">
                {LENDERS.map(([k, label]) => (
                  <button key={k} className={'dchip' + (f.lender_type === k ? ' on' : '')}
                          onClick={() => setF((p) => ({ ...p, lender_type: k }))}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Bank or app name</label>
              <input value={f.lender_name} onChange={set('lender_name')} placeholder="HDFC, Bajaj, KreditBee…" />
            </div>

            <div className="tworow">
              <div className="field">
                <label>Loan amount (₹)</label>
                <input type="number" inputMode="decimal" value={f.principal} onChange={set('principal')} placeholder="0" />
              </div>
              <div className="field">
                <label>Outstanding (₹)</label>
                <input type="number" inputMode="decimal" value={f.outstanding} onChange={set('outstanding')} placeholder="0" />
              </div>
            </div>

            <div className="tworow">
              <div className="field">
                <label>EMI amount (₹)</label>
                <input type="number" inputMode="decimal" value={f.emi_amount} onChange={set('emi_amount')} placeholder="0" />
              </div>
              <div className="field">
                <label>EMI day</label>
                <input type="number" min="1" max="31" value={f.emi_day} onChange={set('emi_day')} />
              </div>
            </div>

            <div className="tworow">
              <div className="field">
                <label>Interest rate (% a year)</label>
                <input type="number" inputMode="decimal" step="0.01" value={f.rate} onChange={set('rate')} placeholder="optional" />
              </div>
              <div className="field">
                <label>First EMI</label>
                <input type="date" value={f.start_date} onChange={set('start_date')} />
              </div>
            </div>

            {warn && <div className="parsewarn">⚠ {warn}</div>}
            {!f.rate && (
              <p className="note" style={{ marginTop: 0 }}>
                The rate is optional, but without it there is no way to work out interest,
                months remaining or a payoff date.
              </p>
            )}

            <button className="btn" disabled={!valid}
                    onClick={() => onSave({
                      lender_type: f.lender_type,
                      lender_name: f.lender_name.trim(),
                      principal: Number(f.principal) || 0,
                      outstanding: Number(f.outstanding) || 0,
                      emi_amount: Number(f.emi_amount) || 0,
                      emi_day: Math.min(31, Math.max(1, Number(f.emi_day) || 5)),
                      rate: Number(f.rate) || 0,
                      start_date: f.start_date,
                      note: f.note,
                    })}>
              {loan ? 'Save changes' : 'Add loan'}
            </button>
          </>
        )}
      </div>
    </Portal>
  );
}
