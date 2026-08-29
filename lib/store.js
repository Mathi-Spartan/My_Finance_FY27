'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, configured } from './supabase';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [txs, setTxs] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [settings, setSettings] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [salary, setSalary] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [toast, setToast] = useState('');
  const [justAdded, setJustAdded] = useState(null);

  const say = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    if (!configured) { setReady(true); setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // This callback runs while auth-js holds its Navigator lock. Our load()
      // effect calls supabase.from(), which wants the same lock, so updating
      // state synchronously here deadlocks and signInWithPassword never
      // resolves. Deferring by a tick lets the lock release first.
      setTimeout(() => { setSession(s); setReady(true); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    if (busyRef.current) return;      // never let two loads overlap
    busyRef.current = true;
    setLoading(true);
    try {
      const uid = session.user.id;

      // Right after sign-in the five queries below can race auth-js settling
      // its token, and whichever loses comes back 401. Settle first, then
      // retry once on an auth failure rather than silently showing no data.
      await supabase.auth.getSession();
      const q = async (run) => {
        let r = await run();
        const authFailed = r.error && (r.status === 401 || /jwt|token|api key/i.test(r.error.message || ''));
        if (authFailed) {
          await supabase.auth.getSession();
          r = await run();
        }
        return r;
      };

      const [a, c, t, r, s, ap, dr, tp, sal, ln, lp] = await Promise.all([
        q(() => supabase.from('accounts').select('*').order('sort')),
        q(() => supabase.from('categories').select('*').order('sort')),
        q(() => supabase.from('transactions').select('*').order('occurred_at', { ascending: false }).limit(3000)),
        q(() => supabase.from('recurring').select('*').order('day_of_month')),
        q(() => supabase.from('settings').select('*').eq('user_id', uid).maybeSingle()),
        q(() => supabase.from('appointments').select('*').order('on_date')),
        q(() => supabase.from('drivers').select('*').order('sort')),
        q(() => supabase.from('driver_trips').select('*').order('on_date', { ascending: false })),
        q(() => supabase.from('salary').select('*').order('for_month', { ascending: false })),
        q(() => supabase.from('loans').select('*').order('created_at')),
        q(() => supabase.from('loan_payments').select('*')),
      ]);

      if (a.error || c.error) { say('Some data failed to load — pull to refresh'); }
      setAccounts(a.data || []);
      setCategories(c.data || []);
      setTxs(t.data || []);
      setRecurring(r.data || []);
      setAppointments(ap.data || []);
      setDrivers(dr.data || []);
      setTrips(tp.data || []);
      setSalary(sal.data || []);
      setLoans(ln.data || []);
      setLoanPayments(lp.data || []);
      if (s.data) setSettings(s.data);
      else {
        const { data } = await supabase.from('settings').insert({ user_id: uid }).select().single();
        setSettings(data);
      }
    } catch (e) {
      say(e?.message || 'Could not load your data');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [session, say]);

  useEffect(() => { if (session) load(); }, [session, load]);

  const uid = session?.user?.id;

  // ---------- mutations ----------
  const addTx = async (row) => {
    const { data, error } = await supabase
      .from('transactions').insert({ ...row, user_id: uid }).select().single();
    if (error) { say(error.message); return null; }
    setTxs((p) => [data, ...p]);
    setJustAdded(data.id);
    setTimeout(() => setJustAdded((v) => (v === data.id ? null : v)), 2600);
    return data;
  };

  const updateTx = async (id, patch) => {
    const { data, error } = await supabase
      .from('transactions').update(patch).eq('id', id).select().single();
    if (error) { say(error.message); return; }
    setTxs((p) => p.map((t) => (t.id === id ? data : t)));
  };

  const deleteTx = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { say(error.message); return; }
    setTxs((p) => p.filter((t) => t.id !== id));
    say('Entry deleted');
  };

  const deleteMany = async (ids) => {
    if (!ids.length) return false;
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) { say(error.message); return false; }
    setTxs((p) => p.filter((t) => !ids.includes(t.id)));
    return true;
  };

  const clearAllTx = async () => {
    const { error } = await supabase.from('transactions').delete().eq('user_id', uid);
    if (error) { say(error.message); return false; }
    setTxs([]);
    return true;
  };

  const bulkTx = async (rows) => {
    const withUser = rows.map((r) => ({ ...r, user_id: uid }));
    const chunks = [];
    for (let i = 0; i < withUser.length; i += 400) chunks.push(withUser.slice(i, i + 400));
    for (const ch of chunks) {
      const { error } = await supabase.from('transactions').insert(ch);
      if (error) { say(error.message); return false; }
    }
    await load();
    return true;
  };

  const setAppointmentStatus = async (id, status) => {
    const prev = appointments;
    setAppointments((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));  // optimistic
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) { setAppointments(prev); say(error.message); }
  };

  const addAppointment = async (row) => {
    const { data, error } = await supabase
      .from('appointments').insert({ ...row, user_id: uid }).select().single();
    if (error) { say(error.message); return null; }
    setAppointments((p) => [...p, data].sort((x, y) => x.on_date.localeCompare(y.on_date)));
    return data;
  };

  const importAppointments = async (rows) => {
    const withUser = rows.map((r) => ({ ...r, person: 'Paari', user_id: uid }));
    const { data, error } = await supabase.from('appointments').insert(withUser).select();
    if (error) { say(error.message); return false; }
    setAppointments((p) => [...p, ...(data || [])].sort((x, y) => x.on_date.localeCompare(y.on_date)));
    say(`Added ${data?.length || 0} sessions`);
    return data?.length || 0;
  };

  const addTrip = async (row) => {
    const { data, error } = await supabase
      .from('driver_trips').insert({ ...row, user_id: uid }).select().single();
    if (error) { say(error.message); return null; }
    setTrips((p) => [data, ...p]);
    say('Trip added');
    return data;
  };

  const updateTrip = async (id, patch) => {
    const { data, error } = await supabase
      .from('driver_trips').update(patch).eq('id', id).select().single();
    if (error) { say(error.message); return; }
    setTrips((p) => p.map((t) => (t.id === id ? data : t)));
    say('Trip updated');
  };

  const deleteTrip = async (id) => {
    const { error } = await supabase.from('driver_trips').delete().eq('id', id);
    if (error) { say(error.message); return; }
    setTrips((p) => p.filter((t) => t.id !== id));
    say('Trip deleted');
  };

  const addSalary = async (row) => {
    const { data, error } = await supabase
      .from('salary').insert({ ...row, user_id: uid }).select().single();
    if (error) {
      say(/duplicate|unique/i.test(error.message)
        ? 'That month is already recorded — open it to edit instead.'
        : error.message);
      return null;
    }
    setSalary((p) => [data, ...p].sort((x, y) => y.for_month.localeCompare(x.for_month)));
    say('Month added');
    return data;
  };

  const updateSalary = async (id, patch) => {
    const { data, error } = await supabase
      .from('salary').update(patch).eq('id', id).select().single();
    if (error) { say(error.message); return; }
    setSalary((p) => p.map((s2) => (s2.id === id ? data : s2))
      .sort((x, y) => y.for_month.localeCompare(x.for_month)));
    say('Month updated');
  };

  const deleteSalary = async (id) => {
    const { error } = await supabase.from('salary').delete().eq('id', id);
    if (error) { say(error.message); return; }
    setSalary((p) => p.filter((s2) => s2.id !== id));
    say('Month removed');
  };

  const addLoan = async (row) => {
    const { data, error } = await supabase.from('loans').insert({ ...row, user_id: uid }).select().single();
    if (error) { say(error.message); return null; }
    setLoans((p) => [...p, data]);
    say('Loan added');
    return data;
  };

  const updateLoan = async (id, patch) => {
    const { data, error } = await supabase.from('loans').update(patch).eq('id', id).select().single();
    if (error) { say(error.message); return; }
    setLoans((p) => p.map((l) => (l.id === id ? data : l)));
    say('Loan updated');
  };

  const deleteLoan = async (id) => {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) { say(error.message); return; }
    setLoans((p) => p.filter((l) => l.id !== id));
    setLoanPayments((p) => p.filter((x) => x.loan_id !== id));
    say('Loan deleted');
  };

  // Ticking an EMI also moves the outstanding by the principal part of it.
  const setEmiPaid = async (loanId, dueDate, paid, amount) => {
    const loan = loans.find((l) => l.id === loanId);
    if (paid) {
      const { data, error } = await supabase.from('loan_payments')
        .upsert({ user_id: uid, loan_id: loanId, due_date: dueDate, paid: true,
                  paid_on: new Date().toISOString().slice(0, 10), amount },
                { onConflict: 'loan_id,due_date' })
        .select().single();
      if (error) { say(error.message); return; }
      setLoanPayments((p) => [...p.filter((x) => !(x.loan_id === loanId && x.due_date === dueDate)), data]);
    } else {
      const { error } = await supabase.from('loan_payments')
        .delete().eq('loan_id', loanId).eq('due_date', dueDate);
      if (error) { say(error.message); return; }
      setLoanPayments((p) => p.filter((x) => !(x.loan_id === loanId && x.due_date === dueDate)));
    }

    if (loan) {
      const r = (Number(loan.rate) || 0) / 12 / 100;
      const interest = Math.min(Number(loan.emi_amount) || 0, (Number(loan.outstanding) || 0) * r);
      const principalPart = Math.max(0, (Number(loan.emi_amount) || 0) - interest);
      const next = Math.max(0, (Number(loan.outstanding) || 0) + (paid ? -principalPart : principalPart));
      const { data } = await supabase.from('loans')
        .update({ outstanding: Math.round(next * 100) / 100 }).eq('id', loanId).select().single();
      if (data) setLoans((p) => p.map((l) => (l.id === loanId ? data : l)));
    }
  };

  const saveAccount = async (row) => {
    const q = row.id
      ? supabase.from('accounts').update(row).eq('id', row.id)
      : supabase.from('accounts').insert({ ...row, user_id: uid });
    const { error } = await q;
    if (error) { say(error.message); return; }
    await load();
  };

  const saveCategory = async (row) => {
    const q = row.id
      ? supabase.from('categories').update(row).eq('id', row.id)
      : supabase.from('categories').insert({ ...row, user_id: uid });
    const { error } = await q;
    if (error) { say(error.message); return; }
    await load();
  };

  const saveRecurring = async (row) => {
    const q = row.id
      ? supabase.from('recurring').update(row).eq('id', row.id)
      : supabase.from('recurring').insert({ ...row, user_id: uid });
    const { error } = await q;
    if (error) { say(error.message); return; }
    await load();
  };

  const removeRecurring = async (id) => {
    await supabase.from('recurring').delete().eq('id', id);
    setRecurring((p) => p.filter((r) => r.id !== id));
  };

  const saveSettings = async (patch) => {
    const { data, error } = await supabase
      .from('settings').update(patch).eq('user_id', uid).select().single();
    if (error) { say(error.message); return; }
    setSettings(data);
  };

  const signOut = async () => { await supabase.auth.signOut(); location.reload(); };

  return (
    <Ctx.Provider value={{
      configured, session, ready, loading, reload: load,
      accounts, categories, txs, recurring, settings, appointments, drivers, trips, salary,
      loans, loanPayments,
      addTx, updateTx, deleteTx, bulkTx, deleteMany, clearAllTx,
      setAppointmentStatus, addAppointment, importAppointments,
      addTrip, updateTrip, deleteTrip,
      addSalary, updateSalary, deleteSalary,
      addLoan, updateLoan, deleteLoan, setEmiPaid,
      saveAccount, saveCategory, saveRecurring, removeRecurring, saveSettings,
      signOut, toast, say, justAdded,
    }}>
      {children}
      {toast ? <div className="toast">{toast}</div> : null}
    </Ctx.Provider>
  );
}
