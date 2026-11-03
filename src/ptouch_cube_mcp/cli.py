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
    t.add_argument("--font-size", type=int)
    sub.add_parser("status")
    a = ap.parse_args()
    if a.cmd == "text":
        r = service.print_text(a.text, copies=a.copies, font_size=a.font_size, media=a.media, dry_run=a.dry_run)
    elif a.cmd == "image":
        r = service.print_image(a.path, copies=a.copies, rotate=a.rotate, dither=not a.no_dither,
                                invert=a.invert, media=a.media, dry_run=a.dry_run)
    else:
        r = service.status()
    print(json.dumps(r, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
