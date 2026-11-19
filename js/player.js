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
    if (c.trans !== undefined) return this.playTrans(c.trans);
    this.ctrl = this.engine.play(c, {
      voice: c.voice || this.voice, rate: this.rate, volume: this.volume,
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
    // each translated word is its own map entry so the highlight can walk the translation line
    const spans = (b.spans ? b.spans(text) : null) || [{ start: 0, end: text.length }];
    const chunk = { text, map: spans.map((x, k) => ({ start: x.start, end: x.end, w: k })), lang: b.to };
    const my = this.ci;
    this.ctrl = (b.engine || this.engine).play(chunk, {
      voice: b.voice, rate: this.rate, volume: this.volume,
      onWord: k => { if (this.ci === my) this.on.transWord(s, k); },
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
