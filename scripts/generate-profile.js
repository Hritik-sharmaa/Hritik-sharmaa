#!/usr/bin/env node
// Builds the "designer's desk" profile art for the README:
//   assets/profile.svg  - one continuous image (hero, about, tech stack, live GitHub stats, sign-off)
//   assets/link-*.svg   - clickable paper-tag link buttons shown under it
// Usage: node scripts/generate-profile.js   (set GITHUB_TOKEN for higher API rate limits)
// If the GitHub fetch fails, the last good numbers in scripts/data/stats.json are reused.
const fs = require('fs'), path = require('path');

const USER = 'Hritik-sharmaa';
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(__dirname, 'data');
const ICONS = JSON.parse(fs.readFileSync(path.join(DATA, 'icons.json'), 'utf8'));
const STATS_CACHE = path.join(DATA, 'stats.json');

// ---------- palette ----------
const C = {
  mat: '#2D5BDB', matMinor: '#4673E6', matMajor: '#6F95F2',
  navy: '#13235E', paper: '#FFFEFA', paperShade: '#EEEBE2',
  grid: '#F4EFE1', gridLine: '#E3D8BE',
  wood: '#B97E46', woodDark: '#8E5A2C', woodLight: '#D39A5E',
  yellow: '#FFC93C', yellowDark: '#E5A516', pink: '#FF5FA2', pinkLight: '#FFC2DA',
  blue: '#2D5BDB', sky: '#DCE6FF', cream: '#FFF1C7', white: '#FFFFFF', steel: '#C9D2E3',
};
const SANS = "'Trebuchet MS', 'Segoe UI', Verdana, Helvetica, Arial, sans-serif";
const BOLD = "'Arial Black', 'Segoe UI Black', 'Helvetica Neue', Arial, sans-serif";
const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Chalkboard SE', cursive";

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = n => +n.toFixed(1);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ======================================================================
// GitHub data
// ======================================================================
async function fetchStats() {
  const headers = { 'User-Agent': `${USER}-profile-generator`, Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const gh = async p => {
    const r = await fetch('https://api.github.com' + p, { headers });
    if (!r.ok) throw new Error(`GET ${p} -> ${r.status}`);
    return r.json();
  };
  const user = await gh(`/users/${USER}`);
  const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner`)).filter(r => !r.fork);
  const langBytes = {};
  for (const r of repos) {
    const langs = await gh(`/repos/${r.full_name}/languages`);
    for (const [k, v] of Object.entries(langs)) langBytes[k] = (langBytes[k] || 0) + v;
  }
  const total = Object.values(langBytes).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
  const languages = sorted.slice(0, 5).map(([name, b]) => ({ name, pct: b / total * 100 }));
  const rest = sorted.slice(5).reduce((a, [, b]) => a + b, 0);
  if (rest) languages.push({ name: 'Other', pct: rest / total * 100 });

  const commits = (await gh(`/search/commits?q=author:${USER}`)).total_count;
  const prs = (await gh(`/search/issues?q=author:${USER}+type:pr`)).total_count;
  const issues = (await gh(`/search/issues?q=author:${USER}+type:issue`)).total_count;

  // Contribution calendar (public page; the API needs auth for this)
  const html = await (await fetch(`https://github.com/users/${USER}/contributions`, { headers: { 'User-Agent': headers['User-Agent'] } })).text();
  const cells = {};
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="([^"]+)"[^>]*data-level="(\d)"/g)) cells[m[2]] = { date: m[1], level: +m[3], count: 0 };
  for (const m of html.matchAll(/for="([^"]+)"[^>]*>(No|\d[\d,]*) contributions?/g)) if (cells[m[1]]) cells[m[1]].count = m[2] === 'No' ? 0 : +m[2].replace(/,/g, '');
  const days = Object.values(cells).sort((a, b) => a.date < b.date ? -1 : 1);
  if (days.length < 300) throw new Error('could not read contribution calendar');

  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, current = 0;
  if (days[i].count === 0) i--; // today not counted yet
  while (i >= 0 && days[i].count > 0) { current++; i--; }

  return {
    updated: new Date().toISOString().slice(0, 10),
    repos: user.public_repos, followers: user.followers,
    stars: repos.reduce((a, r) => a + r.stargazers_count, 0),
    commits, prs, issues, languages,
    contributions: days.reduce((a, d) => a + d.count, 0), current, longest,
    days: days.map(d => [d.date, d.level]),
  };
}

// ---------- 5x7 pixel font ----------
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};
function pixelRuns(str) {
  const runs = []; let cx = 0;
  for (const ch of str.toUpperCase()) {
    const g = G[ch]; if (!g) throw new Error('no pixel glyph for ' + ch);
    g.forEach((row, ry) => {
      let start = -1;
      for (let i = 0; i <= row.length; i++) {
        if (row[i] === '#') { if (start < 0) start = i; }
        else if (start >= 0) { runs.push([cx + start, ry, i - start]); start = -1; }
      }
    });
    cx += g[0].length + 1;
  }
  return { runs, w: cx - 1 };
}
const pixelWidth = (str, px) => pixelRuns(str).w * px;
// Layered pixel lettering: drop shadow, rim, edge, fill.
function pixelText(str, x, y, px, o = {}) {
  const { fill = C.blue, edge = C.navy, rim = C.white, shadow = C.navy, e = Math.max(1, px * 0.18), r = Math.max(2, px * 0.38), d = Math.max(2, px * 0.4) } = o;
  const { runs } = pixelRuns(str);
  const layer = (grow, dx, dy, color) => `<g fill="${color}">` + runs.map(([rx, ry, rw]) =>
    `<rect x="${f(x + rx * px - grow + dx)}" y="${f(y + ry * px - grow + dy)}" width="${f(rw * px + grow * 2)}" height="${f(px + grow * 2)}"/>`).join('') + '</g>';
  let s = '';
  if (shadow) s += layer(e + r, d, d, shadow);
  if (rim) s += layer(e + r, 0, 0, rim);
  if (edge) s += layer(e, 0, 0, edge);
  return s + layer(0, 0, 0, fill);
}
// White-on-mat section title with yellow chevrons, like "CONTENTS >>>>"
const matTitle = (text, x, y, px = 6) => pixelText(text, x, y, px, { fill: C.white, edge: C.blue, rim: C.navy, shadow: null }) +
  pixelText('>>>>', x + pixelWidth(text, px) + 22, y, px, { fill: C.yellow, edge: C.navy, rim: null, shadow: null });

// ---------- shared drawing helpers ----------
function svgOpen(w, h, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">\n<title>${esc(label)}</title>\n`;
}
function mat(w, h, id, step = 20) {
  let lines = '', major = '', ticks = '';
  for (let x = step; x < w; x += step) (x % (step * 5) ? l => lines += l : l => major += l)(`<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`);
  for (let y = step; y < h; y += step) (y % (step * 5) ? l => lines += l : l => major += l)(`<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`);
  for (let x = 10; x < w; x += 10) ticks += `<line x1="${x}" y1="0" x2="${x}" y2="${x % 50 ? 6 : 12}"/>`;
  for (let y = 10; y < h; y += 10) ticks += `<line x1="0" y1="${y}" x2="${y % 50 ? 6 : 12}" y2="${y}"/><line x1="${w}" y1="${y}" x2="${w - (y % 50 ? 6 : 12)}" y2="${y}"/>`;
  return `<defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="24"/></clipPath></defs>
<g clip-path="url(#${id})"><rect width="${w}" height="${h}" fill="${C.mat}"/>
<g stroke="${C.matMinor}" stroke-width="1">${lines}</g><g stroke="${C.matMajor}" stroke-width="1.6">${major}</g>
<g stroke="#FFFFFF" stroke-width="1.2" opacity="0.55">${ticks}</g>`;
}
// Rectangle with torn/jagged edges on the chosen sides.
function tornPath(x, y, w, h, seed, sides = { b: 1 }, amp = 5, seg = 9) {
  const r = rng(seed), pts = [];
  const edge = (x1, y1, x2, y2, torn, nx, ny) => {
    const n = torn ? Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / seg)) : 1;
    for (let i = 0; i < n; i++) {
      const t = i / n, j = torn && i > 0 ? (r() - 0.35) * amp : 0;
      pts.push([x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j]);
    }
  };
  edge(x, y, x + w, y, sides.t, 0, -1);
  edge(x + w, y, x + w, y + h, sides.r, 1, 0);
  edge(x + w, y + h, x, y + h, sides.b, 0, 1);
  edge(x, y + h, x, y, sides.l, -1, 0);
  return 'M' + pts.map(p => f(p[0]) + ',' + f(p[1])).join(' L') + 'Z';
}
const shadowed = (d, fill) => `<path d="${d}" fill="${C.navy}" opacity="0.32" transform="translate(7 9)"/><path d="${d}" fill="${fill}"/>`;
const holes = (x1, x2, y, step = 24, r = 4) => { let s = ''; for (let x = x1; x < x2; x += step) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.mat}" stroke="${C.navy}" stroke-width="1"/>`; return s; };
const sparkle = (x, y, s, fill, stroke = C.navy, sw = 2) =>
  `<path d="M${x},${y - s} Q${x},${y} ${x + s},${y} Q${x},${y} ${x},${y + s} Q${x},${y} ${x - s},${y} Q${x},${y} ${x},${y - s}Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
function binderClip(x, y, color = C.pink, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
<path d="M-16,8 C-22,-14 -6,-22 -4,-4" fill="none" stroke="#9AA6BD" stroke-width="3.2" stroke-linecap="round"/>
<path d="M16,8 C22,-14 6,-22 4,-4" fill="none" stroke="#7D89A3" stroke-width="3.2" stroke-linecap="round"/>
<path d="M-24,6 L24,6 L20,30 L-20,30Z" fill="${color}" stroke="${C.navy}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M-20,12 L20,12" stroke="#FFFFFF" stroke-width="2.5" opacity="0.6" stroke-linecap="round"/></g>`;
}
function tape(x, y, w, rot, color = C.pinkLight, op = 0.85) {
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + 11})" opacity="${op}"><path d="${tornPath(x, y, w, 22, Math.round(x * 7 + y), { l: 1, r: 1 }, 4, 5)}" fill="${color}"/>
<g stroke="#FFFFFF" stroke-width="2" opacity="0.5">${Array.from({ length: Math.floor(w / 12) }, (_, i) => `<line x1="${x + 6 + i * 12}" y1="${y + 3}" x2="${x + 6 + i * 12}" y2="${y + 19}"/>`).join('')}</g></g>`;
}
function folder(x, y, rot, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
<path d="M8,10 L50,10 L60,0 L118,0 Q126,0 126,8 L126,98 Q126,104 120,104 L8,104 Q0,104 0,96 L0,18 Q0,10 8,10Z" fill="${C.yellowDark}" stroke="${C.navy}" stroke-width="3" stroke-linejoin="round"/>
<rect x="14" y="14" width="96" height="70" rx="3" fill="#FFFFFF" stroke="${C.navy}" stroke-width="2.5" transform="rotate(-6 60 50)"/>
<rect x="22" y="10" width="92" height="70" rx="3" fill="${C.sky}" stroke="${C.navy}" stroke-width="2.5" transform="rotate(5 60 50)"/>
<g stroke="${C.blue}" stroke-width="3" stroke-linecap="round" transform="rotate(5 60 50)"><line x1="34" y1="26" x2="80" y2="26"/><line x1="34" y1="36" x2="96" y2="36"/></g>
<path d="M-4,40 L122,40 Q130,40 129,48 L124,98 Q123,106 115,106 L8,106 Q0,106 0,98 L-10,48 Q-11,40 -4,40Z" fill="${C.yellow}" stroke="${C.navy}" stroke-width="3" stroke-linejoin="round"/>
<path d="M4,50 L118,50" stroke="#FFFFFF" stroke-width="3" opacity="0.55" stroke-linecap="round"/></g>`;
}
function pencil(x, y, rot, len = 170) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
<rect x="0" y="-9" width="${len}" height="18" fill="${C.yellow}" stroke="${C.navy}" stroke-width="2.5"/>
<rect x="0" y="-9" width="${len}" height="6" fill="#FFE07A"/>
<line x1="0" y1="3" x2="${len}" y2="3" stroke="${C.yellowDark}" stroke-width="2"/>
<rect x="-14" y="-9" width="14" height="18" fill="#C9D2E3" stroke="${C.navy}" stroke-width="2.5"/>
<rect x="-32" y="-9" width="18" height="18" rx="5" fill="${C.pink}" stroke="${C.navy}" stroke-width="2.5"/>
<path d="M${len},-9 L${len + 30},0 L${len},9Z" fill="#F2C99A" stroke="${C.navy}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M${len + 19},-3.6 L${len + 30},0 L${len + 19},3.6Z" fill="${C.navy}"/></g>`;
}
function scissors(x, y, rot, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
<path d="M0,-6 L92,-22 L96,-16 L6,6Z" fill="#E9EEF7" stroke="${C.navy}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M0,6 L92,22 L96,16 L6,-6Z" fill="#D4DBEA" stroke="${C.navy}" stroke-width="2.5" stroke-linejoin="round"/>
<circle cx="4" cy="0" r="4" fill="${C.navy}"/>
<ellipse cx="-26" cy="-17" rx="20" ry="14" fill="none" stroke="${C.navy}" stroke-width="12"/>
<ellipse cx="-26" cy="-17" rx="20" ry="14" fill="none" stroke="${C.blue}" stroke-width="7"/>
<ellipse cx="-26" cy="17" rx="20" ry="14" fill="none" stroke="${C.navy}" stroke-width="12"/>
<ellipse cx="-26" cy="17" rx="20" ry="14" fill="none" stroke="${C.pink}" stroke-width="7"/></g>`;
}
function clipboard(x, y, rot) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
<rect x="0" y="0" width="104" height="130" rx="10" fill="#F59E4C" stroke="${C.navy}" stroke-width="3"/>
<rect x="10" y="16" width="84" height="104" rx="3" fill="#FFFFFF" stroke="${C.navy}" stroke-width="2.5"/>
<g stroke="${C.steel}" stroke-width="3" stroke-linecap="round"><line x1="22" y1="44" x2="82" y2="44"/><line x1="22" y1="58" x2="82" y2="58"/><line x1="22" y1="72" x2="70" y2="72"/><line x1="22" y1="86" x2="78" y2="86"/></g>
<path d="M22,98 l6,6 l12,-12" fill="none" stroke="${C.pink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="30" y="-8" width="44" height="22" rx="6" fill="#C9D2E3" stroke="${C.navy}" stroke-width="2.5"/>
<rect x="60" y="54" width="34" height="30" fill="${C.pinkLight}" stroke="${C.navy}" stroke-width="2" transform="rotate(8 77 69)"/></g>`;
}
function keyboard(x, y, rot, cols = 12, rows = 3) {
  const accent = new Set(['0,3', '1,7', '2,1', '0,9', '2,10']);
  let keys = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    keys += `<rect x="${12 + c * 30 + (r % 2) * 8}" y="${10 + r * 30}" width="24" height="24" rx="5" fill="${accent.has(r + ',' + c) ? C.yellow : '#F7F8FC'}" stroke="${C.navy}" stroke-width="2"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="0" y="0" width="${cols * 30 + 28}" height="${rows * 30 + 16}" rx="12" fill="#C3CBDD" stroke="${C.navy}" stroke-width="3"/>${keys}</g>`;
}
function triangleRuler(x, y, rot, s = 1) {
  let t = '';
  for (let i = 0; i < 14; i++) t += `<line x1="${8 + i * 10}" y1="146" x2="${8 + i * 10}" y2="${150 - (i % 5 ? 12 : 20)}"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0,0 L0,150 L150,150Z M22,60 L22,128 L90,128Z" fill-rule="evenodd" fill="${C.yellow}" fill-opacity="0.92" stroke="${C.navy}" stroke-width="3" stroke-linejoin="round"/>
<g stroke="${C.navy}" stroke-width="2">${t}</g></g>`;
}
function cursor(x, y, px = 4) {
  const rows = ['#.........', '##........', '#Y#.......', '#YY#......', '#YYY#.....', '#YYYY#....', '#YYYYY#...', '#YYYYYY#..', '#YYYYYYY#.', '#YYYY####.', '#Y#YY#....', '##.#YY#...', '#...#YY#..', '....#YY#..', '.....##...'];
  let s = '';
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch !== '.') s += `<rect x="${f(x + rx * px)}" y="${f(y + ry * px)}" width="${px}" height="${px}" fill="${ch === '#' ? C.navy : C.yellow}"/>`;
  }));
  return `<g>${s}</g>`;
}
const icon = (item, x, y, size, color) =>
  `<g transform="translate(${f(x)} ${f(y)}) scale(${size / 24})" fill="${color}">${item.ds.map(d => `<path d="${d}"/>`).join('')}</g>`;
function pill(x, y, text, o = {}) {
  const { fs = 12, fill = 'none', stroke = '#FFFFFF', color = '#FFFFFF', h = 26, sw = 2 } = o;
  const w = o.w || Math.round(text.length * fs * 0.62 + 26);
  return { w, svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
<text x="${x + w / 2}" y="${f(y + h / 2 + fs * 0.36)}" text-anchor="middle" font-family="${BOLD}" font-size="${fs}" fill="${color}" textLength="${w - 22}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>` };
}
function pillRow(x, y, texts, o) { let s = '', cx = x; for (const t of texts) { const p = pill(cx, y, t, o); s += p.svg; cx += p.w + 10; } return s; }
const pillRowWidth = (texts, o) => texts.reduce((a, t) => a + pill(0, 0, t, o).w + 10, -10);
// Card title used across sections: "01 LANGUAGES" + pink marker underline + handwritten note
function cardHead(x, y, w, num, title, note) {
  let s = '';
  if (num) s += pixelText(num, x + 18, y + 32, 3.4, { fill: C.pink, edge: C.navy, rim: null, shadow: null, e: 1 });
  const tx = num ? x + 70 : x + 20;
  s += `<text x="${tx}" y="${y + 55}" font-family="${BOLD}" font-size="17" fill="${C.navy}">${esc(title)}</text>`;
  s += `<rect x="${tx}" y="${y + 60}" width="${title.length * 11.5}" height="4" rx="2" fill="${C.pink}" opacity="0.75"/>`;
  if (note) s += `<text x="${x + w - 18}" y="${y + 52}" text-anchor="end" font-family="${HAND}" font-size="13" fill="${C.blue}" transform="rotate(-4 ${x + w - 60} ${y + 48})">${esc(note)}</text>`;
  return s;
}
function wrap(text, maxChars) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { if ((line + ' ' + w).trim().length > maxChars) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) out.push(line); return out;
}
const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n);

// ======================================================================
// Sections - each draws in its own local coordinates (top = 0)
// ======================================================================
function hero() {
  let s = keyboard(520, -58, 4);
  s += triangleRuler(800, 330, -18, 0.95);
  const px0 = 150, py0 = 58, pw = 600, ph = 320;
  const d = tornPath(px0, py0, pw, ph, 11, { b: 1, r: 1 }, 6, 10);
  s += `<g transform="rotate(-1.5 450 220)">${shadowed(d, C.paper)}`;
  s += `<g stroke="${C.paperShade}" stroke-width="2" fill="none"><path d="M${px0 + 40},${py0 + 250} L${px0 + 210},${py0 + 180} L${px0 + 330},${py0 + 300}"/><path d="M${px0 + 420},${py0 + 40} L${px0 + 520},${py0 + 140} L${px0 + 600},${py0 + 110}"/></g>`;
  s += holes(px0 + 22, px0 + pw - 10, py0 + 14, 26, 5);
  // design-tool selection box around the name
  const sx = 210, sy = 106, sw = 470, sh = 196;
  s += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="none" stroke="#3B82F6" stroke-width="1.6"/>`;
  for (const [hx, hy] of [[sx, sy], [sx + sw / 2, sy], [sx + sw, sy], [sx, sy + sh / 2], [sx + sw, sy + sh / 2], [sx, sy + sh], [sx + sw / 2, sy + sh], [sx + sw, sy + sh]])
    s += `<rect x="${hx - 5}" y="${hy - 5}" width="10" height="10" fill="#FFFFFF" stroke="#3B82F6" stroke-width="1.6"/>`;
  s += `<rect x="${sx}" y="${sy - 30}" width="92" height="20" rx="4" fill="#3B82F6"/><text x="${sx + 46}" y="${sy - 16}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="11" fill="#FFFFFF">Frame · 2026</text>`;
  s += pixelText('HRITIK', 232, 124, 11);
  s += pixelText('SHARMA', 282, 218, 11, { fill: '#3F6FF0' });
  s += `<g transform="rotate(-9 680 140)" font-family="${HAND}" font-weight="700" fill="${C.pink}"><text x="636" y="150" font-size="26">dev</text><text x="650" y="184" font-size="26">folio.</text></g>`;
  s += `<path d="M640,196 q30,8 70,-8" fill="none" stroke="${C.pink}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<g transform="translate(250 298) rotate(-90)"><text x="0" y="0" font-family="${BOLD}" font-size="25" fill="none" stroke="${C.pink}" stroke-width="2.4" letter-spacing="2">2026</text></g>`;
  s += cursor(640, 268, 4);
  s += sparkle(214, 96, 10, C.pink) + sparkle(694, 236, 8, C.white, C.pink) + sparkle(660, 92, 6, C.blue, C.blue, 1);
  [['Full-stack developer', 'React · Next.js · Node'], ['22 · India', 'Always learning, shipping']].forEach((col, ci) => col.forEach((t, ri) => {
    const bx = 230 + ci * 200, by = 334 + ri * 20;
    s += `<rect x="${bx}" y="${by - 8}" width="7" height="7" fill="${C.blue}"/><text x="${bx + 14}" y="${by}" font-family="${SANS}" font-size="12.5" font-weight="700" fill="${C.navy}">${esc(t)}</text>`;
  }));
  s += `<text x="672" y="356" font-family="${HAND}" font-size="13" fill="${C.blue}" text-anchor="middle" transform="rotate(-4 672 356)">building things</text><text x="676" y="373" font-family="${HAND}" font-size="13" fill="${C.blue}" text-anchor="middle" transform="rotate(-4 676 373)">that matter ✦</text>`;
  s += `</g>` + binderClip(450, 40, C.pink, 1.1);
  s += folder(28, 64, -12, 1.05) + scissors(818, 262, -118, 0.9) + clipboard(770, 64, 9);
  s += sparkle(120, 230, 9, C.white, C.navy) + sparkle(800, 222, 7, C.pink, C.navy);
  return { svg: s, h: 420 };
}

function about() {
  let s = '';
  const r = rng(5);
  let grain = '';
  for (let i = 0; i < 26; i++) { const y = 34 + i * 17 + r() * 6; grain += `<path d="M30,${f(y)} C${f(250 + r() * 100)},${f(y + (r() - 0.5) * 14)} ${f(560 + r() * 100)},${f(y + (r() - 0.5) * 14)} 870,${f(y + (r() - 0.5) * 6)}"/>`; }
  s += `<rect x="38" y="40" width="834" height="452" rx="28" fill="${C.navy}" opacity="0.3"/>`;
  s += `<rect x="30" y="30" width="836" height="452" rx="28" fill="${C.wood}" stroke="${C.navy}" stroke-width="3"/>`;
  s += `<defs><clipPath id="wb"><rect x="30" y="30" width="836" height="452" rx="28"/></clipPath></defs><g clip-path="url(#wb)"><g stroke="${C.woodDark}" stroke-width="1.6" fill="none" opacity="0.55">${grain}</g></g>`;
  s += `<rect x="36" y="36" width="824" height="440" rx="24" fill="none" stroke="${C.woodLight}" stroke-width="2" opacity="0.7"/>`;
  const gx = 56, gy = 54, gw = 788, gh = 400;
  const gd = tornPath(gx, gy, gw, gh, 21, { b: 1 }, 7, 12);
  s += `<path d="${gd}" fill="${C.grid}"/><defs><clipPath id="gp"><path d="${gd}"/></clipPath></defs><g clip-path="url(#gp)" stroke="${C.gridLine}" stroke-width="1">`;
  for (let x = gx + 18; x < gx + gw; x += 18) s += `<line x1="${x}" y1="${gy}" x2="${x}" y2="${gy + gh + 10}"/>`;
  for (let y = gy + 18; y < gy + gh + 10; y += 18) s += `<line x1="${gx}" y1="${y}" x2="${gx + gw}" y2="${y}"/>`;
  s += `</g><path d="${gd}" fill="none" stroke="${C.navy}" stroke-width="1.5" opacity="0.25"/>`;

  // ID badge
  s += `<g transform="rotate(-3 190 290)">`;
  s += `<path d="M150,-20 L176,96 L204,96 L230,-20" fill="none" stroke="${C.pink}" stroke-width="14"/><path d="M150,-20 L176,96 L204,96 L230,-20" fill="none" stroke="${C.navy}" stroke-width="2" opacity="0.4"/>`;
  const bx = 84, by = 104, bw = 212, bh = 344;
  s += `<rect x="${bx + 7}" y="${by + 9}" width="${bw}" height="${bh}" rx="18" fill="${C.navy}" opacity="0.35"/>`;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="18" fill="${C.yellow}" stroke="${C.navy}" stroke-width="3"/>`;
  s += `<rect x="${bx + bw / 2 - 26}" y="${by + 12}" width="52" height="10" rx="5" fill="${C.wood}" stroke="${C.navy}" stroke-width="2"/>`;
  s += `<rect x="178" y="86" width="24" height="30" rx="4" fill="#C9D2E3" stroke="${C.navy}" stroke-width="2.5"/>`;
  const fx = bx + 18, fy = by + 34, fw = bw - 36, fh = 150;
  s += `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="8" fill="${C.mat}" stroke="${C.navy}" stroke-width="3"/><g stroke="${C.matMinor}" stroke-width="1">`;
  for (let x = fx + 15; x < fx + fw; x += 15) s += `<line x1="${x}" y1="${fy + 2}" x2="${x}" y2="${fy + fh - 2}"/>`;
  for (let y = fy + 15; y < fy + fh; y += 15) s += `<line x1="${fx + 2}" y1="${y}" x2="${fx + fw - 2}" y2="${y}"/>`;
  s += `</g>` + pixelText('HS', fx + (fw - pixelWidth('HS', 9)) / 2, fy + 30, 9, { fill: C.yellow }) + sparkle(fx + 24, fy + 22, 7, C.pink, C.navy, 1.6) + sparkle(fx + fw - 20, fy + fh - 22, 6, C.white, C.navy, 1.4);
  s += `<text x="${fx + fw / 2}" y="${fy + fh - 14}" text-anchor="middle" font-family="${BOLD}" font-size="10" fill="#FFFFFF" letter-spacing="2">&lt;/&gt; DEV</text>`;
  const lr = `rotate(2 ${fx + fw / 2} ${fy + fh + 10})`;
  s += `<path d="${tornPath(fx - 8, fy + fh - 6, fw + 14, 34, 31, { t: 1, b: 1 }, 4, 7)}" fill="#FFFFFF" stroke="${C.navy}" stroke-width="1.5" transform="${lr}"/>`;
  s += `<text x="${fx + fw / 2}" y="${fy + fh + 17}" text-anchor="middle" font-family="${HAND}" font-weight="700" font-size="17" fill="${C.blue}" transform="${lr}">Hritik Sharma</text>`;
  [['NAME', 'Hritik Sharma'], ['ROLE', 'Full-stack dev'], ['AGE', '22'], ['BASE', 'India']].forEach(([k, v], i) => {
    const yy = fy + fh + 54 + i * 24;
    s += `<text x="${bx + 20}" y="${yy}" font-family="${BOLD}" font-size="10.5" fill="${C.navy}" letter-spacing="1">${k}</text>`;
    s += `<line x1="${bx + 68}" y1="${yy + 4}" x2="${bx + bw - 18}" y2="${yy + 4}" stroke="${C.navy}" stroke-width="1.4" stroke-dasharray="3 3" opacity="0.6"/>`;
    s += `<text x="${bx + 72}" y="${yy}" font-family="${SANS}" font-weight="700" font-size="12.5" fill="${C.navy}">${esc(v)}</text>`;
  });
  s += `</g>`;
  s += `<g transform="rotate(8 302 410)"><rect x="262" y="392" width="82" height="34" fill="${C.pink}" stroke="${C.navy}" stroke-width="2"/><text x="303" y="414" text-anchor="middle" font-family="${BOLD}" font-size="11" fill="#FFFFFF" letter-spacing="1">PERSONAL</text></g>`;

  // right column
  s += pixelText('ABOUT ME', 344, 78, 7) + sparkle(682, 84, 8, C.pink) + folder(732, 18, 14, 0.9);
  const head = (x, y, t) => `<text x="${x}" y="${y}" font-family="${BOLD}" font-size="15" fill="${C.navy}">${esc(t)}</text><path d="M${x + t.length * 9.6 + 6},${y - 9} l5,6 l5,-6" fill="none" stroke="${C.blue}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="${x}" y="${y + 6}" width="${t.length * 9.6}" height="4" rx="2" fill="${C.pink}" opacity="0.8"/>`;
  s += head(344, 162, 'What I do');
  [['BUILD', 'Full-stack web apps with React, Next.js, Node & Supabase.'], ['LEARN', 'Diving deep into complex tech, one rabbit hole at a time.'], ['SHIP', 'Always learning, always shipping things that matter.']].forEach(([tag, txt], i) => {
    const yy = 196 + i * 62;
    s += `<rect x="344" y="${yy - 13}" width="58" height="19" rx="4" fill="${i === 1 ? C.pink : C.blue}"/><text x="373" y="${yy + 1}" text-anchor="middle" font-family="${BOLD}" font-size="10" fill="#FFFFFF" letter-spacing="1">${tag}</text>`;
    wrap(txt, 34).forEach((ln, li) => s += `<text x="344" y="${yy + 24 + li * 17}" font-family="${SANS}" font-size="13" fill="${C.navy}">${esc(ln)}</text>`);
  });
  s += head(616, 162, 'Off the clock');
  let oy = 192;
  [['COFFEE', 'Fuels my productivity — always hunting for the perfect cup.', C.wood], ['ANIME', 'Naruto, One Piece, Tokyo Ghoul.', C.pink], ['SKETCHING', 'Drawing in my spare time.', C.blue]].forEach(([k, v, col]) => {
    s += `<circle cx="622" cy="${oy - 4}" r="5" fill="${col}" stroke="${C.navy}" stroke-width="1.5"/><text x="634" y="${oy}" font-family="${BOLD}" font-size="11" fill="${C.navy}" letter-spacing="1">${k}</text>`;
    const lines = wrap(v, 34);
    lines.forEach((ln, li) => s += `<text x="634" y="${oy + 17 + li * 16}" font-family="${SANS}" font-size="12.5" fill="${C.navy}">${esc(ln)}</text>`);
    oy += 26 + lines.length * 16;
  });
  s += head(616, 340, 'Core skills');
  const all = Object.fromEntries(['stack-languages', 'stack-frontend', 'stack-backend', 'stack-tools'].flatMap(k => ICONS[k]).map(i => [i.name, i]));
  [['JavaScript', '#F7DF1E', C.navy], ['TypeScript', '#3178C6', '#FFFFFF'], ['React', C.navy, '#61DAFB'], ['Next.js', '#000000', '#FFFFFF'], ['Node.js', '#5FA04E', '#FFFFFF'], ['MongoDB', '#E8F5E9', '#47A248']].forEach(([n, bg, fg], i) => {
    const tx = 616 + i * 36, ty = 360;
    s += `<rect x="${tx}" y="${ty}" width="30" height="30" rx="7" fill="${bg}" stroke="${C.navy}" stroke-width="2"/>` + icon(all[n], tx + 6, ty + 6, 18, fg);
  });
  s += pillRow(344, 412, ['REACT', 'NEXT.JS', 'NODE.JS', 'SUPABASE'], { fs: 10.5, h: 24, stroke: C.blue, color: C.blue, fill: '#FFFFFF' });
  s += `<g transform="rotate(5 800 440)"><rect x="756" y="406" width="92" height="70" fill="${C.cream}" stroke="${C.navy}" stroke-width="2"/>${tape(774, 396, 56, -4, C.pinkLight, 0.9)}
<text x="802" y="434" text-anchor="middle" font-family="${HAND}" font-size="13" font-weight="700" fill="${C.navy}">say hi →</text><text x="802" y="456" text-anchor="middle" font-family="${HAND}" font-size="12" fill="${C.blue}">hritik.space</text></g>`;
  return { svg: s, h: 500 };
}

function stack() {
  const PER = 6, SLOT = 61, ROW = 86, cw = 404, top0 = 96, gapY = 46;
  const cards = [
    { n: '01', t: 'LANGUAGES', note: 'the basics', k: 'stack-languages' },
    { n: '02', t: 'BACKEND & DB', note: 'server side', k: 'stack-backend' },
    { n: '03', t: 'FRONTEND', note: 'pixels & UI', k: 'stack-frontend' },
    { n: '04', t: 'TOOLS & PLATFORMS', note: 'daily drivers', k: 'stack-tools' },
  ];
  const ch = c => 78 + Math.ceil(ICONS[c.k].length / PER) * ROW + 6;
  const h1 = Math.max(ch(cards[0]), ch(cards[1])), h2 = Math.max(ch(cards[2]), ch(cards[3]));
  let s = keyboard(624, -16, -5, 8, 2);
  s += matTitle('TECH STACK', 40, 30) + sparkle(560, 44, 9, C.pink);
  const tints = [C.sky, C.cream, C.pinkLight, '#FFFFFF'];
  cards.forEach((c, i) => {
    const col = i % 2, row = i >> 1;
    const x = 34 + col * (cw + 30), y = top0 + (row ? h1 + gapY : 0), h = row ? h2 : h1;
    const d = tornPath(x, y, cw, h, 41 + i * 9, { b: 1 }, 6, 9);
    s += `<g transform="rotate(${[-1.6, 1.2, 1.4, -1.1][i]} ${x + cw / 2} ${y + h / 2})">${shadowed(d, C.paper)}${holes(x + 18, x + cw - 8, y + 12)}`;
    s += cardHead(x, y, cw, c.n, c.t, c.note);
    ICONS[c.k].forEach((it, j) => {
      const tx = x + 18 + (j % PER) * SLOT + (SLOT - 52) / 2, ty = y + 80 + Math.floor(j / PER) * ROW;
      s += `<rect x="${tx + 3}" y="${ty + 4}" width="52" height="52" rx="12" fill="${C.navy}"/><rect x="${tx}" y="${ty}" width="52" height="52" rx="12" fill="${tints[(j + i) % 4]}" stroke="${C.navy}" stroke-width="2.4"/>` + icon(it, tx + 13, ty + 13, 26, C.navy);
      const sp = it.name.lastIndexOf(' ');
      const lines = it.name.length > 10 && sp > 0 ? [it.name.slice(0, sp), it.name.slice(sp + 1)] : [it.name];
      lines.forEach((ln, li) => s += `<text x="${tx + 26}" y="${ty + 68 + li * 11}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="10" fill="${C.navy}"${ln.length > 10 ? ' textLength="60" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(ln)}</text>`);
    });
    s += `</g>` + binderClip(x + cw / 2 + (col ? 20 : -20), y - 14, [C.pink, C.yellow, C.yellow, C.pink][i], 0.9);
  });
  const h = top0 + h1 + gapY + h2 + 30;
  s += cursor(830, h - 80, 4);
  return { svg: s, h };
}

function stats(st) {
  let s = matTitle('GITHUB STATS', 40, 30) + tape(650, 34, 150, -3, C.pinkLight, 0.95) +
    `<text x="725" y="51" text-anchor="middle" font-family="${HAND}" font-weight="700" font-size="12.5" fill="${C.navy}" transform="rotate(-3 725 45)">auto-updated daily</text>` + sparkle(838, 44, 9, C.yellow);
  const card = (x, y, w, h, seed, rot, clip, num, title, note) => {
    const d = tornPath(x, y, w, h, seed, { b: 1 }, 6, 9);
    return { open: `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">${shadowed(d, C.paper)}${holes(x + 18, x + w - 8, y + 12)}${cardHead(x, y, w, num, title, note)}`, close: `</g>` + binderClip(x + w / 2, y - 14, clip, 0.9) };
  };
  // --- 05 by the numbers: sticky notes with pixel numbers
  const A = card(34, 96, 488, 262, 91, -1.2, C.yellow, '05', 'BY THE NUMBERS', 'public repos only');
  s += A.open;
  const notes = [['COMMITS', st.commits, C.cream], ['STARS', st.stars, C.pinkLight], ['REPOS', st.repos, C.sky], ['PULL REQUESTS', st.prs, C.sky], ['ISSUES', st.issues, C.cream], ['FOLLOWERS', st.followers, C.pinkLight]];
  notes.forEach(([label, val, bg], i) => {
    const nx = 52 + (i % 3) * 152, ny = 182 + Math.floor(i / 3) * 92, rot = [-2, 1.5, -1, 2, -1.5, 1][i];
    s += `<g transform="rotate(${rot} ${nx + 68} ${ny + 38})"><rect x="${nx + 3}" y="${ny + 4}" width="136" height="76" fill="${C.navy}" opacity="0.25"/><rect x="${nx}" y="${ny}" width="136" height="76" fill="${bg}" stroke="${C.navy}" stroke-width="2"/>`;
    s += tape(nx + 44, ny - 10, 48, [3, -4, 2, -3, 4, -2][i], i % 2 ? '#BFD0FF' : C.pinkLight, 0.9);
    const v = fmt(val);
    s += pixelText(v, nx + 14, ny + 18, 4.2, { fill: i % 2 ? C.pink : C.blue, edge: C.navy, rim: null, shadow: null, e: 1 });
    s += `<text x="${nx + 14}" y="${ny + 66}" font-family="${BOLD}" font-size="10.5" fill="${C.navy}" letter-spacing="1">${label}</text></g>`;
  });
  s += A.close;
  // --- 06 top languages: tape-measure bar + legend
  const B = card(548, 96, 318, 262, 97, 1.3, C.pink, '06', 'LANGUAGES', 'by code size');
  s += B.open;
  const lc = [C.blue, C.pink, C.yellow, '#7C9BFF', '#F59E4C', C.navy];
  const bx = 568, by = 196, bw = 278;
  s += `<rect x="${bx - 6}" y="${by - 22}" width="${bw + 12}" height="54" rx="10" fill="${C.yellow}" stroke="${C.navy}" stroke-width="2.5"/>`;
  for (let i = 0; i <= 27; i++) s += `<line x1="${bx + i * bw / 27}" y1="${by - 20}" x2="${bx + i * bw / 27}" y2="${by - (i % 5 ? 14 : 8)}" stroke="${C.navy}" stroke-width="1.6"/>`;
  s += `<defs><clipPath id="lb"><rect x="${bx}" y="${by}" width="${bw}" height="24" rx="6"/></clipPath></defs><g clip-path="url(#lb)">`;
  let cx = bx;
  st.languages.forEach((l, i) => { const w = bw * l.pct / 100; s += `<rect x="${f(cx)}" y="${by}" width="${f(w + 0.5)}" height="24" fill="${lc[i]}"/>`; cx += w; });
  s += `</g><rect x="${bx}" y="${by}" width="${bw}" height="24" rx="6" fill="none" stroke="${C.navy}" stroke-width="2.5"/>`;
  st.languages.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2), lx = 570 + col * 142, ly = 262 + row * 28;
    s += `<rect x="${lx}" y="${ly - 11}" width="13" height="13" rx="3" fill="${lc[i]}" stroke="${C.navy}" stroke-width="1.6"/>`;
    s += `<text x="${lx + 20}" y="${ly}" font-family="${SANS}" font-weight="700" font-size="12" fill="${C.navy}"${l.name.length > 11 ? ' textLength="72" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(l.name)}</text>`;
    s += `<text x="${lx + 128}" y="${ly}" text-anchor="end" font-family="${BOLD}" font-size="11" fill="${C.blue}">${l.pct.toFixed(1)}%</text>`;
  });
  s += B.close;
  // --- 07 contributions: streaks + heatmap
  const cy0 = 404;
  const K = card(34, cy0, 832, 252, 103, -0.6, C.yellow, '07', 'CONTRIBUTIONS', 'last 12 months');
  s += K.open;
  [['CURRENT STREAK', st.current, 'days', C.pink], ['LONGEST STREAK', st.longest, 'days', C.blue], ['THIS YEAR', st.contributions, 'contribs', C.blue]].forEach(([label, val, unit, col], i) => {
    const yy = cy0 + 94 + i * 52;
    s += `<text x="54" y="${yy}" font-family="${BOLD}" font-size="10" fill="${C.navy}" letter-spacing="1">${label}</text>`;
    const v = fmt(val);
    s += pixelText(v, 54, yy + 7, 3.2, { fill: col, edge: C.navy, rim: null, shadow: null, e: 0.8 });
    s += `<text x="${54 + pixelWidth(v, 3.2) + 8}" y="${yy + 28}" font-family="${HAND}" font-size="13" fill="${C.blue}">${unit}</text>`;
  });
  s += `<line x1="214" y1="${cy0 + 80}" x2="214" y2="${cy0 + 232}" stroke="${C.navy}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>`;
  const levels = ['#ECE6D6', '#BFD0FF', '#7C9BFF', C.blue, C.navy];
  const cell = 9, gap = 2, hx = 236, hy = cy0 + 112;
  const first = new Date(st.days[0][0] + 'T00:00:00Z').getUTCDay();
  let lastMonth = -1;
  st.days.forEach(([date, lvl], i) => {
    const idx = i + first, wk = Math.floor(idx / 7), dow = idx % 7;
    const x = hx + wk * (cell + gap), y = hy + dow * (cell + gap);
    s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${levels[lvl]}"${lvl ? '' : ` stroke="${C.gridLine}" stroke-width="0.8"`}/>`;
    const m = +date.slice(5, 7);
    if (dow === 0 && m !== lastMonth && wk < 51) { lastMonth = m; s += `<text x="${x}" y="${hy - 8}" font-family="${SANS}" font-weight="700" font-size="9.5" fill="${C.navy}">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}</text>`; }
  });
  ['Mon', 'Wed', 'Fri'].forEach((d, i) => s += `<text x="${hx - 6}" y="${hy + (1 + i * 2) * (cell + gap) + 8}" text-anchor="end" font-family="${SANS}" font-size="8.5" fill="${C.navy}" opacity="0.7">${d}</text>`);
  const ly = hy + 7 * (cell + gap) + 14;
  s += `<text x="${hx + 470}" y="${ly + 8}" text-anchor="end" font-family="${HAND}" font-size="11" fill="${C.navy}">less</text>`;
  levels.forEach((c, i) => s += `<rect x="${hx + 476 + i * 13}" y="${ly}" width="${cell}" height="${cell}" rx="2" fill="${c}" stroke="${C.navy}" stroke-width="0.6"/>`);
  s += `<text x="${hx + 545}" y="${ly + 8}" font-family="${HAND}" font-size="11" fill="${C.navy}">more</text>`;
  s += `<text x="${hx}" y="${ly + 8}" font-family="${SANS}" font-size="9" fill="${C.navy}" opacity="0.6">updated ${st.updated}</text>`;
  s += K.close;
  return { svg: s, h: cy0 + 290 };
}

function signoff(W) {
  let s = pencil(612, 182, -8, 160);
  const d = tornPath(40, 26, 560, 150, 77, { r: 1, b: 1 }, 6, 10);
  s += `<g transform="rotate(-1.2 320 100)">${shadowed(d, C.paper)}${holes(58, 590, 38, 26, 4.5)}`;
  s += pixelText("LET'S BUILD", 66, 62, 6);
  s += `<text x="68" y="146" font-family="${HAND}" font-weight="700" font-size="25" fill="${C.pink}">something awesome together!</text>`;
  s += `<path d="M70,156 q160,10 330,-4" fill="none" stroke="${C.pink}" stroke-width="3" stroke-linecap="round"/></g>`;
  s += binderClip(320, 12, C.yellow, 0.9);
  // sticker pointing at the clickable link tags under the image
  s += `<g transform="rotate(4 750 90)"><rect x="646" y="46" width="208" height="82" rx="16" fill="${C.navy}" transform="translate(5 6)"/><rect x="646" y="46" width="208" height="82" rx="16" fill="${C.yellow}" stroke="${C.navy}" stroke-width="3"/>
<text x="666" y="80" font-family="${BOLD}" font-size="15" fill="${C.navy}">Find me online</text><text x="666" y="108" font-family="${HAND}" font-weight="700" font-size="14" fill="${C.navy}">links just below</text>
<circle cx="826" cy="98" r="15" fill="${C.navy}"/><path d="M826,90 V106 M820,100 L826,106 L832,100" stroke="${C.yellow}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  s += sparkle(626, 40, 9, C.pink) + sparkle(870, 168, 7, C.white);
  const left = pill(24, 202, 'THANKS FOR VISITING', { h: 28, fs: 12, fill: C.white, stroke: C.navy, color: C.navy });
  const rights = ['HRITIK.SPACE', '@HRITIK4DEV', 'OPEN TO COLLABS'];
  s += `<rect x="0" y="192" width="${W}" height="48" fill="${C.navy}" opacity="0.55"/>${left.svg}${pillRow(W - 24 - pillRowWidth(rights, { fs: 11 }), 203, rights, { fs: 11 })}`;
  return { svg: s, h: 240 };
}

// ======================================================================
function buildProfile(st) {
  const W = 900;
  const parts = [hero(), about(), stack(), stats(st), signoff(W)];
  const gaps = [10, 0, 6, 0, 0];
  let y = 0, body = '';
  parts.forEach((p, i) => { body += `<g transform="translate(0 ${y})">${p.svg}</g>\n`; y += p.h + gaps[i]; });
  const H = y;
  // props that bridge section boundaries so the page reads as one desk
  const aboutTop = parts[0].h + gaps[0];
  body += pencil(46, aboutTop + 34, -36, 140);
  const statsTop = aboutTop + parts[1].h + gaps[1] + parts[2].h + gaps[2];
  body += triangleRuler(-46, statsTop - 112, 12, 0.8);
  body += scissors(876, statsTop + parts[3].h - 30, 200, 0.75);
  const label = `Hritik Sharma — full-stack developer from India. About me, tech stack (${['stack-languages', 'stack-frontend', 'stack-backend', 'stack-tools'].flatMap(k => ICONS[k].map(i => i.name)).join(', ')}) and GitHub stats: ${st.commits} commits, ${st.stars} stars, ${st.repos} public repos, ${st.current}-day current streak.`;
  return svgOpen(W, H, label) + mat(W, H, 'pm') + body + '</g>\n</svg>\n';
}

function link(name, label, w, iconSvg, tapeColor) {
  const d = tornPath(4, 10, w - 12, 40, w * 3 + label.length, { r: 1, l: 1 }, 4, 6);
  return svgOpen(w, 58, label) + `<path d="${d}" fill="${C.navy}" opacity="0.9" transform="translate(4 4)"/><path d="${d}" fill="${C.paper}" stroke="${C.navy}" stroke-width="2"/>` +
    tape(w / 2 - 22, 0, 44, -4, tapeColor, 0.95) + iconSvg +
    `<text x="46" y="37" font-family="${BOLD}" font-size="14" fill="${C.navy}" textLength="${w - 70}" lengthAdjust="spacingAndGlyphs">${esc(name)}</text></svg>\n`;
}

async function main() {
  let st;
  try {
    st = await fetchStats();
    fs.writeFileSync(STATS_CACHE, JSON.stringify(st) + '\n');
  } catch (e) {
    if (!fs.existsSync(STATS_CACHE)) throw e;
    console.warn(`Stats fetch failed (${e.message}); using cached ${path.relative(ROOT, STATS_CACHE)}`);
    st = JSON.parse(fs.readFileSync(STATS_CACHE, 'utf8'));
  }
  const ic = (k, color) => icon(ICONS[k][0], 18, 18, 20, color);
  const files = {
    'profile.svg': buildProfile(st),
    'link-website.svg': link('Website', 'Website', 150, `<g transform="translate(18 18)" fill="none" stroke="${C.blue}" stroke-width="2.2"><circle cx="10" cy="10" r="9"/><ellipse cx="10" cy="10" rx="4" ry="9"/><line x1="1" y1="10" x2="19" y2="10"/></g>`, C.pinkLight),
    'link-linkedin.svg': link('LinkedIn', 'LinkedIn', 156, `<rect x="18" y="18" width="20" height="20" rx="4" fill="${C.blue}"/><text x="28" y="33" text-anchor="middle" font-family="${BOLD}" font-size="13" fill="#FFFFFF">in</text>`, C.cream),
    'link-x.svg': link('@hritik4dev', '@hritik4dev', 180, ic('link-x', C.navy), '#BFD0FF'),
    'link-medium.svg': link('Medium', 'Medium', 142, ic('link-medium', C.navy), C.pinkLight),
    'link-email.svg': link('Email', 'Email', 130, ic('link-email', C.pink), C.cream),
  };
  for (const [n, c] of Object.entries(files)) fs.writeFileSync(path.join(ASSETS, n), c);
  console.log(`Wrote ${Object.keys(files).join(', ')} (commits ${st.commits}, streak ${st.current}, updated ${st.updated})`);
}
main().catch(e => { console.error(e); process.exit(1); });
