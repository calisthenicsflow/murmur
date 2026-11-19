import { db } from './db.js?v=1.2.2';
import { t, uiLang, setUiLang, plural } from './i18n.js';
import { buildModel, detectLang, wc, wordSpans } from './text.js?v=1.2.2';
import { coverSVG, autoCover } from './covers.js?v=1.2.2';
import { createWebSpeechEngine, createEdgeEngine, langName, nativeName, regionName, SILENT } from './engines.js?v=1.2.2';
import { CURATED, PREVIEW_TEXT } from './voices.js?v=1.2.2';
import { Player } from './player.js?v=1.2.2';
import { translateMany } from './translate.js?v=1.2.2';
import { track, summary } from './stats.js?v=1.2.2';
import { renderCard, shareCard } from './quotes.js?v=1.2.2';
import { fromText, fromPDF, fromEPUB, fromURL } from './importers.js?v=1.2.2';
import { SAMPLES } from './samples.js?v=1.2.2';

export const APP_VERSION = '1.2.2';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = {
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
  document.body.classList.toggle('align-left', prefs.align === 'left' || prefs.fs >= 28); // justify makes huge gaps in a narrow column at big sizes
  const tc = { paper: '#EFEDEA', sepia: '#F2E8D6', night: '#131315' }[prefs.theme];
  $('meta[name=theme-color]').setAttribute('content', tc);
  requestAnimationFrame(() => positionHL(true));
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
      if (tb === 'file') pane.innerHTML = `<div class="drop" id="drop">${ICON.file}<b id="fname">${t('choose')}</b><small>${t('fileHint')}</small></div>`;
      if (tb === 'url') pane.innerHTML = `<input class="inp" id="addUrl" type="url" inputmode="url" autocapitalize="off" placeholder="${t('urlHint')}">`;
      if (tb === 'file') pane.querySelector('#drop').onclick = () => { const fi = $('#fileIn'); fi.value = ''; fi.onchange = () => { fileObj = fi.files[0]; if (fileObj) pane.querySelector('#fname').textContent = fileObj.name; }; fi.click(); };
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
        err.textContent = e.message === 'empty' ? t('emptyText') : tab === 'url' ? t('urlFail') : tab === 'file' ? (e.message === 'nofile' ? t('fileHint') : importErr(e, fileObj)) : t('emptyText');
      } finally { go.disabled = false; lbl.textContent = t('importBtn'); }
    };
  });
}

function importErr(e, f) {
  const code = e.code || e.message, fmt = e.fmt || ((f?.name || '').match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toUpperCase();
  const k = { drm: 'errDRM', mobiHuff: 'errHuff', djvu: 'errDjvu', comic: 'errComic', oldDoc: 'errOldDoc', image: 'errImage', unsupported: 'errUnsupported', broken: 'errBroken' }[code];
  return (k ? t(k) : t('fileFail') + (fmt ? ` (${fmt})` : '')).replace('{fmt}', fmt || t('thisFile'));
}

/* ------------------------------ scanned PDFs → OCR ------------------------------ */
let OCR = null; const ocrMod = async () => OCR || (OCR = await import('./ocr.js?v=' + APP_VERSION));
async function startScanned(r, file, shelf, body, go) {
  const o = await ocrMod();
  const book = { id: 'u-' + uid(), title: r.title || 'Untitled', author: r.author || '', lang: uiLang() === 'ru' ? 'ru' : 'en', lv: 2, shelf, sections: [], createdAt: Date.now(),
    ocr: { total: r.pages, done: 0, state: 'queued', titleAuto: !!r.titleFromName, langs: o.ocrLangs(uiLang(), navigator.languages || []) } };
  book.cover = autoCover(book.title + book.id);
  await db.set('files', book.id, file);
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
    if (x.titled) { b.cover = autoCover(b.title + b.id); db.set('books', b.id, b); renderLibrary(); if (S.book && S.book.id === b.id) { $('#rdMini').textContent = b.title; if (!S.book.sections[S.sec]?.title || true) $('#rdTitle').textContent = b.title; } }
    if (S.book && S.book.id === b.id) { S.book = b; updateOCRPill(b, x); if (x.added) { updateNextBtn(); if (S.waitNext && S.sec < b.sections.length - 1) { S.waitNext = false; gotoSection(S.sec + 1, true); } } }
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
  const b = S.book; if (!b) return; const last = S.sec >= b.sections.length - 1;
  const waiting = last && b.ocr && b.ocr.state !== 'done';
  $('#rdNext').innerHTML = waiting ? `<div class="end">${t('ocrWaiting')}</div>` : last ? `<div class="end">— ${t('end')} —</div>` : `<button id="nextSec">${t('nextChapter')} ${ICON.right}</button>`;
  $('#nextSec') && ($('#nextSec').onclick = () => gotoSection(S.sec + 1, false));
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
  S.sec = Math.min(b.pos?.sec || 0, b.sections.length - 1);
  setMode(autoplay ? 'listen' : 'read', true);
  show('reader');
  setBare(prefs.bare, false);
  renderSection(b.pos?.w || 0);
  setTimeout(() => { if (S.screen === 'reader' && !prefs.bare) hint('tapHide', t('hintTapHide')); }, 1200);
  if (autoplay) { unlockAudio(); startPlayback(S.curW >= 0 ? S.curW : 0); }
}
function leaveReader() { player.stop(); savePos(); hidePop(); $('#focus').classList.remove('show'); updateMediaSession(); }
$('#rdBack').onclick = () => history.back();

function renderSection(startWord = 0, scroll = true) {
  const b = S.book, sec = b.sections[S.sec];
  S.model = buildModel(sec.text, b.lang, prefs.skip);
  player.setModel(S.model, b.lang);
  const { paras, sents, words } = S.model;
  $('#rdLabel').textContent = sec.label || (b.sections.length > 1 ? `${S.sec + 1} / ${b.sections.length}` : (b.author || shelfName(b.shelf || 'mine')));
  $('#rdTitle').textContent = sec.title || b.title;
  $('#rdMini').textContent = sec.title || b.title;
  const tr = S.trans[transKey()] || [];
  let html = '', first = true;
  for (const p of paras) {
    if (!p.sents.length) continue;
    html += `<p class="${first && !p.skip ? 'first' : ''}${p.skip ? ' skip' : ''}">`;
    first = false;
    for (const s of p.sents) {
      html += `<span class="s" data-s="${s}">` + sents[s].words.map(w => `<span class="w${words[w].say ? '' : ' sk'}${/^\(?(https?:|www\.)/i.test(words[w].t) ? ' u' : ''}" data-w="${w}">${esc(words[w].t)}</span>`).map((h, k) => h + (words[sents[s].words[k]].ns ? '' : ' ')).join('').trimEnd() + '</span>';
      html += `<span class="tr${tr[s] ? '' : ' load'}" data-t="${s}">${tr[s] ? trHtml(tr[s]) : '·'}</span> `;
    }
    html += '</p>';
  }
  const art = $('#rdText');
  art.innerHTML = '<div class="hl" id="hl"></div>' + html;
  art.lang = b.lang;
  S.wordEls = []; art.querySelectorAll('.w').forEach(el => { S.wordEls[+el.dataset.w] = el; });
  S.sentEls = []; art.querySelectorAll('.s').forEach(el => { S.sentEls[+el.dataset.s] = el; });
  S.curW = -1; S.curS = -1;
  art.classList.toggle('bi', prefs.bi);
  // translations arrive asynchronously and shift the layout; keep the floating highlight glued to its word
  if (!art._ro && window.ResizeObserver) { let raf = 0; art._ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => positionHL(true)); }); art._ro.observe(art); }
  updateNextBtn(); updateOCRPill(b);
  const sw = Math.min(startWord, words.length - 1);
  setCurrent(Math.max(0, sw), false);
  if (scroll) requestAnimationFrame(() => { if (sw > 0) scrollToWord(sw, false); else $('#rdScroll').scrollTop = 0; });
  if (prefs.bi) ensureTranslations();
  updateProgress(); updateMarkBtn();
  if (prefs.focus) renderFocus(true);
  // voices for this language
  S.voiceReady = syncVoice();
}
function gotoSection(i, play) {
  if (!S.book || i < 0 || i >= S.book.sections.length) return;
  player.stop(); S.sec = i; S.book.pos = { sec: i, w: 0 }; savePos();
  renderSection(0);
  if (play) startPlayback(0);
}

function setCurrent(w, fromPlayer) {
  if (!S.model || w < 0 || !S.model.words[w]) return;
  const prev = S.curW; S.curW = w;
  const s = S.model.words[w].s;
  if (prev >= 0 && S.wordEls[prev]) S.wordEls[prev].classList.remove('cw');
  if (s !== S.curS) {
    if (S.curS >= 0 && S.sentEls[S.curS]) S.sentEls[S.curS].classList.remove('cs');
    S.curS = s; S.sentEls[s]?.classList.add('cs');
    if (prefs.focus) renderFocus();
    updateProgress();
    if (fromPlayer) { S.book.pos = { sec: S.sec, w: S.model.sents[s].words[0] }; savePosSoon(); updateMarkBtn(); }
  }
  const active = S.mode === 'listen' && (player.playing || player.paused);
  if (active) S.wordEls[w]?.classList.add('cw');
  positionHL();
  if (prefs.focus) focusWord(w);
  if (fromPlayer) autoScroll(w);
}
function positionHL(instant) {
  const hl = $('#hl'); if (!hl) return;
  const el = (S.trEl && S.trEl.isConnected && S.trEl) || S.wordEls[S.curW];
  const active = S.mode === 'listen' && (player.playing || player.paused) && el;
  if (!active) { hl.classList.remove('on'); return; }
  // a word broken across two lines (hyphenation) would make one huge box over both lines:
  // paint that word inline instead and park the floating box
  $$('#rdText .split').forEach(x => x !== el && x.classList.remove('split'));
  if (el.getClientRects().length > 1) { el.classList.add('split'); hl.classList.remove('on'); return; }
  el.classList.remove('split');
  const art = $('#rdText').getBoundingClientRect(), r = el.getBoundingClientRect();
  if (instant) hl.style.transition = 'none';
  hl.style.transform = `translate(${r.left - art.left - 3}px, ${r.top - art.top - 1}px)`;
  hl.style.width = r.width + 6 + 'px'; hl.style.height = r.height + 2 + 'px';
  hl.classList.add('on');
  if (instant) { hl.offsetWidth; hl.style.transition = ''; }
}
function scrollEl(el, smooth = true) {
  const sc = $('#rdScroll'); const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.33;
  sc.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}
function scrollToWord(w, smooth = true) {
  const el = S.wordEls[w], sc = $('#rdScroll'); if (!el) return;
  const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight * 0.33;
  sc.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}
function autoScroll(w) {
  if (prefs.focus) return;
  const el = S.wordEls[w], sc = $('#rdScroll'); if (!el) return;
  if (Date.now() - S.lastUserScroll < 4000) { $('#recenter').classList.add('show'); return; }
  const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
  if (y < sc.clientHeight * 0.16 || y > sc.clientHeight * 0.56) { S.autoScrolling = Date.now(); scrollToWord(w); }
}
$('#recenter').onclick = () => { S.lastUserScroll = 0; $('#recenter').classList.remove('show'); scrollToWord(S.curW); };
['touchstart', 'wheel'].forEach(ev => $('#rdScroll').addEventListener(ev, () => { S.lastUserScroll = Date.now(); S.lastInteract = Date.now(); }, { passive: true }));
$('#rdScroll').addEventListener('scroll', () => {
  const sc = $('#rdScroll');
  $('#rdMini').classList.toggle('show', sc.scrollTop > 110);
  hidePop();
  if (S.mode === 'read' && !player.playing) readPosSoon();
  if (Date.now() - S.lastUserScroll > 4000) $('#recenter').classList.remove('show');
}, { passive: true });
const readPosSoon = debounce(() => {
  // first sentence visible in the top third → reading position
  const sc = $('#rdScroll'), top = sc.getBoundingClientRect().top + 90;
  for (const el of S.sentEls) { if (el && el.getBoundingClientRect().bottom > top) { const s = +el.dataset.s; const w = S.model.sents[s].words[0]; S.curW = w; S.curS = s; S.book.pos = { sec: S.sec, w }; savePos(); updateMarkBtn(); updateProgress(); break; } }
}, 250);
const savePos = () => { if (S.book) db.set('books', S.book.id, S.book); };
const savePosSoon = debounce(savePos, 1500);
window.addEventListener('resize', () => positionHL(true));
$('#app').addEventListener('scroll', () => { $('#app').scrollLeft = 0; $('#app').scrollTop = 0; });
document.fonts && document.fonts.ready.then(() => positionHL(true));

function updateProgress() {
  if (!S.model) return;
  const n = S.model.sents.length, s = Math.max(0, S.curS);
  $('#pBar').style.width = $('#thinProg i').style.width = ((s + 1) / n * 100) + '%';
  $('#pPos').textContent = `${s + 1} / ${n}`;
  const left = S.model.words.length - (S.curW > 0 ? S.curW : 0);
  const min = Math.max(1, Math.round(left / (2.55 * player.rate) / 60));
  $('#pLeft').textContent = `${S.book.sections.length > 1 ? (S.sec + 1) + ' ' + t('chapterOf') + ' ' + S.book.sections.length + ' · ' : ''}~${min} ${t('min')}`;
}

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
  if (e.target.closest('.w, .tw, button, a, input, select, #rdNext')) return;
  if ($('#pop').classList.contains('show')) return hidePop();
  if (tapSel || String(getSelection() || '')) return;
  setBare(!prefs.bare);
});
/* one-time hints */
function hint(k, msg) {
  prefs.hints = prefs.hints || {}; if (prefs.hints[k]) return false;
  prefs.hints[k] = 1; savePrefs();
  if (msg) { const c = $('#coach'); c.innerHTML = msg; c.classList.add('show'); clearTimeout(S.coachT); S.coachT = setTimeout(() => c.classList.remove('show'), 5200); c.onclick = () => c.classList.remove('show'); }
  return true;
}

/* tap on text */
$('#rdText').addEventListener('click', e => {
  const w = e.target.closest('.w'); if (!w) return;
  const wi = +w.dataset.w;
  S.lastInteract = Date.now();
  if (S.mode === 'listen') { unlockAudio(); S.lastUserScroll = 0; startPlayback(wi); return; }
  showPop(+w.closest('.s').dataset.s, w);
});

/* ------------------------------ popover ------------------------------ */
function showPop(s, anchor) {
  const pop = $('#pop');
  $$('.s.sel').forEach(x => x.classList.remove('sel'));
  S.sentEls[s]?.classList.add('sel');
  pop.innerHTML = `<div class="trbox" id="popTr"></div>
    <button data-a="listen">${ICON.headph}<span>${t('listenFrom')}</span></button>
    <button data-a="quote">${ICON.quote}<span>${t('saveQuote')}</span></button>
    <button data-a="copy">${ICON.copy}<span>${t('copy')}</span></button>
    <button data-a="tr">${ICON.tr}<span>${t('translate')}</span></button><i class="ptr"></i>`;
  const r = anchor.getBoundingClientRect(); pop.classList.remove('below');
  pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('show');
  const pw = pop.offsetWidth, ph = pop.offsetHeight, vw = innerWidth;
  let x = Math.min(vw - pw - 10, Math.max(10, r.left + r.width / 2 - pw / 2)), y = r.top - ph - 12;
  if (y < 70) { y = r.bottom + 12; pop.classList.add('below'); }
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  pop.querySelector('.ptr').style.left = Math.min(pw - 20, Math.max(8, r.left + r.width / 2 - x - 6)) + 'px';
  const text = S.model.sents[s].text;
  pop.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'listen') { hidePop(); unlockAudio(); setMode('listen'); startPlayback(S.model.sents[s].words[0]); }
    if (a === 'quote') { await saveQuote(text); hidePop(); toast(t('quoteSaved')); }
    if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast('✕'); } hidePop(); }
    if (a === 'tr') {
      const box = pop.querySelector('#popTr'); box.textContent = t('translating'); box.classList.add('show');
      const to = biTarget(); const [tx] = await translateMany([text], S.book.lang, to).catch(() => [null]);
      box.textContent = tx || t('translationFail');
    }
  };
}
function hidePop() { $('#pop').classList.remove('show'); $$('.s.sel').forEach(x => x.classList.remove('sel')); }
document.addEventListener('click', e => { if (!e.target.closest('#pop') && !e.target.closest('#rdText')) hidePop(); });

/* ------------------------------ modes & playback ------------------------------ */
function setMode(m, silent) {
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
  if (prefs.engine === 'device' || S.neuralFailed) return device;
  if (S.neuralOk) return neural;                                         // relay online: any text
  if (S.book && S.staticBooks && S.staticBooks.has(S.book.id)) return neural; // pre-voiced sample book
  return device;
}
function voiceKey(lang, eng = engine()) { return eng.id + ':' + lang; }
async function syncVoice() {
  if (!S.book) return;
  const eng = engine(); player.engine = eng; player.rate = prefs.rate;
  const vs = await eng.voices().catch(() => []);
  let v = prefs.voices[voiceKey(S.book.lang)];
  if (!v || !vs.some(x => x.id === v)) v = eng.defaultVoice(S.book.lang, vs);
  player.voice = v;
  player.voiceFor = l => { const o = prefs.voices[voiceKey(l, eng)]; return o && vs.some(x => x.id === o) ? o : eng.defaultVoice(l, vs); };
  const vo = vs.find(x => x.id === v);
  $('#pVoice .v').textContent = vo ? vo.name : '—';
  $('#pVoice .dot').classList.toggle('neural', eng.id === 'neural');
  $('#pSpeed').textContent = fmtRate(prefs.rate);
  if (prefs.bi) await setupBilingualVoice();
}
async function setupBilingualVoice() {
  const eng = engine(), to = biTarget(), vs = await eng.voices().catch(() => []);
  let v = prefs.voices[voiceKey(to)]; if (!v || !vs.some(x => x.id === v)) v = eng.defaultVoice(to, vs);
  // translations are new text: without a relay, neural can't voice them, so the device voice reads them
  let te = eng, tv = v;
  if (eng.id === 'neural' && !S.neuralOk) { te = device; const dv = await device.voices().catch(() => []); tv = prefs.voices[voiceKey(to, device)] || device.defaultVoice(to, dv); }
  player.bilingual = prefs.bi ? { to, voice: tv, engine: te, readBoth: prefs.readTr, translate: s => getTrans(s), spans: x => wordSpans(x, to) } : null;
}
/** fetch the audio of the sentence that would play next, so Play starts instantly */
async function warmFirst() {
  try { await S.voiceReady; if (!S.model || player.playing) return; player.engine = engine(); const c = player.build(Math.max(0, S.curW))[0]; if (c && c.trans === undefined) player.engine.prefetch(c, c.voice || player.voice); } catch {}
}
function unlockAudio() { try { engine().unlock?.(); } catch {} }
async function startPlayback(w) {
  setMode('listen', true);
  $('#pPlay').classList.add('loading');
  await S.voiceReady; // voice for this book's language must be resolved first
  player.engine = engine();
  player.play(w);
  updateMediaSession();
}
player.on.word = w => { $('#pPlay').classList.remove('loading'); setCurrent(w, true); };
player.on.sentence = () => {};
player.on.state = () => {
  const p = $('#pPlay'); p.classList.toggle('playing', player.playing); if (!player.playing) p.classList.remove('loading');
  if (!player.playing && !player.paused) { $$('.w.cw').forEach(x => x.classList.remove('cw')); player.on.trans(-1, false); }
  positionHL();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused';
};
player.on.end = () => {
  if (S.timer && S.timer.endOfChapter) { stopTimer(true); return; }
  if (S.book && S.sec < S.book.sections.length - 1) { gotoSection(S.sec + 1, true); }
  else if (S.book && S.book.ocr && S.book.ocr.state === 'running') { S.waitNext = true; toast(t('ocrWaiting')); }
  else { toast(t('end')); }
};
player.on.error = e => {
  console.warn('speech error', e);
  $('#pPlay').classList.remove('loading');
  if (player.engine && player.engine.id === 'neural') {
    S.neuralOk = false; S.neuralFailed = true; toast(t('neuralOff'), 3200);
    syncVoice().then(() => startPlayback(S.curW >= 0 ? S.curW : 0));
    clearTimeout(S.reNeural); S.reNeural = setTimeout(async () => { S.neuralFailed = false; if (!(await checkRelay()) && !(S.book && S.staticBooks?.has(S.book.id))) S.neuralFailed = true; else if (!player.playing) syncVoice(); }, 45000);
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
  if (!prefs.focus && Date.now() - S.lastUserScroll > 4000) { const sc = $('#rdScroll'), r = el.getBoundingClientRect(), b = sc.getBoundingClientRect(); if (r.top < b.top + 90 || r.bottom > b.bottom - sc.clientHeight * 0.42) scrollEl(el); }
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
  $('#fStage').innerHTML = `${ctx(s - 1)}<div class="f-s cur f-enter${player.playing ? ' speaking' : ''}${sents[s].text.length > 330 ? ' xlong' : sents[s].text.length > 210 ? ' long' : ''}">${sents[s].words.map(w => `<span class="w" data-fw="${w}">${esc(words[w].t)}</span>${words[w].ns ? '' : ' '}`).join('').trimEnd()}</div>${prefs.bi ? `<div class="f-tr f-enter">${esc(tr[s] || '…')}</div>` : ''}${ctx(s + 1)}`;
  $('#fProg').textContent = `${s + 1} / ${sents.length}`;
  if (S.curW >= 0) focusWord(S.curW);
}
function focusWord(w) {
  const cur = $('#fStage .cur'); if (!cur) return;
  const active = S.mode === 'listen' && (player.playing || player.paused);
  cur.classList.toggle('speaking', active);
  cur.querySelectorAll('.w').forEach(el => { const i = +el.dataset.fw; el.classList.toggle('cw', active && i === w); el.classList.toggle('done', active && i < w); });
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
  setCurrent(S.model.sents[s].words[0], false); S.book.pos = { sec: S.sec, w: S.curW }; savePosSoon(); renderFocus();
});

/* ------------------------------ bilingual ------------------------------ */
const biTarget = () => prefs.biTo && prefs.biTo !== (S.book?.lang) ? prefs.biTo : (S.book?.lang === 'ru' ? 'en' : (uiLang() === 'ru' && S.book?.lang !== 'ru' ? 'ru' : (S.book?.lang === 'en' ? 'ru' : 'en')));
const transKey = () => S.book ? `${S.book.id}:${S.sec}:${biTarget()}` : '';
async function getTrans(s) {
  const k = transKey(); S.trans[k] = S.trans[k] || [];
  if (S.trans[k][s]) return S.trans[k][s];
  const [x] = await translateMany([S.model.sents[s].text], S.book.lang, biTarget());
  if (x) { S.trans[k][s] = x; fillTr(s, x); }
  return x;
}
function trHtml(x) { const sp = wordSpans(x, biTarget()); let h = '', p = 0; sp.forEach((r, k) => { h += esc(x.slice(p, r.start)) + `<span class="tw" data-k="${k}">${esc(x.slice(r.start, r.end))}</span>`; p = r.end; }); return h + esc(x.slice(p)); }
function fillTr(s, x) { const el = $(`.tr[data-t="${s}"]`); if (el) { el.innerHTML = trHtml(x); el.classList.remove('load'); } if (prefs.focus && s === S.curS) renderFocus(true); }
let trRun = 0;
async function ensureTranslations() {
  const my = ++trRun, k = transKey(), arr = S.trans[k] = S.trans[k] || [];
  const n = S.model.sents.length, start = Math.max(0, S.curS - 2);
  const order = [...Array(n).keys()].slice(start).concat([...Array(start).keys()]);
  for (let i = 0; i < order.length; i += 10) {
    if (my !== trRun || !prefs.bi) return;
    const idx = order.slice(i, i + 10).filter(s => !arr[s]); if (!idx.length) continue;
    const res = await translateMany(idx.map(s => S.model.sents[s].text), S.book.lang, biTarget()).catch(() => []);
    if (my !== trRun) return;
    let fails = 0;
    idx.forEach((s, j) => { if (res[j]) { arr[s] = res[j]; fillTr(s, res[j]); } else fails++; });
    if (fails === idx.length) { toast(t('translationFail')); idx.forEach(s => { const el = $(`.tr[data-t="${s}"]`); if (el) { el.classList.remove('load'); el.textContent = '—'; } }); return; }
  }
}
function setBilingual(on) {
  prefs.bi = on; savePrefs();
  $('#rdText').classList.toggle('bi', on); $('#pBi').classList.toggle('on', on);
  if (on) ensureTranslations(); else { trRun++; player.bilingual = null; }
  if (on && prefs.readTr) hint('biVoice', t('hintBiVoice'));
  // the main text keeps its language and voice; the translation line is voiced after each sentence unless switched off
  const wasPlaying = player.playing;
  setupBilingualVoice().then(() => { if (wasPlaying && player.playing) player.play(S.curW); });
  if (prefs.focus) renderFocus(true);
  requestAnimationFrame(() => { positionHL(true); if (S.curW > 0) scrollToWord(S.curW, false); });
}
$('#pBi').onclick = () => setBilingual(!prefs.bi);

/* ------------------------------ bookmarks ------------------------------ */
function curMark() { const b = S.book; if (!b || !S.model) return -1; return (b.marks || []).findIndex(m => m.sec === S.sec && S.model.words[m.w]?.s === S.curS); }
function updateMarkBtn() { $('#rdMark').classList.toggle('on', curMark() >= 0); }
$('#rdMark').onclick = () => {
  const b = S.book; b.marks = b.marks || []; const i = curMark();
  if (i >= 0) { b.marks.splice(i, 1); toast(t('bookmarkRemoved')); }
  else { const s = Math.max(0, S.curS); b.marks.push({ sec: S.sec, w: S.model.sents[s].words[0], text: S.model.sents[s].text.slice(0, 90), at: Date.now() }); toast(t('bookmarkAdded')); }
  savePos(); updateMarkBtn();
};

/* ------------------------------ more sheet ------------------------------ */
$('#rdMore').onclick = () => {
  const b = S.book;
  const toc = b.sections.map((s, i) => `<div class="row${i === S.sec ? ' cur' : ''}" data-sec="${i}"><div class="ic" style="font-family:var(--display);font-weight:700">${i + 1}</div><div class="tx"><b>${esc(s.title || s.label || b.title)}</b><small>${esc(s.label || '')}${s.label ? ' · ' : ''}${wc(s.text)} ${t('words')}</small></div></div>`).join('');
  const marks = (b.marks || []).map((m, i) => `<div class="row" data-mark="${i}"><div class="ic">${ICON.mark}</div><div class="tx"><b>${esc(b.sections[m.sec]?.title || b.title)}</b><small>${esc(m.text)}</small></div></div>`).join('') || `<div class="note">${t('noBookmarks')}</div>`;
  const langs = TR_LANGS.filter(l => l !== b.lang).map(l => `<option value="${l}" ${l === biTarget() ? 'selected' : ''}>${esc(langName(l))}</option>`).join('');
  openSheet(`<div class="sh-title">${esc(b.title)}<button class="x" data-close>${ICON.x}</button></div>
    <div class="row" data-tg="focus"><div class="ic">${ICON.focus}</div><div class="tx"><b>${t('focus')}</b></div><i class="sw ${prefs.focus ? 'on' : ''}"></i></div>
    <div class="row" data-tg="bi"><div class="ic">${ICON.tr}</div><div class="tx"><b>${t('bilingual')}</b></div><i class="sw ${prefs.bi ? 'on' : ''}"></i></div>
    <div class="row" style="cursor:default"><div class="tx" style="padding-left:48px"><b style="font-weight:500;font-size:14px;color:var(--ink2)">${t('translateTo')}</b></div><select id="biTo" style="width:auto;min-width:140px;padding:9px 12px;font-size:15px">${langs}</select></div>
    <div class="row" data-tg="both"><div class="ic">${ICON.headph}</div><div class="tx"><b>${t('readTr')}</b><small>${t('readTrHint')}</small></div><i class="sw ${prefs.readTr ? 'on' : ''}"></i></div>
    <div class="row" data-tg="skip"><div class="ic">${ICON.wand}</div><div class="tx"><b>${t('skipFiller')}</b><small>${t('skipFillerHint')}</small></div><i class="sw ${prefs.skip ? 'on' : ''}"></i></div>
    ${b.sections.length > 1 ? `<div class="sh-label">${t('contents')}</div>${toc}` : ''}
    <div class="sh-label">${t('bookmarks')}</div>${marks}`, body => {
    body.querySelectorAll('[data-tg]').forEach(r => r.onclick = () => {
      const k = r.dataset.tg, sw = r.querySelector('.sw');
      if (k === 'focus') { toggleFocus(); sw.classList.toggle('on', prefs.focus); }
      if (k === 'bi') { setBilingual(!prefs.bi); sw.classList.toggle('on', prefs.bi); }
      if (k === 'both') { prefs.readTr = !prefs.readTr; savePrefs(); sw.classList.toggle('on', prefs.readTr); if (prefs.readTr && !prefs.bi) { setBilingual(true); body.querySelector('[data-tg=bi] .sw').classList.add('on'); } else { const wp = player.playing; setupBilingualVoice().then(() => { if (wp && player.playing) player.play(S.curW); }); } }
      if (k === 'skip') { prefs.skip = !prefs.skip; savePrefs(); sw.classList.toggle('on', prefs.skip); const w = S.curW; player.stop(); renderSection(w); }
    });
    body.querySelector('#biTo').onchange = async e => { const wp = player.playing, w = S.curW; prefs.biTo = e.target.value; savePrefs(); renderSection(w, false); if (prefs.bi) ensureTranslations(); await S.voiceReady; if (wp) startPlayback(w); };
    body.querySelectorAll('[data-sec]').forEach(r => r.onclick = () => { closeSheet(); gotoSection(+r.dataset.sec, player.playing); });
    body.querySelectorAll('[data-mark]').forEach(r => r.onclick = () => {
      const m = b.marks[+r.dataset.mark]; closeSheet();
      if (m.sec !== S.sec) { player.stop(); S.sec = m.sec; renderSection(m.w); } else { setCurrent(m.w, false); scrollToWord(m.w); }
      if (player.playing) startPlayback(m.w);
    });
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
    const eng = () => engine();
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
      const e = eng(); const neuralSel = prefs.engine !== 'device'; const bl = S.book.lang;
      body.querySelectorAll('#sgEng button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'neural') === neuralSel));
      const st = S.neuralOk ? `<span class="status ok"><i></i>${t('online')}</span> · ${t('neuralHint')}` : (e.id === 'neural' ? `<span class="status ok"><i></i>${t('neural')}</span> · ${t('neuralSamples')}` : `<span class="status"><i></i>${t('offline')}</span> · ${t('neuralOffBook')}`);
      body.querySelector('#engNote').innerHTML = neuralSel ? st : t('deviceHint');
      const vs = await e.voices().catch(() => []); const q = body.querySelector('#vSearch').value.trim().toLowerCase();
      const cur = player.voice;
      const filt = vs.filter(v => !q || (v.name + ' ' + v.locale + ' ' + langName(v.lang) + ' ' + langName(v.lang, ui) + ' ' + nativeName(v.lang) + ' ' + (v.langName || '')).toLowerCase().includes(q));
      const groups = {};
      for (const v of filt) (groups[v.lang] = groups[v.lang] || []).push(v);
      const tr = prefs.bi ? biTarget() : null;
      const order = Object.keys(groups).sort((a, b) => (a === bl ? -2 : a === tr ? -1 : 0) - (b === bl ? -2 : b === tr ? -1 : 0) || langName(a, ui).localeCompare(langName(b, ui), ui));
      const row = v => `<div class="vrow ${v.id === cur ? 'on' : ''}" data-v="${esc(v.id)}" data-l="${v.lang}"><div class="av" style="background:${AV[v.name.length % AV.length]}">${esc(v.name[0])}</div><div class="tx"><b>${esc(v.name)}</b><small>${esc(v.engine === 'neural' ? [regionName(v.locale, ui), v.gender === 'Female' ? '♀' : v.gender === 'Male' ? '♂' : '', v.multi ? t('multilingual') : ''].filter(Boolean).join(' · ') : (v.detail || v.locale))}</small></div><button class="pv${PV.id === v.id ? (PV.loading ? ' loading' : ' playing') : ''}" data-pv="${esc(v.id)}" aria-label="${t('preview')}">${ICON.play}${ICON.stop}</button>${ICON.check}</div>`;
      const curHas = l => groups[l].some(v => v.id === cur);
      body.querySelector('#vList').innerHTML = order.map(l => `<details class="vgroup${l === bl ? ' cur' : ''}" ${l === bl || l === tr || q || curHas(l) ? 'open' : ''}><summary><span>${esc(label(l))}${l === bl ? ` <em>${t('thisText')}</em>` : l === tr ? ` <em>${t('translationLang')}</em>` : ''}</span><span>${groups[l].length}</span></summary>${groups[l].map(row).join('')}</details>`).join('') || `<div class="note">—</div>`;
    };
    body.querySelector('#sgEng').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      stopPreview();
      prefs.engine = b.dataset.v === 'device' ? 'device' : 'auto'; savePrefs();
      if (prefs.engine !== 'device' && !S.neuralOk) await checkRelay();
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
      // the choice is remembered for the language of the text (or for the translation language in bilingual mode)
      const bl = S.book.lang, forLang = prefs.bi && r.dataset.l === biTarget() && r.dataset.l !== bl ? r.dataset.l : bl;
      prefs.voices[voiceKey(forLang)] = r.dataset.v; savePrefs();
      if (forLang === bl) body.querySelectorAll('.vrow').forEach(x => x.classList.toggle('on', x === r));
      const wasPlaying = player.playing; await syncVoice(); if (wasPlaying) startPlayback(S.curW); else warmFirst();
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
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !S.book) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: S.book.sections[S.sec]?.title || S.book.title, artist: S.book.author || 'Murmur', album: S.book.title, artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.setActionHandler('play', () => player.resume());
    navigator.mediaSession.setActionHandler('pause', () => player.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => player.skip(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => player.skip(1));
  } catch {}
}

/* ------------------------------ relay / boot ------------------------------ */
async function checkRelay() {
  S.relay = (prefs.relay || S.cfgRelay || '').replace(/\/$/, '');
  S.neuralOk = await neural.ready();
  try { const idx = await fetch('audio/index.json').then(r => r.json()); S.staticBooks = new Set(Object.keys(idx.books || {})); } catch { S.staticBooks = new Set(); }
  return S.neuralOk;
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
  checkRelay().then(() => { if (S.book) syncVoice(); });
  device.voices().then(v => { S.deviceVoices = v; });
  $('#pFocus').classList.toggle('on', !!prefs.focus); $('#pBi').classList.toggle('on', !!prefs.bi);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js?v=' + APP_VERSION).catch(() => {});
    fetch('version.json', { cache: 'no-store' }).then(r => r.json()).then(v => {
      if (v.version && v.version !== APP_VERSION && !sessionStorage.getItem('murmur:reloaded')) { sessionStorage.setItem('murmur:reloaded', '1'); navigator.serviceWorker.getRegistration().then(r => r && r.update()).finally(() => setTimeout(() => location.reload(), 600)); }
    }).catch(() => {});
  }
}
window.murmur = { S, prefs, player, openBook, setMode, startPlayback, setCurrent, toggleFocus, setBilingual, openLook, openTimer, setTimer, openVoices, openSpeed, saveQuote, renderQuotes, renderStats, show, openAdd, checkRelay, positionHL, showPop };
boot();
