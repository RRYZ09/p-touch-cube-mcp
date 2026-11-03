# CLAUDE.md

Claude Code などの AI エージェントが、このリポジトリで作業するときの案内です。人が読んでも大丈夫です。

## これは何か

Brother P-touch CUBE (PT-P300BT) に、Bluetooth(RFCOMM / SPP)でラベルを印刷する MCP サーバーです。
利用者向けの説明は [README.md](README.md)、参加のしかたは [CONTRIBUTING.md](CONTRIBUTING.md) にあります。

## コードの場所

| ファイル | 役割 |
|---|---|
| `src/ptouch_cube_mcp/protocol.py` | プリンタに送るバイト列(ラスター命令、PackBits、ステータスの読み取り) |
| `src/ptouch_cube_mcp/render.py` | 文字・画像を、高さ 68 ドット以下の白黒ラベルにする |
| `src/ptouch_cube_mcp/transport.py` | Bluetooth のソケットでつなぎ、送る・ステータスを読む |
| `src/ptouch_cube_mcp/service.py` | MCP とコマンドラインの共通処理(下見の PNG を作る、印刷する) |
| `src/ptouch_cube_mcp/server.py` | MCP サーバー(FastMCP、ツールは 3 つ) |
| `src/ptouch_cube_mcp/cli.py` | コマンド `p-touch-cube`(status / text / image) |
| `docs/` | GitHub Pages の「P-TOUCH CUBE ラベルメーカー」(`protocol.js` は Python 版の移植、`app.js` が画面と Web Serial、`models.js` が機種表、`i18n.js` が日本語・英語の文) |
| `web_tests/parity.mjs` | 印刷ページの JS が Python 版と同じバイト列を作るかの確認(`tests/test_protocol.py` から呼ぶ) |
| `tests/` | プリンタなしで動くテスト |

## コマンド

```sh
uv sync
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 uv run pytest    # テスト
uv run p-touch-cube text "テスト" --dry-run        # 下見(テープは使わない)
```

## 守ること

- **プリンタの Bluetooth アドレスをコミットしない。** 環境変数 `PTOUCH_ADDR` で渡します。例は `XX:XX:XX:XX:XX:XX`。
- **印刷はテープを使う物理の操作です。** 依頼されていない印刷や、まとめて何枚も刷ることはしないでください。最初は `dry_run` で下見を作って見せます。
- **実機で確かめていないことを「動く」と書かない。** README の「動作確認の状況」を、確かめた分だけ更新します。
- `mcp` は 1.x に固定しています(2.x は FastMCP が別名になり、このコードは動きません)。上げるときは、コードも直して、MCP クライアントから動かして確かめます。
- 通信の仕様は、有志の解析にもとづいています。変えるときは、README の「仕組みのメモ」と、`protocol.py` の説明も直します。
- **`protocol.py` を変えたら、`docs/protocol.js` も同じに直す。** 2 つが同じバイト列を作ることを、テスト(`test_web_version_builds_identical_job`)が見ています。
- **`docs/` の JS・CSS を変えたら、`pyproject.toml` の `version` を上げ、`docs/index.html` と `docs/app.js` の `?v=` を同じ版にする**(ブラウザが古い JS を使い続けて、画面とずれるのを防ぐ。テストが見ています)。
- README は `README.md`(日本語)と `README_EN.md`(英語)の 2 つ。片方を直したら、もう片方も直します。
- 印刷ページの文を足すときは、日本語を `docs/index.html`(`data-i18n`)に、英語を `docs/i18n.js` に書きます。機種を足すときは `docs/models.js` に足し、`support` は実機で確かめるまで `preview` か `experimental` にします。
- `main` に直接 push せず、ブランチと PR で変更します。

## よくある作業

- **新しいツールを足す:** `service.py` に処理を書き、`server.py` に `@mcp.tool()` で出します。説明文(docstring)が、そのまま AI への説明になるので、使い方と注意を書きます。
- **テープの種類を足す:** `protocol.py` の `MEDIA_*` と、`service.py` の `MEDIA` に足します。実機で確かめたら、README の表を更新します。
- **印刷の向きや鏡文字を直す:** `protocol.py` の `label_to_columns` です。`tests/test_protocol.py` の、向きと端のテストも合わせて直します。
