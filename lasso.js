/*
 * lasso.js — なげなわ（自由曲線）で囲んだ多角形の塗りつぶしマスク（純関数）。
 *
 * DOM 非依存なので node で単体テストできる（test_lasso.js）。
 * 「囲んだ範囲の外側を ADD/REMOVE」する機能で使う（外側 = このマスクの補集合）。
 *
 * pts: [[x,y], ...]（画像座標, float可）。終点→始点の辺で暗黙に閉じる（自動クローズ）。
 * even-odd（偶奇）規則のスキャンライン塗り。自己交差にも耐える。
 */
(function (global) {
  'use strict';

  /** pts で囲まれた多角形内部を 1 にした Uint8Array(W*H) を返す（3点未満は空）。 */
  function polygonFillMask(pts, W, H) {
    const out = new Uint8Array(W * H);
    const n = pts.length;
    if (n < 3) return out;
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5;                 // 画素中心の y で走査
      const xs = [];
      let j = n - 1;
      for (let i = 0; i < n; i++) {
        const yi = pts[i][1], yj = pts[j][1];
        // 辺 (j→i) が走査線 yc を跨ぐか（半開区間で重複カウントを防ぐ）
        if ((yi <= yc && yj > yc) || (yj <= yc && yi > yc)) {
          const t = (yc - yi) / (yj - yi);
          xs.push(pts[i][0] + t * (pts[j][0] - pts[i][0]));
        }
        j = i;
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        let x0 = Math.ceil(xs[k] - 0.5);          // 画素中心 x+0.5 が区間内なら塗る
        let x1 = Math.floor(xs[k + 1] - 0.5);
        if (x0 < 0) x0 = 0;
        if (x1 > W - 1) x1 = W - 1;
        for (let x = x0; x <= x1; x++) out[y * W + x] = 1;
      }
    }
    return out;
  }

  const api = { polygonFillMask };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Lasso = api;
})(typeof window !== 'undefined' ? window : globalThis);
