/*
 * wing_ellipse.js — 翼の 1/4 楕円マスク（共役直径モデル）の純ロジック。
 *
 * 親リポ image_processing の annotation/wing.py: quarter_ellipse_mask を JS 移植したもの。
 * DOM 非依存なので node で単体テストできる（test_wing_ellipse.js）。
 *
 * 3点 center / tip / trailing から:
 *   d1 = tip - center, d2 = trailing - center を共役半径とみなし、
 *   M = [d1 d2]（列が d1,d2）, (u,v) = M^{-1}(P - center) として
 *   u>=0 && v>=0 && u*u+v*v<=1 を内部とする（射影で歪んだ1/4楕円）。
 * 3点が退化（一直線, |det|<1e-6）なら空マスク。
 */
(function (global) {
  'use strict';

  const POINT_ORDER = ['center', 'tip', 'trailing'];

  /**
   * W×H グリッドの 1/4 楕円塗りつぶしマスク（Uint8Array, 1=内部）を返す。
   * center/tip/trailing は [x, y]（画像座標）。
   */
  function quarterEllipseMask(W, H, center, tip, trailing) {
    const out = new Uint8Array(W * H);
    const cx = center[0], cy = center[1];
    const d1x = tip[0] - cx, d1y = tip[1] - cy;
    const d2x = trailing[0] - cx, d2y = trailing[1] - cy;
    // M = [[d1x, d2x], [d1y, d2y]]  →  det = d1x*d2y - d2x*d1y
    const det = d1x * d2y - d2x * d1y;
    if (Math.abs(det) < 1e-6) return out;   // 退化（3点が一直線）→ 空マスク
    // Minv = (1/det)[[d2y, -d2x], [-d1y, d1x]]
    const ia = d2y / det, ib = -d2x / det;
    const ic = -d1y / det, id = d1x / det;
    for (let y = 0; y < H; y++) {
      const ry = y - cy;
      for (let x = 0; x < W; x++) {
        const rx = x - cx;
        const u = ia * rx + ib * ry;
        const v = ic * rx + id * ry;
        if (u >= 0 && v >= 0 && u * u + v * v <= 1.0) out[y * W + x] = 1;
      }
    }
    return out;
  }

  /** {center,tip,trailing} の3点が揃っていればマスク、未満なら空マスク。 */
  function maskFromPoints(W, H, pts) {
    if (POINT_ORDER.every((k) => pts[k] != null)) {
      return quarterEllipseMask(W, H, pts.center, pts.tip, pts.trailing);
    }
    return new Uint8Array(W * H);
  }

  const api = { POINT_ORDER, quarterEllipseMask, maskFromPoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.WingEllipse = api;
})(typeof window !== 'undefined' ? window : globalThis);
