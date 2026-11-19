// Text model: paragraphs → sentences → words, with "filler" detection.
const URL_RE = /^(\(?)(https?:\/\/|www\.)\S+$/i;
const FOOT_RE = /^(\[\d{1,3}\]|\(\d{1,3}\)|[¹²³⁴⁵⁶⁷⁸⁹⁰]+|\*{1,3}|†|‡)$/;
const TRAIL_FOOT = /(\[\d{1,3}\]|[¹²³⁴⁵⁶⁷⁸⁹⁰]+)(?=[.,;:!?»”"')]*$)/;
const PAGE_RE = /^(\d{1,4}|-\s?\d{1,4}\s?-|page \d{1,4}|стр\.? \d{1,4}|p\. ?\d{1,4})$/i;

export function detectLang(s) {
  const sample = s.slice(0, 4000);
  const cyr = (sample.match(/[а-яё]/gi) || []).length, lat = (sample.match(/[a-z]/gi) || []).length;
  if (cyr > lat) return 'ru';
  if (/[äöüß]/i.test(sample) && / (und|der|die|das) /.test(sample)) return 'de';
  if (/ (el|los|las|que|por) /.test(sample) && /[ñáé]/.test(sample)) return 'es';
  if (/ (le|les|des|est|une) /.test(sample) && /[éèàç]/.test(sample)) return 'fr';
  return 'en';
}

function splitSentences(p, lang) {
  if (globalThis.Intl && Intl.Segmenter) {
    try {
      const seg = new Intl.Segmenter(lang, { granularity: 'sentence' });
      const out = [];
      for (const s of seg.segment(p)) { const v = s.segment.trim(); if (v) out.push(v); }
      // merge tiny fragments like "Mr." splits
      const merged = [];
      for (const s of out) {
        const prev = merged[merged.length - 1];
        if (prev && (/\b(Mr|Mrs|Ms|Dr|St|vs|etc|т\.е|т\.д|г|см)\.$/i.test(prev) || s.length < 3)) merged[merged.length - 1] = prev + ' ' + s;
        else merged.push(s);
      }
      return merged;
    } catch (e) { /* fall through */ }
  }
  return (p.match(/[^.!?…]+(?:[.!?…]+[»”"')\]]*|$)\s*/g) || [p]).map(s => s.trim()).filter(Boolean);
}

export function sayOf(tok, skipFiller) {
  if (!skipFiller) return tok;
  if (URL_RE.test(tok) || FOOT_RE.test(tok)) return '';
  return tok.replace(TRAIL_FOOT, '');
}

export function buildModel(text, lang, skipFiller) {
  const paras = [], sents = [], words = [];
  const rawParas = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const rp of rawParas) {
    const pIdx = paras.length, para = { sents: [], skip: skipFiller && PAGE_RE.test(rp) };
    paras.push(para);
    for (const st of splitSentences(rp, lang)) {
      const sIdx = sents.length, sent = { words: [], para: pIdx };
      for (const tok of st.split(/\s+/)) {
        if (!tok) continue;
        let say = para.skip ? '' : sayOf(tok, skipFiller);
        // punctuation left over after removing a link/footnote sticks to the previous spoken word
        if (say && say !== tok && !/[\p{L}\p{N}]/u.test(say)) { const prev = [...sent.words].reverse().map(i => words[i]).find(x => x.say); if (prev) { prev.say += say; say = ''; } }
        sent.words.push(words.length);
        words.push({ t: tok, say, s: sIdx });
      }
      if (!sent.words.length) continue;
      sent.text = sent.words.map(w => words[w].t).join(' ');
      sent.say = sent.words.map(w => words[w].say).filter(Boolean).join(' ');
      sents.push(sent); para.sents.push(sIdx);
    }
  }
  return { paras, sents, words };
}

const HEAD_RE = /^(chapter|глава|part|часть|book|книга|section|раздел|prologue|пролог|epilogue|эпилог)\b[\s\S]{0,70}$|^[IVXLC]{1,7}\.?$/i;
export function splitSections(text, fallbackTitle) {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const secs = []; let cur = null;
  const push = () => { if (cur && cur.paras.length) secs.push(cur); };
  for (const p of paras) {
    if (p.length < 80 && HEAD_RE.test(p) && !/[.!?]\s+\S/.test(p)) { push(); cur = { label: p.replace(/\.$/, ''), title: '', paras: [] }; continue; }
    if (cur && !cur.title && !cur.paras.length && p.length < 70 && !/[.!?]$/.test(p)) { cur.title = p; continue; }
    if (!cur) cur = { label: '', title: '', paras: [] };
    cur.paras.push(p);
  }
  push();
  // break overly long sections into parts of ~1600 words
  const out = [];
  for (const s of secs) {
    let chunk = [], n = 0, part = 0;
    const flush = () => { if (!chunk.length) return; part++; out.push({ label: s.label, title: s.title, text: chunk.join('\n\n'), part }); chunk = []; n = 0; };
    for (const p of s.paras) { chunk.push(p); n += p.split(/\s+/).length; if (n > 1600) flush(); }
    flush();
  }
  const multi = out.length > 1;
  return out.map((s, i) => ({
    label: s.label ? (s.part > 1 ? `${s.label} · ${s.part}` : s.label) : (multi ? `Part ${i + 1}` : ''),
    title: s.title || (i === 0 ? fallbackTitle : ''),
    text: s.text
  }));
}

export const norm = w => (w || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
