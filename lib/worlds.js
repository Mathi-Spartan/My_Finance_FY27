'use client';

// One account, three worlds. Choosing a world changes the palette, the nav and
// the home screen — not just which tab opens. The intent is that Kanakku and
// Nalam feel like different apps that happen to share a login, because mixing
// money and health on one screen serves neither.

export const WORLDS = {
  finance: {
    id: 'finance',
    name: 'Kanakku',
    tamil: 'கணக்கு',
    tagline: 'Every rupee accounted for',
    blurb: 'Accounts, entries, therapy, drivers, salary, debt and statements.',
    palette: 'azure',
    accent: '#0B6FBF',
    g: ['#063E73', '#0F7BC4', '#3FA9E5'],
    tabs: ['home', 'entries', 'paari', 'drivers', 'insights', 'calc', 'scan'],
    mode: 'light',
  },
  lab: {
    id: 'lab',
    name: 'The Lab',
    tamil: 'சோதனை',
    tagline: 'Things you are testing on yourself',
    blurb: 'Set a rule, run it for a while, see whether you kept it.',
    palette: 'lab',
    accent: '#C77DE8',
    g: ['#3E1152', '#7A2AA0', '#C77DE8'],
    tabs: ['lab', 'running', 'done'],
    mode: 'dark',
  },
};

export const WORLD_LIST = [WORLDS.finance, WORLDS.lab];
export const worldOf = (id) => WORLDS[id] || WORLDS.finance;

export function rememberWorld(id) {
  try { localStorage.setItem('ll-world', id); } catch {}
}
export function lastWorld() {
  try { return localStorage.getItem('ll-world') || null; } catch { return null; }
}
