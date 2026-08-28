'use client';
import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import HomeView from './HomeView';
import InsightsView from './InsightsView';
import UpcomingView from './UpcomingView';
import SettingsView from './SettingsView';
import AddSheet from './AddSheet';
import Login from './Login';
import Lock from './Lock';
import { Home, Chart, Calendar, Gear, Plus, Moon, Sun } from './Icons';
import { rupees, totalCash } from '@/lib/finance';

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'insights', label: 'Insights', Icon: Chart },
  { id: 'upcoming', label: 'Upcoming', Icon: Calendar },
  { id: 'settings', label: 'Settings', Icon: Gear },
];

export default function App() {
  const { ready, session, loading, settings, configured, accounts, txs } = useStore();
  const [tab, setTab] = useState('home');
  const [context, setContext] = useState('personal');
  const [adding, setAdding] = useState(false);
  const [theme, setTheme] = useState('light');
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ll-theme') || 'light';
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
    const ctx = localStorage.getItem('ll-context');
    if (ctx) setContext(ctx);
  }, []);

  useEffect(() => { localStorage.setItem('ll-context', context); }, [context]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ll-theme', next);
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  const cash = useMemo(() => totalCash(accounts || [], txs || []), [accounts, txs]);

  if (!ready) return <Splash />;
  if (!session || !configured) return <Login />;
  if (loading && !settings) return <Splash />;
  if (settings?.pin && !unlocked) return <Lock pin={settings.pin} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="layout">
      <aside className="side">
        <div className="sidebrand">
          <b>Ledgerline</b><span>INR</span>
        </div>

        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={'sidebtn' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            <Icon /> {label}
          </button>
        ))}

        <button className="sideadd" onClick={() => setAdding(true)}>
          <Plus width="17" height="17" /> Add entry
        </button>

        <div className="sidefoot">
          <div className="sidecash">
            <div className="k">Cash on hand</div>
            <div className="v" style={{ color: cash < 0 ? 'var(--out)' : undefined }}>
              {rupees(cash, { decimals: false })}
            </div>
          </div>
          <button className="sidebtn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? 'Day mode' : 'Night mode'}
          </button>
        </div>
      </aside>

      <div className="shell">
        <div key={tab} className="viewfade">
          {tab === 'home' && <HomeView context={context} setContext={setContext} goTo={setTab} onAdd={() => setAdding(true)} />}
          {tab === 'insights' && <InsightsView context={context} />}
          {tab === 'upcoming' && <UpcomingView context={context} />}
          {tab === 'settings' && <SettingsView theme={theme} toggleTheme={toggleTheme} />}
        </div>

        <nav className="nav">
          {TABS.slice(0, 3).map(({ id, label, Icon }) => (
            <button key={id} className={'navbtn' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
              <Icon /> {label}
            </button>
          ))}
          <button className={'navbtn' + (tab === 'settings' ? ' on' : '')} onClick={() => setTab('settings')}>
            <Gear /> Settings
          </button>
          <button className="addbtn" onClick={() => setAdding(true)}>
            <Plus width="16" height="16" /> Add
          </button>
        </nav>
      </div>

      {adding && <AddSheet context={context} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Splash() {
  return (
    <div className="center">
      <div className="loginbox" style={{ textAlign: 'center' }}>
        <div className="mark">Ledgerline</div>
        <p className="tag2">Opening your ledger…</p>
      </div>
    </div>
  );
}
