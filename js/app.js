import { db } from './db.js?v=1.3.5';
import { t, uiLang, setUiLang, plural } from './i18n.js';
import { buildModel, detectLang, wc, wordSpans } from './text.js?v=1.3.5';
import { coverSVG, autoCover } from './covers.js?v=1.3.5';
import { createWebSpeechEngine, createEdgeEngine, langName, nativeName, regionName, SILENT, ttsStats } from './engines.js?v=1.3.5';
import { CURATED, CATALOG, PREVIEW_TEXT } from './voices.js?v=1.3.5';
import { Player } from './player.js?v=1.3.5';
import { translateMany } from './translate.js?v=1.3.5';
import { track, summary } from './stats.js?v=1.3.5';
import { renderCard, shareCard } from './quotes.js?v=1.3.5';
import { fromText, fromPDF, fromEPUB, fromURL } from './importers.js?v=1.3.5';
import { SAMPLES } from './samples.js?v=1.3.5';

export const APP_VERSION = '1.3.5';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = {
  pages: '<svg viewBox="0 0 24 24"><path d="M4 5.5c2.5-1 5.2-1 8 .8 2.8-1.8 5.5-1.8 8-.8v13c-2.5-1-5.2-1-8 .8-2.8-1.8-5.5-1.8-8-.8z"/><path d="M12 6.3v13"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" class="ck"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  headph: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/></svg>',
  quote: '<svg viewBox="0 0 24 24"><path d="M9.5 6.5C6.6 7.6 5 9.8 5 13v4.5h5V13H7.4c.2-1.9 1.2-3.2 3-4M18.5 6.5c-2.9 1.1-4.5 3.3-4.5 6.5v4.5h5V13h-2.6c.2-1.9 1.2-3.2 3-4"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  tr: '<svg viewBox="0 0 24 24"><path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5 6.5M11 6c-.7 3.3-3 6-6.5 7.5M13 20l4-9 4 9M14.4 17h5.2"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  mark: '<svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-3.6L7 20z"/></svg>',
  focus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4"/></svg>',
  wand: '<svg viewBox="0 0 24 24"><path d="M5 19L15 9M14 4v3M19.5 9.5h-3M17.7 5.3l-2 2M9 4.5l.8 1.7 1.7.8-1.7.8L9 9.5l-.8-1.7L6.5 7l1.7-.8z"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  stop: '<svg viewBox="0 0 24 24" class="i-stop"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>'
};
const SHELVES = [
  { id: 'novels', g: 'rgba(255,138,61,.55)', g2: 'rgba(240,104,36,.72)' },
  { id: 'philosophy', g: 'rgba(84,140,255,.5)', g2: 'rgba(52,104,232,.7)' },
  { id: 'russian', g: 'rgba(72,190,150,.5)', g2: 'rgba(30,150,110,.68)' },
  { id: 'articles', g: 'rgba(240,110,150,.5)', g2: 'rgba(214,72,118,.68)' },
  { id: 'psychology', g: 'rgba(160,120,240,.5)', g2: 'rgba(124,84,216,.7)' },
  { id: 'design', g: 'rgba(250,196,60,.55)', g2: 'rgba(232,166,24,.72)' },
  { id: 'mine', g: 'rgba(120,120,128,.42)', g2: 'rgba(80,80,88,.6)' }
];
const FS_STEPS = [14, 16, 18, 21, 24, 28, 32, 36], FS_MIN = 14, FS_MAX = 36;
const TR_LANGS = ['ru', 'en', 'es', 'de', 'fr', 'it', 'uk', 'pt', 'tr', 'zh', 'ja'];

/* ------------------------------ state ------------------------------ */
const DEF = { align: 'justify', theme: 'paper', fs: 19, font: 'literata', lh: 1.62, dim: 0, engine: 'auto', voices: {}, rate: 1, skip: true, bi: false, biTo: '', both: false, readTr: true, bare: false, hints: {}, focus: false, relay: '' };
const prefs = Object.assign({}, DEF, JSON.parse(localStorage.getItem('murmur:prefs') || '{}'));
const savePrefs = () => localStorage.setItem('murmur:prefs', JSON.stringify(prefs));
const S = { books: [], book: null, sec: 0, model: null, mode: 'read', wordEls: [], sentEls: [], curW: -1, curS: 0, neuralOk: false, relay: '', timer: null, trans: {}, lastUserScroll: 0, lastInteract: Date.now(), screen: 'library', stack: [] };
const player = new Player();
const device = createWebSpeechEngine();
const neural = createEdgeEngine(() => S.relay);

/* ------------------------------ utils ------------------------------ */
let toastT;
function toast(msg, ms = 2400) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const shelfName = id => t('shelf_' + id);
const ruPl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c); };
const fmtRate = r => (Number.isInteger(r) ? r.toFixed(1) : String(+r.toFixed(2))) + '×';
const fmtClock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function applyI18n() { $$('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); }); $('#btnLang').textContent = uiLang().toUpperCase(); document.documentElement.lang = uiLang(); }
function applyLook() {
  document.body.dataset.theme = prefs.theme;
  const r = document.documentElement.style;
  prefs.fs = Math.max(FS_MIN, Math.min(FS_MAX, +prefs.fs || 19));
  // line height tightens a little for very large type and opens up for small type
  const lhEff = Math.max(1.3, +(prefs.lh - Math.max(-0.06, Math.min(0.2, (prefs.fs - 19) * 0.011))).toFixed(3));
  r.setProperty('--fs', prefs.fs + 'px'); r.setProperty('--lh', lhEff);
  r.setProperty('--serif', { literata: "'Literata', Georgia, serif", source: "'Source Serif 4', Georgia, serif", inter: "'Inter', system-ui, sans-serif" }[prefs.font]);
  $('#dim').style.opacity = prefs.dim;
  document.body.classList.toggle('align-left', prefs.align === 'left' || prefs.fs >= 28);
  document.body.classList.toggle('big-type', prefs.fs >= 28); // smaller drop cap so long first words still fit beside it // justify makes huge gaps in a narrow column at big sizes
  const tc = { paper: '#EFEDEA', sepia: '#F2E8D6', night: '#131315' }[prefs.theme];
  $('meta[name=theme-color]').setAttribute('content', tc);
  requestAnimationFrame(() => { layoutPages(); positionHL(true); });
}

const keepWordInView = debounce(() => { if (S.screen === 'reader' && S.curW >= 0) { positionHL(true); scrollToWord(S.curW, false); } }, 120);
/* ------------------------------ navigation ------------------------------ */
function show(id, push = true) {
  const from = S.screen; if (from === id) return;
  $$('.screen').forEach(s => s.classList.remove('active', 'behind'));
  $('#' + id).classList.add('active');
  if (id !== 'library') $('#library').classList.add('behind');
  S.screen = id;
  if (push) history.pushState({ screen: id }, '');
}
window.addEventListener('popstate', e => {
  if ($('#sheet').classList.contains('show')) { closeSheet(true); history.pushState({ screen: S.screen }, ''); return; }
  const id = (e.state && e.state.screen) || 'library';
  if (S.screen === 'reader' && id !== 'reader') leaveReader();
  show(id, false);
  if (id === 'library') renderLibrary();
});

/* ------------------------------ library ------------------------------ */
async function loadBooks() {
  // seed sample books once each (a removed sample stays removed; new samples appear after updates)
  const seeded = JSON.parse(localStorage.getItem('murmur:seeded') || '[]');
  for (const s of SAMPLES) {
    if (seeded.includes(s.id)) continue;
    if (!(await db.get('books', s.id))) await db.set('books', s.id, { ...s, createdAt: Date.now() - 1000 * SAMPLES.indexOf(s) });
    seeded.push(s.id);
  }
  localStorage.setItem('murmur:seeded', JSON.stringify(seeded));
  S.books = (await db.all('books')).filter(b => b && b.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
function bookProgress(b) {
  if (!b.pos || !b.sections) return 0;
  const n = b.sections.length; const words = wc(b.sections[b.pos.sec]?.text) || 1;
  return Math.min(1, (b.pos.sec + Math.min(1, (b.pos.w || 0) / words)) / n);
}
function renderLibrary() {
  applyI18n();
  const last = S.books.filter(b => b.openedAt).sort((a, b) => b.openedAt - a.openedAt)[0];
  $('#continue').innerHTML = last ? `<div class="cont" data-open="${last.id}"><div class="mini">${coverSVG(last)}</div><div class="meta"><div class="k">${t('continue')} · ${Math.round(bookProgress(last) * 100)}%</div><div class="t">${esc(last.title)}</div><div class="pb"><i style="width:${Math.max(3, bookProgress(last) * 100)}%"></i></div></div><button class="go" aria-label="Play">${ICON.play}</button></div>` : '';
  const groups = SHELVES.map(sh => ({ ...sh, books: S.books.filter(b => (b.shelf || 'mine') === sh.id) })).filter(g => g.books.length || g.id === 'mine');
  $('#shelves').innerHTML = groups.map((g, gi) => `
    <div class="shelf" style="--g:${g.g};--g2:${g.g2};animation-delay:${.1 + gi * .08}s" data-shelf="${g.id}">
      <div class="shelf-head"><h2>${esc(shelfName(g.id))}</h2><div class="shelf-nav"><span class="count">${g.books.length} ${plural(g.books.length)}</span><button data-dir="-1" aria-label="Scroll left">${ICON.left}</button><button data-dir="1" aria-label="Scroll right">${ICON.right}</button></div></div>
      <div class="shelf-row">${g.books.map(b => `<div class="book" data-open="${b.id}" style="height:auto"><div class="cv" style="height:${150 + (parseInt(b.id.replace(/\D/g, '').slice(-2) || '7', 10) % 3) * 7 + (b.sample ? b.title.length % 13 : 0)}px">${coverSVG(b)}${b.sample ? '' : ''}${bookProgress(b) > 0 ? `<i class="prog" style="width:${bookProgress(b) * 100}%"></i>` : ''}${b.ocr && b.ocr.state !== 'done' ? `<em class="ocr-badge">OCR ${b.ocr.done}/${b.ocr.total}</em>` : ''}</div></div>`).join('')}
        ${g.id === 'mine' ? `<div class="book add" data-add="1"><div class="cv"><span>${ICON.plus}${esc(t('addBooks'))}</span></div></div>` : ''}</div>
      <div class="glass"><i class="screw l" style="--r:${20 + gi * 37}deg"></i><i class="screw r" style="--r:${70 + gi * 23}deg"></i></div>
    </div>`).join('');
  $$('.shelf').forEach(sh => {
    const row = sh.querySelector('.shelf-row'), [bl, br] = sh.querySelectorAll('.shelf-nav button');
    const upd = () => { bl.disabled = row.scrollLeft < 4; br.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4; };
    row.addEventListener('scroll', upd, { passive: true }); upd();
    sh.querySelectorAll('.shelf-nav button').forEach(b => b.onclick = () => row.scrollBy({ left: +b.dataset.dir * (122 * 2), behavior: 'smooth' }));
  });
}
$('#library').addEventListener('click', e => {
  const add = e.target.closest('[data-add]'); if (add) return openAdd();
  const go = e.target.closest('.cont .go');
  const o = e.target.closest('[data-open]'); if (o && !S.longPressed) openBook(o.dataset.open, !!go);
});
// long-press a book → remove
let lpT; $('#library').addEventListener('pointerdown', e => {
  const o = e.target.closest('.book[data-open]'); S.longPressed = false; if (!o) return;
  lpT = setTimeout(() => { S.longPressed = true; navigator.vibrate?.(12); bookMenu(o.dataset.open); }, 550);
});
['pointerup', 'pointercancel', 'pointermove'].forEach(ev => $('#library').addEventListener(ev, e => { if (ev !== 'pointermove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(lpT); }));
$('#library').addEventListener('contextmenu', e => { if (e.target.closest('.book')) e.preventDefault(); });
function bookMenu(id) {
  const b = S.books.find(x => x.id === id); if (!b) return;
  openSheet(`<div class="sh-title">${esc(b.title)}<button class="x" data-close>${ICON.x}</button></div>
    <div class="row" data-a="open"><div class="ic">${ICON.headph}</div><div class="tx"><b>${t('read')} / ${t('listen')}</b><small>${esc(b.author || '')}</small></div></div>
    <div class="row danger" data-a="del"><div class="ic">${ICON.trash}</div><div class="tx"><b>${t('deleteBook')}</b></div></div>`, body => {
    body.querySelector('[data-a=open]').onclick = () => { closeSheet(); openBook(id); };
    body.querySelector('[data-a=del]').onclick = async () => { if (OCR) OCR.cancelOCR(id); await db.del('files', id); await db.del('books', id); S.books = S.books.filter(x => x.id !== id); closeSheet(); renderLibrary(); toast('✓'); };
  });
}
$('#btnAdd').onclick = () => openAdd();
$('#btnAbout').onclick = () => openSheet(`<div class="sh-title">${t('about')}<button class="x" data-close>${ICON.x}</button></div>
  <div class="about"><img class="about-icon" src="icons/icon-192.png?v=${APP_VERSION}" alt=""><div class="brand">murmur<i></i></div><small>v${APP_VERSION}</small><p>${t('aboutLead')}</p>
  <h4>${t('privacy')}</h4><p>${t('privacyBody')}</p>
  ${navigator.standalone || matchMedia('(display-mode: standalone)').matches ? '' : `<h4>${t('installTitle')}</h4><p>${t('installBody')}</p>`}
  <p class="note">${t('credits')}</p>
  <button class="about-btn" id="resetHints">${t('resetHints')}</button></div>`, body => {
  body.querySelector('#resetHints').onclick = () => { prefs.hints = {}; savePrefs(); toast(t('hintsReset')); };
});
$('#btnLang').onclick = () => { setUiLang(uiLang() === 'en' ? 'ru' : 'en'); renderLibrary(); };
$('#btnQuotes').onclick = () => { renderQuotes(); show('quotes'); };
$('#btnStats').onclick = () => { renderStats(); show('stats'); };
$$('[data-back]').forEach(b => b.onclick = () => history.back());

/* ------------------------------ add content ------------------------------ */
function openAdd(tab = 'paste') {
  let shelf = 'mine', fileObj = null;
  const shelfChips = () => SHELVES.map(s => `<button data-sh="${s.id}" class="${s.id === shelf ? 'on' : ''}"><i style="background:${s.g2}"></i>${esc(shelfName(s.id))}</button>`).join('');
  openSheet(`<div class="sh-title">${t('addTitle')}<button class="x" data-close>${ICON.x}</button></div>
    <div class="segs" id="addTabs"><button data-t="paste">${t('paste')}</button><button data-t="file">${t('file')}</button><button data-t="url">${t('url')}</button></div>
    <div id="addPane" style="margin-top:16px"></div>
    <div class="sh-label">${t('shelf')}</div><div class="shelf-chips" id="shChips">${shelfChips()}</div>
    <div class="err" id="addErr"></div>
    <button class="big-btn" id="addGo">${ICON.plus}<span>${t('importBtn')}</span></button>`, body => {
    const pane = body.querySelector('#addPane'), err = body.querySelector('#addErr'), go = body.querySelector('#addGo');
    const setTab = tb => {
      tab = tb; body.querySelectorAll('#addTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tb)); err.textContent = '';
      if (tb === 'paste') pane.innerHTML = `<input class="inp" id="addTitle" placeholder="${t('titleOpt')}" style="margin-bottom:10px"><textarea id="addText" placeholder="${t('pasteHint')}"></textarea>`;
      // a real <input type=file> stretched (invisible) over the drop zone: the tap lands on the input itself,
      // so iOS opens the picker natively — no programmatic .click() on a hidden input, no accept filter
      if (tb === 'file') pane.innerHTML = `<div class="drop" id="drop">${ICON.file}<b id="fname">${fileObj ? esc(fileObj.name) : t('choose')}</b><small>${t('fileHint')}</small><input type="file" id="fileTap" class="drop-input" aria-label="${t('choose')}" title=""></div>`;
      if (tb === 'url') pane.innerHTML = `<input class="inp" id="addUrl" type="url" inputmode="url" autocapitalize="off" placeholder="${t('urlHint')}">`;
      if (tb === 'file') { const fi = pane.querySelector('#fileTap'); fi.onchange = () => { const f = fi.files && fi.files[0]; if (f) { fileObj = f; pane.querySelector('#fname').textContent = f.name || t('thisFile'); err.textContent = ''; err.classList.remove('neutral'); } }; }
    };
    body.querySelectorAll('#addTabs button').forEach(b => b.onclick = () => setTab(b.dataset.t));
    body.querySelector('#shChips').onclick = e => { const b = e.target.closest('[data-sh]'); if (!b) return; shelf = b.dataset.sh; body.querySelector('#shChips').innerHTML = shelfChips(); };
    setTab(tab);
    go.onclick = async () => {
      err.textContent = ''; go.disabled = true; const lbl = go.querySelector('span'); lbl.textContent = tab === 'url' ? t('fetching') : t('importing');
      try {
        let r;
        if (tab === 'paste') { const txt = body.querySelector('#addText').value.trim(); if (wc(txt) < 3) throw new Error('empty'); r = fromText(txt, body.querySelector('#addTitle').value.trim()); }
        else if (tab === 'file') {
          if (!fileObj) throw new Error('nofile');
          const { importFile } = await import('./formats.js?v=' + APP_VERSION); // format libs load only when needed
          r = await importFile(fileObj);
          if (r.scanned) { await startScanned(r, fileObj, shelf, body, go); return; }
        } else { const u = body.querySelector('#addUrl').value.trim(); if (!u) throw new Error('nourl'); r = await fromURL(u); }
        if (!r.sections || !r.sections.length || !r.sections.some(s => wc(s.text) > 2)) throw new Error('empty');
        const book = { id: 'u-' + uid(), title: r.title || 'Untitled', author: r.author || '', lang: r.lang || detectLang(r.sections.slice(0, 3).map(x => x.text).join('\n\n')), lv: 2, shelf, sections: r.sections, source: r.source || '', createdAt: Date.now() };
        book.cover = autoCover(book.title + book.id);
        await db.set('books', book.id, book); S.books.unshift(book);
        closeSheet(); renderLibrary(); toast(t('added'));
        setTimeout(() => openBook(book.id), 450);
      } catch (e) {
        console.warn('import failed', e);
        err.classList.remove('neutral');
        err.textContent = tab === 'file' ? (e.message === 'nofile' ? t('choose') : importErr(e, fileObj)) : e.message === 'empty' ? t('emptyText') : tab === 'url' ? t('urlFail') : t('emptyText');
      } finally { go.disabled = false; lbl.textContent = t('importBtn'); }
    };
  });
}

function importErr(e, f) {
  const code = e.code || e.message, fmt = e.fmt || ((f?.name || '').match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toUpperCase();
  const k = { drm: 'errDRM', mobiHuff: 'errHuff', djvu: 'errDjvu', comic: 'errComic', oldDoc: 'errOldDoc', image: 'errImage', unsupported: 'errUnsupported', broken: 'errBroken', emptyFile: 'errEmptyFile', ocrStart: 'errOCRStart' }[code];
  // unknown failures show their real reason (short) instead of a generic / misleading message
  const why = !k && code !== 'empty' && e && e.message ? ': ' + String(e.message).slice(0, 140) : '';
  return (k ? t(k) : code === 'empty' ? t('emptyText') + (fmt ? ` (${fmt})` : '') : t('fileFail') + (fmt ? ` (${fmt})` : '') + why).replace('{fmt}', fmt || t('thisFile')).replace('{why}', e && e.why ? String(e.why).slice(0, 140) : '');
}

/* ------------------------------ scanned PDFs → OCR ------------------------------ */
let OCR = null; const ocrMod = async () => OCR || (OCR = await import('./ocr.js?v=' + APP_VERSION));
async function startScanned(r, file, shelf, body, go) {
  let o;
  try { o = await ocrMod(); } catch (e) { OCR = null; const er = new Error('ocrStart'); er.code = 'ocrStart'; er.fmt = 'PDF'; er.why = e && e.message; throw er; }
  const book = { id: 'u-' + uid(), title: r.title || 'Untitled', author: r.author || '', lang: uiLang() === 'ru' ? 'ru' : 'en', lv: 2, shelf, sections: [], createdAt: Date.now(),
    ocr: { total: r.pages, done: 0, state: 'queued', titleAuto: !!r.titleFromName, langs: o.ocrLangs(uiLang(), navigator.languages || []) } };
  book.cover = autoCover(book.title + book.id);
  // keep the PDF for page-by-page OCR as raw bytes: File/Blob values in IndexedDB fail in iOS WebViews
  // (Chrome iOS, Telegram/Instagram browsers) and some WebKit builds — they come back unreadable
  await db.set('files', book.id, new Uint8Array(await file.arrayBuffer()));
  await db.set('books', book.id, book); S.books.unshift(book); renderLibrary();
  // progress inside the sheet until the first page with text is ready, then open the book; OCR continues
  const err = body.querySelector('#addErr'); go.style.display = 'none';
  err.innerHTML = `<div class="ocr-box"><b>${t('scanned')}</b><small>${t('scannedHint')}</small><div class="ocr-bar"><i id="ocrBarSheet"></i></div><div class="ocr-row"><span id="ocrTxtSheet">${t('ocrLoading')}</span><button id="ocrCancelSheet">${t('cancel')}</button></div></div>`;
  err.classList.add('neutral');
  body.querySelector('#ocrCancelSheet').onclick = async () => { o.cancelOCR(book.id); if (!book.sections.length) { await deleteBook(book.id); } closeSheet(); };
  let opened = false;
  const off = o.onOCR((b, x) => {
    if (b.id !== book.id) return;
    const el = document.getElementById('ocrTxtSheet'); if (el) el.textContent = ocrLabel(b, x);
    const bar = document.getElementById('ocrBarSheet'); if (bar) bar.style.width = ocrPct(b, x) + '%';
    if (!opened && b.sections.length && (x.added || b.ocr.state !== 'running')) { opened = true; off(); closeSheet(); toast(t('added')); setTimeout(() => openBook(b.id), 400); }
  });
  ensureOCRListener(); o.runOCR(book);
}
const ocrPct = (b, x = {}) => Math.min(100, ((b.ocr.done + (x.pageProgress || 0)) / b.ocr.total) * 100);
const ocrLabel = (b, x = {}) => b.ocr.state === 'error' ? t('ocrError') : b.ocr.state === 'paused' ? t('ocrPaused').replace('{n}', b.ocr.done).replace('{t}', b.ocr.total) : b.ocr.done === 0 && !x.pageProgress ? t('ocrLoading') : t('ocrProgress').replace('{n}', Math.min(b.ocr.total, b.ocr.done + 1)).replace('{t}', b.ocr.total);
let ocrListening = false;
async function ensureOCRListener() {
  if (ocrListening) return; ocrListening = true;
  const o = await ocrMod();
  o.onOCR((b, x) => {
    // first recognised page decides the language (and so the voice)
    if (x.added && b.sections.length === 1 && !b.langManual) { b.lang = detectLang(b.sections[0].text) || b.lang; db.set('books', b.id, b); if (S.book && S.book.id === b.id) { S.model && renderSection(S.curW > 0 ? S.curW : 0, false); syncVoice(); } }
    if (x.titled) { b.cover = autoCover(b.title + b.id); db.set('books', b.id, b); renderLibrary(); if (S.book && S.book.id === b.id) { $('#rdMini').textContent = chapterName(); $('#rdTitle').textContent = b.title; } }
    if (S.book && S.book.id === b.id) { S.book = b; updateOCRPill(b, x); if (x.added) { updateNextBtn(); if (S.waitNext) { S.waitNext = false; const n = S.model.words.length; if (appendNext()) startPlayback(n); } else requestAnimationFrame(maybeExtend); } }
    if (b.ocr.state === 'done' && !x.page) toast(t('ocrDone'));
  });
}
function updateOCRPill(b = S.book, x = {}) {
  const pill = $('#ocrPill'); if (!pill) return;
  const on = b && b.ocr && b.ocr.state !== 'done';
  pill.classList.toggle('show', !!on); if (!on) return;
  pill.querySelector('span').textContent = ocrLabel(b, x);
  pill.querySelector('i').style.width = ocrPct(b, x) + '%';
  const running = b.ocr.state === 'running' || b.ocr.state === 'queued';
  pill.querySelector('button').innerHTML = running ? ICON.x : ICON.play;
  pill.querySelector('button').setAttribute('aria-label', running ? t('cancel') : t('ocrResume'));
}
async function deleteBook(id) { await db.del('books', id); await db.del('files', id); S.books = S.books.filter(x => x.id !== id); renderLibrary(); }
function updateNextBtn() {
  // no "next chapter" button: the next chapter flows in by itself; only the very end says so
  const b = S.book; if (!b) return; const last = !S.win || S.win.z >= b.sections.length - 1;
  const waiting = last && b.ocr && b.ocr.state !== 'done';
  $('#rdNext').innerHTML = waiting ? `<div class="end small">${t('ocrWaiting')}</div>` : last ? `<div class="end">— ${t('end')} —</div>` : '';
}

/* ------------------------------ sheets ------------------------------ */
let sheetClose = null;
function openSheet(html, mount, onClose) {
  const sh = $('#sheet'), body = $('#sheetBody');
  body.innerHTML = html; body.scrollTop = 0;
  body.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet());
  sheetClose = onClose || null;
  requestAnimationFrame(() => { sh.classList.add('show'); $('#scrim').classList.add('show'); });
  mount && mount(body);
  hidePop();
  hideHint();
}
function closeSheet() { $('#sheet').classList.remove('show'); $('#scrim').classList.remove('show'); const f = sheetClose; sheetClose = null; f && f(); }
$('#scrim').onclick = () => closeSheet();
// drag sheet down to close
(() => { const sh = $('#sheet'); let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if ($('#sheetBody').scrollTop > 0 && !e.target.closest('.grab')) return; if (e.target.closest('input[type=range]')) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 4) { sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 === null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheet(); y0 = null; });
})();

/* ------------------------------ reader ------------------------------ */
async function openBook(id, autoplay = false) {
  const b = S.books.find(x => x.id === id); if (!b) return;
  if (!b.sections.length) { toast(b.ocr ? ocrLabel(b) : t('emptyText')); if (b.ocr && b.ocr.state !== 'running') { ensureOCRListener(); (await ocrMod()).runOCR(b); } return; }
  S.waitNext = false;
  S.book = b; b.openedAt = Date.now();
  if (!b.sample && !b.langManual && b.lv !== 2) { b.lang = detectLang(b.sections.slice(0, 3).map(x => x.text).join('\n\n')) || b.lang; b.lv = 2; }
  db.set('books', b.id, b);
  S.sec = Math.min(b.pos?.sec || 0, b.sections.length - 1); S.win = null;
  setMode(autoplay ? 'listen' : 'read', true);
  show('reader');
  setBare(prefs.bare, false); $('#reader').classList.toggle('pages', !!prefs.pages);
  renderSection(b.pos?.w || 0); renderTimer();
  // resuming somewhere inside the book: say where, briefly
  if ((b.pos?.sec || 0) > 0 || (b.pos?.w || 0) > 0) { const sn = S.model.sents[Math.max(0, S.curS)]?.text || ''; setTimeout(() => toast(t('continueFrom').replace('{x}', `«${sn.split(/\s+/).slice(0, 6).join(' ')}…» · ${fmtPct(bookProg().f)}`), 2600), 350); }
  setTimeout(() => { if (S.screen === 'reader' && !prefs.bare && !uiBusy()) hint('tapHide', t('hintTapHide')); }, 1200);
  if (autoplay) { unlockAudio(); startPlayback(S.curW >= 0 ? S.curW : 0); }
}
function leaveReader() { player.stop(); savePos(); hidePop(); $('#focus').classList.remove('show'); updateMediaSession(); }
$('#rdBack').onclick = () => history.back();

// a drop cap only suits a prose opening: not a contents page ("Единство и множество 08-13 …"),
// a list of numbers, or a paragraph starting with a digit/quote/bracket (OCR'd tables of contents
// and front matter especially)
function dropCapOK(p, sents, words) {
  const ws = p.sents.flatMap(s => sents[s].words.map(w => words[w].t));
  if (!ws.length || !/^\p{L}/u.test(ws[0])) return false;
  const nums = ws.filter(t => /\d/.test(t)).length;
  return nums <= Math.max(1, ws.length * 0.08) && ws.length >= 6;
}
/* ------------------------------ continuous flow ------------------------------
   The reader shows a window of consecutive chapters [S.win.a … S.win.z] as one seamless text with one
   merged model (global word / sentence indices). Chapters are appended as you approach the end (and
   prepended when you scroll above the first), so the whole book reads as one flow; playback runs on
   into the next chapter by itself. Positions are stored per chapter: { sec, w (word inside chapter) }. */
const mcache = new Map();
function secModel(i) {
  const b = S.book, k = `${b.id}:${i}:${b.lang}:${prefs.skip ? 1 : 0}:${b.sections[i].text.length}`;
  let m = mcache.get(k); if (!m) { m = buildModel(b.sections[i].text, b.lang, prefs.skip); mcache.set(k, m); if (mcache.size > 40) mcache.delete(mcache.keys().next().value); }
  return m;
}
function appendModel(M, i) {
  const m = secModel(i), w0 = M.words.length, s0 = M.sents.length, p0 = M.paras.length;
  for (const w of m.words) M.words.push({ ...w, s: w.s + s0 });
  for (const x of m.sents) M.sents.push({ ...x, words: x.words.map(v => v + w0), para: x.para + p0, sec: i });
  for (const x of m.paras) M.paras.push({ ...x, sents: x.sents.map(v => v + s0), sec: i });
  M.secs.push({ sec: i, w0, s0, p0, nW: m.words.length, nS: m.sents.length, nP: m.paras.length });
}
function buildWindowModel(a, z) { const M = { paras: [], sents: [], words: [], secs: [] }; for (let i = a; i <= z; i++) appendModel(M, i); return M; }
const secInfo = sec => S.model?.secs.find(x => x.sec === sec);
const toGlobal = (sec, w) => { const x = secInfo(sec); return x ? x.w0 + Math.min(Math.max(0, w), Math.max(0, x.nW - 1)) : -1; };
const toLocal = gw => { const x = S.model.secs.find(v => gw >= v.w0 && gw < v.w0 + v.nW) || S.model.secs[0]; return { sec: x.sec, w: gw - x.w0 }; };
/** exact reading place of global word gw → saved form (sentence start, chapter-local) */
const placeOf = gw => { if (!S.model.words[gw]) gw = Math.max(0, Math.min(S.model.words.length - 1, gw | 0)); const s = S.model.words[gw].s, w = S.model.sents[s].words[0], L = toLocal(w); return { sec: L.sec, w: L.w, at: Date.now() }; };
/* ------------------------------ the book's own structure ------------------------------ */
const normTitle = x => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
/** a title that really is the book's (not a filler: the book title repeated, "Chapter 7", "* * *") */
function realTitle(x, b = S.book) {
  const t = (x && x.title || '').trim();
  if (!t || normTitle(t) === normTitle(b.title) || /^[\s*·•—–\-.~#]+$/.test(t) || !normTitle(t)) return '';
  return t;
}
/** headings shown inside chapter i: [{ p: paragraph index, t, lvl }] */
function secHeads(i, b = S.book) {
  const x = b.sections[i]; if (!x) return [];
  if (x.heads) return x.heads;
  if (x.page != null) return []; // OCR pages flow on without dividers
  const t = realTitle(x, b); if (!t) return [];
  for (let k = i - 1; k >= 0; k--) { const pt = realTitle(b.sections[k], b); if (pt) return pt === t ? [] : [{ p: 0, t, lvl: 1 }]; }
  return [{ p: 0, t, lvl: 1 }];
}
/** the chapter a place belongs to (for the header line and the position card) */
function chapterName(sec = S.sec, lp = Infinity, b = S.book) {
  if (!b) return '';
  for (let i = sec; i >= 0; i--) {
    const x = b.sections[i]; if (!x) continue;
    const hs = (x.heads || secHeads(i, b)).filter(h => h.lvl <= 1 && (i < sec || h.p <= lp));
    if (hs.length) return hs[hs.length - 1].t;
    if (x.heads && x.title && i === sec && x.title !== b.title) return x.title;
    if (x.page != null) return b.title;
  }
  return b.title;
}
/** the book's Contents: [{ t, lvl, sec, p }] — exactly the book's headings (OCR books: their pages) */
function bookToc(b = S.book) {
  if (!b) return [];
  if (b._toc && b._toc.n === b.sections.length && b._toc.v === 2) return b._toc.list;
  const list = [];
  if (b.sections.some(x => x.heads)) b.sections.forEach((x, i) => (x.heads || []).forEach(h => list.push({ t: h.t, lvl: h.lvl, sec: i, p: h.p })));
  else if (b.sections.some(x => x.page != null)) b.sections.forEach((x, i) => list.push({ t: secLabel(x) || `${t('pageShort')} ${x.page}`, lvl: 2, sec: i, p: 0 }));
  else b.sections.forEach((x, i) => secHeads(i, b).forEach(h => list.push({ t: h.t, lvl: /^(часть|part|книга|book|том|volume)(?![\p{L}\p{N}])/iu.test(h.t) ? 0 : 1, sec: i, p: 0 })));
  Object.defineProperty(b, '_toc', { value: { n: b.sections.length, v: 2, list }, configurable: true, writable: true, enumerable: false });
  return list;
}
/** chapter-local index of the first word of paragraph p (Contents entries point at paragraphs) */
function paraWord(sec, p) {
  const m = secModel(sec);
  for (let k = Math.max(0, p); k < m.paras.length; k++) if (m.paras[k].sents.length) return m.sents[m.paras[k].sents[0]].words[0];
  return 0;
}
function headHtml(hs, atStart, i) {
  return `<div class="hd${atStart ? ' hd-start' : ''}${hs.some(h => h.lvl <= 1) ? ' hd-ch' : ''}" data-sec="${i}">` + hs.map(h => `<div class="h l${Math.min(2, h.lvl)}">${esc(h.t)}</div>`).join('') + (atStart && hs.some(h => h.lvl <= 1) ? '<div class="hd-orn"><i></i><b></b><i></i></div>' : '') + '</div>';
}
function secHtml(i) {
  const b = S.book, { paras, sents, words } = S.model, tr = trArr(), info = secInfo(i), heads = secHeads(i);
  let html = '', first = true;
  for (let lp = 0; lp < info.nP; lp++) {
    const hs = heads.filter(h => h.p === lp);
    if (hs.length) html += headHtml(hs, lp === 0, i);
    const p = paras[info.p0 + lp];
    if (!p.sents.length) continue;
    // a drop cap opens a chapter (or the book), never the continuation of one
    const dc = first && !p.skip && (i === 0 && lp === 0 || hs.some(h => h.lvl <= 1)) && dropCapOK(p, sents, words);
    first = false;
    html += `<p class="${dc ? 'first' : ''}${p.skip ? ' skip' : ''}">`;
    const firstW = sents[p.sents[0]].words[0];
    for (const s of p.sents) {
      html += `<span class="s" data-s="${s}">` + sents[s].words.map(w => {
        const wd = words[w], foot = !wd.say && /(?:\d|[¹²³⁴⁵⁶⁷⁸⁹⁰]|\[\d|\(\d|\{\d|\*|†|‡)/.test(wd.t);
        const cls = `w${dc && w === firstW ? ' dcw' : ''}${!wd.say ? (foot ? ' fn' : ' sk') : ''}${/^\(?(https?:|www\.)/i.test(wd.t) ? ' u' : ''}`;
        let inner = esc(wd.t);
        if (wd.say && wd.say !== wd.t && wd.t.startsWith(wd.say)) inner = esc(wd.say) + `<sup class="fn">${esc(wd.t.slice(wd.say.length))}</sup>`;
        return `<span class="${cls}" data-w="${w}">${inner}</span>`;
      }).map((h, k) => h + (words[sents[s].words[k]].ns ? '' : ' ')).join('').trimEnd() + '</span>';
      // the placeholder already takes about the room the translation will take, so its arrival barely moves the text
      const ph = tr[s] ? '' : ` style="min-height:${(Math.max(1, Math.ceil(sents[s].text.length * 0.95 / trCpl())) * 1.5).toFixed(1)}em"`;
      html += `<span class="tr${tr[s] ? '' : ' load'}"${ph} data-t="${s}" dir="auto" lang="${biOn() ? biTarget() : ''}">${tr[s] ? trHtml(tr[s]) : '·'}</span> `;
    }
    html += '</p>';
  }
  return `<div class="ch" data-sec="${i}">${html}</div>`;
}
function indexEls(root) {
  root.querySelectorAll('.w').forEach(el => { S.wordEls[+el.dataset.w] = el; });
  root.querySelectorAll('.s').forEach(el => { S.sentEls[+el.dataset.s] = el; });
}
function setHead() {
  const b = S.book;
  // the book's title page shows only above its very beginning
  $('#rdHead').hidden = !!(S.win && S.win.a > 0);
  $('#rdLabel').textContent = b.author || shelfName(b.shelf || 'mine');
  $('#rdTitle').textContent = b.title;
}
/** render the chapter window around S.sec; startWord is a global word index in the (new) window */
function renderSection(startWord = 0, scroll = true) {
  const b = S.book;
  if (!S.win || S.win.book !== b.id || S.sec < S.win.a || S.sec > S.win.z) S.win = { book: b.id, a: S.sec, z: S.sec };
  S.win.z = Math.min(S.win.z, b.sections.length - 1);
  S.curW = -1; S.curS = -1; // the old place belongs to the old text
  S.model = buildWindowModel(S.win.a, S.win.z);
  player.setModel(S.model, b.lang);
  setHead();
  const art = $('#rdText');
  art.innerHTML = Array.from({ length: S.win.z - S.win.a + 1 }, (_, k) => secHtml(S.win.a + k)).join('');
  art.lang = b.lang;
  S.wordEls = []; S.sentEls = []; indexEls(art);
  S.curW = -1; S.curS = -1;
  art.classList.toggle('bi', biOn()); art.classList.toggle('tronly', trOnly());
  art.insertAdjacentHTML('afterbegin', trOnly() ? `<div class="tr-banner"><span>${ICON.tr}${esc(t('readingIn').replace('{lang}', uiLang() === 'ru' ? langName(S.book.trTo, 'ru').toLowerCase() : langName(S.book.trTo, uiLang())))}</span><button id="trOrig">${t('showOriginal')}</button></div>` : '');
  if (trOnly()) $('#trOrig').onclick = e => { e.stopPropagation(); exitTrOnly(); };
  // translations arrive asynchronously and shift the layout; keep the floating highlight glued to its word
  if (!art._ro && window.ResizeObserver) { let raf = 0; art._ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (prefs.pages) layoutPages(); positionHL(true); }); }); art._ro.observe(art); }
  updateNextBtn(); updateOCRPill(b);
  const sw = Math.min(startWord, S.model.words.length - 1);
  setCurrent(Math.max(0, sw), false);
  $('#rdMini').textContent = chapterName(S.sec, curPara());
  if (prefs.pages) layoutPages();
  if (scroll) { if (sw > 0) scrollToWord(sw, false); else { $('#rdScroll').scrollTop = 0; $('#rdScroll').scrollLeft = 0; } }
  if (biOn()) ensureTranslations();
  updateProgress(); updateMarkBtn();
  if (prefs.focus) renderFocus(true);
  // the neighbouring chapters are rendered right away, so text is always there when the reader scrolls
  ensureWindow(); requestAnimationFrame(() => ensureWindow()); warmModels();
  // voices for this language
  S.voiceReady = syncVoice();
}
/** local paragraph index of the current place (for the chapter name in the header) */
function curPara() { const s = S.model?.sents[Math.max(0, S.curS)]; if (!s) return 0; const x = secInfo(s.sec); return x ? s.para - x.p0 : 0; }
/* ------------------------------ the window of rendered chapters ------------------------------
   Only a few chapters are in the DOM at a time (the one on screen, at least one before and after, and
   always several screens of text ahead / behind). Chapters are added and removed in place: kept chapters
   are not re-rendered (their word / sentence numbers are shifted), playback runs on undisturbed, and the
   text on screen stays exactly where it is (manual scroll anchoring — iOS Safari has none). */
function setWindow(a, z) {
  const b = S.book; if (!b || !S.win || !S.model) return false;
  a = Math.max(0, a); z = Math.min(b.sections.length - 1, z);
  const oa = S.win.a, oz = S.win.z;
  if (a > z || (a === oa && z === oz)) return false;
  const ka = Math.max(a, oa), kz = Math.min(z, oz);
  if (ka > kz) return false; // no overlap: callers re-render instead
  const sc = $('#rdScroll'), art = $('#rdText'), vr = sc.getBoundingClientRect();
  // anchor: the first paragraph of a kept chapter that is on screen (or nearest to it)
  let anchor = null, aPos = 0;
  for (const ch of art.querySelectorAll('.ch')) {
    const i = +ch.dataset.sec; if (i < ka || i > kz) continue;
    for (const el of ch.children) { const r = el.getBoundingClientRect(); if (prefs.pages ? r.right > vr.left : r.bottom > vr.top) { anchor = el; aPos = prefs.pages ? r.left : r.top; break; } }
    if (anchor) break;
  }
  if (!anchor) { const ch = art.querySelector(`.ch[data-sec="${ka}"]`); anchor = ch; aPos = ch ? (prefs.pages ? ch.getBoundingClientRect().left : ch.getBoundingClientRect().top) : 0; }
  const oi = secInfo(ka), M = buildWindowModel(a, z), ni = M.secs.find(x => x.sec === ka);
  const dw = ni.w0 - oi.w0, ds = ni.s0 - oi.s0, oldEnd = S.model.words.length;
  S.model = M; S.win.a = a; S.win.z = z;
  hidePop();
  art.querySelectorAll('.ch').forEach(el => { const i = +el.dataset.sec; if (i < a || i > z) el.remove(); });
  if (dw || ds) {
    art.querySelectorAll('.w').forEach(el => { el.dataset.w = +el.dataset.w + dw; });
    art.querySelectorAll('.s').forEach(el => { el.dataset.s = +el.dataset.s + ds; });
    art.querySelectorAll('.tr').forEach(el => { el.dataset.t = +el.dataset.t + ds; });
    rebaseTrans(ds);
  }
  const chs = art.querySelectorAll('.ch'), firstCh = chs[0], lastCh = chs[chs.length - 1];
  if (a < oa) firstCh.insertAdjacentHTML('beforebegin', Array.from({ length: oa - a }, (_, k) => secHtml(a + k)).join(''));
  if (z > oz) lastCh.insertAdjacentHTML('afterend', Array.from({ length: z - oz }, (_, k) => secHtml(oz + 1 + k)).join(''));
  S.wordEls = []; S.sentEls = []; indexEls(art);
  if (S.curW >= 0) S.curW += dw; if (S.curS >= 0) S.curS += ds;
  if (S.curW >= M.words.length || S.curW < -1 || (S.curW >= 0 && !M.words[S.curW])) { // its chapter left the window (reader scrolled far away)
    const vt = sc.getBoundingClientRect(); const el = S.sentEls.find(e => e && (prefs.pages ? e.getBoundingClientRect().right > vt.left : e.getBoundingClientRect().bottom > vt.top));
    const s0 = el ? +el.dataset.s : 0; S.curS = s0; S.curW = M.sents[s0].words[0];
  }
  player.rebase(M, dw, ds, z > oz ? oldEnd + dw : -1);
  setHead();
  // keep what's on screen exactly where it was
  if (anchor && anchor.isConnected) {
    const r = anchor.getBoundingClientRect(), d = prefs.pages ? r.left - aPos : r.top - aPos;
    if (Math.abs(d) > 0.5) { S.progScroll = Date.now(); if (prefs.pages) { const k = Math.round(d / pageW()); sc.scrollLeft += k * pageW(); if (S.pgTarget != null) S.pgTarget += k; } else sc.scrollTop += d; }
  }
  if (biOn()) ensureTranslations();
  if (prefs.focus) renderFocus(true);
  positionHL(true); // the highlight box lives in scroll coordinates: follow the moved text
  updateNextBtn(); updateProgress(); warmModels();
  return true;
}
/** keep enough text rendered around the reader: never a blank screen, never a wait */
function ensureWindow() {
  const b = S.book; if (!b || S.screen !== 'reader' || !S.win || !S.model || S.flowBusy) return;
  S.flowBusy = true;
  try {
    for (let guard = 0; guard < 6; guard++) {
      const sc = $('#rdScroll'), vr = sc.getBoundingClientRect(), H = prefs.pages ? (pageW() || innerWidth) : (sc.clientHeight || innerHeight);
      const chs = [...$('#rdText').querySelectorAll('.ch')]; if (!chs.length) return;
      const geo = chs.map(el => { const r = el.getBoundingClientRect(); return { sec: +el.dataset.sec, a: prefs.pages ? r.left - vr.left : r.top - vr.top, b: prefs.pages ? r.right - vr.left : r.bottom - vr.top }; });
      const last = geo[geo.length - 1], firstG = geo[0];
      const onScreen = geo.find(g => g.b > 0) || last;
      // the chapter being listened to stays rendered (the highlight lives there); in Read mode only what's on screen matters
      const curSec = (player.playing || player.paused) && S.curS >= 0 ? S.model.sents[S.curS]?.sec ?? S.sec : onScreen.sec;
      let a = S.win.a, z = S.win.z;
      // ahead: at least 4 screens of text and the next chapter after the one on screen
      if (z < b.sections.length - 1 && (last.b - H < H * 4 || z <= Math.max(onScreen.sec, curSec))) z++;
      // behind: at least 2 screens and the chapter before (added above without moving the text)
      else if (a > 0 && (-firstG.a < H * 2 || a >= onScreen.sec)) a--;
      else {
        // far away (and not the place being read): let it go, so the page stays light
        const keepLo = Math.min(onScreen.sec, curSec) - 1, keepHi = Math.max(onScreen.sec, curSec) + 1;
        const far = geo.filter(g => g.b < -H * 8 && g.sec < keepLo);
        if (far.length && far[far.length - 1].sec + 1 <= z) a = far[far.length - 1].sec + 1;
        const below = geo.filter(g => g.a > H * 10 && g.sec > keepHi);
        if (below.length) z = Math.max(a, below[0].sec - 1);
        if (a === S.win.a && z === S.win.z) return;
      }
      if (!setWindow(a, z)) return;
    }
  } finally { S.flowBusy = false; }
}
// legacy names (OCR, pages): grow the window by one chapter
function appendNext() { const z0 = S.win?.z; ensureWindow(); if (S.win && S.win.z === z0) setWindow(S.win.a, S.win.z + 1); return !!S.win && S.win.z !== z0; }
function prependPrev() { const a0 = S.win?.a; if (!S.win || a0 <= 0) return false; setWindow(a0 - 1, S.win.z); return S.win.a !== a0; }
function maybeExtend() { ensureWindow(); }
// idle time: prepare the models of the chapters around the window, so adding them later costs nothing
const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
function warmModels() { if (!S.book || !S.win) return; idle(() => { const b = S.book; if (!b || !S.win) return; for (const i of [S.win.z + 1, S.win.z + 2, S.win.a - 1]) if (b.sections[i]) secModel(i); }); }
function gotoSection(i, play) {
  if (!S.book || i < 0 || i >= S.book.sections.length) return;
  jumpTo(i, 0);
  if (play && !player.playing) startPlayback(S.curW);
}

function setCurrent(w, fromPlayer) {
  if (!S.model || w < 0 || !S.model.words[w]) return;
  const prev = S.curW; S.curW = w;
  const s = S.model.words[w].s;
  if (prev >= 0 && S.wordEls[prev]) S.wordEls[prev].classList.remove('cw');
  if (s !== S.curS) {
    if (S.curS >= 0 && S.sentEls[S.curS]) S.sentEls[S.curS].classList.remove('cs');
    S.curS = s; S.sentEls[s]?.classList.add('cs');
    if (biOn()) ensureTranslations();
    if (fromPlayer && player.engine?.prefetch) warmFirst();
    const sec = S.model.sents[s].sec ?? S.sec;
    const cn = chapterName(sec, curPara()); if ($('#rdMini').textContent !== cn) { $('#rdMini').textContent = cn; updateMediaSession(); }
    if (sec !== S.sec) {
      const was = S.sec; S.sec = sec;
      if (fromPlayer && sec > was && S.timer && S.timer.endOfChapter) setTimeout(() => stopTimer(true), 0); // "end of chapter" sleep timer
    }
    if (prefs.focus) renderFocus();
    updateProgress();
    if (fromPlayer) { S.book.pos = placeOf(w); savePosSoon(); updateMarkBtn(); }
  }
  const active = S.mode === 'listen' && (player.playing || player.paused);
  if (active) S.wordEls[w]?.classList.add('cw');
  positionHL();
  if (prefs.focus) focusWord(w);
  if (fromPlayer) autoScroll(w);
}
// rect of a word's own glyphs. The first word of a drop-cap paragraph carries the floated
// ::first-letter; engines disagree on whether the element's box includes that float (WebKit can
// return a box spanning the whole drop cap), so measure the text after the first letter with a Range.
function wordRect(el) {
  if (el.classList.contains('dcw') && getComputedStyle(el.closest('p'), '::first-letter').float !== 'none') { // only a floated cap (not bilingual / big type)
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.length > 1);
    if (tn) {
      const rg = document.createRange(); rg.setStart(tn, 1); rg.setEnd(tn, tn.length);
      const rs = rg.getClientRects(); if (rs.length) return { rects: rs, box: rg.getBoundingClientRect() };
    }
  }
  // a trailing footnote <sup> would stretch the line box; measure the spoken text node alone
  const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.data.trim());
  if (tn && el.querySelector('sup.fn')) {
    const rg = document.createRange(); rg.selectNodeContents(tn);
    const rs = rg.getClientRects(); if (rs.length) return { rects: rs, box: rg.getBoundingClientRect() };
  }
  return { rects: el.getClientRects(), box: el.getBoundingClientRect() };
}
/** typographic metrics for a font/size: x-height, cap-height, baseline — not the word's own extenders. */
function fontInk(cs) {
  const font = cs.font, fs = parseFloat(cs.fontSize) || 18;
  const canvas = fontInk._c || (fontInk._c = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  const key = font + '|' + fs;
  let m = fontInk._m?.get(key);
  if (!m) {
    ctx.font = font;
    const x = ctx.measureText('нnxх');
    const cap = ctx.measureText('НNHХ');
    m = {
      xh: x.actualBoundingBoxAscent || fs * 0.52,
      caph: cap.actualBoundingBoxAscent || fs * 0.7,
      fAsc: x.fontBoundingBoxAscent,
      fDesc: x.fontBoundingBoxDescent,
      fs
    };
    (fontInk._m || (fontInk._m = new Map())).set(key, m);
    if (fontInk._m.size > 40) fontInk._m.clear();
  }
  return m;
}
/** highlight box: x-height (letters without ascenders/descenders) equally padded above and below the baseline. */
function glyphBox(el, box) {
  const cs = getComputedStyle(el);
  const m = fontInk(cs);
  const fontH = (Number.isFinite(m.fAsc) && Number.isFinite(m.fDesc)) ? m.fAsc + m.fDesc : m.fs;
  const baseline = box.top + Math.max(0, (box.height - fontH) / 2) + (Number.isFinite(m.fAsc) ? m.fAsc : m.fs * 0.8);
  const ink = m.xh || m.caph || m.fs * 0.52;
  const pad = Math.max(4.5, m.fs * 0.28);
  const top = baseline - ink - pad, bottom = baseline + pad;
  return { left: box.left, top, width: box.width, height: Math.max(m.fs * 0.85, bottom - top), pad, fs: m.fs, baseline, ink };
}
let hlLast = null; // last placement, relative to #rdText: {x, y, w, h, el}
function positionHL(instant) {
  const hl = $('#hl'); if (!hl) return;
  const el = (S.trEl && S.trEl.isConnected && S.trEl) || S.wordEls[S.curW];
  const active = S.mode === 'listen' && (player.playing || player.paused) && el && el.isConnected;
  if (!active) { hl.classList.remove('on'); hlLast = null; return; }
  // a word broken across two lines (hyphenation) would make one huge box over both lines:
  // paint that word inline instead and park the floating box
  $$('#rdText .split').forEach(x => x !== el && x.classList.remove('split'));
  const { rects, box: r0 } = wordRect(el);
  if (rects.length > 1) { el.classList.add('split'); hl.classList.remove('on'); hlLast = null; return; }
  el.classList.remove('split');
  if (!r0.width && !r0.height) return; // not laid out (hidden / detached) — the watchdog retries
  const r = el.classList.contains('dcw') ? r0 : glyphBox(el, r0);
  // equal horizontal pad, shrunk if needed so the box never overlaps the neighbouring word
  const want = Math.max(4, Math.min(7, (parseFloat(getComputedStyle(el).fontSize) || 18) * 0.18));
  const sibs = el.parentElement ? [...el.parentElement.querySelectorAll('.w')] : [];
  const i = sibs.indexOf(el), mid = box => (box.top + box.bottom) / 2;
  const sameLine = (a, b) => a && Math.abs(mid(a) - mid(b)) < Math.min(a.height, b.height) * 0.55;
  const prevB = i > 0 ? sibs[i - 1].getBoundingClientRect() : null;
  const nextB = i < sibs.length - 1 ? sibs[i + 1].getBoundingClientRect() : null;
  const leftGap = sameLine(prevB, r0) ? r0.left - prevB.right : 24;
  const rightGap = sameLine(nextB, r0) ? nextB.left - r0.right : 24;
  const padX = Math.max(0.75, Math.min(want, leftGap / 2 - 0.5, rightGap / 2 - 0.5));
  // the box lives in the scroller (not in the text), so it works the same for the vertical flow and for pages
  const sc = $('#rdScroll'), sr = sc.getBoundingClientRect();
  const x = r.left - sr.left + sc.scrollLeft - padX, y = r.top - sr.top + sc.scrollTop, w = r.width + padX * 2, h = r.height;
  if (hlLast && hlLast.el === el && Math.abs(hlLast.x - x) < .5 && Math.abs(hlLast.y - y) < .5 && Math.abs(hlLast.w - w) < .5 && Math.abs(hlLast.h - h) < .5 && hl.classList.contains('on')) return;
  // gliding is only for the next word on the same line; moving to another line (or out of a
  // hidden state, or after a reflow of the same word) jumps, so the box never travels diagonally
  // across the text — that mid-flight box is what looked "misplaced" next to the drop cap
  const jump = instant || !hlLast || !hl.classList.contains('on') || hlLast.el === el || Math.abs(hlLast.y - y) > h * 0.5;
  if (jump) hl.style.transition = 'none';
  hl.style.transform = `translate(${x}px, ${y}px)`;
  hl.style.width = w + 'px'; hl.style.height = h + 'px';
  hl.classList.add('on');
  if (jump) { hl.offsetWidth; hl.style.transition = ''; }
  hlLast = { x, y, w, h, el };
}
// Anything that reflows the text without resizing #rdText (a late web-font subset such as the
// Cyrillic drop-cap face, controls hiding, OCR pages arriving, size animations) would leave the
// box behind; while the highlight is live, re-check the word's position a few times a second.
setInterval(() => { if (S.screen === 'reader' && S.mode === 'listen' && (player.playing || player.paused) && !document.hidden) positionHL(); }, 200);
function setMode(...a) { return setMode_(...a); }
/* ------------------------------ scrolling & pages ------------------------------ */
const pageW = () => $('#rdScroll').clientWidth || innerWidth;
function pageInfo() { const sc = $('#rdScroll'), pw = pageW(); return { i: Math.round(sc.scrollLeft / pw), n: Math.max(1, Math.round(($('#rdFlow').scrollWidth) / pw)), pw }; }
const pageOfEl = el => { const sc = $('#rdScroll'), r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect(); return Math.max(0, Math.floor((r.left + r.width / 2 - sr.left + sc.scrollLeft) / pageW())); };
function pageTo(n, smooth = true) {
  const sc = $('#rdScroll'), pg = pageInfo(); n = Math.max(0, Math.min(pg.n - 1, n));
  S.progScroll = Date.now(); S.pgTarget = n; S.pgAt = smooth ? Date.now() : 0; sc.scrollTo({ left: n * pg.pw, behavior: smooth ? 'smooth' : 'auto' });
  const user = Date.now() - S.lastUserScroll < 1000;
  setTimeout(() => { updateProgress(); maybeExtend(); if (user && S.mode === 'read' && !player.playing) { S.progScroll = 0; readPosSoon(); } }, smooth ? 420 : 0);
}
/** pages: one column per screen width (set as a CSS variable, so text size / bars / rotation re-paginate) */
function layoutPages() {
  if (!prefs.pages) return;
  const sc = $('#rdScroll'); sc.scrollTop = 0;
  const pwChanged = S.lastPw !== pageW(); S.lastPw = pageW();
  sc.style.setProperty('--pw', pageW() + 'px');
  // the column height is constant: dock / player overlay the page (with .rd-fade) so showing
  // or hiding the controls never shifts the text
  sc.style.setProperty('--pg-b', 'calc(24px + var(--safe-b))');
  const el = S.wordEls[S.curW]; if (el && (pwChanged || player.playing || player.paused) && !(S.pgAt && Date.now() - S.pgAt < 450)) { const p = pageOfEl(el); if (p !== pageInfo().i) pageTo(p, false); }
  updateProgress();
}
function scrollEl(el, smooth = true) {
  if (prefs.pages) return pageTo(pageOfEl(el), smooth);
  const sc = $('#rdScroll'); const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.33;
  // far jumps go straight there: a long smooth glide would run through chapters that are being added/removed under it
  if (smooth && Math.abs(top - sc.scrollTop) > sc.clientHeight * 1.5) smooth = false;
  S.progScroll = Date.now(); sc.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  if (!smooth) { ensureWindow(); requestAnimationFrame(() => { const t2 = el.isConnected ? el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.33 : null; if (t2 != null && Math.abs(t2 - sc.scrollTop) > 2) { S.progScroll = Date.now(); sc.scrollTop = Math.max(0, t2); } positionHL(true); }); }
}
function scrollToWord(w, smooth = true) {
  const el = S.wordEls[w]; if (!el) return;
  scrollEl(el, smooth);
}
function autoScroll(w) {
  if (prefs.focus) return;
  const el = S.wordEls[w], sc = $('#rdScroll'); if (!el) return;
  if (prefs.pages) {
    const p = pageOfEl(el);
    if (p === pageInfo().i) return;
    if (Date.now() - S.lastUserScroll < 4000) { $('#recenter').classList.add('show'); return; }
    return pageTo(p); // the highlight reached the next page: turn it
  }
  followEl(el);
}
/** auto-follow: the page stays still while the spoken line is in the comfortable zone; only when it reaches the
    bottom quarter (or leaves the screen) one smooth scroll brings it to the upper third. Never under a finger. */
function followEl(el) {
  const sc = $('#rdScroll');
  if (S.touching || Date.now() - S.lastUserScroll < 4000) { $('#recenter').classList.add('show'); return; }
  const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
  const H = sc.clientHeight, lh = el.getBoundingClientRect().height || 24;
  if (y < 0 || y + lh > H * 0.75) { if (S.autoScrolling && Date.now() - S.autoScrolling < 700) return; S.autoScrolling = Date.now(); S.autoScrolls = (S.autoScrolls || 0) + 1; scrollEl(el); }
}
$('#recenter').onclick = () => { S.lastUserScroll = 0; $('#recenter').classList.remove('show'); scrollToWord(S.curW); };
['touchstart', 'wheel'].forEach(ev => $('#rdScroll').addEventListener(ev, () => { S.lastUserScroll = Date.now(); S.lastInteract = Date.now(); }, { passive: true }));
// a finger on the text: auto-follow never moves the page under it
$('#rdScroll').addEventListener('touchstart', () => { S.touching = true; }, { passive: true });
['touchend', 'touchcancel'].forEach(ev => $('#rdScroll').addEventListener(ev, () => { S.touching = false; S.lastUserScroll = Date.now(); }, { passive: true }));
$('#rdScroll').addEventListener('scroll', () => {
  if (S.selecting || S.selDragging) positionHandles(); else hidePop();
  if (prefs.pages && $('#rdScroll').scrollTop) $('#rdScroll').scrollTop = 0; // pages never scroll vertically (scrollIntoView, focus…)
  // only the reader's own scrolling moves the reading place (not our jumps / auto-follow)
  if (S.mode === 'read' && !player.playing && Date.now() - (S.progScroll || 0) > 900) readPosSoon();
  if (Date.now() - S.lastUserScroll > 4000) $('#recenter').classList.remove('show');
  if (prefs.pages) updateProgressSoon();
  // close to the edge of what's rendered: add text in this very frame, never a blank screen
  { const sc = $('#rdScroll'); const H = sc.clientHeight; if (!prefs.pages && (sc.scrollTop + H * 3 > sc.scrollHeight || sc.scrollTop < H * 1.5 && S.win && S.win.a > 0)) ensureWindow(); else flowSoon(); }
}, { passive: true });
let flowRaf = 0; const flowSoon = () => { if (!flowRaf) flowRaf = requestAnimationFrame(() => { flowRaf = 0; ensureWindow(); }); };
const updateProgressSoon = debounce(() => updateProgress(), 100);
// pages: the column follows the finger live, then snaps with momentum / a halfway threshold
(() => {
  const sc = $('#rdScroll');
  let x0 = null, y0 = 0, t0 = 0, l0 = 0, axis = null, lastX = 0, lastT = 0, vel = 0, dragging = false, raf = 0;
  const vw = () => pageW();
  const clampLeft = (x) => {
    const pw = vw(), max = Math.max(0, ($('#rdFlow').scrollWidth || pw) - pw);
    return Math.max(0, Math.min(max, x));
  };
  const live = (left) => {
    sc.scrollLeft = clampLeft(left);
    S.progScroll = Date.now();
    if (S.mode === 'listen') positionHL(true);
  };
  sc.addEventListener('touchstart', e => {
    if (!prefs.pages) return;
    if (S.selecting || S.selDragging) { x0 = null; return; }
    const t = e.touches[0];
    x0 = lastX = t.clientX; y0 = t.clientY; t0 = lastT = Date.now(); l0 = sc.scrollLeft; axis = null; vel = 0; dragging = false;
    if (S.pgAnim) { cancelAnimationFrame(S.pgAnim); S.pgAnim = 0; }
  }, { passive: true });
  sc.addEventListener('touchmove', e => {
    if (!prefs.pages || x0 === null) return;
    if (S.selecting || S.selDragging) { x0 = null; return; }
    const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (!axis) {
      if (Math.hypot(dx, dy) < 8) return;
      axis = Math.abs(dx) > Math.abs(dy) * 1.05 ? 'x' : 'y';
    }
    if (axis !== 'x') return;
    e.preventDefault();
    dragging = true; S.touching = true; S.lastUserScroll = Date.now(); S.lastInteract = Date.now();
    const now = Date.now(), ddx = t.clientX - lastX, dt = Math.max(8, now - lastT);
    vel = ddx / dt; lastX = t.clientX; lastT = now;
    live(l0 - dx);
  }, { passive: false });
  const snapTo = (n, velX = 0) => {
    const pw = vw();
    n = Math.max(0, Math.min(pageInfo().n - 1, n));
    const from = sc.scrollLeft, to = n * pw, dist = to - from;
    if (Math.abs(dist) < 1) { sc.scrollLeft = to; S.pgTarget = n; updateProgress(); maybeExtend(); return; }
    const speed = Math.min(2.4, Math.max(0.7, Math.abs(velX) * 900 / Math.max(80, Math.abs(dist))));
    const dur = Math.max(180, Math.min(420, Math.abs(dist) / (pw * speed) * 380));
    const t0s = performance.now();
    S.pgTarget = n; S.pgAt = Date.now(); S.progScroll = Date.now();
    const step = now => {
      const u = Math.min(1, (now - t0s) / dur);
      const e = 1 - Math.pow(1 - u, 3);
      sc.scrollLeft = from + dist * e;
      if (S.mode === 'listen') positionHL(true);
      if (u < 1) S.pgAnim = requestAnimationFrame(step);
      else { S.pgAnim = 0; sc.scrollLeft = to; updateProgress(); maybeExtend(); if (S.mode === 'read' && !player.playing) { S.progScroll = 0; readPosSoon(); } }
    };
    if (S.pgAnim) cancelAnimationFrame(S.pgAnim);
    S.pgAnim = requestAnimationFrame(step);
  };
  const endDrag = (t) => {
    if (!prefs.pages || x0 === null) return;
    const was = dragging; const dx = (t ? t.clientX : lastX) - x0; const axisX = axis === 'x';
    x0 = null; axis = null; dragging = false; S.touching = false;
    if (!axisX || S.selecting || S.selDragging) return;
    S.swiped = Date.now(); S.lastUserScroll = Date.now();
    const pw = vw(), pos = sc.scrollLeft, i = Math.round(l0 / pw);
    // if they dragged toward a missing prev/next chapter, grow the window first
    if (dx > 40 && i === 0) { if (prependPrev()) requestAnimationFrame(() => snapTo(pageInfo().i - 1, vel)); else snapTo(0, vel); return; }
    if (dx < -40 && i >= pageInfo().n - 1) { if (!appendNext()) { snapTo(i, vel); return; } }
    const ni = pageInfo();
    const progress = (pos - i * pw) / pw; // -1..1 relative to start page, after possible prepend
    const start = Math.round(l0 / pw);
    let target = start;
    if (Math.abs(vel) > 0.35) target = vel < 0 ? start + 1 : start - 1;
    else if (Math.abs((pos / pw) - start) > 0.28) target = pos / pw > start ? start + 1 : start - 1;
    snapTo(target, vel);
  };
  sc.addEventListener('touchend', e => endDrag(e.changedTouches[0]));
  sc.addEventListener('touchcancel', e => endDrag(e.changedTouches[0]));
  let wl = 0;
  sc.addEventListener('wheel', e => { if (!prefs.pages) return; e.preventDefault(); if (Date.now() - wl < 450) return; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (Math.abs(d) < 8) return; wl = Date.now(); turnPage(d > 0 ? 1 : -1); }, { passive: false });
  addEventListener('keydown', e => {
    if (S.screen !== 'reader' || $('#sheet').classList.contains('show') || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
    if (prefs.pages && (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' && !e.shiftKey && S.mode === 'read')) { e.preventDefault(); turnPage(1); }
    else if (prefs.pages && (e.key === 'ArrowLeft' || e.key === 'PageUp')) { e.preventDefault(); turnPage(-1); }
  });
})();
function turnPage(d) {
  S.lastUserScroll = Date.now(); S.lastInteract = Date.now();
  const pg = pageInfo();
  // quick taps/swipes: count from the page we are already sliding to, not from the middle of the slide
  if (S.pgAt && Date.now() - S.pgAt < 450 && S.pgTarget != null) pg.i = S.pgTarget;
  if (d < 0 && pg.i === 0) { if (prependPrev()) requestAnimationFrame(() => pageTo(pageInfo().i - 1)); return; }
  if (d > 0 && pg.i >= pg.n - 1) { if (!appendNext()) return; }
  pageTo(pg.i + d);
}
function setPages(on) {
  prefs.pages = on; savePrefs();
  const w = S.curW;
  $('#reader').classList.toggle('pages', on);
  const sc = $('#rdScroll'); sc.scrollLeft = 0;
  if (on) layoutPages();
  requestAnimationFrame(() => { if (S.curW >= 0 && w >= 0) scrollToWord(S.curW, false); positionHL(true); updateProgress(); });
}
const readPosSoon = debounce(() => {
  // first sentence visible (top third of the screen, or the current page) → reading position
  const sc = $('#rdScroll'), sr = sc.getBoundingClientRect(), top = sr.top + 90;
  if (prefs.pages) { // the first word on this page (a sentence may have started on the previous one)
    const w = S.wordEls.findIndex(el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width && r.left >= sr.left - 2 && r.left < sr.right - 2; });
    if (w >= 0) { const s = S.model.words[w].s; S.curW = w; S.curS = s; S.sec = S.model.sents[s].sec ?? S.sec; $('#rdMini').textContent = chapterName(S.sec, curPara()); S.book.pos = placeOf(w); savePos(); updateMarkBtn(); updateProgress(); }
    return;
  }
  for (const el of S.sentEls) {
    if (!el) continue; const r = el.getBoundingClientRect();
    if (prefs.pages ? r.right > sr.left + 2 && r.left < sr.right : r.bottom > top) { const s = +el.dataset.s; const w = S.model.sents[s].words[0]; S.curW = w; S.curS = s; S.sec = S.model.sents[s].sec ?? S.sec; $('#rdMini').textContent = chapterName(S.sec, curPara()); S.book.pos = placeOf(w); savePos(); updateMarkBtn(); updateProgress(); break; }
  }
}, 250);
const savePos = () => { if (S.book) db.set('books', S.book.id, S.book); };
const savePosSoon = debounce(savePos, 1500);
// leaving the app (home screen, app switcher, tab close): write the exact place immediately
const savePosNow = () => { if (S.book && S.screen === 'reader' && S.model && S.curS >= 0) { S.book.pos = placeOf(S.model.sents[S.curS].words[0]); savePos(); } };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePosNow(); });
window.addEventListener('pagehide', savePosNow);
window.addEventListener('resize', () => { positionHL(true); positionHandles(); });
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => { positionHL(true); positionHandles(); });
  visualViewport.addEventListener('scroll', () => { positionHL(true); positionHandles(); });
}
$('#app').addEventListener('scroll', () => { $('#app').scrollLeft = 0; $('#app').scrollTop = 0; });
document.fonts && document.fonts.ready.then(() => positionHL(true));
document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => requestAnimationFrame(() => positionHL(true)));

function updateProgress() {
  if (!S.model) return;
  const n = S.model.sents.length, s = Math.max(0, S.curS);
  $('#pBar').style.width = $('#thinProg i').style.width = ((s + 1) / n * 100) + '%';
  $('#pPos').textContent = `${s + 1} / ${n}`;
  const left = S.model.words.length - (S.curW > 0 ? S.curW : 0);
  const min = Math.max(1, Math.round(left / (2.55 * player.rate) / 60));
  $('#pLeft').textContent = `${S.book.sections.length > 1 ? (S.sec + 1) + ' ' + t('chapterOf') + ' ' + S.book.sections.length + ' · ' : ''}~${min} ${t('min')}`;
  const bp = bookProg();
  const pg = prefs.pages ? pageInfo() : null;
  $('#rdNavPct').textContent = pg ? `${t('pageShort')} ${pg.i + 1} / ${pg.n} · ${fmtPct(bp.f)}` : `${fmtPct(bp.f)} · ${fmtLeft(bp.left)}`;
  $('#rdNavBar').style.width = (bp.f * 100).toFixed(1) + '%';
}
/* ------------------------------ whole-book position ------------------------------ */
// word counts per chapter (cached per book + chapter count, so OCR books growing page by page stay right)
function secWords(b = S.book) {
  if (!b) return [];
  if (!b._sw || b._sw.n !== b.sections.length) b._sw = { n: b.sections.length, w: b.sections.map(x => Math.max(1, wc(x.text))) };
  return b._sw.w;
}
/** fraction read (0..1) at chapter `sec`, word `w` (defaults: the current place) and minutes left at the current speed */
function bookProg(sec = S.sec, w = S.curW, b = S.book) {
  const sw = secWords(b), tot = sw.reduce((a, x) => a + x, 0) || 1;
  const before = sw.slice(0, sec).reduce((a, x) => a + x, 0);
  const si = S.model && secInfo(sec), lw = si && w >= 0 && sec === S.sec ? w - si.w0 : 0;
  const inSec = si ? Math.max(0, lw) / Math.max(1, si.nW) : 0;
  const done = before + inSec * (sw[sec] || 0);
  return { f: Math.min(1, done / tot), left: Math.max(0, tot - done) / (2.55 * (player.rate || 1)) / 60 };
}
const fmtPct = f => Math.floor(f * 100 + 1e-6) + '%';
const fmtLeft = m => m < 1 ? '<1 ' + t('min') : m < 60 ? `~${Math.round(m)} ${t('min')}` : `~${Math.floor(m / 60)} ${t('hrs')} ${Math.round(m % 60)} ${t('min')}`;
/** jump to chapter `sec` at fraction `frac` of it (snapped to a sentence start); playback continues from there */
function jumpTo(sec, frac = 0, w = null) {
  const b = S.book; if (!b || !b.sections[sec]) return;
  const wasPlaying = player.playing || S.mode === 'listen' && player.paused;
  player.stop();
  if (!S.model || !secInfo(sec)) { S.sec = sec; S.win = null; renderSection(0, false); }
  const si = secInfo(sec);
  let wi = si.w0 + (w != null ? w : Math.round(frac * Math.max(0, si.nW - 1)));
  wi = Math.max(si.w0, Math.min(si.w0 + si.nW - 1, wi));
  wi = S.model.sents[S.model.words[wi].s].words[0];
  setCurrent(wi, false); S.lastUserScroll = 0;
  S.sec = sec; b.pos = placeOf(wi); savePos(); updateMarkBtn(); updateProgress();
  scrollToWord(wi, false); ensureWindow();
  requestAnimationFrame(() => { if (S.curW >= 0) scrollToWord(S.curW, false); });
  if (wasPlaying) startPlayback(S.curW);
}
/** fraction of the whole book → { sec, frac } */
function locate(f) {
  const sw = secWords(), tot = sw.reduce((a, x) => a + x, 0) || 1; let acc = 0, target = f * tot;
  for (let i = 0; i < sw.length; i++) { if (target <= acc + sw[i] || i === sw.length - 1) return { sec: i, frac: Math.max(0, Math.min(1, (target - acc) / sw[i])) }; acc += sw[i]; }
  return { sec: 0, frac: 0 };
}
// stored generic labels are English ("Chapter 3"): show them in the UI language
const secLabel = x => { const m = /^Chapter (\d+)$/.exec(x.label || ''); return m ? t('chapterN').replace('{n}', m[1]) : (x.label || ''); };
const genericLabel = x => /^Chapter \d+$/.test(x.label || '');
const secName = (x, i, b = S.book) => chapterName(i, Infinity, b);


/* ------------------------------ distraction-free (bare) mode ------------------------------ */
function setBare(on, save = true) {
  prefs.bare = !!on; if (save) savePrefs();
  $('#reader').classList.toggle('bare', prefs.bare);
  const b = $('#rdChrome'); b.setAttribute('aria-pressed', prefs.bare); b.setAttribute('aria-label', prefs.bare ? t('showControls') : t('hideControls'));
  if (prefs.bare) hidePop();
}
$('#rdChrome').onclick = e => { e.stopPropagation(); setBare(!prefs.bare); hint('bare'); };
// tap on an empty part of the page toggles the controls; taps on words keep seeking / opening the popover
let tapSel = '';
$('#rdScroll').addEventListener('pointerdown', () => { tapSel = String(getSelection() || ''); });
$('#rdScroll').addEventListener('click', e => {
  if (Date.now() - (S.suppressTap || 0) < 600) { e.preventDefault(); e.stopPropagation(); return; }
  if (e.target.closest('.w, .tw, button, a, input, select, #rdNext, .tronly .tr, .sel-handle')) return;
  if ($('#pop').classList.contains('show')) return hidePop();
  if (tapSel || String(getSelection() || '')) return;
  setBare(!prefs.bare);
});
/* one-time hints */
function hideHint() {
  const c = $('#coach'); if (c) c.classList.remove('show');
  clearTimeout(S.coachT);
  const toastEl = $('#toast'); if (toastEl) toastEl.classList.remove('show');
  clearTimeout(toastT);
}
const uiBusy = () => !!(
  $('#sheet')?.classList.contains('show') ||
  $('#pop')?.classList.contains('show') ||
  $('#ask')?.classList.contains('show') ||
  S.selRange || S.selecting
);
function hint(k, msg) {
  prefs.hints = prefs.hints || {}; if (prefs.hints[k]) return false;
  if (uiBusy()) return false; // don't consume the hint if a sheet/popup is in the way
  prefs.hints[k] = 1; savePrefs();
  if (msg) { const c = $('#coach'); c.innerHTML = msg; c.classList.add('show'); clearTimeout(S.coachT); S.coachT = setTimeout(() => c.classList.remove('show'), 5200); c.onclick = () => c.classList.remove('show'); }
  return true;
}

/* tap on text */
$('#rdText').addEventListener('click', e => {
  if (Date.now() - (S.suppressTap || 0) < 600) { e.preventDefault(); e.stopPropagation(); return; }
  const trl = trOnly() && e.target.closest('.tr[data-t]');
  if (trl && S.mode === 'listen') { const s0 = +trl.dataset.t; unlockAudio(); S.lastUserScroll = 0; startPlayback(S.model.sents[s0].words[0]); return; }
  const w = e.target.closest('.w'); if (!w) return;
  const wi = +w.dataset.w;
  S.lastInteract = Date.now();
  if (S.mode === 'listen') { unlockAudio(); S.lastUserScroll = 0; startPlayback(wi); return; }
  showPop(+w.closest('.s').dataset.s, w);
});

/* ------------------------------ popover & multi-sentence selection ------------------------------ */
function rangeText(a, b) { return S.model.sents.slice(a, b + 1).map(s => s.text.trim()).join(' '); }
function shareBody(text) {
  const author = (S.book?.author || '').trim(), title = (S.book?.title || 'Murmur').trim();
  return `${text}\n\n— ${[author, title].filter(Boolean).join(', ')}`;
}
async function shareSelection(text) {
  const body = shareBody(text);
  try { if (navigator.share) { await navigator.share({ text: body }); return 'shared'; } }
  catch (e) { if (e && e.name === 'AbortError') return 'abort'; }
  try { await navigator.clipboard.writeText(body); toast(t('copied')); return 'copied'; }
  catch { toast('✕'); return 'fail'; }
}
function applySel(a, b) {
  if (a > b) [a, b] = [b, a];
  S.selRange = { a, b };
  $$('#rdText .s.sel').forEach(x => x.classList.remove('sel'));
  for (let i = a; i <= b; i++) S.sentEls[i]?.classList.add('sel');
  positionHandles();
}
function scrollerXY(clientX, clientY) {
  const sc = $('#rdScroll'), sr = sc.getBoundingClientRect();
  return { x: clientX - sr.left + sc.scrollLeft, y: clientY - sr.top + sc.scrollTop };
}
/** first/last word box of a sentence — word spans, not ::first-letter Range quirks. */
function sentEdgeRect(node, end) {
  if (!node || !node.isConnected) return null;
  const words = node.querySelectorAll('.w');
  const el = words.length ? words[end ? words.length - 1 : 0] : node;
  const recs = el.getClientRects();
  if (recs.length) return recs[end ? recs.length - 1 : 0];
  const box = el.getBoundingClientRect();
  if (box.width || box.height) return box;
  const all = node.getClientRects();
  return all.length ? (end ? all[all.length - 1] : all[0]) : box;
}
function positionHandles() {
  const a = $('#selA'), b = $('#selB'), r = S.selRange;
  if (!a || !b) return;
  if (!r || !$('#pop').classList.contains('show')) { a.classList.remove('on'); b.classList.remove('on'); a.hidden = true; b.hidden = true; return; }
  const size = 22;
  const place = (el, sent, end) => {
    const node = S.sentEls[sent]; const box = sentEdgeRect(node, end);
    if (!box || !(box.width + box.height)) { el.classList.remove('on'); el.hidden = true; return; }
    const p = scrollerXY(end ? box.right : box.left, end ? box.bottom : box.top);
    el.style.transform = `translate(${p.x - size / 2}px, ${p.y - size / 2}px)`;
    el.hidden = false; el.classList.add('on');
  };
  place(a, r.a, false); place(b, r.b, true);
}
function showPop(s, anchor, endS = s) {
  const a = Math.min(s, endS), b = Math.max(s, endS);
  applySel(a, b);
  const pop = $('#pop');
  hideHint();
  pop.innerHTML = `<div class="trbox" id="popTr"></div>
    <button data-a="listen">${ICON.headph}<span>${t('listenFromShort')}</span></button>
    <button data-a="quote">${ICON.quote}<span>${t('saveQuoteShort')}</span></button>
    <button data-a="share">${ICON.share}<span>${t('shareAction')}</span></button>
    <button data-a="copy">${ICON.copy}<span>${t('copyShort')}</span></button>
    <button data-a="tr">${ICON.tr}<span>${t('translateShort')}</span></button><i class="ptr"></i>`;
  const r = (anchor || S.sentEls[a]).getBoundingClientRect(); pop.classList.remove('below');
  pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('show');
  const margin = 12, vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
  pop.style.left = margin + 'px';
  pop.style.right = margin + 'px';
  pop.style.width = 'auto';
  const pw = pop.offsetWidth, ph = pop.offsetHeight, x = margin;
  let y = r.top - ph - 12;
  if (y < 70) { y = r.bottom + 12; pop.classList.add('below'); }
  y = Math.max(8, Math.min(y, vh - ph - 8));
  pop.style.top = y + 'px';
  pop.querySelector('.ptr').style.left = Math.min(pw - 20, Math.max(8, r.left + r.width / 2 - x - 6)) + 'px';
  positionHandles();
  const text = rangeText(a, b);
  pop.onclick = async ev => {
    const btn = ev.target.closest('button'); if (!btn) return;
    const act = btn.dataset.a;
    if (act === 'listen') { hidePop(); unlockAudio(); setMode('listen'); startPlayback(S.model.sents[a].words[0]); }
    if (act === 'quote') { await saveQuote(text); hidePop(); toast(t('quoteSaved')); }
    if (act === 'share') { const r = await shareSelection(text); if (r !== 'abort') hidePop(); }
    if (act === 'copy') { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast('✕'); } hidePop(); }
    if (act === 'tr') {
      const box = pop.querySelector('#popTr'); box.textContent = t('translating'); box.classList.add('show');
      const to = biTarget(); const [tx] = await translateMany([text], S.book.lang, to).catch(() => [null]);
      box.textContent = tx || t('translationFail');
    }
  };
}
function hidePop() {
  $('#pop').classList.remove('show');
  $$('.s.sel').forEach(x => x.classList.remove('sel'));
  S.selRange = null;
  ['#selA', '#selB'].forEach(id => { const el = $(id); if (el) { el.hidden = true; el.classList.remove('on'); } });
}
document.addEventListener('click', e => { if (!e.target.closest('#pop') && !e.target.closest('#rdText') && !e.target.closest('.sel-handle')) hidePop(); });

// long-press a sentence, then drag to extend by whole sentences; handles at the ends adjust the range
(() => {
  const sc = $('#rdScroll');
  let timer = 0, x0 = 0, y0 = 0, s0 = -1, armed = false, pid = 0;
  const sentAt = (x, y) => { const n = document.elementFromPoint(x, y)?.closest?.('#rdText .s'); return n ? +n.dataset.s : -1; };
  const clear = () => { if (timer) { clearTimeout(timer); timer = 0; } };
  const arm = (s, el) => { armed = true; S.selecting = true; S.suppressTap = Date.now(); try { navigator.vibrate?.(8); } catch {} showPop(s, el, s); };
  const onMove = e => {
    if (pid && e.pointerId !== pid) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (timer && Math.hypot(dx, dy) > 8) { clear(); return; } // scroll or page swipe — not a selection
    if (!armed) return;
    S.suppressTap = Date.now();
    const s = sentAt(e.clientX, e.clientY); if (s >= 0) showPop(s0, S.sentEls[s] || S.sentEls[s0], s);
  };
  const onUp = e => {
    if (pid && e.pointerId !== pid) return;
    if (armed) S.suppressTap = Date.now();
    clear(); armed = false; pid = 0; S.selecting = !!S.selDragging;
  };
  sc.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest?.('.sel-handle, button, a, input, select, #pop')) return;
    const sEl = (e.target.nodeType === 3 ? e.target.parentElement : e.target)?.closest?.('#rdText .s');
    if (!sEl) { clear(); return; }
    x0 = e.clientX; y0 = e.clientY; s0 = +sEl.dataset.s; armed = false; pid = e.pointerId; clear();
    try { sc.setPointerCapture(e.pointerId); } catch {}
    timer = setTimeout(() => { timer = 0; arm(s0, sEl); }, 450);
  });
  // document-level so a drag past the sentence / a missed capture still extends the range
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', e => { if (!armed) onUp(e); else { clear(); /* keep the selection, just end the drag */ armed = false; pid = 0; S.suppressTap = Date.now(); } });
  sc.addEventListener('touchmove', e => { if (armed || S.selDragging) e.preventDefault(); }, { passive: false });
  const wire = (el, which) => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch {}
      S.selDragging = which; S.selecting = true; S.suppressTap = Date.now();
    });
    document.addEventListener('pointermove', e => {
      if (S.selDragging !== which || !S.selRange) return;
      const s = sentAt(e.clientX, e.clientY); if (s < 0) return;
      const a = which === 'a' ? s : S.selRange.a, b = which === 'b' ? s : S.selRange.b;
      showPop(a, S.sentEls[Math.max(a, b)] || S.sentEls[a], b);
    });
    const end = () => { if (S.selDragging !== which) return; S.selDragging = null; S.selecting = false; S.suppressTap = Date.now(); };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  };
  wire($('#selA'), 'a'); wire($('#selB'), 'b');
})();

/* ------------------------------ modes & playback ------------------------------ */
function setMode_(m, silent) {
  S.mode = m;
  $('#dSeg').classList.toggle('listen', m === 'listen');
  $$('#dSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#player').classList.toggle('show', m === 'listen');
  $('#rdText').classList.toggle('listening', m === 'listen');
  if (m === 'read') { player.stop(); $$('.w.cw').forEach(x => x.classList.remove('cw')); }
  positionHL();
  if (!silent) hidePop();
}
$('#dSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.mode === 'listen') { unlockAudio(); warmFirst(); } setMode(b.dataset.mode); };

function engine() {
  if (prefs.engine === 'device') return device;
  if (S.neuralOk) return neural;                                         // relay online: any text
  if (S.book && S.staticBooks && S.staticBooks.has(S.book.id)) return neural; // pre-voiced sample book
  if (S.neuralFailed) return device;                                      // temporary playback fallback only
  return device;
}
function voiceKey(lang, eng = engine()) { return eng.id + ':' + lang; }
async function syncVoice() {
  if (!S.book) return;
  const eng = engine(); player.engine = eng; player.rate = prefs.rate;
  const vs = await eng.voices().catch(() => []);
  const v = voiceForLang(S.book.lang, eng, vs);
  player.voice = v;
  // mixed-language books: a sentence in another language gets a voice of that language
  player.voiceFor = l => voiceForLang(l, eng, vs);
  const vo = vs.find(x => x.id === (trOnly() ? voiceForLang(S.book.trTo, eng, vs) : v));
  $('#pVoice .v').textContent = vo ? vo.name : '—';
  $('#pVoice .dot').classList.toggle('neural', eng.id === 'neural');
  $('#pSpeed').textContent = fmtRate(prefs.rate);
  if (biOn()) await setupBilingualVoice(); else player.bilingual = null;
}
async function setupBilingualVoice() {
  const eng = engine(), to = biTarget(), vs = await eng.voices().catch(() => []);
  const v = voiceForLang(to, eng, vs);
  // translations are new text: without a relay, neural can't voice them, so the device voice reads them
  let te = eng, tv = v;
  if (eng.id === 'neural' && !S.neuralOk) { te = device; const dv = await device.voices().catch(() => []); tv = voiceForLang(to, device, dv); }
  player.bilingual = biOn() ? { to, voice: tv, engine: te, readBoth: trOnly() || prefs.readTr, only: trOnly(), translate: s => getTrans(s), spans: x => wordSpans(x, to) } : null;
}
/** fetch the audio of the sentence that would play next, so Play starts instantly */
async function warmFirst() {
  try {
    await S.voiceReady; if (!S.model || player.playing) return;
    player.engine = engine();
    const chunks = player.build(Math.max(0, S.curW));
    for (let i = 0; i < Math.min(3, chunks.length); i++) {
      const c = chunks[i]; if (c && c.trans === undefined && c.text && c.text.trim()) player.engine.prefetch(c, c.voice || player.voice);
    }
  } catch {}
}
function unlockAudio() { try { engine().unlock?.(); } catch {} }
async function startPlayback(w) {
  setMode('listen', true);
  $('#pPlay').classList.add('loading');
  // the place as chapter + word: word numbers shift if chapters are added above while we wait
  const L = S.model && S.model.words[w] ? toLocal(w) : null;
  await S.voiceReady; // voice for this book's language must be resolved first
  player.engine = engine();
  player.play(L && secInfo(L.sec) ? toGlobal(L.sec, L.w) : w);
  updateMediaSession();
}
player.on.word = w => { $('#pPlay').classList.remove('loading'); setCurrent(w, true); };
player.on.sentence = () => {};
player.on.state = () => {
  const p = $('#pPlay'); p.classList.toggle('playing', player.playing); if (!player.playing) p.classList.remove('loading');
  if (!player.playing && !player.paused) { $$('.w.cw').forEach(x => x.classList.remove('cw')); player.on.trans(-1, false); }
  if (!player.playing && S.book && S.model && S.curW >= 0) { S.book.pos = placeOf(S.curW); savePos(); } // pause / stop: exact place saved now
  positionHL();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused';
};
player.on.end = () => {
  if (S.timer && S.timer.endOfChapter) { stopTimer(true); return; }
  const after = (() => { const w = player.cur, s = S.model?.words[w]?.s; return s != null ? S.model.sents[s].words.slice(-1)[0] + 1 : S.model?.words.length || 0; })();
  if (S.model && after < S.model.words.length) { startPlayback(after); return; }
  if (S.book && S.win && S.win.z < S.book.sections.length - 1) { const n = S.model.words.length; setWindow(S.win.a, S.win.z + 1); startPlayback(n); }
  else if (S.book && S.book.ocr && S.book.ocr.state === 'running') { S.waitNext = true; toast(t('ocrWaiting')); }
  else { toast(t('end')); }
};
player.on.error = e => {
  console.warn('speech error', e);
  $('#pPlay').classList.remove('loading');
  if (e && e.skip) { // cleaned/empty sentence: jump to the next one instantly
    try { player.ci++; player.playing = true; player.next(); } catch {}
    return;
  }
  if (player.engine && player.engine.id === 'neural') {
    // temporary device fallback for playback only — never write the device voice into prefs.voices
    S.neuralFailed = true;
    toast(t('neuralOff'), 2800);
    const w = S.curW >= 0 ? S.curW : 0;
    syncVoice().then(() => startPlayback(w));
    scheduleRelayProbe(4000);
  }
};
// translation line being voiced: the highlight leaves the original and walks the translation
player.on.trans = (s, on) => {
  $$('.tr.speaking').forEach(x => x.classList.remove('speaking'));
  $$('.tw.cw').forEach(x => x.classList.remove('cw'));
  S.trEl = null;
  if (on) { $(`.tr[data-t="${s}"]`)?.classList.add('speaking'); S.wordEls[S.curW]?.classList.remove('cw'); }
  const ft = $('#fStage .f-tr'); if (ft) ft.classList.toggle('speaking', on);
  positionHL();
};
player.on.transWord = (s, k) => {
  const el = $(`.tr[data-t="${s}"] .tw[data-k="${k}"]`); if (!el) return;
  $('#pPlay').classList.remove('loading');
  S.trEl?.classList.remove('cw'); S.trEl = el; el.classList.add('cw');
  positionHL();
  if (!prefs.focus && !prefs.pages) followEl(el);
  else if (prefs.pages && !S.touching && Date.now() - S.lastUserScroll > 4000) { const p = pageOfEl(el); if (p !== pageInfo().i) pageTo(p); }
};
$('#pPlay').onclick = () => {
  unlockAudio();
  if (!player.playing && !player.paused) startPlayback(S.curW >= 0 ? S.curW : 0);
  else player.toggle();
};
$('#pPrev').onclick = () => { S.lastUserScroll = 0; player.skip(-1); };
$('#pNext').onclick = () => { S.lastUserScroll = 0; player.skip(1); };
player.on.sentence = () => {};

/* ------------------------------ focus mode ------------------------------ */
function renderFocus(force) {
  const f = $('#focus');
  f.classList.toggle('show', !!prefs.focus);
  $('#pFocus').classList.toggle('on', !!prefs.focus);
  if (!prefs.focus || !S.model) return;
  const s = Math.max(0, S.curS), { sents, words } = S.model;
  if (!force && f.dataset.s === String(s)) return;
  f.dataset.s = s;
  const tr = S.trans[transKey()] || [];
  const ctx = i => sents[i] ? `<div class="f-s ctx">${esc(sents[i].text)}</div>` : '<div class="f-s ctx"></div>';
  $('#fStage').innerHTML = `${ctx(s - 1)}<div class="f-s cur f-enter${player.playing ? ' speaking' : ''}${sents[s].text.length > 330 ? ' xlong' : sents[s].text.length > 210 ? ' long' : ''}">${sents[s].words.map(w => `<span class="w" data-fw="${w}">${esc(words[w].t)}</span>${words[w].ns ? '' : ' '}`).join('').trimEnd()}</div>${biOn() ? `<div class="f-tr f-enter">${esc(tr[s] || '…')}</div>` : ''}${ctx(s + 1)}`;
  $('#fProg').textContent = `${s + 1} / ${sents.length}`;
  if (S.curW >= 0) focusWord(S.curW);
}
function focusWord(w) {
  const cur = $('#fStage .cur'); if (!cur) return;
  const active = S.mode === 'listen' && (player.playing || player.paused);
  cur.classList.toggle('speaking', active);
  cur.querySelectorAll('.w').forEach(el => { const i = +el.dataset.fw; el.classList.toggle('cw', active && i === w); el.classList.toggle('done', active && i < w); });
  const el = cur.querySelector('.w.cw');
  if (el) {
    const box = el.getBoundingClientRect();
    const g = glyphBox(el, box);
    const padX = Math.max(3.5, g.fs * 0.16);
    el.style.setProperty('--fhl-top', (g.top - box.top).toFixed(2) + 'px');
    el.style.setProperty('--fhl-h', g.height.toFixed(2) + 'px');
    el.style.setProperty('--fhl-padx', padX.toFixed(2) + 'px');
  }
}
function toggleFocus(on = !prefs.focus) { prefs.focus = on; savePrefs(); renderFocus(true); }
$('#pFocus').onclick = () => toggleFocus();
$('#fClose').onclick = () => toggleFocus(false);
$('#fStage').addEventListener('click', e => {
  const wEl = e.target.closest('[data-fw]');
  if (S.mode === 'listen' && wEl) { unlockAudio(); startPlayback(+wEl.dataset.fw); return; }
  const dir = e.clientX < innerWidth / 3 ? -1 : 1;
  if (S.mode === 'listen') { player.skip(dir); return; }
  const s = Math.max(0, Math.min(S.model.sents.length - 1, S.curS + dir));
  setCurrent(S.model.sents[s].words[0], false); S.book.pos = placeOf(S.curW); savePosSoon(); renderFocus();
});

/* ------------------------------ translated reading ------------------------------ */
async function enterTrOnly(to) {
  const wasPlaying = player.playing, w = S.curW >= 0 ? S.curW : 0; player.stop();
  S.book.trTo = to; await db.set('books', S.book.id, S.book);
  renderSection(w, false); await S.voiceReady;
  toast(t('readingIn').replace('{lang}', uiLang() === 'ru' ? langName(to, 'ru').toLowerCase() : langName(to, uiLang())));
  if (wasPlaying || S.mode === 'listen') startPlayback(Math.max(0, S.curW));
}
async function exitTrOnly() {
  const wasPlaying = player.playing, w = S.curW >= 0 ? S.curW : 0; player.stop();
  delete S.book.trTo; await db.set('books', S.book.id, S.book);
  renderSection(w, false); await S.voiceReady;
  if (wasPlaying) startPlayback(Math.max(0, S.curW));
}
/** calm in-app question: "This book is in Russian. Translate it to Arabic and read with this voice?" */
function askTranslate(from, to, voice) {
  return new Promise(res => {
    const ui = uiLang(), fn = langName(from, ui), tn = langName(to, ui);
    const low = x => ui === 'ru' ? x.toLowerCase() : x;
    const d = document.createElement('div'); d.className = 'ask'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = `<div class="ask-card"><div class="ask-ic">${ICON.tr}</div><b>${esc(t('askTrTitle').replace('{to}', low(tn)))}</b><p>${esc(t('askTrBody').replace('{from}', low(fn)).replace(/\{to\}/g, low(tn)).replace('{voice}', voice))}</p><div class="ask-btns"><button class="ask-no">${t('askTrNo')}</button><button class="ask-yes">${t('askTrYes')}</button></div></div>`;
    document.body.appendChild(d); requestAnimationFrame(() => d.classList.add('show'));
    const done = v => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); res(v); };
    d.querySelector('.ask-yes').onclick = () => done(true);
    d.querySelector('.ask-no').onclick = () => done(false);
    d.onclick = e => { if (e.target === d) done(false); };
    d.querySelector('.ask-yes').focus();
  });
}
/* ------------------------------ bilingual ------------------------------ */
// "translated reading": the book is shown and voiced in another language (chosen by picking a foreign voice)
const trOnly = () => !!(S.book && S.book.trTo && S.book.trTo !== S.book.lang);
const biOn = () => !!prefs.bi || trOnly();
const baseLang = l => String(l || '').toLowerCase().split(/[-_]/)[0];
const sameLang = (a, b) => baseLang(a) === baseLang(b) || (['no', 'nb', 'nn'].includes(baseLang(a)) && ['no', 'nb', 'nn'].includes(baseLang(b)));
/** a voice may only read text of its own language: remembered choice if it fits, else the best voice for that language */
function voiceForLang(l, eng, vs) {
  const o = prefs.voices[voiceKey(l, eng)], ov = o && vs.find(x => x.id === o);
  if (ov && sameLang(ov.lang, l)) return o;
  const d = eng.defaultVoice(l, vs), dv = vs.find(x => x.id === d);
  return dv && sameLang(dv.lang, l) ? d : (vs.find(x => sameLang(x.lang, l))?.id || d);
}
const biTarget = () => trOnly() ? S.book.trTo : prefs.biTo && prefs.biTo !== (S.book?.lang) ? prefs.biTo : (S.book?.lang === 'ru' ? 'en' : (uiLang() === 'ru' && S.book?.lang !== 'ru' ? 'ru' : (S.book?.lang === 'en' ? 'ru' : 'en')));
const transKey = () => S.book ? `${S.book.id}:${S.win ? S.win.a : S.sec}:${biTarget()}` : '';
const trArr = () => S.trans[transKey()] || [];
/** the window's first chapter changed: carry the translations over to the new sentence numbers */
function rebaseTrans(ds) {
  const k = transKey(); const old = Object.entries(S.trans).find(([key]) => key.startsWith(S.book.id + ':') && key.endsWith(':' + biTarget()) && key !== k);
  const src = old ? old[1] : S.trans[k]; if (!src) return;
  const arr = []; src.forEach((v, j) => { if (v && j + ds >= 0) arr[j + ds] = v; });
  for (const key of Object.keys(S.trans)) if (key.startsWith(S.book.id + ':')) delete S.trans[key];
  S.trans[k] = arr;
}
async function getTrans(s) {
  const k = transKey(); S.trans[k] = S.trans[k] || [];
  if (S.trans[k][s]) return S.trans[k][s];
  const [x] = await translateMany([S.model.sents[s].text], S.book.lang, biTarget());
  if (x) { S.trans[k][s] = x; fillTr(s, x); }
  return x;
}
function trHtml(x) { const sp = wordSpans(x, biTarget()); let h = '', p = 0; sp.forEach((r, k) => { h += esc(x.slice(p, r.start)) + `<span class="tw" data-k="${k}">${esc(x.slice(r.start, r.end))}</span>`; p = r.end; }); return h + esc(x.slice(p)); }
/** characters per line of a translation line (its font is .74 of the text size) */
function trCpl() { const w = ($('#rdText')?.clientWidth || 340) - 16; return Math.max(18, w / ((prefs.fs || 19) * 0.74 * 0.5)); }
function fillTr(s, x) {
  const el = $(`.tr[data-t="${s}"]`);
  if (el) {
    // a translation arriving above what's being read must not push the text: keep the reference line where it is
    const sc = $('#rdScroll'), ref = !prefs.pages && (S.wordEls[S.curW] || null), top = sc.getBoundingClientRect().top;
    const above = !prefs.pages && el.getBoundingClientRect().top < (ref && ref.isConnected ? ref.getBoundingClientRect().top : top);
    const h0 = above ? el.getBoundingClientRect().height : 0;
    el.innerHTML = trHtml(x); el.classList.remove('load'); el.style.minHeight = '';
    if (above) { const d = el.getBoundingClientRect().height - h0; if (Math.abs(d) > 0.5) { S.progScroll = Date.now(); sc.scrollTop += d; positionHL(true); } }
  } if (prefs.focus && s === S.curS) renderFocus(true); }
let trRun = 0;
async function ensureTranslations() {
  const my = ++trRun, k = transKey(), arr = S.trans[k] = S.trans[k] || [];
  if (!S.model) return;
  const n = S.model.sents.length, start = Math.max(0, S.curS - 1);
  const order = [...Array(n).keys()].slice(start).concat([...Array(start).keys()]);
  const take = (from, count) => {
    const idx = [];
    for (let i = from; i < order.length && idx.length < count; i++) if (!arr[order[i]]) idx.push(order[i]);
    return idx;
  };
  const run = async (idx) => {
    if (my !== trRun || !biOn() || !idx.length) return 0;
    const res = await translateMany(idx.map(s => S.model.sents[s].text), S.book.lang, biTarget()).catch(() => []);
    if (my !== trRun) return -1;
    let fails = 0;
    idx.forEach((s, j) => { if (res[j]) { arr[s] = res[j]; fillTr(s, res[j]); } else fails++; });
    return fails === idx.length ? idx.length : 0;
  };
  // first 4 around the current place, then two batches in parallel
  if (await run(take(0, 4)) < 0) return;
  for (let guard = 0; guard < 40; guard++) {
    if (my !== trRun || !biOn()) return;
    const a = take(0, 6), b = take(a.length, 6);
    if (!a.length) return;
    const rs = await Promise.all([run(a), b.length ? run(b) : Promise.resolve(0)]);
    if (rs.some(x => x < 0)) return;
    if (rs[0] > 0 && rs[0] === a.length && (!b.length || rs[1] === b.length)) { toast(t('translationFail')); [...a, ...b].forEach(s => { const el = $(`.tr[data-t="${s}"]`); if (el) { el.classList.remove('load'); el.textContent = '—'; } }); return; }
  }
}
function setBilingual(on) {
  if (trOnly()) { delete S.book.trTo; db.set('books', S.book.id, S.book); const w = S.curW; renderSection(w >= 0 ? w : 0, false); }
  prefs.bi = on; savePrefs();
  $('#rdText').classList.toggle('bi', on); $('#pBi').classList.toggle('on', on);
  if (on) ensureTranslations(); else { trRun++; player.bilingual = null; }
  $('#rdText').classList.toggle('bi', biOn());
  if (on && prefs.readTr) hint('biVoice', t('hintBiVoice'));
  // the main text keeps its language and voice; the translation line is voiced after each sentence unless switched off
  const wasPlaying = player.playing;
  setupBilingualVoice().then(() => { if (wasPlaying && player.playing) player.play(S.curW); });
  if (prefs.focus) renderFocus(true);
  requestAnimationFrame(() => { positionHL(true); if (S.curW > 0) scrollToWord(S.curW, false); });
}
$('#pBi').onclick = () => setBilingual(!prefs.bi);

/* ------------------------------ bookmarks ------------------------------ */
function curMark() { const b = S.book; if (!b || !S.model) return -1; return (b.marks || []).findIndex(m => { const g = toGlobal(m.sec, m.w); return g >= 0 && S.model.words[g]?.s === S.curS; }); }
function updateMarkBtn() { $('#rdMark').classList.toggle('on', curMark() >= 0); }
$('#rdMark').onclick = () => {
  const b = S.book; b.marks = b.marks || []; const i = curMark();
  if (i >= 0) { b.marks.splice(i, 1); toast(t('bookmarkRemoved')); }
  else { addMark(); toast(t('bookmarkAdded')); }
  savePos(); updateMarkBtn();
};

function addMark() {
  const b = S.book; b.marks = b.marks || []; const s = Math.max(0, S.curS), w = S.model.sents[s].words[0], L = toLocal(w);
  b.marks.push({ sec: L.sec, w: L.w, text: S.model.sents[s].text.slice(0, 120), at: Date.now(), f: bookProg(L.sec, w).f });
  b.marks.sort((x, y) => x.sec - y.sec || x.w - y.w); savePos(); updateMarkBtn();
}

/* ------------------------------ navigation sheet: position slider, contents, bookmarks ------------------------------ */
$('#rdNav').onclick = () => openNav();
function openNav(tab = 'toc') {
  const b = S.book; if (!b) return;
  const bp = bookProg(), sec = b.sections[S.sec];
  openSheet(`<div class="nav-head"><div class="sh-title nav-title">${esc(b.title)}<button class="x" data-close>${ICON.x}</button></div>
    <div class="nav-pos">
      <div class="nav-cur"><b id="navCh">${esc(chapterName(S.sec, curPara()))}</b><span id="navPct">${fmtPct(bp.f)}</span></div>
      <input type="range" id="navSeek" min="0" max="1000" step="1" value="${Math.round(bp.f * 1000)}" style="--p:${(bp.f * 100).toFixed(1)}%" aria-label="${t('position')}">
      <div class="nav-meta"><span id="navPrev">${esc(t('youAreHere'))}</span><span id="navLeft">${fmtLeft(bp.left)} ${t('left')}</span></div>
    </div>
    <div class="segs" id="navTabs"><button data-t="toc">${t('contents')}</button><button data-t="marks">${t('bookmarks')}${(b.marks || []).length ? ` · ${b.marks.length}` : ''}</button><button data-t="quotes">${t('quotes')}</button></div></div>
    <div id="navList"></div>`, body => {
    const list = body.querySelector('#navList');
    const paint = async tb => {
      tab = tb; body.querySelectorAll('#navTabs button').forEach(x => x.classList.toggle('on', x.dataset.t === tb));
      if (tb === 'toc') {
        // the book's own Contents: parts and chapters strong, subsections lighter and indented
        const toc = bookToc(b), sw = secWords(), tot = sw.reduce((a, x) => a + x, 0) || 1, before = [];
        let acc = 0; sw.forEach((x, k) => { before[k] = acc; acc += x; });
        const here = { sec: S.sec, p: curPara() };
        let cur = -1; toc.forEach((e, k) => { if (e.sec < here.sec || e.sec === here.sec && e.p <= here.p) cur = k; });
        const pf = e => { const ps = (b.sections[e.sec].text || '').split(/\n\s*\n/), all = ps.reduce((a, x) => a + x.length, 0) || 1, pre = ps.slice(0, e.p).reduce((a, x) => a + x.length, 0); return (before[e.sec] + sw[e.sec] * pre / all) / tot; };
        list.innerHTML = toc.length ? `<div class="toc">` + toc.map((e, k) => `<button class="nav-row toc-row l${Math.min(2, e.lvl)}${k === cur ? ' cur' : ''}" data-k="${k}"><span class="tt">${esc(e.t)}</span><small>${k === cur ? `<em>${t('youAreHere')}</em> · ` : ''}${fmtPct(pf(e))}</small></button>`).join('') + '</div>' : `<div class="note nav-empty">${t('noToc')}</div>`;
        list.querySelectorAll('[data-k]').forEach(r => r.onclick = () => { const e = toc[+r.dataset.k]; closeSheet(); jumpTo(e.sec, 0, paraWord(e.sec, e.p)); });
        requestAnimationFrame(() => {
          const cur = list.querySelector('.toc-row.cur'), head = body.querySelector('.nav-head');
          if (!cur) return;
          const cr = cur.getBoundingClientRect(), br = body.getBoundingClientRect();
          const top = (head ? head.getBoundingClientRect().bottom : br.top) + 8;
          if (cr.top >= top && cr.bottom <= br.bottom - 8) return; // already in the visible list
          cur.style.scrollMarginTop = ((head ? head.offsetHeight : 0) + 8) + 'px';
          cur.scrollIntoView({ block: 'nearest' });
        });
      } else if (tb === 'marks') {
        const marks = b.marks || [], here = curMark() >= 0;
        list.innerHTML = `<button class="nav-add" id="navAdd">${ICON.mark}<span>${here ? t('bookmarkHereDone') : t('bookmarkHere')}</span></button>` + (marks.map((m, i) => `<div class="mk" data-mark="${i}"><div class="row mk-main"><div class="ic">${ICON.mark}</div><div class="tx"><b>${esc(m.text)}</b><small>${esc(secName(b.sections[m.sec] || {}, m.sec))} · ${fmtPct(m.f != null ? m.f : bookProg(m.sec, 0).f)}</small></div></div><button class="mk-del" aria-label="${t('delete')}">${ICON.x}<span>${t('delete')}</span></button></div>`).join('') || `<div class="note nav-empty">${t('noBookmarks')}</div>`);
        list.querySelector('#navAdd').onclick = () => { if (curMark() < 0) { addMark(); toast(t('bookmarkAdded')); } paint('marks'); body.querySelector('#navTabs [data-t=marks]').textContent = t('bookmarks') + ` · ${b.marks.length}`; };
        list.querySelectorAll('.mk').forEach(el => wireMark(el, () => paint('marks')));
      } else if (tb === 'quotes') {
        const qs = (await db.all('quotes')).filter(q => q.bookId === b.id).sort((x, y) => y.at - x.at);
        list.innerHTML = (qs.map((q, i) => `<div class="mk q-nav" data-q="${q.id}"><div class="row mk-main"><div class="ic">${ICON.quote}</div><div class="tx"><b>${esc(q.text)}</b><small>${esc([q.author, q.title].filter(Boolean).join(' · '))}</small></div></div><button class="mk-del q-share" data-a="share" aria-label="${t('shareAction')}">${ICON.share}<span>${t('shareAction')}</span></button><button class="mk-del" data-a="del" aria-label="${t('delete')}">${ICON.x}<span>${t('delete')}</span></button></div>`).join('') || `<div class="note nav-empty">${t('noQuotesBook')}</div>`) + `<button class="nav-add" id="navAllQuotes">${ICON.quote}<span>${t('quotes')}</span></button>`;
        list.querySelector('#navAllQuotes').onclick = () => { closeSheet(); renderQuotes(); show('quotes'); };
        list.querySelectorAll('.q-nav').forEach(el => {
          el.querySelector('.mk-main').onclick = () => {};
          el.querySelectorAll('[data-a]').forEach(btn => btn.onclick = async ev => {
            ev.stopPropagation();
            const q = qs.find(x => x.id === el.dataset.q); if (!q) return;
            if (btn.dataset.a === 'share') { const r = await shareCard(q, q.th || 'paper'); if (r === 'downloaded') toast('PNG ✓'); }
            if (btn.dataset.a === 'del') { await db.del('quotes', q.id); paint('quotes'); }
          });
        });
      }
    };
    body.querySelector('#navTabs').onclick = e => { const x = e.target.closest('button'); if (x) paint(x.dataset.t); };
    const rg = body.querySelector('#navSeek');
    rg.oninput = () => {
      const f = rg.value / 1000, L = locate(f), x = b.sections[L.sec];
      rg.style.setProperty('--p', (f * 100) + '%');
      body.querySelector('#navPct').textContent = fmtPct(f);
      body.querySelector('#navCh').textContent = chapterName(L.sec, Math.floor(L.frac * ((x.text || '').split(/\n\s*\n/).length)));
      const txt = (x.text || '').replace(/\s+/g, ' '), at = Math.floor(L.frac * txt.length), st = Math.max(0, txt.lastIndexOf(' ', at - 1) + 1);
      body.querySelector('#navPrev').textContent = '«' + txt.slice(st, st + 46).trim() + '…»';
      body.querySelector('#navLeft').textContent = '';
    };
    rg.onchange = () => { const L = locate(rg.value / 1000); closeSheet(); jumpTo(L.sec, L.frac); };
    paint(tab);
  });
}
// a bookmark row: tap → jump; swipe left or long-press → reveal Delete
function wireMark(el, repaint) {
  const main = el.querySelector('.mk-main'), i = +el.dataset.mark; let x0 = null, dx = 0, lp = 0, moved = false;
  const open = on => { el.classList.toggle('open', on); main.style.transform = ''; };
  main.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; dx = 0; moved = false; lp = setTimeout(() => { if (!moved) { open(true); navigator.vibrate?.(8); } }, 550); }, { passive: true });
  main.addEventListener('touchmove', e => { if (x0 === null) return; dx = e.touches[0].clientX - x0; if (Math.abs(dx) > 6) { moved = true; clearTimeout(lp); } if (dx < 0) { main.style.transition = 'none'; main.style.transform = `translateX(${Math.max(-96, dx + (el.classList.contains('open') ? -96 : 0))}px)`; } }, { passive: true });
  main.addEventListener('touchend', () => { clearTimeout(lp); main.style.transition = ''; if (moved) open(dx < -40 || (el.classList.contains('open') && dx > -10 && dx < 10)); x0 = null; });
  main.addEventListener('contextmenu', e => { e.preventDefault(); open(true); });
  main.onclick = () => { if (moved) return; if (el.classList.contains('open')) return open(false); const m = S.book.marks[i]; closeSheet(); jumpTo(m.sec, 0, m.w); };
  el.querySelector('.mk-del').onclick = e => { e.stopPropagation(); S.book.marks.splice(i, 1); savePos(); updateMarkBtn(); toast(t('bookmarkRemoved')); repaint(); };
}

/* ------------------------------ more sheet ------------------------------ */
$('#rdMore').onclick = () => {
  const b = S.book;
  const langs = TR_LANGS.filter(l => l !== b.lang).map(l => `<option value="${l}" ${l === biTarget() ? 'selected' : ''}>${esc(langName(l, uiLang()))}</option>`).join('');
  openSheet(`<div class="sh-title">${t('settings')}<button class="x" data-close>${ICON.x}</button></div>
    <div class="row" data-tg="focus"><div class="ic">${ICON.focus}</div><div class="tx"><b>${t('focus')}</b></div><i class="sw ${prefs.focus ? 'on' : ''}"></i></div>
    <div class="row" data-tg="bi"><div class="ic">${ICON.tr}</div><div class="tx"><b>${t('bilingual')}</b></div><i class="sw ${prefs.bi ? 'on' : ''}"></i></div>
    <div class="row" style="cursor:default"><div class="tx" style="padding-left:48px"><b style="font-weight:500;font-size:14px;color:var(--ink2)">${t('translateTo')}</b></div><select id="biTo" class="row-select" aria-label="${t('translateTo')}">${langs}</select></div>
    <div class="row" data-tg="both"><div class="ic">${ICON.headph}</div><div class="tx"><b>${t('readTr')}</b><small>${t('readTrHint')}</small></div><i class="sw ${prefs.readTr ? 'on' : ''}"></i></div>
    <div class="row" data-tg="pages"><div class="ic">${ICON.pages}</div><div class="tx"><b>${t('pagesMode')}</b><small>${t('pagesHint')}</small></div><i class="sw ${prefs.pages ? 'on' : ''}"></i></div>
    <div class="row" data-tg="skip"><div class="ic">${ICON.wand}</div><div class="tx"><b>${t('skipFiller')}</b><small>${t('skipFillerHint')}</small></div><i class="sw ${prefs.skip ? 'on' : ''}"></i></div>
`, body => {
    body.querySelectorAll('[data-tg]').forEach(r => r.onclick = () => {
      const k = r.dataset.tg, sw = r.querySelector('.sw');
      if (k === 'focus') { toggleFocus(); sw.classList.toggle('on', prefs.focus); }
      if (k === 'bi') { setBilingual(!prefs.bi); sw.classList.toggle('on', prefs.bi); }
      if (k === 'both') { prefs.readTr = !prefs.readTr; savePrefs(); sw.classList.toggle('on', prefs.readTr); if (prefs.readTr && !prefs.bi) { setBilingual(true); body.querySelector('[data-tg=bi] .sw').classList.add('on'); } else { const wp = player.playing; setupBilingualVoice().then(() => { if (wp && player.playing) player.play(S.curW); }); } }
      if (k === 'pages') { setPages(!prefs.pages); sw.classList.toggle('on', prefs.pages); }
      if (k === 'skip') { prefs.skip = !prefs.skip; savePrefs(); sw.classList.toggle('on', prefs.skip); const w = S.curW; player.stop(); renderSection(w); }
    });
    body.querySelector('#biTo').onchange = async e => { const wp = player.playing, w = S.curW; prefs.biTo = e.target.value; savePrefs(); renderSection(w, false); if (prefs.bi) ensureTranslations(); await S.voiceReady; if (wp) startPlayback(Math.max(0, S.curW)); };
  });
};

/* ------------------------------ appearance ------------------------------ */
function openLook(focus) {
  const pct = (v, a, b) => ((v - a) / (b - a) * 100) + '%';
  openSheet(`<div class="sh-title">${t('appearance')}<button class="x" data-close>${ICON.x}</button></div>
    <div class="sh-label">${t('theme')}</div>
    <div class="themes">${['paper', 'sepia', 'night'].map(th => `<button class="theme-sw ${prefs.theme === th ? 'on' : ''}" data-t="${th}"><b>Aa</b>${t(th)}</button>`).join('')}</div>
    <div class="sh-label">${t('brightness')}</div>
    <div class="range-row"><svg viewBox="0 0 24 24" style="width:18px;opacity:.6"><circle cx="12" cy="12" r="4"/></svg><input type="range" id="rgDim" min="0" max="0.55" step="0.01" value="${0.55 - prefs.dim}" style="--p:${pct(0.55 - prefs.dim, 0, .55)}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg></div>
    <div class="sh-label" id="lblSize">${t('textSize')}</div>
    <div class="fs-steps" id="fsSteps">${FS_STEPS.map(v => `<button data-v="${v}" style="font-size:${11 + (v - 14) * 0.62}px" aria-label="${v}px">A</button>`).join('')}</div>
    <div class="range-row"><span class="lbl" style="font-size:13px">A</span><input type="range" id="rgFs" min="${FS_MIN}" max="${FS_MAX}" step="1" value="${prefs.fs}" style="--p:${pct(prefs.fs, FS_MIN, FS_MAX)}"><span class="lbl" style="font-size:24px">A</span><span class="val" id="fsVal">${prefs.fs}</span></div>
    <div class="sh-label">${t('typeface')}</div>
    <div class="segs" id="sgFont"><button data-v="literata" style="font-family:Literata">Literata</button><button data-v="source" style="font-family:'Source Serif 4'">Source</button><button data-v="inter" style="font-family:Inter">Inter</button></div>
    <div class="sh-label">${t('lineSpacing')}</div>
    <div class="segs" id="sgLh"><button data-v="1.4">≡ S</button><button data-v="1.62">≡ M</button><button data-v="1.95">≡ L</button></div>
    <div class="sh-label">${t('alignment')}</div>
    <div class="segs" id="sgAl"><button data-v="justify">${t('justify')}</button><button data-v="left">${t('alignLeft')}</button></div>`, body => {
    const mark = () => { body.querySelectorAll('#sgFont button').forEach(b => b.classList.toggle('on', b.dataset.v === prefs.font)); body.querySelectorAll('#sgLh button').forEach(b => b.classList.toggle('on', +b.dataset.v === +prefs.lh)); body.querySelectorAll('#sgAl button').forEach(b => b.classList.toggle('on', b.dataset.v === prefs.align)); };
    mark();
    body.querySelectorAll('.theme-sw').forEach(b => b.onclick = () => { prefs.theme = b.dataset.t; savePrefs(); applyLook(); body.querySelectorAll('.theme-sw').forEach(x => x.classList.toggle('on', x === b)); });
    const fs = body.querySelector('#rgFs');
    const setFs = v => { prefs.fs = Math.max(FS_MIN, Math.min(FS_MAX, Math.round(v))); fs.value = prefs.fs; fs.style.setProperty('--p', pct(prefs.fs, FS_MIN, FS_MAX)); body.querySelector('#fsVal').textContent = prefs.fs; { const near = FS_STEPS.reduce((a, v) => Math.abs(v - prefs.fs) < Math.abs(a - prefs.fs) ? v : a); body.querySelectorAll('#fsSteps button').forEach(b => b.classList.toggle('on', +b.dataset.v === near)); } savePrefs(); applyLook(); keepWordInView(); };
    fs.oninput = () => setFs(+fs.value);
    body.querySelector('#fsSteps').onclick = e => { const b = e.target.closest('button'); if (b) setFs(+b.dataset.v); };
    { const near = FS_STEPS.reduce((a, v) => Math.abs(v - prefs.fs) < Math.abs(a - prefs.fs) ? v : a); body.querySelectorAll('#fsSteps button').forEach(b => b.classList.toggle('on', +b.dataset.v === near)); }
    const dm = body.querySelector('#rgDim'); dm.oninput = () => { prefs.dim = +(0.55 - dm.value).toFixed(2); dm.style.setProperty('--p', pct(+dm.value, 0, .55)); savePrefs(); applyLook(); };
    body.querySelector('#sgFont').onclick = e => { const b = e.target.closest('button'); if (!b) return; prefs.font = b.dataset.v; savePrefs(); applyLook(); mark(); };
    body.querySelector('#sgAl').onclick = e => { const b = e.target.closest('button'); if (!b) return; prefs.align = b.dataset.v; savePrefs(); applyLook(); mark(); };
    body.querySelector('#sgLh').onclick = e => { const b = e.target.closest('button'); if (!b) return; prefs.lh = +b.dataset.v; savePrefs(); applyLook(); mark(); keepWordInView(); };
    if (focus === 'size') setTimeout(() => body.querySelector('#lblSize').scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
  });
}
$('#dBright').onclick = () => openLook('theme');
$('#dFont').onclick = () => openLook('size');

/* ------------------------------ sleep timer ------------------------------ */
function openTimer() {
  const cur = S.timer ? (S.timer.endOfChapter ? 'ch' : String(S.timer.total / 60)) : 'off';
  const opts = ['5', '10', '15', '20', '30', '45', '60'];
  openSheet(`<div class="sh-title">${t('sleepTimer')}<button class="x" data-close>${ICON.x}</button></div>
    <div class="timer-grid">${`<button data-v="off" class="${cur === 'off' ? 'on' : ''}" style="font-family:var(--ui);font-size:15px">${t('off')}</button>`}${opts.map(o => `<button data-v="${o}" class="${cur === o ? 'on' : ''}">${o}<small>${t('min')}</small></button>`).join('')}<button data-v="ch" class="wide ${cur === 'ch' ? 'on' : ''}" style="grid-column:span 4">${t('endChapter')}</button></div>
    <div class="note">${t('fadeNote')}</div>`, body => {
    body.querySelector('.timer-grid').onclick = e => { const b = e.target.closest('button'); if (!b) return; setTimer(b.dataset.v); closeSheet(); };
  });
}
function setTimer(v) {
  clearInterval(S.timer?.iv); player.setVolume(1);
  if (v === 'off') { S.timer = null; renderTimer(); return; }
  if (v === 'ch') { S.timer = { endOfChapter: true }; renderTimer(); return; }
  const total = +v * 60;
  S.timer = { total, end: Date.now() + total * 1000 };
  S.timer.iv = setInterval(() => {
    const left = (S.timer.end - Date.now()) / 1000;
    if (left <= 20 && left > 0) player.setVolume(Math.max(0.05, left / 20));
    if (left <= 0) { stopTimer(true); return; }
    renderTimer();
  }, 500);
  renderTimer();
}
function stopTimer(fired) { clearInterval(S.timer?.iv); S.timer = null; player.pause(); player.setVolume(1); renderTimer(); if (fired) toast(t('timerDone')); }
function renderTimer() {
  const el = $('#dTimerTxt'), btn = $('#dTimer');
  if (!S.timer) { el.textContent = t('timer'); btn.classList.remove('active'); return; }
  btn.classList.add('active');
  el.textContent = S.timer.endOfChapter ? '§ ' + (S.sec + 1) : fmtClock(Math.max(0, (S.timer.end - Date.now()) / 1000));
}
$('#dTimer').onclick = openTimer;

/* ------------------------------ voices & speed ------------------------------ */
const AV = ['#FF5A36', '#2B4C9B', '#1F3D36', '#C4552D', '#4B2E4F', '#0F4C5C', '#7A4E2D', '#A23B2A'];
async function openVoices() {
  const lang = S.book.lang;
  openSheet(`<div class="sh-title">${t('voice')}<button class="x" data-close>${ICON.x}</button></div>
    <div class="segs" id="sgEng"><button data-v="neural">${t('neural')}</button><button data-v="device">${t('device')}</button></div>
    <div class="note" id="engNote" style="margin:10px 2px 6px"></div>
    <div class="tlang"><span>${t('textLang')}</span><label class="tl-sel"><span><b id="tlName"></b><small id="tlAuto"></small></span><select id="tlSel" aria-label="${t('textLang')}"></select></label></div>
    <input class="inp vsearch" id="vSearch" placeholder="${t('searchVoices')}" autocomplete="off">
    <div id="vList"><div class="note">${t('loadingVoices')}</div></div>
    <div class="sh-label">${t('relay')}</div>
    <div style="display:flex;gap:8px"><input class="inp" id="relayIn" type="url" autocapitalize="off" placeholder="https://…" value="${esc(prefs.relay || S.cfgRelay || '')}"><button class="chip" id="relayGo" style="height:auto;padding:0 16px">OK</button></div>
    <div class="note">${t('relayHint')}</div>`, async body => {
    const eng = () => prefs.engine === 'device' ? device : neural;
    probeRelay({ reason: 'sheet' });
    const ui = uiLang();
    const label = l => { const nat = nativeName(l), loc = langName(l, ui); return nat.toLowerCase() === loc.toLowerCase() ? nat : `${nat} · ${loc}`; };
    const paintLang = async () => {
      const bl = S.book.lang, vs = await eng().voices().catch(() => []);
      const langs = [...new Set([bl, ...Object.keys(CURATED), ...vs.map(v => v.lang)])].sort((a, b) => langName(a, ui).localeCompare(langName(b, ui), ui));
      body.querySelector('#tlName').textContent = label(bl);
      body.querySelector('#tlAuto').textContent = S.book.langManual ? '' : t('autoDetected');
      body.querySelector('#tlSel').innerHTML = langs.map(l => `<option value="${l}" ${l === bl ? 'selected' : ''}>${esc(label(l))}</option>`).join('');
    };
    const paint = async () => {
      const neuralSel = prefs.engine !== 'device'; const bl = S.book.lang;
      const e = neuralSel ? neural : device;
      body.querySelectorAll('#sgEng button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'neural') === neuralSel));
      const st = S.neuralOk ? `<span class="status ok"><i></i>${t('online')}</span> · ${t('neuralHint')}` : (S.staticBooks && S.book && S.staticBooks.has(S.book.id) ? `<span class="status ok"><i></i>${t('neural')}</span> · ${t('neuralSamples')}` : `<span class="status"><i></i>${t('offline')}</span> · ${t('neuralOffBook')}`);
      body.querySelector('#engNote').innerHTML = neuralSel ? st : t('deviceHint');
      const vs = await e.voices().catch(() => []); const q = body.querySelector('#vSearch').value.trim().toLowerCase();
      const cur = trOnly() && player.bilingual ? player.bilingual.voice : player.voice;
      const filt = vs.filter(v => !q || (v.name + ' ' + v.locale + ' ' + langName(v.lang) + ' ' + langName(v.lang, ui) + ' ' + nativeName(v.lang) + ' ' + (v.langName || '')).toLowerCase().includes(q));
      const groups = {};
      for (const v of filt) (groups[v.lang] = groups[v.lang] || []).push(v);
      const tr = biOn() ? biTarget() : null;
      const order = Object.keys(groups).sort((a, b) => (a === bl ? -2 : a === tr ? -1 : 0) - (b === bl ? -2 : b === tr ? -1 : 0) || langName(a, ui).localeCompare(langName(b, ui), ui));
      const row = v => `<div class="vrow ${v.id === cur ? 'on' : ''}" data-v="${esc(v.id)}" data-l="${v.lang}"><div class="av" style="background:${AV[v.name.length % AV.length]}">${esc(v.name[0])}</div><div class="tx"><b>${esc(v.name)}</b><small>${esc(v.engine === 'neural' ? [regionName(v.locale, ui), v.gender === 'Female' ? '♀' : v.gender === 'Male' ? '♂' : '', v.multi ? t('multilingual') : ''].filter(Boolean).join(' · ') : (v.detail || v.locale))}</small></div><button class="pv${PV.id === v.id ? (PV.loading ? ' loading' : ' playing') : ''}" data-pv="${esc(v.id)}" aria-label="${t('preview')}">${ICON.play}${ICON.stop}</button>${ICON.check}</div>`;
      const curHas = l => groups[l].some(v => v.id === cur);
      body.querySelector('#vList').innerHTML = order.map(l => `<details class="vgroup${l === bl ? ' cur' : ''}" ${l === bl || l === tr || q || curHas(l) ? 'open' : ''}><summary><span>${esc(label(l))}${l === bl ? ` <em>${t('thisText')}</em>` : l === tr ? ` <em>${t('translationLang')}</em>` : ''}</span><span>${groups[l].length}</span></summary>${groups[l].map(row).join('')}</details>`).join('') || `<div class="note">—</div>`;
    };
    body.querySelector('#sgEng').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      stopPreview();
      prefs.engine = b.dataset.v === 'device' ? 'device' : 'auto'; savePrefs();
      if (prefs.engine !== 'device') await probeRelay({ reason: 'sheet' });
      const wasPlaying = player.playing; player.stop(); await syncVoice(); paint(); paintLang(); if (wasPlaying) startPlayback(S.curW);
    };
    body.querySelector('#tlSel').onchange = async e => {
      const l = e.target.value; if (!l || l === S.book.lang) return;
      const wasPlaying = player.playing; player.stop();
      S.book.lang = l; S.book.langManual = true; await db.set('books', S.book.id, S.book);
      renderSection(S.curW >= 0 ? S.curW : 0, false); await S.voiceReady;
      paintLang(); paint(); if (wasPlaying) startPlayback(S.curW >= 0 ? S.curW : 0);
    };
    body.querySelector('#vSearch').oninput = debounce(paint, 150);
    body.querySelector('#relayGo').onclick = async () => {
      prefs.relay = body.querySelector('#relayIn').value.trim(); savePrefs(); S.neuralFailed = false;
      await checkRelay(); toast(S.neuralOk ? '✓ ' + t('online') : t('offline')); await syncVoice(); paint();
    };
    body.querySelector('#vList').onclick = async e => {
      const pv = e.target.closest('[data-pv]');
      const r = e.target.closest('.vrow'); if (!r) return;
      if (pv) { e.preventDefault(); e.stopPropagation(); previewVoice(r.dataset.v, r.dataset.l, pv); return; }
      stopPreview();
      // a voice only ever reads its own language: the text's language, the translation line's language,
      // or — after asking — the whole book translated into the voice's language
      const bl = S.book.lang, vl = r.dataset.l, id = r.dataset.v;
      const apply = async () => { const wasPlaying = player.playing; await syncVoice(); paint(); if (wasPlaying) startPlayback(S.curW); else warmFirst(); };
      if (sameLang(vl, bl)) {
        prefs.voices[voiceKey(bl, prefs.engine === 'device' ? device : neural)] = id; savePrefs();
        if (trOnly()) { await exitTrOnly(); paint(); return; }
        return apply();
      }
      if (biOn() && sameLang(vl, biTarget())) { prefs.voices[voiceKey(biTarget(), prefs.engine === 'device' ? device : neural)] = id; savePrefs(); return apply(); }
      const vname = r.querySelector('b')?.textContent || '';
      const yes = await askTranslate(bl, vl, vname);
      if (!yes) return;
      prefs.voices[voiceKey(vl)] = id; savePrefs();
      closeSheet(); await enterTrOnly(vl);
    };
    paint(); paintLang();
  }, stopPreview);
}
/* voice preview: one reusable <audio>, unlocked inside the tap (iOS), previous preview stopped, cached samples */
const pvAudio = new Audio(); pvAudio.preload = 'auto'; pvAudio.setAttribute('playsinline', '');
const PV = { id: null, loading: false, token: 0, btn: null, resume: false };
function pvState(btn, st) {
  $$('#vList .pv').forEach(b => b.classList.remove('loading', 'playing'));
  if (btn && st) btn.classList.add(st);
}
function stopPreview() {
  PV.token++; const wasActive = !!PV.id; PV.id = null; PV.loading = false;
  try { pvAudio.pause(); } catch {}
  try { if (device.previewing) { speechSynthesis.cancel(); device.previewing = false; } } catch {}
  pvState(null);
  if (wasActive && PV.resume) { PV.resume = false; if (S.screen === 'reader' && S.mode === 'listen') player.resume(); }
}
function previewVoice(id, lang, btn) {
  if (PV.id === id) { stopPreview(); return; }            // second tap = stop
  stopPreview();
  const my = ++PV.token; PV.id = id; PV.btn = btn;
  if (player.playing) { player.pause(); PV.resume = true; }
  const e = engine();
  const done = () => { if (my === PV.token) { PV.id = null; PV.loading = false; pvState(null); if (PV.resume) { PV.resume = false; if (S.mode === 'listen') player.resume(); } } };
  if (e.id === 'device') {
    // Web Speech must be started synchronously inside the tap on iOS
    device.previewing = true; pvState(btn, 'playing');
    const u = new SpeechSynthesisUtterance(PREVIEW_TEXT[lang] || PREVIEW_TEXT[(lang || '').slice(0, 2)] || PREVIEW_TEXT.en);
    const dv = (S.deviceVoices || []).find(x => x.id === id); if (dv) { u.voice = dv.raw; u.lang = dv.raw.lang; } else u.lang = lang;
    u.onend = u.onerror = () => { device.previewing = false; done(); };
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { done(); }
    return;
  }
  // unlock the element now, while we are still inside the user gesture
  const cached = e.previewCached?.(id);
  pvAudio.onended = done; pvAudio.onerror = null;
  if (!cached) { PV.loading = true; pvState(btn, 'loading'); try { pvAudio.src = SILENT; pvAudio.play().catch(() => {}); } catch {} }
  e.preview(id, lang).then(url => {
    if (my !== PV.token) return;
    PV.loading = false; pvState(btn, 'playing');
    pvAudio.src = url; pvAudio.currentTime = 0;
    const p = pvAudio.play();
    if (p && p.catch) p.catch(err => { if (my !== PV.token) return; console.warn('preview', err); toast(t('previewFail')); done(); });
  }).catch(err => { if (my !== PV.token) return; console.warn('preview', err); toast(t('previewFail')); done(); });
}
$('#pVoice').onclick = openVoices;
function openSpeed() {
  const presets = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];
  openSheet(`<div class="sh-title">${t('speed')}<button class="x" data-close>${ICON.x}</button></div>
    <div class="speed-big" id="spVal">${fmtRate(prefs.rate)}</div>
    <div class="range-row"><span class="lbl" style="font-size:13px">0.5</span><input type="range" id="rgSp" min="0.5" max="3" step="0.05" value="${prefs.rate}" style="--p:${(prefs.rate - .5) / 2.5 * 100}%"><span class="lbl" style="font-size:13px">3</span></div>
    <div class="presets">${presets.map(p => `<button data-v="${p}" class="${p === prefs.rate ? 'on' : ''}">${p}×</button>`).join('')}</div>`, body => {
    const rg = body.querySelector('#rgSp');
    const set = v => { v = Math.round(v * 20) / 20; prefs.rate = v; savePrefs(); rg.value = v; rg.style.setProperty('--p', (v - .5) / 2.5 * 100 + '%'); body.querySelector('#spVal').textContent = fmtRate(v); body.querySelectorAll('.presets button').forEach(b => b.classList.toggle('on', +b.dataset.v === v)); $('#pSpeed').textContent = fmtRate(v); };
    rg.oninput = () => set(+rg.value);
    rg.onchange = () => { player.setRate(prefs.rate); updateProgress(); };
    body.querySelector('.presets').onclick = e => { const b = e.target.closest('button'); if (!b) return; set(+b.dataset.v); player.setRate(prefs.rate); updateProgress(); };
  });
}
$('#pSpeed').onclick = openSpeed;

/* ------------------------------ quotes ------------------------------ */
async function saveQuote(text) {
  const q = { id: 'q-' + uid(), text, title: S.book.title, author: S.book.author, bookId: S.book.id, at: Date.now(), th: 'paper' };
  await db.set('quotes', q.id, q);
}
async function renderQuotes() {
  const qs = (await db.all('quotes')).sort((a, b) => b.at - a.at);
  const el = $('#quoteList');
  if (!qs.length) { el.innerHTML = `<div class="empty">${t('noQuotes')}</div>`; return; }
  el.innerHTML = qs.map((q, i) => `<div class="qcard" data-th="${q.th || 'paper'}" data-q="${q.id}" style="animation-delay:${i * .05}s">
    <div class="qm">“</div><div class="qt">${esc(q.text)}</div>
    <div class="qb"><div><div class="qs">${esc(q.title)}</div><div class="qa">${esc(q.author || '')}</div></div>
    <div class="qact"><button class="th ${q.th === 'paper' || !q.th ? 'on' : ''}" data-th="paper" style="background:#EFEDEA" aria-label="Paper"></button><button class="th ${q.th === 'ink' ? 'on' : ''}" data-th="ink" style="background:#17171B" aria-label="Ink"></button><button class="th ${q.th === 'ember' ? 'on' : ''}" data-th="ember" style="background:#FF5A36" aria-label="Ember"></button>
    <button class="qbtn" data-a="share" aria-label="${t('share')}">${ICON.share}</button><button class="qbtn" data-a="del" aria-label="${t('delete')}">${ICON.trash}</button></div></div></div>`).join('');
  el.onclick = async e => {
    const card = e.target.closest('.qcard'); if (!card) return; const q = qs.find(x => x.id === card.dataset.q);
    const th = e.target.closest('[data-th].th'); const a = e.target.closest('[data-a]');
    if (th) { q.th = th.dataset.th; await db.set('quotes', q.id, q); card.dataset.th = q.th; card.querySelectorAll('.th').forEach(x => x.classList.toggle('on', x === th)); }
    if (a && a.dataset.a === 'share') { const r = await shareCard(q, q.th || 'paper'); if (r === 'downloaded') toast('PNG ✓'); }
    if (a && a.dataset.a === 'del') { await db.del('quotes', q.id); card.style.transition = '.3s'; card.style.opacity = 0; card.style.transform = 'scale(.96)'; setTimeout(renderQuotes, 300); }
  };
}
window.__murmurRenderCard = renderCard; // used by tests

/* ------------------------------ stats ------------------------------ */
async function renderStats() {
  const s = summary(), qn = (await db.all('quotes')).length;
  const max = Math.max(60, ...s.week.map(d => d.listen + d.read));
  const dn = new Intl.DateTimeFormat(uiLang(), { weekday: 'narrow' });
  $('#statsBody').innerHTML = `
    <div class="st-hero"><div class="n">${s.streak}</div><div class="l">${uiLang() === 'ru' ? ruPl(s.streak, 'день', 'дня', 'дней') + ' подряд' : t('dayStreak')}<br><span style="color:var(--muted);font-weight:600;letter-spacing:1px">${s.streak ? '●'.repeat(Math.min(s.streak, 7)) : '○'}</span></div></div>
    <div class="st-grid">
      <div class="st-tile"><div class="n">${Math.round(s.listen / 60)}</div><div class="l">${t('minListened')}</div></div>
      <div class="st-tile" style="animation-delay:.05s"><div class="n">${Math.round(s.read / 60)}</div><div class="l">${t('minRead')}</div></div>
      <div class="st-tile" style="animation-delay:.1s"><div class="n">${S.books.length}</div><div class="l">${t('totalBooks')}</div></div>
      <div class="st-tile" style="animation-delay:.15s"><div class="n">${qn}</div><div class="l">${t('quotesSaved')}</div></div>
    </div>
    <div class="st-week"><h3>${t('thisWeek')}<small><span><i style="background:var(--accent)"></i>${t('listen')}</span><span><i style="background:var(--ink)"></i>${t('read')}</span></small></h3>
    <div class="bars">${s.week.map((d, i) => `<div class="b ${i === 6 ? 'today' : ''}"><div class="stack" style="height:${Math.max(4, (d.listen + d.read) / max * 100)}%">${d.listen ? `<i style="height:${d.listen / (d.listen + d.read) * 100}%;background:var(--accent);animation-delay:${i * .05}s"></i>` : ''}${d.read ? `<i style="height:${d.read / (d.listen + d.read) * 100}%;background:var(--ink);animation-delay:${i * .05}s"></i>` : ''}</div><span class="d">${dn.format(d.date)}</span></div>`).join('')}</div></div>`;
}
setInterval(() => {
  if (player.playing) track('listen', 5);
  else if (S.screen === 'reader' && S.mode === 'read' && document.visibilityState === 'visible' && Date.now() - S.lastInteract < 90000) track('read', 5);
}, 5000);
document.addEventListener('touchstart', () => { S.lastInteract = Date.now(); }, { passive: true });

/* ------------------------------ media session ------------------------------ */
function mediaArtwork() {
  // the approved Murmur cat icon — never the book cover. Absolute URLs so iOS Now Playing can fetch them.
  return [96, 128, 192, 256, 384, 512].map(s => ({ src: new URL(`icons/icon-${s}.png`, location.href).href, sizes: `${s}x${s}`, type: 'image/png' }));
}
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !S.book) return;
  try {
    const chapter = chapterName() || '';
    const sent = S.model?.sents?.[S.model?.words?.[S.curW]?.s]?.text || '';
    const title = chapter || (sent.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Murmur');
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: S.book.author || 'Murmur',
      album: S.book.title || 'Murmur',
      artwork: mediaArtwork()
    });
    const bind = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch {} };
    bind('play', () => { player.paused ? player.resume() : startPlayback(Math.max(0, S.curW)); });
    bind('pause', () => player.pause());
    bind('previoustrack', () => player.skip(-1));
    bind('nexttrack', () => player.skip(1));
    bind('seekbackward', () => player.skip(-1));
    bind('seekforward', () => player.skip(1));
    bind('stop', () => player.stop());
    navigator.mediaSession.playbackState = player.playing ? 'playing' : player.paused ? 'paused' : 'none';
  } catch {}
}

/* ------------------------------ relay / boot ------------------------------ */
async function checkRelay() {
  S.relay = (prefs.relay || S.cfgRelay || '').replace(/\/$/, '');
  const ok = await neural.ready();
  if (ok) {
    S.neuralOk = true;
    if (S.neuralFailed) { S.neuralFailed = false; if (S.book && prefs.engine !== 'device') syncVoice(); }
  } else {
    // engines.js keeps relayOk sticky until two failed probes
    S.neuralOk = !!neural.relayOnline?.();
  }
  try { const idx = await fetch('audio/index.json').then(r => r.json()); S.staticBooks = new Set(Object.keys(idx.books || {})); } catch { if (!S.staticBooks) S.staticBooks = new Set(); }
  return S.neuralOk;
}
/** re-probe the Worker: online event, visibility, voice sheet, or backoff after a drop. */
function scheduleRelayProbe(ms) {
  clearTimeout(S.reNeural);
  S.reNeural = setTimeout(() => probeRelay({ reason: 'retry' }), ms);
}
async function probeRelay(opts = {}) {
  if (S.probeBusy) return S.neuralOk;
  S.probeBusy = true;
  try {
    const was = S.neuralOk, failed = S.neuralFailed;
    const ok = await checkRelay();
    if (ok && (failed || !was) && S.book && prefs.engine !== 'device') {
      neural.invalidateVoices?.();
      await syncVoice();
    }
    if (!ok) scheduleRelayProbe(Math.min(60000, (S.probeBackoff = Math.min(60000, (S.probeBackoff || 4000) * 1.7))));
    else S.probeBackoff = 4000;
    return ok;
  } finally { S.probeBusy = false; }
}
function watchRelay() {
  if (S.relayWatched) return; S.relayWatched = true;
  window.addEventListener('online', () => probeRelay({ reason: 'online' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') probeRelay({ reason: 'visible' }); });
  window.addEventListener('pageshow', () => probeRelay({ reason: 'pageshow' }));
  setInterval(() => { if (document.visibilityState === 'visible') probeRelay({ reason: 'tick' }); }, 60000);
}
async function boot() {
  applyLook(); applyI18n();
  history.replaceState({ screen: 'library' }, '');
  await loadBooks(); renderLibrary();
  // an OCR job interrupted by closing the app continues where it stopped (pages already done are kept)
  const pend = S.books.find(b => b.ocr && (b.ocr.state === 'running' || b.ocr.state === 'queued') && b.ocr.done < b.ocr.total);
  if (pend) { ensureOCRListener(); ocrMod().then(o => o.runOCR(pend)); }
  $('#ocrPill button').onclick = async () => { const b = S.book; if (!b || !b.ocr) return; const o = await ocrMod(); ensureOCRListener(); if (o.ocrRunning(b.id)) { o.cancelOCR(b.id); } else { b.ocr.state = 'queued'; updateOCRPill(b); o.runOCR(b); } };
  try { const c = await fetch('config.json', { cache: 'no-store' }).then(r => r.json()); S.cfgRelay = c.relay || ''; } catch {}
  watchRelay();
  checkRelay().then(() => { if (S.book) syncVoice(); });
  device.voices().then(v => { S.deviceVoices = v; });
  $('#pFocus').classList.toggle('on', !!prefs.focus); $('#pBi').classList.toggle('on', !!prefs.bi);
  setupUpdates();
}
/* ------------------------------ updates ------------------------------ */
// An installed iPhone web app is resumed from memory for days without a page load, so checking only at boot
// (and only once per session, as before) could leave an old build running. Check at boot, whenever the app
// comes back to the foreground and every 30 min; when a newer version is published, reload as soon as it's safe.
function setupUpdates() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js?v=' + APP_VERSION, { updateViaCache: 'none' }).catch(() => {});
  // a new service worker took over (it skips waiting + claims clients) → this page runs old code: reload
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reloadWhenIdle('sw'); });
  let last = 0;
  const check = async () => {
    if (Date.now() - last < 15000) return; last = Date.now();
    try {
      const v = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
      if (!v.version || v.version === APP_VERSION) return;
      const reg = await navigator.serviceWorker.getRegistration(); reg && reg.update().catch(() => {});
      reloadWhenIdle(v.version);
    } catch {}
  };
  check();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('pageshow', e => { if (e.persisted) check(); });
  window.addEventListener('focus', check);
  setInterval(check, 30 * 60 * 1000);
}
function reloadWhenIdle(ver) {
  // never twice for the same target version in a row (no loops if the CDN is briefly behind)
  const key = 'murmur:reloadedFor';
  if (ver !== 'sw' && sessionStorage.getItem(key) === ver) return;
  const busy = () => player.playing || $('#sheet').classList.contains('show') || (OCR && S.books.some(b => OCR.ocrRunning(b.id)));
  const go = () => { if (ver !== 'sw') sessionStorage.setItem(key, ver); savePos(); location.reload(); };
  if (!busy()) return setTimeout(go, 300);
  toast(t('updateReady'), 4000);
  const iv = setInterval(() => { if (!busy()) { clearInterval(iv); go(); } }, 5000);
}
window.murmur = { S, prefs, player, openBook, setPages, openNav, jumpTo, appendNext, bookToc, setWindow, ensureWindow, chapterName, pageInfo, bookProg, enterTrOnly, exitTrOnly, applyLook, gotoSection, setBare, setMode, startPlayback, setCurrent, toggleFocus, setBilingual, openLook, openTimer, setTimer, openVoices, openSpeed, saveQuote, renderQuotes, renderStats, show, openAdd, checkRelay, probeRelay, positionHL, showPop, hidePop, hideHint, updateMediaSession, mediaArtwork, layoutPages, glyphBox, fontInk, shareSelection, buildModel, ttsStats, CATALOG, neural, device, engine, syncVoice, positionHandles, pageTo, turnPage, scrollerXY, focusWord, renderFocus };
boot();
