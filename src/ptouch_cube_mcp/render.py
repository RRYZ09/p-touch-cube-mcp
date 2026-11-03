"""文字や画像を、ラベル用の白黒画像にする。"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .protocol import printable_px

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


def text_label(text: str, *, font_size: int | None = None, font_path: str | None = None,
               tape_mm: float = 12) -> Image.Image:
    """テキスト(改行で複数行)を、テープ幅に収まる白黒ラベルにする。

    font_size を省略すると、行数に合わせて高さいっぱいに自動で決める。
    """
    limit = printable_px(tape_mm)
    lines = text.split("\n")
    n = len(lines)
    size = font_size or max(8, int(limit / n * 0.9))
    while True:
        font = find_font(font_path, size)
        asc, desc = font.getmetrics()
        line_h = asc + desc
        if font_size or line_h * n <= limit or size <= 8:
            break
        size -= 2
    widths = [font.getlength(l) for l in lines]
    w = int(max(widths)) + SIDE_PAD * 2
    h = min(limit, line_h * n)
    img = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((SIDE_PAD, i * line_h), l, font=font, fill=0)
    return img.point(lambda v: 0 if v < 140 else 255, mode="1").convert("L")


def image_label(path: str, *, rotate: int = 0, dither: bool = True, invert: bool = False,
                tape_mm: float = 12, scale: float = 1.0, pad: bool = True) -> Image.Image:
    """JPEG / PNG などを、テープ幅いっぱい(scale で小さくもできる)のラベルにする。

    縦長のときは rotate=90 で寝かせる。
    """
    limit = printable_px(tape_mm)
    height = max(1, round(limit * scale))
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if rotate:
        img = img.rotate(-rotate, expand=True, fillcolor="white")
    img = img.convert("L")
    if invert:
        img = ImageOps.invert(img)
    new_w = max(1, round(img.width * height / img.height))
    img = img.resize((new_w, height), Image.LANCZOS)
    img = ImageOps.autocontrast(img)
    mono = img.convert("1", dither=Image.FLOYDSTEINBERG if dither else Image.NONE).convert("L")
    side = SIDE_PAD if pad else 0
    out = Image.new("L", (mono.width + side * 2, limit), 255)
    out.paste(mono, (side, (limit - height) // 2))
    return out


COMBO_LAYOUTS = ("left", "right", "both", "between")


def combo_label(text: str, image_path: str, *, image_position: str = "left", gap: int = 10,
                font_size: int | None = None, font_path: str | None = None, rotate: int = 0,
                dither: bool = True, invert: bool = False, icon_scale: float = 1.0,
                tape_mm: float = 12, text_after: str | None = None) -> Image.Image:
    """画像と文字を横に並べたラベル。

    image_position:
      left    … 画像 → 文字
      right   … 文字 → 画像
      both    … 画像 → 文字 → 画像(画像で文字を挟む)
      between … 文字 → 画像 → 文字(文字で画像を挟む。後ろの文字は text_after)
    """
    if image_position not in COMBO_LAYOUTS:
        raise ValueError(f"image_position は {list(COMBO_LAYOUTS)} のどれか")
    limit = printable_px(tape_mm)
    t = text_label(text, font_size=font_size, font_path=font_path, tape_mm=tape_mm)
    im = image_label(image_path, rotate=rotate, dither=dither, invert=invert, tape_mm=tape_mm,
                     scale=icon_scale, pad=False)
    t2 = (text_label(text_after, font_size=font_size, font_path=font_path, tape_mm=tape_mm)
          if image_position == "between" and text_after and text_after.strip() else None)
    parts = {"left": [im, t], "right": [t, im], "both": [im, t, im],
             "between": [t, im] + ([t2] if t2 else [])}[image_position]
    out = Image.new("L", (sum(p.width for p in parts) + gap * (len(parts) - 1), limit), 255)
    x = 0
    for p in parts:
        out.paste(p, (x, (limit - p.height) // 2))
        x += p.width + gap
    return out
