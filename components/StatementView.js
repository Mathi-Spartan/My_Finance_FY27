'use client';
import { useMemo, useRef, useState } from 'react';
import { Refresh, Trash, Close } from './Icons';
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
  const [openCat, setOpenCat] = useState(null);
  const fileRef = useRef(null);
  const pending = useRef(null);

  const a = useMemo(() => (rows && rows.length ? analyse(rows) : null), [rows]);

  const read = async (file, password) => {
    setBusy(true);
    setMsg(null);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf, password: password || undefined }).promise;

      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        // rebuild lines from item positions, since PDFs have no line breaks
        const lines = {};
        content.items.forEach((it) => {
          const y = Math.round(it.transform[5]);
          (lines[y] = lines[y] || []).push({ x: it.transform[4], s: it.str });
        });
        Object.keys(lines)
          .sort((p, q) => q - p)
          .forEach((y) => {
            text += lines[y].sort((p, q) => p.x - q.x).map((o) => o.s).join(' ') + '\n';
          });
      }

      const out = parseStatement(text);
      setBusy(false);
      setNeedPass(false);
      setPass('');
      if (!out.rows.length) {
        setMsg({ t: 'err', m: 'No transactions found in that PDF. If it is a scanned image rather than text, this cannot read it.' });
        return;
      }
      setRows(out.rows);
      setSkipped(out.skipped);
      setFileName(file.name);
    } catch (e) {
      setBusy(false);
      if (/password/i.test(e?.message || '') || e?.name === 'PasswordException') {
        pending.current = file;
        setNeedPass(true);
        setMsg({ t: 'err', m: 'That statement is password protected. Enter the password below.' });
        return;
      }
      setMsg({ t: 'err', m: e?.message || 'Could not read that file.' });
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
            <div className="cardhead"><h4>Read a bank statement</h4><span>stays on this device</span></div>
            <p className="note" style={{ marginTop: 0 }}>
              Upload a PDF statement and it is analysed here, in your browser. Nothing is
              uploaded anywhere and nothing is saved — close the app and it is gone.
              This is kept entirely separate from your entries.
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
          <div className="hero paarihero">
            <div className="eyebrow"><span className="dot warn" />{fmtDate(a.from)} – {fmtDate(a.to)}</div>
            <div className="bignum">
              <span className="cur">₹</span>{Math.round(a.totalOut).toLocaleString('en-IN')}
            </div>
            <div className="sublabel">spent over {a.days} days · {a.spendCount} payments</div>

            <div className="paarigrid">
              <div className="pg">
                <span className="k">Came in</span>
                <span className="v">{money(a.totalIn)}</span>
                <span className="d">{a.incomeCount} credits</span>
              </div>
              <div className="pg">
                <span className="k">Per day</span>
                <span className="v">{money(a.perDay)}</span>
                <span className="d">average</span>
              </div>
              <div className="pg">
                <span className="k">Net</span>
                <span className="v">{a.net < 0 ? '−' : '+'}{money(Math.abs(a.net))}</span>
                <span className="d">{a.net >= 0 ? 'kept' : 'overspent'}</span>
              </div>
            </div>
          </div>

          {/* the headline facts, as chips */}
          <div className="factgrid">
            <Fact k="Biggest single spend" v={money(a.biggest.amount)} d={merchantOf(a.biggest.description)} tone="out" />
            <Fact k="Heaviest day" v={money(a.peakDay.total)} d={fmtDate(new Date(a.peakDay.key + 'T12:00:00'))} tone="out" />
            <Fact k="Most spent on" v={a.busiestWeekday.key + 's'} d={money(a.busiestWeekday.total) + ' in total'} />
            <Fact k="Typical payment" v={money(a.perTransaction)} d={`smallest ${money(a.smallest.amount)}`} />
            <Fact k="Days you spent nothing" v={String(a.noSpendDays)} d={`of ${a.days} days`} tone="in" />
            <Fact k="Small payments" v={money(a.smallSpends.total)} d={`${a.smallSpends.count} under ₹200`} />
          </div>

          {/* where it went */}
          <div className="card">
            <div className="cardhead"><h4>Where it went</h4><span>tap for detail</span></div>
            {a.byCategory.map((c) => {
              const share = (c.total / a.totalOut) * 100;
              const open = openCat === c.key;
              return (
                <div key={c.key}>
                  <button className="drift catrow" onClick={() => setOpenCat(open ? null : c.key)}>
                    <span className="drifttop">
                      <span className="lab">{c.key}</span>
                      <span className="val">{Math.round(share)}% · {money(c.total)}</span>
                    </span>
                    <span className="track">
                      <span className="fillbar" style={{
                        width: Math.max(3, share) + '%',
                        background: 'linear-gradient(90deg,var(--g1),var(--g3))',
                      }} />
                    </span>
                    <span className="driftfoot">
                      {c.count} {c.count === 1 ? 'payment' : 'payments'} · {money(c.total / c.count)} each
                    </span>
                  </button>
                  {open && (
                    <div className="catlist">
                      {c.items.slice().sort((x, y) => y.amount - x.amount).map((r, i) => (
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

          {/* who took the money */}
          <div className="card">
            <div className="cardhead"><h4>Who you paid most</h4><span>top 8</span></div>
            {a.byMerchant.slice(0, 8).map((m, i) => (
              <div className="rtrow" key={m.key}>
                <span className="rtname"><b className="rank">{i + 1}</b>{m.key}</span>
                <span className="rtmeta">
                  <b>{money(m.total)}</b>
                  <em>{m.count}× · {money(m.total / m.count)} each</em>
                </span>
              </div>
            ))}
          </div>

          {/* rhythm */}
          <div className="card">
            <div className="cardhead"><h4>Your week</h4><span>where spending lands</span></div>
            <div className="dowrow">
              {a.byWeekday.map((d) => {
                const max = Math.max(...a.byWeekday.map((x) => x.total), 1);
                return (
                  <div className="dowbar" key={d.key}>
                    <div className="dowfill" style={{ height: Math.max(5, (d.total / max) * 100) + '%' }} />
                    <span>{d.key[0]}</span>
                  </div>
                );
              })}
            </div>
            <p className="note" style={{ marginTop: 14 }}>
              <b>{a.busiestWeekday.key}</b> is your heaviest day at {money(a.busiestWeekday.total)}.
              {a.quietestWeekday && <> The lightest is {a.quietestWeekday.key} at {money(a.quietestWeekday.total)}.</>}
            </p>
          </div>

          {a.repeats.length > 0 && (
            <div className="card">
              <div className="cardhead"><h4>Paid again and again</h4><span>3+ times</span></div>
              {a.repeats.slice(0, 8).map((r) => (
                <div className="rtrow" key={r.key}>
                  <span className="rtname">{r.key}{r.steady && <em className="steady">same amount</em>}</span>
                  <span className="rtmeta">
                    <b>{money(r.total)}</b>
                    <em>{r.count}× · {money(r.avg)} each</em>
                  </span>
                </div>
              ))}
            </div>
          )}

          {a.byMonth.length > 1 && (
            <div className="card">
              <div className="cardhead"><h4>Month by month</h4><span>{a.byMonth.length} months</span></div>
              {a.byMonth.slice().sort((x, y) => x.key.localeCompare(y.key)).map((m) => {
                const max = Math.max(...a.byMonth.map((x) => x.total), 1);
                return (
                  <div className="drift" key={m.key}>
                    <div className="drifttop">
                      <span className="lab">{new Date(m.key + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                      <span className="val">{money(m.total)}</span>
                    </div>
                    <div className="track">
                      <div className="fillbar" style={{ width: Math.max(3, (m.total / max) * 100) + '%', background: 'linear-gradient(90deg,var(--g1),var(--g3))' }} />
                    </div>
                    <div className="driftfoot">{m.count} payments</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card">
            <div className="cardhead"><h4>What was read</h4><span>{fileName}</span></div>
            <p className="note" style={{ marginTop: 0 }}>
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

function Fact({ k, v, d, tone }) {
  return (
    <div className={'fact' + (tone ? ' ' + tone : '')}>
      <span className="fk">{k}</span>
      <span className="fv">{v}</span>
      <span className="fd">{d}</span>
    </div>
  );
}
