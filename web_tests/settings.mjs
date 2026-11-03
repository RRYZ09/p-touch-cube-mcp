// 設定の読み込みの検証を確かめる。失敗すると 0 以外で終わる。
import { parseSettings, serializeSettings } from '../docs/settings.js';
import assert from 'node:assert/strict';

const base = { model: 'PT-P300BT', tape: 12, mode: 'combo', text: 'ラベル', text2: 'あと', fontJa: 'Zen Maru Gothic', fontEn: 'same', bold: true,
  fsize: null, segMode: false, segments: [{ text: 'ラベル', font: 'Zen Maru Gothic' }], rotate: 0, dither: true, invert: false, thresh: 140,
  layout: 'both', iconscale: 80, gap: 12, zoom: 2, copies: 3, media: 'laminated', image: null };

// 書き出して読み込むと、同じになる
let r = parseSettings(serializeSettings(base));
assert.equal(r.ok, true);
assert.deepEqual(r.settings, base);

// 壊れたもの・別のアプリのもの・新しすぎる版は、はねる
assert.equal(parseSettings('これは JSON ではない').ok, false);
assert.equal(parseSettings('{"app":"other","version":1,"settings":{}}').ok, false);
assert.equal(parseSettings(JSON.stringify({ app: 'p-touch-label-maker', version: 99, settings: {} })).errors[0], 'newer-version');

// 範囲外・不正な値は、安全な値にする
r = parseSettings(serializeSettings({ ...base, model: 'PT-XXXX', tape: 99, mode: 'evil', copies: 9999, thresh: -5, layout: 'x', zoom: 7, fsize: 5000, media: 'x', rotate: 45 }));
assert.equal(r.ok, true);
assert.equal(r.settings.model, 'PT-P300BT');
assert.equal(r.settings.tape, 12);
assert.equal(r.settings.mode, 'text');
assert.equal(r.settings.copies, 20);
assert.equal(r.settings.thresh, 40);
assert.equal(r.settings.layout, 'left');
assert.equal(r.settings.zoom, 1);
assert.equal(r.settings.fsize, 200);
assert.equal(r.settings.media, 'laminated');
assert.equal(r.settings.rotate, 0);

// 機種に合わないテープ幅は、12mm に戻す(PT-P300BT に 24mm は無い)
assert.equal(parseSettings(serializeSettings({ ...base, tape: 24 })).settings.tape, 12);
assert.equal(parseSettings(serializeSettings({ ...base, model: 'PT-P710BT', tape: 24 })).settings.tape, 24);

// 画像は、data:image/ だけ。ほかは捨てる
assert.equal(parseSettings(serializeSettings({ ...base, image: 'http://evil.example/x.png' })).settings.image, null);
assert.equal(parseSettings(serializeSettings({ ...base, image: 'data:image/png;base64,AAAA' })).settings.image, 'data:image/png;base64,AAAA');

// 知らない項目は無視、足りない項目は既定
r = parseSettings(JSON.stringify({ app: 'p-touch-label-maker', version: 1, settings: { text: 'x', unknown: 1 } }));
assert.equal(r.settings.text, 'x');
assert.equal(r.settings.layout, 'left');
assert.equal('unknown' in r.settings, false);
console.log('settings ok');
