'use client';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Refresh, Plus, Back, Close, Trash } from './Icons';
import Portal from './Portal';
import { money, driverReport, rangeOf, isoDay, dayLabel } from '@/lib/finance';

const SCALES = [['week', 'Week'], ['month', 'Month'], ['all', 'All time']];

export default function DriversView() {
  const { drivers, trips, addTrip, updateTrip, deleteTrip, reload, loading } = useStore();
  const [scale, setScale] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [focusDriver, setFocusDriver] = useState(null);

  const [from, to] = useMemo(
    () => (scale === 'all' ? [null, null] : rangeOf(scale, anchor)),
    [scale, anchor]
  );

  const r = useMemo(() => driverReport(trips, drivers, from, to), [trips, drivers, from, to]);
  const prev = useMemo(() => {
    if (scale === 'all') return null;
    const a = new Date(anchor);
    if (scale === 'week') a.setDate(a.getDate() - 7); else a.setMonth(a.getMonth() - 1);
    const [pf, pt] = rangeOf(scale, a);
    return driverReport(trips, drivers, pf, pt);
  }, [trips, drivers, scale, anchor]);

  const shown = useMemo(
    () => (focusDriver ? r.trips.filter((t) => t.driver_id === focusDriver) : r.trips)
      .slice().sort((a, b) => b.on_date.localeCompare(a.on_date)),
    [r.trips, focusDriver]
  );

  const step = (dir) => {
    const d = new Date(anchor);
    if (scale === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const title = scale === 'all'
    ? 'Every trip'
    : scale === 'week'
      ? `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      : anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const change = prev && prev.total > 0 ? Math.round(((r.total - prev.total) / prev.total) * 100) : null;
  const peak = Math.max(...r.drivers.map((d) => d.amount), 1);

  const groups = useMemo(() => {
    const g = {};
    shown.forEach((t) => (g[t.on_date] = g[t.on_date] || []).push(t));
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [shown]);

  return (
    <div className="body">
      <div className="pagehead">
        <h2>Drivers</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'icobtn' + (loading ? ' spinning' : '')} onClick={() => reload()} aria-label="Refresh">
            <Refresh width="16" height="16" />
          </button>
          <button className="icobtn" onClick={() => setAdding(true)} aria-label="Add trip">
            <Plus width="16" height="16" />
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="scaleseg">
          {SCALES.map(([id, label]) => (
            <button key={id} className={scale === id ? 'on' : ''} onClick={() => setScale(id)}>{label}</button>
          ))}
        </div>
        {scale !== 'all' && (
          <div className="stepper">
            <button onClick={() => step(-1)} aria-label="Previous"><Back width="14" height="14" /></button>
            <button onClick={() => step(1)} aria-label="Next">
              <Back width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        )}
      </div>

      <div className="hero paarihero">
        <div className="eyebrow"><span className="dot warn" />{title}</div>
        <div className="bignum">
          <span className="cur">₹</span>{Math.round(r.total).toLocaleString('en-IN')}
        </div>
        <div className="sublabel">
          {r.count} {r.count === 1 ? 'trip' : 'trips'}
          {change !== null && <> · {change > 0 ? '↑' : change < 0 ? '↓' : ''}{Math.abs(change)}% vs last {scale}</>}
        </div>

        <div className="paarigrid">
          <div className="pg">
            <span className="k">Per trip</span>
            <span className="v">{money(r.perTrip)}</span>
            <span className="d">average</span>
          </div>
          <div className="pg">
            <span className="k">Drivers</span>
            <span className="v">{r.drivers.length}</span>
            <span className="d">used</span>
          </div>
          <div className="pg">
            <span className="k">Days</span>
            <span className="v">{r.days}</span>
            <span className="d">with trips</span>
          </div>
        </div>
      </div>

      {/* who is costing what */}
      {r.drivers.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardhead">
            <h4>By driver</h4>
            <span>{focusDriver ? 'tap to clear' : 'tap to filter'}</span>
          </div>
          {r.drivers.map((d) => (
            <button
              key={d.id}
              className={'drow' + (focusDriver === d.id ? ' on' : '')}
              onClick={() => setFocusDriver(focusDriver === d.id ? null : d.id)}
            >
              <span className="dtop">
                <span className="dname">{d.name}</span>
                <span className="damt">{money(d.amount)}</span>
              </span>
              <span className="track">
                <span className="fillbar" style={{
                  width: Math.max(4, (d.amount / peak) * 100) + '%',
                  background: 'linear-gradient(90deg,var(--g1),var(--g3))',
                }} />
              </span>
              <span className="dfoot">
                {d.trips} {d.trips === 1 ? 'trip' : 'trips'} · {money(d.amount / d.trips)} each
                {d.last && <> · last {new Date(d.last + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* where the money actually goes */}
      {r.routes.length > 0 && (
        <div className="card">
          <div className="cardhead"><h4>Most run routes</h4><span>this {scale === 'all' ? 'period' : scale}</span></div>
          {r.routes.slice(0, 6).map((rt) => (
            <div className="rtrow" key={rt.route}>
              <span className="rtname">{rt.route}</span>
              <span className="rtmeta">
                <b>{money(rt.amount)}</b>
                <em>{rt.trips}× · {money(rt.amount / rt.trips)} each</em>
              </span>
            </div>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <p className="note" style={{ margin: 0 }}>
            No trips in this {scale === 'all' ? 'ledger' : scale} yet. Tap + to add one.
          </p>
        </div>
      ) : groups.map(([day, list]) => (
        <div key={day}>
          <div className="sechead">
            <h4>{dayLabel(day)}</h4>
            <span>{money(list.reduce((s, t) => s + Number(t.amount), 0))}</span>
          </div>
          {list.map((t) => {
            const d = r.drivers.find((x) => x.id === (t.driver_id || 'none'));
            return (
              <button className="triprow" key={t.id} onClick={() => setEditing(t)}>
                <span className="tpleft">
                  <span className="tpdriver">{d?.name || 'Unassigned'}</span>
                  <span className="tproute">
                    {(t.from_place || '?')}<i>→</i>{(t.to_place || '?')}
                  </span>
                  {t.note && <span className="tpnote">{t.note}</span>}
                </span>
                <span className="tpamt">{money(t.amount)}</span>
              </button>
            );
          })}
        </div>
      ))}

      {adding && (
        <TripSheet
          drivers={drivers}
          onClose={() => setAdding(false)}
          onSave={async (row) => { await addTrip(row); setAdding(false); }}
        />
      )}
      {editing && (
        <TripSheet
          drivers={drivers}
          trip={editing}
          onClose={() => setEditing(null)}
          onSave={async (row) => { await updateTrip(editing.id, row); setEditing(null); }}
          onDelete={async () => { await deleteTrip(editing.id); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TripSheet({ drivers, trip, onClose, onSave, onDelete }) {
  const [f, setF] = useState({
    driver_id: trip?.driver_id || drivers[0]?.id || '',
    on_date: trip?.on_date || isoDay(new Date()),
    from_place: trip?.from_place || '',
    to_place: trip?.to_place || '',
    amount: trip ? String(Number(trip.amount) || '') : '',
    note: trip?.note || '',
  });
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.driver_id && Number(f.amount) > 0;

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 12 }}>
          <div className="sheettitle">{trip ? 'Edit trip' : 'Add a trip'}</div>
          <div className="spacer" />
          {trip && (
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
            <div className="sheetsub">Delete this trip? It can&apos;t be undone.</div>
            <button className="btn danger" onClick={onDelete}>Yes, delete it</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Keep it</button>
          </>
        ) : (
          <>
            <div className="field">
              <label>Driver</label>
              <div className="driverpick">
                {drivers.filter((d) => !d.archived).map((d) => (
                  <button
                    key={d.id}
                    className={'dchip' + (f.driver_id === d.id ? ' on' : '')}
                    onClick={() => setF((p) => ({ ...p, driver_id: d.id }))}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Date</label>
              <input type="date" value={f.on_date} onChange={set('on_date')}
                     min={`${new Date().getFullYear() - 20}-01-01`}
                     max={`${new Date().getFullYear() + 20}-12-31`} />
            </div>

            <div className="tworow">
              <div className="field">
                <label>From</label>
                <input value={f.from_place} onChange={set('from_place')} placeholder="Home" />
              </div>
              <div className="field">
                <label>To</label>
                <input value={f.to_place} onChange={set('to_place')} placeholder="Office" />
              </div>
            </div>

            <div className="field">
              <label>Amount paid (₹)</label>
              <input type="number" inputMode="decimal" step="0.01" value={f.amount}
                     onChange={set('amount')} placeholder="0.00" />
            </div>

            <div className="field">
              <label>Note (optional)</label>
              <input value={f.note} onChange={set('note')} placeholder="Waiting time, tolls…" />
            </div>

            <button className="btn" disabled={!valid}
                    onClick={() => onSave({ ...f, amount: Number(f.amount) || 0 })}>
              {trip ? 'Save changes' : 'Add trip'}
            </button>
          </>
        )}
      </div>
    </Portal>
  );
}
