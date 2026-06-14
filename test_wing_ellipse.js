/*
 * test_wing_ellipse.js — wing_ellipse.js（1/4楕円マスク）の node 単体テスト。
 * 実行: node test_wing_ellipse.js
 */
'use strict';
const assert = require('assert');
const { quarterEllipseMask, maskFromPoints } = require('./wing_ellipse.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }
const at = (m, W, x, y) => m[y * W + x];

// 直交ケース: center(0,0), tip(10,0), trailing(0,10) → 半径10の第1象限1/4円
test('orthogonal quarter circle: defining points and inside/outside', () => {
  const W = 15, H = 15;
  const m = quarterEllipseMask(W, H, [0, 0], [10, 0], [0, 10]);
  assert.strictEqual(at(m, W, 0, 0), 1, 'center inside');
  assert.strictEqual(at(m, W, 10, 0), 1, 'tip on boundary inside');
  assert.strictEqual(at(m, W, 0, 10), 1, 'trailing on boundary inside');
  assert.strictEqual(at(m, W, 5, 5), 1, '(5,5): 0.5<=1 inside');
  assert.strictEqual(at(m, W, 8, 8), 0, '(8,8): 1.28>1 outside');
  assert.strictEqual(at(m, W, 11, 0), 0, '(11,0): u=1.1 outside');
});

test('quarter (not full): negative quadrant excluded by u>=0,v>=0', () => {
  // center を (7,7) に置き、左/上方向（u<0 or v<0）が0になることを確認
  const W = 15, H = 15;
  const m = quarterEllipseMask(W, H, [7, 7], [7 + 5, 7], [7, 7 + 5]);
  assert.strictEqual(at(m, W, 7, 7), 1, 'center inside');
  assert.strictEqual(at(m, W, 7 + 3, 7 + 3), 1, 'first quadrant inside');
  assert.strictEqual(at(m, W, 7 - 3, 7), 0, 'left of center excluded (u<0)');
  assert.strictEqual(at(m, W, 7, 7 - 3), 0, 'above center excluded (v<0)');
});

test('sheared (non-orthogonal) conjugate radii: defining points inside', () => {
  const W = 20, H = 20;
  const m = quarterEllipseMask(W, H, [0, 0], [10, 0], [5, 10]);
  assert.strictEqual(at(m, W, 0, 0), 1);
  assert.strictEqual(at(m, W, 10, 0), 1, 'tip → (u,v)=(1,0)');
  assert.strictEqual(at(m, W, 5, 10), 1, 'trailing → (u,v)=(0,1)');
});

test('degenerate (collinear) → empty mask', () => {
  const W = 10, H = 10;
  const m = quarterEllipseMask(W, H, [0, 0], [5, 0], [10, 0]);
  assert.strictEqual(m.reduce((a, b) => a + b, 0), 0);
});

test('maskFromPoints: returns empty until all 3 present', () => {
  const W = 8, H = 8;
  assert.strictEqual(maskFromPoints(W, H, { center: [0, 0], tip: [4, 0] }).reduce((a, b) => a + b, 0), 0);
  const full = maskFromPoints(W, H, { center: [0, 0], tip: [4, 0], trailing: [0, 4] });
  assert.ok(full.reduce((a, b) => a + b, 0) > 0, 'non-empty with 3 points');
});

console.log(`\n${passed} tests passed.`);
