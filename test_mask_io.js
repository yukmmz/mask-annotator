/*
 * test_mask_io.js — mask_io.js（manifest解析・2値化）の node 単体テスト。
 * 実行: node test_mask_io.js
 */
'use strict';
const assert = require('assert');
const { parseManifest, thresholdToMask } = require('./mask_io.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }

// ── parseManifest ───────────────────────────────────────────
test('valid manifest parses object/frames', () => {
  const m = parseManifest(JSON.stringify({
    object: 'robot', long_side: 1600, mask_size_hw: [900, 1600],
    frames: [
      { file: 'frame_000030.png', mask: 'frame_000030_robot_mask.png', has_mask: true },
      { file: 'frame_000060.png', mask: 'frame_000060_robot_mask.png', has_mask: false },
    ],
  }));
  assert.strictEqual(m.object, 'robot');
  assert.strictEqual(m.long_side, 1600);
  assert.strictEqual(m.frames.length, 2);
  assert.strictEqual(m.frames[0].file, 'frame_000030.png');
  assert.strictEqual(m.frames[0].has_mask, true);
  assert.strictEqual(m.frames[1].has_mask, false);
});

test('missing has_mask coerces to false', () => {
  const m = parseManifest(JSON.stringify({
    object: 'box', frames: [{ file: 'a.png', mask: 'a_box_mask.png' }],
  }));
  assert.strictEqual(m.frames[0].has_mask, false);
});

test('broken JSON throws', () => {
  assert.throws(() => parseManifest('{not json'), /JSON/);
});

test('missing object throws', () => {
  assert.throws(() => parseManifest(JSON.stringify({ frames: [] })), /不正/);
});

test('frame without file/mask throws', () => {
  assert.throws(
    () => parseManifest(JSON.stringify({ object: 'robot', frames: [{ file: 'a.png' }] })),
    /file \/ mask/,
  );
});

// ── thresholdToMask ─────────────────────────────────────────
test('threshold: 255->1, 0->0, default thr=127', () => {
  // 2画素: 白(255) と 黒(0)
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  const mask = thresholdToMask(rgba, 2);
  assert.strictEqual(mask.length, 2);
  assert.strictEqual(mask[0], 1);
  assert.strictEqual(mask[1], 0);
});

test('threshold: boundary uses > thr (128->1, 127->0)', () => {
  const rgba = new Uint8ClampedArray([128, 128, 128, 255, 127, 127, 127, 255]);
  const mask = thresholdToMask(rgba, 2, 127);
  assert.strictEqual(mask[0], 1);
  assert.strictEqual(mask[1], 0);
});

console.log(`\n${passed} tests passed.`);
