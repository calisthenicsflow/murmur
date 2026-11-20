// Importers: plain text, PDF (pdf.js), EPUB (JSZip), web article (r.jina.ai reader).
import { splitSections, detectLang, wc } from './text.js?v=1.3.9';

const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s);
});

/* ------------------------------ book structure ------------------------------
   Every importer emits a flat stream of items — { h: 'Heading', lvl: nesting depth } or { t: 'paragraph' } —
   and itemsToBook turns it into
   · sections: rendering units (a chapter, or a ~1600-word part of a long one) with their own text, and
   · heads: the book's real headings inside each unit ({ p: paragraph index, t, lvl: 0 part · 1 chapter · 2 subsection }),
     shown in the text and in Contents exactly as the book names them. Nothing is invented: a book without
     headings simply has no Contents entries, untitled sections just continue the text. */
export const PART_RE = /^(часть|part|книга|book|том|volume|раздел)(?![\p{L}\p{N}])/iu;
const LABEL_RE = /^(глава|часть|книга|том|раздел|эпилог|пролог|предисловие|послесловие|приложение|chapter|part|book|volume|section|prologue|epilogue|appendix|letter|письмо)(?![\p{L}\p{N}])[\s\S]{0,22}$|^[IVXLCDM]{1,7}\.?$|^\d{1,3}\.?$/iu;
const HEAD_LINE = /^(chapter|глава|part|часть|book|книга|том|section|раздел|prologue|пролог|epilogue|эпилог)(?![\p{L}\p{N}])[\s\S]{0,70}$/iu;
// "IV" / "IV." alone, or "IV. Парубки гуляют" (roman numeral + short title, no closing period); case-sensitive
const ROMAN_LINE = /^[IVXLC]{1,7}\.?$|^[IVXLC]{1,7}\.\s+\p{Lu}[^…]{0,60}[^.…,;:]$/u;
// "Глава 5" / "CHAPTER V." alone, or with its title on the same line ("CHAPTER I. Down the Rabbit-Hole") — never a sentence
const LABEL_NUM_TITLE = /^(chapter|глава|part|часть|book|книга)\s+([\dIVXLC]+|[\p{L}]+)[.:]\s+[^.…]{1,70}$/iu;
const isHeadLine = t => t.length < 80 && (HEAD_LINE.test(t) && (!/[.!?]\s+\S/.test(t) || LABEL_NUM_TITLE.test(t)) || ROMAN_LINE.test(t));
const one = x => String(x || '').replace(/\s+/g, ' ').trim();
/** the lines of a multi-line title, joined the way a reader would say them: "Глава 1. Название", "Часть I — Название" */
export function joinTitle(parts) {
  parts = parts.map(one).filter(Boolean);
  return parts.reduce((acc, x) => !acc ? x : acc + (/[.!?:…;]$/.test(acc) ? ' ' : LABEL_RE.test(acc) ? '. ' : ' — ') + x, '');
}
const normT = x => one(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const START = /\*{0,3}\s*START OF (THE|THIS) PROJECT GUTENBERG E-?BOOK/i, END = /\*{0,3}\s*END OF (THE|THIS) PROJECT GUTENBERG E-?BOOK/i;
const PG_META = /Project Gutenberg|eBook|www\.|license|Release date|Language:|Credits:|Title:|Author:|Most recently updated|Illustrator:|Translator:|Character set|Produced by|^\*+$|^\[/i;
/** Project Gutenberg licence header / footer are not part of the book */
function stripGutenberg(items) {
  const n = items.length;
  let si = items.findIndex((x, i) => i < n * 0.4 && x.t && START.test(x.t));
  if (si >= 0) items = items.slice(si + 1);
  else {
    const k = items.findIndex((x, i) => i < 60 && x.t && /This (e-?book|ebook) is for the use of anyone anywhere/i.test(x.t));
    if (k >= 0) { let e = k; for (let i = k + 1; i < Math.min(items.length, k + 40); i++) if (items[i].t && PG_META.test(items[i].t)) e = i; items = items.slice(e + 1); }
  }
  const ei = items.findIndex((x, i) => i > items.length * 0.5 && x.t && END.test(x.t));
  if (ei >= 0) items = items.slice(0, ei);
  return items;
}
/** books with no structural headings: lines like "Глава 5" / "CHAPTER V" (+ a short title line) are the real headings */
function promoteHeads(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const x = items[i];
    if (x.t && isHeadLine(x.t)) {
      const nx = items[i + 1];
      let h = x.t.replace(/\.$/, '');
      if (nx && nx.t && nx.t.length < 70 && !/[.!?…]$/.test(nx.t) && !isHeadLine(nx.t) && !/[.:]\s+\S/.test(x.t) && items[i + 2]) { h = joinTitle([h, nx.t]); i++; }
      out.push({ h, lvl: PART_RE.test(x.t) ? 0 : 1 });
    } else out.push(x);
  }
  return out;
}
export function itemsToBook(items, title, lang, opts = {}) {
  items = items.map(x => x.h != null ? { h: one(x.h), lvl: x.lvl | 0 } : { t: one(x.t) }).filter(x => x.h || x.t);
  items = stripGutenberg(items);
  if (!items.some(x => x.h)) items = promoteHeads(items);
  // a contents page typed as headings ("CHAPTER XI" + a line, then the real "CHAPTER XI" later): the list is text, not chapters
  { const hi = items.map((x, i) => x.h ? i : -1).filter(i => i >= 0);
    hi.forEach((i, k) => { const nx = k + 1 < hi.length ? hi[k + 1] : items.length; const words = items.slice(i + 1, nx).reduce((a, x) => a + wc(x.t || ''), 0); if (words >= 15) return;
      const n = normT(items[i].h); if (n && hi.slice(k + 1).some(j => normT(items[j].h).startsWith(n) && j > nx)) items[i] = { t: items[i].h }; }); }
  // the book's own title / author line at the top (title page): not chapters
  { const fh = items.findIndex(x => x.h); const hs = items.filter(x => x.h), soleTop = fh >= 0 && hs.filter(x => x.lvl <= items[fh].lvl).length === 1 && hs.length >= 4;
    if (fh >= 0 && fh < 5 && opts.dropTitle !== false && (normT(items[fh].h) === normT(title) || soleTop)) { items.splice(fh, 1); const nh = items.findIndex(x => x.h); if (nh >= 0 && nh < 5 && /^(by|автор|авторы)\s/i.test(items[nh].h)) items[nh] = { t: items[nh].h }; } }
  // a heading with no text of its own, followed by one of the same or higher rank (an empty title page / index page entry): not a chapter
  items = items.filter((x, i) => !(x.h && items[i + 1] && items[i + 1].h && items[i + 1].lvl <= x.lvl));
  // the title page heading repeats the book title: not a chapter
  while (opts.dropTitle !== false && items[0] && items[0].h && (normT(items[0].h) === normT(title) || normT(title).includes(normT(items[0].h)) && items[1] && items[1].h)) items.shift();
  // heading levels → 0 part · 1 chapter · 2 subsection
  const heads = items.filter(x => x.h), lv = [...new Set(heads.map(h => h.lvl))].sort((a, b) => a - b), rank = l => lv.indexOf(l);
  const tops = heads.filter(h => rank(h.lvl) === 0), partish = tops.length > 0 && tops.filter(h => PART_RE.test(h.h)).length >= tops.length * 0.5;
  const disp = l => lv.length >= 3 ? Math.min(2, rank(l)) : lv.length === 2 ? (partish ? rank(l) : rank(l) + 1) : (partish ? 0 : 1);
  const units = []; let u = null, cur = '', split = false;
  const open = cont => { u = { paras: [], heads: [], title: cur, n: 0, cont }; units.push(u); split = false; };
  for (const x of items) {
    if (x.h) {
      const l = disp(x.lvl);
      if (!u || (l <= 1 && u.paras.length) || (split && u.paras.length)) open(false);
      u.heads.push({ p: u.paras.length, t: x.h, lvl: l });
      if (l <= 1) { if (!u.paras.length && (l === 1 || !u.heads.some(h => h.lvl === 1))) u.title = x.h; cur = x.h; }
      continue;
    }
    if (!u || split) open(!!u);
    u.paras.push(x.t); u.n += wc(x.t);
    if (u.n > (opts.chunk || 1600)) split = true;
  }
  // a heading with nothing after it (end of book) has nothing to show
  const sections = units.filter(x => x.paras.length).map(x => ({ label: '', title: x.title || title, text: x.paras.join('\n\n'), heads: x.heads.filter(h => h.p < x.paras.length), ...(x.cont ? { cont: true } : {}) }));
  const all = sections.slice(0, 6).map(s => s.text).join(' ');
  return { title, lang: detectLang(all) || lang, sections, struct: 2 };
}

export function fromText(text, title) {
  text = text.replace(/\r\n?/g, '\n').replace(/\u00ad/g, '').replace(/[ \t]+\n/g, '\n');
  // single newlines inside paragraphs (hard-wrapped text) → spaces, keep blank lines
  if (!/\n\s*\n/.test(text) && text.split('\n').length > 3) text = text.replace(/\n/g, '\n\n');
  else text = text.replace(/([^\n])\n(?!\n)/g, '$1 ');
  const first = text.trim().split('\n')[0].trim();
  const t = (title || (first.length < 90 ? first : first.split(/\s+/).slice(0, 6).join(' ') + '…')).replace(/[#*_]/g, '').trim();
  if (!title && first.length < 90) text = text.trim().slice(first.length);
  return itemsToBook(text.split(/\n\s*\n/).map(p => ({ t: p })), t, '');
}

export async function openPDF(data) {
  await loadScript('vendor/pdf.min.js');
  const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  try { return await pdfjs.getDocument({ data, isEvalSupported: false }).promise; }
  catch (e) { if (/password/i.test(e && (e.name + e.message))) { const er = new Error('drm'); er.code = 'drm'; er.fmt = 'PDF (password)'; throw er; } throw e; }
}
/** punctuation drawn as its own layer on top of a run of words (LibreOffice PDFs): put each mark back after the
    word it follows. Positions inside the run are estimated from the font's natural widths + the justified spaces. */
let _mctx = null;
const markMeas = (t, h) => { if (!_mctx) { try { _mctx = (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas')).getContext('2d'); } catch { _mctx = false; } } return _mctx ? (_mctx.font = `${Math.round(h * 10) / 10}px serif`, _mctx.measureText(t).width) : t.length * h * 0.5; };
function placeMarks(its, h, scale) {
  const isMark = it => it.s.trim().length > 0 && it.s.trim().length <= 2;
  const runs = its.filter(it => !isMark(it) && it.s.trim().length > 2 && it.w > 0), marks = its.filter(isMark);
  if (!runs.length || !marks.length) return its;
  const inside = (m, r) => m.x > r.x + 0.5 && m.x < r.x + r.w - 0.5;
  if (!marks.some(m => runs.some(r => inside(m, r)))) return its;
  const meas = t => markMeas(t, h) * (scale || 1);
  const out = its.filter(it => !runs.includes(it) && !(isMark(it) && runs.some(r => inside(it, r))) && it.s.trim());
  for (const r of runs) {
    const ms = marks.filter(m => inside(m, r)).sort((a, b) => a.x - b.x); if (!ms.length) { out.push(r); continue; }
    const str = r.s, sp = []; for (let i = 0; i < str.length; i++) if (str[i] === ' ') sp.push(i);
    const nat = meas(str), extra = sp.length ? Math.max(0, r.w - nat) / sp.length : 0;
    const xAt = i => r.x + meas(str.slice(0, i)) + extra * sp.filter(k => k < i).length; // x where char i starts
    const ins = []; // [char index, text]
    for (const m of ms) {
      const mk = m.s.trim(); let best = -1, bd = 1e9;
      // a letter or hyphen inside a word sits in a gap the word layer left as a space ("м й" + "i", "какая нибудь" + "-")
      const fill = /[\p{L}\p{N}]/u.test(mk) || mk === '-' || mk === '‐';
      for (const k of sp) { const d = Math.abs((fill ? (xAt(k) + xAt(k + 1)) / 2 : xAt(k)) - m.x); if (d < bd) { bd = d; best = k; } } // word end = the space after it
      if (best < 0) { out.push(m); continue; }
      if (fill) { ins.push([best, mk, 'fill', m.x]); continue; }
      ins.push([best, /^[—–]$/.test(mk) ? ' ' + mk : mk, /^[(«„“\[]/.test(mk) ? 'open' : '', m.x]);
    }
    let t = str; ins.sort((a, b) => b[0] - a[0] || b[3] - a[3]).forEach(([k, mk, how]) => { t = how === 'fill' ? t.slice(0, k) + mk + t.slice(k + 1) : how === 'open' ? t.slice(0, k + 1) + mk + t.slice(k + 1) : t.slice(0, k) + mk + t.slice(k); });
    out.push({ x: r.x, w: r.w, s: t });
  }
  return out;
}
export async function fromPDF(file, name = file.name || 'Book') {
  const pdf = await openPDF(await file.arrayBuffer());
  const meta = await pdf.getMetadata().catch(() => ({}));
  const metaTitle = (meta.info && meta.info.Title && meta.info.Title.trim()) || '';
  const pages = []; let chars = 0;
  for (let i = 1; i <= Math.min(pdf.numPages, 1500); i++) {
    const page = await pdf.getPage(i), tc = await page.getTextContent();
    chars += tc.items.reduce((a, it) => a + (it.str ? it.str.trim().length : 0), 0);
    // scanned book (pages are pictures): hand over to OCR instead of returning nothing
    if (i === Math.min(pdf.numPages, 6) && chars < 40 * i && (pdf.numPages <= 12 || await pdf.getPage(Math.ceil(pdf.numPages / 2)).then(p => p.getTextContent()).then(c => c.items.reduce((a, it) => a + (it.str ? it.str.trim().length : 0), 0) < 60))) { const pages = pdf.numPages; pdf.destroy(); return { scanned: true, pages, title: metaTitle || name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), titleFromName: !metaTitle, author: meta.info?.Author || '' }; }
    // group items into lines by baseline
    // (some writers, e.g. LibreOffice, put punctuation in separate runs out of order: order each line by x, as it is printed)
    const lines = [];
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = it.transform[5], h = Math.abs(it.transform[3]) || 10, x = it.transform[4];
      let cur = null; for (let k = lines.length - 1; k >= Math.max(0, lines.length - 3); k--) if (Math.abs(y - lines[k].y) <= Math.max(h, lines[k].h) * 0.4) { cur = lines[k]; break; }
      if (!cur) { cur = { y, h, its: [], rtl: 0 }; lines.push(cur); }
      cur.h = Math.max(cur.h, h); cur.its.push({ x, w: it.width || 0, s: it.str }); if (it.dir === 'rtl') cur.rtl++;
    }
    // the PDF font vs our measuring font: the narrowest (unjustified) lines tell the scale
    const ratios = []; for (const l of lines) for (const it of l.its) if (it.s.length > 20 && it.w > 0 && / \S+ /.test(it.s)) ratios.push(it.w / markMeas(it.s, l.h));
    ratios.sort((a, b) => a - b); const scale = ratios.length ? ratios[Math.floor(ratios.length * 0.1)] : 1;
    for (const l of lines) {
      if (l.rtl <= l.its.length / 2) l.its = placeMarks(l.its, l.h, scale);
      const its = l.its.slice().sort((a, b) => l.rtl > l.its.length / 2 ? b.x - a.x : a.x - b.x);
      let str = '', end = null;
      for (const it of its) { if (end != null && l.rtl <= l.its.length / 2 && it.x - end > l.h * 0.12 && !/\s$/.test(str) && !/^\s/.test(it.s) && !/^[,.;:!?…»”)\]]/.test(it.s)) str += ' '; str += it.s; end = it.x + it.w; }
      l.s = str;
    }
    const L = lines.map(l => ({ y: l.y, h: l.h, s: l.s.replace(/\s+/g, ' ').trim() })).filter(l => l.s && !/^\d{1,4}$/.test(l.s)); // drop bare page numbers
    const gaps = []; for (let k = 1; k < L.length; k++) gaps.push(Math.abs(L[k - 1].y - L[k].y));
    const med = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
    const lens = L.map(l => l.s.length).sort((a, b) => a - b), typ = lens[Math.floor(lens.length * 0.8)] || 60;
    let txt = '';
    L.forEach((l, k) => {
      if (!txt) { txt = l.s; return; }
      const gap = gaps[k - 1], prev = L[k - 1];
      const para = (med && gap > med * 1.3) || Math.abs(l.h - prev.h) > prev.h * 0.15 || (prev.s.length < typ * 0.7 && /[.!?:»"”…]$/.test(prev.s));
      if (para) txt += '\n\n' + l.s;
      else if (/\p{L}[-‐]$/u.test(txt)) txt = txt.slice(0, -1) + l.s;
      else txt += ' ' + l.s;
    });
    pages.push(txt);
  }
  const text = pages.join('\n\n');
  const numPages = pdf.numPages;
  const outline = await pdfOutline(pdf).catch(() => []);
  pdf.destroy();
  // whatever the early check decided: a PDF with (almost) no text layer is a scan → OCR, never "no text"
  if (wc(text) < Math.max(30, numPages * 3)) return { scanned: true, pages: numPages, title: metaTitle || name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), titleFromName: !metaTitle, author: meta.info?.Author || '' };
  const title = metaTitle || name.replace(/\.pdf$/i, '');
  // the PDF's own outline (bookmarks) gives the real chapters and their levels; each heading goes where its
  // title appears on its page (or at the top of that page)
  const items = [];
  pages.forEach((pt, i) => {
    const paras = pt.split(/\n\s*\n/).map(one).filter(Boolean), here = outline.filter(o => o.page === i);
    for (const o of here) {
      const k = paras.findIndex(x => normT(x).startsWith(normT(o.title).slice(0, 40)) || normT(o.title).startsWith(normT(x)) && normT(x).length > 3);
      if (k >= 0 && paras[k].length < o.title.length + 40) {
        // the heading line itself is replaced by the entry; anything after it in the same paragraph (an epigraph) stays text
        const x = paras[k], rest = x.length > o.title.length && normT(x.slice(0, o.title.length)) === normT(o.title) ? x.slice(o.title.length).trim() : '';
        paras.splice(k, 1, { h: o.title, lvl: o.lvl }, ...(rest && normT(rest) ? [rest] : []));
      }
      else if (k >= 0) paras.splice(k, 0, { h: o.title, lvl: o.lvl });
      else paras.unshift({ h: o.title, lvl: o.lvl });
    }
    paras.forEach(x => items.push(typeof x === 'string' ? { t: x } : x));
  });
  const r = itemsToBook(items, title, '');
  r.author = meta.info?.Author || '';
  return r;
}
async function pdfOutline(pdf) {
  const ol = await pdf.getOutline(); if (!ol || !ol.length) return [];
  const out = [];
  const walk = async (list, lvl) => {
    for (const o of list) {
      let page = -1;
      try { let d = o.dest; if (typeof d === 'string') d = await pdf.getDestination(d); if (Array.isArray(d) && d[0]) page = typeof d[0] === 'number' ? d[0] : await pdf.getPageIndex(d[0]); } catch {}
      const t = one(o.title); if (t && page >= 0) out.push({ title: t, lvl, page });
      if (o.items && o.items.length && lvl < 3) await walk(o.items, lvl + 1);
    }
  };
  await walk(ol, 0);
  return out;
}

export async function fromEPUB(src, name = src.name || 'Book') {
  let zip = src;
  if (!src.files) { await loadScript('vendor/jszip.min.js'); zip = await window.JSZip.loadAsync(await src.arrayBuffer()); }
  const P = new DOMParser();
  let opfPath = '';
  const cf = zip.file('META-INF/container.xml');
  if (cf) opfPath = P.parseFromString(await cf.async('string'), 'application/xml').querySelector('rootfile')?.getAttribute('full-path') || '';
  if (!opfPath || !zip.file(opfPath)) opfPath = Object.keys(zip.files).find(f => /\.opf$/i.test(f)) || '';
  if (!opfPath) throw new Error('empty');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opf = P.parseFromString(await zip.file(opfPath).async('string'), 'application/xml');
  const q = n => opf.getElementsByTagName(n)[0]?.textContent?.trim() || '';
  const title = q('dc:title') || name.replace(/\.(kepub\.epub|epub|ibooks)$/i, ''), author = q('dc:creator'), lang = (q('dc:language') || '').split(/[-_]/)[0].toLowerCase();
  const manifest = {}, props = {}, items = [];
  for (const it of opf.getElementsByTagName('item')) { manifest[it.getAttribute('id')] = it.getAttribute('href'); props[it.getAttribute('id')] = it.getAttribute('properties') || ''; }
  const resolve = (from, href) => { const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : ''; let pth = decodeURIComponent((dir + href).split('#')[0]); while (/[^/]+\/\.\.\//.test(pth)) pth = pth.replace(/[^/]+\/\.\.\//, ''); return pth.replace(/^\.\//, ''); };
  const readDoc = async path => { const f = zip.file(path); if (!f) return null; const src = await f.async('string'); let d = P.parseFromString(src, 'application/xhtml+xml'); if (d.querySelector('parsererror')) d = P.parseFromString(src, 'text/html'); return d; };
  // the book's own table of contents: EPUB 3 nav (nested <ol>) or EPUB 2 NCX (nested navPoint)
  const toc = []; let navPath = '';
  const navId = Object.keys(props).find(id => /\bnav\b/.test(props[id]));
  if (navId) {
    navPath = resolve(opfPath, manifest[navId]); const nd = await readDoc(navPath);
    const nav = nd && ([...nd.getElementsByTagName('nav')].find(n => /toc/.test(n.getAttribute('epub:type') || n.getAttribute('type') || n.getAttribute('role') || '')) || nd.getElementsByTagName('nav')[0]);
    const walk = (ol, lvl) => { for (const li of ol.children) { if (li.localName !== 'li') continue; const a = [...li.children].find(c => c.localName === 'a' || c.localName === 'span'); const sub = [...li.children].find(c => c.localName === 'ol' || c.localName === 'ul'); if (a && a.getAttribute('href')) toc.push({ t: one(a.textContent), path: resolve(navPath, a.getAttribute('href')), id: (a.getAttribute('href').split('#')[1] || ''), lvl }); if (sub) walk(sub, lvl + 1); } };
    const ol = nav && [...nav.getElementsByTagName('*')].find(c => c.localName === 'ol' || c.localName === 'ul'); if (ol) walk(ol, 0);
  }
  if (!toc.length) {
    const ncxId = opf.getElementsByTagName('spine')[0]?.getAttribute('toc') || Object.keys(manifest).find(id => /\.ncx$/i.test(manifest[id]));
    if (ncxId && manifest[ncxId]) {
      const np = resolve(opfPath, manifest[ncxId]), nf = zip.file(np);
      if (nf) {
        const nx = P.parseFromString(await nf.async('string'), 'application/xml');
        const walk = (el, lvl) => { for (const c of el.children) { if (c.localName !== 'navPoint') continue; const lab = c.getElementsByTagName('text')[0], src = c.getElementsByTagName('content')[0]?.getAttribute('src'); if (lab && src) toc.push({ t: one(lab.textContent), path: resolve(np, src), id: src.split('#')[1] || '', lvl }); walk(c, lvl + 1); } };
        const map = nx.getElementsByTagName('navMap')[0]; if (map) walk(map, 0);
      }
    }
  }
  const BLK = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dd,dt,td,div';
  const isH = el => /^h[1-6]$/i.test(el.localName);
  for (const ref of opf.getElementsByTagName('itemref')) {
    const id = ref.getAttribute('idref'), href = manifest[id]; if (!href) continue;
    const path = resolve(opfPath, href); if (path === navPath) continue;
    const doc = await readDoc(path); if (!doc) continue;
    const body = doc.body || doc.getElementsByTagName('body')[0] || doc.documentElement;
    body.querySelectorAll('script,style,sup a[href],nav').forEach(n => n.remove());
    // where each Contents entry of this file starts
    const here = toc.filter(x => x.path === path), marks = new Map();
    for (const e of here) {
      let el = e.id ? doc.getElementById(e.id) || body.querySelector(`[name="${CSS.escape(e.id)}"]`) : null;
      if (el) { if (!el.matches(BLK) || el.querySelector(BLK)) { const blk = el.closest(BLK); el = blk && blk !== body && !blk.querySelector(BLK) ? blk : (el.querySelector(BLK) && [...el.querySelectorAll(BLK)].find(b => !b.querySelector(BLK))) || el.nextElementSibling || el; } }
      const k = el || 'start'; if (!marks.has(k)) marks.set(k, []); marks.get(k).push(e);
    }
    const emit = arr => arr.forEach(e => items.push({ h: e.t, lvl: e.lvl }));
    if (marks.has('start')) { emit(marks.get('start')); marks.delete('start'); }
    let lastHead = null;
    const blocks = [...body.querySelectorAll(BLK)].filter(b => !b.querySelector(BLK));
    for (const bl of blocks) {
      const anchored = [...marks.keys()].filter(k => k !== 'start' && (k === bl || (k.contains && k.contains(bl) && !k.matches(BLK)))); 
      for (const k of anchored) { emit(marks.get(k)); lastHead = marks.get(k).map(e => normT(e.t)).join(' '); marks.delete(k); }
      const t = one(bl.textContent); if (!t) continue;
      // the heading the Contents entry points at is already shown as that entry
      if (isH(bl) && (lastHead != null && (lastHead.includes(normT(t)) || normT(t).includes(lastHead)) || !toc.length && false)) continue;
      if (isH(bl) && !toc.length && /^h[1-3]$/i.test(bl.localName)) { items.push({ h: t, lvl: +bl.localName[1] }); continue; }
      lastHead = isH(bl) ? lastHead : null;
      items.push({ t });
    }
    for (const arr of marks.values()) emit(arr); // anchors not found: keep the entry at the end of this file
  }
  const r = itemsToBook(items, title, lang);
  r.author = author;
  // the text itself decides (EPUB metadata is often wrong); metadata only helps for languages the detector doesn't know
  const sample = r.sections.slice(0, 4).map(x => x.text).join(' ').slice(0, 4000);
  if (lang && r.lang === 'en' && lang !== 'en' && !/\b(the|and|of)\b/i.test(sample)) r.lang = lang;
  return r;
}

export async function fromURL(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  // the free reader proxy occasionally rate-limits / hiccups: retry twice with a short backoff
  let r;
  for (let i = 0; i < 3; i++) {
    try { r = await fetch('https://r.jina.ai/' + url); if (r.ok) break; } catch (e) { r = null; }
    if (i < 2) await new Promise(res => setTimeout(res, 1200 * (i + 1)));
  }
  if (!r || !r.ok) throw new Error('reader ' + (r ? r.status : 'network'));
  const raw = await r.text();
  const title = (raw.match(/^Title:\s*(.+)$/m) || [])[1] || new URL(url).hostname;
  const md = raw.split(/^Markdown Content:\s*$/m)[1] || raw;
  const text = mdToText(md, true);
  if (wc(text) < 30) throw new Error('empty');
  const bk = itemsToBook(text.split(/\n\s*\n/).map(t => ({ t })), title.trim(), '');
  return { ...bk, author: new URL(url).hostname.replace(/^www\./, ''), source: url };
}
export function mdToText(md, strict) {
  md = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                 // images
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1') // links → text
    .replace(/^\s{0,3}#{1,6}\s*/gm, '\n')                  // headings
    .replace(/^\s*[-*+]\s+/gm, '')                          // bullets
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
    .replace(/^[=\-_*]{3,}\s*$/gm, '')
    .replace(/^\|.*\|$/gm, '');
  const paras = md.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => strict ? (wc(p) > 3 || /[.!?。！？]$/.test(p)) : p);
  return paras.join('\n\n');
}
