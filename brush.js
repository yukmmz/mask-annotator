/*
 * brush.js — annotate_robot_mask.py の select_region 相当を JS へ移植したコア。
 *
 * すべて純関数（DOM 非依存）なので node でも単体テストできる。
 * mask / stroke / diff はすべて長さ W*H の TypedArray（行優先, index = y*W + x）。
 *
 * select_region の手順（Python 版と同じ）:
 *   1. なぞった画素(stroke)から L1 距離 reach px 以内を「到達範囲」とする
 *   2. その中で |diff - median(diff[stroke])| <= similarity の画素を候補に
 *   3. stroke と 8 近傍で連結した塊だけ残す（離れたごま塩を除外）
 *   4. 内部の空洞を埋める
 */
(function (global) {
  'use strict';

  /** diff = 各チャンネル |frame - bg| の最大値（0..255, Uint8）。 */
  function computeDiff(frameData, bgData) {
    const n = frameData.width * frameData.height;
    const f = frameData.data, b = bgData.data;
    const out = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const dr = Math.abs(f[j] - b[j]);
      const dg = Math.abs(f[j + 1] - b[j + 1]);
      const db = Math.abs(f[j + 2] - b[j + 2]);
      let m = dr > dg ? dr : dg;
      if (db > m) m = db;
      out[i] = m;
    }
    return out;
  }

  /** stroke=1 の画素からの厳密 L1（マンハッタン）距離変換（2-pass chamfer）。 */
  function distanceL1(stroke, W, H) {
    const INF = 1 << 28;
    const dist = new Int32Array(W * H);
    for (let i = 0; i < dist.length; i++) dist[i] = stroke[i] ? 0 : INF;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let d = dist[i];
        if (x > 0 && dist[i - 1] + 1 < d) d = dist[i - 1] + 1;
        if (y > 0 && dist[i - W] + 1 < d) d = dist[i - W] + 1;
        dist[i] = d;
      }
    }
    for (let y = H - 1; y >= 0; y--) {
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        let d = dist[i];
        if (x < W - 1 && dist[i + 1] + 1 < d) d = dist[i + 1] + 1;
        if (y < H - 1 && dist[i + W] + 1 < d) d = dist[i + W] + 1;
        dist[i] = d;
      }
    }
    return dist;
  }

  function medianOfStroke(diff, stroke) {
    const vals = [];
    for (let i = 0; i < stroke.length; i++) if (stroke[i]) vals.push(diff[i]);
    if (!vals.length) return 0;
    vals.sort((a, b) => a - b);
    const m = vals.length >> 1;
    return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  }

  /** candidate のうち stroke と 8 近傍で連結した塊だけを 1 にして返す。 */
  function connectedToStroke(candidate, stroke, W, H) {
    const out = new Uint8Array(W * H);
    const stack = [];
    for (let i = 0; i < stroke.length; i++) {
      if (stroke[i] && candidate[i] && !out[i]) { out[i] = 1; stack.push(i); }
    }
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (candidate[j] && !out[j]) { out[j] = 1; stack.push(j); }
        }
      }
    }
    return out;
  }

  /** 内部の空洞を埋める（外周から 4 近傍で到達できない背景を mask に含める）。 */
  function fillHoles(mask, W, H) {
    const outside = new Uint8Array(W * H);
    const stack = [];
    const pushIf = (i) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { pushIf(x); pushIf((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { pushIf(y * W); pushIf(y * W + W - 1); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      if (x > 0) pushIf(i - 1);
      if (x < W - 1) pushIf(i + 1);
      if (y > 0) pushIf(i - W);
      if (y < H - 1) pushIf(i + W);
    }
    const out = new Uint8Array(W * H);
    for (let i = 0; i < out.length; i++) out[i] = (mask[i] || !outside[i]) ? 1 : 0;
    return out;
  }

  /**
   * 賢いブラシ本体。diff が無い（背景未読込）場合は呼び出し側で fillHoles(stroke)
   * にフォールバックすること（拡張なし＝塗った所＋内側の穴だけ）。
   */
  function selectRegion(diff, stroke, W, H, reach, similarity) {
    let any = false;
    for (let i = 0; i < stroke.length; i++) if (stroke[i]) { any = true; break; }
    if (!any) return new Uint8Array(W * H);

    const dist = distanceL1(stroke, W, H);
    const ref = medianOfStroke(diff, stroke);
    const candidate = new Uint8Array(W * H);
    for (let i = 0; i < candidate.length; i++) {
      if (stroke[i]) { candidate[i] = 1; continue; }
      if (dist[i] <= reach && Math.abs(diff[i] - ref) <= similarity) candidate[i] = 1;
    }
    const connected = connectedToStroke(candidate, stroke, W, H);
    return fillHoles(connected, W, H);
  }

  const api = {
    computeDiff, distanceL1, medianOfStroke,
    connectedToStroke, fillHoles, selectRegion,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MaskBrush = api;
})(typeof window !== 'undefined' ? window : globalThis);
