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
  const [toast, setToast] = useState('');

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

      const [a, c, t, r, s] = await Promise.all([
        q(() => supabase.from('accounts').select('*').order('sort')),
        q(() => supabase.from('categories').select('*').order('sort')),
        q(() => supabase.from('transactions').select('*').order('occurred_at', { ascending: false }).limit(3000)),
        q(() => supabase.from('recurring').select('*').order('day_of_month')),
        q(() => supabase.from('settings').select('*').eq('user_id', uid).maybeSingle()),
      ]);

      if (a.error || c.error) { say('Some data failed to load — pull to refresh'); }
      setAccounts(a.data || []);
      setCategories(c.data || []);
      setTxs(t.data || []);
      setRecurring(r.data || []);
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
      accounts, categories, txs, recurring, settings,
      addTx, updateTx, deleteTx, bulkTx,
      saveAccount, saveCategory, saveRecurring, removeRecurring, saveSettings,
      signOut, toast, say,
    }}>
      {children}
      {toast ? <div className="toast">{toast}</div> : null}
    </Ctx.Provider>
  );
}
