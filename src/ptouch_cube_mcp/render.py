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


def _is_latin(ch: str) -> bool:
    return " " <= ch <= "~"


def split_runs(line: str, font_path: str | None, latin_font_path: str | None) -> list[tuple[str, str | None]]:
    """1 行を、(文字, フォントのパス)の断片に分ける。半角の英数字・記号は latin_font_path、ほかは font_path。"""
    if not latin_font_path or latin_font_path == font_path:
        return [(line, font_path)]
    runs: list[tuple[str, str | None]] = []
    for ch in line:
        fp = latin_font_path if _is_latin(ch) else font_path
        if runs and runs[-1][1] == fp:
            runs[-1] = (runs[-1][0] + ch, fp)
        else:
            runs.append((ch, fp))
    return runs


def runs_label(lines: list[list[tuple[str, str | None]]], *, font_size: int | None = None,
               tape_mm: float = 12) -> Image.Image:
    """断片(文字, フォント)の行のリストを、テープ幅に収まる白黒ラベルにする。

    断片ごとにフォントを変えられる。行ごとに、一番大きいフォントの上端にベースラインをそろえる。
    font_size を省略すると、行数に合わせて高さいっぱいに自動で決める。
    """
    limit = printable_px(tape_mm)
    n = len(lines)
    cache: dict[tuple[str | None, int], ImageFont.FreeTypeFont] = {}

    def font(path: str | None, size: int) -> ImageFont.FreeTypeFont:
        if (path, size) not in cache:
            cache[(path, size)] = find_font(path, size)
        return cache[(path, size)]

    def metrics(size: int) -> list[tuple[int, int]]:
        out = []
        for line in lines:
            runs = line or [("", None)]
            asc = max(font(fp, size).getmetrics()[0] for _, fp in runs)
            desc = max(font(fp, size).getmetrics()[1] for _, fp in runs)
            out.append((asc, asc + desc))
        return out

    size = font_size or max(8, int(limit / n * 0.9))
    ms = metrics(size)
    while not font_size and sum(m[1] for m in ms) > limit and size > 8:
        size -= 2
        ms = metrics(size)
    widths = [sum(font(fp, size).getlength(t) for t, fp in (line or [("", None)])) for line in lines]
    w = int(max(widths)) + SIDE_PAD * 2
    h = min(limit, sum(m[1] for m in ms))
    img = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(img)
    y = 0
    for (asc, line_h), line in zip(ms, lines):
        x = float(SIDE_PAD)
        for t, fp in line:
            d.text((x, y + asc), t, font=font(fp, size), fill=0, anchor="ls")
            x += font(fp, size).getlength(t)
        y += line_h
    return img.point(lambda v: 0 if v < 140 else 255, mode="1").convert("L")


def text_label(text: str, *, font_size: int | None = None, font_path: str | None = None,
               tape_mm: float = 12, latin_font_path: str | None = None) -> Image.Image:
    """テキスト(改行で複数行)を、テープ幅に収まる白黒ラベルにする。

    latin_font_path を渡すと、半角の英数字・記号だけ別のフォントにする(日本語と英語を混ぜるとき)。
    """
    lines = [split_runs(l, font_path, latin_font_path) for l in text.split("\n")]
    return runs_label(lines, font_size=font_size, tape_mm=tape_mm)


def segments_label(segments: list[dict], *, font_size: int | None = None, tape_mm: float = 12) -> Image.Image:
    """文字ごとにフォントを選んで、左から順につなぐ(1 行)。segments は [{"text": "...", "font_path": "..."}]。"""
    runs = [(sg["text"], sg.get("font_path")) for sg in segments if sg.get("text")]
    if not runs:
        raise ValueError("segments に文字がありません")
    return runs_label([runs], font_size=font_size, tape_mm=tape_mm)


def image_label(path: "str | Image.Image", *, rotate: int = 0, dither: bool = True, invert: bool = False,
                tape_mm: float = 12, scale: float = 1.0, pad: bool = True) -> Image.Image:
    """JPEG / PNG などを、テープ幅いっぱい(scale で小さくもできる)のラベルにする。

    縦長のときは rotate=90 で寝かせる。
    """
    limit = printable_px(tape_mm)
    height = max(1, round(limit * scale))
    img = Image.open(path) if isinstance(path, str) else path.copy()
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


def combo_label(text: str, image_path: "str | Image.Image", *, image_position: str = "left", gap: int = 10,
                font_size: int | None = None, font_path: str | None = None, rotate: int = 0,
                dither: bool = True, invert: bool = False, icon_scale: float = 1.0,
                tape_mm: float = 12, text_after: str | None = None,
                latin_font_path: str | None = None, segments: list[dict] | None = None) -> Image.Image:
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
    t = (segments_label(segments, font_size=font_size, tape_mm=tape_mm) if segments else
         text_label(text, font_size=font_size, font_path=font_path, tape_mm=tape_mm,
                    latin_font_path=latin_font_path))
    im = image_label(image_path, rotate=rotate, dither=dither, invert=invert, tape_mm=tape_mm,
                     scale=icon_scale, pad=False)
    t2 = (text_label(text_after, font_size=font_size, font_path=font_path, tape_mm=tape_mm,
                     latin_font_path=latin_font_path)
          if image_position == "between" and text_after and text_after.strip() else None)
    parts = {"left": [im, t], "right": [t, im], "both": [im, t, im],
             "between": [t, im] + ([t2] if t2 else [])}[image_position]
    out = Image.new("L", (sum(p.width for p in parts) + gap * (len(parts) - 1), limit), 255)
    x = 0
    for p in parts:
        out.paste(p, (x, (limit - p.height) // 2))
        x += p.width + gap
    return out
