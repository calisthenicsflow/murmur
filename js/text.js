// Text model: paragraphs → sentences → words, with "filler" detection.
const URL_RE = /^(\(?)(https?:\/\/|www\.)\S+$/i;
const SUPER = '[¹²³⁴⁵⁶⁷⁸⁹⁰]{1,4}';
const BRACK = '\\[\\d{1,3}\\]|\\(\\d{1,3}\\)|\\{\\d{1,3}\\}';
const FOOT_ONLY = new RegExp(`^(?:${BRACK}|${SUPER}|\\*{1,3}|†|‡|[\\[(]\\d{1,3})[.,;:]?$`);
const TRAIL_MARK = new RegExp(`(?:${BRACK}|${SUPER})+(?=[.,;:!?…»”"')\\]]*$)`);
// only sentence-final punctuation: "дискретно.1". Never decimals (0,1), ratios (50:50), ranges (50–60), formulas (CO2).
const TRAIL_PUNCT_DIGITS = /([.!?…»”"'')\]]+)\d{1,3}$/u;
const TRAIL_WORD_DIGITS = /(\p{L}{3,})\d{1,3}(?=[.,:;!?…»”"'')\]]*$)/u;
const PAGE_RE = /^(\d{1,4}|-\s?\d{1,4}\s?-|page \d{1,4}|стр\.? \d{1,4}|p\. ?\d{1,4})$/i;
const PUNCT_END = /[.,:;!?…»”"'')\]]+$/;
const SHORT_ABBR = /^\p{L}{1,4}\.$/u; // "Рис.", "табл.", "Fig." — not a sentence end

// ---------- language detection (script first, then stop-word scoring for Latin/Cyrillic) ----------
const SCRIPTS = [
  ['ja', /[\u3040-\u30ff]/g], ['ko', /[\uac00-\ud7af\u1100-\u11ff]/g], ['zh', /[\u4e00-\u9fff\u3400-\u4dbf]/g],
  ['el', /[\u0370-\u03ff]/g], ['he', /[\u0590-\u05ff]/g], ['ar*', /[\u0600-\u06ff\u0750-\u077f]/g],
  ['hi*', /[\u0900-\u097f]/g], ['bn', /[\u0980-\u09ff]/g], ['gu', /[\u0a80-\u0aff]/g], ['ta', /[\u0b80-\u0bff]/g],
  ['te', /[\u0c00-\u0c7f]/g], ['kn', /[\u0c80-\u0cff]/g], ['ml', /[\u0d00-\u0d7f]/g], ['si', /[\u0d80-\u0dff]/g],
  ['th', /[\u0e00-\u0e7f]/g], ['lo', /[\u0e80-\u0eff]/g], ['my', /[\u1000-\u109f]/g], ['ka', /[\u10a0-\u10ff]/g],
  ['am', /[\u1200-\u137f]/g], ['km', /[\u1780-\u17ff]/g], ['iu', /[\u1400-\u167f]/g],
  ['cyr*', /[\u0400-\u04ff]/g], ['lat*', /[a-z\u00c0-\u024f\u1e00-\u1eff]/gi]
];
const STOP = {
  en: 'the and of to is in that it was for you with on as are this be at have not but they his her',
  de: 'der die und das ist nicht ich sie ein eine zu den mit sich auf dem auch es wir',
  fr: 'le la les et des est une que pas pour dans qui ce il vous sur au avec je nous',
  es: 'el la los las y que de en por con una para es no se lo del como pero más',
  it: 'il di che la e un una per non sono con del della gli le è anche ma come si',
  pt: 'o a os as e que de em um uma para com não é do da se por mais você',
  nl: 'de het een en van is dat niet ik je op te zijn met voor maar ook wel',
  sv: 'och att det som en är på av för med inte jag har till den om',
  nb: 'og det er som en på av for med ikke jeg har til den om et',
  da: 'og det er som en på af for med ikke jeg har til den om et',
  pl: 'i w nie się na że to jest z do jak po co tak ale',
  cs: 'a je se na že to v z do jsem ale jak tak by',
  sk: 'a je sa na že to v z do som ale ako tak by',
  sl: 'in je se na da v z za ne so pa ki tudi',
  hr: 'i je se na da u za ne su što ali kako to',
  ro: 'și de la în nu că o un este cu pe se mai din',
  hu: 'a az és hogy nem is egy van meg ez de csak',
  fi: 'ja on ei se että oli hän mutta kun niin myös',
  et: 'ja on ei see et oli ta aga kui nii ka',
  lt: 'ir yra kad ne su į tai bet kaip jis',
  lv: 'un ir ka ne ar uz tas bet kā viņš',
  tr: 've bir bu da de için ne ile çok ama gibi',
  id: 'dan yang di itu ini dengan untuk tidak dari dalam akan',
  ms: 'dan yang di itu ini dengan untuk tidak dari dalam akan',
  vi: 'và của là có không một những được cho này người',
  ca: 'el la i de que en els les un una per amb no és',
  gl: 'o a e de que en os as un unha para con non é',
  af: 'die en van is nie het dat in te wat ek',
  sw: 'na ya wa kwa ni za katika la hii kuwa',
  fil: 'ang ng sa na at mga ay hindi ko ako',
  sq: 'dhe në të një për është me nuk që',
  az: 'və bir bu da ilə üçün çox amma',
  uz: 'va bu bir bilan uchun ham emas',
  cy: 'y yr a ac yn i ar o mae ei',
  ga: 'an agus na ar is go le sé',
  is: 'og að er í á það sem ekki',
  mt: 'il u ta li fil huwa ma',
  ru: 'и в не на что я с он как это по но они мы',
  uk: 'і в не на що я з він як це та але ми',
  bg: 'и в не на че аз с той как това да но ние',
  sr: 'и у не на да је се са што али',
  mk: 'и во не на дека е се со што но',
  kk: 'және бұл мен да де үшін бір',
  mn: 'ба нь бол энэ гэж байна юм'
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));
const LAT_LANGS = Object.keys(STOP).filter(l => !['ru', 'uk', 'bg', 'sr', 'mk', 'kk', 'mn'].includes(l));
function scoreWords(sample, langs) {
  const toks = sample.toLowerCase().match(/[\p{L}']+/gu) || [];
  let best = null, bs = 0;
  for (const l of langs) { const set = STOPSETS[l]; let n = 0; for (const t of toks) if (set.has(t)) n++; if (n > bs) { bs = n; best = l; } }
  return best;
}
export function detectLang(s) {
  const sample = String(s || '').slice(0, 6000);
  let top = null, tn = 0;
  for (const [l, re] of SCRIPTS) { const n = (sample.match(re) || []).length * (l === 'zh' ? 2 : 1); if (n > tn) { tn = n; top = l; } }
  if (!top || tn < 2) return 'en';
  if (top === 'zh' && /[\u3040-\u30ff]/.test(sample)) return 'ja';
  if (!top.endsWith('*')) return top;
  if (top === 'ar*') return /[ےںٹڈڑ]/.test(sample) ? 'ur' : /[پچژگ]/.test(sample) ? (/\b(د|په|چې|دا)\b/.test(sample) ? 'ps' : 'fa') : 'ar';
  if (top === 'hi*') return /( आहे| आणि| मी )/.test(sample) ? 'mr' : /( छ| हो| र )[।\s]/.test(sample) && !/ है/.test(sample) ? 'ne' : 'hi';
  if (top === 'cyr*') {
    if (/[әғқңөұүһі]/i.test(sample) && /[әғқңұ]/i.test(sample)) return 'kk';
    if (/[їєґ]/i.test(sample) || (/і/i.test(sample) && !/[ыэъ]/i.test(sample))) return 'uk';
    if (/[ѓќѕ]/i.test(sample)) return 'mk';
    if (/[јљњћђџ]/i.test(sample)) return 'sr';
    if (/[өү]/i.test(sample)) return 'mn';
    if (!/[ыэё]/i.test(sample) && /ъ/i.test(sample)) return 'bg';
    return 'ru';
  }
  // Latin
  if (/[ăâ][\p{L}]*/u.test(sample) && /[ơưđ]|[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(sample)) return 'vi';
  return scoreWords(sample, LAT_LANGS) || 'en';
}
/** Language of one sentence inside a text whose main language is `base`: only switches on a clear script change. */
const scriptOf = l => ({ ru: 'c', uk: 'c', bg: 'c', sr: 'c', mk: 'c', kk: 'c', mn: 'c', ar: 'a', fa: 'a', ur: 'a', ps: 'a', hi: 'd', mr: 'd', ne: 'd' }[l] || (STOPSETS[l] ? 'l' : l));
export function sentenceLang(text, base) {
  const cyr = (text.match(/[\u0400-\u04ff]/g) || []).length, lat = (text.match(/[a-z\u00c0-\u024f]/gi) || []).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < 4) return base;
  const bs = scriptOf(base);
  if (bs === 'l' && cyr > lat && cyr >= 4) return detectLang(text);
  if (bs === 'c' && lat > cyr && lat >= 6) { const l = detectLang(text); return l; }
  if (bs !== 'l' && bs !== 'c' && lat > letters * 0.7 && lat >= 6) return detectLang(text);
  return base;
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

const NOSPACE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0e00-\u0eff\u1000-\u109f\u1780-\u17ff]/;
const NOSPACE_G = new RegExp(NOSPACE.source, 'g');
/** approximate word count that also works for Chinese/Japanese/Thai… (no spaces between words) */
export function wc(text) {
  const t = String(text || ''); const ns = (t.match(NOSPACE_G) || []).length;
  return t.split(/\s+/).filter(Boolean).length + Math.round(ns / 2);
}
/** word spans of a free text (translations): [{start,end}] — Segmenter for no-space scripts */
export function wordSpans(text, lang) {
  const t = String(text || ''), out = [];
  if (NOSPACE.test(t) && globalThis.Intl && Intl.Segmenter) {
    try {
      let last = null;
      for (const g of new Intl.Segmenter(lang, { granularity: 'word' }).segment(t)) {
        if (/^\s+$/.test(g.segment)) { last = null; continue; }
        if (!g.isWordLike && last) { last.end = g.index + g.segment.length; continue; }
        last = { start: g.index, end: g.index + g.segment.length }; out.push(last);
      }
      return out;
    } catch {}
  }
  for (const m of t.matchAll(/\S+/g)) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}
let wordSeg = null;
function tokens(st, lang) {
  if (!NOSPACE.test(st) || !(globalThis.Intl && Intl.Segmenter)) return st.split(/\s+/).map(t => ({ t, ns: false }));
  try { wordSeg = wordSeg && wordSeg.l === lang ? wordSeg : { l: lang, s: new Intl.Segmenter(lang, { granularity: 'word' }) }; } catch { return st.split(/\s+/).map(t => ({ t, ns: false })); }
  const out = [];
  for (const g of wordSeg.s.segment(st)) {
    const seg = g.segment;
    if (/^\s+$/.test(seg)) { if (out.length) out[out.length - 1].ns = false; continue; }
    if (!g.isWordLike && out.length) { out[out.length - 1].t += seg; continue; }  // punctuation sticks to the previous word
    out.push({ t: seg, ns: true });
  }
  if (out.length) out[out.length - 1].ns = false;
  return out;
}

/** strip footnote markers from a token; keep real numbers (years, "1000 к 1", "Глава 1").
    prev is the previous raw token in the paragraph (may be from the previous sentence). */
export function sayOf(tok, skipFiller, prev = '', next = '') {
  if (!skipFiller) return tok;
  if (URL_RE.test(tok) || FOOT_ONLY.test(tok)) return '';
  let s = tok.replace(TRAIL_MARK, '');
  s = s.replace(TRAIL_PUNCT_DIGITS, '$1');
  s = s.replace(TRAIL_WORD_DIGITS, '$1');
  if (s !== tok && !/[\p{L}\p{N}]/u.test(s)) return ''; // only a leftover mark
  // a bare 1–3 digit token: a footnote if it follows punctuation, or starts a sentence
  // before a capital (". 1 Они"); keep "Глава 1", "1000 к 1", "12 человек"
  if (/^\d{1,3}$/.test(tok) || /^\d{1,3}$/.test(s)) {
    // after punctuation: a leftover footnote if nothing follows, or a new capital sentence (". 1 Они");
    // keep quantities that continue in lowercase ("случаев. 12 человек")
    if (PUNCT_END.test(prev) && !SHORT_ABBR.test(prev) && (!next || /^\p{Lu}/u.test(next))) return '';
    return tok;
  }
  return s;
}
export const isFootnoteTok = (tok, say) => !!tok && say !== tok;


export function buildModel(text, lang, skipFiller) {
  const paras = [], sents = [], words = [];
  const rawParas = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const rp of rawParas) {
    const pIdx = paras.length, para = { sents: [], skip: skipFiller && PAGE_RE.test(rp) };
    paras.push(para);
    let prevTok = '';
    for (const st of splitSentences(rp, lang)) {
      const sIdx = sents.length, sent = { words: [], para: pIdx, lang: sentenceLang(st, lang) };
      const toks = tokens(st, lang);
      for (let ti = 0; ti < toks.length; ti++) {
        const { t: tok, ns } = toks[ti];
        if (!tok) continue;
        const nextTok = (toks[ti + 1] && toks[ti + 1].t) || '';
        let say = para.skip ? '' : sayOf(tok, skipFiller, prevTok, nextTok);
        // punctuation left over after removing a link/footnote sticks to the previous spoken word
        if (say && say !== tok && !/[\p{L}\p{N}]/u.test(say)) { const prev = [...sent.words].reverse().map(i => words[i]).find(x => x.say); if (prev) { prev.say += say; say = ''; } }
        sent.words.push(words.length);
        words.push(ns ? { t: tok, say, s: sIdx, ns: true } : { t: tok, say, s: sIdx });
        prevTok = tok;
      }
      if (!sent.words.length) continue;
      sent.text = sent.words.map(w => words[w].t + (words[w].ns ? '' : ' ')).join('').trim();
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
    for (const p of s.paras) { chunk.push(p); n += wc(p); if (n > 1600) flush(); }
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
