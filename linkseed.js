/*
 * linkseed.js — 黒背景の白リンク自動シード（LinkSeed）の純ロジック。
 *
 * 親リポ image_processing の annotation/autoseed.py: link_mask_from_diff を JS 移植したもの。
 * DOM 非依存なので node で単体テストできる（test_linkseed.js）。
 *
 * リンク = 「動いている(diff>motion) ∧ 白い(min(R,G,B)>white) ∧ 黄色でない」画素。
 * 黄色判定: (R-B>yellow) && (G-B>yellow)。半透明の黄翼はこのゲートで除外する。
 * 後処理: モルフォロジー open(5x5楕円) → close(5x5楕円, 2回) → 面積<min_area の連結成分を除去。
 *
 * 既定パラメタ（本家と同値・黒背景サンプルで調整済み）。
 */
(function (global) {
  'use strict';

  const DEFAULTS = { motion: 45, white: 110, yellow: 35, min_area: 400 };
  const PARAM_SPECS = [
    { key: 'motion', label: 'auto motion', vmin: 0, vmax: 150, step: 1 },
    { key: 'white', label: 'auto white', vmin: 0, vmax: 255, step: 1 },
    { key: 'yellow', label: 'auto yellow', vmin: 0, vmax: 120, step: 1 },
    { key: 'min_area', label: 'auto min-area', vmin: 0, vmax: 3000, step: 50 },
  ];

  // cv2.getStructuringElement(MORPH_ELLIPSE, (5,5)) と同一の構造要素（アンカー中心(2,2)）:
  //   0 0 1 0 0 / 1 1 1 1 1 / 1 1 1 1 1 / 1 1 1 1 1 / 0 0 1 0 0
  // を 1 のオフセット [dx,dy] のリストで表す。
  const SE = [
    [0, -2],
    [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    [0, 2],
  ];

  /** 候補画素（後処理前）: (diff>motion)&&(minrgb>white)&&!yellowish。rgba は長さ n*4。 */
  function candidateMask(rgba, diff, W, H, motion, white, yellow) {
    const n = W * H;
    const out = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
      const minrgb = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const yellowish = (r - b > yellow) && (g - b > yellow);
      if (diff[i] > motion && minrgb > white && !yellowish) out[i] = 1;
    }
    return out;
  }

  /** 1回の収縮（erode）。SE 全点が境界内で 1 のとき 1。境界外オフセットは無視（cv2 既定）。 */
  function erode(mask, W, H) {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let keep = 1;
        for (let s = 0; s < SE.length; s++) {
          const nx = x + SE[s][0], ny = y + SE[s][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;  // 境界外は無視
          if (!mask[ny * W + nx]) { keep = 0; break; }
        }
        if (keep) out[y * W + x] = 1;
      }
    }
    return out;
  }

  /** 1回の膨張（dilate）。SE のいずれかの境界内画素が 1 なら 1。 */
  function dilate(mask, W, H) {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let hit = 0;
        for (let s = 0; s < SE.length; s++) {
          const nx = x + SE[s][0], ny = y + SE[s][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (mask[ny * W + nx]) { hit = 1; break; }
        }
        if (hit) out[y * W + x] = 1;
      }
    }
    return out;
  }

  /** 連結成分（8近傍）のうち面積 < minArea を除去。minArea<=0 はそのまま返す。 */
  function areaFilter(mask, W, H, minArea) {
    if (minArea <= 0) return mask;
    const out = new Uint8Array(W * H);
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || seen[start]) continue;
      stack.length = 0; stack.push(start); seen[start] = 1;
      const comp = [start];
      while (stack.length) {
        const i = stack.pop();
        const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); comp.push(j); }
          }
        }
      }
      if (comp.length >= minArea) for (const p of comp) out[p] = 1;
    }
    return out;
  }

  /**
   * LinkSeed コア。本家 link_mask_from_diff と同じ手順:
   *   候補 → open(1回) → close(2回) → 面積フィルタ。返り値は 0/1 の Uint8Array。
   * close を 2回 = dilate×2 → erode×2（cv2 の morphologyEx close, iterations=2 と同義）。
   */
  function linkSeedFromDiff(rgba, diff, W, H, params) {
    const p = Object.assign({}, DEFAULTS, params || {});
    let m = candidateMask(rgba, diff, W, H, p.motion, p.white, p.yellow);
    // open(5x5) = erode → dilate
    m = dilate(erode(m, W, H), W, H);
    // close(5x5, iterations=2) = dilate×2 → erode×2
    m = dilate(dilate(m, W, H), W, H);
    m = erode(erode(m, W, H), W, H);
    m = areaFilter(m, W, H, p.min_area);
    return m;
  }

  const api = {
    DEFAULTS, PARAM_SPECS, SE,
    candidateMask, erode, dilate, areaFilter, linkSeedFromDiff,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.LinkSeed = api;
})(typeof window !== 'undefined' ? window : globalThis);
