// Importers: plain text, PDF (pdf.js), EPUB (JSZip), web article (r.jina.ai reader).
import { splitSections, detectLang, wc } from './text.js?v=1.2.3';

const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s);
});

export function fromText(text, title) {
  text = text.replace(/\r\n?/g, '\n').replace(/\u00ad/g, '').replace(/[ \t]+\n/g, '\n');
  // single newlines inside paragraphs (hard-wrapped text) → spaces, keep blank lines
  if (!/\n\s*\n/.test(text) && text.split('\n').length > 3) text = text.replace(/\n/g, '\n\n');
  else text = text.replace(/([^\n])\n(?!\n)/g, '$1 ');
  const first = text.trim().split('\n')[0].trim();
  const t = (title || (first.length < 90 ? first : first.split(/\s+/).slice(0, 6).join(' ') + '…')).replace(/[#*_]/g, '').trim();
  if (!title && first.length < 90) text = text.trim().slice(first.length);
  const sections = splitSections(text, t);
  return { title: t, lang: detectLang(text), sections };
}

export async function openPDF(data) {
  await loadScript('vendor/pdf.min.js');
  const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  try { return await pdfjs.getDocument({ data, isEvalSupported: false }).promise; }
  catch (e) { if (/password/i.test(e && (e.name + e.message))) { const er = new Error('drm'); er.code = 'drm'; er.fmt = 'PDF (password)'; throw er; } throw e; }
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
    const lines = []; let cur = null;
    for (const it of tc.items) {
      if (!it.str && !it.hasEOL) continue;
      const y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
      if (!cur || Math.abs(y - cur.y) > h * 0.4) { cur = { y, h, s: '' }; lines.push(cur); }
      cur.s += it.str;
    }
    const L = lines.map(l => ({ ...l, s: l.s.replace(/\s+/g, ' ').trim() })).filter(l => l.s && !/^\d{1,4}$/.test(l.s)); // drop bare page numbers
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
  pdf.destroy();
  const title = metaTitle || name.replace(/\.pdf$/i, '');
  return { title, author: meta.info?.Author || '', lang: detectLang(text), sections: splitSections(text, title) };
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
  const manifest = {}; for (const it of opf.getElementsByTagName('item')) manifest[it.getAttribute('id')] = it.getAttribute('href');
  const sections = [];
  for (const ref of opf.getElementsByTagName('itemref')) {
    const href = manifest[ref.getAttribute('idref')]; if (!href) continue;
    const f = zip.file(decodeURIComponent(base + href).replace(/[^/]+\/\.\.\//g, '')) || zip.file(base + href); if (!f) continue;
    const src = await f.async('string');
    let doc = P.parseFromString(src, 'application/xhtml+xml');
    if (doc.querySelector('parsererror')) doc = P.parseFromString(src, 'text/html'); // sloppy XHTML (common in .kepub / converted books)
    const body = doc.body || doc.documentElement;
    body.querySelectorAll('script,style,sup a[href],nav').forEach(n => n.remove());
    const head = body.querySelector('h1,h2,h3');
    let paras = [...body.querySelectorAll('p,h4,h5,blockquote,li')].map(p => p.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!paras.length) paras = [...body.querySelectorAll('div')].filter(d => !d.querySelector('div,p')).map(d => d.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean); // div-only books
    if (wc(paras.join(' ')) < 8) continue;
    const ht = head ? head.textContent.replace(/\s+/g, ' ').trim() : '';
    const parts = splitSections(paras.join('\n\n'), ht);
    parts.forEach((p, i) => sections.push({ label: '', title: i === 0 ? ht : p.title, text: p.text }));
  }
  sections.forEach((s, i) => { s.label = `Chapter ${i + 1}`; if (!s.title) s.title = title; });
  const all = sections.map(s => s.text).join(' ');
  // the text itself decides (EPUB metadata is often wrong); metadata only helps for languages the detector doesn't know
  const det = detectLang(all), sample = all.slice(0, 4000);
  return { title, author, lang: lang && det === 'en' && lang !== 'en' && !/\b(the|and|of)\b/i.test(sample) ? lang : det, sections };
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
  return { title: title.trim(), author: new URL(url).hostname.replace(/^www\./, ''), lang: detectLang(text), source: url, sections: splitSections(text, title.trim()) };
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
