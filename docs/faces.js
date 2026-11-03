// ぷちの顔(ラベルに印刷する用)。
// 部品の寸法と描き方は「ぷちのきせかえ」(https://teampuchi.github.io/kisekae/、チームぷち)と同じで、
// 元は m5-petit-firmware の drawFace()。ここでは動かさず、止まった顔の SVG を作る。
// 印刷は白黒なので、顔は色に関係なく黒で描く(薄い色は白黒にすると消えてしまうため)。
// src/ptouch_cube_mcp/faces.py と同じ表。同じかどうかは tests/test_protocol.py が見ている。

export const EYES = [
  { key: 'now', ja: 'いつもの', en: 'Usual', shape: 'ellipse', rx: 22, ry: 32, dx: 85, dy: -30, tilt: 20 },
  { key: 'round', ja: 'まんまる', en: 'Round', shape: 'circle', rx: 26, ry: 26, dx: 80, dy: -30, tilt: 0 },
  { key: 'genki', ja: '元気はつらつ', en: 'Perky', shape: 'ellipse', rx: 22, ry: 30, dx: 85, dy: -28, tilt: -20 },
  { key: 'kiri', ja: 'きりっと', en: 'Sharp', shape: 'ellipse', rx: 16, ry: 34, dx: 85, dy: -32, tilt: -30 },
  { key: 'sleepy', ja: 'ねむそう', en: 'Sleepy', shape: 'ellipse', rx: 24, ry: 12, dx: 85, dy: -26, tilt: 0 },
  { key: 'square', ja: 'しかく', en: 'Square', shape: 'rect', rx: 20, ry: 26, dx: 85, dy: -30, tilt: 0 },
];
export const MOUTHS = [
  { key: 'heart', ja: 'ハート', en: 'Heart', shape: 'heart', size: 20, dy: 45 },
  { key: 'smile', ja: 'にっこり', en: 'Smile', shape: 'smile', size: 70, dy: 40 },
  { key: 'o', ja: 'ちいさい', en: 'Small', shape: 'o', size: 8, dy: 46 },
  { key: 'line', ja: 'いっぽんせん', en: 'Line', shape: 'line', size: 40, dy: 46 },
];
export const GLASSES = [
  { key: 'none', ja: 'かけない', en: 'None' },
  { key: 'round', ja: 'まるメガネ', en: 'Round glasses' },
  { key: 'square', ja: 'しかくメガネ', en: 'Square glasses' },
];
export const SLEEPS = [
  { key: 'slant', ja: 'すやすや', en: 'Snoozing' },
  { key: 'line', ja: 'すっと', en: 'Straight' },
  { key: 'down', ja: 'ぐっすり', en: 'Sound asleep' },
  { key: 'up', ja: 'にこにこ', en: 'Smiling' },
];

// ぷちたち。ぷちまる・アン・まある・ピタは、きせかえの設定どおり。
// 澪は色(#00618B)だけ分かっていて、目・口・おやすみの形は仮(いつもの・ハート・すやすや)。
export const PRESETS = [
  { id: 'puchimaru', name: 'ぷちまる', color: '034f45', eye: 'now', mouth: 'heart', glasses: 'none', sleep: 'slant' },
  { id: 'mio', name: '澪', color: '00618b', eye: 'now', mouth: 'heart', glasses: 'none', sleep: 'slant', provisional: true },
  { id: 'an', name: 'アン', color: 'f7b977', eye: 'now', mouth: 'smile', glasses: 'none', sleep: 'down' },
  { id: 'maaru', name: 'まある', color: '00afcc', eye: 'round', mouth: 'o', glasses: 'round', sleep: 'slant' },
  { id: 'pita', name: 'ピタ', color: 'b9c42f', eye: 'round', mouth: 'smile', glasses: 'none', sleep: 'slant' },
];

const byKey = (list, key) => list.find((x) => x.key === key) ?? list[0];
const f = (n) => Math.round(n * 100) / 100;

function eyeSvg(e, side, c) {
  const x = 160 + side * e.dx, y = 120 + e.dy, tilt = side < 0 ? e.tilt : -e.tilt, h = e.ry * 2;
  if (e.shape === 'rect') return `<rect x="${f(x - e.rx)}" y="${f(y - h / 2)}" width="${e.rx * 2}" height="${h}" rx="${Math.min(8, h / 2)}" fill="${c}" transform="rotate(${tilt} ${x} ${y})"/>`;
  return `<ellipse cx="${x}" cy="${y}" rx="${e.rx}" ry="${h / 2}" fill="${c}" transform="rotate(${tilt} ${x} ${y})"/>`;
}
function sleepEyeSvg(e, side, style, c) {
  const x = 160 + side * e.dx, y = 120 + e.dy, w = Math.max(30, e.rx * 2);
  const s = `stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"`;
  if (style === 'line') return `<line x1="${f(x - w / 2)}" y1="${y}" x2="${f(x + w / 2)}" y2="${y}" ${s}/>`;
  if (style === 'slant') { const dy = w * 0.32; return `<line x1="${f(x - w / 2)}" y1="${f(y + (side < 0 ? dy : -dy))}" x2="${f(x + w / 2)}" y2="${f(y + (side < 0 ? -dy : dy))}" ${s}/>`; }
  if (style === 'down') return `<path d="M ${f(x - w / 2)} ${y - 4} Q ${x} ${f(y + w * 0.45)} ${f(x + w / 2)} ${y - 4}" ${s}/>`;
  return `<path d="M ${f(x - w / 2)} ${y + 6} Q ${x} ${f(y - w * 0.5)} ${f(x + w / 2)} ${y + 6}" ${s}/>`;
}
function mouthSvg(m, c) {
  const x = 160, y = 120 + m.dy;
  if (m.shape === 'heart') {
    return `<circle cx="${x - 18}" cy="${y}" r="${m.size}" fill="${c}"/><circle cx="${x + 18}" cy="${y}" r="${m.size}" fill="${c}"/>`
      + `<polygon points="${x - 30},${y + 10} ${x + 30},${y + 10} ${x},${y + 45}" fill="${c}"/>`;
  }
  if (m.shape === 'smile') {
    const w = m.size;
    return `<path d="M ${x - w / 2} ${y} Q ${x} ${f(y + w * 0.6)} ${x + w / 2} ${y}" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  }
  if (m.shape === 'o') return `<circle cx="${x}" cy="${y}" r="${m.size}" fill="${c}"/>`;
  return `<rect x="${x - m.size / 2}" y="${y - 4}" width="${m.size}" height="8" rx="4" fill="${c}"/>`;
}

// 顔の SVG(背景は白)。color は印刷では黒。sleep=true で おやすみの顔。
export function faceSvg({ eye = 'now', mouth = 'heart', glasses = 'none', sleep = false, sleepStyle = 'slant', color = '#000', bg = '#fff' } = {}) {
  const e = byKey(EYES, eye), m = byKey(MOUTHS, mouth), c = color;
  const parts = [`<rect x="0" y="0" width="320" height="240" fill="${bg}"/>`];
  parts.push(`<ellipse cx="160" cy="121" rx="14" ry="6" fill="${c}"/>`);   // 鼻
  if (sleep) parts.push(sleepEyeSvg(e, -1, sleepStyle, c), sleepEyeSvg(e, 1, sleepStyle, c));
  else parts.push(eyeSvg(e, -1, c), eyeSvg(e, 1, c));
  const y = 120 + e.dy;
  const gs = `fill="none" stroke="${c}" stroke-width="4" opacity=".85"`;
  if (glasses === 'round') {
    const r = e.rx + 11;
    parts.push(`<circle cx="${160 - e.dx}" cy="${y}" r="${r}" ${gs}/><circle cx="${160 + e.dx}" cy="${y}" r="${r}" ${gs}/>`
      + `<line x1="${160 - e.dx + r}" y1="${y}" x2="${160 + e.dx - r}" y2="${y}" ${gs}/>`);
  }
  if (glasses === 'square') {
    const w = Math.max(60, e.rx * 2 + 22), h = Math.max(30, Math.min(52, e.ry * 2 + 6));
    for (const side of [-1, 1]) { const x = 160 + side * e.dx; parts.push(`<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}" rx="6" ${gs}/>`); }
    parts.push(`<line x1="${160 - e.dx + w / 2}" y1="${y}" x2="${160 + e.dx - w / 2}" y2="${y}" ${gs}/>`);
  }
  parts.push(mouthSvg(m, c));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="640" height="480">${parts.join('')}</svg>`;
}

// SVG → 余白をけずった画像(HTMLImageElement)。ブラウザ用。
export async function faceImage(params) {
  const url = URL.createObjectURL(new Blob([faceSvg(params)], { type: 'image/svg+xml' }));
  const svgImg = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  URL.revokeObjectURL(url);
  const S = 2;
  const c = document.createElement('canvas'); c.width = 320 * S; c.height = 240 * S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(svgImg, 0, 0, c.width, c.height);
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4] < 160) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return svgImg;
  const m = 4 * S;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(width - 1, x1 + m); y1 = Math.min(height - 1, y1 + m);
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = out.toDataURL('image/png'); });
}
