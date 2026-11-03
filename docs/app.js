import {
  TAPE_PRINTABLE_PX, VERIFIED_TAPES_MM, DOTS_PER_MM, MEDIA, buildJob, STATUS_REQUEST, parseStatus,
} from './protocol.js';

const $ = (id) => document.getElementById(id);
const SPP = '00001101-0000-1000-8000-00805f9b34fb';
const SIDE_PAD = 12;
const PREVIEW_ONLY_PX = { 36: 200 }; // 36mm は印刷できないので、下見の目安の高さだけ
let bitmap = null; // { bits, width, height, tapeMm }
let imageEl = null;

const logEl = $('log');
const log = (m) => { logEl.textContent += (logEl.textContent ? '\n' : '') + m; logEl.scrollTop = logEl.scrollHeight; };

// ---- フォント(かわいいものは Google Fonts。bold を持たないフォントは太字にしない)
const JA_FALLBACK = "'Zen Maru Gothic','Noto Sans JP','Hiragino Maru Gothic ProN','Yu Gothic'";
const FONTS = [
  // 日本語(かわいい)
  { group: '日本語のかわいいフォント', label: 'ゼンマルゴシック(丸くてかわいい)', css: "'Zen Maru Gothic'", normal: 400, bold: 700 },
  { group: '日本語のかわいいフォント', label: 'キウイ丸(やさしい丸文字)', css: "'Kiwi Maru'", normal: 400, bold: 500 },
  { group: '日本語のかわいいフォント', label: 'ハチ丸ポップ(ポップ)', css: "'Hachi Maru Pop'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'モチイポップ(ぽってり)', css: "'Mochiy Pop One'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'ポタ(ふとい筆ぽってり)', css: "'Potta One'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'よもぎ(手書き)', css: "'Yomogi'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: '遊星マジック(マジック手書き)', css: "'Yusei Magic'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'クレー(教科書手書き)', css: "'Klee One'", normal: 400, bold: 600 },
  { group: '日本語のかわいいフォント', label: 'ゼン紅(ペン手書き)', css: "'Zen Kurenaido'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'ロックンロール(ふとい丸)', css: "'RocknRoll One'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'デラゴシック(極太)', css: "'Dela Gothic One'", normal: 400, bold: 400 },
  { group: '日本語のかわいいフォント', label: 'カイセイデコール(レトロ明朝)', css: "'Kaisei Decol'", normal: 400, bold: 700 },
  // 英語(アルファベット)。日本語の文字は丸ゴシックで補う
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Fredoka(まるくてポップ)', css: "'Fredoka'", normal: 400, bold: 600, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Baloo 2(ぷっくり)', css: "'Baloo 2'", normal: 400, bold: 700, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Chewy(おもちゃみたい)', css: "'Chewy'", normal: 400, bold: 400, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Sniglet(ころんとした丸)', css: "'Sniglet'", normal: 400, bold: 800, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Bubblegum Sans(ガムみたい)', css: "'Bubblegum Sans'", normal: 400, bold: 400, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Quicksand(やさしい丸)', css: "'Quicksand'", normal: 400, bold: 700, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Comfortaa(まんまる)', css: "'Comfortaa'", normal: 400, bold: 700, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Pacifico(筆記体)', css: "'Pacifico'", normal: 400, bold: 400, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Lobster(太い筆記体)', css: "'Lobster'", normal: 400, bold: 400, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Caveat(手書きメモ)', css: "'Caveat'", normal: 400, bold: 700, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Patrick Hand(手書き)', css: "'Patrick Hand'", normal: 400, bold: 400, latin: true },
  { group: '英語のかわいいフォント(日本語は丸ゴシック)', label: 'Gochi Hand(らくがき)', css: "'Gochi Hand'", normal: 400, bold: 400, latin: true },
  // ふつう
  { group: 'ふつうのフォント', label: 'ふつうのゴシック', css: "'Noto Sans JP','Noto Sans CJK JP','Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo'", normal: 400, bold: 700, generic: 'sans-serif' },
  { group: 'ふつうのフォント', label: 'ふつうの明朝', css: "'Noto Serif JP','Noto Serif CJK JP','Hiragino Mincho ProN','Yu Mincho','MS PMincho'", normal: 400, bold: 700, generic: 'serif' },
];
{
  const groups = new Map();
  FONTS.forEach((f, i) => {
    if (!groups.has(f.group)) { const g = document.createElement('optgroup'); g.label = f.group; groups.set(f.group, g); $('font').append(g); }
    const o = document.createElement('option'); o.value = i; o.textContent = f.label; groups.get(f.group).append(o);
  });
}
const fontSpec = () => {
  const f = FONTS[parseInt($('font').value, 10)];
  const weight = $('bold').checked ? f.bold : f.normal;
  const tail = f.generic || (f.latin ? `${JA_FALLBACK},sans-serif` : "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif");
  // 英語のフォントは、日本語の文字を丸ゴシックで補うので、補うほうも読み込む
  return { weight, family: `${f.css}, ${tail}`, first: f.css, fallback: f.latin ? "'Zen Maru Gothic'" : null };
};

// ---- 対応ブラウザの確認
if (!('serial' in navigator)) {
  $('support').textContent = 'このブラウザでは印刷できません(下見だけ使えます)。パソコンの Chrome か Edge で開いてください。';
}

// ---- 設定の読み取り
const tapeMm = () => parseFloat($('tape').value);
const modeVal = () => document.querySelector('input[name=mode]:checked').value;
const printablePxFor = (mm) => TAPE_PRINTABLE_PX[mm] ?? PREVIEW_ONLY_PX[mm] ?? 68;

function showPanels() {
  const m = modeVal();
  $('panel-text').hidden = m === 'image';
  $('panel-image').hidden = m === 'text';
  $('panel-combo').hidden = m !== 'combo';
}

function tapeNote() {
  const mm = tapeMm();
  let t;
  if (mm === 36) t = '36mm は、このプリンタ(128 ドットのヘッド)では印刷できません。下見だけ使えます。';
  else if (mm > 12) t = `${mm}mm は PT-P300BT では使えません(PT-P710BT など別機種向け)。印刷範囲は未確認です。`;
  else if (!VERIFIED_TAPES_MM.includes(mm)) t = `${mm}mm の印刷範囲は、PT-P300BT の実機で未確認です(12mm のみ確認済み)。最初は 1 枚で試してください。`;
  else t = '';
  $('tape-note').textContent = t;
}

// ---- 白黒のビットマップ(1 = 黒)
function grayToBits(canvas, { dither, invert, thresh }) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    gray[i] = invert ? 255 - v : v;
  }
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = gray[i];
      const nv = old < (dither ? 128 : thresh) ? 0 : 255;
      bits[i] = nv === 0 ? 1 : 0;
      if (dither) {
        const err = old - nv;
        if (x + 1 < w) gray[i + 1] += (err * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) gray[i + w - 1] += (err * 3) / 16;
          gray[i + w] += (err * 5) / 16;
          if (x + 1 < w) gray[i + w + 1] += err / 16;
        }
      }
    }
  }
  return { bits, width: w, height: h };
}

async function textBitmap(P) {
  const text = $('text').value;
  if (!text.trim()) return null;
  const lines = text.split('\n');
  const n = lines.length;
  const { weight, family, first, fallback } = fontSpec();
  try {
    await Promise.all([
      document.fonts.load(`${weight} 40px ${first}`, text),
      fallback ? document.fonts.load(`700 40px ${fallback}`, text) : null,
    ]);
  } catch { /* 読み込めなくても続ける */ }
  const probe = document.createElement('canvas').getContext('2d');
  const metrics = (size) => {
    probe.font = `${weight} ${size}px ${family}`;
    const m = probe.measureText('あ');
    const asc = m.fontBoundingBoxAscent ?? size * 0.9;
    const desc = m.fontBoundingBoxDescent ?? size * 0.25;
    return { asc, lineH: Math.ceil(asc + desc) };
  };
  const manual = parseInt($('fsize').value, 10);
  let size = manual || Math.max(6, Math.floor((P / n) * 0.9));
  let mt = metrics(size);
  while (!manual && mt.lineH * n > P && size > 6) { size -= 1; mt = metrics(size); }
  probe.font = `${weight} ${size}px ${family}`;
  const maxW = Math.max(...lines.map((l) => probe.measureText(l).width));
  const w = Math.max(1, Math.ceil(maxW) + SIDE_PAD * 2);
  const h = Math.min(P, mt.lineH * n);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#000'; g.font = `${weight} ${size}px ${family}`; g.textBaseline = 'alphabetic';
  lines.forEach((l, i) => g.fillText(l, SIDE_PAD, i * mt.lineH + mt.asc));
  return grayToBits(c, { dither: false, invert: false, thresh: 140 });
}

function imageBitmap(P, scale) {
  if (!imageEl) return null;
  const rot = parseInt($('rotate').value, 10);
  const swap = rot === 90 || rot === 270;
  const sw = swap ? imageEl.naturalHeight : imageEl.naturalWidth;
  const sh = swap ? imageEl.naturalWidth : imageEl.naturalHeight;
  const H = Math.max(1, Math.round(P * scale));
  const W = Math.max(1, Math.round((sw * H) / sh));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate((rot * Math.PI) / 180);
  const dw = swap ? H : W, dh = swap ? W : H;
  g.drawImage(imageEl, -dw / 2, -dh / 2, dw, dh);
  g.restore();
  return grayToBits(c, { dither: $('dither').checked, invert: $('invert').checked, thresh: parseInt($('thresh').value, 10) });
}

// 部品を横に並べて、高さ P の 1 枚にする(上下は中央そろえ)
function compose(parts, gap, P) {
  const width = parts.reduce((s, p) => s + p.width, 0) + gap * (parts.length - 1);
  const bits = new Uint8Array(width * P);
  let x0 = 0;
  for (const p of parts) {
    const y0 = Math.floor((P - p.height) / 2);
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.bits[y * p.width + x]) bits[(y0 + y) * width + x0 + x] = 1;
    x0 += p.width + gap;
  }
  return { bits, width, height: P };
}

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const mm = tapeMm();
  const P = printablePxFor(mm);
  tapeNote();
  const m = modeVal();
  let result = null;
  let hint = '';
  if (m === 'text') {
    const t = await textBitmap(P);
    if (t) result = t; else hint = '文字を入れてください';
  } else if (m === 'image') {
    const im = imageBitmap(P, 1);
    if (im) result = compose([im], 0, P); else hint = '画像を選んでください';
  } else {
    const t = await textBitmap(P);
    const im = imageBitmap(P, parseInt($('iconscale').value, 10) / 100);
    const parts = [];
    const gap = Math.max(0, parseInt($('gap').value, 10) || 0);
    if (im && t) parts.push(...($('imgpos').value === 'left' ? [im, t] : [t, im]));
    else if (t) parts.push(t);
    else if (im) parts.push(im);
    if (parts.length) result = compose(parts, parts.length > 1 ? gap : 0, P);
    if (!im) hint = '画像を選ぶと、文字と並べます(いまは文字だけ)';
    if (!t && !im) hint = '文字を入れるか、画像を選んでください';
  }
  if (token !== renderToken) return; // 新しい入力が来たので捨てる
  drawPreview(result, mm, P);
  bitmap = result ? { ...result, tapeMm: mm } : null;
  $('meta').textContent = result
    ? `テープ ${mm}mm ・ 長さ 約 ${(result.width / DOTS_PER_MM).toFixed(1)} mm ・ ${result.width}×${result.height} ドット${hint ? ' ・ ' + hint : ''}`
    : hint || '—';
}

// 実寸(CSS の mm)で、テープの幅のまま表示する。点線が印刷できる範囲。
function drawPreview(res, mm, P) {
  const zoom = parseInt($('zoom').value, 10);
  const strip = $('tape-strip');
  const cv = $('preview');
  const padMm = 3;
  const lenMm = res ? res.width / DOTS_PER_MM : 20;
  const hMm = P / DOTS_PER_MM;
  const z = (v) => `${(v * zoom).toFixed(3)}mm`;
  strip.style.width = z(lenMm + padMm * 2);
  strip.style.height = z(mm);
  strip.style.setProperty('--pad-x', z(padMm));
  strip.style.setProperty('--c-top', z((mm - hMm) / 2));
  strip.style.setProperty('--g-top', z((mm - hMm) / 2));
  strip.style.setProperty('--g-h', z(hMm));
  const S = 4; // 内部の解像度(くっきり見せるため)
  if (!res) { cv.width = 1; cv.height = 1; cv.style.width = '0'; cv.style.height = '0'; return; }
  cv.width = res.width * S; cv.height = res.height * S;
  cv.style.width = z(res.width / DOTS_PER_MM);
  cv.style.height = z(res.height / DOTS_PER_MM);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#000';
  for (let y = 0; y < res.height; y++) for (let x = 0; x < res.width; x++) if (res.bits[y * res.width + x]) g.fillRect(x * S, y * S, S, S);
}

// ---- 入力のつなぎ
for (const el of document.querySelectorAll('input[name=mode]')) el.addEventListener('change', () => { showPanels(); render(); });
for (const id of ['tape', 'text', 'font', 'bold', 'fsize', 'rotate', 'dither', 'invert', 'thresh', 'imgpos', 'iconscale', 'gap', 'zoom']) $(id).addEventListener('input', render);
$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => { imageEl = img; render(); };
  img.onerror = () => log('この画像は読み込めませんでした');
  img.src = URL.createObjectURL(f);
});
if (document.fonts?.ready) document.fonts.ready.then(render);
showPanels();
render();

// ---- プリンタ(Web Serial の Bluetooth シリアル)
async function pickPort() {
  const granted = await navigator.serial.getPorts();
  if (granted.length === 1) return granted[0];
  return navigator.serial.requestPort({ filters: [{ bluetoothServiceClassId: SPP }] });
}

async function withPort(fn) {
  const port = await pickPort();
  await port.open({ baudRate: 9600 });
  try { return await fn(port); } finally { try { await port.close(); } catch { /* 既に閉じている */ } }
}

async function readExactly(port, n, ms) {
  const reader = port.readable.getReader();
  const timer = setTimeout(() => reader.cancel().catch(() => {}), ms);
  const out = [];
  try {
    while (out.length < n) {
      const { value, done } = await reader.read();
      if (done) break;
      out.push(...value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  return Uint8Array.from(out);
}

async function writeAll(port, data) {
  const w = port.writable.getWriter();
  try {
    for (let i = 0; i < data.length; i += 512) await w.write(data.subarray(i, i + 512));
  } finally { w.releaseLock(); }
}

const hasSerial = 'serial' in navigator;
const busy = (b) => { $('btn-print').disabled = b || !hasSerial; $('btn-status').disabled = b || !hasSerial; };
busy(false);

$('btn-status').onclick = async () => {
  busy(true);
  try {
    await withPort(async (port) => {
      log('つないでいます…');
      const init = new Uint8Array(64 + 2 + STATUS_REQUEST.length);
      init.set([0x1b, 0x40], 64); init.set(STATUS_REQUEST, 66);
      await writeAll(port, init);
      const st = parseStatus(await readExactly(port, 32, 4000));
      log(st.tapeMm ? `つながりました。テープ ${st.tapeMm}mm、${st.ok ? 'エラーなし' : 'エラーあり(' + st.errorBits + ')'}` : '返事がありませんでした(電源を入れ直して、もう一度)');
    });
  } catch (e) { log('失敗: ' + (e.message || e)); } finally { busy(false); }
};

$('btn-print').onclick = async () => {
  if (!bitmap) { log('先にラベルを作ってください'); return; }
  const mm = bitmap.tapeMm;
  if (!(mm in TAPE_PRINTABLE_PX)) { log(`${mm}mm は、このプリンタでは印刷できません(下見のみ)`); return; }
  const copies = Math.min(20, Math.max(1, parseInt($('copies').value, 10) || 1));
  busy(true);
  try {
    const job = buildJob(bitmap.bits, bitmap.width, bitmap.height, { tapeMm: mm, media: MEDIA[$('media').value] });
    await withPort(async (port) => {
      log(`${mm}mm のテープに ${copies} 枚を送っています…`);
      for (let i = 0; i < copies; i++) { await writeAll(port, job); await new Promise((r) => setTimeout(r, 200)); }
      await new Promise((r) => setTimeout(r, 1200));
      log('送りました。テープが出てくるのを待ってください');
    });
  } catch (e) { log('失敗: ' + (e.message || e)); } finally { busy(false); }
};
