# p-touch-cube-mcp

Brother P-touch CUBE (PT-P300BT) に Bluetooth(RFCOMM/SPP)で直接ラベルを印刷する MCP サーバー。

- 本体: `src/ptouch_cube_mcp/`(protocol=バイト列、render=文字・画像→白黒、transport=ソケット、service=共通処理、server=MCP、cli)
- プリンタのアドレスは環境変数 `PTOUCH_ADDR`。**リポジトリには書かない**(公開リポ)
- 実機で確かめていないことは README の「確認状況」に書き、確かめたら更新する
- テスト: `uv run pytest`(プリンタ不要)
- 印刷は物理の操作(テープを使う)。最初は `dry_run` で PNG を見てから刷る
- コミットは RRYZ09 名義。push は `env GIT_SSH_COMMAND="ssh -i ~/.ssh/rryz -o IdentitiesOnly=yes -o IdentityAgent=none" git push`
