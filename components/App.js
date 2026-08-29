'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import HomeView from './HomeView';
import EntriesView from './EntriesView';
import InsightsView from './InsightsView';
import SettingsView from './SettingsView';
import AddSheet from './AddSheet';
import EditSheet from './EditSheet';
import CalculatorView from './CalculatorView';
import PaariView from './PaariView';
import DriversView from './DriversView';
import Login from './Login';
import Lock from './Lock';
import { Plus } from './Icons';
import { NAV_ICONS } from './NavIcons';

const TABS = [
  { id: 'home',     label: 'Home' },
  { id: 'entries',  label: 'Entries' },
  { id: 'paari',    label: 'Paari' },
  { id: 'drivers',  label: 'Drivers' },
  { id: 'insights', label: 'Patterns' },
  { id: 'calc',     label: 'Calc' },
];

export default function App() {
  const { ready, session, loading, settings, configured } = useStore();
  const [tab, setTab] = useState('home');
  const [adding, setAdding] = useState(false);
  const [presetAccount, setPresetAccount] = useState(null);
  const [editing, setEditing] = useState(null);
  const [presetAmount, setPresetAmount] = useState(null);
  const [theme, setTheme] = useState('light');
  const [unlocked, setUnlocked] = useState(false);
  const [dir, setDir] = useState('fwd');

  // Move between tabs through the View Transitions API when the browser has
  // it, so the two screens cross-dissolve as one surface instead of swapping.
  const go = (next) => {
    if (next === tab) return;
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === next);
    const forward = to === -1 || from === -1 ? true : to > from;

    // Decorative loops keep compositing while the screen moves, which is where
    // the dropped frames come from. Pause them for the length of the slide.
    const root = document.documentElement;
    root.dataset.nav = forward ? 'fwd' : 'back';
    root.classList.add('switching');
    clearTimeout(window.__switchT);
    window.__switchT = setTimeout(() => root.classList.remove('switching'), 320);

    setDir(forward ? 'fwd' : 'back');
    setTab(next);
  };


  useEffect(() => {
    const saved = localStorage.getItem('ll-theme') || 'light';
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ll-theme', next);
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  if (!ready) return <Splash />;
  if (!session || !configured) return <Login />;
  if (loading && !settings) return <Splash />;
  if (settings?.pin && !unlocked) return <Lock pin={settings.pin} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="shell">
      <div key={tab} className={"viewfade " + dir}>
        {tab === 'home' && <HomeView onAddTo={(id) => { setPresetAccount(id); setAdding(true); }} goTo={go} />}
        {tab === 'entries' && <EntriesView onEdit={setEditing} />}
        {tab === 'paari' && <PaariView />}
        {tab === 'drivers' && <DriversView />}
        {tab === 'insights' && <InsightsView />}
        {tab === 'calc' && (
          <CalculatorView onUse={(v) => { setPresetAmount(v); setPresetAccount(null); setAdding(true); }} />
        )}
        {tab === 'settings' && <SettingsView theme={theme} toggleTheme={toggleTheme} />}
      </div>

      <nav className="nav solid">
        <div className="navtabs">
          {TABS.map(({ id, label }) => {
            const Icon = NAV_ICONS[id];
            const on = tab === id;
            return (
              <button key={id} className={'navbtn' + (on ? ' on' : '')} onClick={() => go(id)}>
                <span className="navico"><Icon solid={on} width="22" height="22" /></span>
                <span className="navlabel">{label}</span>
              </button>
            );
          })}
        </div>
        <button className="addbtn" onClick={() => { setPresetAccount(null); setPresetAmount(null); setAdding(true); }}>
          <Plus width="17" height="17" /> Add
        </button>
      </nav>

      {adding && <AddSheet presetAccount={presetAccount} presetAmount={presetAmount} onClose={() => { setAdding(false); setPresetAccount(null); setPresetAmount(null); }} />}
      {editing && <EditSheet tx={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Splash() {
  return (
    <div className="center">
      <div className="loginbox" style={{ textAlign: 'center' }}>
        <div className="mark">Kanakku</div>
        <p className="tag2">Opening your ledger…</p>
      </div>
    </div>
  );
}
