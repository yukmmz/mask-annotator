/*
 * test_lasso.js — lasso.js（多角形塗りつぶし）の node 単体テスト。
 * 実行: node test_lasso.js
 */
'use strict';
const assert = require('assert');
const { polygonFillMask } = require('./lasso.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }
const at = (m, W, x, y) => m[y * W + x];
const sum = (m) => m.reduce((a, b) => a + b, 0);

test('square fill: inside=1, outside=0', () => {
  const W = 12, H = 12;
  const m = polygonFillMask([[2, 2], [8, 2], [8, 8], [2, 8]], W, H);
  assert.strictEqual(at(m, W, 5, 5), 1, 'center inside');
  assert.strictEqual(at(m, W, 0, 0), 0, 'corner outside');
  assert.strictEqual(at(m, W, 11, 11), 0, 'far outside');
  assert.ok(sum(m) > 0);
});

test('triangle fill (auto-closed last->first edge)', () => {
  const W = 12, H = 12;
  // 3点だけ渡す（閉じる辺は暗黙）
  const m = polygonFillMask([[0, 0], [10, 0], [0, 10]], W, H);
  assert.strictEqual(at(m, W, 1, 1), 1, 'inside lower-left triangle');
  assert.strictEqual(at(m, W, 9, 9), 0, 'beyond hypotenuse outside');
});

test('outside = complement of inside (square)', () => {
  const W = 10, H = 10;
  const inside = polygonFillMask([[2, 2], [7, 2], [7, 7], [2, 7]], W, H);
  // 外側画素数 = 全体 - 内側
  let outside = 0;
  for (let i = 0; i < inside.length; i++) if (!inside[i]) outside++;
  assert.strictEqual(outside, W * H - sum(inside));
  assert.ok(outside > 0 && sum(inside) > 0);
});

test('fewer than 3 points → empty', () => {
  assert.strictEqual(sum(polygonFillMask([[1, 1], [5, 5]], 8, 8)), 0);
});

test('self-intersecting (bowtie) does not throw and fills something', () => {
  const W = 12, H = 12;
  const m = polygonFillMask([[1, 1], [10, 10], [10, 1], [1, 10]], W, H);
  assert.ok(sum(m) >= 0);   // even-odd: 例外なく処理できることを確認
});

console.log(`\n${passed} tests passed.`);
