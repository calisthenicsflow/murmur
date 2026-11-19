// Player: turns a section model into speakable chunks and drives an engine.
export class Player {
  constructor() {
    this.engine = null; this.model = null; this.lang = 'en'; this.voice = null; this.rate = 1; this.volume = 1;
    this.playing = false; this.paused = false; this.cur = 0; this.curSent = 0; this.ctrl = null; this.chunks = []; this.ci = 0;
    this.bilingual = null; // { to, voice, translate:(sIdx)=>Promise<string> }
    this.on = { word: () => {}, sentence: () => {}, state: () => {}, end: () => {}, error: () => {}, trans: () => {} };
  }
  setModel(model, lang) { this.stop(); this.model = model; this.lang = lang; this.cur = 0; this.curSent = 0; }
  maxChars() { return this.engine && this.engine.id === 'neural' ? 320 : 200; }

  build(fromWord) {
    const { words, sents } = this.model; const out = [];
    const s0 = words[fromWord] ? words[fromWord].s : 0;
    const both = this.bilingual && this.bilingual.readBoth;
    let cur = null;
    const flush = () => { if (cur && cur.map.length) out.push(cur); cur = null; };
    for (let s = s0; s < sents.length; s++) {
      const whole = this.engine && this.engine.id === 'neural'; // neural audio is voiced per whole sentence; mid-sentence starts seek
      const ws = sents[s].words.filter(w => (whole || w >= fromWord) && words[w].say);
      if (!ws.length || (whole && !sents[s].words.some(w => w >= fromWord && words[w].say))) continue;
      const sentLen = ws.reduce((a, w) => a + words[w].say.length + 1, 0);
      // first chunk is a single sentence for a fast start; bilingual "read both" is per sentence
      if (cur && (both || whole || out.length === 0 || cur.text.length + sentLen > this.maxChars())) flush();
      for (const w of ws) {
        if (!cur) { cur = { text: '', map: [], sents: [], lang: this.lang }; if (whole && ws[0] < fromWord) cur.seek = sents[s].words.find(x => x >= fromWord && words[x].say); }
        if (!whole && cur.text.length > this.maxChars() * 1.25 && /[,;:—–]$/.test(cur.text)) { flush(); cur = { text: '', map: [], sents: [], lang: this.lang }; }
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
    this.chunks = this.build(fromWord); this.ci = 0; this.playing = true; this.paused = false;
    this.on.state();
    this.next();
  }
  next() {
    if (!this.playing) return;
    const c = this.chunks[this.ci];
    if (!c) { this.playing = false; this.on.state(); this.on.end(); return; }
    // prefetch ahead
    for (let k = 1; k <= 2; k++) { const n = this.chunks[this.ci + k]; if (n && !n.trans) this.engine.prefetch(n, this.voice); }
    if (c.trans !== undefined) return this.playTrans(c.trans);
    this.ctrl = this.engine.play(c, {
      voice: this.voice, rate: this.rate, volume: this.volume,
      onWord: w => { this.cur = w; const s = this.model.words[w].s; if (s !== this.curSent) { this.curSent = s; this.on.sentence(s); } this.on.word(w); },
      onEnd: () => { this.ci++; this.next(); },
      onError: e => { this.playing = false; this.on.state(); this.on.error(e); }
    });
  }
  async playTrans(s) {
    const b = this.bilingual; let text = '';
    try { text = await b.translate(s); } catch {}
    if (!this.playing || this.chunks[this.ci]?.trans !== s) return;
    if (!text) { this.ci++; return this.next(); }
    this.on.trans(s, true);
    const chunk = { text, map: [{ start: 0, end: text.length, w: this.cur }], lang: b.to };
    this.ctrl = (b.engine || this.engine).play(chunk, {
      voice: b.voice, rate: this.rate, volume: this.volume, onWord: () => {},
      onEnd: () => { this.on.trans(s, false); this.ci++; this.next(); },
      onError: () => { this.on.trans(s, false); this.ci++; this.next(); }
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
    if (dir < 0 && this.cur !== sents[s].words[0]) target = s;
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
