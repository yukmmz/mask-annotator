/*
 * mask_transform.js — マスクの剛体変換（平行移動＋回転）の純関数。
 *
 * DOM 非依存なので node で単体テストできる（test_mask_transform.js）。
 * 「前フレームのマスクをコピーして移動/回転」機能で使う。
 *
 * 座標系: 画像座標（x=列, y=行, index = y*W + x）。角度はラジアン、時計回りが正
 * （canvas の rotate と同符号 = y下向き座標で正方向）。
 *
 * 変換の定義（pivot を中心に angle 回転し、(tx,ty) 平行移動）:
 *   out = R(angle)·(src - pivot) + pivot + (tx, ty)
 *   R(a) = [[cos, -sin], [sin, cos]]
 * これは canvas の translate(pivot+t)→rotate(a)→translate(-pivot)→drawImage と一致する。
 */
(function (global) {
  'use strict';

  /** マスクの bounding box の中心（回転ピボットの既定値）。マスクが空なら画像中心。 */
  function bboxCenter(mask, W, H) {
    let minx = W, miny = H, maxx = -1, maxy = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (mask[y * W + x]) {
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
      }
    }
    if (maxx < 0) return { cx: W / 2, cy: H / 2, minx: 0, miny: 0, maxx: W, maxy: H, empty: true };
    return { cx: (minx + maxx + 1) / 2, cy: (miny + maxy + 1) / 2, minx, miny, maxx, maxy, empty: false };
  }

  /**
   * src マスク(sw×sh) を剛体変換して dst グリッド(dw×dh)へ最近傍でラスタ化する。
   * 逆ワープ（出力画素ごとに入力をサンプル）なので穴が空かない。返り値は 0/1 の Uint8Array。
   */
  function transformMask(src, sw, sh, dw, dh, pivotX, pivotY, tx, ty, angle) {
    const out = new Uint8Array(dw * dh);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // inverse: src = R(-a)·(out - pivot - t) + pivot
    //   R(-a) = [[cos, sin], [-sin, cos]]
    for (let oy = 0; oy < dh; oy++) {
      for (let ox = 0; ox < dw; ox++) {
        const dx = ox - pivotX - tx;
        const dy = oy - pivotY - ty;
        const sx = cos * dx + sin * dy + pivotX;
        const sy = -sin * dx + cos * dy + pivotY;
        const ix = Math.round(sx), iy = Math.round(sy);
        if (ix >= 0 && iy >= 0 && ix < sw && iy < sh && src[iy * sw + ix]) {
          out[oy * dw + ox] = 1;
        }
      }
    }
    return out;
  }

  /**
   * 回転ハンドルの位置（画像座標）。pivot から「マスク上端より handleGap px 上」に出した点を、
   * 現在の angle / 平行移動に合わせて回転・移動した座標を返す。
   * top はマスク bbox の上端 y（bboxCenter の miny）。
   */
  function handlePoint(pivotX, pivotY, top, handleGap, tx, ty, angle) {
    // ハンドルの基準点（変換前）: pivot の真上、bbox 上端からさらに handleGap 上
    const baseX = pivotX;
    const baseY = top - handleGap;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = baseX - pivotX, dy = baseY - pivotY;
    return {
      x: cos * dx - sin * dy + pivotX + tx,
      y: sin * dx + cos * dy + pivotY + ty,
    };
  }

  /**
   * ドラッグ中の回転角を求める。ハンドルの基準方向（pivot の真上 = -90°）を 0 とし、
   * 現在のポインタ位置 (px,py) が pivot+t に対してなす角から、その基準分を引いた相対角を返す。
   */
  function angleFromPointer(pivotX, pivotY, tx, ty, px, py) {
    // 回転中心は平行移動後の pivot
    const cx = pivotX + tx, cy = pivotY + ty;
    const cur = Math.atan2(py - cy, px - cx);
    const base = -Math.PI / 2;   // 真上方向
    return cur - base;
  }

  const api = { bboxCenter, transformMask, handlePoint, angleFromPointer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MaskTransform = api;
})(typeof window !== 'undefined' ? window : globalThis);
