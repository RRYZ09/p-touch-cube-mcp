"""MCP とコマンドラインから共通で使う処理。"""
from __future__ import annotations

import time
from pathlib import Path

from PIL import Image

from . import protocol, render, transport

OUT_DIR = Path(__file__).resolve().parents[2] / "out"
MEDIA = {"laminated": protocol.MEDIA_LAMINATED, "non_laminated": protocol.MEDIA_NON_LAMINATED}


def _save_preview(label: Image.Image, stem: str) -> str:
    OUT_DIR.mkdir(exist_ok=True)
    p = OUT_DIR / f"{stem}-{int(time.time() * 1000)}.png"
    # 見やすいように、実際の印刷幅(長さ方向 = 横)のまま 3 倍にして保存
    label.resize((label.width * 3, label.height * 3), Image.NEAREST).save(p)
    return str(p)


def _finish(label: Image.Image, stem: str, *, copies: int, tape_mm: int, media: str, dry_run: bool, cut: bool) -> dict:
    if media not in MEDIA:
        raise ValueError(f"media は {list(MEDIA)} のどれか")
    if not 1 <= copies <= 20:
        raise ValueError("copies は 1〜20")
    preview = _save_preview(label, stem)
    length_mm = round(label.width / 7.09, 1)  # 180dpi
    info = {"preview_png": preview, "label_dots": [label.width, label.height], "length_mm": length_mm}
    if dry_run:
        info["printed"] = False
        return info
    job = protocol.build_job(label, tape_mm=tape_mm, media=MEDIA[media], cut=cut)
    info["printed"] = True
    info["status"] = transport.send_job(job, copies=copies)
    return info


def print_text(text: str, *, copies: int = 1, font_size: int | None = None, tape_mm: int = 12,
               media: str = "laminated", dry_run: bool = False, cut: bool = False) -> dict:
    label = render.text_label(text, font_size=font_size)
    return _finish(label, "text", copies=copies, tape_mm=tape_mm, media=media, dry_run=dry_run, cut=cut)


def print_image(path: str, *, copies: int = 1, rotate: int = 0, dither: bool = True, invert: bool = False,
                tape_mm: int = 12, media: str = "laminated", dry_run: bool = False, cut: bool = False) -> dict:
    label = render.image_label(path, rotate=rotate, dither=dither, invert=invert)
    return _finish(label, "image", copies=copies, tape_mm=tape_mm, media=media, dry_run=dry_run, cut=cut)


def status() -> dict:
    return transport.read_status()
