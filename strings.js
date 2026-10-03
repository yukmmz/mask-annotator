/*
 * strings.js — UI strings (Japanese / English) and the user-facing changelog.
 *
 * Kept out of app.js so node can check them (test_strings.js): both languages
 * must have the same keys, and the first CHANGELOG entry must match
 * APP_VERSION in app.js. `c.*` keys are shared by every yukmmz.github.io app
 * with the same wording. Exported file names / manifest contents are NOT here:
 * they are a contract with the parent pipeline and never translated.
 */
(function (global) {
  'use strict';

  /* What changed, newest first. Written for users, in both languages. */
  const CHANGELOG = [
    { version: '1.2.0', date: '2026-10-01', items: [
      { ja: '右上に「?」ボタンを追加しました。使い方の窓が開きます（? キーでも開きます）',
        en: 'Added a "?" button at the top right that opens a "How to use" window (the ? key opens it too)' },
      { ja: '全画面表示中は、全画面ボタンが「縮小」の形に変わるようにしました',
        en: 'While in full screen, the full-screen button changes to a "shrink" icon' },
      { ja: 'アプリのアイコン（ブラウザのタブに出る絵）を付けました',
        en: 'Added an app icon (shown on the browser tab)' }
    ] },
    { version: '1.1.0', date: '2026-10-01', items: [
      { ja: 'アプリ名とバージョンを左上に表示しました。バージョンを押すと更新履歴が開きます',
        en: 'The app name and version are shown at the top left; tap the version to open this changelog' },
      { ja: '設定（⚙）を追加しました（言語・共有・更新履歴・他のアプリ・保存データを消す）',
        en: 'Added settings (⚙): language, share, changelog, other apps, and clear saved data' },
      { ja: '全画面表示ボタン（⛶）を追加しました',
        en: 'Added a full-screen button (⛶)' },
      { ja: '英語表示に対応しました（設定で切替。初回はブラウザの言語に合わせます）',
        en: 'English UI (switch in the settings; the first visit follows the browser language)' },
      { ja: 'QR コードの表示を「その他」メニューから設定（⚙）へ移しました',
        en: 'QR codes moved from the "More" menu into the settings (⚙)' }
    ] },
    { version: '1.0.0', date: '2026-06-27', items: [
      { ja: '最初のバージョン付き公開版: Apple Pencil で塗るマスク注釈（ADD/REMOVE・Undo・差分で広がる賢いブラシ）、指でズーム・移動',
        en: 'First versioned release: mask annotation with Apple Pencil (ADD/REMOVE, Undo, a smart brush that grows along the difference), zoom and pan with fingers' },
      { ja: '背景画像の読込と差分表示、対象名・pack 名（ZIP 名）の自由入力',
        en: 'Background image with a difference view; free-text object and pack (ZIP) names' },
      { ja: 'ZIP 出力と、出力済み ZIP からの再開（マスク読込）',
        en: 'ZIP export, and resuming from an exported ZIP (import masks)' },
      { ja: '前フレームのマスクをコピーして移動・回転',
        en: 'Copy the previous frame\'s mask, then move and rotate it' },
      { ja: '翼の3点楕円、Auto(link) 自動シード、外側選択（なげなわ）',
        en: 'Wing 3-point ellipse, Auto(link) seeding, and outside selection (lasso)' },
      { ja: '上部バーの折りたたみ、QR コードでの共有',
        en: 'Collapsible top bars, and sharing by QR code' }
    ] }
  ];

  const STRINGS = {
    ja: {
      'c.settings': '設定', 'c.close': '閉じる', 'c.language': '言語', 'c.share': '共有',
      'c.showQr': 'QR コードを表示', 'c.changelog': '更新履歴', 'c.showChangelog': '表示',
      'c.otherApps': '他のアプリ', 'c.openPortal': 'アプリ一覧を開く', 'c.data': 'データ',
      'c.clearData': '保存データを消す', 'c.fullscreen': '全画面表示', 'c.exitFullscreen': '全画面を終了', 'c.help': '使い方',
      'c.clearConfirm': 'このブラウザに保存されている、このアプリのデータ（作業中のマスク・言語などの設定）をすべて消して初期状態に戻します。\n' +
        'ZIP 出力していないマスクは失われ、元に戻せません。よろしいですか？',
      clearBlocked: 'このアプリを開いている別のタブがあるため、まだ消せていません。他のタブを閉じてください（閉じると消去して再読み込みします）',

      // toolbar
      loadFrames: '画像を読込', loadBg: '背景', bgNone: 'bg:なし', bgSet: 'bg:あり',
      objLabel: '対象', objPlaceholder: '必須', ok: 'OK', exportZip: 'ZIP出力',
      more: 'その他 ⋯', moreTitle: 'その他のツール',
      importMasks: 'マスク読込', packLabel: 'pack(ZIP名)', packPlaceholder: '背景から自動・手入力可',
      copyPrev: '前マスクをコピー', threePt: '3点(翼)', clear: 'Clear', showDiff: 'Diff表示',
      // quick bar
      lasso: '外側', lassoTitle: '囲んだ範囲の外側をADD/REMOVE',
      autoRun: 'Auto実行', autoApplyQ: 'Auto適用',
      // sub-bars
      transformTag: 'マスク移動/回転', apply: '確定', cancel: '取消',
      transformHint: 'Pencilでドラッグ=移動 / 上の◯ハンドルをドラッグ=回転',
      threeTag: '翼3点(楕円)', threeUndo: '1点戻す', threeClear: 'クリア',
      threeHint: '順: center → tip → trailing をタップ（点の近くからドラッグで調整可）',
      autoPinTitle: 'Auto実行/Auto適用をクイックバーに常駐', autoApply: '適用',
      prevFrame: '前の画像', nextFrame: '次の画像',
      // stage
      hint: '「画像を読込」でキーフレーム(frame_*.png)と背景を選択。<br />Apple Pencilで描画 / 指でズーム・移動。',
      chromeHide: '隠す ▲', chromeShow: 'メニュー ▼',
      // How to use window (header ? / ? key). HTML: the app's own constant text.
      help:
        '<h3>基本の流れ</h3>' +
        '<ol>' +
        '<li>「<b>画像を読込</b>」でキーフレーム（<code>frame_*.png</code> など）を複数選び、「<b>背景</b>」で背景画像（<code>background_&lt;pack&gt;.png</code>）を選びます。背景があると差分で広がる「賢いブラシ」が使えます。</li>' +
        '<li>「<b>対象</b>」に名前を入れて OK（必須。robot / box / mech / wing は候補に出ます。英数字・<code>_</code>・<code>-</code>）。未入力の間は入力欄が赤く、塗れません。</li>' +
        '<li><b>Apple Pencil で塗る</b>とマスクに追加（ADD）。<b>指</b>はピンチでズーム、ドラッグで移動です（塗りません）。</li>' +
        '<li>全フレームを塗ったら「<b>ZIP出力</b>」。<code>&lt;pack&gt;_&lt;対象&gt;_masks.zip</code> を「ファイル」に保存します。</li>' +
        '</ol>' +
        '<h3>クイックバー（2段目）</h3>' +
        '<ul>' +
        '<li><b>◀ ▶</b> フレーム移動 / <b>Fit</b> 画面に合わせる</li>' +
        '<li><b>ADD / REMOVE</b>（右端）で塗る・消すを切替。<b>Undo</b> で1手戻す。</li>' +
        '<li><b>brush</b> 太さ / <b>sim</b> 差分の似かた / <b>reach</b> 広がる距離。<b>reach=0</b> なら塗った所＋内側の穴だけ。</li>' +
        '<li><b>外側</b>: ON で Pencil で囲むと、囲んだ範囲の<b>外側</b>をまとめて ADD/REMOVE（REMOVE なら「囲んだ所だけ残す」）。</li>' +
        '<li>右上の「<b>隠す ▲</b>」で上のバーを畳んで画像を広く表示できます。</li>' +
        '</ul>' +
        '<h3>その他 ⋯ のツール</h3>' +
        '<ul>' +
        '<li><b>前マスクをコピー</b>: 前フレームのマスクを重ね、Pencil ドラッグで移動・上の ○ ハンドルで回転 →「確定」。確定後はブラシで調整できます。</li>' +
        '<li><b>3点(翼)</b>: 対象 = wing のとき、center → tip → trailing の順にタップして楕円の翼マスクを作ります。</li>' +
        '<li><b>Auto(link)</b>: 背景との差分から白いリンクを自動で拾います。スライダ調整 →「Auto実行」→「適用」。📌 でクイックバーに常駐。</li>' +
        '<li><b>Clear</b> このフレームを消去 / <b>Diff表示</b> 背景との差分を表示</li>' +
        '<li><b>マスク読込</b>: 出力済み ZIP から続きを再開（先に同じ画像と背景を読み込む）。<b>pack(ZIP名)</b> は背景のファイル名から自動で入り、手で直せます。</li>' +
        '</ul>' +
        '<h3>iPad での注意</h3>' +
        '<ul>' +
        '<li>Pencil = 描画、指 = ズーム・移動（手のひらが触れても塗りません）。</li>' +
        '<li>マスクはこの iPad のブラウザ内に自動保存され、サーバーへは送りません。別の端末へは ZIP で渡します。</li>' +
        '<li>ZIP の出力・読込にはインターネット接続が必要です。</li>' +
        '<li>「ホーム画面に追加」がおすすめ。更新が反映されないときは1〜2回再読み込みしてください。</li>' +
        '</ul>' +
        '<p class="note">キー: <kbd>?</kbd> 使い方 / <kbd>Esc</kbd> 閉じる</p>',

      // status messages
      stBusy: '編集モード中です。先に確定/取消してください',
      stBusyUndo: '編集モード中です（取消で破棄できます）',
      stLoading: '読込中...', stLoadedN: '{n}枚読込',
      stBgLoaded: '背景読込: 賢いブラシ有効',
      stNeedObject: '対象を入力してください（必須）',
      stNoImages: '画像が未読込',
      stJszipFail: 'JSZip読込失敗（オンライン要）',
      stZipBuilding: 'ZIP生成中...', stZipDone: 'ZIP出力: {n}枚にマスク',
      stImportNeedFrames: '先に「画像を読込」してください（再開は画像読込後）',
      stImportNeedPack: '先に「背景」を読み込んでpack名を確定してから取り込んでください',
      stZipParsing: 'ZIP解析中...',
      stNoManifest: 'manifestが見つかりません: {file}',
      stMissingPng: 'マスクPNGが欠落: {mask}（{file}）',
      stZipParseError: 'ZIP解析エラー: {msg}',
      stImportUnmatched: '中止: {n}件のマスクが現在の画像と未マッチ ({list})。同じキーフレームを読み込んでから再試行してください',
      stImportNothing: '取り込めるマスクがありません（has_mask が全て false）',
      stImporting: '取込中... ({n}枚)',
      stImportError: '取込エラー: {msg}',
      stImportDone: '取込完了: {n}枚 / 対象 {objects}（上書き）',
      stNoPrevFrame: '前のフレームがありません（先頭フレーム）',
      stPrevEmpty: '前フレームにマスクがありません',
      copyConfirm: 'このフレームには既にマスクがあります。\n前フレームのマスクで置き換えますか?\n（あとで Undo で戻せます）',
      stCopyAborted: 'コピーを中止しました',
      stTransform: 'Pencilでドラッグ=移動 / 上の○ハンドルをドラッグ=回転 → 確定',
      stCopyApplied: 'コピーを確定（ADD/REMOVEで調整できます）',
      stCopyCancelled: 'コピーを取消しました',
      stThreeNeedWing: '3点(翼)モードは対象=wingで使います（対象をwingに）',
      stThreeStart: '翼3点: center をPencilでタップ（順: center→tip→trailing）',
      stThreeAllPlaced: '3点配置済み（点をドラッグで調整 / 確定 / クリア）',
      stThreeNext: '次の点: {pt} をタップ',
      stThreeNextDrag: '次の点: {pt} をタップ（点の近くからドラッグで調整可）',
      stThreeDone: '3点配置完了 → 確定（点をドラッグで微調整可）',
      stThreeDoneShort: '3点配置完了 → 確定',
      stThreeCleared: '点をクリア。center からタップ',
      stThreeNeed3: '3点を配置してください',
      stThreeDegenerate: '退化した3点（一直線）。置き直してください',
      stThreeApplied: '翼楕円を確定（ADD/REMOVEで調整できます）',
      stThreeCancelled: '翼3点モードを取消しました',
      stAutoOpen: 'Auto(link): スライダ調整 →「Auto実行」で現フレームのシードを計算',
      stAutoNoBg: '背景未読込のため自動シードは使えません（背景を読み込む）',
      stAutoResult: '自動シード: {n}px（青）→「適用」でマスクに追加',
      stAutoNeedRun: '先に「Auto実行」してください',
      stAutoApplied: '自動シードを追加で適用（Undoで戻せます）',
      stAutoPinned: 'Auto実行/Auto適用をクイックバーに常駐',
      stAutoUnpinned: 'Auto常駐を解除',
      stLassoOnAdd: '外側選択ON: Pencilで囲むと外側を追加（OFFで通常ブラシ）',
      stLassoOnRemove: '外側選択ON: Pencilで囲むと外側を削除（OFFで通常ブラシ）',
      stLassoOff: '外側選択OFF',
      stLassoSmall: '範囲が小さすぎます（もっと大きく囲む）',
      stLassoEmpty: '範囲を囲めませんでした',
      stLassoAppliedAdd: '囲んだ範囲の外側を追加（Undoで戻せます）',
      stLassoAppliedRemove: '囲んだ範囲の外側を削除（Undoで戻せます）'
    },
    en: {
      'c.settings': 'Settings', 'c.close': 'Close', 'c.language': 'Language', 'c.share': 'Share',
      'c.showQr': 'Show QR codes', 'c.changelog': 'Changelog', 'c.showChangelog': 'Show',
      'c.otherApps': 'Other apps', 'c.openPortal': 'Open app list', 'c.data': 'Data',
      'c.clearData': 'Clear saved data', 'c.fullscreen': 'Full screen', 'c.exitFullscreen': 'Exit full screen', 'c.help': 'How to use',
      'c.clearConfirm': 'This deletes everything this app has saved in this browser (in-progress masks, language and other settings) and starts over.\n' +
        'Masks you have not exported as a ZIP will be lost. This cannot be undone. Continue?',
      clearBlocked: 'Another tab still has this app open, so the data is not deleted yet. Close the other tabs (this page reloads once it is done)',

      loadFrames: 'Load images', loadBg: 'Background', bgNone: 'bg: none', bgSet: 'bg: set',
      objLabel: 'Object', objPlaceholder: 'required', ok: 'OK', exportZip: 'Export ZIP',
      more: 'More ⋯', moreTitle: 'More tools',
      importMasks: 'Import masks', packLabel: 'pack (ZIP name)', packPlaceholder: 'from background, or type',
      copyPrev: 'Copy previous mask', threePt: '3-point (wing)', clear: 'Clear', showDiff: 'Show diff',
      lasso: 'Outside', lassoTitle: 'ADD/REMOVE outside the enclosed area',
      autoRun: 'Run Auto', autoApplyQ: 'Apply Auto',
      transformTag: 'Move/rotate mask', apply: 'Apply', cancel: 'Cancel',
      transformHint: 'Drag with Pencil = move / drag the ◯ handle on top = rotate',
      threeTag: 'Wing 3-point (ellipse)', threeUndo: 'Undo point', threeClear: 'Clear',
      threeHint: 'Tap in order: center → tip → trailing (drag near a point to adjust)',
      autoPinTitle: 'Pin Run Auto / Apply Auto to the quick bar', autoApply: 'Apply',
      prevFrame: 'Previous image', nextFrame: 'Next image',
      hint: 'Choose key frames (frame_*.png) with “Load images”, then a background.<br />Draw with Apple Pencil / zoom and pan with fingers.',
      chromeHide: 'Hide ▲', chromeShow: 'Menu ▼',
      help:
        '<h3>Basic workflow</h3>' +
        '<ol>' +
        '<li>Tap <b>Load images</b> and pick several key frames (e.g. <code>frame_*.png</code>), then <b>Background</b> for the background image (<code>background_&lt;pack&gt;.png</code>). With a background, the smart brush grows along the difference.</li>' +
        '<li>Type an <b>Object</b> name and tap OK (required; robot / box / mech / wing are suggested; letters, digits, <code>_</code> and <code>-</code>). Until then the field is red and you cannot paint.</li>' +
        '<li><b>Paint with Apple Pencil</b> to add to the mask (ADD). <b>Fingers</b> pinch to zoom and drag to pan; they never paint.</li>' +
        '<li>When all frames are done, tap <b>Export ZIP</b> and save <code>&lt;pack&gt;_&lt;object&gt;_masks.zip</code> to Files.</li>' +
        '</ol>' +
        '<h3>Quick bar (second row)</h3>' +
        '<ul>' +
        '<li><b>◀ ▶</b> change frame / <b>Fit</b> fit to screen</li>' +
        '<li><b>ADD / REMOVE</b> (right end) switches between painting and erasing; <b>Undo</b> takes back one step.</li>' +
        '<li><b>brush</b> size / <b>sim</b> how similar the difference must be / <b>reach</b> how far it grows. <b>reach=0</b> fills only what you painted plus holes inside it.</li>' +
        '<li><b>Outside</b>: when on, enclose an area with Pencil to ADD/REMOVE everything <b>outside</b> it (REMOVE = keep only the enclosed part).</li>' +
        '<li><b>Hide ▲</b> at the top right folds the top bars to show more of the image.</li>' +
        '</ul>' +
        '<h3>More ⋯ tools</h3>' +
        '<ul>' +
        '<li><b>Copy previous mask</b>: overlays the previous frame\'s mask; drag with Pencil to move, drag the ○ handle on top to rotate, then Apply. Fine-tune with the brush afterwards.</li>' +
        '<li><b>3-point (wing)</b>: with object = wing, tap center → tip → trailing to make an elliptical wing mask.</li>' +
        '<li><b>Auto(link)</b>: picks up the white links from the difference to the background. Adjust the sliders → Run Auto → Apply. 📌 pins it to the quick bar.</li>' +
        '<li><b>Clear</b> erases this frame / <b>Show diff</b> shows the difference to the background</li>' +
        '<li><b>Import masks</b>: resume from an exported ZIP (load the same images and background first). <b>pack (ZIP name)</b> is filled in from the background file name and can be edited.</li>' +
        '</ul>' +
        '<h3>On iPad</h3>' +
        '<ul>' +
        '<li>Pencil draws, fingers zoom and pan (a resting palm does not paint).</li>' +
        '<li>Masks are saved automatically in this iPad\'s browser and never sent to a server. Use a ZIP to move them to another device.</li>' +
        '<li>Exporting and importing ZIPs needs an internet connection.</li>' +
        '<li>"Add to Home Screen" is recommended. If an update does not show up, reload once or twice.</li>' +
        '</ul>' +
        '<p class="note">Keys: <kbd>?</kbd> how to use / <kbd>Esc</kbd> close</p>',

      stBusy: 'An edit mode is active. Apply or cancel it first',
      stBusyUndo: 'An edit mode is active (Cancel discards it)',
      stLoading: 'Loading...', stLoadedN: 'Loaded {n} images',
      stBgLoaded: 'Background loaded: smart brush enabled',
      stNeedObject: 'Enter an object name (required)',
      stNoImages: 'No images loaded',
      stJszipFail: 'JSZip failed to load (needs internet)',
      stZipBuilding: 'Building ZIP...', stZipDone: 'Exported ZIP: {n} frames with a mask',
      stImportNeedFrames: 'Load images first (resume after loading images)',
      stImportNeedPack: 'Load the background first to set the pack name, then import',
      stZipParsing: 'Reading ZIP...',
      stNoManifest: 'No manifest found: {file}',
      stMissingPng: 'Mask PNG missing: {mask} ({file})',
      stZipParseError: 'ZIP read error: {msg}',
      stImportUnmatched: 'Aborted: {n} masks do not match the loaded images ({list}). Load the same key frames and try again',
      stImportNothing: 'Nothing to import (has_mask is false everywhere)',
      stImporting: 'Importing... ({n})',
      stImportError: 'Import error: {msg}',
      stImportDone: 'Imported {n} masks / objects {objects} (overwritten)',
      stNoPrevFrame: 'No previous frame (this is the first frame)',
      stPrevEmpty: 'The previous frame has no mask',
      copyConfirm: 'This frame already has a mask.\nReplace it with the previous frame\'s mask?\n(You can Undo afterwards.)',
      stCopyAborted: 'Copy not started',
      stTransform: 'Drag with Pencil = move / drag the ○ handle on top = rotate → Apply',
      stCopyApplied: 'Copy applied (adjust with ADD/REMOVE)',
      stCopyCancelled: 'Copy cancelled',
      stThreeNeedWing: '3-point (wing) works with object = wing (set the object to wing)',
      stThreeStart: 'Wing 3-point: tap center with Pencil (order: center→tip→trailing)',
      stThreeAllPlaced: 'All 3 points placed (drag to adjust / Apply / Clear)',
      stThreeNext: 'Next point: tap {pt}',
      stThreeNextDrag: 'Next point: tap {pt} (drag near a point to adjust)',
      stThreeDone: 'All 3 points placed → Apply (drag a point to fine-tune)',
      stThreeDoneShort: 'All 3 points placed → Apply',
      stThreeCleared: 'Points cleared. Tap center first',
      stThreeNeed3: 'Place all 3 points',
      stThreeDegenerate: 'The 3 points are in a line. Place them again',
      stThreeApplied: 'Wing ellipse applied (adjust with ADD/REMOVE)',
      stThreeCancelled: 'Wing 3-point cancelled',
      stAutoOpen: 'Auto(link): adjust the sliders → “Run Auto” computes the seed for this frame',
      stAutoNoBg: 'Auto seeding needs a background (load one first)',
      stAutoResult: 'Auto seed: {n}px (blue) → “Apply” adds it to the mask',
      stAutoNeedRun: 'Run Auto first',
      stAutoApplied: 'Auto seed added to the mask (Undo to revert)',
      stAutoPinned: 'Run Auto / Apply Auto pinned to the quick bar',
      stAutoUnpinned: 'Auto unpinned',
      stLassoOnAdd: 'Outside ON: enclose an area with Pencil to add everything outside it (OFF = normal brush)',
      stLassoOnRemove: 'Outside ON: enclose an area with Pencil to remove everything outside it (OFF = normal brush)',
      stLassoOff: 'Outside OFF',
      stLassoSmall: 'The area is too small (enclose a larger one)',
      stLassoEmpty: 'Could not enclose an area',
      stLassoAppliedAdd: 'Added everything outside the enclosed area (Undo to revert)',
      stLassoAppliedRemove: 'Removed everything outside the enclosed area (Undo to revert)'
    }
  };

  const api = { CHANGELOG, STRINGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AppStrings = api;
})(typeof window !== 'undefined' ? window : globalThis);
