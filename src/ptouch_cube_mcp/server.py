"""P-touch CUBE (PT-P300BT) の MCP サーバー(stdio)。"""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from . import service

mcp = FastMCP("p-touch-cube")


@mcp.tool()
def print_label_text(text: str, copies: int = 1, font_size: int | None = None, tape_mm: int = 12,
                     media: str = "laminated", dry_run: bool = False) -> dict:
    """文字をラベルにして印刷する(PT-P300BT)。改行で複数行(12mm テープは 1 行がおすすめ)。

    dry_run=true なら印刷せず、仕上がりの PNG だけ作る(最初は必ずこれで見る)。
    media: laminated(ラミネート)/ non_laminated(布・リボンなど)。font_size 省略で高さに自動で合わせる。
    """
    return service.print_text(text, copies=copies, font_size=font_size, tape_mm=tape_mm, media=media, dry_run=dry_run)


@mcp.tool()
def print_label_image(path: str, copies: int = 1, rotate: int = 0, dither: bool = True, invert: bool = False,
                      tape_mm: int = 12, media: str = "laminated", dry_run: bool = False) -> dict:
    """JPEG / PNG の画像ファイルをラベルにして印刷する。白黒に変換され、テープの幅に合わせて縮む。

    rotate: 90 / 180 / 270 で回す(縦長の画像を寝かせるとき)。dither=false で写真でなくロゴ向けの二値化。
    dry_run=true なら印刷せず仕上がりの PNG だけ作る。
    """
    return service.print_image(path, copies=copies, rotate=rotate, dither=dither, invert=invert,
                               tape_mm=tape_mm, media=media, dry_run=dry_run)


@mcp.tool()
def printer_status() -> dict:
    """プリンタにつないで、テープの幅・種類・エラーの有無を読む(つながるかの確認にも)。"""
    return service.status()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
