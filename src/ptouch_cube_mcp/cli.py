"""コマンドラインから試す: p-touch-cube text 'まある' --dry-run"""
from __future__ import annotations

import argparse
import json

from . import service


def main() -> None:
    ap = argparse.ArgumentParser(prog="p-touch-cube")
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("text")
    t.add_argument("text")
    i = sub.add_parser("image")
    i.add_argument("path")
    i.add_argument("--rotate", type=int, default=0)
    i.add_argument("--no-dither", action="store_true")
    i.add_argument("--invert", action="store_true")
    for p in (t, i):
        p.add_argument("--copies", type=int, default=1)
        p.add_argument("--media", default="laminated", choices=list(service.MEDIA))
        p.add_argument("--dry-run", action="store_true")
        p.add_argument("--tape-mm", type=float, default=12, help="3.5 / 6 / 9 / 12 / 18 / 24")
    t.add_argument("--font-size", type=int)
    t.add_argument("--font", help="フォントファイルのパス(かわいいフォントなど)")
    t.add_argument("--latin-font", help="半角の英数字・記号だけのフォント(日本語と英語を混ぜるとき)")
    t.add_argument("--segment", action="append", metavar="TEXT=FONT", help="文字ごとのフォント(くり返せる)。例: --segment まある=a.ttf --segment Maru=b.ttf")
    t.add_argument("--image", help="文字と一緒に印刷する画像(JPEG・PNG)")
    t.add_argument("--image-position", choices=["left", "right", "both", "between"], default="left",
                   help="left=画像→文字 / right=文字→画像 / both=画像で文字を挟む / between=文字で画像を挟む")
    t.add_argument("--text-after", help="between のとき、画像のあとの文字")
    t.add_argument("--icon-scale", type=float, default=1.0)
    f = sub.add_parser("face", help="ぷちの顔を印刷(ぷちまる・澪・アン・まある・ピタ)")
    f.add_argument("name", nargs="?", default="ぷちまる")
    f.add_argument("--text", help="顔と並べる文字")
    f.add_argument("--text-position", choices=["right", "left", "both"], default="right")
    f.add_argument("--eye"); f.add_argument("--mouth"); f.add_argument("--glasses")
    f.add_argument("--sleep", action="store_true", help="おやすみの顔")
    f.add_argument("--copies", type=int, default=1)
    f.add_argument("--tape-mm", type=float, default=12)
    f.add_argument("--dry-run", action="store_true")
    sub.add_parser("status")
    a = ap.parse_args()
    if a.cmd == "text":
        segs = None
        if a.segment:
            segs = [dict(zip(("text", "font_path"), x.rsplit("=", 1))) for x in a.segment]
        r = service.print_text(a.text, copies=a.copies, font_size=a.font_size, media=a.media, dry_run=a.dry_run,
                               tape_mm=a.tape_mm, font_path=a.font, image_path=a.image,
                               image_position=a.image_position, icon_scale=a.icon_scale, text_after=a.text_after,
                               latin_font_path=a.latin_font, segments=segs)
    elif a.cmd == "image":
        r = service.print_image(a.path, copies=a.copies, rotate=a.rotate, dither=not a.no_dither,
                                invert=a.invert, media=a.media, dry_run=a.dry_run, tape_mm=a.tape_mm)
    elif a.cmd == "face":
        r = service.print_face(a.name, text=a.text, text_position=a.text_position, eye=a.eye, mouth=a.mouth,
                               glasses=a.glasses, sleep=a.sleep, copies=a.copies, tape_mm=a.tape_mm, dry_run=a.dry_run)
    else:
        r = service.status()
    print(json.dumps(r, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
