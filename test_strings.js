/*
 * test_strings.js — strings.js (UI strings / changelog) node tests.
 * Run: node test_strings.js
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { STRINGS, CHANGELOG } = require('./strings.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok -', name); }

const COMMON = ['c.settings', 'c.close', 'c.language', 'c.share', 'c.showQr', 'c.changelog',
  'c.showChangelog', 'c.otherApps', 'c.openPortal', 'c.data', 'c.clearData', 'c.fullscreen',
  'c.clearConfirm'];

test('ja and en have the same keys', () => {
  const ja = Object.keys(STRINGS.ja).sort();
  const en = Object.keys(STRINGS.en).sort();
  assert.deepStrictEqual(ja.filter((k) => !en.includes(k)), [], 'missing in en');
  assert.deepStrictEqual(en.filter((k) => !ja.includes(k)), [], 'missing in ja');
});

test('no empty strings', () => {
  for (const lang of ['ja', 'en']) {
    for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(typeof v === 'string' && v.length, lang + ':' + k);
  }
});

test('common c.* keys exist with the shared wording', () => {
  for (const k of COMMON) { assert.ok(STRINGS.ja[k], 'ja ' + k); assert.ok(STRINGS.en[k], 'en ' + k); }
  assert.strictEqual(STRINGS.ja['c.showQr'], 'QR コードを表示');
  assert.strictEqual(STRINGS.en['c.showQr'], 'Show QR codes');
  assert.strictEqual(STRINGS.ja['c.clearData'], '保存データを消す');
  assert.strictEqual(STRINGS.en['c.openPortal'], 'Open app list');
});

test('placeholders match between ja and en', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of Object.keys(STRINGS.ja)) assert.strictEqual(ph(STRINGS.ja[k]), ph(STRINGS.en[k]), k);
});

test('every data-i18n* key in index.html exists', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const re = /data-i18n(?:-html|-title|-aria-label|-placeholder)?="([^"]+)"/g;
  let m; let n = 0;
  while ((m = re.exec(html))) { n++; assert.ok(STRINGS.ja[m[1]] !== undefined, 'missing key ' + m[1]); }
  assert.ok(n > 20);
});

test('every setStatus/t() key in app.js exists', () => {
  const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const re = /(?:setStatus\(|\bt\(|\?\s*|:\s*)'((?:st|c\.)[A-Za-z.]+|copyConfirm|clearBlocked|bgSet|bgNone|chromeShow|chromeHide)'/g;
  let m; let n = 0;
  while ((m = re.exec(js))) { n++; assert.ok(STRINGS.ja[m[1]] !== undefined, 'missing key ' + m[1]); }
  assert.ok(n > 40, 'found only ' + n);
});

test('CHANGELOG: newest first, first entry matches APP_VERSION, bilingual', () => {
  const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const v = js.match(/const APP_VERSION = '([^']+)'/)[1];
  assert.strictEqual(CHANGELOG[0].version, v);
  for (const e of CHANGELOG) {
    assert.match(e.version, /^\d+\.\d+\.\d+$/);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.items.length);
    for (const it of e.items) assert.ok(it.ja && it.en);
  }
  for (let i = 1; i < CHANGELOG.length; i++) assert.ok(CHANGELOG[i - 1].date >= CHANGELOG[i].date);
});

console.log(`test_strings.js: ${passed} passed`);
