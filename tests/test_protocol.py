import os

from PIL import Image

from ptouch_cube_mcp import protocol, render


def test_packbits_roundtrip():
    for data in [b"\x00" * 16, bytes(range(16)), b"\xff\x00\xff\x00" * 4, b"\x00" * 7 + b"\x01" * 9, b"a"]:
        assert protocol.unpackbits(protocol.packbits(data)) == data


def test_label_columns_are_16_bytes_and_count_equals_width():
    img = Image.new("L", (50, 40), 255)
    lines = protocol.label_to_columns(img)
    assert len(lines) == 50 and all(len(l) == 16 for l in lines)


def test_unprintable_edges_stay_white():
    # 全面を黒にしても、上下 30 ドット(= 端の 30 ビット)は印刷されない = 0 のまま
    img = Image.new("L", (10, protocol.PRINTABLE_PX), 0)
    line = protocol.label_to_columns(img)[0]
    bits = "".join(f"{b:08b}" for b in line)
    assert bits[:protocol.UNPRINTABLE_PX] == "0" * protocol.UNPRINTABLE_PX
    assert bits[-protocol.UNPRINTABLE_PX:] == "0" * protocol.UNPRINTABLE_PX
    assert set(bits[protocol.UNPRINTABLE_PX:-protocol.UNPRINTABLE_PX]) == {"1"}


def test_job_structure():
    img = Image.new("L", (20, 30), 0)
    job = protocol.build_job(img)
    assert job.startswith(b"\x00" * 64 + b"\x1b\x40\x1b\x69\x61\x01")
    assert b"\x1b\x69\x7a\xc4\x01\x0c\x00" + (20).to_bytes(4, "little") in job
    assert job.endswith(b"\x1a")


def test_text_label_fits_head():
    img = render.text_label("まある")
    assert img.height <= protocol.PRINTABLE_PX and img.width > 20


def test_web_version_builds_identical_job():
    """docs/protocol.js(GitHub Pages の印刷ページ)が、どのテープ幅でも Python 版と同じバイト列を作る。"""
    import shutil
    import subprocess
    from pathlib import Path

    import pytest

    node = shutil.which("node")
    if not node:
        pytest.skip("node が無い")
    script = Path(__file__).resolve().parents[1] / "web_tests" / "parity.mjs"
    for mm, H in protocol.TAPE_PRINTABLE_PX.items():
        W = 40
        img = Image.new("L", (W, H), 255)
        for y in range(H):
            for x in range(W):
                if (x * 3 + y * 5) % 7 < 3:
                    img.putpixel((x, y), 0)
        expected = protocol.build_job(img, tape_mm=mm).hex()
        got = subprocess.run([node, str(script), str(mm)], capture_output=True, text=True, check=True).stdout.strip()
        assert got == expected, f"{mm}mm で Python 版と JS 版のバイト列が違う"


def test_every_tape_width_fits_the_head():
    for mm, px in protocol.TAPE_PRINTABLE_PX.items():
        assert px <= protocol.HEAD_PX
        line = protocol.label_to_columns(Image.new("L", (5, px), 0), mm)[0]
        assert sum(bin(b).count("1") for b in line) == px   # 中央の px ドットだけ黒
    assert protocol.printable_px(12) == 68


def test_36mm_is_not_printable_and_unknown_width_rejected():
    import pytest
    with pytest.raises(ValueError):
        protocol.printable_px(36)
    with pytest.raises(ValueError):
        protocol.printable_px(7)


def test_3_5mm_is_sent_as_4():
    job = protocol.build_job(Image.new("L", (5, 24), 0), tape_mm=3.5)
    assert b"\x1b\x69\x7a\xc4\x01\x04\x00" in job


def test_combo_label_places_icon_and_text_side_by_side(tmp_path):
    icon = tmp_path / "i.png"
    Image.new("RGB", (40, 40), (0, 0, 0)).save(icon)
    img = render.combo_label("あ", str(icon), tape_mm=12)
    assert img.height == 68
    left = render.combo_label("あ", str(icon), image_position="left")
    right = render.combo_label("あ", str(icon), image_position="right")
    # 左に画像: 左端は黒(画像)。右に画像: 左端は白(文字の余白)
    assert left.getpixel((5, 34)) == 0 and right.getpixel((5, 34)) == 255


def test_text_label_for_small_tape():
    img = render.text_label("まある", tape_mm=6)
    assert img.height <= 32
