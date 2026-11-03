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


def test_combo_layouts_both_and_between(tmp_path):
    icon = tmp_path / "i.png"
    Image.new("RGB", (40, 40), (0, 0, 0)).save(icon)
    one = render.combo_label("あ", str(icon), image_position="left")
    both = render.combo_label("あ", str(icon), image_position="both")
    assert both.width > one.width                              # 画像がもう 1 つ増える
    assert both.getpixel((5, 34)) == 0 and both.getpixel((both.width - 5, 34)) == 0   # 両端が画像(黒)
    between = render.combo_label("あ", str(icon), image_position="between", text_after="い")
    solo = render.combo_label("あ", str(icon), image_position="right")
    assert between.width > solo.width                          # 後ろの文字の分だけ広い


def test_docs_cache_version_matches_package_version():
    """docs/ の JS・CSS を読み込むときの ?v= が、パッケージの版と同じ(古いキャッシュを使わせないため)。"""
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    version = re.search(r'^version = "([^"]+)"', (root / "pyproject.toml").read_text(), re.M).group(1)
    found = set()
    for f in ["index.html", "app.js"]:
        found |= set(re.findall(r"\?v=([0-9.]+)", (root / "docs" / f).read_text()))
    assert found == {version}, f"docs の ?v= {found} と pyproject の version {version} をそろえてください"


def test_latin_font_is_used_only_for_ascii_runs():
    runs = render.split_runs("Maru まある 2026", "ja.ttf", "en.ttf")
    assert runs == [("Maru ", "en.ttf"), ("まある", "ja.ttf"), (" 2026", "en.ttf")]
    assert render.split_runs("abc", "ja.ttf", None) == [("abc", "ja.ttf")]


def test_mixed_and_segment_labels_fit_the_head():
    mixed = render.text_label("Maru まある", latin_font_path=None)
    assert mixed.height <= 68
    seg = render.segments_label([{"text": "まある"}, {"text": "Maru"}], tape_mm=9)
    assert seg.height <= 50 and seg.width > 20
    import pytest
    with pytest.raises(ValueError):
        render.segments_label([{"text": ""}])


def test_theme_defaults_to_light_in_docs():
    from pathlib import Path
    html = (Path(__file__).resolve().parents[1] / "docs" / "index.html").read_text()
    assert "var t = 'light'" in html and "prefers-color-scheme" not in (Path(__file__).resolve().parents[1] / "docs" / "style.css").read_text()


def test_faces_render_and_presets():
    from ptouch_cube_mcp import faces
    assert [p["name"] for p in faces.PRESETS] == ["ぷちまる", "澪", "アン", "まある", "ピタ"]
    for p in faces.PRESETS:
        img = faces.face_image(p["eye"], p["mouth"], p["glasses"])
        assert img.width > 100 and img.height > 60
        assert faces.face_image(p["eye"], p["mouth"], p["glasses"], sleep=True, sleep_style=p["sleep"]).getbbox()
    assert faces.find_preset("mio")["name"] == "澪"
    import pytest
    with pytest.raises(ValueError):
        faces.find_preset("だれ")
    with pytest.raises(ValueError):
        faces.face_image(eye="nothing")


def test_face_label_in_all_layouts():
    from ptouch_cube_mcp import service
    for pos in ("right", "left", "both"):
        info = service.print_face("まある", text="まある", text_position=pos, dry_run=True)
        assert info["printed"] is False and info["label_dots"][1] == 68
    assert "仮" in service.print_face("澪", dry_run=True)["face"]


def test_faces_tables_match_the_web_version():
    """docs/faces.js の表(目・口・ぷちたち)が、Python 版と同じ。"""
    import json
    import shutil
    import subprocess
    from pathlib import Path

    import pytest

    from ptouch_cube_mcp import faces

    node = shutil.which("node")
    if not node:
        pytest.skip("node が無い")
    root = Path(__file__).resolve().parents[1]
    js = ("import('" + (root / "docs" / "faces.js").as_uri() + "').then(m=>console.log(JSON.stringify("
          "{eyes:m.EYES,mouths:m.MOUTHS,presets:m.PRESETS,glasses:m.GLASSES.map(g=>g.key),sleeps:m.SLEEPS.map(g=>g.key)})))")
    out = json.loads(subprocess.run([node, "-e", js], capture_output=True, text=True, check=True).stdout)
    for e in out["eyes"]:
        py = faces.EYES[e["key"]]
        assert {k: e[k] for k in ("shape", "rx", "ry", "dx", "dy", "tilt")} == py
    for m in out["mouths"]:
        assert {k: m[k] for k in ("shape", "size", "dy")} == faces.MOUTHS[m["key"]]
    assert tuple(out["glasses"]) == faces.GLASSES and tuple(out["sleeps"]) == faces.SLEEPS
    keys = ("id", "name", "color", "eye", "mouth", "glasses", "sleep")
    assert [{k: p[k] for k in keys} for p in out["presets"]] == [{k: p[k] for k in keys} for p in faces.PRESETS]
