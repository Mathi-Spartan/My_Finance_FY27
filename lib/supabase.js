'use client';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);

// In the browser, talk to our own domain and let the server relay to Supabase.
// Some networks drop POSTs to supabase.co outright, which hangs sign-in.
export const apiBase =
  typeof window !== 'undefined' ? `${window.location.origin}/api/sb` : url;

export const supabase = configured
  ? createClient(apiBase, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
