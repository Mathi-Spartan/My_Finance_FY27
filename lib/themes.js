// Twenty-five palettes. Each is described by five colours; everything else —
// borders, muted text, secondary surfaces — is mixed from those, so the whole
// interface stays consistent no matter how bold the palette gets.

const mk = (id, name, group, paper, card, ink, brand, g, dark) =>
  ({ id, name, group, paper, card, ink, brand, g, dark });

// dark neutrals shared by most palettes; a theme can override them
const NIGHT = { paper: '#080B13', card: '#141A28', ink: '#EFF3FA' };

export const THEMES = [
  // ---------- quiet ----------
  mk('azure',    'Azure',        'Quiet', '#E8EEF6', '#FFFFFF', '#0A1A2B', '#0B6FBF', ['#063E73','#0F7BC4','#3FA9E5']),
  mk('graphite', 'Graphite',     'Quiet', '#E5E7EC', '#FFFFFF', '#11141A', '#2F6BD8', ['#1B3A6B','#2F6BD8','#6AA4F0']),
  mk('ivory',    'Ivory',        'Quiet', '#F2EDE3', '#FFFDF8', '#231E16', '#A2632A', ['#4A2E10','#A2632A','#DFA45C']),
  mk('mist',     'Slate mist',   'Quiet', '#D8E2F0', '#FFFFFF', '#0B1A2B', '#0B6FBF', ['#08375F','#0F7BC4','#57B4EC']),
  mk('sand',     'Sand',         'Quiet', '#EFE7DA', '#FFFCF6', '#2A231A', '#8A6D3B', ['#3D2F16','#8A6D3B','#C9A868']),
  mk('mintpaper','Mint paper',   'Quiet', '#E4EFE9', '#FFFFFF', '#0F221B', '#0E7C5A', ['#06392A','#0E7C5A','#43C299']),
  mk('rose',     'Rose quartz',  'Quiet', '#F3E7EA', '#FFFCFD', '#2A1418', '#A83A55', ['#4A0F21','#A83A55','#E08199']),
  mk('porcelain','Porcelain',    'Quiet', '#ECEFF3', '#FFFFFF', '#161A20', '#4A5A70', ['#232E3E','#4A5A70','#8DA0B8']),
  mk('lavender', 'Lavender',     'Quiet', '#EBE8F6', '#FFFFFF', '#1B1630', '#5B4BC4', ['#2A1F6B','#5B4BC4','#9A8CEB']),

  // ---------- bold ----------
  mk('papaya',   'Papaya',       'Bold',  '#FF7A1A', '#FFFFFF', '#33170A', '#C2410C', ['#2A1206','#8A3A0A','#D9600F']),
  mk('crimson',  'Crimson',      'Bold',  '#D22B3A', '#FFFFFF', '#2B060B', '#B01F2E', ['#4A0810','#93172A','#D6314A']),
  mk('violet',   'Electric violet','Bold','#5B2BE0', '#FFFFFF', '#1B0A45', '#5B2BE0', ['#260C77','#5B2BE0','#9B7BFF']),
  mk('teal',     'Deep teal',    'Bold',  '#0E9488', '#FFFFFF', '#04302B', '#0B7A70', ['#03352F','#0B7A70','#22C0AC']),
  mk('cobalt',   'Cobalt',       'Bold',  '#1E4FD8', '#FFFFFF', '#0A1440', '#1E4FD8', ['#0C1F73','#1E4FD8','#6C93F5']),
  mk('magenta',  'Magenta',      'Bold',  '#C2189B', '#FFFFFF', '#31063F', '#A3117F', ['#4A0745','#A3117F','#E858C4']),
  mk('lime',     'Lime',         'Bold',  '#7FB800', '#FFFFFF', '#1E2A05', '#4F7A00', ['#233A00','#4F7A00','#A8D93A']),
  mk('sunset',   'Sunset',       'Bold',  '#F0553F', '#FFFFFF', '#33100A', '#C33A22', ['#4A150A','#C33A22','#FF8A6B']),
  mk('indigo',   'Royal indigo', 'Bold',  '#3730A3', '#FFFFFF', '#140F3D', '#3730A3', ['#1B1470','#3730A3','#8079E8']),
  mk('marigold', 'Marigold',     'Bold',  '#E5A50A', '#FFFFFF', '#332305', '#9A6A02', ['#3D2A02','#9A6A02','#F2C34A']),

  // ---------- night ----------
  mk('midnight', 'Midnight',     'Night', '#E8EEF6', '#FFFFFF', '#0A1A2B', '#4FA8E8', ['#0A4F86','#1E7FC4','#5CB6EE'], NIGHT),
  mk('carbon',   'Carbon',       'Night', '#E9EAEC', '#FFFFFF', '#121316', '#9AA3B2', ['#3A414F','#68738A','#A8B2C4'],
     { paper:'#0B0C0F', card:'#17191E', ink:'#F0F2F6' }),
  mk('deepsea',  'Deep sea',     'Night', '#E2EFF2', '#FFFFFF', '#04222B', '#22B8CF', ['#053A48','#0E8CA8','#3FD0E5'],
     { paper:'#04121A', card:'#0E2029', ink:'#E8F6FA' }),
  mk('forest',   'Forest',       'Night', '#E6EFE6', '#FFFFFF', '#0C2113', '#3FBF6A', ['#0A3A1E','#1E7A40','#4FD37E'],
     { paper:'#07130C', card:'#12241A', ink:'#EAF6EE' }),
  mk('plum',     'Plum',         'Night', '#F0E9F2', '#FFFFFF', '#220C2B', '#C77DE8', ['#3E1152','#7A2AA0','#C77DE8'],
     { paper:'#120A17', card:'#211428', ink:'#F5ECF8' }),
  mk('espresso', 'Espresso',     'Night', '#F0EAE3', '#FFFFFF', '#241A12', '#D99B5E', ['#3D2A18','#8A5A2E','#D99B5E'],
     { paper:'#120D09', card:'#221A13', ink:'#F6EFE8' }),
];

export const GROUPS = ['Quiet', 'Bold', 'Night'];
export const byId = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

// Everything below is mixed from the five seed colours, so a palette only ever
// has to describe its character, never every last border.
function tokens(t, mode) {
  const night = mode === 'dark';
  const base = night ? (t.dark || NIGHT) : t;
  const paper = base.paper;
  const card = base.card;
  const ink = base.ink;
  const brand = night ? t.g[2] : t.brand;
  const [g1, g2, g3] = night ? [t.g[0], t.g[1], t.g[2]] : t.g;

  const mix = (a, pct, b) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

  return {
    '--paper': paper,
    '--card': card,
    '--card-2': mix(ink, night ? 6 : 5, card),
    '--line': mix(ink, night ? 16 : 15, card),
    '--line-2': mix(ink, night ? 10 : 8, card),
    '--ink': ink,
    '--ink-2': mix(ink, 66, paper),
    '--ink-3': mix(ink, 42, paper),
    '--brand': brand,
    '--brand-soft': mix(brand, night ? 20 : 13, card),
    '--g1': g1, '--g2': g2, '--g3': g3,
    '--glow': `0 18px 44px -16px ${mix(g2, 55, 'transparent')}`,
    '--shadow': night
      ? '0 1px 2px rgba(0,0,0,.5), 0 12px 30px -14px rgba(0,0,0,.75)'
      : `0 1px 2px ${mix(ink, 7, 'transparent')}, 0 10px 26px -12px ${mix(ink, 22, 'transparent')}`,
  };
}

export function applyTheme(id, mode) {
  if (typeof document === 'undefined') return;
  const t = byId(id);
  const vars = tokens(t, mode);
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = mode;
  root.dataset.palette = t.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.g[1]);
}

// the two swatch colours a picker needs to show a palette honestly
export const swatch = (t, mode = 'light') => {
  const base = mode === 'dark' ? (t.dark || NIGHT) : t;
  return { paper: base.paper, card: base.card, accent: t.g[1] };
};
