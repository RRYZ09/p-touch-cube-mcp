// Python 版と同じ印刷データになるかを確かめる。使い方: node parity.mjs <テープ幅mm>  → 16 進文字列を出力
import { buildJob, printablePx } from '../docs/protocol.js';

const tapeMm = parseFloat(process.argv[2] ?? '12');
const W = 40, H = printablePx(tapeMm);
const bits = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bits[y * W + x] = (x * 3 + y * 5) % 7 < 3 ? 1 : 0;
const job = buildJob(bits, W, H, { tapeMm });
process.stdout.write(Array.from(job, (b) => b.toString(16).padStart(2, '0')).join(''));
