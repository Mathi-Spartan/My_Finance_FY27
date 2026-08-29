'use client';
import { useMemo, useRef, useState } from 'react';
import { Refresh, Trash, Close, Check } from './Icons';
import { parseStatement, analyse, merchantOf, categorise } from '@/lib/statement';
import { money } from '@/lib/finance';

const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function StatementView() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [rows, setRows] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [pass, setPass] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const [fileName, setFileName] = useState('');
  const [how, setHow] = useState('');
  const [excludeSelf, setExcludeSelf] = useState(true);
  const [tab, setTab] = useState('overview');
  const [openCat, setOpenCat] = useState(null);
  const fileRef = useRef(null);
  const pending = useRef(null);

  const a = useMemo(() => (rows && rows.length ? analyse(rows, { excludeSelf }) : null), [rows, excludeSelf]);

  const read = async (file, password) => {
    setBusy(true);
    setMsg(null);
    try {
      // Read on our own server: pdf.js could not be relied on to load across
      // phones, and the server is one fixed, known environment.
      const res = await fetch('/api/read-pdf', {
        method: 'POST',
        headers: {
          'content-type': 'application/pdf',
          ...(password ? { 'x-pdf-password': password } : {}),
        },
        body: file,
      });

      if (res.status === 401) {
        pending.current = file;
        setBusy(false);
        setNeedPass(true);
        setMsg({ t: 'err', m: password ? 'That password did not open it. Try again.' : 'That statement is password protected.' });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        setMsg({ t: 'err', m: data.message ? `Could not read it: ${data.message}` : 'Could not read that file.' });
        return;
      }

      const out = parseStatement(data.text || '');
      setBusy(false);
      setNeedPass(false);
      setPass('');
      if (!out.rows.length) {
        setMsg({
          t: 'err',
          m: `Read ${data.pages || 0} page(s) but found no transactions. If the statement is a scan rather than text, it cannot be read.`,
        });
        return;
      }
      setRows(out.rows);
      setSkipped(out.skipped);
      setFileName(file.name);
      setHow('');
    } catch (e) {
      setBusy(false);
      setMsg({ t: 'err', m: `Could not read it: ${(e?.message || String(e)).slice(0, 160)}` });
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    pending.current = f;
    read(f, '');
  };

  const clearAll = () => {
    setRows(null); setSkipped([]); setFileName(''); setMsg(null);
    setNeedPass(false); setPass(''); pending.current = null; setOpenCat(null);
  };

  return (
    <div className="body">
      <div className="pagehead">
        <h2>Statement</h2>
        {rows && (
          <button className="icobtn" onClick={clearAll} aria-label="Clear">
            <Trash width="16" height="16" />
          </button>
        )}
      </div>

      {!rows && (
        <>
          <div className="card">
            <div className="cardhead"><h4>Read a bank statement</h4><span>nothing is stored</span></div>
            <p className="note" style={{ marginTop: 0 }}>
              Upload a PDF statement and get a full breakdown of it. The file is read by
              your own server, in memory, and is never written to disk or saved to your
              database. The results live only on this screen — close the app and they are
              gone. This is kept entirely separate from your entries.
            </p>
            <button className="btn" style={{ marginTop: 14 }} disabled={busy}
                    onClick={() => fileRef.current?.click()}>
              {busy ? 'Reading…' : 'Choose a PDF'}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onFile} />
          </div>

          {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

          {needPass && (
            <div className="card">
              <div className="field">
                <label>Statement password</label>
                <input type="password" value={pass} autoFocus
                       onChange={(e) => setPass(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && pending.current && read(pending.current, pass)}
                       placeholder="Often your PAN or date of birth" />
              </div>
              <button className="btn" disabled={!pass || busy}
                      onClick={() => pending.current && read(pending.current, pass)}>
                {busy ? 'Opening…' : 'Open statement'}
              </button>
            </div>
          )}
        </>
      )}

      {a && (
        <>
          {/* what the money actually did */}
          <div className="hero paarihero">
            <div className="eyebrow"><span className="dot warn" />{fmtDate(a.from)} – {fmtDate(a.to)}</div>
            <div className="bignum">
              <span className="cur">₹</span>{Math.round(a.totalOut).toLocaleString('en-IN')}
            </div>
            <div className="sublabel">
              spent over {a.days} days · {a.spendCount} payments
              {a.excluded && a.self.total > 0 && <> · {money(a.self.total)} moved between your own accounts is excluded</>}
            </div>

            <div className="attbar" style={{ marginTop: 16 }}>
              <span className="attfill used" style={{ width: (a.living.total / a.totalOut) * 100 + '%' }} />
              <span className="attfill lost" style={{ width: (a.debt.total / a.totalOut) * 100 + '%' }} />
              <span className="attfill back" style={{ width: (a.people.total / a.totalOut) * 100 + '%' }} />
            </div>
            <div className="attmeta">
              <span>Living {Math.round((a.living.total / a.totalOut) * 100)}%</span>
              <span>Debt {Math.round((a.debt.total / a.totalOut) * 100)}%</span>
              <span>People {Math.round((a.people.total / a.totalOut) * 100)}%</span>
            </div>

            <div className="paarigrid">
              <div className="pg">
                <span className="k">Came in</span>
                <span className="v">{money(a.totalIn)}</span>
                <span className="d">{a.incomeCount} credits</span>
              </div>
              <div className="pg">
                <span className="k">A month</span>
                <span className="v">{money(a.perMonth)}</span>
                <span className="d">{money(a.perDay)} a day</span>
              </div>
              <div className="pg">
                <span className="k">Net</span>
                <span className="v">{a.net < 0 ? '−' : '+'}{money(Math.abs(a.net))}</span>
                <span className="d">{a.net >= 0 ? 'kept' : 'shortfall'}</span>
              </div>
            </div>
          </div>

          <button className={'selftoggle' + (excludeSelf ? ' on' : '')} onClick={() => setExcludeSelf((v) => !v)}>
            <span className="box">{excludeSelf ? <Check width="11" height="11" /> : null}</span>
            Leave out money moved between your own accounts
          </button>

          {/* three ways to read the same money */}
          <div className="tierrow">
            <Tier label="Living costs" v={a.living.total} n={a.living.count} total={a.totalOut} tone="in" />
            <Tier label="Debt & cards" v={a.debt.total} n={a.debt.count} total={a.totalOut} tone="out" />
            <Tier label="Sent to people" v={a.people.total} n={a.people.count} total={a.totalOut} tone="amber" />
          </div>

          <div className="seg modeseg" style={{ marginTop: 14 }}>
            <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Overview</button>
            <button className={tab === 'where' ? 'on' : ''} onClick={() => setTab('where')}>Where</button>
            <button className={tab === 'when' ? 'on' : ''} onClick={() => setTab('when')}>When</button>
          </div>

          {tab === 'overview' && (
            <>
              <div className="factgrid">
                <Fact k="Biggest single payment" v={money(a.biggest.amount)} d={merchantOf(a.biggest.description)} tone="out" />
                <Fact k="Heaviest day" v={money(a.peakDay.total)} d={fmtDate(new Date(a.peakDay.key + 'T12:00:00'))} tone="out" />
                <Fact k="Typical payment" v={money(a.median)} d={`half are under this`} />
                <Fact k="Average payment" v={money(a.perTransaction)} d={`pulled up by the big ones`} />
                <Fact k="Largest credit" v={a.biggestIn ? money(a.biggestIn.amount) : '—'} d={a.biggestIn ? merchantOf(a.biggestIn.description) : ''} tone="in" />
                <Fact k="Payments over ₹10k" v={String(a.bigSpends.count)} d={`${money(a.bigSpends.total)} together`} />
                <Fact k="Small payments" v={String(a.smallSpends.count)} d={`under ₹200 · ${money(a.smallSpends.total)}`} />
                <Fact k="Days you spent nothing" v={String(a.noSpendDays)} d={`of ${a.days} days`} tone="in" />
                <Fact k="Balance low point" v={a.lowestBalance !== null ? money(a.lowestBalance) : '—'} d={`${a.lowBalanceDays} days under ₹1,000`} tone={a.lowBalanceDays > 10 ? 'out' : ''} />
                <Fact k="Balance high point" v={a.highestBalance !== null ? money(a.highestBalance) : '—'} d={`closed at ${money(a.closingBalance)}`} />
              </div>

              {a.repeats.filter((r) => r.steady).length > 0 && (
                <div className="card">
                  <div className="cardhead"><h4>Same amount, again and again</h4><span>likely fixed commitments</span></div>
                  {a.repeats.filter((r) => r.steady).slice(0, 8).map((r) => (
                    <div className="rtrow" key={r.key}>
                      <span className="rtname">{r.key}</span>
                      <span className="rtmeta">
                        <b>{money(r.avg)}</b>
                        <em>{r.count}× · {money(r.total)} total</em>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'where' && (
            <>
              <div className="card">
                <div className="cardhead"><h4>By category</h4><span>tap for payments</span></div>
                {a.byCategory.map((c) => {
                  const share = (c.total / a.totalOut) * 100;
                  const open = openCat === c.key;
                  return (
                    <div key={c.key}>
                      <button className="drift catrow" onClick={() => setOpenCat(open ? null : c.key)}>
                        <span className="drifttop">
                          <span className="lab">{c.key}</span>
                          <span className="val">{share < 1 ? '<1' : Math.round(share)}% · {money(c.total)}</span>
                        </span>
                        <span className="track">
                          <span className="fillbar" style={{ width: Math.max(2, share) + '%', background: 'linear-gradient(90deg,var(--g1),var(--g3))' }} />
                        </span>
                        <span className="driftfoot">{c.count} payments · {money(c.total / c.count)} each</span>
                      </button>
                      {open && (
                        <div className="catlist">
                          {c.items.slice().sort((x, y) => y.amount - x.amount).slice(0, 40).map((r, i) => (
                            <div className="catitem" key={i}>
                              <span className="cidate">{r.iso.slice(8)}/{r.iso.slice(5, 7)}</span>
                              <span className="ciname">{merchantOf(r.description)}</span>
                              <span className="ciamt">{money(r.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <div className="cardhead"><h4>Who took the most</h4><span>top 12</span></div>
                {a.byMerchant.slice(0, 12).map((m, i) => (
                  <div className="rtrow" key={m.key}>
                    <span className="rtname"><b className="rank">{i + 1}</b>{m.key}</span>
                    <span className="rtmeta">
                      <b>{money(m.total)}</b>
                      <em>{m.count}× · {money(m.total / m.count)} each</em>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'when' && (
            <>
              <div className="card">
                <div className="cardhead"><h4>Month by month</h4><span>out against in</span></div>
                {a.byMonth.slice().sort((x, y) => x.key.localeCompare(y.key)).map((m) => {
                  const inMonth = a.incomeByMonth.find((x) => x.key === m.key);
                  const max = Math.max(...a.byMonth.map((x) => x.total), ...a.incomeByMonth.map((x) => x.total), 1);
                  return (
                    <div className="mrow" key={m.key}>
                      <div className="mlabel">
                        {new Date(m.key + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                      </div>
                      <div className="mbars">
                        <div className="mline">
                          <span className="mfill out" style={{ width: (m.total / max) * 100 + '%' }} />
                          <em>{money(m.total)}</em>
                        </div>
                        <div className="mline">
                          <span className="mfill in" style={{ width: ((inMonth?.total || 0) / max) * 100 + '%' }} />
                          <em>{money(inMonth?.total || 0)}</em>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="legendrow"><span><i className="lg out" />out</span><span><i className="lg in" />in</span></div>
              </div>

              <div className="card">
                <div className="cardhead"><h4>Your week</h4><span>where spending lands</span></div>
                <div className="dowrow">
                  {a.byWeekday.map((d) => {
                    const max = Math.max(...a.byWeekday.map((x) => x.total), 1);
                    return (
                      <div className="dowbar" key={d.key}>
                        <div className="dowfill" style={{ height: Math.max(4, (d.total / max) * 100) + '%' }} />
                        <span>{d.short}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="note" style={{ marginTop: 14 }}>
                  <b>{a.busiestWeekday.key}</b> costs the most at {money(a.busiestWeekday.total)} across {a.busiestWeekday.count} payments.
                  {a.quietestWeekday && <> The lightest is {a.quietestWeekday.key} at {money(a.quietestWeekday.total)}.</>}
                </p>
              </div>

              <div className="card">
                <div className="cardhead"><h4>Heaviest days</h4><span>top 8</span></div>
                {a.byDay.slice(0, 8).map((d) => (
                  <div className="rtrow" key={d.key}>
                    <span className="rtname">{fmtDate(new Date(d.key + 'T12:00:00'))}</span>
                    <span className="rtmeta">
                      <b>{money(d.total)}</b>
                      <em>{d.count} payments</em>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="card">
            <div className="cardhead"><h4>What was read</h4><span>{fileName}</span></div>
            <p className="note" style={{ marginTop: 0 }}>
              {how && how !== 'src' && <>Opened using the {how === 'blob' ? 'fallback' : 'no-worker'} route. </>}
              {a.count} lines understood{skipped.length > 0 && <>, {skipped.length} skipped as not being transactions</>}.
              {a.openingBalance !== null && <> Balance ran from {money(a.openingBalance)} to {money(a.closingBalance)}.</>}
              {' '}Check a few against the PDF before trusting the totals — statement layouts vary.
            </p>
            <button className="btn danger" style={{ marginTop: 12 }} onClick={clearAll}>
              Clear this statement
            </button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
              Read another
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onFile} />
          </div>
        </>
      )}
    </div>
  );
}

function Tier({ label, v, n, total, tone }) {
  const pct = total > 0 ? (v / total) * 100 : 0;
  return (
    <div className={'tier ' + tone}>
      <span className="tlabel">{label}</span>
      <span className="tval">{money(v)}</span>
      <span className="tbar"><i style={{ width: Math.max(3, pct) + '%' }} /></span>
      <span className="tfoot">{Math.round(pct)}% · {n} payments</span>
    </div>
  );
}

function Fact({ k, v, d, tone }) {
  return (
    <div className={'fact' + (tone ? ' ' + tone : '')}>
      <span className="fk">{k}</span>
      <span className="fv">{v}</span>
      <span className="fd">{d}</span>
    </div>
  );
}
