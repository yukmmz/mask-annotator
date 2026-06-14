/*
 * test_linkseed.js — linkseed.js（白リンク自動シード）の node 単体テスト。
 * 実行: node test_linkseed.js
 */
'use strict';
const assert = require('assert');
const { candidateMask, erode, dilate, areaFilter, linkSeedFromDiff, SE } = require('./linkseed.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }
const sum = (m) => m.reduce((a, b) => a + b, 0);

// rgba を作る（[ [r,g,b], ... ] の順）
function mkRGBA(pixels) {
  const out = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => { out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; out[i * 4 + 3] = 255; });
  return out;
}

// ── candidateMask ───────────────────────────────────────────
test('candidate: white+moving kept; yellow/dark/static dropped', () => {
  // 4画素: 白(動), 黄(動), 暗(動), 白(静)
  const rgba = mkRGBA([[200, 200, 200], [200, 200, 50], [50, 50, 50], [200, 200, 200]]);
  const diff = Uint8Array.from([100, 100, 100, 10]);
  const m = candidateMask(rgba, diff, 4, 1, 45, 110, 35);
  assert.strictEqual(m[0], 1, 'white+moving → keep');
  assert.strictEqual(m[1], 0, 'yellow → drop');
  assert.strictEqual(m[2], 0, 'dark → drop');
  assert.strictEqual(m[3], 0, 'static (diff<=motion) → drop');
});

// ── SE shape ────────────────────────────────────────────────
test('SE is the 5x5 ellipse (17 ones)', () => {
  assert.strictEqual(SE.length, 17);
});

// ── erode / dilate ──────────────────────────────────────────
test('erode of all-ones stays all-ones (border ignored)', () => {
  const W = 7, H = 7; const m = new Uint8Array(W * H).fill(1);
  assert.strictEqual(sum(erode(m, W, H)), W * H);
});

test('erode of single pixel → empty; dilate of single pixel → 17 SE cells', () => {
  const W = 11, H = 11; const m = new Uint8Array(W * H);
  m[5 * W + 5] = 1;
  assert.strictEqual(sum(erode(m, W, H)), 0, 'isolated pixel erodes away');
  const d = dilate(m, W, H);
  assert.strictEqual(sum(d), SE.length, 'dilate stamps the SE');
  assert.strictEqual(d[5 * W + 5], 1, 'center set');
  assert.strictEqual(d[(5 - 2) * W + 5], 1, 'top tip set (0,-2)');
});

// ── areaFilter ──────────────────────────────────────────────
test('areaFilter removes small components, keeps large (8-conn)', () => {
  const W = 12, H = 3; const m = new Uint8Array(W * H);
  // 大きい塊（左上 3x3=9px）
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) m[y * W + x] = 1;
  // 孤立スペック（右側 1px）
  m[1 * W + 10] = 1;
  const out = areaFilter(m, W, H, 5);
  assert.strictEqual(out[0], 1, 'large kept');
  assert.strictEqual(out[1 * W + 10], 0, 'speck removed');
  assert.strictEqual(sum(out), 9);
});

test('areaFilter with minArea<=0 is identity', () => {
  const W = 5, H = 1; const m = Uint8Array.from([1, 0, 1, 0, 0]);
  assert.strictEqual(sum(areaFilter(m, W, H, 0)), 2);
});

// ── linkSeedFromDiff end-to-end ─────────────────────────────
test('linkSeedFromDiff keeps a solid white block, drops a tiny speck', () => {
  const W = 20, H = 20; const px = [];
  const diff = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inBlock = (x >= 6 && x < 14 && y >= 6 && y < 14);  // 8x8 白ブロック
    px.push(inBlock ? [220, 220, 220] : [0, 0, 0]);
    diff[y * W + x] = inBlock ? 120 : 0;
  }
  // 遠くに孤立スペック（白・動）
  px[2 * W + 18] = [220, 220, 220]; diff[2 * W + 18] = 120;
  const rgba = mkRGBA(px);
  const seed = linkSeedFromDiff(rgba, diff, W, H, { motion: 45, white: 110, yellow: 35, min_area: 20 });
  assert.strictEqual(seed[10 * W + 10], 1, 'block center kept');
  assert.strictEqual(seed[2 * W + 18], 0, 'speck removed by area filter');
  assert.ok(sum(seed) >= 40, 'block survives open/close');
});

console.log(`\n${passed} tests passed.`);
