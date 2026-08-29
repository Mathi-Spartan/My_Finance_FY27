'use client';
import { useMemo, useState } from 'react';
import Portal from './Portal';
import { Close } from './Icons';
import { money } from '@/lib/finance';
import {
  balanceSeries, dailySeries, categoryMatrix, sizeBands,
  payeeProfile, projection, merchantOf, categorise,
} from '@/lib/statement';

const fmt = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtFull = (d) =>
  d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/* ---------- balance over the whole period, scrubable ---------- */
export function BalanceChart({ rows }) {
  const series = useMemo(() => balanceSeries(rows), [rows]);
  const [at, setAt] = useState(null);
  if (series.length < 2) return null;

  const W = 320, H = 110;
  const max = Math.max(...series.map((s) => s.balance), 1);
  const pts = series.map((s, i) => [
    (i / (series.length - 1)) * W,
    H - (s.balance / max) * (H - 8) - 4,
  ]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const cur = at !== null ? series[at] : series[series.length - 1];

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX ?? e.touches?.[0]?.clientX) - box.left) / box.width;
    setAt(Math.max(0, Math.min(series.length - 1, Math.round(x * (series.length - 1)))));
  };

  return (
    <div className="card">
      <div className="cardhead"><h4>Balance over time</h4><span>drag to read a day</span></div>
      <div className="chartread">
        <span className="crv">{money(cur.balance)}</span>
        <span className="crd">{fmt(cur.iso)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart" preserveAspectRatio="none"
           onPointerDown={pick} onPointerMove={(e) => e.buttons && pick(e)}
           onTouchStart={pick} onTouchMove={pick} onPointerLeave={() => setAt(null)}>
        <defs>
          <linearGradient id="balfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--g2)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--g2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#balfill)" />
        <path d={path} fill="none" stroke="var(--g2)" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {at !== null && (
          <g>
            <line x1={pts[at][0]} y1="0" x2={pts[at][0]} y2={H} stroke="var(--brand)" strokeWidth="1"
                  vectorEffect="non-scaling-stroke" opacity="0.6" />
            <circle cx={pts[at][0]} cy={pts[at][1]} r="3.5" fill="var(--brand)"
                    stroke="var(--card)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      <div className="chartaxis"><span>{fmt(series[0].iso)}</span><span>{fmt(series[series.length - 1].iso)}</span></div>
    </div>
  );
}

/* ---------- every day of spending, tap one to open it ---------- */
export function DailyChart({ rows, from, to, onDay }) {
  const series = useMemo(() => dailySeries(rows, from, to), [rows, from, to]);
  const max = Math.max(...series.map((s) => s.total), 1);
  const [sel, setSel] = useState(null);

  return (
    <div className="card">
      <div className="cardhead"><h4>Every day</h4><span>tap a bar</span></div>
      <div className="daybars">
        {series.map((s, i) => (
          <button
            key={s.iso}
            className={'daybar' + (sel === i ? ' on' : '') + (s.total === 0 ? ' empty' : '')}
            style={{ height: s.total ? Math.max(3, (s.total / max) * 100) + '%' : '2px' }}
            onClick={() => { setSel(i); onDay && onDay(s.iso); }}
            title={`${fmt(s.iso)} · ${money(s.total)}`}
          />
        ))}
      </div>
      {sel !== null && (
        <div className="daypick">
          <b>{fmt(series[sel].iso)}</b>
          <span>{money(series[sel].total)} across {series[sel].count} payments</span>
        </div>
      )}
      <div className="chartaxis"><span>{fmt(series[0].iso)}</span><span>{fmt(series[series.length - 1].iso)}</span></div>
    </div>
  );
}

/* ---------- category against month ---------- */
export function Heatmap({ rows, onCell }) {
  const m = useMemo(() => categoryMatrix(rows), [rows]);
  if (!m.months.length) return null;

  return (
    <div className="card">
      <div className="cardhead"><h4>Category by month</h4><span>darker is more</span></div>
      <div className="heat" style={{ gridTemplateColumns: `92px repeat(${m.months.length}, 1fr)` }}>
        <span />
        {m.months.map((mo) => (
          <span className="hmcol" key={mo}>
            {new Date(mo + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'short' })}
          </span>
        ))}
        {m.rows.slice(0, 12).map((c) => (
          <>
            <span className="hmrow" key={c.key}>{c.key}</span>
            {m.months.map((mo) => {
              const v = c.byMonth[mo] || 0;
              const t = v / m.peak;
              return (
                <button
                  key={c.key + mo}
                  className="hmcell"
                  style={{ background: v ? `color-mix(in srgb, var(--g2) ${Math.round(8 + t * 82)}%, transparent)` : 'var(--card-2)' }}
                  onClick={() => onCell && onCell(c.key, mo)}
                  title={`${c.key} · ${mo} · ${money(v)}`}
                >
                  {v > 0 && <em>{v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</em>}
                </button>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

/* ---------- how payment sizes are spread ---------- */
export function SizeBands({ rows, onBand }) {
  const bands = useMemo(() => sizeBands(rows), [rows]);
  const maxCount = Math.max(...bands.map((b) => b.count), 1);

  return (
    <div className="card">
      <div className="cardhead"><h4>Payment sizes</h4><span>count against value</span></div>
      <p className="note" style={{ marginTop: 0 }}>
        Most payments are small; most money leaves in a few large ones. The bar is how
        many, the figure is how much.
      </p>
      {bands.map((b) => (
        <button className="bandrow" key={b.key} onClick={() => onBand && onBand(b)}>
          <span className="bkey">{b.key}</span>
          <span className="btrack">
            <i style={{ width: Math.max(3, (b.count / maxCount) * 100) + '%' }} />
          </span>
          <span className="bmeta">
            <b>{money(b.total)}</b>
            <em>{b.count} · {Math.round(b.share)}%</em>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- where the current month is heading ---------- */
export function Projection({ rows, a }) {
  const p = useMemo(() => projection(rows, a), [rows, a]);
  if (!p) return null;
  const pct = Math.min(100, (p.daysElapsed / p.daysInMonth) * 100);

  return (
    <div className="card">
      <div className="cardhead"><h4>Where this month lands</h4><span>at the current rate</span></div>
      <div className="projrow">
        <div>
          <span className="pk">So far</span>
          <span className="pv">{money(p.soFar)}</span>
          <span className="pd">{p.daysElapsed} of {p.daysInMonth} days</span>
        </div>
        <div>
          <span className="pk">On track for</span>
          <span className="pv big">{money(p.projected)}</span>
          <span className="pd">
            {p.vsPrior !== null && <>{p.vsPrior > 0 ? '+' : ''}{Math.round(p.vsPrior)}% against your average month</>}
          </span>
        </div>
      </div>
      <div className="track" style={{ marginTop: 12 }}>
        <div className="fillbar" style={{ width: pct + '%', background: 'linear-gradient(90deg,var(--g1),var(--g3))' }} />
      </div>
    </div>
  );
}

/* ---------- search, sort and filter every line ---------- */
export function Explorer({ rows }) {
  const [q, setQ] = useState('');
  const [dir, setDir] = useState('out');
  const [sort, setSort] = useState('amount');
  const [limit, setLimit] = useState(40);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows.filter((r) => (dir === 'all' ? true : r.direction === dir));
    if (term) {
      out = out.filter((r) =>
        merchantOf(r.description).toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        categorise(r.description).toLowerCase().includes(term));
    }
    out = out.slice().sort((x, y) =>
      sort === 'amount' ? y.amount - x.amount
        : sort === 'oldest' ? x.date - y.date
          : y.date - x.date);
    return out;
  }, [rows, q, dir, sort]);

  const total = list.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="card">
      <div className="cardhead"><h4>Every transaction</h4><span>{list.length} shown</span></div>
      <div className="field" style={{ marginBottom: 10 }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }}
               placeholder="Search a payee, category or narration" />
      </div>
      <div className="explorebar">
        <div className="seg tiny">
          {[['out', 'Out'], ['in', 'In'], ['all', 'All']].map(([k, l]) => (
            <button key={k} className={dir === k ? 'on' : ''} onClick={() => setDir(k)}>{l}</button>
          ))}
        </div>
        <div className="seg tiny">
          {[['amount', 'Largest'], ['newest', 'Newest'], ['oldest', 'Oldest']].map(([k, l]) => (
            <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="exptotal">{list.length} transactions · {money(total)}</div>
      <div className="explist">
        {list.slice(0, limit).map((r, i) => (
          <div className={'exprow ' + r.direction} key={i}>
            <span className="exdate">{fmt(r.iso)}</span>
            <span className="exmain">
              <b>{merchantOf(r.description)}</b>
              <em>{categorise(r.description)}</em>
            </span>
            <span className="examt">{r.direction === 'in' ? '+' : '−'}{money(r.amount)}</span>
          </div>
        ))}
      </div>
      {list.length > limit && (
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setLimit((l) => l + 60)}>
          Show more ({list.length - limit} left)
        </button>
      )}
    </div>
  );
}

/* ---------- a single payee, in full ---------- */
export function PayeeSheet({ rows, name, onClose }) {
  const p = useMemo(() => payeeProfile(rows, name), [rows, name]);
  const max = Math.max(...p.items.map((r) => r.amount), 1);

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 10 }}>
          <div className="sheettitle">{name}</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>

        <div className="factgrid" style={{ marginTop: 0 }}>
          <Mini k="Paid in total" v={money(p.total)} d={`${p.count} payments`} />
          <Mini k="Typical" v={money(p.avg)} d={`${money(p.min)} – ${money(p.max)}`} />
          <Mini k="First seen" v={fmtFull(p.first)} d={`last ${fmtFull(p.last)}`} />
          <Mini k="How often" v={p.avgGap ? `every ${Math.round(p.avgGap)}d` : 'once'}
                d={p.nextExpected ? `next around ${fmtFull(p.nextExpected)}` : p.category} />
        </div>

        <div className="cardhead" style={{ marginTop: 16 }}><h4>Every payment</h4><span>{p.items.length}</span></div>
        <div className="explist">
          {p.items.slice().reverse().map((r, i) => (
            <div className={'exprow ' + r.direction} key={i}>
              <span className="exdate">{fmt(r.iso)}</span>
              <span className="exbar"><i style={{ width: (r.amount / max) * 100 + '%' }} /></span>
              <span className="examt">{r.direction === 'in' ? '+' : '−'}{money(r.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </Portal>
  );
}

function Mini({ k, v, d }) {
  return (
    <div className="fact">
      <span className="fk">{k}</span>
      <span className="fv" style={{ fontSize: 14 }}>{v}</span>
      <span className="fd">{d}</span>
    </div>
  );
}

/* ---------- one day, opened from the chart ---------- */
export function DaySheet({ rows, iso, onClose }) {
  const items = rows.filter((r) => r.iso === iso).sort((a, b) => b.amount - a.amount);
  const out = items.filter((r) => r.direction === 'out');
  const total = out.reduce((s, r) => s + r.amount, 0);

  return (
    <Portal>
      <div className="scrim" onClick={onClose} />
      <div className="sheet importsheet">
        <div className="grab" />
        <div className="flowhead" style={{ marginBottom: 6 }}>
          <div className="sheettitle">{fmtFull(new Date(iso + 'T12:00:00'))}</div>
          <div className="spacer" />
          <button className="icobtn" onClick={onClose} aria-label="Close"><Close width="15" height="15" /></button>
        </div>
        <p className="sheetsub">{money(total)} left your account across {out.length} payments.</p>
        <div className="explist">
          {items.map((r, i) => (
            <div className={'exprow ' + r.direction} key={i}>
              <span className="exmain">
                <b>{merchantOf(r.description)}</b>
                <em>{categorise(r.description)}</em>
              </span>
              <span className="examt">{r.direction === 'in' ? '+' : '−'}{money(r.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </Portal>
  );
}
