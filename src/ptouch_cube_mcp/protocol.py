"""PT-P300BT のラスター印刷プロトコル(PTCBP モード)。

出典: 有志の解析 https://gist.github.com/stecman/ee1fd9a8b1b6f0fdd170ee87ba2ddafd
と Brother PT-9500PC の CBP-RASTER コマンドリファレンス。公式の PT-P300BT 仕様書は無いので、
実機で確かめた範囲だけを「確認済み」とする(README の「確認状況」)。

画像の約束:
  - ヘッドは 128 ドット(16 バイト)。12mm テープで実際に印刷できるのは中央の約 68 ドット
    (上下 30 ドットずつは印刷されない)。
  - ラベルは「テープの長さ方向」に進む。ラスターの 1 行 = ラベル画像の 1 列(高さ 128 ドット)。
"""
from __future__ import annotations

import math

from PIL import Image, ImageOps

HEAD_PX = 128          # ヘッドのドット数
HEAD_BYTES = HEAD_PX // 16 * 2  # 16

# テープ幅(mm)ごとの、印刷できるドット数(180dpi)。
#   12mm は PT-P300BT の実機で確認した値(両端 30 ドットずつは印刷されない = 68)。
#   それ以外は、同じ 128 ドットのヘッドをもつ Brother の PT-P700 系のラスター命令リファレンスの値で、
#   PT-P300BT での確認はしていない。PT-P300BT が使えるテープは 3.5〜12mm。
#   18・24mm は PT-P710BT などの別機種向け。36mm は 128 ドットのヘッドでは印刷できない。
TAPE_PRINTABLE_PX = {3.5: 24, 6: 32, 9: 50, 12: 68, 18: 112, 24: 128}
TAPE_WIDTHS_MM = (3.5, 6, 9, 12, 18, 24, 36)
VERIFIED_TAPES_MM = (12,)

UNPRINTABLE_PX = 30    # 12mm テープで両端に印刷されないドット数(互換のため残す)
PRINTABLE_PX = TAPE_PRINTABLE_PX[12]  # 68(互換のため残す)

# テープ種別(ラミネート/布/リボン…)ごとの media type は、ラミネートの 0x01 を既定にする
MEDIA_LAMINATED = 0x01
MEDIA_NON_LAMINATED = 0x03


def packbits(data: bytes) -> bytes:
    """TIFF(PackBits)圧縮。1 行 16 バイトなので素朴な実装で足りる。"""
    out = bytearray()
    i, n = 0, len(data)
    while i < n:
        # 同じ値の連続
        run = 1
        while i + run < n and data[i + run] == data[i] and run < 128:
            run += 1
        if run >= 2:
            out.append(257 - run)  # -(run-1) を 1 バイトで
            out.append(data[i])
            i += run
            continue
        # 違う値の並び
        start = i
        i += 1
        while i < n and (i + 1 >= n or data[i] != data[i + 1]) and i - start < 128:
            i += 1
        lit = data[start:i]
        out.append(len(lit) - 1)
        out.extend(lit)
    return bytes(out)


def unpackbits(data: bytes) -> bytes:
    out = bytearray()
    i = 0
    while i < len(data):
        c = data[i]
        i += 1
        if c < 128:
            out.extend(data[i:i + c + 1])
            i += c + 1
        elif c > 128:
            out.extend(bytes([data[i]]) * (257 - c))
            i += 1
    return bytes(out)


def printable_px(tape_mm: float = 12) -> int:
    """テープ幅(mm)で印刷できるドット数。36mm など、このヘッドで印刷できない幅は ValueError。"""
    if tape_mm not in TAPE_PRINTABLE_PX:
        if tape_mm in TAPE_WIDTHS_MM:
            raise ValueError(f"{tape_mm}mm は 128 ドットのヘッドでは印刷できません(下見のみ)")
        raise ValueError(f"tape_mm は {list(TAPE_WIDTHS_MM)} のどれか")
    return TAPE_PRINTABLE_PX[tape_mm]


def label_to_columns(label: Image.Image, tape_mm: float = 12) -> list[bytes]:
    """ラベル画像(白地に黒、横長)を、ヘッドに送る 16 バイトの行のリストにする。

    label の高さは PRINTABLE_PX 以下、幅はテープの長さ方向のドット数。
    中央に置いて 128 ドットに伸ばし、90 度回して、左右を反転する(解析記録の
    `-rotate 90 -flop` と同じ)。
    """
    limit = printable_px(tape_mm)
    img = label.convert("L")
    if img.height > limit:
        img = img.resize((max(1, round(img.width * limit / img.height)), limit), Image.LANCZOS)
    canvas = Image.new("L", (img.width, HEAD_PX), 255)
    canvas.paste(img, (0, (HEAD_PX - img.height) // 2))
    mono = canvas.point(lambda v: 0 if v < 128 else 255, mode="1")
    rotated = mono.rotate(-90, expand=True)           # 時計回りに 90 度
    mirrored = ImageOps.mirror(rotated)                # -flop
    assert mirrored.width == HEAD_PX
    lines = []
    for y in range(mirrored.height):
        row = mirrored.crop((0, y, HEAD_PX, y + 1))
        # PIL の mode "1" は tobytes で 1=白。印刷は 1=黒 なので反転する
        packed = bytes(b ^ 0xFF for b in row.tobytes())
        lines.append(packed)
    return lines


def build_job(label: Image.Image, *, tape_mm: float = 12, media: int = MEDIA_LAMINATED,
              margin_dots: int = 28, cut: bool = False) -> bytes:
    """印刷ジョブ全体のバイト列を作る。"""
    lines = label_to_columns(label, tape_mm)
    width_byte = math.ceil(tape_mm)  # 3.5mm は 4 と送る
    n = len(lines)
    job = bytearray()
    job += b"\x00" * 64                                   # バッファのクリア
    job += b"\x1b\x40"                                     # 初期化
    job += b"\x1b\x69\x61\x01"                             # ラスターモード(PTCBP)
    # 印刷情報: 有効フラグ 0xC4、媒体、幅(mm)、長さ 0、ライン数(4 バイト LE)、1 ページ目、0
    job += bytes([0x1B, 0x69, 0x7A, 0xC4, media, width_byte, 0x00]) + n.to_bytes(4, "little") + b"\x00\x00"
    job += b"\x1b\x69\x4b\x08"                             # 拡張モード(チェーン印刷なし)
    job += b"\x1b\x69\x4d" + (b"\x40" if cut else b"\x00")  # モード(オートカット)
    job += b"\x1b\x69\x64" + margin_dots.to_bytes(2, "little")  # 余白(フィード)
    job += b"\x4d\x02"                                     # 圧縮: TIFF(PackBits)
    for ln in lines:
        c = packbits(ln)
        job += b"\x47" + len(c).to_bytes(2, "little") + c
    job += b"\x1a"                                         # 印刷してフィード
    return bytes(job)


STATUS_REQUEST = b"\x1b\x69\x53"
STATUS_LEN = 32
# ステータスの種類(32 バイトのうち 18 バイト目)
STATUS_REPLY, STATUS_COMPLETED, STATUS_ERROR, STATUS_NOTIFICATION, STATUS_PHASE = 0, 1, 2, 5, 6
_STATUS_HEAD = b"\x80\x20"   # ステータスは 0x80 0x20 で始まる


def extract_frames(buf: bytes) -> tuple[list[bytes], bytes]:
    """受け取ったバイト列から、32 バイトのステータスを取り出す。前の余計なバイトは捨て、足りない分は rest に返す。"""
    frames: list[bytes] = []
    i = 0
    while True:
        j = buf.find(_STATUS_HEAD, i)
        if j < 0:
            return frames, (buf[-1:] if buf.endswith(b"\x80") else b"")
        if len(buf) - j < STATUS_LEN:
            return frames, buf[j:]
        frames.append(buf[j:j + STATUS_LEN])
        i = j + STATUS_LEN


def parse_status(data: bytes) -> dict:
    """32 バイトのステータスを読みやすくする(分かる範囲だけ)。"""
    if len(data) < STATUS_LEN:
        return {"ok": False, "raw": data.hex(), "note": "ステータスが短い"}
    errors = data[8] | (data[9] << 8)
    return {
        "ok": errors == 0,
        "tape_mm": data[10],
        "media_type": data[11],
        "error_bits": errors,
        "status_type": data[18],
        "phase": data[19],
        "notification": data[22],
        "raw": data.hex(),
    }
