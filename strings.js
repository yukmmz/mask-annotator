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
      'c.clearData': '保存データを消す', 'c.fullscreen': '全画面表示',
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
      // stage
      hint: '「画像を読込」でキーフレーム(frame_*.png)と背景を選択。<br />Apple Pencilで描画 / 指でズーム・移動。',
      chromeHide: '隠す ▲', chromeShow: 'メニュー ▼',

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
      'c.clearData': 'Clear saved data', 'c.fullscreen': 'Full screen',
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
      hint: 'Choose key frames (frame_*.png) with “Load images”, then a background.<br />Draw with Apple Pencil / zoom and pan with fingers.',
      chromeHide: 'Hide ▲', chromeShow: 'Menu ▼',

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
