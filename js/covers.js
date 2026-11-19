// Generative book covers (inline SVG so they use the page's web fonts).
export const PALETTES = [
  ['#1F3D36', '#F3E9D2', '#E0A458'], ['#2B4C9B', '#F6EFE3', '#F2B544'], ['#C4552D', '#F7EDE2', '#2A1E1A'],
  ['#E9C9C0', '#2B2321', '#A23B2A'], ['#1E1E24', '#EDE6DA', '#FF5A36'], ['#D9C7A7', '#2A2622', '#7A4E2D'],
  ['#A9B8A0', '#1F2A22', '#F4EFE6'], ['#4B2E4F', '#F2E6EE', '#E8A87C'], ['#F2C14E', '#1E1B18', '#C4552D'], ['#0F4C5C', '#F1E8DA', '#E36414']
];
export const TEMPLATES = ['initial', 'arch', 'sun', 'stripes', 'rings', 'grid'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function autoCover(title) { const h = hash(title); return { tpl: TEMPLATES[h % TEMPLATES.length], pal: (h >>> 5) % PALETTES.length }; }

function wrap(text, max) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  if (lines.length > 4) { lines.length = 4; lines[3] = lines[3].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}

export function coverSVG(book) {
  const { tpl, pal } = book.cover || autoCover(book.title);
  const [bg, fg, ac] = PALETTES[Math.abs(pal | 0) % PALETTES.length];
  const title = book.title || 'Untitled', author = book.author || '';
  const len = title.length, fs = len < 10 ? 25 : len < 18 ? 21 : len < 30 ? 18 : 15;
  const lines = wrap(title, Math.round(150 / (fs * 0.52)));
  const id = 'c' + hash(book.id || title);
  let art = '', ty = 52, anchor = 'start', tx = 18, tcol = fg;
  switch (tpl) {
    case 'initial':
      art = `<text x="112" y="300" font-family="Playfair Display, serif" font-weight="800" font-size="290" fill="${ac}" opacity=".9">${esc([...title.replace(/^(the|a|an)\s+/i, '')][0] || 'M')}</text>`;
      break;
    case 'arch':
      art = `<path d="M40 300 V180 a60 60 0 0 1 120 0 V300 Z" fill="${ac}"/><path d="M62 300 V184 a38 38 0 0 1 76 0 V300 Z" fill="${bg}" opacity=".35"/>`;
      anchor = 'middle'; tx = 100; ty = 46;
      break;
    case 'sun':
      art = `<circle cx="100" cy="196" r="54" fill="${ac}"/>` + [0, 1, 2, 3, 4, 5].map(i => `<rect x="0" y="${214 + i * 14}" width="200" height="${3 + i * 1.6}" fill="${bg}"/>`).join('');
      anchor = 'middle'; tx = 100;
      break;
    case 'stripes':
      art = [0, 1, 2, 3, 4].map(i => `<rect x="${i * 44 - 10}" y="170" width="22" height="140" fill="${i % 2 ? fg : ac}" opacity="${i % 2 ? .18 : .95}" transform="skewX(-12)"/>`).join('');
      break;
    case 'rings':
      art = [70, 54, 38, 22].map((r, i) => `<circle cx="150" cy="232" r="${r}" fill="none" stroke="${i % 2 ? fg : ac}" stroke-width="${i % 2 ? 1.2 : 9}" opacity="${i % 2 ? .5 : .95}"/>`).join('');
      break;
    default:
      for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) art += `<circle cx="${22 + x * 26}" cy="${170 + y * 22}" r="${(x + y) % 3 === 0 ? 5.5 : 2.2}" fill="${(x * y) % 4 === 1 ? ac : fg}" opacity="${(x + y) % 3 === 0 ? .95 : .35}"/>`;
  }
  const tl = lines.map((l, i) => `<tspan x="${tx}" dy="${i ? fs * 1.08 : 0}">${esc(l)}</tspan>`).join('');
  return `<svg class="cover-svg" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(title)}">
<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".06" stop-color="#fff" stop-opacity=".12"/><stop offset=".11" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient></defs>
<rect width="200" height="300" fill="${bg}"/>${art}
<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-family="Playfair Display, serif" font-weight="700" font-size="${fs}" fill="${tcol}" letter-spacing="-.2">${tl}</text>
<text x="${tx}" y="${ty + lines.length * fs * 1.08 + 8}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-weight="600" font-size="8.5" letter-spacing="1.6" fill="${tcol}" opacity=".75">${esc(author.toUpperCase())}</text>
<rect width="200" height="300" fill="url(#${id}g)"/></svg>`;
}
