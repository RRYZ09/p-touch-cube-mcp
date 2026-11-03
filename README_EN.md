# p-touch-cube-mcp

[![CI](https://github.com/RRYZ09/p-touch-cube-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/RRYZ09/p-touch-cube-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/RRYZ09/p-touch-cube-mcp)](https://github.com/RRYZ09/p-touch-cube-mcp/releases)
[![License: Apache-2.0](https://img.shields.io/github/license/RRYZ09/p-touch-cube-mcp)](LICENSE)
![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)
![Linux](https://img.shields.io/badge/OS-Linux-lightgrey)

**English** ・ [日本語](README.md)

An **MCP server that prints labels on the Brother [P-touch CUBE (PT-P300BT)](https://www.brother.co.jp/product/labelwriter/special/cube/about/index.aspx)** over Bluetooth, straight from Claude or any MCP client. There is also a [**P-TOUCH CUBE Label Maker**](https://rryz09.github.io/p-touch-cube-mcp/?lang=en) (Japanese / English, light / dark) where you edit and print a label in Chrome.

```
You:    Make a label that says "Souvenir". Show me a preview first.
Claude: (renders a preview PNG) Here it is. Print it?
You:    Print.
Claude: (sends it to the printer) Printed 1 label.
```

It does not need the official app. The official app limits a label to one text object and three icons. Here you can print any text (Japanese included) and JPEG/PNG images.

**This is unofficial and unsupported by Brother. Use it at your own risk.**

## Two ways to use it

| | For | Needs |
|---|---|---|
| **[Label Maker](https://rryz09.github.io/p-touch-cube-mcp/?lang=en)** (browser) | Quick printing, nothing to install | Desktop Chrome or Edge (Web Serial), printer already paired |
| **MCP / command line** | Ask Claude to print; automation | Linux, Python, uv |

Both need the printer **paired with your computer** first (step 2 below).

## Tools (MCP)

| Tool | What it does |
|---|---|
| `print_label_text` | Prints text. Multi-line supported. Pass `image_path` to put an image beside the text (`image_position`: `left` / `right` / `both` = image on both sides / `between` = image between two texts, the second via `text_after`), `tape_mm` for the tape width (3.5–24) `font_path` for any font file, `latin_font_path` for a different font on ASCII letters/numbers only, and `segments` for a font per piece of text. `dry_run` renders a preview PNG without printing |
| `print_label_image` | Prints a JPEG/PNG, converted to black and white and scaled to the tape width. Can rotate |
| `printer_status` | Reads tape width, tape type and error state. Also a connection check |

## Requirements

- Brother **PT-P300BT** and 12 mm tape
- MCP / command line: **Linux** with Bluetooth (tested on Ubuntu 24.04), Python 3.10+, [uv](https://docs.astral.sh/uv/)
- Print page: desktop Chrome or Edge (does not work on Safari, Firefox, iPhone or iPad)

macOS and Windows are not supported for the MCP / CLI yet, because it uses Python's Bluetooth socket. The browser page may work there with Chrome. Help is welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick start

### 1. Get it

```sh
git clone https://github.com/RRYZ09/p-touch-cube-mcp.git
cd p-touch-cube-mcp
uv sync
```

### 2. Pair the printer (once; also needed for the print page)

Turn the printer on, then:

```sh
bluetoothctl
> scan on                 # note the address of "PT-P300BTxxxx"
> pair XX:XX:XX:XX:XX:XX
> trust XX:XX:XX:XX:XX:XX
> exit
```

No `sudo` and no `rfcomm bind` needed.

### 3. Check the connection

Pass the address through an environment variable. **Never commit your printer's address.**

```sh
export PTOUCH_ADDR=XX:XX:XX:XX:XX:XX
uv run p-touch-cube status
```

You should see `"ok": true` and the tape width (`"tape_mm": 12`).

### 4. Preview first, then print

```sh
uv run p-touch-cube text "Hello" --dry-run   # writes a preview PNG to out/ (no tape used)
uv run p-touch-cube text "Hello"             # print
uv run p-touch-cube text "Hello" --tape-mm 9 --image heart.png --dry-run   # 9 mm tape, heart + text
uv run p-touch-cube text "Hello" --font ~/.fonts/Fredoka.ttf --dry-run    # any font
uv run p-touch-cube text "Label ラベル" --font ja.ttf --latin-font en.ttf --dry-run   # different fonts for Japanese and ASCII
uv run p-touch-cube text x --segment "ラベル=ja.ttf" --segment "Label=en.ttf" --dry-run   # a font per piece
uv run p-touch-cube image photo.jpg --dry-run
```

### 5. Use it from Claude Code

```sh
claude mcp add p-touch-cube --env PTOUCH_ADDR=XX:XX:XX:XX:XX:XX \
  -- uv run --directory /path/to/p-touch-cube-mcp p-touch-cube-mcp
```

Restart Claude Code, then just ask for a label. Printing uses tape, so check the preview (`dry_run`) before the first real print.

## Print page (browser)

<https://rryz09.github.io/p-touch-cube-mcp/?lang=en>

Edit text or load an image, watch the preview, and print.

- **Pick the printer model** (PT-P300BT / PT-P320BT / PT-P710BT / PT-P910BT). It starts on the PT-P300BT with 12 mm tape. **Everything else is marked "(unverified)" in the lists.** The PT-P710BT is experimental; the PT-P320BT and PT-P910BT are preview only. The available tape widths follow the model.
- **Japanese / English and light / dark** from the buttons at the top right (it starts in light mode; `?lang=ja` / `?lang=en` in the URL picks the language).
- **Pick the tape width** (3.5 / 6 / 9 / 12 / 18 / 24 / 36 mm). The preview shows that tape at **actual size**; the dashed lines mark the printable area.
- **Save as an image** ("Save as image (PNG)": a black-on-white PNG at 4× the label dots).
- **Text, image, or text + image.** Text + image has four layouts: "image → text", "text → image", "image → text → image" (image on both sides) and "text → image → text" (image between two texts), with size and gap controls.
- **Cute fonts**: 12 Japanese and 12 English (Latin) ones. English fonts fall back to a rounded gothic for Japanese characters, so mixed text works.
- A green top bar keeps the title, language and theme buttons in view.
- **Separate fonts for Japanese and for letters/numbers** (e.g. a script font for the English and a rounded gothic for the Japanese in "Label ラベル"). Turn on "Pick a font for each piece of text" to split the label into pieces with a font each (joined left to right).
- After pairing, press "connect only" and choose the printer from the browser's list.

Images are processed on your machine and never uploaded. Only the fonts are fetched from Google Fonts (your label text is not sent).

**About tape widths**: the PT-P300BT takes 3.5–12 mm tape. 18 and 24 mm are for other models such as the PT-P710BT, and 36 mm cannot be printed with a 128-dot head (preview only). Only 12 mm has been verified on real hardware.

## Troubleshooting

| Symptom | Try |
|---|---|
| `PTOUCH_ADDR` error | Set the variable. For MCP, pass it with `--env` in `claude mcp add` |
| Cannot connect / "not available" | Is the printer on? Power-cycle it and retry |
| Garbage status (a repeating pattern) | Wrong RFCOMM channel. Run `sdptool browse <address>`, find "SPP SERVER", and set `PTOUCH_CHANNEL` (it is 2 on the PT-P300BT) |
| Printer stuck in an error state after printing | Pressing the power button once usually clears it (reported by other users) |
| Japanese shows as boxes | No Japanese font found. Set `PTOUCH_FONT` to a font file |
| Printer missing in the print page's list | Paired in the OS first? Using Chrome/Edge? Reload and retry |
| Mirrored or upside-down text | Open an [issue](https://github.com/RRYZ09/p-touch-cube-mcp/issues) with your model and tape type |

## Verification status

| Item | Status |
|---|---|
| Pairing, connection (channel 2), status read (12 mm laminated) | Verified |
| Printing Japanese text (12 mm laminated) | Verified |
| Print page preview in Chrome (tape width, actual size, text + image, fonts) | Verified |
| Printing text from the print page (12 mm) | Verified in Chrome (also byte-for-byte equal to the Python output, tested in CI) |
| Printing JPEG/PNG | **Not verified** (dot math and preview are tested) |
| Fabric tape / ribbon (`media=non_laminated`) | **Not verified** |
| 3.5 / 6 / 9 mm tape | **Not verified** (printable dot counts come from Brother's PT-P700-series reference; Python and JS output are tested to be byte-identical) |
| 18 / 24 mm (other models), 36 mm (not printable) | **Not verified** / not printable |
| Printing text + image (4 layouts) | **Not verified** (layout and preview are tested) |

Reports of what works for you are very welcome, as an [issue (hardware report)](https://github.com/RRYZ09/p-touch-cube-mcp/issues/new/choose) or PR.

## How it works

- The printer takes Brother's raster commands (PTCBP mode) over the Bluetooth serial port profile (SPP).
- The head is 128 dots (16 bytes); only the middle ~68 dots print on 12 mm tape.
- One column of the label image becomes one raster line. The image is rotated 90°, mirrored, PackBits-compressed and sent.
- The browser page (`docs/`) is a JavaScript port of the same logic and talks to the paired Bluetooth serial port through Chrome's Web Serial.

See [CLAUDE.md](CLAUDE.md) for a map of the code.

## Credits

The protocol comes from [stecman's reverse engineering](https://gist.github.com/stecman/ee1fd9a8b1b6f0fdd170ee87ba2ddafd) and Brother's PT-9500PC command reference. Brother has not published a PT-P300BT reference.

## License

[Apache License 2.0](LICENSE)
