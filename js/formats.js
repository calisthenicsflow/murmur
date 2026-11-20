// Universal book import: the format is sniffed from the bytes (magic numbers / zip contents),
// never trusted from the file name or MIME type (iOS Files often says application/octet-stream).
// Loaded lazily the first time a file is imported.
import { splitSections, detectLang, wc } from './text.js?v=1.3.5';
import { fromText, fromPDF, fromEPUB, mdToText, itemsToBook, joinTitle } from './importers.js?v=1.3.5';

export class ImportError extends Error { constructor(code, fmt) { super(code); this.code = code; this.fmt = fmt || ''; } }

const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s);
});
const ascii = (u8, a, b) => String.fromCharCode(...u8.subarray(a, b));
const goodName = n => { const b = baseName(n); return b.length >= 3 && !/\d/.test(b) && !/^(book|file|document|untitled|text|new)$/i.test(b) ? b : ''; };
const baseName = n => (n || '').replace(/\.(fb2\.zip|kepub\.epub|[a-z0-9]{1,5})$/i, '').replace(/[_]+/g, ' ').trim();

/* ------------------------------ text decoding ------------------------------ */
const CYR = /[оеаинтсрвлкмдпуяыьгзбчйхжшюцщэфъё]/g;
export function decodeText(u8, declared) {
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
  if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  // UTF-16 without BOM: lots of zero bytes on one side
  const n = Math.min(u8.length, 4000); let ze = 0, zo = 0;
  for (let i = 0; i < n; i++) if (!u8[i]) (i & 1 ? zo++ : ze++);
  if (zo > n * 0.2 && ze < n * 0.02) return new TextDecoder('utf-16le').decode(u8);
  if (ze > n * 0.2 && zo < n * 0.02) return new TextDecoder('utf-16be').decode(u8);
  if (declared) { try { return new TextDecoder(declared).decode(u8); } catch {} }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch {}
  // legacy 8-bit: pick the code page whose output looks most like real Cyrillic, else Latin-1
  let best = null, bs = -1;
  for (const cp of ['windows-1251', 'koi8-r', 'ibm866', 'windows-1252']) {
    let s; try { s = new TextDecoder(cp).decode(u8.subarray(0, 60000)); } catch { continue; }
    const letters = (s.match(/\p{L}/gu) || []).length || 1;
    const score = cp === 'windows-1252' ? 0.15 : ((s.match(CYR) || []).length / letters); // case-sensitive: a wrong code page turns lowercase into CAPS
    if (score > bs) { bs = score; best = cp; }
  }
  return new TextDecoder(best).decode(u8);
}

/* ------------------------------ html → sections ------------------------------ */
const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,div,dd,dt,td,tr';
export function htmlToBook(html, fallbackTitle) {
  const doc = new DOMParser().parseFromString(html.replace(/<mbp:pagebreak\s*\/?>/gi, '<hr data-pb="1">'), 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,header>nav,svg,img,sup a[href^="#"],a[href^="#fn"],a[href^="#note"],.footnote,.pagenum,[epub\\:type="pagebreak"],[epub\\:type="noteref"],aside.footnote,aside.footnotes').forEach(n => n.remove());
  doc.querySelectorAll('sup,a').forEach(a => { const href = a.getAttribute('href') || '', typ = a.getAttribute('epub:type') || a.getAttribute('type') || ''; if ((a.tagName === 'SUP' || href.startsWith('#') || /note/i.test(typ)) && /^\s*[\[\(]?\d{1,3}[\]\)]?\s*$/.test(a.textContent)) a.remove(); });
  const title = (doc.querySelector('title')?.textContent || doc.querySelector('meta[property="og:title"]')?.content || '').replace(/\s+/g, ' ').trim() || fallbackTitle;
  const lang = (doc.documentElement.getAttribute('lang') || '').split('-')[0];
  const body = doc.body || doc.documentElement;
  const blocks = [];
  const walk = el => {
    for (const c of el.children) {
      if (c.tagName === 'HR') continue;
      if (c.matches(BLOCK) && !c.querySelector(BLOCK)) {
        const t = c.textContent.replace(/\s+/g, ' ').trim();
        if (t) blocks.push(/^H[1-3]$/.test(c.tagName) && t.length < 160 ? { h: t, lvl: +c.tagName[1] } : { t });
      } else walk(c);
    }
    // loose text directly inside a container (old MOBI / plain html)
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (own && wc(own) > 3) blocks.push({ t: own });
  };
  walk(body);
  return itemsToBook(blocks, title, lang);
}
/* ------------------------------ MOBI / AZW / AZW3 / PRC (PalmDOC + KF8) ------------------------------ */
function palmdoc(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i++];
    if (c === 0 || (c >= 0x09 && c <= 0x7f)) out.push(c);
    else if (c >= 0x01 && c <= 0x08) { for (let k = 0; k < c && i < src.length; k++) out.push(src[i++]); }
    else if (c >= 0xc0) { out.push(0x20, c ^ 0x80); }
    else { // 0x80..0xbf: LZ77 back-reference
      const c2 = src[i++]; const pair = (c << 8) | c2; const dist = (pair >> 3) & 0x7ff, len = (pair & 7) + 3;
      for (let k = 0; k < len; k++) out.push(out[out.length - dist]);
    }
  }
  return out;
}
function trailingSize(rec, flags) {
  let size = 0, end = rec.length;
  const backInt = e => { let v = 0, shift = 0; for (let p = e - 1; p >= Math.max(0, e - 4); p--) { const b = rec[p]; v |= (b & 0x7f) << shift; shift += 7; if (b & 0x80) break; } return v; };
  for (let bit = 15; bit >= 1; bit--) if (flags & (1 << bit)) { const s = backInt(end - size); size += s; }
  if (flags & 1) size += (rec[end - size - 1] & 3) + 1;
  return size;
}
export function parseMOBI(buf, name) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  const n = dv.getUint16(76), off = i => dv.getUint32(78 + i * 8);
  const r0 = off(0), comp = dv.getUint16(r0), textRecs = dv.getUint16(r0 + 8), enc = dv.getUint16(r0 + 12);
  const type = ascii(u8, 60, 68);
  if (enc !== 0) throw new ImportError('drm', type === 'TEXtREAd' ? 'PalmDOC' : 'Kindle (MOBI/AZW)');
  let codec = 'windows-1252', title = '', extraFlags = 0, lang = '';
  if (ascii(u8, r0 + 16, r0 + 20) === 'MOBI') {
    const hl = dv.getUint32(r0 + 20);
    codec = dv.getUint32(r0 + 28) === 65001 ? 'utf-8' : 'windows-1252';
    const tOff = dv.getUint32(r0 + 84), tLen = dv.getUint32(r0 + 88);
    title = new TextDecoder(codec).decode(u8.subarray(r0 + tOff, r0 + tOff + tLen));
    if (hl >= 0xE4) extraFlags = dv.getUint16(r0 + 0xF2);
    // EXTH 503 = updated title, 100 = author
    if (dv.getUint32(r0 + 0x80) & 0x40) {
      let p = r0 + 16 + hl; if (ascii(u8, p, p + 4) === 'EXTH') { const cnt = dv.getUint32(p + 8); p += 12; for (let k = 0; k < cnt; k++) { const t = dv.getUint32(p), l = dv.getUint32(p + 4); if (t === 503) title = new TextDecoder(codec).decode(u8.subarray(p + 8, p + l)); if (t === 100 && !lang) lang = ''; p += l; } }
    }
  }
  if (comp === 17480) throw new ImportError('mobiHuff', 'Kindle (HUFF/CDIC)');
  const parts = [];
  for (let i = 1; i <= textRecs && i < n; i++) {
    let rec = u8.subarray(off(i), i + 1 < n ? off(i + 1) : u8.length);
    if (extraFlags) rec = rec.subarray(0, rec.length - trailingSize(rec, extraFlags));
    parts.push(comp === 2 ? Uint8Array.from(palmdoc(rec)) : rec);
  }
  const total = parts.reduce((a, p) => a + p.length, 0), all = new Uint8Array(total); let q = 0; for (const p of parts) { all.set(p, q); q += p.length; }
  const raw = new TextDecoder(codec).decode(all);
  const book = /<(p|div|html|body)\b/i.test(raw) ? htmlToBook(raw, title || baseName(name)) : fromText(raw, title || baseName(name));
  book.title = title || book.title;
  return book;
}

/* ------------------------------ FB2 ------------------------------ */
export function parseFB2(u8, name) {
  const head = new TextDecoder('ascii').decode(u8.subarray(0, 200));
  const declared = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1];
  const xml = decodeText(u8, declared);
  let doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(xml, 'text/html');
  const tag = (el, n) => [...el.getElementsByTagName(n)];
  const ti = tag(doc, 'title-info')[0] || doc;
  const title = (tag(ti, 'book-title')[0]?.textContent || baseName(name)).trim();
  const au = tag(ti, 'author')[0]; const author = au ? ['first-name', 'last-name'].map(k => tag(au, k)[0]?.textContent?.trim()).filter(Boolean).join(' ') : '';
  const body = tag(doc, 'body').find(b => !/notes|comments/i.test(b.getAttribute('name') || '')) || tag(doc, 'body')[0];
  if (!body) throw new ImportError('empty', 'FB2');
  const items = [];
  // footnote references ([52]) are not part of a title
  const txt = el => { const c = el.cloneNode(true); [...c.querySelectorAll('a,sup')].forEach(a => { const typ = a.getAttribute('type') || '', href = a.getAttribute('l:href') || a.getAttribute('href') || a.getAttribute('xlink:href') || ''; if (/note/i.test(typ) || /note/i.test(href) || /^\s*[\[\(]?\d{1,3}[\]\)]?\s*$/.test(a.textContent)) a.remove(); }); return c.textContent.replace(/\s+/g, ' ').trim(); };
  const lines = el => { const ps = [...el.children].filter(c => /^(p|subtitle)$/.test(c.localName || c.tagName.toLowerCase())); return ps.length ? ps.map(txt) : [txt(el)]; };
  // nesting: body > section (depth 1) > section (depth 2)…; a section's <title> is a heading at its depth,
  // a <subtitle> is a subsection inside it; untitled sections simply continue the text
  const walk = (el, depth, inVerse) => {
    for (const c of el.children) {
      const n = c.localName || c.tagName.toLowerCase();
      if (n === 'section') { walk(c, depth + 1, false); continue; }
      if (n === 'title') { if (inVerse || depth === 0) { if (inVerse) { const t = joinTitle(lines(c)); if (t) items.push({ t }); } continue; } const t = joinTitle(lines(c)); if (t) items.push({ h: t, lvl: depth }); continue; }
      if (n === 'subtitle') { const t = txt(c); if (t && !inVerse && t.length < 160 && !/^[\s*·•—–-]+$/.test(t)) items.push({ h: t, lvl: depth + 1 }); else if (t) items.push({ t }); continue; }
      if (n === 'binary' || n === 'image' || n === 'table') continue;
      if (['p', 'v', 'text-author'].includes(n)) { const t = txt(c); if (t) items.push({ t }); continue; }
      walk(c, depth, inVerse || n === 'poem' || n === 'epigraph' || n === 'cite'); // poem, stanza, cite, epigraph…
    }
  };
  walk(body, 0, false);
  const r = itemsToBook(items, title, (tag(ti, 'lang')[0]?.textContent || '').trim(), { dropTitle: false });
  r.author = author; r.title = title;
  return r;
}

/* ------------------------------ DOCX / ODT ------------------------------ */
async function parseDOCX(zip, name) {
  const x = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
  const blocks = []; let docTitle = '';
  for (const p of x.getElementsByTagName('w:p')) {
    let t = '';
    for (const n of p.getElementsByTagName('*')) { if (n.tagName === 'w:t') t += n.textContent; else if (n.tagName === 'w:tab' || n.tagName === 'w:br') t += ' '; }
    t = t.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const st = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '', ol = p.getElementsByTagName('w:outlineLvl')[0]?.getAttribute('w:val');
    const m = /^(?:heading|заголовок)\s?([1-3])$/i.exec(st);
    if (/^title$/i.test(st)) { if (!docTitle) docTitle = t; continue; }
    if (m && t.length < 200) blocks.push({ h: t, lvl: +m[1] });
    else if (ol != null && /^[0-2]$/.test(ol) && t.length < 200) blocks.push({ h: t, lvl: +ol + 1 });
    else blocks.push({ t });
  }
  let title = docTitle || baseName(name);
  const core = zip.file('docProps/core.xml'); if (core) { const c = new DOMParser().parseFromString(await core.async('string'), 'application/xml'); title = c.getElementsByTagName('dc:title')[0]?.textContent?.trim() || title; }
  return itemsToBook(blocks, title, '');
}
async function parseODT(zip, name) {
  const x = new DOMParser().parseFromString(await zip.file('content.xml').async('string'), 'application/xml');
  const blocks = [];
  for (const el of x.getElementsByTagName('*')) {
    if (el.tagName !== 'text:p' && el.tagName !== 'text:h') continue;
    const t = el.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const lv = +(el.getAttribute('text:outline-level') || 1);
    blocks.push(el.tagName === 'text:h' && lv <= 3 && t.length < 200 ? { h: t, lvl: lv } : { t });
  }
  let title = baseName(name);
  const meta = zip.file('meta.xml'); if (meta) { const m = new DOMParser().parseFromString(await meta.async('string'), 'application/xml'); title = m.getElementsByTagName('dc:title')[0]?.textContent?.trim() || title; }
  return itemsToBook(blocks, title, '');
}

/* ------------------------------ RTF ------------------------------ */
const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'object', 'themedata', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'xmlnstbl', 'generator', 'fldinst', 'filetbl', 'revtbl', 'pgdsctbl', 'colorschememapping', 'mmathPr', 'shp', 'nonshppict', 'bkmkstart', 'bkmkend', 'footnote', 'annotation']);
const RTF_CHAR = { emdash: '—', endash: '–', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', bullet: '•', tab: ' ', line: '\n', par: '\n\n', sect: '\n\n', page: '\n\n', cell: ' ', row: '\n' };
export function parseRTF(u8, name) {
  const s = new TextDecoder('latin1').decode(u8);
  let cp = +(s.match(/\\ansicpg(\d+)/) || [])[1] || 1252;
  if (cp === 1252 && /\\fcharset204/.test(s)) cp = 1251;
  const dec = new TextDecoder('windows-' + cp);
  let out = '', bytes = [], i = 0; const stack = []; let st = { skip: false, uc: 1 }, ucSkip = 0;
  // headings: Word / LibreOffice mark them with \outlinelevelN on the paragraph
  let pl = -1, segStart = 0; const segs = [];
  const styleLvl = {}; // paragraph style number → heading level (from the stylesheet: "heading 1" / outline level)
  { const ss = s.indexOf('{\\stylesheet'); if (ss >= 0) for (const m of s.slice(ss, ss + 200000).matchAll(/\{\\s(\d+)\b([^;{}]*);/g)) { const ol = /\\outlinelevel(\d)/.exec(m[2]), nm = /(heading|заголовок|titre|überschrift)\s*(\d)\s*$/i.exec(m[2]); const l = ol ? +ol[1] : nm ? +nm[2] - 1 : -1; if (l >= 0) styleLvl[m[1]] = l; } }
  const flush = () => { if (bytes.length) { out += dec.decode(Uint8Array.from(bytes)); bytes = []; } };
  const emit = ch => { if (st.skip) return; if (ucSkip > 0) { ucSkip--; return; } flush(); out += ch; };
  while (i < s.length) {
    const c = s[i];
    if (c === '{') { stack.push(st); st = { ...st }; i++; if (s.startsWith('\\*', i)) { st.skip = true; } continue; }
    if (c === '}') { flush(); st = stack.pop() || st; i++; continue; }
    if (c === '\\') {
      const nx = s[i + 1];
      if (nx === "'") { const b = parseInt(s.substr(i + 2, 2), 16); i += 4; if (st.skip) continue; if (ucSkip > 0) { ucSkip--; continue; } bytes.push(b); continue; }
      if (nx === '\\' || nx === '{' || nx === '}') { emit(nx); i += 2; continue; }
      if (nx === '~') { emit('\u00a0'); i += 2; continue; }
      if (nx === '-' || nx === '*') { i += 2; continue; }
      if (nx === '_') { emit('-'); i += 2; continue; }
      if (nx === '\n' || nx === '\r') { emit('\n\n'); i += 2; continue; }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 40));
      if (!m) { i += 2; continue; }
      i += 1 + m[0].length; const w = m[1], arg = m[2];
      if (RTF_SKIP.has(w)) { st.skip = true; continue; }
      if (w === 'pard') { pl = -1; continue; }
      if (w === 'outlinelevel' && !st.skip) { pl = +arg; continue; }
      if (w === 's' && !st.skip && arg != null) { if (styleLvl[arg] != null) pl = styleLvl[arg]; continue; }
      if ((w === 'par' || w === 'sect' || w === 'page') && !st.skip) { flush(); segs.push({ t: out.slice(segStart), lvl: pl }); out += '\n\n'; segStart = out.length; continue; }
      if (w === 'uc') { st.uc = +arg; continue; }
      if (w === 'u') { let v = +arg; if (v < 0) v += 65536; if (!st.skip) { flush(); out += String.fromCharCode(v); } ucSkip = st.uc; continue; }
      if (RTF_CHAR[w] !== undefined) { emit(RTF_CHAR[w]); continue; }
      continue;
    }
    if (c === '\r' || c === '\n') { i++; continue; }
    emit(c); i++;
  }
  flush(); segs.push({ t: out.slice(segStart), lvl: pl });
  if (segs.some(x => x.lvl >= 0 && x.lvl <= 2 && x.t.trim())) {
    const items = []; let ttl = titleFrom(out, name);
    const fi = segs.findIndex(x => x.t.trim());
    if (!ttl && fi >= 0) { const f = segs[fi].t.trim(); if (f.length < 90 && segs[fi].lvl < 0) { ttl = f.replace(/\s+/g, ' '); segs[fi].t = ''; } else if (f.length < 90 && segs.filter(x => x.lvl === segs[fi].lvl && x.t.trim()).length === 1) ttl = f.replace(/\s+/g, ' '); }
    if (!ttl) ttl = goodName(name) || 'Book';
    for (const x of segs) { if (!x.t.trim()) continue; if (x.lvl >= 0 && x.lvl <= 2 && x.t.trim().length < 200) items.push({ h: x.t, lvl: x.lvl }); else x.t.split(/\n\s*\n/).forEach(t => items.push({ t: t.replace(/\n/g, ' ') })); }
    return itemsToBook(items, ttl, '');
  }
  return fromText(out.replace(/\n{3,}/g, '\n\n'), titleFrom(out, name));
}

/* a short first line ("Толстый и тонкий") is the title; otherwise a meaningful file name */
function titleFrom(text, name) {
  const first = (text.trim().split('\n')[0] || '').trim();
  if (first && first.length < 90 && !/[.!?,;:]$/.test(first) && wc(first) <= 12) return undefined; // fromText takes the first line
  return goodName(name) || undefined;
}
/* Project Gutenberg licence header / footer are not part of the book */
function tidy(book) {
  if (!book || !book.sections) return book;
  if (book.struct) { if (book.title) book.title = book.title.replace(/\s*[|·]\s*Project Gutenberg\s*$/i, '').replace(/^The Project Gutenberg eBook of\s*/i, '').trim(); return book; }
  const S = /\*{0,3}\s*START OF (THE|THIS) PROJECT GUTENBERG E-?BOOK[^*\n]*?(\*{3}|$|\n)/im, E = /\*{0,3}\s*END OF (THE|THIS) PROJECT GUTENBERG E-?BOOK/i;
  let si = book.sections.findIndex(x => S.test(x.text)), ei = book.sections.findIndex(x => E.test(x.text));
  if (si < 0) { const k = book.sections.findIndex(x => /This eBook is for the use of anyone anywhere/i.test(x.text)); if (k >= 0 && k <= 1) { const x = book.sections[k]; const cut = x.text.search(/\n\n(?![^\n]*(Project Gutenberg|eBook|www\.|license|Release date|Language|Credits|Title:|Author:|Most recently updated))/i); x.text = cut > 0 ? x.text.slice(cut).trim() : ''; book.sections = book.sections.slice(k).filter(y => wc(y.text) > 5); } }
  if (si >= 0) { const s = book.sections[si]; const m = s.text.match(S); s.text = m ? s.text.slice(m.index + m[0].length).trim() : ''; book.sections = book.sections.slice(si).filter((x, i) => i > 0 || wc(x.text) > 5); }
  ei = book.sections.findIndex(x => E.test(x.text));
  if (ei >= 0) { const s = book.sections[ei]; s.text = s.text.slice(0, s.text.search(E)).trim(); book.sections = book.sections.slice(0, ei + 1).filter(x => wc(x.text) > 5); }
  if (book.title) book.title = book.title.replace(/\s*[|·]\s*Project Gutenberg\s*$/i, '').replace(/^The Project Gutenberg eBook of\s*/i, '').trim();
  book.sections.forEach((x, i) => { if (book.sections.length > 1 && /^Chapter \d+$/.test(x.label)) x.label = `Chapter ${i + 1}`; });
  return book;
}

/* ------------------------------ sniffing ------------------------------ */
function isZip(u8) { return u8[0] === 0x50 && u8[1] === 0x4B && (u8[2] === 3 || u8[2] === 5 || u8[2] === 7); }
async function fromZip(buf, name) {
  await loadScript('vendor/jszip.min.js');
  let zip; try { zip = await window.JSZip.loadAsync(buf); } catch { throw new ImportError('broken', 'ZIP'); }
  const files = Object.keys(zip.files), has = p => !!zip.file(p);
  const mt = has('mimetype') ? (await zip.file('mimetype').async('string')).trim() : '';
  if (has('META-INF/container.xml') || /epub/.test(mt) || files.some(f => /\.opf$/i.test(f))) {
    // DRM: Apple FairPlay (sinf.xml), Adobe ADEPT (rights.xml) or encrypted content (not just font obfuscation)
    if (has('META-INF/sinf.xml')) throw new ImportError('drm', 'Apple Books (FairPlay)');
    if (has('META-INF/rights.xml')) throw new ImportError('drm', 'Adobe DRM');
    if (has('META-INF/encryption.xml')) {
      const e = await zip.file('META-INF/encryption.xml').async('string');
      const algs = [...e.matchAll(/Algorithm="([^"]+)"/g)].map(m => m[1]).filter(a => !/idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/.test(a));
      const refs = [...e.matchAll(/URI="([^"]+)"/g)].map(m => m[1]);
      if (algs.length && refs.some(u => /\.x?html?$/i.test(u))) throw new ImportError('drm', /kobo/i.test(e) ? 'Kobo DRM' : 'EPUB DRM');
    }
    return fromEPUB(zip, name);
  }
  if (has('word/document.xml')) return parseDOCX(zip, name);
  if (has('content.xml') && /opendocument\.text|^$/.test(mt)) return parseODT(zip, name);
  const fb = files.find(f => /\.fb2$/i.test(f)); if (fb) return parseFB2(await zip.file(fb).async('uint8array'), fb);
  if (/opendocument/.test(mt)) throw new ImportError('unsupported', 'OpenDocument (не текст)');
  if (has('xl/workbook.xml')) throw new ImportError('unsupported', 'Excel');
  if (has('ppt/presentation.xml')) throw new ImportError('unsupported', 'PowerPoint');
  const pics = files.filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
  if (pics.length && pics.length >= files.filter(f => !zip.files[f].dir).length * 0.8) throw new ImportError('comic', 'CBZ');
  // a zip with a single text / html / pdf / book inside
  const inner = files.find(f => /\.(txt|md|html?|xhtml|rtf|pdf|epub|mobi|azw3?|docx|fb2)$/i.test(f));
  if (inner) { const b = await zip.file(inner).async('arraybuffer'); return importBuffer(b, inner); }
  throw new ImportError('unsupported', 'ZIP');
}

/** detect the format of any file and turn it into { title, author, lang, sections } (or { scanned } for image PDFs) */
export async function importFile(file, onProgress) {
  const buf = await file.arrayBuffer();
  return importBuffer(buf, file.name || 'Book', onProgress, file);
}
export async function importBuffer(buf, name, onProgress, file) {
  const r = await sniffAndParse(buf, name, onProgress, file);
  return r.scanned ? r : tidy(r);
}
async function sniffAndParse(buf, name, onProgress, file) {
  const u8 = new Uint8Array(buf);
  if (!u8.length) throw new ImportError('emptyFile', '');
  const head = ascii(u8, 0, Math.min(u8.length, 1024));
  const ext = ((name || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || '';
  // binary containers
  if (head.includes('%PDF-')) return fromPDF(file || new Blob([buf]), name, onProgress);
  if (isZip(u8)) return fromZip(buf, name);
  if (u8.length > 68 && /^(BOOKMOBI|TEXtREAd)$/.test(ascii(u8, 60, 68))) return parseMOBI(buf, name);
  if (head.startsWith('AT&TFORM')) throw new ImportError('djvu', 'DjVu');
  if (head.startsWith('CONT') || head.includes('\xeaDRMION\xee') || ext === 'kfx') throw new ImportError('drm', 'Kindle KFX');
  if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) throw new ImportError('oldDoc', ext === 'doc' || !ext ? 'Word .doc' : ext.toUpperCase());
  if (u8[0] === 0x52 && u8[1] === 0x61 && u8[2] === 0x72 && u8[3] === 0x21) throw new ImportError('comic', 'RAR/CBR');
  if ((u8[0] === 0xFF && u8[1] === 0xD8) || head.startsWith('\x89PNG') || head.startsWith('GIF8')) throw new ImportError('image', 'image');
  // text-like
  if (head.startsWith('{\\rtf')) return parseRTF(u8, name);
  const txt = decodeText(u8, (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1]);
  const t0 = txt.slice(0, 2000).replace(/^\uFEFF/, '').trimStart();
  if (/<FictionBook\b/i.test(txt.slice(0, 3000))) return parseFB2(u8, name);
  if (/^(<\?xml[^>]*>\s*)?(<!DOCTYPE html|<html\b)/i.test(t0) || (/<(p|div|body|h1)\b/i.test(t0) && /<\/(p|div)>/i.test(txt.slice(0, 20000)))) return htmlToBook(txt, baseName(name));
  if (/[\x00-\x08\x0E-\x1F]/.test(txt.slice(0, 4000).replace(/[\t\n\r\f]/g, ''))) throw new ImportError('unsupported', ext ? ext.toUpperCase() : '');
  if (ext === 'md' || ext === 'markdown' || /^#{1,3} \S/m.test(t0) && /\n\n/.test(t0)) { const h = (txt.match(/^#\s+(.+)$/m) || [])[1]; return fromText(mdToText(txt), h ? undefined : goodName(name) || undefined); }
  return fromText(txt, titleFrom(txt, name));
}
