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
import WorldPicker from './WorldPicker';
import { worldOf, rememberWorld, lastWorld } from '@/lib/worlds';
import Lock from './Lock';
import { Plus } from './Icons';
import { NAV_ICONS } from './NavIcons';
import StatementView from './StatementView';
import HealthView from './HealthView';
import LabView from './LabView';
import ThemePicker from './ThemePicker';
import { THEMES, applyTheme, byId } from '@/lib/themes';

const TAB_SETS = {
  finance: [
    { id: 'home', label: 'Home' }, { id: 'entries', label: 'Entries' },
    { id: 'paari', label: 'Paari' }, { id: 'drivers', label: 'Drivers' },
    { id: 'insights', label: 'Patterns' }, { id: 'calc', label: 'Calc' },
    { id: 'scan', label: 'Scan' },
  ],
  health: [
    { id: 'today', label: 'Today' }, { id: 'trends', label: 'Trends' },
    { id: 'body', label: 'Body' }, { id: 'sleep', label: 'Sleep' },
    { id: 'calc', label: 'Calc' },
  ],
  lab: [
    { id: 'lab', label: 'Lab' }, { id: 'trends', label: 'Trends' },
    { id: 'today', label: 'Today' },
  ],
};


// Each world shows its own tabs. Finance keeps the seven it had; the other two
// are much smaller, which is the point of separating them.
const TABS = [
  { id: 'home',     label: 'Home' },
  { id: 'entries',  label: 'Entries' },
  { id: 'paari',    label: 'Paari' },
  { id: 'drivers',  label: 'Drivers' },
  { id: 'insights', label: 'Patterns' },
  { id: 'calc',     label: 'Calc' },
  { id: 'scan',     label: 'Scan' },
];

const TABS_BY_WORLD = {
  health: [
    { id: 'today',  label: 'Today' },
    { id: 'trends', label: 'Trends' },
    { id: 'body',   label: 'Body' },
    { id: 'sleep',  label: 'Sleep' },
  ],
  lab: [
    { id: 'lab',     label: 'The Lab' },
    { id: 'running', label: 'Running' },
    { id: 'done',    label: 'Finished' },
  ],
};

export default function App() {
  const { ready, session, loading, settings, configured } = useStore();
  const [tab, setTab] = useState('home');
  const [adding, setAdding] = useState(false);
  const [presetAccount, setPresetAccount] = useState(null);
  const [editing, setEditing] = useState(null);
  const [presetAmount, setPresetAmount] = useState(null);
  const [theme, setTheme] = useState('light');
  const [palette, setPalette] = useState('azure');
  const [picking, setPicking] = useState(false);
  const [flash, setFlash] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [world, setWorld] = useState(null);
  const [dir, setDir] = useState('fwd');

  // Move between tabs through the View Transitions API when the browser has
  // it, so the two screens cross-dissolve as one surface instead of swapping.

  const go = (next) => {
    if (next === tab) return;
    const list = TABS_BY_WORLD[world] || TABS;
    const from = list.findIndex((t) => t.id === tab);
    const to = list.findIndex((t) => t.id === next);
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
    const savedMode = localStorage.getItem('ll-theme') || 'light';
    const savedPalette = localStorage.getItem('ll-palette') || 'azure';
    const savedWorld = lastWorld();
    if (savedWorld) setWorld(savedWorld);
    const w = savedWorld ? worldOf(savedWorld) : null;
    const mode = w ? (localStorage.getItem('ll-theme-' + savedWorld) || w.mode) : savedMode;
    const pal = w ? (localStorage.getItem('ll-palette-' + savedWorld) || w.palette) : savedPalette;
    setTheme(mode);
    setPalette(pal);
    applyTheme(pal, mode);
    // restoring a world has to restore its first tab too, or it opens on a
    // screen that belongs to a different world
    if (w) setTab(w.tabs[0]);
  }, []);

  // Choosing a world sets the whole identity, not just the first tab.
  const enterWorld = (id) => {
    const w = worldOf(id);
    setWorld(id);
    rememberWorld(id);
    const mode = localStorage.getItem('ll-theme-' + id) || w.mode;
    const pal = localStorage.getItem('ll-palette-' + id) || w.palette;
    setTheme(mode);
    setPalette(pal);
    applyTheme(pal, mode);
    setTab(w.tabs[0] === 'home' ? 'home' : w.tabs[0]);
  };

  // which tabs this world shows
  const tabsFor = TABS_BY_WORLD[world] || TABS;

  useEffect(() => {
    if (!world) return;
    const ids = tabsFor.map((t) => t.id);
    if (!ids.includes(tab) && tab !== 'settings') setTab(ids[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const leaveWorld = () => {
    setWorld(null);
    try { localStorage.removeItem('ll-world'); } catch {}
  };

  const usePalette = (id, mode = theme) => {
    setPalette(id);
    localStorage.setItem('ll-palette', id);
    if (world) localStorage.setItem('ll-palette-' + world, id);
    applyTheme(id, mode);
  };

  // one tap moves to the next palette, so you can flick through them
  const shuffle = () => {
    const i = THEMES.findIndex((t) => t.id === palette);
    const next = THEMES[(i + 1) % THEMES.length];
    usePalette(next.id);
    setFlash(next.name);
    clearTimeout(window.__paletteT);
    window.__paletteT = setTimeout(() => setFlash(''), 1400);
    if (navigator.vibrate) navigator.vibrate(8);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ll-theme', next);
    if (world) localStorage.setItem('ll-theme-' + world, next);
    applyTheme(palette, next);
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  if (!ready) return <Splash />;
  if (!world) return <WorldPicker onPick={enterWorld} />;
  if (!session || !configured) return <Login world={worldOf(world)} onBack={leaveWorld} />;
  if (loading && !settings) return <Splash />;
  if (settings?.pin && !unlocked) return <Lock pin={settings.pin} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="shell">
      <div key={tab} className={"viewfade " + dir}>
        {tab === 'home' && <HomeView onAddTo={(id) => { setPresetAccount(id); setAdding(true); }} goTo={go} onShuffle={shuffle} onThemes={() => setPicking(true)}
                                     theme={theme} toggleTheme={toggleTheme} />}
        {tab === 'entries' && <EntriesView onEdit={setEditing} />}
        {tab === 'paari' && <PaariView />}
        {tab === 'drivers' && <DriversView />}
        {tab === 'insights' && <InsightsView />}
        {tab === 'scan' && <StatementView />}
        {['today', 'trends', 'body', 'sleep'].includes(tab) && <HealthView tab={tab} goTo={go} />}
        {['lab', 'running', 'done'].includes(tab) && <LabView tab={tab} goTo={go} />}
        {tab === 'calc' && (
          <CalculatorView onUse={(v) => { setPresetAmount(v); setPresetAccount(null); setAdding(true); }} />
        )}
        {tab === 'settings' && <SettingsView theme={theme} toggleTheme={toggleTheme} palette={palette} onThemes={() => setPicking(true)}
                                        world={worldOf(world)} onLeaveWorld={leaveWorld}
                                        onBack={() => go(tabsFor[0].id)} />}
      </div>

      <nav className="nav solid">
        <div className="navtabs">
          {tabsFor.map(({ id, label }) => {
            const Icon = NAV_ICONS[id] || NAV_ICONS.home;
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
      {picking && (
        <ThemePicker current={palette} mode={theme}
                     onPick={(id) => usePalette(id)}
                     onClose={() => setPicking(false)} />
      )}
      {flash && <div className="palettetoast">{flash}</div>}
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
