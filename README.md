# p-touch-cube-mcp

Brother **P-touch CUBE (PT-P300BT)** に、Bluetooth で直接ラベルを印刷する MCP サーバー。
Claude などから「この文字でラベルを作って」「この JPEG をシールにして」と頼めます。

公式アプリ(P-touch Design&Print)を使わずに、パソコンから印刷します。
通信の仕様は、有志の解析([stecman の gist](https://gist.github.com/stecman/ee1fd9a8b1b6f0fdd170ee87ba2ddafd))と、Brother の PT-9500PC の CBP-RASTER コマンドリファレンスをもとにしています。
Brother の公式サポート外の使い方です。自己責任でお使いください。

## できること

| ツール | 内容 |
|---|---|
| `print_label_text` | 文字を印刷(日本語 OK、改行で複数行)。`dry_run` で仕上がりの PNG だけ作れる |
| `print_label_image` | JPEG / PNG を白黒にして印刷(縮小・回転・ディザ) |
| `printer_status` | テープの幅・種類・エラーを読む。つながるかの確認にも |

## 使い方(Linux)

1. プリンタの電源を入れ、ペアリングする(初回だけ)

   ```sh
   bluetoothctl
   > scan on          # PT-P300BTxxxx が出る
   > pair B4:22:...   # アドレスはご自分のもの
   > trust B4:22:...
   ```

2. アドレスを環境変数に入れて、状態を見る(**アドレスはリポジトリに書かないでください**)

   ```sh
   export PTOUCH_ADDR=XX:XX:XX:XX:XX:XX
   uv run p-touch-cube status
   uv run p-touch-cube text "まある" --dry-run   # out/ に仕上がりの PNG
   uv run p-touch-cube text "まある"             # 印刷
   uv run p-touch-cube image photo.jpg --dry-run
   ```

3. Claude Code に登録する

   ```sh
   claude mcp add p-touch-cube --env PTOUCH_ADDR=XX:XX:XX:XX:XX:XX \
     -- uv run --directory /path/to/p-touch-cube-mcp p-touch-cube-mcp
   ```

`sudo` も `rfcomm bind` も要りません(Python の Bluetooth ソケットで、サーバーが直接つなぎます)。
SPP のチャンネルは、PT-P300BT では 2 です(`sdptool browse <アドレス>` で確認。別なら `PTOUCH_CHANNEL`)。

## 仕組みのメモ

- ヘッドは 128 ドット。12mm テープで印刷できるのは中央の約 68 ドット(上下 30 ドットずつは出ない)。
- ラベル画像の 1 列が、ラスターの 1 行(16 バイト)。90 度回して左右を反転してから、PackBits 圧縮で送る。
- 印刷は `ESC i a 1`(ラスターモード)→ 印刷情報 → 余白 → 圧縮指定 → ラスター行 → `0x1A`。

## 確認状況

| こと | 状態 |
|---|---|
| ペアリング、SPP(チャンネル 2)に接続、ステータス取得(12mm・ラミネート) | 実機で確認 |
| 文字の印刷(「まある」12mm ラミネートで 1 枚。出来上がりはありさんが目で確認) | 実機で確認 |
| JPEG の印刷 | 未確認 |
| 布テープ・リボンカートリッジ(`media=non_laminated`) | 未確認 |
| 12mm 以外の幅 | 未確認(`tape_mm` を渡せるが、印刷できる範囲の計算は 12mm 固定) |
| 印刷後にエラー状態になる(電源ボタンで復帰)という報告あり | 今のところ起きていない |

## テスト

```sh
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 uv run pytest   # プリンタ不要
```

## ライセンス

Apache License 2.0
