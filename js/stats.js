// Listening / reading time and day streaks (localStorage).
const KEY = 'murmur:stats';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
let data = load();
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function track(kind, sec) {
  const k = dayKey(); data[k] = data[k] || { listen: 0, read: 0 }; data[k][kind] += sec;
  localStorage.setItem(KEY, JSON.stringify(data));
}
export function summary() {
  data = load();
  let listen = 0, read = 0; for (const v of Object.values(data)) { listen += v.listen; read += v.read; }
  const active = k => data[k] && (data[k].listen + data[k].read) >= 30;
  let streak = 0; const d = new Date();
  if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
  while (active(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const week = [];
  for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); const v = data[dayKey(x)] || { listen: 0, read: 0 }; week.push({ date: x, ...v }); }
  return { listen, read, streak, week };
}
