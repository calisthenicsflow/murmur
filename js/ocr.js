// OCR for scanned (image-only) PDFs: pdf.js renders one page at a time (~1500 px wide),
// tesseract.js (lazy, from jsDelivr, in a Web Worker) recognises it, and every finished page is
// saved into the book at once — so it is read/listened to while the rest is still being recognised,
// and never recognised twice. The PDF itself waits in IndexedDB until the job is done.
import { db } from './db.js?v=1.7.2';
import { openPDF } from './importers.js?v=1.7.2';
import { wc } from './text.js?v=1.7.2';
import { t } from './i18n.js?v=1.7.2';

const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/';
const CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1';
const TLANG = { en: 'eng', ru: 'rus', uk: 'ukr', be: 'bel', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', pt: 'por', pl: 'pol', nl: 'nld', cs: 'ces', sv: 'swe', fi: 'fin', tr: 'tur', kk: 'kaz', bg: 'bul', sr: 'srp' };
export function ocrLangs(...hints) {
  const set = new Set(['rus', 'eng']); // Murmur's own languages are always in (an English UI must still read a Russian scan)
  hints.flat().filter(Boolean).forEach(h => { const l = TLANG[String(h).slice(0, 2).toLowerCase()]; if (l) set.add(l); });
  return [...set].sort((a, b) => (a === 'eng') - (b === 'eng')).join('+'); // e.g. rus+eng
}
const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s);
});

/* rebuild the page from tesseract's blocks, dropping low-confidence words / lines
   (illustrations and decorative lettering come out as "~~ lll HB. pr" otherwise) */
const SYM = /^[^\p{L}\p{N}«»“”"'(—–]+$/u;
export function pageText(data) {
  if (!data.blocks || !data.blocks.length) return data.text || '';
  const out = [];
  for (const bl of data.blocks) for (const par of bl.paragraphs || []) {
    const lines = [];
    for (const ln of par.lines || []) {
      const ws = (ln.words || []).filter(w => w.text && !SYM.test(w.text) && w.confidence >= 35);
      if (!ws.length) continue;
      const conf = ws.reduce((a, w) => a + w.confidence, 0) / ws.length;
      const letters = ws.map(w => w.text).join('').replace(/[^\p{L}]/gu, '').length;
      if (conf < 58 || letters < 2) continue;
      lines.push(ws.map(w => w.text).join(' '));
    }
    if (lines.length) out.push(lines.join('\n'));
  }
  return out.join('\n\n');
}

/* tidy raw OCR text: hyphenated line breaks, page numbers, running headers, line-wrapped paragraphs */
export function cleanOCR(raw, seen) {
  let lines = raw.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim());
  const isJunk = l => !l || /^[\d\s.\-–—ivxlc]{1,8}$/i.test(l) || (l.length < 4 && !/[.!?]$/.test(l)) || ((l.match(/\p{L}/gu) || []).length < l.length * 0.45 && l.length < 30);
  // running header/footer: the same short line at the top/bottom of several pages
  const key = l => l.toLowerCase().replace(/[\d\s]+/g, ' ').trim();
  const nonEmpty = lines.filter(Boolean);
  [nonEmpty[0], nonEmpty[nonEmpty.length - 1]].forEach(l => { if (l && l.length < 70) { const k = key(l); seen[k] = (seen[k] || 0) + 1; } });
  lines = lines.map(l => (l && l.length < 70 && seen[key(l)] >= 2 && !/[.!?…]$/.test(l)) ? '' : l).filter((l, i, a) => !(isJunk(l) && l));
  let txt = '';
  for (const l of lines) {
    if (!l) { if (txt && !txt.endsWith('\n\n')) txt += '\n\n'; continue; }
    if (!txt || txt.endsWith('\n\n')) { txt += l; continue; }
    if (/\p{L}[-‐¬]$/u.test(txt) && /^\p{Ll}/u.test(l)) txt = txt.slice(0, -1) + l;   // перено-\nсы → переносы
    else txt += ' ' + l;
  }
  return txt.replace(/([^.!?…:;»"”)\n])\n\n(?=[\p{Ll}—–])/gu, '$1 ')   // a paragraph split mid-sentence
    .replace(/[ \t]+/g, ' ').replace(/\s+([,.;:!?»)])/g, '$1').replace(/([«(])\s+/g, '$1').trim();
}

let job = null;            // one OCR job at a time (memory on iPhone)
const listeners = new Set();
export const onOCR = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (book, extra = {}) => listeners.forEach(f => { try { f(book, extra); } catch {} });
export const ocrRunning = id => job && job.id === id && !job.cancel;
export function cancelOCR(id) { if (job && (!id || job.id === id)) { job.cancel = true; } }

/** recognise the remaining pages of `book` (book.ocr = { total, done, langs }); saves after every page */
export async function runOCR(book) {
  if (job) { if (job.id === book.id) return; job.cancel = true; await job.p; }
  const my = { id: book.id, cancel: false }; job = my;
  my.p = (async () => {
    let worker = null, pdf = null;
    try {
      const blob = await db.get('files', book.id);
      if (!blob) throw new Error('nofile');
      book.ocr.state = 'running'; emit(book);
      // stored as raw bytes (iOS WebViews / some WebKit builds can't keep File/Blob objects in IndexedDB);
      // older entries may still be Blobs
      let bytes = blob instanceof Uint8Array ? blob.slice() : blob instanceof ArrayBuffer ? new Uint8Array(blob.slice(0)) : typeof blob.arrayBuffer === 'function' ? new Uint8Array(await blob.arrayBuffer()) : null;
      if (!bytes || !bytes.length) throw new Error('stored PDF is unreadable — import the file again');
      pdf = await openPDF(bytes);
      await loadScript(TESS + 'tesseract.min.js');
      worker = await window.Tesseract.createWorker(book.ocr.langs || 'rus+eng', 1, { workerPath: TESS + 'worker.min.js', corePath: CORE, logger: m => { if (m.status === 'recognizing text') emit(book, { pageProgress: m.progress }); } });
      await worker.setParameters({ preserve_interword_spaces: '0' });
      const seen = book.ocr.seen || {};
      for (let i = book.ocr.done + 1; i <= book.ocr.total; i++) {
        if (my.cancel) break;
        const t0 = performance.now();
        const page = await pdf.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(3, 1500 / Math.max(vp1.width, 1));
        const vp = page.getViewport({ scale });
        const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const { data } = await worker.recognize(cv, {}, { text: true, blocks: true });
        cv.width = cv.height = 0; page.cleanup();
        let text = cleanOCR(pageText(data), seen);
        if ((data.confidence || 0) < 65 && wc(text) < 8) text = ''; // covers / illustrations: a few stray letters, not text
        book.ocr.done = i; book.ocr.seen = seen; book.ocr.ms = (book.ocr.ms || 0) + (performance.now() - t0);
        book.ocr.conf = [...(book.ocr.conf || []), Math.round(data.confidence || 0)].slice(-2000);
        // no title in the PDF metadata: a short ALL-CAPS title page among the first pages names the book
        let titled = false;
        if (book.ocr.titleAuto && i <= 6) {
          const raw = (data.text || '').split(/\s+/).filter(w => w && !SYM.test(w)).join(' ').trim(), L = raw.replace(/[^\p{L}]/gu, '');
          if (wc(raw) >= 2 && wc(raw) <= 12 && L.length > 8 && L.replace(/[^\p{Lu}]/gu, '').length > L.length * 0.85) {
            const tl = raw.toLowerCase(); book.title = tl.charAt(0).toUpperCase() + tl.slice(1); book.ocr.titleAuto = false; titled = true;
            book.sections.forEach(x => x.title = book.title);
          }
        }
        if (wc(text) >= 3) book.sections.push({ label: `${t('pageShort')} ${i}`, title: book.title, text, page: i });
        await db.set('books', book.id, book);
        emit(book, { page: i, added: wc(text) >= 3, titled });
      }
      if (book.ocr.done >= book.ocr.total) { book.ocr.state = 'done'; await db.del('files', book.id); }
      else book.ocr.state = 'paused';
      await db.set('books', book.id, book); emit(book);
    } catch (e) {
      console.warn('ocr failed', e);
      book.ocr.state = 'error'; book.ocr.error = String(e && e.message || e); await db.set('books', book.id, book); emit(book, { error: e });
    } finally {
      try { await worker?.terminate(); } catch {}
      try { pdf?.destroy(); } catch {}
      if (job === my) job = null;
    }
  })();
  return my.p;
}
