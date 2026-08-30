'use client';
import { useState } from 'react';
import { supabase, configured, apiBase } from '@/lib/supabase';
import { Mark } from './Logo';

export default function Login({ world, onBack }) {
  const [mode, setMode] = useState('password'); // password | link
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if (!email.includes('@')) { setMsg({ t: 'err', m: 'Enter a valid email address.' }); return; }
    if (!password) { setMsg({ t: 'err', m: 'Enter your password.' }); return; }
    setBusy(true);
    setMsg(null);

    const base = apiBase;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const ctl = new AbortController();
    const kill = setTimeout(() => ctl.abort(), 15000);

    try {
      // Ask for the token directly rather than through the client library,
      // so a stall here is ours to time out and report.
      const res = await fetch(base + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
        signal: ctl.signal,
      });
      clearTimeout(kill);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) {
        setMsg({
          t: 'err',
          m: data.error_description || data.msg || data.message || `Sign in failed (${res.status}).`,
        });
        setBusy(false);
        return;
      }

      // Hand the tokens to the client so it persists them and wakes the app.
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) { setMsg({ t: 'err', m: error.message }); setBusy(false); }
      // On success the auth listener swaps this screen out.
    } catch (e) {
      clearTimeout(kill);
      setBusy(false);
      setMsg({
        t: 'err',
        m: e?.name === 'AbortError'
          ? 'Sign in timed out after 15 seconds. Try again, or use the email link.'
          : `Sign in failed: ${e?.message || 'unknown error'}`,
      });
    }
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
          <div className="brandlock">
          <Mark size={54} />
          <div>
            <div className="mark">{world ? world.name : 'Kanakku'}</div>
            {world && <div className="worldtag">{world.tamil}</div>}
          </div>
        </div>
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
        <div className="brandlock">
          <Mark size={54} />
          <div>
            <div className="mark">{world ? world.name : 'Kanakku'}</div>
            {world && <div className="worldtag">{world.tamil}</div>}
          </div>
        </div>
        <p className="tag2">{world ? world.tagline + '.' : 'Every rupee accounted for.'}</p>

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
