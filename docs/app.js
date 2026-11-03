import { PRINTABLE_PX, MEDIA, buildJob, STATUS_REQUEST, parseStatus } from './protocol.js';

const $ = (id) => document.getElementById(id);
const SPP = '00001101-0000-1000-8000-00805f9b34fb';
const SIDE_PAD = 12;
const DOTS_PER_MM = 7.09; // 180dpi
let bitmap = null; // { bits, width, height }
let imageEl = null;

const logEl = $('log');
const log = (m) => { logEl.textContent += (logEl.textContent ? '\n' : '') + m; logEl.scrollTop = logEl.scrollHeight; };

// ---- 対応ブラウザの確認
if (!('serial' in navigator)) {
  $('support').textContent = 'このブラウザでは印刷できません(下見だけ使えます)。パソコンの Chrome か Edge で開いてください。';
  $('btn-print').disabled = true;
  $('btn-status').disabled = true;
}

// ---- タブ
function selectTab(name) {
  for (const t of ['text', 'image']) {
    $('tab-' + t).setAttribute('aria-selected', String(t === name));
    $('panel-' + t).hidden = t !== name;
  }
  render();
}
$('tab-text').onclick = () => selectTab('text');
$('tab-image').onclick = () => selectTab('image');
const mode = () => ($('tab-text').getAttribute('aria-selected') === 'true' ? 'text' : 'image');

// ---- ラベル画像(白黒)を作る
function textCanvas() {
  const lines = $('text').value.split('\n');
  const n = lines.length;
  const fam = $('font').value;
  const weight = $('bold').checked ? '700' : '400';
  const manual = parseInt($('fsize').value, 10);
  const probe = document.createElement('canvas').getContext('2d');
  const metrics = (size) => {
    probe.font = `${weight} ${size}px ${fam}`;
    const m = probe.measureText('あ');
    const asc = m.fontBoundingBoxAscent ?? size * 0.9;
    const desc = m.fontBoundingBoxDescent ?? size * 0.25;
    return { asc, lineH: Math.ceil(asc + desc) };
  };
  let size = manual || Math.max(8, Math.floor((PRINTABLE_PX / n) * 0.9));
  let mt = metrics(size);
  while (!manual && mt.lineH * n > PRINTABLE_PX && size > 8) { size -= 2; mt = metrics(size); }
  probe.font = `${weight} ${size}px ${fam}`;
  const maxW = Math.max(...lines.map((l) => probe.measureText(l).width));
  const w = Math.max(1, Math.ceil(maxW) + SIDE_PAD * 2);
  const h = Math.min(PRINTABLE_PX, mt.lineH * n);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#000'; g.font = `${weight} ${size}px ${fam}`; g.textBaseline = 'alphabetic';
  lines.forEach((l, i) => g.fillText(l, SIDE_PAD, i * mt.lineH + mt.asc));
  return c;
}

function imageCanvas() {
  if (!imageEl) return null;
  const rot = parseInt($('rotate').value, 10);
  const swap = rot === 90 || rot === 270;
  const sw = swap ? imageEl.naturalHeight : imageEl.naturalWidth;
  const sh = swap ? imageEl.naturalWidth : imageEl.naturalHeight;
  const w = Math.max(1, Math.round((sw * PRINTABLE_PX) / sh));
  const c = document.createElement('canvas');
  c.width = w; c.height = PRINTABLE_PX;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, PRINTABLE_PX);
  g.save();
  g.translate(w / 2, PRINTABLE_PX / 2);
  g.rotate((rot * Math.PI) / 180);
  const dw = swap ? PRINTABLE_PX : w, dh = swap ? w : PRINTABLE_PX;
  g.drawImage(imageEl, -dw / 2, -dh / 2, dw, dh);
  g.restore();
  return c;
}

// グレー → 白黒(しきい値 or Floyd–Steinberg)。1 = 黒
function toBits(canvas, { dither, invert, thresh }) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let v = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    gray[i] = invert ? 255 - v : v;
  }
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = gray[i];
      const t = dither ? 128 : thresh;
      const nv = old < t ? 0 : 255;
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

function render() {
  const pv = $('preview');
  let src;
  if (mode() === 'text') {
    if (!$('text').value.trim()) { bitmap = null; pv.width = 10; pv.height = 10; $('meta').textContent = '文字を入れてください'; return; }
    src = textCanvas();
    bitmap = toBits(src, { dither: false, invert: false, thresh: 140 });
  } else {
    src = imageCanvas();
    if (!src) { bitmap = null; pv.width = 10; pv.height = 10; $('meta').textContent = '画像を選んでください'; return; }
    bitmap = toBits(src, { dither: $('dither').checked, invert: $('invert').checked, thresh: parseInt($('thresh').value, 10) });
  }
  const S = 3;
  pv.width = bitmap.width * S; pv.height = bitmap.height * S;
  const g = pv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, pv.width, pv.height);
  g.fillStyle = '#000';
  for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) if (bitmap.bits[y * bitmap.width + x]) g.fillRect(x * S, y * S, S, S);
  $('meta').textContent = `テープの長さ 約 ${(bitmap.width / DOTS_PER_MM).toFixed(1)} mm ・ ${bitmap.width}×${bitmap.height} ドット`;
}

for (const id of ['text', 'font', 'bold', 'fsize', 'rotate', 'dither', 'invert', 'thresh']) $(id).addEventListener('input', render);
$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => { imageEl = img; render(); };
  img.onerror = () => log('この画像は読み込めませんでした');
  img.src = URL.createObjectURL(f);
});
if (document.fonts?.ready) document.fonts.ready.then(render);
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

const busy = (b) => { $('btn-print').disabled = b || !('serial' in navigator); $('btn-status').disabled = b || !('serial' in navigator); };

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
  const copies = Math.min(20, Math.max(1, parseInt($('copies').value, 10) || 1));
  busy(true);
  try {
    const job = buildJob(bitmap.bits, bitmap.width, bitmap.height, { media: MEDIA[$('media').value] });
    await withPort(async (port) => {
      log(`${copies} 枚を送っています…`);
      for (let i = 0; i < copies; i++) { await writeAll(port, job); await new Promise((r) => setTimeout(r, 200)); }
      await new Promise((r) => setTimeout(r, 1200));
      log('送りました。テープが出てくるのを待ってください');
    });
  } catch (e) { log('失敗: ' + (e.message || e)); } finally { busy(false); }
};
