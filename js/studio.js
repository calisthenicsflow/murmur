// Murmur quote studio: pick a style, palette and format for a saved quote, preview live, share or save as PNG.
import { db } from './db.js?v=1.6.1';
import { t, uiLang } from './i18n.js?v=1.6.1';
import { PRESETS, FORMATS, presetById, renderQuote, ensureFonts, loadFontCSS, sampleOf, cleanText } from './qrender.js?v=1.6.1';

const $ = (r, s) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ru = () => uiLang() === 'ru';
const nm = o => (ru() ? o.ru : o.en) || o.ru;
const LAST = 'murmur:studio';
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5c2.5-1 5.2-1 8 .8 2.8-1.8 5.5-1.8 8-.8v13c-2.5-1-5.2-1-8 .8-2.8-1.8-5.5-1.8-8-.8z"/><path d="M12 6.3v13"/></svg>'
};
export function defaultStyle(q) {
  let last = {}; try { last = JSON.parse(localStorage.getItem(LAST) || '{}'); } catch {}
  const st = Object.assign({ p: 'editorial', c: 0, f: 'story', b: true }, last, q && q.style || {});
  if (!PRESETS.some(p => p.id === st.p)) st.p = PRESETS[0].id;
  if (!FORMATS[st.f]) st.f = 'story';
  return st;
}
function swatches(p, pal) {
  if (p.sw) return p.sw(pal);
  return [pal.bg || pal.paper || pal.base, pal.ac || pal.ink || pal.fg];
}
function swatchCSS(cols) {
  const [a, b, c2, d] = cols;
  if (cols.length >= 4) return `conic-gradient(from 200deg, ${a}, ${b}, ${c2}, ${d}, ${a})`;
  return `linear-gradient(135deg, ${a} 0 52%, ${b} 52% 100%)`;
}

let el = null, cur = null;
export function studioOpen() { return !!(el && el.classList.contains('show')); }
export function closeStudio() {
  if (!el) return; thumbSeq++; el.classList.remove('show'); document.body.classList.remove('studio-on');
  const e = el; setTimeout(() => { if (!e.classList.contains('show')) { e.remove(); if (el === e) el = null; } }, 420);
  if (cur && cur.ro) cur.ro.disconnect(); if (cur && cur.url) URL.revokeObjectURL(cur.url); if (cur && cur.onClose) cur.onClose(cur.q); cur = null;
}
export async function openStudio(q, opts = {}) {
  if (el) { el.remove(); el = null; }
  loadFontCSS();
  const st = defaultStyle(q);
  cur = { q, st, blob: null, url: null, seq: 0, toast: opts.toast || (() => {}), onClose: opts.onClose };
  el = document.createElement('div'); el.className = 'studio'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('studio'));
  el.innerHTML = `
    <header class="st-top">
      <button class="round-btn st-back" aria-label="${esc(t('back'))}">${ICON.back}</button>
      <div class="st-title">${esc(t('studio'))}</div>
      <button class="st-bookbtn ${st.b ? 'on' : ''}" aria-pressed="${st.b}" aria-label="${esc(t('studioBook'))}">${ICON.book}<span>${esc(t('studioBookShort'))}</span></button>
    </header>
    <div class="st-fmt" role="tablist">${Object.entries(FORMATS).map(([k, f]) => `<button role="tab" data-f="${k}" class="${k === st.f ? 'on' : ''}"><b>${esc(nm(f))}</b><small>${f.note}</small></button>`).join('')}</div>
    <div class="st-stage"><div class="st-frame"><img class="st-img" alt=""><div class="st-load"><i></i></div></div></div>
    <div class="st-panel">
      <div class="st-pals" aria-label="${esc(t('studioPalette'))}"></div>
      <div class="st-strip" aria-label="${esc(t('studioStyle'))}">${PRESETS.map(p => `<button class="st-th ${p.id === st.p ? 'on' : ''}" data-p="${p.id}"><span class="st-thimg" style="aspect-ratio:${FORMATS[st.f].W} / ${FORMATS[st.f].H}"><canvas></canvas></span><span class="st-thname">${esc(nm(p))}</span></button>`).join('')}</div>
      <div class="st-actions">
        <button class="pill-black st-share">${ICON.share}<span>${esc(t('shareAction'))}</span></button>
        <button class="st-save">${ICON.save}<span>${esc(t('studioSave'))}</span></button>
      </div>
      <div class="st-hint">${esc(isIOS() ? t('studioHintIOS') : t('studioHint'))}</div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('show'); document.body.classList.add('studio-on'); }));
  $(el, '.st-back').onclick = closeStudio;
  $(el, '.st-fmt').onclick = e => { const b = e.target.closest('[data-f]'); if (!b || b.dataset.f === cur.st.f) return; cur.st.f = b.dataset.f; el.querySelectorAll('.st-fmt button').forEach(x => x.classList.toggle('on', x === b)); persist(); fitFrame(); refresh(); thumbs(); };
  $(el, '.st-bookbtn').onclick = e => { const b = e.currentTarget; cur.st.b = !cur.st.b; b.classList.toggle('on', cur.st.b); b.setAttribute('aria-pressed', cur.st.b); persist(); refresh(); };
  $(el, '.st-strip').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; if (b.dataset.p !== cur.st.p) { cur.st.p = b.dataset.p; cur.st.c = 0; el.querySelectorAll('.st-th').forEach(x => x.classList.toggle('on', x === b)); persist(); pals(); refresh(); } b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); };
  $(el, '.st-share').onclick = () => share(false);
  $(el, '.st-save').onclick = () => share(true);
  pals(); fitFrame();
  if (window.ResizeObserver) { cur.ro = new ResizeObserver(() => fitFrame()); cur.ro.observe($(el, '.st-stage')); } else window.addEventListener('resize', fitFrame);
  await refresh();
  const on = el.querySelector('.st-th.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  thumbs();
}
function persist() {
  const { p, c, f, b } = cur.st; cur.q.style = { p, c, f, b };
  try { localStorage.setItem(LAST, JSON.stringify({ p, c, f, b })); } catch {}
  if (cur.q.id) db.set('quotes', cur.q.id, cur.q);
}
function pals() {
  const p = presetById(cur.st.p), box = $(el, '.st-pals');
  box.innerHTML = p.palettes.map((pal, i) => `<button class="st-pal ${i === cur.st.c ? 'on' : ''}" data-c="${i}" aria-label="${esc(nm(pal))}"><i style="background:${swatchCSS(swatches(p, pal))}"></i><span>${esc(nm(pal))}</span></button>`).join('');
  box.onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cur.st.c = +b.dataset.c; box.querySelectorAll('.st-pal').forEach(x => x.classList.toggle('on', x === b)); persist(); refresh(); };
}
function fitFrame() {
  if (!el) return; const f = FORMATS[cur.st.f], stage = $(el, '.st-stage'), fr = $(el, '.st-frame');
  const W = stage.clientWidth - 8, H = stage.clientHeight - 8; if (W <= 0 || H <= 0) return;
  const k = Math.min(W / f.W, H / f.H); fr.style.width = Math.floor(f.W * k) + 'px'; fr.style.height = Math.floor(f.H * k) + 'px';
}
async function refresh() {
  const my = ++cur.seq, fr = $(el, '.st-frame'); fr.classList.add('busy'); cur.blob = null;
  const c = await renderQuote(cur.q, { ...cur.st, ru: ru() }, 1);
  if (!cur || my !== cur.seq) return;
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); c.width = c.height = 0;
  if (!cur || my !== cur.seq) return;
  if (cur.url) URL.revokeObjectURL(cur.url);
  cur.blob = blob; cur.url = URL.createObjectURL(blob);
  const img = $(el, '.st-img'); img.src = cur.url; img.alt = cleanText(cur.q.text).slice(0, 120);
  fr.classList.remove('busy');
}
let thumbSeq = 0;
async function thumbs() {
  const my = ++thumbSeq, f = cur.st.f;
  el.querySelectorAll('.st-thimg').forEach(s => { s.style.aspectRatio = `${FORMATS[f].W} / ${FORMATS[f].H}`; const cv = s.querySelector('canvas'); cv.width = cv.height = 0; }); fitFrame();
  for (const b of el.querySelectorAll('.st-th')) {
    if (!el || !cur || my !== thumbSeq) return;
    const p = presetById(b.dataset.p), q = cur.q;
    const c = await renderQuote(q, { p: p.id, c: p.id === cur.st.p ? cur.st.c : 0, f, b: cur.st.b, ru: ru() }, 0.16);
    if (!el || !cur || my !== thumbSeq) { c.width = c.height = 0; return; }
    const dst = b.querySelector('canvas'); dst.width = c.width; dst.height = c.height; dst.getContext('2d').drawImage(c, 0, 0); c.width = c.height = 0;
    await new Promise(r => setTimeout(r, 0));
  }
}
function fileName() { return `murmur-quote-${cur.st.p}-${cur.st.f}.png`; }
async function share(saveOnly) {
  if (!cur) return;
  // the image is pre-rendered, so iOS still sees this as the user's tap when the share sheet opens
  if (!cur.blob) { $(el, '.st-frame').classList.add('busy'); await new Promise(r => { const i = setInterval(() => { if (!cur || cur.blob) { clearInterval(i); r(); } }, 50); }); if (!cur) return; }
  const file = new File([cur.blob], fileName(), { type: 'image/png' });
  const canFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  if (canFiles && (!saveOnly || isIOS())) {
    try { await navigator.share({ files: [file] }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = cur.url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  cur.toast(t('studioSaved'));
}
