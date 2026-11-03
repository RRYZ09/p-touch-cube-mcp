# 開発に参加する(CONTRIBUTING)

見に来てくださってありがとうございます。バグの報告、実機での確認結果、対応機種や OS の追加、どれも歓迎です。
日本語でも英語でも大丈夫です。

## まず Issue でも PR でも

- **動いた・動かなかった**: [Issue](https://github.com/RRYZ09/p-touch-cube-mcp/issues) に、次の 4 つを書いてもらえると助かります。
  1. 機種(例: PT-P300BT)とテープ(幅・種類)
  2. OS とバージョン
  3. したこと(コマンド)と、出た結果(エラーの全文)
  4. 期待したこと
- **小さな直し**(誤字・説明・テスト): そのまま PR で大丈夫です。
- **大きな変更**(新しい機種・OS への対応など): 先に Issue で相談してください。

## 特に助かること

README の「動作確認の状況」で、未確認になっているものを実機で試して、結果を教えてもらうことです。

- JPEG・PNG の印刷
- 布テープ・リボンカートリッジ
- 12mm 以外のテープ幅(印刷できる範囲の計算を直す必要があります)
- macOS・Windows への対応(いまは Linux の Bluetooth ソケットを使っています)
- 印刷ページ(`docs/`)からの実際の印刷(Chrome・Edge、OS ごとの動き)
- ほかの P-touch CUBE の機種

## 開発のはじめ方

```sh
git clone https://github.com/RRYZ09/p-touch-cube-mcp.git
cd p-touch-cube-mcp
uv sync
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 uv run pytest   # プリンタなしで動くテスト
```

テストは、印刷ページの JavaScript(`docs/protocol.js`)が Python 版と同じ印刷データを作ることも確かめます(Node.js が要ります。無いときはその 1 件だけ飛ばされます)。

`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` は、ROS などが入っている環境で、関係のない pytest プラグインを読み込まないためのものです。

プリンタが無くても、`dry_run` で仕上がりの画像までは確かめられます。

```sh
uv run p-touch-cube text "テスト" --dry-run
```

## PR の出し方

1. リポジトリを fork して、ブランチを作る(`main` に直接は入れません)
2. 変更して、テストを足す・直す
3. `uv run pytest` が通ることを確かめる(GitHub Actions でも、PR ごとに同じテストが動きます)
4. `protocol.py` を変えたときは、`docs/protocol.js` も同じに直す
5. PR の本文に、**何を変えたか**、**実機で確かめたか**(機種とテープ)を書く

実機で確かめていない変更は、そう書いてあれば大丈夫です。README の「動作確認の状況」にも、未確認のまま残します。

## 守ってほしいこと

- **プリンタの Bluetooth アドレスを、コードや文書に書かない**(環境変数 `PTOUCH_ADDR` で渡します)。例は `XX:XX:XX:XX:XX:XX` にしてください。
- 印刷はテープを使います。テストでは、できるだけ `dry_run` を使ってください。
- 公式サポートの外の機能です。Brother の資料のうち、再配布できないものは、コピーせずにリンクにしてください。

## ライセンス

PR の内容は、このリポジトリと同じ [Apache License 2.0](LICENSE) で公開されます。
