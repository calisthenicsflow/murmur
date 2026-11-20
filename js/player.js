// Player: turns a section model into speakable chunks and drives an engine.
export class Player {
  constructor() {
    this.engine = null; this.model = null; this.lang = 'en'; this.voice = null; this.rate = 1; this.volume = 1;
    this.playing = false; this.paused = false; this.cur = 0; this.curSent = 0; this.ctrl = null; this.chunks = []; this.ci = 0;
    this.bilingual = null; // { to, voice, translate:(sIdx)=>Promise<string> }
    this.voiceFor = null;  // (lang) => voice id for sentences in another language (mixed texts)
    this.on = { word: () => {}, sentence: () => {}, state: () => {}, end: () => {}, error: () => {}, trans: () => {}, transWord: () => {} };
  }
  setModel(model, lang) { this.stop(); this.model = model; this.lang = lang; this.cur = 0; this.curSent = 0; }
  /** the reader's window of chapters changed around the text being read: word / sentence numbers shifted by
      dw / ds (chapters added or removed above), and new text may follow from word `more` on. Playback is not
      interrupted: the chunk being spoken keeps its own numbers plus an offset, the queued ones are shifted. */
  rebase(model, dw, ds, more = -1) {
    this.model = model;
    if (!this.chunks.length) { this.cur = Math.max(0, this.cur + dw); this.curSent = Math.max(0, this.curSent + ds); return; }
    if (dw || ds) {
      this.cur += dw; this.curSent += ds;
      this.chunks.forEach((c, k) => {
        if (k === this.ci) { c.offW = (c.offW || 0) + dw; c.offS = (c.offS || 0) + ds; return; } // being spoken: the engine holds the old numbers
        if (c.map) c.map.forEach(m => { m.w += dw; });
        if (c.seek != null) c.seek += dw;
        if (c.sents) c.sents = c.sents.map(x => x + ds);
        if (c.trans != null) c.trans += ds;
      });
    }
    // chapters removed below: forget what can't be read any more; chapters added below: queue them
    const n = model.words.length, ns = model.sents.length;
    this.chunks = this.chunks.filter((c, k) => k <= this.ci || (c.trans != null ? c.trans < ns : c.map.every(m => m.w < n)));
    if (more >= 0 && more < n && (this.playing || this.paused) && this.ci < this.chunks.length) {
      const lastC = this.chunks[this.chunks.length - 1];
      const end = lastC.trans != null ? model.sents[lastC.trans + (lastC === this.chunks[this.ci] ? lastC.offS || 0 : 0)]?.words.slice(-1)[0] : lastC.map[lastC.map.length - 1].w + (lastC === this.chunks[this.ci] ? lastC.offW || 0 : 0);
      if (end != null && end + 1 >= more - 1) this.chunks.push(...this.build(Math.max(more, end + 1)).filter(c => c.trans != null || c.map.every(m => m.w >= more)));
    }
  }
  maxChars() { return this.engine && this.engine.id === 'neural' ? 320 : 200; }

  build(fromWord) {
    const { words, sents } = this.model; const out = [];
    const s0 = words[fromWord] ? words[fromWord].s : 0;
    const both = this.bilingual && this.bilingual.readBoth;
    if (this.bilingual && this.bilingual.only) { // translated reading: only the translation of each sentence is voiced
      for (let s = s0; s < sents.length; s++) if (sents[s].words.some(w => words[w].say)) out.push({ trans: s });
      return out;
    }
    let cur = null;
    const flush = () => { if (cur && cur.map.length) out.push(cur); cur = null; };
    for (let s = s0; s < sents.length; s++) {
      const whole = this.engine && this.engine.id === 'neural'; // neural audio is voiced per whole sentence; mid-sentence starts seek
      const ws = sents[s].words.filter(w => (whole || w >= fromWord) && words[w].say);
      if (!ws.length || (whole && !sents[s].words.some(w => w >= fromWord && words[w].say))) continue;
      const sentLen = ws.reduce((a, w) => a + words[w].say.length + 1, 0);
      const lang = sents[s].lang || this.lang;
      // first chunk is a single sentence for a fast start; bilingual "read both" is per sentence
      if (cur && (both || whole || out.length === 0 || cur.lang !== lang || cur.text.length + sentLen > this.maxChars())) flush();
      for (const w of ws) {
        if (!cur) { cur = { text: '', map: [], sents: [], lang, voice: lang !== this.lang && this.voiceFor ? this.voiceFor(lang) : null }; if (whole && ws[0] < fromWord) cur.seek = sents[s].words.find(x => x >= fromWord && words[x].say); }
        if (!whole && cur.text.length > this.maxChars() * 1.25 && /[,;:—–]$/.test(cur.text)) { flush(); cur = { text: '', map: [], sents: [], lang, voice: lang !== this.lang && this.voiceFor ? this.voiceFor(lang) : null }; }
        if (!cur.sents.includes(s)) cur.sents.push(s);
        if (cur.text) cur.text += ' ';
        const start = cur.text.length; cur.text += words[w].say;
        cur.map.push({ start, end: cur.text.length, w });
      }
      if (both) { flush(); out.push({ trans: s }); }
    }
    flush();
    return out;
  }

  play(fromWord = this.cur) {
    if (!this.model || !this.engine) return;
    this.halt();
    this.on.trans(-1, false); // a restart never keeps a stale translation highlight
    this.chunks = this.build(fromWord); this.ci = 0; this.playing = true; this.paused = false;
    this.on.state();
    this.next();
  }
  next() {
    if (!this.playing) return;
    const c = this.chunks[this.ci];
    if (!c) { this.playing = false; this.on.state(); this.on.end(); return; }
    // prefetch ahead
    for (let k = 1; k <= 3; k++) {
      const n = this.chunks[this.ci + k]; if (!n) break;
      if (n.trans === undefined) this.engine.prefetch(n, n.voice || this.voice);
      else if (this.bilingual) { const b = this.bilingual; b.translate(n.trans).then(text => { if (text) (b.engine || this.engine).prefetch({ text, map: [], lang: b.to }, b.voice); }).catch(() => {}); }
    }
    if (c.trans !== undefined) return this.playTrans(c);
    this.ctrl = this.engine.play(c, {
      voice: c.voice || this.voice, rate: this.rate, volume: this.volume,
      onWord: w => { w += c.offW || 0; if (!this.model.words[w]) return; this.cur = w; const s = this.model.words[w].s; if (s !== this.curSent) { this.curSent = s; this.on.sentence(s); } this.on.word(w); },
      onEnd: () => { this.ci++; this.next(); },
      onError: e => { this.playing = false; this.on.state(); this.on.error(e); }
    });
  }
  async playTrans(c) {
    const b = this.bilingual; let text = '';
    try { text = await b.translate(c.trans); } catch {}
    if (!this.playing || this.chunks[this.ci] !== c) return;
    const base = c.offS || 0, s0 = c.trans + base; // shifts while it is spoken accumulate in c.offS
    const S_ = () => s0 + (c.offS || 0) - base;
    if (!text) { this.ci++; return this.next(); }
    const s = s0;
    if (b.only) { const w0 = this.model.sents[s].words[0]; this.cur = w0; if (s !== this.curSent) { this.curSent = s; this.on.sentence(s); } this.on.word(w0); }
    this.on.trans(s, true);
    // each translated word is its own map entry so the highlight can walk the translation line
    const spans = (b.spans ? b.spans(text) : null) || [{ start: 0, end: text.length }];
    const chunk = { text, map: spans.map((x, k) => ({ start: x.start, end: x.end, w: k })), lang: b.to };
    const my = this.ci;
    this.ctrl = (b.engine || this.engine).play(chunk, {
      voice: b.voice, rate: this.rate, volume: this.volume,
      onWord: k => { if (this.ci === my) this.on.transWord(S_(), k); },
      onEnd: () => { this.on.trans(S_(), false); this.ci++; this.next(); },
      onError: () => { this.on.trans(S_(), false); this.ci++; this.next(); }
    });
  }
  halt() { if (this.ctrl) { this.ctrl.stop(); this.ctrl = null; } }
  pause() {
    if (!this.playing) return;
    if (this.ctrl && this.ctrl.canPause) { this.ctrl.pause(); this.paused = true; }
    else { this.halt(); this.paused = true; }
    this.playing = false; this.on.state();
  }
  resume() {
    if (this.paused && this.ctrl && this.ctrl.canPause) { this.ctrl.resume(); this.playing = true; this.paused = false; this.on.state(); }
    else this.play(this.cur);
  }
  toggle() { this.playing ? this.pause() : this.resume(); }
  stop() { this.halt(); this.playing = false; this.paused = false; this.on.state?.(); }
  skip(dir) {
    if (!this.model) return;
    const { sents, words } = this.model; const s = words[this.cur]?.s ?? 0;
    let target = s + dir;
    if (dir < 0 && sents[s].words.indexOf(this.cur) > 2) target = s;   // mid-sentence: restart it; at its start: previous sentence
    target = Math.max(0, Math.min(sents.length - 1, target));
    const w = sents[target].words[0]; this.cur = w; this.curSent = target;
    this.on.sentence(target); this.on.word(w);
    if (this.playing || this.paused) this.play(w);
  }
  setRate(r) {
    this.rate = r;
    if (this.ctrl && this.ctrl.setRate(r)) return;
    if (this.playing) this.play(this.cur);
  }
  setVolume(v) { this.volume = v; this.ctrl?.setVolume(v); }
  setVoice(v) { this.voice = v; if (this.playing) this.play(this.cur); }
}
