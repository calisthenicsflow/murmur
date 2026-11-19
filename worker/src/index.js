/* Murmur neural-voice relay — Cloudflare Worker port of relay/relay.py.
   Speaks the Microsoft Edge "Read Aloud" WebSocket protocol exactly like edge-tts 7.3.1.
   GET /health  -> {ok:true}
   GET /voices  -> [{id,name,locale,lang,langName,gender,tags,multi}]
   POST /tts {text, voice} -> {audio: base64 mp3, words: [[startMs, durMs, word], ...]} */
import { Buffer } from 'node:buffer';
import { secMsGec, TRUSTED_CLIENT_TOKEN, CHROMIUM_MAJOR_VERSION, SEC_MS_GEC_VERSION } from './gec.js';

const BASE = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const WSS_URL = `https://${BASE}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`; // fetch() needs http(s) scheme + Upgrade header
const VOICE_LIST = `https://${BASE}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const BASE_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
};
const WSS_HEADERS = { Pragma: 'no-cache', 'Cache-Control': 'no-cache', Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold', ...BASE_HEADERS };
const VOICE_HEADERS = {
  Authority: 'speech.platform.bing.com',
  'Sec-CH-UA': `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
  'Sec-CH-UA-Mobile': '?0', Accept: '*/*', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty',
  ...BASE_HEADERS,
};
const ALLOWED = /^(https:\/\/calisthenicsflow\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const MAX_CHARS = 1000;          // per request (Edge renders ~0.6x realtime; keeps requests short and within free-plan CPU)
const MAX_CHUNK_BYTES = 3500;    // per SSML message (edge-tts limit is ~4096 incl. SSML wrapper)
const RATE = 60;                 // requests / minute / IP (per isolate, best effort)
const VOICE_RE = /^[a-z]{2,3}-[A-Za-z]{2,4}(-[A-Za-z]+)?-[A-Za-z]+Neural$/;
const TICKS_PER_SECOND = 10_000_000, MP3_BITRATE_BPS = 48_000;

let skew = 0;                    // clock skew seconds, adjusted from server Date on 403 (as edge-tts does)
const hits = new Map();
const cache = new Map();         // small in-isolate LRU
let voicesCache = { t: 0, data: null };

const muid = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const connectId = () => crypto.randomUUID().replaceAll('-', '');
const gec = () => secMsGec(Date.now() / 1000 + skew);
const dateToString = () => {
  const d = new Date();
  const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()], M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const p = n => String(n).padStart(2, '0');
  return `${D} ${M} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
};
const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const clean = s => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
function adjustSkew(resp) {
  const d = resp?.headers?.get('Date'); const t = d ? Date.parse(d) : NaN;
  if (!isNaN(t)) skew += t / 1000 - (Date.now() / 1000 + skew);
}

function splitBytes(text, max) {
  const enc = new TextEncoder(); const out = []; let rest = text;
  while (enc.encode(rest).length > max) {
    let cut = rest.slice(0, max); // chars <= bytes, so start here and shrink
    while (enc.encode(cut).length > max) cut = cut.slice(0, Math.floor(cut.length * 0.9));
    let at = cut.lastIndexOf(' ');
    if (at < cut.length * 0.5) at = cut.length;
    // don't split inside an XML entity
    const amp = cut.lastIndexOf('&', at); if (amp >= 0 && cut.indexOf(';', amp) === -1) at = amp;
    out.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

async function synthChunk(escaped, voice, offsetTicks) {
  const url = `${WSS_URL}&ConnectionId=${connectId()}&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
  const resp = await fetch(url, { headers: { Upgrade: 'websocket', ...WSS_HEADERS, Cookie: `muid=${muid()};` } });
  const ws = resp.webSocket;
  if (!ws) { if (resp.status === 403) adjustSkew(resp); throw new Error(`edge ws ${resp.status}`); }
  ws.accept();
  const audio = []; const words = []; let audioBytes = 0;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('edge timeout')); try { ws.close(1000); } catch {} }, 120000);
    ws.addEventListener('message', ev => {
      try {
        if (typeof ev.data === 'string') {
          const i = ev.data.indexOf('\r\n\r\n');
          const head = ev.data.slice(0, i), body = ev.data.slice(i + 4);
          const path = /(?:^|\r\n)Path:([^\r\n]*)/.exec(head)?.[1];
          if (path === 'audio.metadata') {
            for (const m of JSON.parse(body).Metadata) {
              if (m.Type === 'WordBoundary') { words.push([Math.round((m.Data.Offset + offsetTicks) / 1e4), Math.round(m.Data.Duration / 1e4), unescapeXml(m.Data.text.Text)]); break; }
            }
          } else if (path === 'turn.end') { clearTimeout(timer); resolve(); try { ws.close(1000); } catch {} }
        } else {
          const buf = new Uint8Array(ev.data);
          if (buf.length < 2) throw new Error('short binary');
          const hl = (buf[0] << 8) | buf[1];
          if (hl > buf.length) throw new Error('bad header length');
          const head = new TextDecoder().decode(buf.subarray(0, hl));
          if (!/Path:audio(\r|\n|$)/.test(head)) throw new Error('non-audio binary');
          const data = buf.subarray(hl + 2);
          if (data.length) { audio.push(data); audioBytes += data.length; }
        }
      } catch (e) { clearTimeout(timer); reject(e); try { ws.close(1011); } catch {} }
    });
    ws.addEventListener('close', () => { clearTimeout(timer); reject(new Error('edge closed early')); });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('edge ws error')); });
  });
  ws.send(`X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
    '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escaped}</prosody></voice></speak>`;
  ws.send(`X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
  await done;
  if (!audioBytes) throw new Error('no audio received');
  return { audio, words, audioBytes };
}

async function synth(text, voice) {
  const chunks = splitBytes(escapeXml(clean(text)), MAX_CHUNK_BYTES);
  const audio = [], words = []; let cumBytes = 0;
  for (const c of chunks) {
    let r, err;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { r = await synthChunk(c, voice, Math.floor(cumBytes * 8 * TICKS_PER_SECOND / MP3_BITRATE_BPS)); break; }
      catch (e) { err = e; await new Promise(res => setTimeout(res, 400 * (attempt + 1))); }
    }
    if (!r) throw err;
    audio.push(...r.audio); words.push(...r.words); cumBytes += r.audioBytes;
  }
  return { audio: Buffer.concat(audio).toString('base64'), words };
}

async function voices() {
  if (voicesCache.data && Date.now() - voicesCache.t < 86400e3) return voicesCache.data;
  let r;
  for (let i = 0; i < 2; i++) {
    r = await fetch(`${VOICE_LIST}&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`, { headers: { ...VOICE_HEADERS, Cookie: `muid=${muid()};` } });
    if (r.status === 403) { adjustSkew(r); continue; }
    break;
  }
  if (!r.ok) throw new Error(`voices ${r.status}`);
  const raw = await r.json();
  const data = raw.map(v => {
    const m = /Microsoft (.+?) Online/.exec(v.FriendlyName || '');
    return {
      id: v.ShortName,
      name: m ? m[1] : v.ShortName.split('-').pop().replace('Neural', ''),
      locale: v.Locale, lang: v.Locale.split('-')[0], langName: v.LocaleName || v.Locale,
      gender: v.Gender || '', tags: (v.VoiceTag || {}).VoicePersonalities || [],
      multi: v.ShortName.includes('Multilingual'),
    };
  });
  voicesCache = { t: Date.now(), data };
  return data;
}

function cors(req, resp) {
  const origin = req.headers.get('Origin') || '';
  if (ALLOWED.test(origin)) {
    resp.headers.set('Access-Control-Allow-Origin', origin);
    resp.headers.set('Vary', 'Origin');
    resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    resp.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    resp.headers.set('Access-Control-Max-Age', '86400');
  }
  return resp;
}
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });

async function sha1(s) { return Buffer.from(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))).toString('hex'); }

async function handle(req) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  const origin = req.headers.get('Origin');
  // Browsers always send Origin on cross-origin POST; block other sites (CORS alone wouldn't stop the work being done).
  if (req.method === 'POST' && !(origin && ALLOWED.test(origin))) return json({ error: 'origin' }, 403);
  const ip = req.headers.get('CF-Connecting-IP') || '?'; const now = Date.now();
  const q = (hits.get(ip) || []).filter(t => now - t < 60e3);
  if (q.length >= RATE) return json({ error: 'rate' }, 429);
  q.push(now); hits.set(ip, q); if (hits.size > 5000) hits.clear();

  if (url.pathname === '/health' && req.method === 'GET') return json({ ok: true, engine: 'edge-neural', time: Math.floor(now / 1000) });
  if (url.pathname === '/voices' && req.method === 'GET') return json(await voices(), 200, { 'Cache-Control': 'public, max-age=3600' });
  if (url.pathname === '/tts' && req.method === 'POST') {
    if (+(req.headers.get('Content-Length') || 0) > 64 * 1024) return json({ error: 'too large' }, 413);
    let body; try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const raw = String(body?.text ?? '').replace(/\s+/g, ' ').trim();
    if (raw.length > MAX_CHARS) return json({ error: `text over ${MAX_CHARS} chars` }, 413);
    const voice = String(body?.voice || 'en-US-AvaMultilingualNeural');
    if (!raw || !VOICE_RE.test(voice)) return json({ error: 'bad text or voice' }, 400);
    const key = await sha1(`${voice}|${raw}`);
    if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return json(v); }
    const data = await synth(raw, voice);
    cache.set(key, data);
    while (cache.size > 40) cache.delete(cache.keys().next().value);
    return json(data);
  }
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(req) {
    let resp;
    try { resp = await handle(req); } catch (e) { resp = json({ error: String(e?.message || e).slice(0, 200) }, 502); }
    return cors(req, resp);
  },
};
