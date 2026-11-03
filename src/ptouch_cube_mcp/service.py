"""MCP とコマンドラインから共通で使う処理。"""
from __future__ import annotations

import time
from pathlib import Path

from PIL import Image

from . import faces, protocol, render, transport

OUT_DIR = Path(__file__).resolve().parents[2] / "out"
MEDIA = {"laminated": protocol.MEDIA_LAMINATED, "non_laminated": protocol.MEDIA_NON_LAMINATED}


def _save_preview(label: Image.Image, stem: str) -> str:
    OUT_DIR.mkdir(exist_ok=True)
    p = OUT_DIR / f"{stem}-{int(time.time() * 1000)}.png"
    # 見やすいように、実際の印刷幅(長さ方向 = 横)のまま 3 倍にして保存
    label.resize((label.width * 3, label.height * 3), Image.NEAREST).save(p)
    return str(p)


def _finish(label: Image.Image, stem: str, *, copies: int, tape_mm: float, media: str, dry_run: bool, cut: bool) -> dict:
    protocol.printable_px(tape_mm)  # 幅のチェック(36mm などは ここで ValueError)
    if media not in MEDIA:
        raise ValueError(f"media は {list(MEDIA)} のどれか")
    if not 1 <= copies <= 20:
        raise ValueError("copies は 1〜20")
    preview = _save_preview(label, stem)
    length_mm = round(label.width / 7.09, 1)  # 180dpi
    info = {"preview_png": preview, "label_dots": [label.width, label.height], "length_mm": length_mm,
            "tape_mm": tape_mm}
    if tape_mm not in protocol.VERIFIED_TAPES_MM:
        info["warning"] = f"{tape_mm}mm の印刷範囲は PT-P300BT の実機で未確認です(12mm のみ確認済み)"
    if dry_run:
        info["printed"] = False
        return info
    job = protocol.build_job(label, tape_mm=tape_mm, media=MEDIA[media], cut=cut)
    info["printed"] = True
    info["status"] = transport.send_job(job, copies=copies)
    return info


def print_text(text: str, *, copies: int = 1, font_size: int | None = None, tape_mm: float = 12,
               media: str = "laminated", dry_run: bool = False, cut: bool = False,
               font_path: str | None = None, image_path: str | None = None,
               image_position: str = "left", icon_scale: float = 1.0,
               text_after: str | None = None, latin_font_path: str | None = None,
               segments: list[dict] | None = None) -> dict:
    if image_path:
        label = render.combo_label(text, image_path, image_position=image_position, font_size=font_size,
                                   font_path=font_path, icon_scale=icon_scale, tape_mm=tape_mm,
                                   text_after=text_after, latin_font_path=latin_font_path, segments=segments)
    elif segments:
        label = render.segments_label(segments, font_size=font_size, tape_mm=tape_mm)
    else:
        label = render.text_label(text, font_size=font_size, font_path=font_path, tape_mm=tape_mm,
                                  latin_font_path=latin_font_path)
    return _finish(label, "text", copies=copies, tape_mm=tape_mm, media=media, dry_run=dry_run, cut=cut)


def print_image(path: str, *, copies: int = 1, rotate: int = 0, dither: bool = True, invert: bool = False,
                tape_mm: float = 12, media: str = "laminated", dry_run: bool = False, cut: bool = False) -> dict:
    label = render.image_label(path, rotate=rotate, dither=dither, invert=invert, tape_mm=tape_mm)
    return _finish(label, "image", copies=copies, tape_mm=tape_mm, media=media, dry_run=dry_run, cut=cut)


def status() -> dict:
    return transport.read_status()


def print_face(face: str = "ぷちまる", *, text: str | None = None, text_position: str = "right",
               eye: str | None = None, mouth: str | None = None, glasses: str | None = None,
               sleep: bool = False, sleep_style: str | None = None, copies: int = 1, tape_mm: float = 12,
               media: str = "laminated", dry_run: bool = False, cut: bool = False,
               font_path: str | None = None, font_size: int | None = None, icon_scale: float = 1.0) -> dict:
    """ぷちの顔を印刷する。face は ぷちまる・澪・アン・まある・ピタ(または id)。eye / mouth / glasses で部品を上書きできる。

    text を渡すと、顔と文字を並べる(text_position: right=顔→文字 / left=文字→顔 / both=顔で文字を挟む)。
    """
    p = faces.find_preset(face) if face else faces.PRESETS[0]
    img = faces.face_image(eye or p["eye"], mouth or p["mouth"], glasses or p["glasses"], sleep,
                           sleep_style or p["sleep"])
    if text:
        pos = {"right": "left", "left": "right", "both": "both"}.get(text_position)
        if pos is None:
            raise ValueError("text_position は right / left / both")
        label = render.combo_label(text, img, image_position=pos, font_size=font_size, font_path=font_path,
                                   icon_scale=icon_scale, tape_mm=tape_mm, dither=False)
    else:
        label = render.image_label(img, tape_mm=tape_mm, dither=False, scale=icon_scale)
    info = _finish(label, "face", copies=copies, tape_mm=tape_mm, media=media, dry_run=dry_run, cut=cut)
    info["face"] = p["name"] + ("(目・口・おやすみは仮)" if p.get("provisional") and not (eye or mouth) else "")
    return info
