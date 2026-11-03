"""ぷちの顔(ラベルに印刷する用)。docs/faces.js と同じ表・同じ描き方。

部品の寸法と描き方は「ぷちのきせかえ」(https://teampuchi.github.io/kisekae/、チームぷち)と同じで、
元は m5-petit-firmware の drawFace()。止まった顔を、黒で描く(白黒印刷で薄い色が消えないように)。
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

EYES = {
    "now": dict(shape="ellipse", rx=22, ry=32, dx=85, dy=-30, tilt=20),
    "round": dict(shape="circle", rx=26, ry=26, dx=80, dy=-30, tilt=0),
    "genki": dict(shape="ellipse", rx=22, ry=30, dx=85, dy=-28, tilt=-20),
    "kiri": dict(shape="ellipse", rx=16, ry=34, dx=85, dy=-32, tilt=-30),
    "sleepy": dict(shape="ellipse", rx=24, ry=12, dx=85, dy=-26, tilt=0),
    "square": dict(shape="rect", rx=20, ry=26, dx=85, dy=-30, tilt=0),
}
MOUTHS = {
    "heart": dict(shape="heart", size=20, dy=45),
    "smile": dict(shape="smile", size=70, dy=40),
    "o": dict(shape="o", size=8, dy=46),
    "line": dict(shape="line", size=40, dy=46),
}
GLASSES = ("none", "round", "square")
SLEEPS = ("slant", "line", "down", "up")

# ぷちまる・アン・まあるは、きせかえの設定どおり。澪は色だけ分かっていて、目・口・おやすみの形は仮。
PRESETS = [
    dict(id="puchimaru", name="ぷちまる", color="034f45", eye="now", mouth="heart", glasses="none", sleep="slant"),
    dict(id="mio", name="澪", color="00618b", eye="now", mouth="heart", glasses="none", sleep="slant", provisional=True),
    dict(id="an", name="アン", color="f7b977", eye="now", mouth="smile", glasses="none", sleep="down"),
    dict(id="maaru", name="まある", color="00afcc", eye="round", mouth="o", glasses="round", sleep="slant"),
    dict(id="pita", name="ピタ", color="b9c42f", eye="round", mouth="smile", glasses="none", sleep="slant"),
]
_S = 4  # 描くときの倍率(あとで縮める)


def find_preset(name: str) -> dict:
    """名前(ぷちまる・澪・アン・まある・ピタ)か id(puchimaru / mio / an / maaru / pita)で探す。"""
    for p in PRESETS:
        if name in (p["name"], p["id"]):
            return p
    raise ValueError(f"ぷちの名前は {[p['name'] for p in PRESETS]} のどれか(または、目・口を自分で指定)")


def _ellipse_pts(cx, cy, rx, ry, tilt_deg, n=72):
    t = math.radians(tilt_deg)
    ct, st = math.cos(t), math.sin(t)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        pts.append(((cx + x * ct - y * st) * _S, (cy + x * st + y * ct) * _S))
    return pts


def _quad(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (i / n for i in range(n + 1))]


def _stroke(d: ImageDraw.ImageDraw, pts, width):
    """太さのある線(両端と折れ目は丸く)。座標は 1 倍のもの。"""
    sp = [(x * _S, y * _S) for x, y in pts]
    w = width * _S
    d.line(sp, fill=0, width=int(w), joint="curve")
    for x, y in (sp[0], sp[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=0)


def _circle(d, cx, cy, r, fill=0, outline=None, width=0):
    d.ellipse([(cx - r) * _S, (cy - r) * _S, (cx + r) * _S, (cy + r) * _S], fill=fill if outline is None else None,
              outline=0 if outline else None, width=int(width * _S))


def face_image(eye: str = "now", mouth: str = "heart", glasses: str = "none", sleep: bool = False,
               sleep_style: str = "slant") -> Image.Image:
    """黒い顔(白地)を、余白をけずって返す。"""
    if eye not in EYES or mouth not in MOUTHS or glasses not in GLASSES or sleep_style not in SLEEPS:
        raise ValueError(f"eye は {list(EYES)}、mouth は {list(MOUTHS)}、glasses は {list(GLASSES)}、sleep_style は {list(SLEEPS)}")
    e, m = EYES[eye], MOUTHS[mouth]
    img = Image.new("L", (320 * _S, 240 * _S), 255)
    d = ImageDraw.Draw(img)
    d.ellipse([(160 - 14) * _S, (121 - 6) * _S, (160 + 14) * _S, (121 + 6) * _S], fill=0)   # 鼻
    y = 120 + e["dy"]
    for side in (-1, 1):
        x = 160 + side * e["dx"]
        if sleep:
            w = max(30, e["rx"] * 2)
            if sleep_style == "line":
                _stroke(d, [(x - w / 2, y), (x + w / 2, y)], 9)
            elif sleep_style == "slant":
                dy = w * 0.32
                _stroke(d, [(x - w / 2, y + (dy if side < 0 else -dy)), (x + w / 2, y + (-dy if side < 0 else dy))], 9)
            elif sleep_style == "down":
                _stroke(d, _quad((x - w / 2, y - 4), (x, y + w * 0.45), (x + w / 2, y - 4)), 9)
            else:
                _stroke(d, _quad((x - w / 2, y + 6), (x, y - w * 0.5), (x + w / 2, y + 6)), 9)
        else:
            tilt = e["tilt"] if side < 0 else -e["tilt"]
            if e["shape"] == "rect":
                d.rounded_rectangle([(x - e["rx"]) * _S, (y - e["ry"]) * _S, (x + e["rx"]) * _S, (y + e["ry"]) * _S],
                                    radius=min(8, e["ry"]) * _S, fill=0)
            else:
                d.polygon(_ellipse_pts(x, y, e["rx"], e["ry"], tilt), fill=0)
    if glasses == "round":
        r = e["rx"] + 11
        for side in (-1, 1):
            _circle(d, 160 + side * e["dx"], y, r, outline=True, width=4)
        _stroke(d, [(160 - e["dx"] + r, y), (160 + e["dx"] - r, y)], 4)
    if glasses == "square":
        w, h = max(60, e["rx"] * 2 + 22), max(30, min(52, e["ry"] * 2 + 6))
        for side in (-1, 1):
            x = 160 + side * e["dx"]
            d.rounded_rectangle([(x - w / 2) * _S, (y - h / 2) * _S, (x + w / 2) * _S, (y + h / 2) * _S],
                                radius=6 * _S, outline=0, width=4 * _S)
        _stroke(d, [(160 - e["dx"] + w / 2, y), (160 + e["dx"] - w / 2, y)], 4)
    my = 120 + m["dy"]
    if m["shape"] == "heart":
        _circle(d, 142, my, m["size"]); _circle(d, 178, my, m["size"])
        d.polygon([(130 * _S, (my + 10) * _S), (190 * _S, (my + 10) * _S), (160 * _S, (my + 45) * _S)], fill=0)
    elif m["shape"] == "smile":
        w = m["size"]
        _stroke(d, _quad((160 - w / 2, my), (160, my + w * 0.6), (160 + w / 2, my)), 10)
    elif m["shape"] == "o":
        _circle(d, 160, my, m["size"])
    else:
        w = m["size"]
        d.rounded_rectangle([(160 - w / 2) * _S, (my - 4) * _S, (160 + w / 2) * _S, (my + 4) * _S], radius=4 * _S, fill=0)
    box = img.point(lambda v: 255 if v < 160 else 0).getbbox()   # 黒い所の範囲
    pad = 4 * _S
    l, t, r, b = box
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))
