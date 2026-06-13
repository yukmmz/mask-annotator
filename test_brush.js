// node test_brush.js — brush.js コアの単体テスト
const B = require('./brush.js');

function assert(c, msg) { if (!c) { console.error('FAIL: ' + msg); process.exit(1); } }

const W = 100, H = 100;
const idx = (x, y) => y * W + x;

// diff: 中央 [30..70)x[30..70) に 200 の塊
const diff = new Uint8Array(W * H);
for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) diff[idx(x, y)] = 200;

// stroke: 中央 [45..55) をなぞる
const stroke = new Uint8Array(W * H);
for (let y = 45; y < 55; y++) for (let x = 45; x < 55; x++) stroke[idx(x, y)] = 1;

// reach 大 → 似た差分の塊全体へ広がる
const sel = B.selectRegion(diff, stroke, W, H, 50, 20);
let inBlob = 0, total = 0;
for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) { total++; if (sel[idx(x, y)]) inBlob++; }
assert(inBlob / total > 0.9, 'reach大で塊を拾えていない (' + inBlob + '/' + total + ')');
let outside = 0;
for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (sel[idx(x, y)]) outside++;
assert(outside === 0, '離れた領域を誤って拾った');
console.log('[1] selectRegion reach=50 OK (' + inBlob + '/' + total + ' in blob)');

// reach=0 → 塗った所＋内側の穴のみ（拡張なし）
const sel0 = B.selectRegion(diff, stroke, W, H, 0, 20);
let only = true;
for (let i = 0; i < sel0.length; i++) if (sel0[i] && !stroke[i]) only = false;
assert(only, 'reach=0 なのに stroke 外へ広がった');
console.log('[2] selectRegion reach=0 OK (塗った所のみ)');

// fillHoles: ドーナツの穴が埋まるか
const ring = new Uint8Array(W * H);
for (let y = 20; y < 60; y++) for (let x = 20; x < 60; x++) {
  const edge = (x < 25 || x >= 55 || y < 25 || y >= 55);
  if (edge) ring[idx(x, y)] = 1;
}
const filled = B.fillHoles(ring, W, H);
assert(filled[idx(40, 40)] === 1, '内側の穴が埋まっていない');
assert(filled[idx(5, 5)] === 0, '外側まで塗ってしまった');
console.log('[3] fillHoles OK');

// distanceL1: 正しい L1 距離
const s2 = new Uint8Array(W * H); s2[idx(50, 50)] = 1;
const d = B.distanceL1(s2, W, H);
assert(d[idx(50, 50)] === 0 && d[idx(53, 50)] === 3 && d[idx(50, 54)] === 4 && d[idx(53, 54)] === 7,
  'L1 距離が誤り');
console.log('[4] distanceL1 OK');

console.log('\nALL BRUSH TESTS PASSED');
