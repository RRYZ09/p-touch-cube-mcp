"""文字や画像を、ラベル用の白黒画像にする。"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .protocol import PRINTABLE_PX

_FONT_CANDIDATES = [
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 0),   # Noto Sans CJK JP
    ("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf", 0),
]
SIDE_PAD = 12  # ラベルの左右の余白(ドット)


def find_font(path: str | None = None, size: int = 56) -> ImageFont.FreeTypeFont:
    path = path or os.environ.get("PTOUCH_FONT")
    if path:
        return ImageFont.truetype(path, size)
    for p, idx in _FONT_CANDIDATES:
        if Path(p).exists():
            return ImageFont.truetype(p, size, index=idx)
    raise RuntimeError("日本語フォントが見つかりません。PTOUCH_FONT にフォントのパスを指定してください")


def text_label(text: str, *, font_size: int | None = None, font_path: str | None = None) -> Image.Image:
    """テキスト(改行で複数行)を、高さ PRINTABLE_PX 以下の白黒ラベルにする。

    font_size を省略すると、行数に合わせて高さいっぱいに自動で決める。
    """
    lines = text.split("\n")
    n = len(lines)
    size = font_size or max(8, int(PRINTABLE_PX / n * 0.9))
    while True:
        font = find_font(font_path, size)
        asc, desc = font.getmetrics()
        line_h = asc + desc
        if font_size or line_h * n <= PRINTABLE_PX or size <= 8:
            break
        size -= 2
    widths = [font.getlength(l) for l in lines]
    w = int(max(widths)) + SIDE_PAD * 2
    h = min(PRINTABLE_PX, line_h * n)
    img = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((SIDE_PAD, i * line_h), l, font=font, fill=0)
    return img.point(lambda v: 0 if v < 140 else 255, mode="1").convert("L")


def image_label(path: str, *, rotate: int = 0, dither: bool = True, invert: bool = False) -> Image.Image:
    """JPEG / PNG などを、高さ PRINTABLE_PX のラベルにする。縦長のときは rotate=90 で寝かせる。"""
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if rotate:
        img = img.rotate(-rotate, expand=True, fillcolor="white")
    img = img.convert("L")
    if invert:
        img = ImageOps.invert(img)
    new_w = max(1, round(img.width * PRINTABLE_PX / img.height))
    img = img.resize((new_w, PRINTABLE_PX), Image.LANCZOS)
    img = ImageOps.autocontrast(img)
    mono = img.convert("1", dither=Image.FLOYDSTEINBERG if dither else Image.NONE)
    out = Image.new("L", (mono.width + SIDE_PAD * 2, PRINTABLE_PX), 255)
    out.paste(mono.convert("L"), (SIDE_PAD, 0))
    return out
