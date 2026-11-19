// Quote cards rendered to PNG with <canvas>.
export const CARD_THEMES = {
  paper: { bg: '#EFEDEA', fg: '#1B1A18', sub: '#6D6862', ac: '#FF5A36' },
  ink: { bg: '#17171B', fg: '#F1ECE4', sub: '#9C968E', ac: '#FF7A57' },
  ember: { bg: '#FF5A36', fg: '#1B1210', sub: '#4A1D12', ac: '#FFF4EC' }
};
let grain = null;
function grainPattern(ctx) {
  if (!grain) {
    const c = document.createElement('canvas'); c.width = c.height = 220; const g = c.getContext('2d'), d = g.createImageData(220, 220);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 16; }
    g.putImageData(d, 0, 0); grain = c;
  }
  return ctx.createPattern(grain, 'repeat');
}
function wrapLines(ctx, text, max) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
export async function renderCard(q, themeName = 'paper') {
  const th = CARD_THEMES[themeName] || CARD_THEMES.paper, W = 1080, H = 1350;
  try { await Promise.all(['400 60px Literata', 'italic 400 60px Literata', '700 40px "Playfair Display"', '600 26px Inter'].map(f => document.fonts.load(f, 'AaЯя'))); } catch {}
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, W, H);
  // soft vignette glow
  const rg = ctx.createRadialGradient(W * 0.85, H * 0.1, 10, W * 0.85, H * 0.1, W * 0.9);
  rg.addColorStop(0, themeName === 'ember' ? 'rgba(255,255,255,.18)' : 'rgba(255,90,54,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const M = 96;
  // wordmark
  ctx.fillStyle = th.fg; ctx.font = '600 26px Inter, sans-serif'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('MURMUR', M, 120);
  const mw = ctx.measureText('MURMUR').width;
  ctx.fillStyle = th.ac; ctx.beginPath(); ctx.arc(M + mw + 16, 111, 7, 0, Math.PI * 2); ctx.fill();
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // quote glyph
  ctx.fillStyle = th.ac; ctx.font = '700 300px "Playfair Display", serif'; ctx.fillText('“', M - 14, 420);
  // text
  const maxW = W - M * 2; let size = 64, lines, lh;
  for (; size >= 34; size -= 2) { ctx.font = `400 ${size}px Literata, Georgia, serif`; lines = wrapLines(ctx, q.text, maxW); lh = size * 1.42; if (lines.length * lh < 640) break; }
  ctx.fillStyle = th.fg; let y = 440 + size;
  for (const l of lines) { ctx.fillText(l, M, y); y += lh; }
  // footer
  const fy = H - 190;
  ctx.fillStyle = th.ac; ctx.fillRect(M, fy, 72, 5);
  ctx.fillStyle = th.fg; ctx.font = '700 40px "Playfair Display", serif';
  ctx.fillText(wrapLines(ctx, q.title || '', maxW)[0] || '', M, fy + 72);
  ctx.fillStyle = th.sub; ctx.font = '600 24px Inter, sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.fillText((q.author || '').toUpperCase(), M, fy + 118);
  return c;
}
export async function shareCard(q, themeName) {
  const c = await renderCard(q, themeName);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'murmur-quote.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: q.title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'murmur-quote.png'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'downloaded';
}
