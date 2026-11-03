# p-touch-cube-mcp

**Brother P-touch CUBE (PT-P300BT) に、Claude から話しかけてラベルを印刷する** MCP サーバーです。

> English: An MCP server that prints labels on the Brother P-touch CUBE (PT-P300BT) over Bluetooth (RFCOMM/SPP), without the official app. Text (Japanese OK) and JPEG/PNG. Linux only for now. Unofficial; use at your own risk. See [Quick start](#クイックスタート).

```
あなた: 「まある」って名前のラベルを作って。まず下見だけ見せて。
Claude: (下見の画像を作る) こんな見た目です。刷りますか?
あなた: 刷って。
Claude: (プリンタに送る) 1 枚印刷しました。
```

公式アプリ(P-touch Design&Print)を使わず、パソコンから直接つなぎます。
アプリは「文字 1 つ・アイコン 3 つまで」などの制限がありますが、この MCP なら好きな文字や、JPEG の画像もラベルにできます。

**非公式の使い方です。** Brother の公式サポートの範囲外なので、自己責任でお使いください。

## 何ができるか

| ツール | 内容 |
|---|---|
| `print_label_text` | 文字を印刷します。日本語 OK、改行で複数行。`dry_run` を付けると、印刷せずに仕上がりの PNG だけ作ります |
| `print_label_image` | JPEG・PNG を白黒にして印刷します。テープの幅に合わせて縮み、回転もできます |
| `printer_status` | テープの幅・種類・エラーの有無を読みます。「つながっているか」の確認にも使います |

## 用意するもの

- Brother **PT-P300BT**(P-touch CUBE)と、12mm 幅のテープ
- **Linux** のパソコンで、Bluetooth が使えるもの(Ubuntu 24.04 で動作確認)
- Python 3.10 以上と、[uv](https://docs.astral.sh/uv/)
- Claude Code など、MCP が使えるアプリ(コマンドラインだけでも使えます)

macOS と Windows は、いまは動きません(Python の Bluetooth ソケットを使っているため)。対応のお手伝いは歓迎です([CONTRIBUTING.md](CONTRIBUTING.md))。

## クイックスタート

### 1. 取ってくる

```sh
git clone https://github.com/RRYZ09/p-touch-cube-mcp.git
cd p-touch-cube-mcp
uv sync
```

### 2. プリンタとペアリングする(初回だけ)

プリンタの電源を入れてから、次を実行します。

```sh
bluetoothctl
> scan on                 # 「PT-P300BT」と数字が出たら、そのアドレスを控える
> pair XX:XX:XX:XX:XX:XX  # 控えたアドレス
> trust XX:XX:XX:XX:XX:XX
> exit
```

`sudo` も `rfcomm bind` も要りません。

### 3. つながるか確かめる

アドレスは環境変数で渡します。**アドレスはファイルに書かないでください**(公開リポジトリに入れてしまう事故を防ぐため)。

```sh
export PTOUCH_ADDR=XX:XX:XX:XX:XX:XX
uv run p-touch-cube status
```

`"ok": true` と、テープの幅(`"tape_mm": 12`)が出れば成功です。

### 4. まず下見、次に印刷

```sh
uv run p-touch-cube text "まある" --dry-run   # out/ に仕上がりの PNG ができる(テープは使わない)
uv run p-touch-cube text "まある"             # 印刷
uv run p-touch-cube image photo.jpg --dry-run
```

### 5. Claude Code から使う

```sh
claude mcp add p-touch-cube --env PTOUCH_ADDR=XX:XX:XX:XX:XX:XX \
  -- uv run --directory /path/to/p-touch-cube-mcp p-touch-cube-mcp
```

登録したあと、Claude Code を開き直してください。あとは「ラベルを作って」と頼むだけです。
**テープを使うので、最初の 1 枚は、下見(dry_run)で見た目を確かめてから**刷るのがおすすめです。

## つまずいたとき

| 症状 | 試すこと |
|---|---|
| `PTOUCH_ADDR` のエラー | 環境変数を設定したか。MCP で使うときは、`claude mcp add` の `--env` で渡す |
| 接続できない・「not available」 | プリンタの電源が入っているか。入っていても見つからないときは、電源を入れ直して、もう一度試す |
| ステータスが意味不明な値(同じ並びの繰り返し) | 接続先のチャンネルが違います。`sdptool browse <アドレス>` で「SPP SERVER」の Channel を見て、`PTOUCH_CHANNEL` に入れる(PT-P300BT は 2) |
| 印刷のあとにエラーで止まる | プリンタの電源ボタンを 1 回押すと戻ることが多いです(有志の報告) |
| 日本語が四角になる | 日本語フォントが見つからない状態です。`PTOUCH_FONT` にフォントファイルのパスを入れる |
| 文字が鏡文字・逆さになる | [Issue](https://github.com/RRYZ09/p-touch-cube-mcp/issues) に、機種とテープの種類を書いて教えてください |

## 動作確認の状況

| こと | 状態 |
|---|---|
| ペアリング、接続(チャンネル 2)、ステータス取得(12mm・ラミネート) | 確認済み |
| 日本語の文字の印刷(12mm ラミネート) | 確認済み |
| JPEG・PNG の印刷 | **未確認**(ドットの計算とプレビューはテスト済み) |
| 布テープ・リボン(`media=non_laminated`) | **未確認** |
| 12mm 以外の幅 | **未確認**(印刷できる範囲の計算は 12mm 固定) |

確かめられたら、結果を [Issue](https://github.com/RRYZ09/p-touch-cube-mcp/issues) か PR で教えてもらえると助かります。

## 仕組みのメモ

- プリンタは、Bluetooth のシリアル通信(SPP)で、Brother のラスター命令(PTCBP モード)を受け取ります。
- ヘッドは 128 ドット(16 バイト)で、12mm テープで印刷できるのは中央の約 68 ドットです。
- ラベル画像の 1 列が、ラスターの 1 行です。90 度回して左右を反転し、PackBits で圧縮して送ります。
- 命令の流れ: 初期化 → ラスターモード → 印刷情報(テープ幅・行数)→ 余白 → 圧縮指定 → ラスター行 → 印刷(`0x1A`)。

コードの場所は、[CLAUDE.md](CLAUDE.md) の一覧にあります。

## 謝辞

通信の仕様は、[stecman さんの解析](https://gist.github.com/stecman/ee1fd9a8b1b6f0fdd170ee87ba2ddafd)と、Brother の PT-9500PC のコマンドリファレンスにもとづいています。公式の PT-P300BT の仕様書はありません。

## ライセンス

[Apache License 2.0](LICENSE)
