'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { Home, Chart, Gear, Plus, Calendar, Calc, Heart, Car } from './Icons';

const TABS = [
  { id: 'home',     label: 'Home',     Icon: Home },
  { id: 'entries',  label: 'Entries',  Icon: Calendar },
  { id: 'paari',    label: 'Paari',    Icon: Heart },
  { id: 'drivers',  label: 'Drivers',  Icon: Car },
  { id: 'insights', label: 'Patterns', Icon: Chart },
  { id: 'calc',     label: 'Calc',     Icon: Calc },
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
  const moving = useRef(false);

  // Move between tabs through the View Transitions API when the browser has
  // it, so the two screens cross-dissolve as one surface instead of swapping.
  const go = (next) => {
    if (next === tab) return;
    // Starting a second transition while one is running aborts both.
    if (moving.current) { setTab(next); return; }
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === next);
    const forward = to === -1 || from === -1 ? true : to > from;
    setDir(forward ? 'fwd' : 'back');
    document.documentElement.dataset.nav = forward ? 'fwd' : 'back';

    if (typeof document !== 'undefined' && document.startViewTransition
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // The callback has to change the DOM synchronously. Returning a promise
      // that waits on React's own scheduling times the transition out and the
      // tab never changes at all, so force the render with flushSync.
      moving.current = true;
      const vt = document.startViewTransition(() => { flushSync(() => setTab(next)); });
      vt.finished.catch(() => {}).finally(() => { moving.current = false; });
    } else {
      setTab(next);
    }
  };

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === tab));

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

      <nav className="nav glass">
        <div className="navtabs" style={{ '--n': TABS.length, '--i': activeIndex }}>
          <span className={'navpill' + (tab === 'settings' ? ' hidden' : '')} />
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={'navbtn' + (tab === id ? ' on' : '')} onClick={() => go(id)}>
              <Icon /> {label}
            </button>
          ))}
        </div>
        <button className="addbtn" onClick={() => { setPresetAccount(null); setPresetAmount(null); setAdding(true); }}>
          <Plus width="16" height="16" /> Add
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
