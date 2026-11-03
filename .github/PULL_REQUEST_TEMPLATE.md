## 何を変えたか / What

<!-- 変えたことを 1〜3 行で -->

## 関連 Issue / Related issue

<!-- 例: Closes #12 。無ければ「なし」 -->

## 確認したこと / How it was checked

- [ ] `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 uv run pytest` が通る
- [ ] 実機で確かめた(機種・テープ・結果:  )  /  実機では確かめていない(README の「動作確認の状況」は未確認のまま)
- [ ] 印刷ページ(`docs/`)を変えたときは、ブラウザで開いて確かめた
- [ ] `protocol.py` を変えたときは、`docs/protocol.js` も同じに直した
- [ ] `docs/` の JS・CSS を変えたときは、`pyproject.toml` の version と `?v=` をそろえて上げた
- [ ] README(日本語)と README_EN(英語)の両方を直した

## 守ること / Checklist

- [ ] プリンタの Bluetooth アドレスを、コードにも文書にも書いていない
- [ ] 実機で確かめていないことを「動く」と書いていない

## マージ後にやること / After merging

<!-- 例: リリースを作る、README の確認状況を更新する。無ければ「なし」 -->
