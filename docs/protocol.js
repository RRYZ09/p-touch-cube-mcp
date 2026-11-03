// PT-P300BT のラスター印刷プロトコル(src/ptouch_cube_mcp/protocol.py と同じ内容の JavaScript 版)。
// ブラウザと Node の両方で動く。Python 版とのバイト列の一致は web_tests/parity.mjs で確かめる。
export const HEAD_PX = 128;
export const HEAD_BYTES = 16;
export const UNPRINTABLE_PX = 30;
export const PRINTABLE_PX = HEAD_PX - 2 * UNPRINTABLE_PX; // 68
export const MEDIA = { laminated: 0x01, non_laminated: 0x03 };

export function packbits(data) {
  const out = [];
  let i = 0;
  const n = data.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && data[i + run] === data[i] && run < 128) run++;
    if (run >= 2) {
      out.push(257 - run, data[i]);
      i += run;
      continue;
    }
    const start = i;
    i++;
    while (i < n && (i + 1 >= n || data[i] !== data[i + 1]) && i - start < 128) i++;
    out.push(i - start - 1);
    for (let k = start; k < i; k++) out.push(data[k]);
  }
  return Uint8Array.from(out);
}

// bits: 長さ width*height の配列。1 = 黒。height は PRINTABLE_PX 以下(中央に置く)。
// ラスター 1 行 = ラベル画像の 1 列。128 ドットの j 番目 = 画像の (列, j-offset)。
export function bitmapToLines(bits, width, height) {
  if (height > PRINTABLE_PX) throw new Error(`高さは ${PRINTABLE_PX} ドット以下`);
  const offset = Math.floor((HEAD_PX - height) / 2);
  const lines = [];
  for (let x = 0; x < width; x++) {
    const line = new Uint8Array(HEAD_BYTES);
    for (let j = 0; j < HEAD_PX; j++) {
      const y = j - offset;
      if (y >= 0 && y < height && bits[y * width + x]) line[j >> 3] |= 0x80 >> (j & 7);
    }
    lines.push(line);
  }
  return lines;
}

export function buildJob(bits, width, height, { tapeMm = 12, media = MEDIA.laminated, marginDots = 28, cut = false } = {}) {
  const lines = bitmapToLines(bits, width, height);
  const n = lines.length;
  const parts = [];
  const push = (...b) => parts.push(Uint8Array.from(b));
  parts.push(new Uint8Array(64));
  push(0x1b, 0x40);
  push(0x1b, 0x69, 0x61, 0x01);
  push(0x1b, 0x69, 0x7a, 0xc4, media, tapeMm, 0x00, n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255, 0x00, 0x00);
  push(0x1b, 0x69, 0x4b, 0x08);
  push(0x1b, 0x69, 0x4d, cut ? 0x40 : 0x00);
  push(0x1b, 0x69, 0x64, marginDots & 255, (marginDots >> 8) & 255);
  push(0x4d, 0x02);
  for (const ln of lines) {
    const c = packbits(ln);
    push(0x47, c.length & 255, (c.length >> 8) & 255);
    parts.push(c);
  }
  push(0x1a);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

export const STATUS_REQUEST = Uint8Array.from([0x1b, 0x69, 0x53]);

export function parseStatus(d) {
  if (d.length < 32) return { ok: false, note: 'ステータスが短い' };
  const errors = d[8] | (d[9] << 8);
  return { ok: errors === 0, tapeMm: d[10], mediaType: d[11], errorBits: errors };
}
