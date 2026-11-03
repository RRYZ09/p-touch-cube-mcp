// ステータスの取り出しが、Python 版と同じかを確かめる。標準入力の 16 進文字列を読んで、JSON を出力する
import { extractFrames, parseStatus } from '../docs/protocol.js';
let hex = '';
for await (const c of process.stdin) hex += c;
const bytes = hex.trim().match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
const { frames, rest } = extractFrames(bytes);
console.log(JSON.stringify({ frames: frames.map((f) => { const s = parseStatus(f); return [s.type, s.errorBits, s.tapeMm, s.phase, s.notification]; }), rest: rest.length }));
