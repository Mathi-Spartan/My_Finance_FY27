'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import HomeView from './HomeView';
import InsightsView from './InsightsView';
import UpcomingView from './UpcomingView';
import SettingsView from './SettingsView';
import AddSheet from './AddSheet';
import Login from './Login';
import Lock from './Lock';
import { Home, Chart, Calendar, Gear, Plus } from './Icons';

export default function App() {
  const { ready, session, loading, settings, configured } = useStore();
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!ready) return <Splash />;
  if (!session || !configured) return <Login />;
  if (loading && !settings) return <Splash />;
  if (settings?.pin && !unlocked) return <Lock pin={settings.pin} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="shell">
      {tab === 'home' && <HomeView context={context} setContext={setContext} goTo={setTab} onAdd={() => setAdding(true)} />}
      {tab === 'insights' && <InsightsView context={context} />}
      {tab === 'upcoming' && <UpcomingView context={context} />}
      {tab === 'settings' && <SettingsView theme={theme} toggleTheme={toggleTheme} />}

      <nav className="nav">
        <button className={'navbtn' + (tab === 'home' ? ' on' : '')} onClick={() => setTab('home')}>
          <Home /> Home
        </button>
        <button className={'navbtn' + (tab === 'insights' ? ' on' : '')} onClick={() => setTab('insights')}>
          <Chart /> Insights
        </button>
        <button className={'navbtn' + (tab === 'upcoming' ? ' on' : '')} onClick={() => setTab('upcoming')}>
          <Calendar /> Upcoming
        </button>
        <button className={'navbtn' + (tab === 'settings' ? ' on' : '')} onClick={() => setTab('settings')}>
          <Gear /> Settings
        </button>
        <button className="addbtn" onClick={() => setAdding(true)}>
          <Plus width="16" height="16" /> Add
        </button>
      </nav>

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
