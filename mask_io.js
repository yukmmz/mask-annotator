/*
 * mask_io.js — マスクZIPの取り込み（再開）用の純関数。
 *
 * DOM / JSZip 非依存なので node で単体テストできる（test_mask_io.js）。
 * 画像のデコード・リサイズ・IndexedDB 書込は DOM 依存のため app.js 側に置く。
 *
 * 出力フォーマット契約（annotate_robot_mask.py / app.js の exportZip と同一）:
 *   manifest_<object>.json:
 *     { "object": "robot", "long_side": 1600, "mask_size_hw": [H, W],
 *       "frames": [ { "file": "frame_000030.png",
 *                     "mask": "frame_000030_robot_mask.png", "has_mask": true }, ... ] }
 *   マスク PNG は 255=対象 / 0=背景。取り込みはこの逆操作。
 */
(function (global) {
  'use strict';

  /**
   * manifest_<object>.json の文字列を検証付きでパースする。
   * 形式が不正なら例外を投げる（呼び出し側で setStatus 表示して中止）。
   */
  function parseManifest(text) {
    let m;
    try { m = JSON.parse(text); } catch (e) { throw new Error('manifestのJSONが壊れています'); }
    if (!m || typeof m.object !== 'string' || !Array.isArray(m.frames)) {
      throw new Error('manifest形式が不正（object / frames が無い）');
    }
    const frames = m.frames.map((f) => {
      if (!f || typeof f.file !== 'string' || typeof f.mask !== 'string') {
        throw new Error('manifest.frames の要素に file / mask がありません');
      }
      return { file: f.file, mask: f.mask, has_mask: !!f.has_mask };
    });
    return {
      object: m.object,
      long_side: m.long_side,
      mask_size_hw: m.mask_size_hw,
      frames,
    };
  }

  /**
   * デコード済み RGBA バイト列（長さ n*4）を 0/1 の2値マスクへ。
   * マスクPNGはグレースケール(255/0)なので赤チャンネルをしきい値判定する。
   */
  function thresholdToMask(rgba, n, thr) {
    const t = (thr == null) ? 127 : thr;
    const out = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = rgba[j] > t ? 1 : 0;
    return out;
  }

  const api = { parseManifest, thresholdToMask };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MaskIO = api;
})(typeof window !== 'undefined' ? window : globalThis);
