'use client';
import { useState } from 'react';
import { supabase, configured } from '@/lib/supabase';

export default function Login() {
  const [mode, setMode] = useState('password'); // password | link
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if (!email.includes('@')) { setMsg({ t: 'err', m: 'Enter a valid email address.' }); return; }
    if (!password) { setMsg({ t: 'err', m: 'Enter your password.' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg({ t: 'err', m: error.message });
  };

  const sendLink = async () => {
    if (!email.includes('@')) { setMsg({ t: 'err', m: 'Enter a valid email address.' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    setBusy(false);
    setMsg(error
      ? { t: 'err', m: error.message }
      : { t: 'ok', m: "Link sent. Open it on this device and you're in." });
  };

  if (!configured) {
    return (
      <div className="center">
        <div className="loginbox">
          <div className="mark">Ledgerline</div>
          <p className="tag2">
            Supabase isn&apos;t wired up yet. Add NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="center">
      <div className="loginbox">
        <div className="mark">Ledgerline</div>
        <p className="tag2">Your money, recorded the moment it moves.</p>

        {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}

        <div className="field">
          <label>Email</label>
          <input type="email" value={email} inputMode="email" autoComplete="email"
                 onChange={(e) => setEmail(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && (mode === 'password' ? signIn() : sendLink())}
                 placeholder="you@example.com" />
        </div>

        {mode === 'password' && (
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} autoComplete="current-password"
                   onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && signIn()}
                   placeholder="********" />
          </div>
        )}

        <button className="btn" onClick={mode === 'password' ? signIn : sendLink} disabled={busy}>
          {busy ? 'Just a moment...' : mode === 'password' ? 'Sign in' : 'Send me a link'}
        </button>

        <button className="btn ghost" style={{ marginTop: 8 }}
                onClick={() => { setMode(mode === 'password' ? 'link' : 'password'); setMsg(null); }}>
          {mode === 'password' ? 'Email me a link instead' : 'Use my password instead'}
        </button>

        <p className="note">
          Only accounts you create in Supabase can sign in. Turn off email signups in the
          dashboard so this stays a ledger of one.
        </p>
      </div>
    </div>
  );
}
