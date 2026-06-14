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
- **ZIPから再開**: 出力済みマスクZIPを読み込んで途中から続けられる（別iPad・別ブラウザ・
  Mac の `annotate_robot_mask.py` で作った続き・他者から受け取ったマスク）。
- **前マスクをコピー**: 形がほぼ同じ隣接フレームのため、前フレームのマスクをコピーして
  平行移動・回転で位置合わせ → 確定後はブラシで微調整できる。
- **出力**: `<frame>_<object>_mask.png` ＋ `manifest_<object>.json` を ZIP で書き出し。

## 使い方

1. **画像を用意**（Mac側）: キーフレーム数枚（`frame_*.png`）と背景1枚を iCloud Drive 等に置く。
   - 背景 = 抽出フォルダの最終フレーム（または median プレート）。差分計算に使う。
   - 親リポジトリの `scripts/experiments/export_for_ipad.py` でまとめて書き出せる
     （`ipad_pack_<stem>/` に `frame_*.png` ＋ `background_<stem>.png`）。
2. **iPad で開く**: https://yukmmz.github.io/mask-annotator/ （「ホーム画面に追加」推奨）。
3. 「画像を読込」でキーフレームを複数選択 →「背景」で `background_<stem>.png` を選択。
   - 背景ファイル名から **pack名（`<stem>`）を自動取得**（上部の入力欄で手修正も可）。
     pack名は ZIP ファイル名と保存名前空間（IndexedDB）に使われ、別データセットとの衝突を防ぐ。
4. 対象（robot/box）を選び、Apple Pencil で塗る（上部のスライダで brush/similarity/reach 調整）。
   - `ADD/REMOVE` 切替、`Undo`/`Clear`、`◀▶` でフレーム移動。
   - `reach=0` は「塗った所＋内側の穴」だけ（差分拡張なし）。
5. 「ZIP出力」→ `<pack>_<object>_masks.zip` を Files に保存 → Mac で展開して `brush_masks/` に置く。
6. Mac 側で合成: `compose_robot_gui.py --mask-dir brush_masks/`。

robot と box は対象を切り替えて別々に塗り、両方を同じ ZIP/フォルダに入れる
（manifest はオブジェクトごと: `manifest_robot.json` / `manifest_box.json`）。

### 対象（object）について

対象セレクタには `robot` / `box` のほか、羽ばたき機構研究用の **`mech`（リンク）** /
**`wing`（翼）** がある。下層（ブラシ・保存・再開・ZIP入出力）はオブジェクト名に依存しないので、
どの対象も同じ手順でブラシ注釈でき、`manifest_<object>.json` ＋ `<stem>_<object>_mask.png` を出力する。

#### 羽ばたき機構（mech / wing）の運用

羽ばたきは **黒背景**で撮影する。リンク=白、翼=黄（半透明）。

- **背景**: 黒背景の **median プレート**を使う（親リポの
  `export_for_ipad.py --background median` が `ipad_pack_<stem>/` に
  `frame...JPG` ＋ `background_<stem>.png` を出力。pack名は背景ファイル名から自動取得）。
- **mech（白リンク）**: 背景差分が効くので賢いブラシ（similarity/reach）でなぞって抽出する。
- **wing（黄翼）**: 白く薄い膜は背景差分で拾いにくいので、`reach=0`（塗った所＋内側の穴だけ）で
  手塗りするのが確実。
- 合成（Mac側）は対象別 manifest（`manifest_mech.json` / `manifest_wing.json`）を読む。

## ZIPから再開（途中から続ける）

別端末や Mac で作ったマスクの続きを iPad で編集したいときに使う。

1. いつも通り「画像を読込」→「背景」を選び、**pack名を確定**させる（再開も画像読込後に行う）。
2. **「マスク読込」**ボタンを押し、`*_robot_masks.zip` / `*_box_masks.zip` を選ぶ（複数可）。
3. ZIP内の `manifest_<object>.json` と `*_mask.png` をフレーム名で突合して取り込み、
   現在のフレーム解像度へ最近傍リサイズ＋2値化して反映する。robot/box を一括取込できる。
4. そのまま続きを描き、完了したら「ZIP出力」。

注意:
- **未マッチがあると取り込みを中止する**: ZIP内のマスク付きフレーム名が、いま読み込んでいる
  画像のどれとも一致しない場合、安全のため**何も書き込まずに中止**する（部分取り込みなし）。
  ZIP を作ったときと同じキーフレームを読み込んでから再試行すること。
- 取込は既存の同フレーム・同対象マスクを**上書き**する（＝再開の意味）。`has_mask:false`
  （未注釈）のフレームは取り込まず、現状を維持する。

## 前マスクをコピー（移動・回転して使い回す）

連続フレームではマスクの形がほとんど変わらないことが多いので、前フレームの形を再利用する。

1. コピー先のフレームを表示する（`◀▶`）。
2. **「前マスクをコピー」**を押す。前フレーム（`idx-1`）のマスクがシアン色のプレビューで重なる。
   - コピー先に**既にマスクがある場合は確認ダイアログ**が出る（誤操作で上書きしないため）。
     「あとで Undo で戻せます」と案内され、OK でのみ進む。
3. **Apple Pencil でドラッグ＝平行移動**、**プレビュー上部の○ハンドルをドラッグ＝回転**
   （PowerPoint / GoodNotes と同じ操作感。回転中心はマスクの外接矩形の中心）。指でのピンチは
   表示のズーム/移動。
4. **「確定」**で現在フレームのマスクとして焼き込む（直前の状態は Undo で1手戻せる）。**「取消」**で破棄。
5. 確定後は手で塗ったマスクと全く同じ扱いで、**ADD/REMOVE ブラシ・Undo・Clear** で調整できる。

移動/回転モード中は、誤操作防止のためフレーム移動・対象切替・ZIP出力/読込・Undo/Clear を一時的に
ブロックする（ステータスに「先に確定/取消してください」と表示）。

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
| `mask_io.js` | ZIP取り込み用の純関数（manifest解析・2値化, node でテスト可能） |
| `mask_transform.js` | マスクの剛体変換（平行移動＋回転）の純関数（逆ワープ・回転ハンドル位置算出, node でテスト可能） |
| `app.js` | UI・入出力・状態管理・IndexedDB・ZIP出力／取り込み・前マスクコピー |
| `test_brush.js` | `brush.js` の node 単体テスト（`node test_brush.js`） |
| `test_mask_io.js` | `mask_io.js` の node 単体テスト（`node test_mask_io.js`） |
| `test_mask_transform.js` | `mask_transform.js` の node 単体テスト（`node test_mask_transform.js`） |

## 開発・テスト

```bash
node test_brush.js          # ブラシコアの単体テスト
python3 -m http.server 8000 # ローカル確認（http://localhost:8000）
```

## ライセンス / 注意

汎用のブラシ注釈コードのみを含み、研究データや秘密情報は含まない。
GitHub Pages（public）で配信。
