// Speech engines. Each engine implements:
//   ready() → Promise<boolean>, voices() → Promise<Voice[]>, defaultVoice(lang, voices)
//   play(chunk, opts) → controller { pause, resume, stop, setRate, setVolume, canPause }
//   prefetch(chunk, voiceId)
// chunk = { text, map:[{start,end,w}], lang }. opts = { voice, rate, volume, onWord(w), onEnd(), onError(e) }
// A premium engine (ElevenLabs / Grok TTS / Azure) only needs to return audio + word timings
// to reuse AudioEngine below — see createAudioEngine({ synth }).
import { norm } from './text.js?v=1.2.2';
import { CURATED, PREVIEW_TEXT } from './voices.js?v=1.2.2';
import { db } from './db.js?v=1.2.2';

const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Organ|Pipe Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Kathy|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;
const LANG_NAMES = (() => { try { return new Intl.DisplayNames(['en'], { type: 'language' }); } catch { return null; } })();
const LN_FALLBACK = { iu: 'Inuktitut', fil: 'Filipino', jv: 'Javanese', su: 'Sundanese' };
export const langName = (l, inLang = 'en') => { try { const n = new Intl.DisplayNames([inLang], { type: 'language' }).of(l); return n && n !== l ? n.charAt(0).toLocaleUpperCase(inLang) + n.slice(1) : (LN_FALLBACK[l] || l); } catch { return LN_FALLBACK[l] || l; } };
/** the language's own name, e.g. ru → Русский */
export const nativeName = l => { try { const n = new Intl.DisplayNames([l], { type: 'language' }).of(l); return n && n !== l ? n.charAt(0).toLocaleUpperCase(l) + n.slice(1) : langName(l); } catch { return langName(l); } };
export const regionName = (loc, inLang = 'en') => { const c = loc.split('-').find((x, i) => i > 0 && /^[A-Z]{2}$/.test(x)); try { return c ? new Intl.DisplayNames([inLang], { type: 'region', style: 'short' }).of(c) : ''; } catch { return ''; } };

function wordAt(map, charIndex) {
  let lo = 0, hi = map.length - 1, ans = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (map[m].start <= charIndex) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}

/* ------------------------------ Web Speech ------------------------------ */
export function createWebSpeechEngine() {
  const synth = window.speechSynthesis;
  let vcache = null, token = 0;
  const loadVoices = () => new Promise(res => {
    if (!synth) return res([]);
    let v = synth.getVoices();
    if (v.length) return res(v);
    let done = false;
    const fin = () => { if (done) return; done = true; res(synth.getVoices()); };
    synth.addEventListener?.('voiceschanged', fin, { once: true });
    let n = 0; const iv = setInterval(() => { if (synth.getVoices().length || ++n > 30) { clearInterval(iv); fin(); } }, 100);
  });
  const quality = v => {
    if (NOVELTY.test(v.name)) return -1;
    if (/premium|enhanced|neural|natural|siri|online/i.test(v.name)) return 3;
    if (/google|microsoft/i.test(v.name)) return 2;
    return v.localService ? 1 : 1;
  };
  return {
    id: 'device', canPause: false,
    async ready() { return !!synth; },
    async voices() {
      if (vcache) return vcache;
      const raw = await loadVoices();
      vcache = raw.map(v => ({ id: v.voiceURI || v.name, name: v.name.replace(/\s*\(.*\)$/, ''), detail: v.name.match(/\((.*)\)/)?.[1] || '', locale: v.lang.replace('_', '-'), lang: v.lang.slice(0, 2).toLowerCase(), quality: quality(v), raw: v, engine: 'device' }))
        .filter(v => v.quality >= 0).sort((a, b) => b.quality - a.quality || a.name.localeCompare(b.name));
      // keep only the best few per language (iOS ships dozens of low-quality/compact voices)
      const pref = (navigator.language || '').toLowerCase(), per = {};
      vcache = vcache.sort((a, b) => b.quality - a.quality || (b.locale.toLowerCase() === pref) - (a.locale.toLowerCase() === pref) || a.name.localeCompare(b.name))
        .filter(v => { const seen = per[v.lang] = per[v.lang] || new Set(); if (seen.size >= 3 || seen.has(v.name)) return false; seen.add(v.name); return true; });
      return vcache;
    },
    defaultVoice(lang, voices) {
      const pref = (navigator.language || '').toLowerCase();
      const c = voices.filter(v => v.lang === lang);
      return (c.find(v => v.quality === 3 && pref.startsWith(lang) && v.locale.toLowerCase() === pref) || c[0] || voices[0])?.id;
    },
    prefetch() {},
    play(chunk, o) {
      const my = ++token;
      const u = new SpeechSynthesisUtterance(chunk.text);
      const v = (vcache || []).find(x => x.id === o.voice);
      if (v) { u.voice = v.raw; u.lang = v.raw.lang; } else u.lang = chunk.lang;
      u.rate = Math.max(0.5, Math.min(3, o.rate || 1)); u.volume = o.volume ?? 1;
      let gotBoundary = false, est = null, t0 = 0, ended = false;
      const startEstimate = () => {
        // Fallback for engines that never fire word boundaries: estimate by character length.
        const cps = 14.5 * u.rate, total = chunk.text.length;
        est = setInterval(() => {
          if (gotBoundary || my !== token) return clearInterval(est);
          const c = Math.min(total - 1, (performance.now() - t0) / 1000 * cps);
          o.onWord(chunk.map[wordAt(chunk.map, c)].w);
        }, 90);
      };
      u.onstart = () => { t0 = performance.now(); if (chunk.map[0]) o.onWord(chunk.map[0].w); setTimeout(() => { if (!gotBoundary && my === token && !ended) startEstimate(); }, 650); };
      u.onboundary = e => { if (my !== token || (e.name && e.name !== 'word')) return; gotBoundary = true; clearInterval(est); o.onWord(chunk.map[wordAt(chunk.map, e.charIndex)].w); };
      const fin = () => { if (ended) return; ended = true; clearInterval(est); if (my === token) o.onEnd(); };
      u.onend = fin;
      u.onerror = e => { clearInterval(est); if (my !== token) return; if (e.error === 'interrupted' || e.error === 'canceled') return; ended = true; o.onError?.(e); };
      synth.speak(u);
      // Safari sometimes never fires onend for very short strings — watchdog
      const guard = setInterval(() => { if (my !== token || ended) return clearInterval(guard); if (!synth.speaking && !synth.pending && performance.now() - t0 > 1500 && t0) { clearInterval(guard); fin(); } }, 1000);
      return {
        stop() { token++; clearInterval(est); clearInterval(guard); synth.cancel(); },
        pause() {}, resume() {}, setRate() { return false; }, setVolume(x) { u.volume = x; }, canPause: false
      };
    },
    unlock() { try { if (synth && !synth.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch {} }
  };
}

/* --------------------- Audio engine (neural voices) --------------------- */
// synth(text, voice) → Promise<{ audio: Blob, words: [[startMs, durMs, text], ...] }>
export const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/84TAAAAAAAAAAAAASW5mbwAAAA8AAAANAAAFoAAzMzMzMzMzRERERERERERVVVVVVVVVVWZmZmZmZmZ3d3d3d3d3d4iIiIiIiIiImZmZmZmZmaqqqqqqqqqqu7u7u7u7u7vMzMzMzMzM3d3d3d3d3d3u7u7u7u7u7v////////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAOQAAAAAAAABaBTBYX9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80TEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEUwAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEpgAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
export function createAudioEngine({ id, synth, listVoices, health, defaults }) {
  const audio = new Audio(); audio.preload = 'auto'; audio.setAttribute('playsinline', '');
  try { audio.preservesPitch = true; audio.webkitPreservesPitch = true; } catch {}
  const cache = new Map(); let token = 0, vcache = null;
  const key = (t, v) => v + '|' + t;
  function get(text, voice) {
    const k = key(text, voice);
    if (!cache.has(k)) {
      const p = synth(text, voice).then(r => ({ url: URL.createObjectURL(r.audio), words: r.words }));
      p.catch(() => cache.delete(k));
      cache.set(k, p);
      if (cache.size > 60) { const [fk, fp] = cache.entries().next().value; cache.delete(fk); fp.then(r => URL.revokeObjectURL(r.url)).catch(() => {}); }
    }
    return cache.get(k);
  }
  function align(words, chunk) {
    // map every boundary to a word index in the chunk (tolerant of split / merged tokens)
    const toks = chunk.map.map(m => norm(chunk.text.slice(m.start, m.end)));
    const out = []; let j = 0;
    for (const w of words) {
      const nb = norm(w[2]); let hit = -1;
      if (nb) for (let k = j; k < Math.min(toks.length, j + 8); k++) { const tk = toks[k]; if (!tk) continue; if (tk === nb || tk.startsWith(nb) || nb.startsWith(tk) || tk.includes(nb)) { hit = k; break; } }
      if (hit < 0) hit = Math.min(j, toks.length - 1);
      out.push({ t: w[0], w: chunk.map[hit].w });
      j = (toks[hit] === nb || nb.startsWith(toks[hit]) || toks[hit].endsWith(nb)) ? hit + 1 : hit;
    }
    return out;
  }
  return {
    id, canPause: true, audio, synthRaw: synth,
    async ready() { try { return await health(); } catch { return false; } },
    async voices() { if (!vcache) vcache = await listVoices(); return vcache; },
    defaultVoice(lang, voices) { const d = defaults[lang]; if (d && voices.some(v => v.id === d)) return d; return (voices.find(v => v.lang === lang) || voices.find(v => v.multi) || voices[0])?.id; },
    prefetch(chunk, voice) { if (chunk && chunk.text) get(chunk.text, voice).catch(() => {}); },
    unlock() { try { if (audio.paused && !audio.src) { audio.src = SILENT; audio.play().catch(() => {}); } } catch {} },
    play(chunk, o) {
      const my = ++token; let raf = 0, stopped = false, last = -1, marks = null;
      const tick = () => {
        if (my !== token || stopped) return;
        if (marks && marks.length) {
          const ms = audio.currentTime * 1000 + 40;
          let lo = 0, hi = marks.length - 1, a = 0;
          while (lo <= hi) { const m = (lo + hi) >> 1; if (marks[m].t <= ms) { a = m; lo = m + 1; } else hi = m - 1; }
          if (a !== last) { last = a; o.onWord(marks[a].w); }
        }
        raf = requestAnimationFrame(tick);
      };
      const onEnded = () => { if (my !== token || stopped) return; cancelAnimationFrame(raf); cleanup(); o.onEnd(); };
      const onErr = () => { if (my !== token || stopped) return; cleanup(); o.onError?.(new Error('audio')); };
      const cleanup = () => { audio.removeEventListener('ended', onEnded); audio.removeEventListener('error', onErr); };
      get(chunk.text, o.voice).then(r => {
        if (my !== token || stopped) return;
        marks = align(r.words, chunk);
        audio.addEventListener('ended', onEnded); audio.addEventListener('error', onErr);
        audio.src = r.url; audio.playbackRate = o.rate || 1; audio.defaultPlaybackRate = o.rate || 1;
        audio.volume = o.volume ?? 1;
        if (chunk.seek != null) {
          const m = marks.find(x => x.w >= chunk.seek);
          if (m && m.t > 120) { const at = Math.max(0, (m.t - 60) / 1000); const seek = () => { try { audio.currentTime = at; } catch {} }; if (audio.readyState >= 1) seek(); else audio.addEventListener('loadedmetadata', seek, { once: true }); }
          o.onWord(chunk.seek);
        } else if (chunk.map[0]) o.onWord(chunk.map[0].w);
        const p = audio.play();
        if (p && p.catch) p.catch(e => { if (my === token && !stopped) { cleanup(); o.onError?.(e); } });
        raf = requestAnimationFrame(tick);
      }).catch(e => { if (my === token && !stopped) o.onError?.(e); });
      return {
        stop() { stopped = true; token++; cancelAnimationFrame(raf); cleanup(); try { audio.pause(); } catch {} },
        pause() { audio.pause(); cancelAnimationFrame(raf); },
        resume() { audio.play().catch(() => {}); raf = requestAnimationFrame(tick); },
        setRate(r) { audio.playbackRate = r; audio.defaultPlaybackRate = r; return true; },
        setVolume(v) { try { audio.volume = v; } catch {} },
        canPause: true
      };
    }
  };
}

/* ---------------- Microsoft Edge neural voices ----------------
   Two sources, same voices and word timings:
   1. audio/index.json — sample books pre-voiced at build time (works on GitHub Pages with no server);
   2. a relay (relay/relay.py) for any text, when one is configured and online. */
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
const ttsKey = (text, voice) => `tts:${voice}:${fnv(text)}:${text.length}`;
const TTS_MAX = 400;
function rememberTts(k, v) {
  let keys = []; try { keys = JSON.parse(localStorage.getItem('murmur:ttsKeys') || '[]'); } catch {}
  keys = keys.filter(x => x !== k); keys.push(k);
  while (keys.length > TTS_MAX) db.del('kv', keys.shift());
  try { localStorage.setItem('murmur:ttsKeys', JSON.stringify(keys)); } catch {}
  db.set('kv', k, v);
}
export function createEdgeEngine(getBase) {
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  const POPULAR_UNUSED = ['en-US-AvaMultilingualNeural', 'en-US-AndrewMultilingualNeural', 'en-US-EmmaMultilingualNeural', 'en-US-BrianMultilingualNeural', 'en-GB-SoniaNeural', 'en-GB-RyanNeural', 'en-US-AriaNeural', 'en-US-GuyNeural', 'ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural', 'de-DE-SeraphinaMultilingualNeural', 'fr-FR-VivienneMultilingualNeural'];
  let relayOk = false, staticIdx = null;
  const loadStatic = async () => { if (staticIdx) return staticIdx; try { staticIdx = await fetch('audio/index.json').then(r => r.json()); } catch { staticIdx = { voices: {}, books: {}, items: {} }; } return staticIdx; };
  const eng = createAudioEngine({
    id: 'neural',
    defaults: Object.fromEntries(Object.entries(CURATED).map(([l, ids]) => [l, ids[0]])),
    async health() {
      await loadStatic();
      const base = getBase(); relayOk = false;
      if (base) { try { const r = await fetch(base + '/health', { signal: timeout(4000), cache: 'no-store' }); relayOk = r.ok && (await r.json()).ok === true; } catch { relayOk = false; } }
      return relayOk;
    },
    async listVoices() {
      let list;
      if (relayOk) { try { list = await (await fetch(getBase() + '/voices', { signal: timeout(8000) })).json(); } catch { list = null; } }
      if (!list) {
        const idx = await loadStatic();
        list = Object.values(idx.voices || {}).map(id => { const [l, c, n] = id.split('-'); return { id, name: n.replace(/(Multilingual)?Neural$/, ''), locale: `${l}-${c}`, lang: l, gender: /Svetlana|Ava|Emma|Aria|Sonia/.test(id) ? 'Female' : 'Male', multi: /Multilingual/.test(id), tags: [] }; });
      }
      // curated: only the best voices per language, in quality order (unknown future languages: first 2)
      const rank = v => { const c = CURATED[v.lang]; return c ? c.indexOf(v.id) : -2; };
      const extra = {};
      list = list.filter(v => { const r = rank(v); if (r >= 0) return true; if (r === -2) { extra[v.lang] = (extra[v.lang] || 0) + 1; return extra[v.lang] <= 2; } return false; });
      return list.map(v => ({ ...v, name: v.name.replace(/Multilingual$/, ''), quality: 4, detail: [regionName(v.locale), v.gender === 'Female' ? '♀' : v.gender === 'Male' ? '♂' : '', v.multi ? 'Multilingual' : ''].filter(Boolean).join(' · '), engine: 'neural' }))
        .sort((a, b) => a.lang.localeCompare(b.lang) || rank(a) - rank(b));
    },
    async synth(text, voice) {
      const idx = await loadStatic(), hit = idx.items && idx.items[voice + '|' + text];
      if (hit) { const r = await fetch(hit[0]); if (r.ok) return { audio: await r.blob(), words: hit[1] }; }
      // persistent cache: re-listening (or coming back to a book) is instant and works offline
      const ck = ttsKey(text, voice);
      const saved = await db.get('kv', ck).catch(() => undefined);
      if (saved && saved.a) return { audio: new Blob([saved.a], { type: 'audio/mpeg' }), words: saved.w };
      if (!relayOk) throw new Error('neural: no relay for this text');
      let j, lastErr;
      for (let attempt = 0; attempt < 2 && !j; attempt++) {
        try {
          const r = await fetch(getBase() + '/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }), signal: timeout(45000) });
          if (!r.ok) throw new Error('relay ' + r.status);
          j = await r.json();
        } catch (e) { lastErr = e; if (attempt === 0) await new Promise(res => setTimeout(res, 600)); }
      }
      if (!j) throw lastErr;
      const bytes = b64(j.audio);
      rememberTts(ck, { a: bytes.buffer, w: j.words });
      return { audio: new Blob([bytes], { type: 'audio/mpeg' }), words: j.words };
    }
  });
  // short voice sample: pre-rendered file (audio/previews/<id>.mp3), else synthesised via the relay; cached as blob URLs
  const pv = new Map();
  eng.preview = (voice, lang) => {
    if (!pv.has(voice)) {
      const p = (async () => {
        const r = await fetch(`audio/previews/${voice}.mp3`).catch(() => null);
        if (r && r.ok) return URL.createObjectURL(await r.blob());
        const res = await eng.synthRaw(PREVIEW_TEXT[lang] || PREVIEW_TEXT.en, voice);
        return URL.createObjectURL(res.audio);
      })();
      p.catch(() => pv.delete(voice)); pv.set(voice, p);
    }
    return pv.get(voice);
  };
  eng.previewCached = voice => pv.has(voice);
  eng.relayOnline = () => relayOk;
  /** true when this engine can voice the given book right now */
  eng.covers = async (bookId) => relayOk || !!(await loadStatic()).books?.[bookId];
  eng.staticVoice = async (bookId) => (await loadStatic()).books?.[bookId];
  return eng;
}
