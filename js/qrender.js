// Murmur quote studio: renderer. Draws a saved quote as a share-ready PNG in one of many styles.
// Everything is drawn on <canvas> in a 1080-wide coordinate space; `scale` makes small live thumbnails.
export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Caveat:wght@500;600&family=Bad+Script&family=PT+Mono&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Unbounded:wght@500;600;800&family=Prata&family=Spectral:ital,wght@0,400;1,300;1,400&display=swap&subset=cyrillic';

export const FORMATS = {
  story: { W: 1080, H: 1920, t: 250, b: 300, ru: 'История', en: 'Story', note: '9:16' },
  post: { W: 1080, H: 1350, t: 110, b: 100, ru: 'Пост', en: 'Post', note: '4:5' },
  square: { W: 1080, H: 1080, t: 90, b: 84, ru: 'Квадрат', en: 'Square', note: '1:1' }
};

/* ------------------------------ helpers ------------------------------ */
const PI2 = Math.PI * 2;
let FMT_K = 1;
function rngOf(seed) { let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function cleanText(s) {
  s = String(s || '').replace(/[\u00AD\u200B]/g, '').replace(/\s+/g, ' ').trim();
  for (const [a, b] of [['«', '»'], ['“', '”'], ['„', '“'], ['"', '"'], ['\'', '\'']]) {
    if (s.length > 2 && s.startsWith(a) && s.endsWith(b) && s.slice(1, -1).indexOf(a) < 0) { s = s.slice(1, -1).trim(); break; }
  }
  return s;
}
// Russian typography: short words stick to the next one, a dash never starts a line.
function glue(s) {
  for (let i = 0; i < 2; i++) s = s.replace(/(^| |\u00A0)([A-Za-zА-Яа-яЁё]{1,2}) /g, '$1$2\u00A0');
  return s.replace(/ ([—–]) /g, '\u00A0$1 ');
}
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const metricCache = new Map();
function metrics(ctx, font) {
  const key = font.replace(/\d+(\.\d+)?px/, '100px');
  if (metricCache.has(key)) return metricCache.get(key);
  const sv = ctx.font; ctx.font = key;
  const m1 = ctx.measureText('НИЖ'), m2 = ctx.measureText('руд');
  const asc = (m1.actualBoundingBoxAscent || 72) / 100, desc = (m2.actualBoundingBoxDescent || 22) / 100;
  ctx.font = sv; const v = { asc, desc }; if (document.fonts && document.fonts.check(key, 'Жж')) metricCache.set(key, v); return v;
}
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ').filter(Boolean); let cur = '';
    for (let w of words) {
      const tr = cur ? cur + ' ' + w : w;
      if (ctx.measureText(tr).width <= maxW || !cur) {
        if (!cur && ctx.measureText(w).width > maxW) { // a single over-long token: break it by characters
          let part = '';
          for (const ch of w) { if (ctx.measureText(part + ch + '-').width > maxW && part) { out.push(part + '-'); part = ch; } else part += ch; }
          cur = part;
        } else cur = tr;
      } else { out.push(cur); cur = w; if (ctx.measureText(w).width > maxW) { let part = ''; cur = ''; for (const ch of w) { if (ctx.measureText(part + ch + '-').width > maxW && part) { out.push(part + '-'); part = ch; } else part += ch; } cur = part; } }
    }
    if (cur) out.push(cur);
  }
  return out;
}
// Largest font size whose wrapped lines fit maxW x maxH; lines are balanced (same count, narrowest width).
function fit(ctx, text, o) {
  const { font, maxW, maxH, lh = 1.4, min = 30, balance = true, lhFn } = o; const n = text.length, boost = n < 24 ? 1.38 : n < 48 ? 1.2 : n < 80 ? 1.08 : 1, max = Math.round((o.max || 80) * FMT_K * boost);
  const lhOf = s => lhFn ? lhFn(s) : Math.round(s * lh);
  const test = s => { ctx.font = font(s); const m = metrics(ctx, ctx.font); const lines = wrap(ctx, text, maxW); const L = lhOf(s); const h = (lines.length - 1) * L + (m.asc + m.desc) * s; return { s, lines, lh: L, h, m }; };
  let lo = min, hi = max, best = null;
  const top = test(max); if (top.h <= maxH) best = top;
  else {
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); const r = test(mid); if (r.h <= maxH) { lo = mid; best = r; } else hi = mid; }
    if (!best) { best = test(min); if (best.h > maxH) { const n = Math.max(1, Math.floor((maxH - (best.m.asc + best.m.desc) * min) / best.lh) + 1); best.lines = best.lines.slice(0, n); ctx.font = font(min); let l = best.lines[n - 1].replace(/[\s,.;:—–-]+$/, ''); while (l && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); best.lines[n - 1] = l.replace(/\s+$/, '') + '…'; best.h = (n - 1) * best.lh + (best.m.asc + best.m.desc) * min; best.cut = true; } }
  }
  // a lone short word on its own line (e.g. "Всё" above the rest) looks broken: shrink a little until it joins
  const lonely = r => r.lines.some((l, i) => i < r.lines.length - 1 && !/ /.test(l) && [...l].length <= 6);
  if (!best.cut && lonely(best)) for (let s = best.s - 2, k = 0; s >= min && k < 14; s -= 2, k++) { const r = test(s); if (r.h <= maxH && !lonely(r)) { best = r; break; } }
  ctx.font = font(best.s);
  if (balance && best.lines.length > 1 && !best.cut) {
    const n = best.lines.length; let a = maxW * 0.55, b = maxW;
    for (let i = 0; i < 9; i++) { const mid = (a + b) / 2; if (wrap(ctx, text, mid).length <= n) b = mid; else a = mid; }
    const bl = wrap(ctx, text, b); if (bl.length === n) best.lines = bl;
  }
  best.font = ctx.font; best.w = Math.max(...best.lines.map(l => ctx.measureText(l).width));
  return best;
}
function drawLines(ctx, F, x, top, align = 'left', fill, perChar) {
  ctx.font = F.font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; if (fill) ctx.fillStyle = fill;
  let y = top + F.m.asc * F.s;
  for (const l of F.lines) { if (perChar) perChar(l, x, y); else ctx.fillText(l, x, y); y += F.lh; }
  ctx.textAlign = 'left';
}
// Exact ink box of a glyph, scanned from pixels (WebKit clamps actualBoundingBoxDescent at 0,
// which is wrong for quote marks that float above the baseline).
const inkCache = new Map();
function ink(font, glyph) {
  const k = font + '|' + glyph; if (inkCache.has(k)) return inkCache.get(k);
  const size = parseFloat((font.match(/(\d+(?:\.\d+)?)px/) || [0, 100])[1]), S = Math.ceil(size * 2.2), c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true }); g.font = font; g.textBaseline = 'alphabetic'; g.fillStyle = '#000'; const ox = Math.round(size * .5), base = Math.round(size * 1.5); g.fillText(glyph, ox, base);
  const d = g.getImageData(0, 0, S, S).data; let t = S, b = -1, l = S, r = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 40) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
  const m = g.measureText(glyph);
  const v = b < 0 ? { asc: m.actualBoundingBoxAscent || size * .7, h: size * .3, l: 0, w: m.width } : { asc: base - t, h: b - t + 1, l: l - ox, w: r - l + 1 };
  if (b >= 0 && (!document.fonts || document.fonts.check(font, glyph))) inkCache.set(k, v); c.width = c.height = 0; return v;
}
// Draw a glyph so its INK top sits at `top` and its ink left/centre/right at x; returns ink box.
function mark(ctx, glyph, font, x, top, align = 'left', fill) {
  ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; const k = ink(font, glyph);
  let ix = x; if (align === 'center') ix = x - k.w / 2; else if (align === 'right') ix = x - k.w;
  if (fill) ctx.fillStyle = fill; ctx.fillText(glyph, ix - k.l, top + k.asc);
  return { x: ix, y: top, w: k.w, h: k.h };
}
function markH(ctx, glyph, font) { return ink(font, glyph).h; }
function tracked(ctx, text, x, y, sp, align = 'left') {
  const ta = ctx.textAlign; ctx.textAlign = 'left'; const chars = [...text]; const w = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (chars.length - 1);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; }
  ctx.textAlign = ta; return w;
}
function trackedW(ctx, text, sp) { const chars = [...text]; return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (chars.length - 1); }
function ellipsize(ctx, s, maxW, sp = 0) { s = String(s || ''); const W = t => sp ? trackedW(ctx, t, sp) : ctx.measureText(t).width; if (W(s) <= maxW) return s; while (s && W(s + '…') > maxW) s = s.slice(0, -1); return s.replace(/[\s,.:;—-]+$/, '') + '…'; }
function qTitle(ctx, prefix, title, maxW) { return prefix + '«' + ellipsize(ctx, title, maxW - ctx.measureText(prefix + '«»').width) + '»'; }
function sig(ctx, x, y, align, color, dot, alpha = 0.6, size = 30) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `italic 500 ${size}px "Playfair Display", serif`; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText('murmur').width, dr = size * 0.13, tw = w + dr * 2 + size * 0.12;
  const sx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText('murmur', sx, y);
  ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(sx + w + size * 0.12 + dr, y - dr * 1.05, dr, 0, PI2); ctx.fill(); ctx.restore();
}
const noiseCache = {};
function noise(ctx, W, H, alpha, mode = 'source-over', mono = true) {
  const k = mono ? 'm' : 'c';
  if (!noiseCache[k]) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256), r = rngOf('grain' + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = v; d.data[i + 1] = mono ? v : r() * 255; d.data[i + 2] = mono ? v : r() * 255; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); noiseCache[k] = c; }
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode; ctx.fillStyle = ctx.createPattern(noiseCache[k], 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
}
function glow(ctx, x, y, r, color, W, H) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function vignette(ctx, W, H, a) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function linen(ctx, W, H, base, r) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 3) { ctx.strokeStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${(r() * 0.07).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
  for (let x = 0; x < W; x += 3) { ctx.strokeStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${(r() * 0.06).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
  ctx.restore(); noise(ctx, W, H, 0.05, 'overlay');
}
// Book line helper: title (+ author). Returns a measurer/drawer pair so layouts can reserve space first.
function bookParts(L) { const title = L.show ? (L.q.title || '').trim() : '', author = L.show ? (L.q.author || '').trim() : ''; return { title, author, any: !!(title || author) }; }

/* ------------------------------ presets ------------------------------ */
// Each preset: id, ru/en names, fonts to preload, palettes [{ru,en,sw:[...], ...colors}], draw(ctx, L).
// L = { W, H, t, b, fmt, q, text, show, pal, r }
export const PRESETS = [];
const P = p => PRESETS.push(p);

// stacked layout: [mark][text][footer] centred within the safe area, slightly above centre
function stack(top, bottom, parts, bias = 0.46) { const total = parts.reduce((a, p) => a + p, 0); return top + Math.max(0, (bottom - top - total) * bias); }

P({ id: 'murmur', ru: 'Мурмур', en: 'Murmur', fonts: ['400 60px Literata', '700 60px "Playfair Display"', '600 30px Inter', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Бумага', en: 'Paper', bg: '#EFEDEA', fg: '#1B1A18', sub: '#6D6862', ac: '#FF5A36', glow: 'rgba(255,90,54,.10)' },
    { ru: 'Чернила', en: 'Ink', bg: '#17171B', fg: '#F1ECE4', sub: '#9C968E', ac: '#FF7A57', glow: 'rgba(255,90,54,.12)' },
    { ru: 'Уголь', en: 'Ember', bg: '#FF5A36', fg: '#1B1210', sub: '#4A1D12', ac: '#FFF4EC', glow: 'rgba(255,255,255,.18)' }],
  draw(ctx, L) {
    const { W, H, pal: c } = L, M = 96;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); glow(ctx, W * .85, H * .08, W * .9, c.glow, W, H); noise(ctx, W, H, 0.06, 'overlay');
    const top = L.fmt === 'story' ? L.t : M + 10;
    // brand wordmark at top is the signature here
    ctx.fillStyle = c.fg; ctx.font = '600 26px Inter, sans-serif'; ctx.textBaseline = 'alphabetic'; const mw = tracked(ctx, 'MURMUR', M, top + 26, 6);
    ctx.fillStyle = c.ac; ctx.beginPath(); ctx.arc(M + mw + 16, top + 17, 7, 0, PI2); ctx.fill();
    const bk = bookParts(L), footH = bk.any ? 130 : 0, bottom = H - L.b;
    const mf = '700 240px "Playfair Display", serif', mh = markH(ctx, '“', mf), gap = 62;
    const maxH = bottom - footH - (footH ? 70 : 0) - (top + 110) - mh - gap;
    const F = fit(ctx, L.text, { font: s => `400 ${s}px Literata, Georgia, serif`, maxW: W - M * 2, maxH, lh: 1.4, min: 30, max: 92, balance: false });
    const y0 = stack(top + 110, bottom - footH - (footH ? 70 : 0), [mh, gap, F.h], 0.42);
    mark(ctx, '“', mf, M - 6, y0, 'left', c.ac);
    drawLines(ctx, F, M, y0 + mh + gap, 'left', c.fg);
    if (bk.any) {
      const fy = bottom - footH; ctx.fillStyle = c.ac; ctx.fillRect(M, fy, 72, 5);
      ctx.fillStyle = c.fg; ctx.font = '700 38px "Playfair Display", serif'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, W - M * 2), M, fy + 68);
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = '600 22px Inter, sans-serif'; tracked(ctx, ellipsize(ctx, bk.author.toUpperCase(), W - M * 2 - 80, 4), M, fy + 112, 4); }
    }
  } });

P({ id: 'editorial', ru: 'Редакция', en: 'Editorial', fonts: ['italic 500 60px "Cormorant Garamond"', '600 60px "Cormorant Garamond"', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Слоновая кость', en: 'Ivory', bg: '#F3EFE6', fg: '#1E1B16', sub: '#7A7266', ac: '#B4442B' },
    { ru: 'Графит', en: 'Graphite', bg: '#1C1C1E', fg: '#F2EDE4', sub: '#A39C92', ac: '#D9B26F' },
    { ru: 'Шалфей', en: 'Sage', bg: '#E1E5D8', fg: '#22281F', sub: '#5F6A58', ac: '#4F6B45' }],
  draw(ctx, L) {
    const { W, H, pal: c } = L, M = 120, cx = W / 2;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, 0.045, 'overlay');
    ctx.strokeStyle = c.sub; ctx.globalAlpha = .45; ctx.lineWidth = 1.5; ctx.strokeRect(44, 44, W - 88, H - 88); ctx.globalAlpha = 1;
    const bk = bookParts(L), mf = '600 230px "Cormorant Garamond", serif', mh = markH(ctx, '“', mf);
    const top = L.t + 10, bottom = H - L.b - 40, gapM = 50, gapO = 56, footH = bk.any ? 26 + 50 + (bk.title && bk.author ? 44 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `italic 500 ${s}px "Cormorant Garamond", Georgia, serif`, maxW: W - M * 2, maxH: bottom - top - mh - gapM - (footH ? gapO + footH : 0), lh: 1.24, min: 34, max: 108 });
    const y0 = stack(top, bottom, [mh, gapM, F.h, footH ? gapO + footH : 0]);
    mark(ctx, '“', mf, cx, y0, 'center', c.ac);
    drawLines(ctx, F, cx, y0 + mh + gapM, 'center', c.fg);
    if (bk.any) {
      let y = y0 + mh + gapM + F.h + gapO;
      ctx.fillStyle = c.ac; ctx.fillRect(cx - 70, y, 50, 1.5); ctx.fillRect(cx + 20, y, 50, 1.5); ctx.save(); ctx.translate(cx, y + .75); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
      y += 26 + 36; ctx.fillStyle = c.fg; ctx.font = 'italic 500 36px "Cormorant Garamond", serif'; ctx.textAlign = 'center'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, W - M * 2), cx, y);
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = '600 22px "Cormorant Garamond", serif'; tracked(ctx, ellipsize(ctx, bk.author.toUpperCase(), W - M * 2, 5), cx, y + 44, 5, 'center'); }
      ctx.textAlign = 'left';
    }
    sig(ctx, cx, L.fmt === 'story' ? H - 200 : H - 72, 'center', c.sub, c.ac, .75, 26);
  } });

P({ id: 'cinema', ru: 'Кино', en: 'Cinema', fonts: ['italic 400 60px "Playfair Display"', '600 22px Inter', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Янтарь', en: 'Amber', bg: '#0D0B09', fg: '#F1E9DC', sub: '#9C9184', ac: '#E8A55A', glow: 'rgba(232,150,70,.30)' },
    { ru: 'Полночь', en: 'Midnight', bg: '#060C11', fg: '#E6EEF2', sub: '#82939D', ac: '#72C6D3', glow: 'rgba(60,150,190,.30)' },
    { ru: 'Бордо', en: 'Bordeaux', bg: '#110607', fg: '#F4E6E3', sub: '#A2847F', ac: '#E5735F', glow: 'rgba(200,50,50,.30)' }],
  draw(ctx, L) {
    const { W, H, pal: c } = L, M = 110, cx = W / 2;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
    glow(ctx, cx, -H * .05, H * .85, c.glow, W, H); glow(ctx, W * .1, H * 1.02, H * .5, c.glow.replace(/[\d.]+\)$/, '.12)'), W, H);
    // giant faint quote glyph behind the text
    vignette(ctx, W, H, .55);
    const bk = bookParts(L), top = L.t + 20, bottom = H - L.b - 50, footH = bk.any ? 66 + 26 + (bk.title && bk.author ? 48 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `italic 400 ${s}px "Playfair Display", Georgia, serif`, maxW: W - M * 2, maxH: bottom - top - 60 - footH, lh: 1.34, min: 32, max: 94 });
    const y0 = stack(top, bottom, [2, 58, F.h, footH]);
    // giant faint quote glyph tucked behind the first lines
    ctx.save(); ctx.globalAlpha = .075; mark(ctx, '“', '700 760px "Playfair Display", serif', Math.max(-40, cx - F.w / 2 - 170), Math.max(-60, y0 - 120), 'left', c.fg); ctx.restore();
    noise(ctx, W, H, .11, 'screen');
    ctx.fillStyle = c.ac; ctx.fillRect(cx - 40, y0, 80, 2);
    drawLines(ctx, F, cx, y0 + 60, 'center', c.fg);
    if (bk.any) {
      let y = y0 + 60 + F.h + 66 + 24; ctx.textAlign = 'center';
      ctx.fillStyle = c.ac; ctx.font = '600 22px Inter, sans-serif'; tracked(ctx, ellipsize(ctx, (bk.title || bk.author).toUpperCase(), W - M * 2, 6), cx, y, 6, 'center');
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = 'italic 400 30px "Playfair Display", serif'; ctx.fillText(ellipsize(ctx, bk.author, W - M * 2), cx, y + 48); }
      ctx.textAlign = 'left';
    }
    sig(ctx, cx, L.fmt === 'story' ? H - 200 : H - 60, 'center', c.sub, c.ac, .7, 26);
  } });

P({ id: 'glass', ru: 'Стекло', en: 'Glass', fonts: ['600 60px Manrope', '700 30px Manrope', '500 22px Manrope', '700 200px "Playfair Display"', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Закат', en: 'Sunset', base: '#2A1240', blobs: ['#FF7A59', '#FF3D7F', '#7B3FE4', '#FFC46B'] },
    { ru: 'Океан', en: 'Ocean', base: '#06183A', blobs: ['#2BC0E4', '#1E5EFF', '#00C9A0', '#7A5CFF'] },
    { ru: 'Аврора', en: 'Aurora', base: '#0B0F2A', blobs: ['#56E3A0', '#5B3BFF', '#00A8F0', '#D65BFF'] }],
  sw: p => p.blobs,
  draw(ctx, L) {
    const { W, H, pal: c } = L, cx = W / 2;
    ctx.fillStyle = c.base; ctx.fillRect(0, 0, W, H);
    const pos = [[.05, .08, .95], [.98, .35, .85], [.1, .78, .9], [.85, .98, .8]];
    pos.forEach(([x, y, r], i) => { const g = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * r * .62); g.addColorStop(0, c.blobs[i]); g.addColorStop(1, c.blobs[i] + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
    noise(ctx, W, H, .06, 'overlay');
    const bk = bookParts(L), cardX = 80, cardW = W - 160, pad = 72, top = L.t, bottom = H - L.b - 70;
    const mf = '700 150px "Playfair Display", serif', mh = markH(ctx, '“', mf), footH = bk.any ? 40 + 2 + 30 + 36 + (bk.title && bk.author ? 38 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `600 ${s}px Manrope, sans-serif`, maxW: cardW - pad * 2, maxH: bottom - top - pad * 2 - mh - 34 - footH, lh: 1.34, min: 28, max: 80, balance: false });
    const cardH = pad * 2 + mh + 34 + F.h + footH, cy = stack(top, bottom, [cardH], .5);
    ctx.save(); ctx.shadowColor = 'rgba(10,0,30,.28)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30; rr(ctx, cardX, cy, cardW, cardH, 52); ctx.fillStyle = 'rgba(20,8,40,.22)'; ctx.fill(); ctx.restore();
    rr(ctx, cardX, cy, cardW, cardH, 52); const hg = ctx.createLinearGradient(0, cy, 0, cy + cardH); hg.addColorStop(0, 'rgba(255,255,255,.20)'); hg.addColorStop(.5, 'rgba(255,255,255,.04)'); hg.addColorStop(1, 'rgba(255,255,255,.10)'); ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke();
    const x = cardX + pad; let y = cy + pad;
    mark(ctx, '“', mf, x - 4, y, 'left', 'rgba(255,255,255,.95)'); y += mh + 34;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 12; drawLines(ctx, F, x, y, 'left', '#FFFFFF'); ctx.restore(); y += F.h;
    if (bk.any) {
      y += 40; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, cardW - pad * 2, 2); y += 2 + 30 + 28;
      ctx.fillStyle = '#fff'; ctx.font = '700 30px Manrope, sans-serif'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, cardW - pad * 2), x, y);
      if (bk.title && bk.author) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '500 24px Manrope, sans-serif'; ctx.fillText(ellipsize(ctx, bk.author, cardW - pad * 2), x, y + 40); }
    }
    sig(ctx, cx, Math.min(cy + cardH + 90, H - 60), 'center', '#FFFFFF', '#FFFFFF', .75, 28);
  } });

P({ id: 'card', ru: 'Карточка', en: 'Card', fonts: ['400 60px Lora', 'italic 400 30px Lora', '700 160px "Playfair Display"', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Лён', en: 'Linen', bg: '#D5C8B1', card: '#FFFDF7', fg: '#2A2622', sub: '#867C70', ac: '#C0533A', tape: 'rgba(246,236,205,.72)', on: '#5E5446' },
    { ru: 'Сланец', en: 'Slate', bg: '#5F6771', card: '#F8F6F1', fg: '#22252A', sub: '#7D828A', ac: '#3E6C8C', tape: 'rgba(235,238,240,.6)', on: '#E9ECEF' },
    { ru: 'Олива', en: 'Olive', bg: '#8D8A63', card: '#FCF9EF', fg: '#2B2A1E', sub: '#82806A', ac: '#8A5A2B', tape: 'rgba(250,240,210,.65)', on: '#F4F1E1' }],
  sw: p => [p.bg, p.card],
  draw(ctx, L) {
    const { W, H, pal: c } = L; linen(ctx, W, H, c.bg, L.r);
    const bk = bookParts(L), cardX = 96, cardW = W - 192, pad = 76, top = L.t, bottom = H - L.b - 70;
    const mf = '700 190px "Playfair Display", serif', mh = markH(ctx, '“', mf), footH = bk.any ? 52 + 36 + (bk.title && bk.author ? 4 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `400 ${s}px Lora, Georgia, serif`, maxW: cardW - pad * 2, maxH: bottom - top - pad * 2 - mh - 46 - footH, lh: 1.42, min: 28, max: 72, balance: false });
    const cardH = Math.max(pad * 2 + mh + 46 + F.h + footH, L.fmt === 'story' ? 640 : 0), cy = stack(top, bottom, [cardH], .5);
    ctx.save(); ctx.translate(W / 2, cy + cardH / 2); ctx.rotate(-0.018); ctx.translate(-W / 2, -(cy + cardH / 2));
    ctx.save(); ctx.shadowColor = 'rgba(30,20,10,.32)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22; ctx.fillStyle = c.card; ctx.fillRect(cardX, cy, cardW, cardH); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(cardX, cy, cardW, cardH); ctx.clip(); noise(ctx, W, H, .035, 'multiply'); ctx.restore();
    const inner = (cardH - (pad * 2 + mh + 46 + F.h + footH)) / 2; const x = cardX + pad; let y = cy + pad + inner;
    mark(ctx, '“', mf, x - 4, y, 'left', c.ac); y += mh + 46; drawLines(ctx, F, x, y, 'left', c.fg); y += F.h;
    if (bk.any) { y += 52 + 26; ctx.fillStyle = c.sub; ctx.font = 'italic 400 30px Lora, serif'; const s = bk.title && bk.author ? qTitle(ctx, `— ${bk.author}, `, bk.title, cardW - pad * 2) : ellipsize(ctx, `— ${bk.title || bk.author}`, cardW - pad * 2); ctx.fillText(s, x, y); }
    // washi tape on the top corners
    const tape = (tx, ty, a) => { ctx.save(); ctx.translate(tx, ty); ctx.rotate(a); ctx.fillStyle = c.tape; ctx.beginPath(); ctx.moveTo(-95, -24); for (let i = -95; i <= 95; i += 19) ctx.lineTo(i, -24 + (i / 19 % 2 ? 3 : 0)); ctx.lineTo(95, 24); for (let i = 95; i >= -95; i -= 19) ctx.lineTo(i, 24 - (i / 19 % 2 ? 3 : 0)); ctx.closePath(); ctx.fill(); ctx.restore(); };
    tape(cardX + 40, cy + 8, -0.72); tape(cardX + cardW - 40, cy + 8, 0.72);
    ctx.restore();
    sig(ctx, W / 2, Math.min(cy + cardH + 96, H - 56), 'center', c.on, c.ac, .8, 28);
  } });

// ruled notebook, handwritten in ink
P({ id: 'notebook', ru: 'Тетрадь', en: 'Notebook', fonts: ['500 60px Caveat', '600 160px Caveat', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Синие чернила', en: 'Blue ink', paper: '#FBFAF4', line: 'rgba(70,125,200,.32)', margin: 'rgba(225,70,70,.55)', ink: '#1D3C92' },
    { ru: 'Чёрные чернила', en: 'Black ink', paper: '#F8F6EF', line: 'rgba(110,115,135,.30)', margin: 'rgba(210,80,80,.5)', ink: '#1E1E24' },
    { ru: 'Фиолетовые', en: 'Violet ink', paper: '#FBF9F6', line: 'rgba(120,110,200,.28)', margin: 'rgba(225,80,120,.5)', ink: '#4A2A92' }],
  sw: p => [p.paper, p.ink],
  draw(ctx, L) {
    const { W, H, pal: c } = L, mx = 168, x = mx + 40, maxW = W - x - 70, top = L.t + 20, bottom = H - L.b - 60;
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, .04, 'multiply');
    const bk = bookParts(L), tail = bk.any ? (bk.title && bk.author ? 2 : 1) : 0;
    // font size fixes the ruling: lines are the row pitch
    const pitch = s => Math.round(s * 1.12);
    const F = fit(ctx, L.text, { font: s => `500 ${s}px Caveat, cursive`, maxW, maxH: bottom - top - 0, lhFn: pitch, min: 40, max: 112, balance: false });
    const P_ = F.lh, rowsText = F.lines.length, rows = 1 + rowsText + (tail ? tail + 1 : 0);
    const avail = Math.floor((bottom - top) / P_);
    let fitLines = F; if (rows > avail) { /* shrink until the whole block (incl. mark row and signature) fits the ruling */
      for (let s = F.s - 1; s >= 34; s--) { const G = fit(ctx, L.text, { font: z => `500 ${z}px Caveat, cursive`, maxW, maxH: 99999, lhFn: pitch, min: s, max: s, balance: false }); const r = 1 + G.lines.length + (tail ? tail + 1 : 0); if (r <= Math.floor((bottom - top) / G.lh) || s === 34) { fitLines = G; if (r > Math.floor((bottom - top) / G.lh)) { const n = Math.floor((bottom - top) / G.lh) - 1 - (tail ? tail + 1 : 0); G.lines = G.lines.slice(0, Math.max(1, n)); G.lines[G.lines.length - 1] = G.lines[G.lines.length - 1].replace(/[\s,.;:—-]+$/, '') + '…'; } break; } }
    }
    const G = fitLines, p = G.lh, nRows = 1 + G.lines.length + (tail ? tail + 1 : 0);
    // ruling anchored so the text block sits centred on whole rows
    const firstBase = Math.round(stack(top, bottom, [nRows * p], .45) / p) * p + p;
    const off = firstBase % p;
    ctx.strokeStyle = c.line; ctx.lineWidth = 2; for (let y = off + p * 2; y < H - 30; y += p) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = c.margin; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
    // punched holes
    for (let hy = H * .12; hy < H * .95; hy += H * .19) { const g = ctx.createRadialGradient(64, hy - 3, 4, 64, hy, 24); g.addColorStop(0, '#D9D5CB'); g.addColorStop(.8, '#E7E3DA'); g.addColorStop(1, 'rgba(0,0,0,.18)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, hy, 22, 0, PI2); ctx.fill(); }
    const r = L.r, base = (i) => firstBase + i * p - 5;
    ctx.save(); ctx.fillStyle = c.ink; ctx.globalAlpha = .93;
    // big handwritten opening quote on the first row
    { const mf = `600 ${Math.round(G.s * 2.2)}px Caveat, cursive`; mark(ctx, '«', mf, x - 4, base(0) - 6 - markH(ctx, '«', mf), 'left'); ctx.font = `500 ${G.s}px Caveat, cursive`; }
    ctx.font = `500 ${G.s}px Caveat, cursive`;
    G.lines.forEach((l, i) => { ctx.save(); ctx.translate(x + (r() - .5) * 3, base(i + 1)); ctx.rotate((r() - .5) * 0.006); ctx.fillText(i === G.lines.length - 1 ? l + '»' : l, 0, 0); ctx.restore(); });
    if (tail) {
      ctx.font = `500 ${Math.round(Math.min(G.s * .78, 60))}px Caveat, cursive`; ctx.textAlign = 'right'; ctx.globalAlpha = .82;
      const i0 = G.lines.length + 2;
      if (bk.title && bk.author) { ctx.fillText(ellipsize(ctx, '— ' + bk.author, maxW), W - 70, base(i0)); ctx.fillText('«' + ellipsize(ctx, bk.title, maxW - ctx.measureText('«»').width) + '»', W - 70, base(i0 + 1)); }
      else ctx.fillText(ellipsize(ctx, '— ' + (bk.title || bk.author), maxW), W - 70, base(i0));
      ctx.textAlign = 'left';
    }
    ctx.restore();
    sig(ctx, W - 70, H - (L.fmt === 'story' ? 200 : 46), 'right', '#6F7286', '#E05040', .7, 26);
  } });

// squared maths notebook with a marker highlight and spiral
P({ id: 'grid', ru: 'Клетка', en: 'Grid', fonts: ['400 60px "Bad Script"', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Классика', en: 'Classic', paper: '#FCFCF8', grid: 'rgba(70,120,190,.26)', ink: '#23328F', hl: 'rgba(255,226,70,.62)' },
    { ru: 'Крафт', en: 'Kraft', paper: '#E2D0AF', grid: 'rgba(110,75,40,.22)', ink: '#33231A', hl: 'rgba(255,255,255,.45)' },
    { ru: 'Мята', en: 'Mint', paper: '#F0F6F1', grid: 'rgba(40,140,110,.24)', ink: '#18493D', hl: 'rgba(255,170,140,.55)' }],
  sw: p => [p.paper, p.ink],
  draw(ctx, L) {
    const { W, H, pal: c } = L, cell = 40;
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, .045, 'multiply');
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1.5;
    const ox = (W % cell) / 2; for (let x = ox; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // spiral binding along the top
    const sy = L.fmt === 'story' ? 64 : 40;
    for (let x = 60; x < W - 40; x += 52) { ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.arc(x, sy + 30, 9, 0, PI2); ctx.fill(); ctx.strokeStyle = '#8D9099'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 5, sy + 30); ctx.quadraticCurveTo(x - 14, sy - 6, x + 6, sy - 26); ctx.stroke(); ctx.strokeStyle = '#C9CCD3'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.lineCap = 'butt';
    const bk = bookParts(L), x = ox + cell * 3, maxW = W - x - cell * 2.5, top = L.t + 30, bottom = H - L.b - 60;
    const tail = bk.any ? 2 * cell + (bk.title && bk.author ? 2 : 1) * cell * 1.25 : 0, mf = '400 200px "Bad Script", cursive', mh = markH(ctx, '“', mf);
    const F = fit(ctx, L.text, { font: s => `400 ${s}px "Bad Script", cursive`, maxW, maxH: bottom - top - mh - cell - tail, lhFn: s => Math.max(2, Math.ceil(s * 1.45 / (cell / 2))) * (cell / 2), min: 30, max: 90, balance: false });
    let y0 = Math.round(stack(top, bottom, [mh + cell * .5, F.h, tail], .45) / cell) * cell;
    ctx.fillStyle = c.ink; mark(ctx, '“', mf, x - 10, y0, 'left', c.ink); y0 += mh + cell * .25;
    // baselines sit on grid lines (or exact half cells for small sizes)
    const b0 = Math.ceil((y0 + F.m.asc * F.s) / cell) * cell - 5; ctx.font = F.font; ctx.strokeStyle = c.ink; ctx.lineWidth = Math.max(.6, F.s * .018); ctx.lineJoin = 'round';
    F.lines.forEach((l, i) => { ctx.fillText(l, x, b0 + i * F.lh); ctx.strokeText(l, x, b0 + i * F.lh); });
    if (bk.any) {
      let by = b0 + (F.lines.length - 1) * F.lh + cell * 2; ctx.font = '400 32px "Bad Script", cursive';
      const t1 = ellipsize(ctx, bk.title || bk.author, maxW), w1 = ctx.measureText(t1).width;
      ctx.fillStyle = c.hl; ctx.save(); ctx.translate(x - 12, by - 26); ctx.rotate(-0.012); rr(ctx, 0, 0, w1 + 24, 36, 6); ctx.fill(); ctx.restore();
      ctx.fillStyle = c.ink; ctx.fillText(t1, x, by);
      if (bk.title && bk.author) { ctx.globalAlpha = .75; ctx.fillText(ellipsize(ctx, bk.author, maxW), x, by + cell * 1.5); ctx.globalAlpha = 1; }
    }
    sig(ctx, W - cell * 2, H - (L.fmt === 'story' ? 200 : 44), 'right', c.ink, '#E05040', .55, 26);
  } });

// typewriter on paper with uneven ink
P({ id: 'typewriter', ru: 'Машинка', en: 'Typewriter', fonts: ['400 60px "PT Mono"', '700 60px "PT Mono"', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Крем', en: 'Cream', paper: '#F2EADB', ink: '#29241F', ac: '#B33A2E', on: '#8A7E6E' },
    { ru: 'Серый', en: 'Grey', paper: '#E5E3DE', ink: '#1C1C1C', ac: '#2E5A87', on: '#7E7B75' },
    { ru: 'Копирка', en: 'Carbon', paper: '#18284A', ink: '#E8EDF6', ac: '#F2C14E', on: '#8FA0C0' }],
  sw: p => [p.paper, p.ink],
  draw(ctx, L) {
    const { W, H, pal: c } = L, M = 110, r = L.r;
    ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
    glow(ctx, W * .3, H * .3, H * .7, 'rgba(255,255,255,.10)', W, H); vignette(ctx, W, H, .14); noise(ctx, W, H, .07, 'overlay');
    // paper fibres
    ctx.save(); ctx.strokeStyle = c.on; ctx.globalAlpha = .08; ctx.lineWidth = 1; for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, a = r() * PI2, l = 10 + r() * 26; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * .5 + 4, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); } ctx.restore();
    const bk = bookParts(L), top = L.t + 10, bottom = H - L.b - 60, mf = '700 190px "PT Mono", monospace', mh = markH(ctx, '"', mf);
    const footH = bk.any ? 70 + (bk.title && bk.author ? 2 : 1) * 46 : 0;
    const F = fit(ctx, L.text, { font: s => `400 ${s}px "PT Mono", monospace`, maxW: W - M * 2, maxH: bottom - top - mh - 40 - footH, lh: 1.55, min: 26, max: 70, balance: false });
    let y = stack(top, bottom, [mh, 40, F.h, footH]);
    const typeChar = (l, x0, yb) => { let x = x0; for (const ch of l) { ctx.globalAlpha = .72 + r() * .28; ctx.fillText(ch, x + (r() - .5) * 1.4, yb + (r() - .5) * 1.6); if (r() < .05) { ctx.globalAlpha = .16; ctx.fillText(ch, x + 1.2, yb + .8); } x += ctx.measureText(ch).width; } ctx.globalAlpha = 1; };
    ctx.save(); ctx.globalAlpha = .9; mark(ctx, '"', mf, M - 6, y, 'left', c.ac); ctx.restore(); y += mh + 40;
    drawLines(ctx, F, M, y, 'left', c.ink, typeChar); y += F.h;
    if (bk.any) {
      y += 70; ctx.font = '400 30px "PT Mono", monospace'; ctx.fillStyle = c.ink;
      const l1 = ellipsize(ctx, (bk.title && bk.author ? '— ' + bk.author : '— ' + (bk.title || bk.author)), W - M * 2); typeChar(l1, M, y);
      if (bk.title && bk.author) { ctx.fillStyle = c.ac; typeChar(qTitle(ctx, '', bk.title, W - M * 2 - 54), M + 54, y + 46); }
    }
    sig(ctx, W - M, H - (L.fmt === 'story' ? 200 : 56), 'right', c.on, c.ac, .8, 26);
  } });

P({ id: 'magazine', ru: 'Журнал', en: 'Magazine', fonts: ['700 60px "Playfair Display"', 'italic 400 30px "Playfair Display"', '700 22px Inter', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Красный', en: 'Red', bg: '#F5F2EC', fg: '#121212', sub: '#6B6760', ac: '#E63B2E', on: '#FFFFFF' },
    { ru: 'Жёлтый', en: 'Yellow', bg: '#FBFAF6', fg: '#111111', sub: '#6A675F', ac: '#F4C20D', on: '#111111' },
    { ru: 'Кобальт', en: 'Cobalt', bg: '#EFF0EC', fg: '#0F1A3D', sub: '#5D6478', ac: '#2549D8', on: '#FFFFFF' }],
  draw(ctx, L) {
    const { W, H, pal: c } = L, M = 90;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, .04, 'overlay');
    const top = L.t, bottom = H - L.b;
    ctx.fillStyle = c.fg; ctx.fillRect(M, top, W - M * 2, 10);
    ctx.font = '700 22px Inter, sans-serif'; tracked(ctx, L.ru ? 'ЦИТАТА' : 'QUOTE', M, top + 56, 7); ctx.textAlign = 'right'; ctx.fillStyle = c.sub; ctx.font = '600 22px Inter, sans-serif'; tracked(ctx, 'MURMUR', W - M, top + 56, 7, 'right'); ctx.textAlign = 'left';
    const bk = bookParts(L), box = 170, footH = bk.any ? 36 + 3 + 50 + (bk.title && bk.author ? 40 : 0) : 0;
    const textTop = top + 110 + box + 46;
    const F = fit(ctx, L.text, { font: s => `700 ${s}px "Playfair Display", Georgia, serif`, maxW: W - M * 2, maxH: bottom - footH - 40 - textTop, lh: 1.16, min: 32, max: 112, balance: false });
    const y0 = stack(top + 110, bottom - footH - 40, [box, 46, F.h], .4);
    ctx.fillStyle = c.ac; ctx.fillRect(M, y0, box, box);
    { const mf = '700 250px "Playfair Display", serif', h = markH(ctx, '“', mf); mark(ctx, '“', mf, M + box / 2, y0 + box * .5 - h * .5, 'center', c.on); }
    drawLines(ctx, F, M - 2, y0 + box + 46, 'left', c.fg);
    if (bk.any) {
      const fy = bottom - footH; ctx.fillStyle = c.fg; ctx.fillRect(M, fy, W - M * 2, 3);
      ctx.font = 'italic 400 34px "Playfair Display", serif'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, W - M * 2), M, fy + 3 + 50);
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = '700 20px Inter, sans-serif'; tracked(ctx, ellipsize(ctx, bk.author.toUpperCase(), W - M * 2, 5), M, fy + 53 + 40, 5); }
    }
  } });

// botanical line art
function branch(ctx, x, y, ang, len, r, depth, lw) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, bend = (r() - .5) * len * .35;
  const mx = (x + ex) / 2 + Math.cos(ang + Math.PI / 2) * bend, my = (y + ey) / 2 + Math.sin(ang + Math.PI / 2) * bend;
  ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
  const n = Math.round(len / 46);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex, py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ey;
    for (const side of [-1, 1]) { const a = ang + side * (0.75 + r() * .3), ll = 26 + r() * 22 * (1 - t * .4); leaf(ctx, px, py, a, ll); }
  }
  leaf(ctx, ex, ey, ang, 34);
  if (depth > 0) for (const s of [-1, 1]) if (r() < .8) branch(ctx, (x + ex) / 2, (y + ey) / 2, ang + s * (0.55 + r() * .3), len * .55, r, depth - 1, lw * .8);
}
function leaf(ctx, x, y, a, l) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(l * .5, -l * .32, l, 0); ctx.quadraticCurveTo(l * .5, l * .32, 0, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l * .1, 0); ctx.lineTo(l * .8, 0); ctx.lineWidth *= .6; ctx.stroke(); ctx.restore();
}
P({ id: 'botanical', ru: 'Ботаника', en: 'Botanical', fonts: ['italic 400 60px "EB Garamond"', '500 30px "EB Garamond"', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Шалфей', en: 'Sage', bg: '#DCE2D1', fg: '#253021', sub: '#5C6955', line: '#4E6346' },
    { ru: 'Пудра', en: 'Blush', bg: '#F1DFD7', fg: '#3A2522', sub: '#8A665E', line: '#A8665A' },
    { ru: 'Лес', en: 'Forest', bg: '#15231B', fg: '#E9EFE2', sub: '#98AA91', line: '#A9C79A' }],
  draw(ctx, L) {
    const { W, H, pal: c } = L, cx = W / 2, M = 130;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, .05, 'overlay');
    const r = rngOf('leaf' + L.fmt + (L.q.id || '')); ctx.save(); ctx.strokeStyle = c.line; ctx.globalAlpha = .34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // sprigs grow in from the corners only
    branch(ctx, -30, -30, .62 + r() * .12, H > 1500 ? 470 : 380, r, 2, 2.6);
    branch(ctx, W + 30, H + 30, Math.PI + .62 + r() * .12, H > 1500 ? 470 : 380, r, 2, 2.6);
    branch(ctx, W + 20, -20, Math.PI - .9, 210, r, 1, 2.2);
    branch(ctx, -20, H + 20, -.9, 210, r, 1, 2.2);
    ctx.restore();
    const bk = bookParts(L), mf = '500 200px "EB Garamond", serif', mh = markH(ctx, '“', mf), top = L.t + 30, bottom = H - L.b - 50;
    const footH = bk.any ? 40 + 30 + 40 + (bk.title && bk.author ? 40 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `italic 400 ${s}px "EB Garamond", Georgia, serif`, maxW: W - M * 2, maxH: bottom - top - mh - 44 - footH, lh: 1.28, min: 34, max: 102 });
    let y = stack(top, bottom, [mh, 44, F.h, footH]);
    { // soft clearing so the leaves never fight the text
      const bh = mh + 44 + F.h + footH, cy = y + bh / 2, rx = W * .62, ry = bh * .5 + 150;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); const g = ctx.createRadialGradient(0, 0, rx * .55, 0, 0, rx); g.addColorStop(0, c.bg); g.addColorStop(1, c.bg + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, PI2); ctx.fill(); ctx.restore();
    }
    mark(ctx, '“', mf, cx, y, 'center', c.line); y += mh + 44;
    drawLines(ctx, F, cx, y, 'center', c.fg); y += F.h;
    if (bk.any) {
      y += 40; ctx.save(); ctx.strokeStyle = c.line; ctx.lineWidth = 1.6; ctx.globalAlpha = .8; ctx.beginPath(); ctx.moveTo(cx - 70, y + 14); ctx.lineTo(cx + 70, y + 14); ctx.stroke(); leaf(ctx, cx, y + 14, -Math.PI / 2, 26); leaf(ctx, cx - 4, y + 14, -Math.PI / 2 - .9, 20); leaf(ctx, cx + 4, y + 14, -Math.PI / 2 + .9, 20); ctx.restore();
      y += 30 + 40; ctx.textAlign = 'center'; ctx.fillStyle = c.fg; ctx.font = '500 32px "EB Garamond", serif'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, W - M * 2), cx, y);
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = 'italic 400 28px "EB Garamond", serif'; ctx.fillText(ellipsize(ctx, bk.author, W - M * 2), cx, y + 40); }
      ctx.textAlign = 'left';
    }
    sig(ctx, cx, L.fmt === 'story' ? H - 200 : H - 56, 'center', c.sub, c.line, .75, 26);
  } });

P({ id: 'block', ru: 'Блок', en: 'Block', fonts: ['600 60px Unbounded', '800 300px Unbounded', '500 24px Unbounded', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Огонь', en: 'Fire', bg: '#FF5A36', fg: '#170C08', sub: 'rgba(23,12,8,.68)' },
    { ru: 'Лайм', en: 'Lime', bg: '#D6F65A', fg: '#121410', sub: 'rgba(18,20,16,.66)' },
    { ru: 'Электрик', en: 'Electric', bg: '#2B45FF', fg: '#FFFFFF', sub: 'rgba(255,255,255,.75)' },
    { ru: 'Роза', en: 'Rose', bg: '#FFB6C8', fg: '#2A0F1A', sub: 'rgba(42,15,26,.68)' }],
  sw: p => [p.bg, p.fg],
  draw(ctx, L) {
    const { W, H, pal: c } = L, M = 90;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, .05, 'overlay');
    // oversized closing mark bleeding off the bottom-right corner
    ctx.save(); ctx.globalAlpha = .08; mark(ctx, '»', '800 760px Unbounded, sans-serif', W + 150, L.fmt === 'story' ? L.t + 40 : 40, 'right', c.fg); ctx.restore();
    const bk = bookParts(L), top = L.t, bottom = H - L.b, mf = '800 230px Unbounded, sans-serif', mh = markH(ctx, '«', mf), footH = bk.any ? 74 + (bk.title && bk.author ? 44 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `600 ${s}px Unbounded, sans-serif`, maxW: W - M * 2, maxH: bottom - top - mh - 44 - footH - 60, lh: 1.22, min: 26, max: 86, balance: false });
    let y = stack(top, bottom - footH - 60, [mh, 44, F.h], .42);
    mark(ctx, '«', mf, M - 8, y, 'left', c.fg); y += mh + 44; drawLines(ctx, F, M, y, 'left', c.fg);
    if (bk.any) {
      const fy = bottom - footH; ctx.font = '500 24px Unbounded, sans-serif'; const t1 = ellipsize(ctx, bk.title || bk.author, W - M * 2 - 60), w = ctx.measureText(t1).width + 56;
      rr(ctx, M, fy, w, 58, 29); ctx.lineWidth = 2.5; ctx.strokeStyle = c.fg; ctx.stroke(); ctx.fillStyle = c.fg; ctx.fillText(t1, M + 28, fy + 38);
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = '500 22px Unbounded, sans-serif'; ctx.fillText(ellipsize(ctx, bk.author, W - M * 2), M + 4, fy + 58 + 46); }
    }
    sig(ctx, W - M, L.fmt === 'story' ? H - 200 : H - 52, 'right', c.fg, c.fg, .7, 28);
  } });

// art-deco frame
P({ id: 'deco', ru: 'Рамка', en: 'Deco', fonts: ['400 60px Prata', 'italic 500 30px "Playfair Display"', '600 22px Inter'],
  palettes: [
    { ru: 'Изумруд', en: 'Emerald', bg: '#0F3A2D', fg: '#F3E9D2', sub: '#B9B09A', gold: '#D4AF6A' },
    { ru: 'Сапфир', en: 'Sapphire', bg: '#121A35', fg: '#F1EBDD', sub: '#ABA89F', gold: '#D8B76E' },
    { ru: 'Оникс', en: 'Onyx', bg: '#121212', fg: '#EDEDED', sub: '#A3A3A3', gold: '#C8CBD2' }],
  sw: p => [p.bg, p.gold],
  draw(ctx, L) {
    const { W, H, pal: c } = L, cx = W / 2, M = 140;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); glow(ctx, cx, H * .45, H * .6, 'rgba(255,255,255,.06)', W, H); noise(ctx, W, H, .05, 'overlay');
    const fi = L.fmt === 'story' ? 64 : 44, fi2 = fi + 18;
    ctx.strokeStyle = c.gold; ctx.lineWidth = 3; ctx.strokeRect(fi, fi, W - fi * 2, H - fi * 2); ctx.lineWidth = 1.2; ctx.strokeRect(fi2, fi2, W - fi2 * 2, H - fi2 * 2);
    // corner fans
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ox = sx > 0 ? fi2 : W - fi2, oy = sy > 0 ? fi2 : H - fi2; ctx.save(); ctx.translate(ox, oy); ctx.scale(sx, sy);
      ctx.lineWidth = 1.4; for (const rad of [34, 54, 74]) { ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI / 2); ctx.stroke(); }
      for (let i = 1; i < 6; i++) { const a = i * Math.PI / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.lineTo(Math.cos(a) * 74, Math.sin(a) * 74); ctx.stroke(); }
      ctx.fillStyle = c.gold; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 18, 0, Math.PI / 2); ctx.fill(); ctx.restore();
    }
    const diamond = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); };
    const bk = bookParts(L), mf = '400 170px Prata, serif', mh = markH(ctx, '“', mf), top = L.t + 20, bottom = H - L.b - 60;
    const footH = bk.any ? 50 + 20 + 40 + (bk.title && bk.author ? 42 : 0) : 0;
    const F = fit(ctx, L.text, { font: s => `400 ${s}px Prata, Georgia, serif`, maxW: W - M * 2, maxH: bottom - top - mh - 36 - footH, lh: 1.4, min: 30, max: 78 });
    let y = stack(top, bottom, [mh, 36, F.h, footH]);
    ctx.fillStyle = c.gold; ctx.fillRect(cx - 200, y + mh / 2, 110, 1.4); ctx.fillRect(cx + 90, y + mh / 2, 110, 1.4); diamond(cx - 206, y + mh / 2 + .7, 6); diamond(cx + 206, y + mh / 2 + .7, 6);
    mark(ctx, '“', mf, cx, y, 'center', c.gold); y += mh + 36;
    drawLines(ctx, F, cx, y, 'center', c.fg); y += F.h;
    if (bk.any) {
      y += 50; ctx.fillStyle = c.gold; diamond(cx, y + 10, 8); ctx.fillRect(cx - 60, y + 9.3, 40, 1.4); ctx.fillRect(cx + 20, y + 9.3, 40, 1.4); y += 20 + 40;
      ctx.textAlign = 'center'; ctx.fillStyle = c.fg; ctx.font = '400 32px Prata, serif'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, W - M * 2), cx, y);
      if (bk.title && bk.author) { ctx.fillStyle = c.gold; ctx.font = '600 20px Inter, sans-serif'; tracked(ctx, ellipsize(ctx, bk.author.toUpperCase(), W - M * 2, 6), cx, y + 42, 6, 'center'); }
      ctx.textAlign = 'left';
    }
    sig(ctx, cx, L.fmt === 'story' ? H - 200 : H - fi2 - 34, 'center', c.sub, c.gold, .8, 26);
  } });

// arch window
P({ id: 'arch', ru: 'Арка', en: 'Arch', fonts: ['italic 400 60px Spectral', 'italic 300 60px Spectral', '400 30px Spectral', 'italic 500 30px "Playfair Display"'],
  palettes: [
    { ru: 'Терракота', en: 'Terracotta', bg: '#C66A4A', arch: '#F6EBDD', fg: '#3B2219', sub: '#8E6A5A', ac: '#C66A4A', on: '#F6EBDD' },
    { ru: 'Небо', en: 'Sky', bg: '#7D9BB7', arch: '#F4F1EA', fg: '#1F2C3B', sub: '#68788A', ac: '#587BA0', on: '#F4F1EA' },
    { ru: 'Песок', en: 'Sand', bg: '#D7C09B', arch: '#FBF6EC', fg: '#3A2E20', sub: '#8A7A62', ac: '#B07A3B', on: '#5C4A30' }],
  sw: p => [p.bg, p.arch],
  draw(ctx, L) {
    const { W, H, pal: c } = L, cx = W / 2;
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); noise(ctx, W, H, .06, 'overlay');
    const ax = L.fmt === 'story' ? 110 : 96, aw = W - ax * 2, rad = aw / 2, pad = 80, top = L.t - 40, bottom = H - L.b - 70, maxW = aw - pad * 2;
    // text may only start where the arch is wide enough for a full line plus breathing room
    const hw = maxW / 2 + 58, reserve = rad - Math.sqrt(Math.max(0, rad * rad - hw * hw)) + 24;
    const bk = bookParts(L), footH = bk.any ? 46 + 38 + (bk.title && bk.author ? 38 : 0) : 0;
    const F = fit(ctx, '«' + L.text + '»', { font: s => `italic 400 ${s}px Spectral, Georgia, serif`, maxW, maxH: bottom - top - reserve - pad - footH, lh: 1.32, min: 30, max: 86 });
    const inner = F.h + footH, ah = Math.max(inner + reserve + pad, Math.min(bottom - top, rad * 2.1)), ay = stack(top, bottom, [ah], .5);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
    ctx.beginPath(); ctx.moveTo(ax, ay + ah); ctx.lineTo(ax, ay + rad); ctx.arc(cx, ay + rad, rad, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.closePath(); ctx.fillStyle = c.arch; ctx.fill(); ctx.restore();
    ctx.strokeStyle = c.ac; ctx.globalAlpha = .45; ctx.lineWidth = 1.5; const i = 22; ctx.beginPath(); ctx.moveTo(ax + i, ay + ah - i); ctx.lineTo(ax + i, ay + rad); ctx.arc(cx, ay + rad, rad - i, Math.PI, 0); ctx.lineTo(ax + aw - i, ay + ah - i); ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
    let y = ay + reserve + Math.max(0, (ah - reserve - pad - inner) * .42);
    // little sun right above the text
    const sy = y - 66;
    ctx.fillStyle = c.ac; ctx.beginPath(); ctx.arc(cx, sy, 16, 0, PI2); ctx.fill(); ctx.strokeStyle = c.ac; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let k = 0; k < 12; k++) { const a = k * PI2 / 12; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 25, sy + Math.sin(a) * 25); ctx.lineTo(cx + Math.cos(a) * (k % 2 ? 31 : 36), sy + Math.sin(a) * (k % 2 ? 31 : 36)); ctx.stroke(); }
    ctx.lineCap = 'butt';
    drawLines(ctx, F, cx, y, 'center', c.fg); y += F.h;
    if (bk.any) {
      y += 46 + 30; ctx.textAlign = 'center'; ctx.fillStyle = c.fg; ctx.font = '400 30px Spectral, serif'; ctx.fillText(ellipsize(ctx, bk.title || bk.author, maxW), cx, y);
      if (bk.title && bk.author) { ctx.fillStyle = c.sub; ctx.font = 'italic 300 28px Spectral, serif'; ctx.fillText(ellipsize(ctx, bk.author, maxW), cx, y + 38); }
      ctx.textAlign = 'left';
    }
    sig(ctx, cx, Math.min(ay + ah + 80, H - 50), 'center', c.on, c.on, .85, 28);
  } });

/* ------------------------------ fonts + render ------------------------------ */
let cssP = null;
export function loadFontCSS() {
  if (cssP) return cssP;
  cssP = new Promise(res => {
    if (document.querySelector('link[data-studio-fonts]')) return res();
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_CSS; l.dataset.studioFonts = '1';
    l.onload = () => res(); l.onerror = () => res(); document.head.appendChild(l); setTimeout(res, 5000);
  });
  return cssP;
}
const fontsOk = new Map();
// Load the exact @font-face files a render needs. WebKit sometimes never settles document.fonts.load()
// for faces split over several unicode-range files, and fonts.check() can say "ready" while the latin
// file (punctuation) is still missing, so faces are matched and loaded one by one.
function ranges(ur) {
  return String(ur || 'U+0-10FFFF').split(',').map(x => x.trim().replace(/^U\+/i, '')).map(x => { if (x.includes('?')) return [parseInt(x.replace(/\?/g, '0'), 16), parseInt(x.replace(/\?/g, 'F'), 16)]; const [a, b] = x.split('-'); return [parseInt(a, 16), parseInt(b || a, 16)]; });
}
function facesFor(font, sample) {
  const m = font.match(/^(italic\s+)?(\d{3})\s+[\d.]+px\s+"?([^",]+)"?/); if (!m) return [];
  const style = m[1] ? 'italic' : 'normal', weight = +m[2], fam = m[3].trim().toLowerCase();
  const cps = new Set([...sample].map(c => c.codePointAt(0)).filter(c => c > 32)); const out = [];
  document.fonts.forEach(f => {
    if (f.family.replace(/["']/g, '').trim().toLowerCase() !== fam || f.style !== style) return;
    const w = String(f.weight).split(/\s+/).map(Number); if (w.length > 1 ? (weight < w[0] || weight > w[1]) : (w[0] !== weight && !(f.weight === 'normal' && weight === 400) && !(f.weight === 'bold' && weight === 700))) return;
    const rs = ranges(f.unicodeRange); for (const c of cps) if (rs.some(([a, b]) => c >= a && c <= b)) { out.push(f); break; }
  });
  return out;
}
function waitFont(f, sample) {
  const faces = facesFor(f, sample);
  const p = faces.length ? Promise.all(faces.map(x => x.status === 'loaded' ? 0 : x.load().catch(() => {}))) : document.fonts.load(f, sample).catch(() => {});
  return Promise.race([p, new Promise(r => setTimeout(r, 8000))]);
}
export async function ensureFonts(preset, sample) {
  await loadFontCSS();
  const key = preset.id + '|' + sample;
  if (fontsOk.has(key)) return fontsOk.get(key);
  const p = Promise.all(preset.fonts.map(f => waitFont(f, sample))).then(() => { metricCache.clear(); inkCache.clear(); });
  fontsOk.set(key, p); return p;
}
export const presetById = id => PRESETS.find(p => p.id === id) || PRESETS[0];
export function sampleOf(q) { return cleanText(q.text) + (q.title || '') + (q.author || '') + '«»“”"—…ЦИТАТАQUOTEMURMURmurmur'; }
export async function renderQuote(q, opt = {}, scale = 1) {
  const preset = presetById(opt.p), fmt = FORMATS[opt.f] || FORMATS.story, pal = preset.palettes[Math.min(opt.c || 0, preset.palettes.length - 1)];
  await ensureFonts(preset, sampleOf(q));
  const c = document.createElement('canvas'); c.width = Math.round(fmt.W * scale); c.height = Math.round(fmt.H * scale);
  const ctx = c.getContext('2d'); ctx.scale(scale, scale);
  const L = { W: fmt.W, H: fmt.H, t: fmt.t, b: fmt.b, fmt: opt.f || 'story', q, text: glue(cleanText(q.text)), show: opt.b !== false, pal, r: rngOf(q.id || q.text), ru: opt.ru !== false };
  FMT_K = L.fmt === 'story' ? 1.1 : L.fmt === 'square' ? 0.94 : 1;
  preset.draw(ctx, L);
  return c;
}
