// Free client-side translation with caching (Google gtx endpoint, MyMemory fallback).
import { db } from './db.js?v=1.6.2';
import { hash } from './covers.js?v=1.6.2';
const mem = new Map();
const k = (t, from, to) => `tr:${from}:${to}:${hash(t)}:${t.length}`;
async function google(lines, from, to) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from || 'auto'}&tl=${to}&dt=t&q=` + encodeURIComponent(lines.join('\n'));
  const r = await fetch(url); if (!r.ok) throw new Error('gt ' + r.status);
  const j = await r.json();
  const out = (j[0] || []).map(x => x[0] || '').join('').split('\n').map(s => s.trim());
  if (out.length !== lines.length) throw new Error('gt mismatch');
  return out;
}
async function mymemory(text, from, to) {
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${from}|${to}`);
  const j = await r.json(); if (j.responseStatus !== 200 && j.responseStatus !== '200') throw new Error('mm');
  return j.responseData.translatedText;
}
export async function translateMany(texts, from, to) {
  const res = new Array(texts.length), todo = [];
  for (let i = 0; i < texts.length; i++) {
    const key = k(texts[i], from, to);
    let v = mem.get(key); if (v === undefined) { v = await db.get('kv', key); if (v !== undefined) mem.set(key, v); }
    if (v !== undefined) res[i] = v; else todo.push(i);
  }
  // batches of ~1500 chars
  let batch = [], len = 0;
  const run = async () => {
    if (!batch.length) return;
    const lines = batch.map(i => texts[i].replace(/\n/g, ' '));
    let out;
    try { out = await google(lines, from, to); }
    catch { out = []; for (const l of lines) { try { out.push(await mymemory(l, from, to)); } catch { out.push(null); } } }
    batch.forEach((i, n) => { if (out[n]) { res[i] = out[n]; const key = k(texts[i], from, to); mem.set(key, out[n]); db.set('kv', key, out[n]); } });
    batch = []; len = 0;
  };
  for (const i of todo) { if (len + texts[i].length > 1500) await run(); batch.push(i); len += texts[i].length + 1; }
  await run();
  return res;
}
export const translateOne = async (t, from, to) => (await translateMany([t], from, to))[0];
