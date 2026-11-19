// Port of edge-tts 7.3.1 drm.py: Sec-MS-GEC v2 token ("<16 hex CS64>-<64 hex SHA256'>").
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const CHROMIUM_FULL_VERSION = '143.0.3650.75';
export const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0];
export const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600n;
const SHA_INITIAL = [0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19];
const SHA_STATE = [0xFD9FBEA2,0x91243CE7,0xBE499094,0xCD2E1E0A,0x6C006F49,0x04BD35AB,0xFEB0A7E4,0x03EFFBD2];
const SHA_SCHEDULE = [0xEB24BF9E,0x1558691F,0xA0C09EE2,0x0CFA32BA,0xA622EE8C,0xD1DD9491,0xC0DD25A0,0xF9E70AB6,0xF0C31573,0x7058CE4E,0x7188E606,0x00E5AB33,0xD258B060,0x72766564];
const K = [0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0x0FC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x06CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2];
const SHA_ADJ = 0xC9DC06A7;
const K_BLOCK = K.slice(0, 14).concat([SHA_ADJ], K.slice(15));
const SIG0_ADJ = 0x059C0B80, SIG1_ADJ = 0x000B92C0;
const CS64_COEF = [[0xE82E91B1,0xB32700D0],[0x44DE24C6,0x88DFF51D],[0x3BEB65BC,0x29514038],[0xC89C5933,0xB328CBDF],[0x8D1EC211,0xD405B4D5],[0x314EF5D5,0x26E55F3C],[0xE92491B1,0x607801C6],[0xF0A5B9D5,0x82B2C1FB],[0x06064CF3,0xFA51A3DA],[0xDA79FA60,0x207CC464],[0xBED20560,0x3C3C74F3],[0x89F9C9F8,0xD2D14B61],[0x35FA38C6,0xBB04A2C1],[0xCB49E3C6,0xC5626167]];
const CS64_FACTOR = 0x82893933, CS64_ADJ0 = 0xF2F90B1A, CS64_ADJ1 = 0x0B1A0000;

const u = x => x >>> 0;
const rotr = (x, n) => u((x >>> n) | (x << (32 - n)));
const rol16 = x => u((x << 16) | (x >>> 16));
const mul = (a, b) => u(Math.imul(a, b));
const sigma0 = v => u(rotr(v, 7) ^ rotr(v, 18) ^ (v >>> 3));
const sigma1 = v => u(rotr(v, 17) ^ rotr(v, 19) ^ (v >>> 10));

function rounds(state, w, first = 0) {
  let [a, b, c, d, e, f, g, h] = state;
  const k = first === 14 ? K_BLOCK : K;
  for (let i = first; i < 64; i++) {
    const t1 = u(h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (g ^ (e & (f ^ g))) + k[i] + w[i]);
    const t2 = u((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) | (c & (a | b))));
    h = g; g = f; f = e; e = u(d + t1); d = c; c = b; b = a; a = u(t1 + t2);
  }
  return [a, b, c, d, e, f, g, h];
}
function expand(w, first = 16) {
  for (let i = first; i < 64; i++) w.push(u(sigma1(w[i - 2]) + w[i - 7] + sigma0(w[i - 15]) + w[i - 16]));
}
function shaInit(d7) {
  const w = new Array(14).fill(0);
  w.push(u((d7[0] << 16) | (d7[1] << 8) | d7[2]));
  w.push(u((d7[3] << 24) | (d7[4] << 16) | (d7[5] << 8) | d7[6]));
  for (let i = 16; i < 30; i++) {
    let v = SHA_SCHEDULE[i - 16];
    if (i - 2 >= 14) v += i === 16 ? u(sigma1(w[i - 2]) ^ SIG1_ADJ) : sigma1(w[i - 2]);
    if (i - 7 >= 14) v += w[i - 7];
    if (i - 15 >= 14) v += i === 29 ? u(sigma0(w[i - 15]) ^ SIG0_ADJ) : sigma0(w[i - 15]);
    w.push(u(v));
  }
  w.push(u(sigma1(w[28]) + w[23] + sigma0(w[15]) + w[14] + SHA_ADJ - K[14]));
  expand(w, 31);
  const wk = rounds(SHA_STATE, w, 14);
  return SHA_INITIAL.map((x, i) => u(x + wk[i]));
}
function shaDigest(data) {
  const length = 57 + data.length;
  const padLen = (((55 - length) % 64) + 64) % 64;
  const body = new Uint8Array(data.length - 7 + 1 + padLen + 8);
  body.set(data.subarray(7)); body[data.length - 7] = 0x80;
  const dv = new DataView(body.buffer);
  dv.setBigUint64(body.length - 8, BigInt(length * 8));
  let st = shaInit(data.subarray(0, 7));
  for (let off = 0; off < body.length; off += 64) {
    const w = []; for (let j = 0; j < 16; j++) w.push(dv.getUint32(off + j * 4));
    expand(w);
    const wk = rounds(st, w);
    st = st.map((x, i) => u(x + wk[i]));
  }
  const out = new Uint8Array(32); const ov = new DataView(out.buffer);
  st.forEach((x, i) => ov.setUint32(i * 4, x));
  return out;
}
function wordsLE4Even(data) {
  const n = Math.ceil(data.length / 4) * 4; const p = new Uint8Array(n); p.set(data);
  const dv = new DataView(p.buffer); const w = [];
  for (let i = 0; i < n; i += 4) w.push(dv.getUint32(i, true));
  if (w.length % 2) w.push(0);
  return w;
}
function cs64(data, digest) {
  const dv = new DataView(digest.buffer, digest.byteOffset);
  const keyA = u(dv.getUint32(0, true) | 1), keyB = u(dv.getUint32(4, true) | 1);
  const factors = [mul(keyA, CS64_FACTOR), mul(keyB, CS64_FACTOR)];
  const terms = CS64_COEF.map(([c], i) => mul(c, factors[i % 2]));
  const offsets = CS64_COEF.map(([, o]) => o);
  const pre = new Uint8Array(data.length + 1); pre.set(data, 1);
  wordsLE4Even(pre).forEach((word, i) => {
    let term = mul(word, i % 2 === 0 ? keyA : keyB);
    let off = mul(rol16(word), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB);
    if (i === 0) { term = u(term + mul(CS64_ADJ0, factors[0])); off = u(off + CS64_ADJ1); }
    terms.push(term); offsets.push(off);
  });
  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1];
    let t = rol16(u(offsets[i] + x)); let q = mul(t, 0x76F50F34);
    swapAcc = u(swapAcc + u(mul(rol16(q), 0xC3EFEA97) + q));
    t = rol16(u(offsets[i + 1] + y)); q = mul(t, 0x1881CE3C);
    swapLast = u(mul(rol16(q), 0x35BD1EC9) + q);
    swapAcc = u(swapAcc + swapLast);
    state = u(mul(state, keyA) + x);
    state = mul(rol16(state), 0xCF98B111); state = mul(rol16(state), 0x87085B9F);
    state = mul(rol16(state), 0x12CEB96D); state = mul(rol16(state), 0x257E1D83);
    acc = u(acc + state);
    t = u(mul(state, keyB) + y);
    t = mul(rol16(t), 0xA27416F5); t = mul(rol16(t), 0xD38396FF);
    state = mul(rol16(mul(rol16(t), 0x7C932B89)), 0xBFA49F69);
    acc = u(acc + state);
  }
  return [u(swapLast ^ state), u(swapAcc ^ acc)];
}
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

export function secMsGec(unixSeconds) {
  let ticks = BigInt(Math.floor(unixSeconds)) + WIN_EPOCH;
  ticks -= ticks % 300n;
  ticks *= 10000000n;
  const data = new TextEncoder().encode(`${ticks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = shaDigest(data);
  const [c1, c2] = cs64(data, digest);
  const cb = new Uint8Array(8); const cv = new DataView(cb.buffer);
  cv.setUint32(0, c1, true); cv.setUint32(4, c2, true);
  return `${hex(cb)}-${hex(digest)}`;
}
