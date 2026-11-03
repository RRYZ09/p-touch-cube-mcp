// 設定の書き出し(JSON)と読み込みの、検証と整え。画面には触らない(tests/test_protocol.py が Node で確かめる)。
import { MODELS } from './models.js?v=0.3.4';

export const SETTINGS_APP = 'p-touch-label-maker';
export const SETTINGS_VERSION = 1;
const MODES = ['text', 'image', 'combo'];
const LAYOUTS = ['left', 'right', 'both', 'between'];
const MEDIAS = ['laminated', 'non_laminated'];
const MAX_IMAGE = 6 * 1024 * 1024;

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);

// 画面の設定(オブジェクト)を、書き出す形にする
export function serializeSettings(s) {
  return JSON.stringify({ app: SETTINGS_APP, version: SETTINGS_VERSION, settings: s }, null, 2);
}

// 文字列を読んで、整えた設定を返す。{ ok, settings, errors }。足りない項目は、既定の値にする。
export function parseSettings(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ['json'] }; }
  if (!raw || raw.app !== SETTINGS_APP || typeof raw.settings !== 'object' || raw.settings === null) return { ok: false, errors: ['not-ours'] };
  if (!Number.isFinite(raw.version) || raw.version > SETTINGS_VERSION) return { ok: false, errors: ['newer-version'] };
  const s = raw.settings;
  const model = pick(s.model, Object.keys(MODELS), 'PT-P300BT');
  const tape = MODELS[model].tapes.includes(s.tape) ? s.tape : 12;
  const segs = Array.isArray(s.segments)
    ? s.segments.slice(0, 20).map((g) => ({ text: str(g?.text, 200), font: str(g?.font, 60) }))
    : [];
  const out = {
    model, tape,
    mode: pick(s.mode, MODES, 'text'),
    text: str(s.text, 500, ''),
    text2: str(s.text2, 500, ''),
    fontJa: str(s.fontJa, 60),
    fontEn: str(s.fontEn, 60, 'same'),
    bold: bool(s.bold, true),
    fsize: s.fsize == null ? null : num(s.fsize, 6, 200, null),
    segMode: bool(s.segMode, false),
    segments: segs,
    rotate: pick(s.rotate, [0, 90, 180, 270], 0),
    dither: bool(s.dither, true),
    invert: bool(s.invert, false),
    thresh: num(s.thresh, 40, 220, 140),
    layout: pick(s.layout, LAYOUTS, 'left'),
    iconscale: num(s.iconscale, 20, 100, 100),
    gap: num(s.gap, 0, 60, 10),
    zoom: pick(s.zoom, [1, 2, 3], 1),
    copies: num(s.copies, 1, 20, 1),
    media: pick(s.media, MEDIAS, 'laminated'),
    image: typeof s.image === 'string' && s.image.startsWith('data:image/') && s.image.length <= MAX_IMAGE ? s.image : null,
  };
  return { ok: true, settings: out, errors: [] };
}
