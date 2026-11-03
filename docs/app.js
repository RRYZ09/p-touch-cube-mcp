import {
  TAPE_PRINTABLE_PX, VERIFIED_TAPES_MM, MEDIA, buildJob, STATUS_REQUEST, parseStatus,
} from './protocol.js?v=0.3.4';
import { parseSettings, serializeSettings } from './settings.js?v=0.3.4';
import { MODELS, canPrint } from './models.js?v=0.3.4';
import { EN, JA_DYNAMIC } from './i18n.js?v=0.3.4';

const $ = (id) => document.getElementById(id);
const SPP = '00001101-0000-1000-8000-00805f9b34fb';
const SIDE_PAD = 12;
let bitmap = null; // { bits, width, height, tapeMm }
let imageEl = null;
let fileData = null; // 読み込んだ画像の data URL(設定に含めるため)
let lang = 'ja';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できなくても動く */ } },
};

// ---- 言語(日本語 / English)。日本語の文は index.html に書いてあり、英語は i18n.js
const JA_STATIC = new Map();
for (const el of document.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-ph]')) {
  JA_STATIC.set(el, { text: el.textContent, html: el.innerHTML, ph: el.getAttribute('placeholder') });
}
const T = (key, params = {}) => {
  const str = (lang === 'en' ? EN[key] : JA_DYNAMIC[key]) ?? JA_DYNAMIC[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
};
function applyLang() {
  document.documentElement.lang = lang;
  document.title = lang === 'en' ? 'P-TOUCH CUBE Label Maker' : 'P-TOUCH CUBE ラベルメーカー';
  for (const [el, ja] of JA_STATIC) {
    const key = el.dataset.i18n || el.dataset.i18nHtml;
    if (el.dataset.i18nPh) el.setAttribute('placeholder', lang === 'en' ? EN[el.dataset.i18nPh] : ja.ph);
    if (el.dataset.i18n) el.textContent = lang === 'en' ? EN[key] : ja.text;
    else if (el.dataset.i18nHtml) el.innerHTML = lang === 'en' ? EN[key] : ja.html;
  }
  $('lang').textContent = lang === 'en' ? '日本語' : 'EN';
  $('support').textContent = 'serial' in navigator ? '' : T('support-no');
  $('preview').setAttribute('aria-label', lang === 'en' ? 'Label preview' : 'ラベルの下見');
  buildFontOptions();
  buildModelOptions();
  buildTapeOptions();
  applyTheme();
}
function setLang(l) { lang = l; store.set('lang', l); applyLang(); render(); }

// ---- テーマ(ライト / ダークの 2 つ。はじめはライト。OS の設定には従わない)
let theme = 'light';
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  $('theme').textContent = theme === 'light' ? '🌙' : '☀️';
  const label = T(theme === 'light' ? 'to-dark' : 'to-light');
  $('theme').title = label; $('theme').setAttribute('aria-label', label);
}
$('theme').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(); };

const logEl = $('log');
window.addEventListener('error', (e) => { try { logEl.textContent += (logEl.textContent ? '\n' : '') + 'error: ' + (e.message || e); } catch { /* 表示できない */ } });
window.addEventListener('unhandledrejection', (e) => { try { logEl.textContent += (logEl.textContent ? '\n' : '') + 'error: ' + (e.reason?.message || e.reason); } catch { /* 表示できない */ } });
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
const FONT_EN = {
  'Zen Maru Gothic': 'Zen Maru Gothic (round & cute)', 'Kiwi Maru': 'Kiwi Maru (gentle round)', 'Hachi Maru Pop': 'Hachi Maru Pop (pop)',
  'Mochiy Pop One': 'Mochiy Pop One (chubby)', 'Potta One': 'Potta One (fat brush)', 'Yomogi': 'Yomogi (handwriting)',
  'Yusei Magic': 'Yusei Magic (marker)', 'Klee One': 'Klee One (textbook hand)', 'Zen Kurenaido': 'Zen Kurenaido (pen hand)',
  'RocknRoll One': 'RocknRoll One (bold round)', 'Dela Gothic One': 'Dela Gothic One (extra bold)', 'Kaisei Decol': 'Kaisei Decol (retro serif)',
  'Fredoka': 'Fredoka (round & poppy)', 'Baloo 2': 'Baloo 2 (puffy)', 'Chewy': 'Chewy (toy-like)', 'Sniglet': 'Sniglet (soft round)',
  'Bubblegum Sans': 'Bubblegum Sans (bubblegum)', 'Quicksand': 'Quicksand (gentle round)', 'Comfortaa': 'Comfortaa (perfect circles)',
  'Pacifico': 'Pacifico (script)', 'Lobster': 'Lobster (bold script)', 'Caveat': 'Caveat (handwritten note)', 'Patrick Hand': 'Patrick Hand (hand)',
  'Gochi Hand': 'Gochi Hand (doodle)', 'Noto Sans JP': 'Plain gothic', 'Noto Serif JP': 'Plain serif',
};
const GROUP_EN = { '日本語のかわいいフォント': 'Cute Japanese fonts', '英語のかわいいフォント(日本語は丸ゴシック)': 'Cute English fonts (Japanese in rounded gothic)', 'ふつうのフォント': 'Plain fonts' };
function fillFontSelect(sel, { withSame = false } = {}) {
  const cur = sel.value || (withSame ? 'same' : '0');
  sel.textContent = '';
  if (withSame) { const o = document.createElement('option'); o.value = 'same'; o.textContent = T('font-same'); sel.append(o); }
  const groups = new Map();
  FONTS.forEach((f, i) => {
    if (!groups.has(f.group)) {
      const g = document.createElement('optgroup');
      g.label = lang === 'en' ? GROUP_EN[f.group] : f.group;
      groups.set(f.group, g); sel.append(g);
    }
    const o = document.createElement('option');
    o.value = i;
    const key = f.css.split(',')[0].replace(/'/g, '');
    o.textContent = lang === 'en' ? FONT_EN[key] : f.label;
    groups.get(f.group).append(o);
  });
  sel.value = cur;
}
function buildFontOptions() {
  fillFontSelect($('font'));
  fillFontSelect($('font-en'), { withSame: true });
  buildSegments();
}
const fontSpec = (idx = $('font').value) => {
  const f = FONTS[parseInt(idx, 10)];
  const weight = $('bold').checked ? f.bold : f.normal;
  const tail = f.generic || (f.latin ? `${JA_FALLBACK},sans-serif` : "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif");
  // 英語のフォントは、日本語の文字を丸ゴシックで補うので、補うほうも読み込む
  return { weight, family: `${f.css}, ${tail}`, first: f.css, fallback: f.latin ? "'Zen Maru Gothic'" : null };
};

// ---- 文字ごとのフォント(上級): 区切った文字それぞれにフォントを付けて、左から順につなぐ
let segs = [{ text: 'ラベル', font: '0' }, { text: 'Label', font: '12' }];
function buildSegments() {
  const list = $('seg-list');
  list.textContent = '';
  segs.forEach((sg, i) => {
    const row = document.createElement('div'); row.className = 'seg-row';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = sg.text; inp.placeholder = T('seg-ph');
    inp.addEventListener('input', () => { sg.text = inp.value; render(); });
    const sel = document.createElement('select');
    fillFontSelect(sel); sel.value = sg.font;
    sel.addEventListener('input', () => { sg.font = sel.value; render(); });
    const del = document.createElement('button'); del.type = 'button'; del.textContent = '×'; del.className = 'small';
    del.setAttribute('aria-label', 'delete'); del.disabled = segs.length <= 1;
    del.addEventListener('click', () => { segs.splice(i, 1); buildSegments(); render(); });
    row.append(inp, sel, del); list.append(row);
  });
}
$('seg-add').onclick = () => { segs.push({ text: '', font: $('font').value }); buildSegments(); render(); };
const segMode = () => $('seg-mode').checked;
const mainLines = () => (segMode() ? segmentLines() : simpleLines($('text').value));

// 文字の種類で分ける: 半角の英数字・記号は「英数字のフォント」、それ以外は「日本語のフォント」
const isLatin = (ch) => ch >= ' ' && ch <= '~';
function splitRuns(line, jaSpec, enSpec) {
  if (enSpec === jaSpec) return [{ text: line, spec: jaSpec }];
  const runs = [];
  for (const ch of line) {
    const spec = isLatin(ch) ? enSpec : jaSpec;
    if (runs.length && runs[runs.length - 1].spec === spec) runs[runs.length - 1].text += ch;
    else runs.push({ text: ch, spec });
  }
  return runs;
}
// 入力 → 行のリスト(行 = 文字の断片のリスト)
function simpleLines(text) {
  const ja = fontSpec($('font').value);
  const en = $('font-en').value === 'same' ? ja : fontSpec($('font-en').value);
  return text.split('\n').map((l) => splitRuns(l, ja, en));
}
function segmentLines() {
  return [segs.filter((sg) => sg.text !== '').map((sg) => ({ text: sg.text, spec: fontSpec(sg.font) }))];
}

// ---- 対応ブラウザの確認
if (!('serial' in navigator)) {
  $('support').dataset.on = '1';
}

// ---- 設定の読み取り
const model = () => $('model').value;
function buildModelOptions() {
  const sel = $('model');
  const cur = sel.value || 'PT-P300BT';
  sel.textContent = '';
  for (const [name, m] of Object.entries(MODELS)) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = m.support === 'verified' ? name : `${name}(${T('unverified')})`;
    sel.append(o);
  }
  sel.value = cur;
}
const dotsPerMm = () => MODELS[model()].dpi / 25.4;
const tapeMm = () => parseFloat($('tape').value);
function buildTapeOptions() {
  const sel = $('tape');
  const cur = sel.value ? parseFloat(sel.value) : 12;
  const tapes = MODELS[model()].tapes;
  sel.textContent = '';
  for (const mm of tapes) {
    const o = document.createElement('option');
    o.value = mm;
    const ok = mm === 12 && MODELS[model()].support === 'verified';
    o.textContent = `${mm}mm(${T(ok ? 'verified' : 'unverified')})`;
    sel.append(o);
  }
  sel.value = tapes.includes(cur) ? String(cur) : '12';
}
const modeVal = () => document.querySelector('input[name=mode]:checked').value;
// 印刷できる機種は表の値。下見だけの機種(PT-P910BT など)は、テープ幅の約 85% を目安にする
const printablePxFor = (mm) => (MODELS[model()].dpi === 180 && TAPE_PRINTABLE_PX[mm]) || Math.round(mm * 0.85 * dotsPerMm());

function showPanels() {
  const m = modeVal();
  $('panel-text').hidden = m === 'image';
  $('simple-wrap').hidden = segMode();
  $('seg-wrap').hidden = !segMode();
  $('panel-image').hidden = m === 'text';
  $('panel-combo').hidden = m !== 'combo';
  $('text2-wrap').hidden = !(m === 'combo' && $('imgpos').value === 'between');
}

function tapeNote() {
  const mm = tapeMm(), m = model(), sup = MODELS[m].support;
  let t = '';
  if (sup === 'preview') t = T('note-preview', { model: m });
  else if (sup === 'experimental') t = T('note-experimental', { model: m });
  else if (!VERIFIED_TAPES_MM.includes(mm)) t = T('note-unverified', { mm });
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

async function textBitmap(P, lines) {
  const flat = lines.flat().filter((r) => r.text);
  if (!flat.length) return null;
  const n = lines.length;
  try {
    await Promise.all(flat.flatMap((r) => [
      document.fonts.load(`${r.spec.weight} 40px ${r.spec.first}`, r.text),
      r.spec.fallback ? document.fonts.load(`700 40px ${r.spec.fallback}`, r.text) : null,
    ]));
  } catch { /* 読み込めなくても続ける */ }
  const probe = document.createElement('canvas').getContext('2d');
  const fontStr = (spec, size) => `${spec.weight} ${size}px ${spec.family}`;
  // 行ごとに、使うフォントのうち一番大きい上端・下端にそろえる(ベースラインを合わせる)
  const lineMetrics = (line, size) => {
    let asc = 0, desc = 0;
    for (const r of line.length ? line : [flat[0]]) {
      probe.font = fontStr(r.spec, size);
      const m = probe.measureText('あ');
      asc = Math.max(asc, m.fontBoundingBoxAscent ?? size * 0.9);
      desc = Math.max(desc, m.fontBoundingBoxDescent ?? size * 0.25);
    }
    return { asc, lineH: Math.ceil(asc + desc) };
  };
  const manual = parseInt($('fsize').value, 10);
  let size = manual || Math.max(6, Math.floor((P / n) * 0.9));
  const all = (sz) => lines.map((l) => lineMetrics(l, sz));
  let ms = all(size);
  const total = (m) => m.reduce((a, x) => a + x.lineH, 0);
  while (!manual && total(ms) > P && size > 6) { size -= 1; ms = all(size); }
  const widthOf = (line) => line.reduce((a, r) => { probe.font = fontStr(r.spec, size); return a + probe.measureText(r.text).width; }, 0);
  const w = Math.max(1, Math.ceil(Math.max(...lines.map(widthOf))) + SIDE_PAD * 2);
  const h = Math.min(P, total(ms));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
  let y = 0;
  lines.forEach((line, i) => {
    let x = SIDE_PAD;
    for (const r of line) { g.font = fontStr(r.spec, size); g.fillText(r.text, x, y + ms[i].asc); x += g.measureText(r.text).width; }
    y += ms[i].lineH;
  });
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
    const t = await textBitmap(P, mainLines());
    if (t) result = t; else hint = T('need-text');
  } else if (m === 'image') {
    const im = imageBitmap(P, 1);
    if (im) result = compose([im], 0, P); else hint = T('need-image');
  } else {
    const t = await textBitmap(P, mainLines());
    const im = imageBitmap(P, parseInt($('iconscale').value, 10) / 100);
    const layout = $('imgpos').value;
    const t2 = layout === 'between' ? await textBitmap(P, simpleLines($('text2').value)) : null;
    const gap = Math.max(0, parseInt($('gap').value, 10) || 0);
    let parts = [];
    if (im && t) {
      parts = { left: [im, t], right: [t, im], both: [im, t, im], between: [t, im, ...(t2 ? [t2] : [])] }[layout];
    } else if (t) parts = [t];
    else if (im) parts = [im];
    if (parts.length) result = compose(parts, parts.length > 1 ? gap : 0, P);
    if (!im) hint = T('text-only');
    if (!t && !im) hint = T('need-either');
  }
  if (token !== renderToken) return; // 新しい入力が来たので捨てる
  drawPreview(result, mm, P);
  bitmap = result ? { ...result, tapeMm: mm } : null;
  $('btn-save').disabled = !result;
  $('meta').textContent = result
    ? T('meta', { mm, len: (result.width / dotsPerMm()).toFixed(1), w: result.width, h: result.height, hint: hint ? ' · ' + hint : '' })
    : hint || '—';
}

// 実寸(CSS の mm)で、テープの幅のまま表示する。点線が印刷できる範囲。
function drawPreview(res, mm, P) {
  const zoom = parseInt($('zoom').value, 10);
  const strip = $('tape-strip');
  const cv = $('preview');
  const padMm = 3;
  const lenMm = res ? res.width / dotsPerMm() : 20;
  const hMm = P / dotsPerMm();
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
  cv.style.width = z(res.width / dotsPerMm());
  cv.style.height = z(res.height / dotsPerMm());
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#000';
  for (let y = 0; y < res.height; y++) for (let x = 0; x < res.width; x++) if (res.bits[y * res.width + x]) g.fillRect(x * S, y * S, S, S);
}

// ---- 入力のつなぎ
for (const el of document.querySelectorAll('input[name=mode]')) el.addEventListener('change', () => { showPanels(); render(); });
$('imgpos').addEventListener('input', showPanels);
$('model').addEventListener('input', () => { buildTapeOptions(); setPrintEnabled(); render(); });
$('seg-mode').addEventListener('input', () => { showPanels(); render(); });
for (const id of ['text2', 'tape', 'text', 'font', 'font-en', 'bold', 'fsize', 'rotate', 'dither', 'invert', 'thresh', 'imgpos', 'iconscale', 'gap', 'zoom']) $(id).addEventListener('input', render);
function loadImageData(dataUrl) {
  const img = new Image();
  img.onload = () => { fileData = dataUrl; imageEl = img; render(); };
  img.onerror = () => log(T('img-fail'));
  img.src = dataUrl;
}
$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => loadImageData(rd.result);
  rd.onerror = () => log(T('img-fail'));
  rd.readAsDataURL(f);
});
if (document.fonts?.ready) document.fonts.ready.then(render);
$('lang').onclick = () => setLang(lang === 'en' ? 'ja' : 'en');
{
  const q = new URLSearchParams(location.search).get('lang');
  const saved = store.get('lang');
  lang = q === 'en' || q === 'ja' ? q : saved || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en');
  const st = store.get('theme');
  if (st === 'dark') theme = 'dark';
}
showPanels();
applyLang();
render();

// ---- 画像として保存(ラベルのドットを 4 倍にした PNG。白地に黒)
$('btn-save').onclick = () => {
  if (!bitmap) { log(T('nothing-to-save')); return; }
  const S = 4;
  const c = document.createElement('canvas');
  c.width = bitmap.width * S; c.height = bitmap.height * S;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000';
  for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) if (bitmap.bits[y * bitmap.width + x]) g.fillRect(x * S, y * S, S, S);
  const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
  const name = `p-touch-label-${bitmap.tapeMm}mm-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`;
  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    log(T('saved', { name }));
  }, 'image/png');
};

// ---- 設定の書き出し・読み込み(JSON)。フォントは、並び順が変わっても読めるように、名前で持つ
const fontKeyOf = (i) => FONTS[parseInt(i, 10)]?.css.split(',')[0].replace(/'/g, '') ?? '';
const fontIndexOf = (key, fallback) => { const i = FONTS.findIndex((f) => f.css.split(',')[0].replace(/'/g, '') === key); return i < 0 ? fallback : String(i); };
const stamp = () => { const d = new Date(), p2 = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`; };

function getSettings() {
  const st = {
    model: model(), tape: tapeMm(), mode: modeVal(), text: $('text').value, text2: $('text2').value,
    fontJa: fontKeyOf($('font').value), fontEn: $('font-en').value === 'same' ? 'same' : fontKeyOf($('font-en').value),
    bold: $('bold').checked, fsize: parseInt($('fsize').value, 10) || null,
    segMode: segMode(), segments: segs.map((g) => ({ text: g.text, font: fontKeyOf(g.font) })),
    rotate: parseInt($('rotate').value, 10), dither: $('dither').checked, invert: $('invert').checked, thresh: parseInt($('thresh').value, 10),
    layout: $('imgpos').value, iconscale: parseInt($('iconscale').value, 10), gap: parseInt($('gap').value, 10) || 0,
    zoom: parseInt($('zoom').value, 10), copies: parseInt($('copies').value, 10) || 1, media: $('media').value,
  };
  if ($('incl-image').checked && fileData) st.image = fileData;
  return st;
}

function applySettings(st) {
  $('model').value = st.model; buildTapeOptions(); $('tape').value = String(st.tape);
  const r = document.querySelector(`input[name=mode][value=${st.mode}]`); if (r) r.checked = true;
  $('text').value = st.text; $('text2').value = st.text2;
  $('font').value = fontIndexOf(st.fontJa, $('font').value);
  $('font-en').value = st.fontEn === 'same' ? 'same' : fontIndexOf(st.fontEn, 'same');
  $('bold').checked = st.bold; $('fsize').value = st.fsize ?? '';
  $('seg-mode').checked = st.segMode;
  if (st.segments.length) segs = st.segments.map((g) => ({ text: g.text, font: fontIndexOf(g.font, '0') }));
  $('rotate').value = String(st.rotate); $('dither').checked = st.dither; $('invert').checked = st.invert; $('thresh').value = st.thresh;
  $('imgpos').value = st.layout; $('iconscale').value = st.iconscale; $('gap').value = st.gap;
  $('zoom').value = String(st.zoom); $('copies').value = st.copies; $('media').value = st.media;
  buildSegments(); showPanels(); setPrintEnabled();
  if (st.image) loadImageData(st.image); else render();
}

$('btn-export').onclick = () => {
  const name = `p-touch-label-settings-${stamp()}.json`;
  const url = URL.createObjectURL(new Blob([serializeSettings(getSettings())], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(T('exported', { name }));
};
$('btn-import').onclick = () => $('import-file').click();
$('import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const r = parseSettings(await f.text());
  if (!r.ok) { log(T('imp-' + r.errors[0])); return; }
  applySettings(r.settings);
  log(T('imported', { name: f.name }));
});

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
let working = false;
const setPrintEnabled = () => {
  $('btn-print').disabled = working || !hasSerial || !canPrint(model());
  $('btn-status').disabled = working || !hasSerial;
};
const busy = (b) => { working = b; setPrintEnabled(); };
setPrintEnabled();

$('btn-status').onclick = async () => {
  busy(true);
  try {
    await withPort(async (port) => {
      log(T('connecting'));
      const init = new Uint8Array(64 + 2 + STATUS_REQUEST.length);
      init.set([0x1b, 0x40], 64); init.set(STATUS_REQUEST, 66);
      await writeAll(port, init);
      const st = parseStatus(await readExactly(port, 32, 4000));
      log(st.tapeMm ? T('connected', { mm: st.tapeMm, state: st.ok ? T('no-error') : T('has-error', { bits: st.errorBits }) }) : T('no-reply'));
    });
  } catch (e) { log(T('failed', { msg: e.message || e })); } finally { busy(false); }
};

$('btn-print').onclick = async () => {
  if (!bitmap) { log(T('make-first')); return; }
  if (!canPrint(model())) { log(T('cannot-print', { what: model() })); return; }
  const mm = bitmap.tapeMm;
  if (!(mm in TAPE_PRINTABLE_PX)) { log(T('cannot-print', { what: mm + 'mm' })); return; }
  const copies = Math.min(20, Math.max(1, parseInt($('copies').value, 10) || 1));
  busy(true);
  try {
    const job = buildJob(bitmap.bits, bitmap.width, bitmap.height, { tapeMm: mm, media: MEDIA[$('media').value] });
    await withPort(async (port) => {
      log(T('sending', { mm, copies }));
      for (let i = 0; i < copies; i++) { await writeAll(port, job); await new Promise((r) => setTimeout(r, 200)); }
      await new Promise((r) => setTimeout(r, 1200));
      log(T('sent'));
    });
  } catch (e) { log(T('failed', { msg: e.message || e })); } finally { busy(false); }
};
