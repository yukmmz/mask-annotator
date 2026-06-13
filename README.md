# mask-annotator

iPad / Apple Pencil で動く、**ブラウザだけで完結するピクセルマスク注釈ツール**（静的Webアプリ）。
クロノフォトグラフィ（多重露光風合成）パイプライン用に、ロボット/箱などの領域を
ブラシで塗って抽出する。デスクトップ版 `annotate_robot_mask.py` の iPad 版に相当する。

**公開URL**: https://yukmmz.github.io/mask-annotator/

## 特徴

- **完全クライアントサイド**: 画像はブラウザ内だけで処理。GitHub やサーバーへ一切送らない。
- **Apple Pencil 対応**: ペンで描画、指でズーム/移動（パームリジェクション付き）。
- **賢いブラシ**: なぞった所から「差分が似た連結領域」へ自動拡張＋内側の穴埋め
  （`annotate_robot_mask.py` の `select_region` を JS 移植。背景画像が必要）。
- **自動保存**: IndexedDB に保存。Safari を閉じても同じ iPad で再開できる。
- **出力**: `<frame>_<object>_mask.png` ＋ `manifest_<object>.json` を ZIP で書き出し。

## 使い方

1. **画像を用意**（Mac側）: キーフレーム数枚（`frame_*.png`）と背景1枚を iCloud Drive 等に置く。
   - 背景 = 抽出フォルダの最終フレーム（または median プレート）。差分計算に使う。
   - 親リポジトリの `scripts/experiments/export_for_ipad.py` でまとめて書き出せる。
2. **iPad で開く**: https://yukmmz.github.io/mask-annotator/ （「ホーム画面に追加」推奨）。
3. 「画像を読込」でキーフレームを複数選択 →「背景」で背景1枚を選択。
4. 対象（robot/box）を選び、Apple Pencil で塗る。
   - `ADD/REMOVE` 切替、`brush/similarity/reach` スライダ、`Undo`/`Clear`、`◀▶` でフレーム移動。
   - `reach=0` は「塗った所＋内側の穴」だけ（差分拡張なし）。
5. 「ZIP出力」→ Files に保存 → Mac で展開して `brush_masks/` に置く。
6. Mac 側で合成: `compose_robot_gui.py --mask-dir brush_masks/`。

robot と box は対象を切り替えて別々に塗り、両方を同じ ZIP/フォルダに入れる
（manifest はオブジェクトごと: `manifest_robot.json` / `manifest_box.json`）。

## 出力フォーマット（親パイプラインとの契約）

```
manifest_<object>.json:
{ "object": "robot", "long_side": 1600, "mask_size_hw": [H, W],
  "frames": [ { "file": "frame_000030.png",
                "mask": "frame_000030_robot_mask.png", "has_mask": true }, ... ] }
```
マスク PNG は 255=対象 / 0=背景。合成側はキーフレーム解像度へ最近傍リサイズして読む
ので、解像度が多少違っても問題ない。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | レイアウト・ツールバー |
| `style.css` | スタイル（タッチ操作の無効化など） |
| `brush.js` | `select_region` 相当のコア（純関数, node でテスト可能） |
| `app.js` | UI・入出力・状態管理・IndexedDB・ZIP出力 |
| `test_brush.js` | `brush.js` の node 単体テスト（`node test_brush.js`） |

## 開発・テスト

```bash
node test_brush.js          # ブラシコアの単体テスト
python3 -m http.server 8000 # ローカル確認（http://localhost:8000）
```

## ライセンス / 注意

汎用のブラシ注釈コードのみを含み、研究データや秘密情報は含まない。
GitHub Pages（public）で配信。
