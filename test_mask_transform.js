/*
 * test_mask_transform.js — mask_transform.js（剛体変換）の node 単体テスト。
 * 実行: node test_mask_transform.js
 */
'use strict';
const assert = require('assert');
const { bboxCenter, transformMask, handlePoint, angleFromPointer } = require('./mask_transform.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }

// 小さなテスト用マスクを作る（W×H, 指定画素を1に）
function mk(W, H, pts) {
  const m = new Uint8Array(W * H);
  for (const [x, y] of pts) m[y * W + x] = 1;
  return m;
}
function setPixels(mask, W) {
  const out = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) out.push([i % W, (i / W) | 0]);
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

// ── bboxCenter ──────────────────────────────────────────────
test('bboxCenter of a 2x2 block', () => {
  // (1,1),(2,1),(1,2),(2,2) → bbox [1..2]x[1..2], center=(2,2)（+1の右下基準）
  const m = mk(5, 5, [[1, 1], [2, 1], [1, 2], [2, 2]]);
  const b = bboxCenter(m, 5, 5);
  assert.strictEqual(b.cx, 2);
  assert.strictEqual(b.cy, 2);
  assert.strictEqual(b.minx, 1);
  assert.strictEqual(b.miny, 1);
  assert.strictEqual(b.empty, false);
});

test('bboxCenter of empty mask → image center', () => {
  const b = bboxCenter(new Uint8Array(4 * 6), 4, 6);
  assert.strictEqual(b.cx, 2);
  assert.strictEqual(b.cy, 3);
  assert.strictEqual(b.empty, true);
});

// ── transformMask ───────────────────────────────────────────
test('identity transform preserves mask', () => {
  const m = mk(5, 5, [[1, 1], [2, 1], [2, 2]]);
  const out = transformMask(m, 5, 5, 5, 5, 2, 2, 0, 0, 0);
  assert.deepStrictEqual(setPixels(out, 5), setPixels(m, 5));
});

test('pure translation (+1,+1)', () => {
  const m = mk(6, 6, [[1, 1], [2, 1]]);
  const out = transformMask(m, 6, 6, 6, 6, 0, 0, 1, 1, 0);
  assert.deepStrictEqual(setPixels(out, 6), [[2, 2], [3, 2]]);
});

test('90deg rotation about pivot maps right-of-pivot to below-pivot', () => {
  // pivot=(3,3). 点 (4,3) は pivot の右。+90°(時計回り, y下向き)で pivot の下 (3,4) へ。
  const m = mk(7, 7, [[4, 3]]);
  const out = transformMask(m, 7, 7, 7, 7, 3, 3, 0, 0, Math.PI / 2);
  assert.deepStrictEqual(setPixels(out, 7), [[3, 4]]);
});

test('180deg rotation about pivot is point reflection', () => {
  const m = mk(7, 7, [[4, 3]]);   // pivot=(3,3) の右1 → 左1 (2,3)
  const out = transformMask(m, 7, 7, 7, 7, 3, 3, 0, 0, Math.PI);
  assert.deepStrictEqual(setPixels(out, 7), [[2, 3]]);
});

// ── handlePoint / angleFromPointer ──────────────────────────
test('handlePoint sits above pivot at angle 0', () => {
  // pivot=(10,10), top=5, gap=4 → 基準 (10,1)。angle0,t0 → そのまま。
  const h = handlePoint(10, 10, 5, 4, 0, 0, 0);
  assert.strictEqual(Math.round(h.x), 10);
  assert.strictEqual(Math.round(h.y), 1);
});

test('handlePoint follows translation', () => {
  const h = handlePoint(10, 10, 5, 4, 3, -2, 0);
  assert.strictEqual(Math.round(h.x), 13);
  assert.strictEqual(Math.round(h.y), -1);
});

test('angleFromPointer: pointer directly above pivot → angle 0', () => {
  // pivot+t = (10,10). 真上の点 (10,0) → 基準(-90°)と一致 → 相対角 0
  const a = angleFromPointer(10, 10, 0, 0, 10, 0);
  assert.ok(Math.abs(a) < 1e-9, `expected ~0, got ${a}`);
});

test('angleFromPointer: pointer to the right → +90deg', () => {
  // 真右 (20,10) は基準(真上)から時計回りに +90°
  const a = angleFromPointer(10, 10, 0, 0, 20, 10);
  assert.ok(Math.abs(a - Math.PI / 2) < 1e-9, `expected ~pi/2, got ${a}`);
});

console.log(`\n${passed} tests passed.`);
