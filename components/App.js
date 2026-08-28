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
import Login from './Login';
import Lock from './Lock';
import { Home, Chart, Gear, Plus, Calendar, Calc, Heart } from './Icons';

export default function App() {
  const { ready, session, loading, settings, configured } = useStore();
  const [tab, setTab] = useState('home');
  const [adding, setAdding] = useState(false);
  const [presetAccount, setPresetAccount] = useState(null);
  const [editing, setEditing] = useState(null);
  const [presetAmount, setPresetAmount] = useState(null);
  const [theme, setTheme] = useState('light');
  const [unlocked, setUnlocked] = useState(false);

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
      <div key={tab} className="viewfade">
        {tab === 'home' && <HomeView onAddTo={(id) => { setPresetAccount(id); setAdding(true); }} />}
        {tab === 'entries' && <EntriesView onEdit={setEditing} />}
        {tab === 'paari' && <PaariView />}
        {tab === 'insights' && <InsightsView />}
        {tab === 'calc' && (
          <CalculatorView onUse={(v) => { setPresetAmount(v); setPresetAccount(null); setAdding(true); }} />
        )}
        {tab === 'settings' && <SettingsView theme={theme} toggleTheme={toggleTheme} />}
      </div>

      <nav className="nav">
        <button className={'navbtn' + (tab === 'home' ? ' on' : '')} onClick={() => setTab('home')}>
          <Home /> Home
        </button>
        <button className={'navbtn' + (tab === 'entries' ? ' on' : '')} onClick={() => setTab('entries')}>
          <Calendar /> Entries
        </button>
        <button className={'navbtn' + (tab === 'paari' ? ' on' : '')} onClick={() => setTab('paari')}>
          <Heart /> Paari
        </button>
        <button className={'navbtn' + (tab === 'insights' ? ' on' : '')} onClick={() => setTab('insights')}>
          <Chart /> Patterns
        </button>
        <button className={'navbtn' + (tab === 'calc' ? ' on' : '')} onClick={() => setTab('calc')}>
          <Calc /> Calc
        </button>
        <button className={'navbtn' + (tab === 'settings' ? ' on' : '')} onClick={() => setTab('settings')}>
          <Gear /> Settings
        </button>
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
        <div className="mark">Ledgerline</div>
        <p className="tag2">Opening your ledger…</p>
      </div>
    </div>
  );
}
