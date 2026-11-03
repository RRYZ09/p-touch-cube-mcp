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
