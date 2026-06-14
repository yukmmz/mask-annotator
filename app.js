/*
 * app.js — Mask Annotator のUI・入出力・状態管理。
 *
 * 100% クライアントサイド（静的）。画像はブラウザ内だけで処理し GitHub には送らない。
 * 出力は annotate_robot_mask.py と同一フォーマット:
 *   <frame_stem>_<object>_mask.png  +  manifest_<object>.json   （ZIPにまとめてDL）
 *   → compose_robot_gui.py --mask-dir で合成に使える。
 */
(function () {
  'use strict';

  const LONG = 1600;                 // 作業解像度の長辺（iPadメモリ対策・デスクトップ版と整合）
  const GREEN = [0, 220, 0];
  const PURPLE = [180, 0, 255];      // ADD なぞり中
  const ORANGE = [255, 140, 0];      // REMOVE なぞり中

  const $ = (id) => document.getElementById(id);

  const state = {
    frames: [],        // [{name,W,H,bitmap,diffBitmap,imgData,diff,mask,history}]
    bg: null,          // {W,H,imgData}
    idx: 0,
    object: 'robot',
    addMode: true,
    showDiff: false,
    brushPx: 8, similarity: 20, reach: 30,
    packName: '',      // データセット名（ZIP名・IndexedDB名前空間に使用）
    datasetKey: '',
    cam: { scale: 1, tx: 0, ty: 0 },
  };

  function computeDatasetKey() {
    return (state.packName || '') + '::' + state.frames.map((f) => f.name).join('|');
  }

  // ── キャンバス ───────────────────────────────────────────
  const view = $('view');
  const ctx = view.getContext('2d');
  let maskCanvas, maskCtx, strokeCanvas, strokeCtx;   // オフスクリーン（WxH）
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resizeView() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = view.getBoundingClientRect();
    view.width = Math.round(r.width * dpr);
    view.height = Math.round(r.height * dpr);
    render();
  }
  window.addEventListener('resize', resizeView);

  // ── IndexedDB（作業の自動保存） ───────────────────────────
  let _db = null;
  function idb() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('mask-annotator', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('masks');
      r.onsuccess = () => { _db = r.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(key, val) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction('masks', 'readwrite');
      t.objectStore('masks').put(val, key);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  }
  async function idbGet(key) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction('masks', 'readonly');
      const rq = t.objectStore('masks').get(key);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  }
  const maskKey = (name) => `${state.datasetKey}::${state.object}::${name}`;

  // ── 画像読み込み ─────────────────────────────────────────
  async function loadScaledImage(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, LONG / Math.max(bmp.width, bmp.height));
    const W = Math.round(bmp.width * s), H = Math.round(bmp.height * s);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cc = c.getContext('2d', { willReadFrequently: true });
    cc.drawImage(bmp, 0, 0, W, H);
    const imgData = cc.getImageData(0, 0, W, H);
    const bitmap = await createImageBitmap(c);
    if (bmp.close) bmp.close();
    return { W, H, imgData, bitmap };
  }

  async function onLoadFrames(files) {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setStatus('読込中...');
    const frames = [];
    for (const f of list) {
      const im = await loadScaledImage(f);
      frames.push({
        name: f.name, W: im.W, H: im.H, bitmap: im.bitmap, diffBitmap: null,
        imgData: im.imgData, diff: null,
        mask: new Uint8Array(im.W * im.H), history: [],
      });
    }
    state.frames = frames;
    state.idx = 0;
    state.datasetKey = computeDatasetKey();
    $('hint').style.display = 'none';
    await restoreMasks();
    if (state.bg) await computeAllDiffs();
    fitView(); rebuildOverlays(); updateFrameLabel();
    setStatus(`${frames.length}枚読込`);
  }

  async function onLoadBg(file) {
    const im = await loadScaledImage(file);
    state.bg = { W: im.W, H: im.H, imgData: im.imgData };
    $('bgState').textContent = 'bg:あり'; $('bgState').classList.remove('off');
    // 背景ファイル名 background_<stem>.png から pack名を自動取得
    const m = file.name.match(/^background[_-](.+)\.[^.]+$/i);
    if (m && !state.packName) await setPackName(m[1]);
    if (state.frames.length) { await computeAllDiffs(); render(); }
    setStatus('背景読込: 賢いブラシ有効');
  }

  async function setPackName(name) {
    state.packName = (name || '').trim();
    const inp = $('packName'); if (inp && inp.value !== state.packName) inp.value = state.packName;
    state.datasetKey = computeDatasetKey();
    if (state.frames.length) { await restoreMasks(); rebuildOverlays(); updateFrameLabel(); }
  }

  // 背景を各フレーム解像度へ合わせて diff を計算（＋diff表示用ビットマップ）
  async function computeAllDiffs() {
    for (const fr of state.frames) {
      const bgData = resizeImageData(state.bg.imgData, fr.W, fr.H);
      fr.diff = MaskBrush.computeDiff(fr.imgData, bgData);
      // diff のグレースケール表示用
      const c = document.createElement('canvas'); c.width = fr.W; c.height = fr.H;
      const cc = c.getContext('2d');
      const id = cc.createImageData(fr.W, fr.H);
      for (let i = 0, j = 0; i < fr.diff.length; i++, j += 4) {
        id.data[j] = id.data[j + 1] = id.data[j + 2] = fr.diff[i]; id.data[j + 3] = 255;
      }
      cc.putImageData(id, 0, 0);
      fr.diffBitmap = await createImageBitmap(c);
    }
  }

  function resizeImageData(src, W, H) {
    if (src.width === W && src.height === H) return src;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    c.getContext('2d').putImageData(src, 0, 0);
    const d = document.createElement('canvas'); d.width = W; d.height = H;
    const dc = d.getContext('2d', { willReadFrequently: true });
    dc.drawImage(c, 0, 0, W, H);
    return dc.getImageData(0, 0, W, H);
  }

  // ── マスク復元（IndexedDB） ───────────────────────────────
  async function restoreMasks() {
    for (const fr of state.frames) {
      fr.history = [];
      const rec = await idbGet(maskKey(fr.name));
      fr.mask = (rec && rec.data && rec.data.length === fr.W * fr.H)
        ? Uint8Array.from(rec.data) : new Uint8Array(fr.W * fr.H);
    }
  }

  // ── オーバーレイ（緑マスク・ストローク）──────────────────
  function ensureOverlayCanvases(W, H) {
    if (!maskCanvas || maskCanvas.width !== W || maskCanvas.height !== H) {
      maskCanvas = document.createElement('canvas'); maskCanvas.width = W; maskCanvas.height = H;
      maskCtx = maskCanvas.getContext('2d');
      strokeCanvas = document.createElement('canvas'); strokeCanvas.width = W; strokeCanvas.height = H;
      strokeCtx = strokeCanvas.getContext('2d');
    }
  }
  function repaintMask() {
    const fr = curFrame(); if (!fr) return;
    ensureOverlayCanvases(fr.W, fr.H);
    const id = maskCtx.createImageData(fr.W, fr.H);
    for (let i = 0, j = 0; i < fr.mask.length; i++, j += 4) {
      if (fr.mask[i]) { id.data[j] = GREEN[0]; id.data[j + 1] = GREEN[1]; id.data[j + 2] = GREEN[2]; id.data[j + 3] = 128; }
    }
    maskCtx.putImageData(id, 0, 0);
  }
  function clearStrokeCanvas() { if (strokeCtx) strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height); }
  function rebuildOverlays() { repaintMask(); clearStrokeCanvas(); render(); }

  // ── 描画 ─────────────────────────────────────────────────
  function curFrame() { return state.frames[state.idx] || null; }

  function fitView() {
    const fr = curFrame(); if (!fr) return;
    const r = view.getBoundingClientRect();
    const s = Math.min(r.width / fr.W, r.height / fr.H) * 0.97;
    state.cam.scale = s;
    state.cam.tx = (r.width - fr.W * s) / 2;
    state.cam.ty = (r.height - fr.H * s) / 2;
  }

  function render() {
    const fr = curFrame();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, view.width, view.height);
    if (!fr) return;
    const { scale, tx, ty } = state.cam;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, tx * dpr, ty * dpr);
    ctx.imageSmoothingEnabled = false;
    const base = (state.showDiff && fr.diffBitmap) ? fr.diffBitmap : fr.bitmap;
    ctx.drawImage(base, 0, 0);
    if (maskCanvas) ctx.drawImage(maskCanvas, 0, 0);
    if (strokeCanvas) ctx.drawImage(strokeCanvas, 0, 0);
  }

  // clientX/Y（ビューポート基準）→ canvas ローカル CSS 座標。
  // canvas はツールバー等の下にあるため rect.left/top を引かないと一定オフセットでズレる。
  function clientToLocal(clientX, clientY) {
    const r = view.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // canvas ローカル(css)座標 → 画像(world)座標
  function toWorld(cx, cy) {
    return { x: (cx - state.cam.tx) / state.cam.scale, y: (cy - state.cam.ty) / state.cam.scale };
  }
  function imgRadius() { return Math.max(1, Math.round(state.brushPx / state.cam.scale)); }

  // ── ブラシ ───────────────────────────────────────────────
  let drawing = false, drawId = null, stroke = null, lastXY = null;

  function startStroke(cx, cy) {
    const fr = curFrame(); if (!fr) return;
    drawing = true; stroke = new Uint8Array(fr.W * fr.H); lastXY = null;
    clearStrokeCanvas();
    stampPath(cx, cy);
  }
  function stampDisk(wx, wy) {
    const fr = curFrame(); const rad = imgRadius();
    const r = Math.round(wy), c = Math.round(wx);
    const r0 = Math.max(0, r - rad), r1 = Math.min(fr.H, r + rad + 1);
    const c0 = Math.max(0, c - rad), c1 = Math.min(fr.W, c + rad + 1);
    const rr = rad * rad;
    for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) {
      const dx = x - c, dy = y - r;
      if (dx * dx + dy * dy <= rr) stroke[y * fr.W + x] = 1;
    }
    // プレビュー（ベクタ描画で軽量）
    const col = state.addMode ? PURPLE : ORANGE;
    strokeCtx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.6)`;
    strokeCtx.beginPath(); strokeCtx.arc(wx, wy, rad, 0, Math.PI * 2); strokeCtx.fill();
  }
  function stampPath(cx, cy) {
    const w = toWorld(cx, cy);
    if (!lastXY) { stampDisk(w.x, w.y); }
    else {
      const step = Math.max(1, imgRadius());
      const n = Math.ceil(Math.max(Math.abs(w.x - lastXY.x), Math.abs(w.y - lastXY.y)) / step) + 1;
      for (let t = 0; t <= n; t++) {
        const k = t / n;
        stampDisk(lastXY.x + (w.x - lastXY.x) * k, lastXY.y + (w.y - lastXY.y) * k);
      }
    }
    lastXY = w; render();
  }
  function commitStroke() {
    const fr = curFrame(); if (!fr || !stroke) return;
    fr.history.push(fr.mask.slice());
    if (fr.history.length > 20) fr.history.shift();
    let sel;
    if (fr.diff) sel = MaskBrush.selectRegion(fr.diff, stroke, fr.W, fr.H, state.reach, state.similarity);
    else sel = MaskBrush.fillHoles(stroke, fr.W, fr.H);   // 背景なし → 塗った所＋穴のみ
    if (state.addMode) for (let i = 0; i < sel.length; i++) { if (sel[i]) fr.mask[i] = 1; }
    else for (let i = 0; i < sel.length; i++) { if (sel[i]) fr.mask[i] = 0; }
    stroke = null; lastXY = null;
    repaintMask(); clearStrokeCanvas(); render();
    autosave(fr);
  }
  function autosave(fr) { idbPut(maskKey(fr.name), { W: fr.W, H: fr.H, data: fr.mask }).catch(() => {}); }

  function anySet(arr) { for (let i = 0; i < arr.length; i++) if (arr[i]) return true; return false; }

  // ── ポインタ（Pencil=描画 / 指=ナビ, パームリジェクション） ──
  const touches = new Map();
  let gesturePrev = null;

  view.addEventListener('pointerdown', (e) => {
    const p = clientToLocal(e.clientX, e.clientY);
    if (e.pointerType === 'pen' || e.pointerType === 'mouse') {
      drawing = true; drawId = e.pointerId; view.setPointerCapture(e.pointerId);
      startStroke(p.x, p.y); e.preventDefault();
    } else { // touch
      if (drawing) return;            // ペン描画中の手のひら等は無視（パームリジェクション）
      touches.set(e.pointerId, p);
      gesturePrev = null;
    }
  });
  view.addEventListener('pointermove', (e) => {
    const p = clientToLocal(e.clientX, e.clientY);
    if (drawing && e.pointerId === drawId) { stampPath(p.x, p.y); e.preventDefault(); return; }
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      onTouchMove(); e.preventDefault();
    }
  });
  function endPointer(e) {
    if (drawing && e.pointerId === drawId) { commitStroke(); drawing = false; drawId = null; return; }
    if (touches.has(e.pointerId)) { touches.delete(e.pointerId); gesturePrev = null; }
  }
  view.addEventListener('pointerup', endPointer);
  view.addEventListener('pointercancel', endPointer);

  function onTouchMove() {
    const pts = [...touches.values()];
    if (!pts.length) return;
    let cx = 0, cy = 0; for (const p of pts) { cx += p.x; cy += p.y; } cx /= pts.length; cy /= pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    if (gesturePrev && gesturePrev.count === pts.length) {
      if (pts.length >= 2 && gesturePrev.dist > 0) {
        const ratio = dist / gesturePrev.dist;
        const wx = (cx - state.cam.tx) / state.cam.scale, wy = (cy - state.cam.ty) / state.cam.scale;
        state.cam.scale *= ratio;
        state.cam.tx = cx - wx * state.cam.scale;
        state.cam.ty = cy - wy * state.cam.scale;
      }
      state.cam.tx += cx - gesturePrev.cx;
      state.cam.ty += cy - gesturePrev.cy;
      render();
    }
    gesturePrev = { cx, cy, dist, count: pts.length };
  }

  // ── フレーム移動・編集操作 ────────────────────────────────
  function gotoFrame(i) {
    state.idx = Math.max(0, Math.min(state.frames.length - 1, i));
    rebuildOverlays(); updateFrameLabel();
  }
  function undo() {
    const fr = curFrame(); if (fr && fr.history.length) { fr.mask = fr.history.pop(); repaintMask(); render(); autosave(fr); }
  }
  function clearFrame() {
    const fr = curFrame(); if (!fr) return;
    fr.history.push(fr.mask.slice()); fr.mask = new Uint8Array(fr.W * fr.H);
    repaintMask(); render(); autosave(fr);
  }
  async function switchObject(obj) {
    state.object = obj;
    if (state.frames.length) { await restoreMasks(); rebuildOverlays(); }
    updateFrameLabel();
  }

  function updateFrameLabel() {
    const fr = curFrame();
    const done = state.frames.filter((f) => anySet(f.mask)).length;
    $('frameLabel').textContent = fr
      ? `${state.idx + 1}/${state.frames.length} (${done}✓)`
      : '- / -';
  }
  function setStatus(s) { $('status').textContent = s; }

  // ── ZIP 出力 ─────────────────────────────────────────────
  function maskToPngBlob(fr) {
    const c = document.createElement('canvas'); c.width = fr.W; c.height = fr.H;
    const cc = c.getContext('2d');
    const id = cc.createImageData(fr.W, fr.H);
    for (let i = 0, j = 0; i < fr.mask.length; i++, j += 4) {
      const v = fr.mask[i] ? 255 : 0;
      id.data[j] = id.data[j + 1] = id.data[j + 2] = v; id.data[j + 3] = 255;
    }
    cc.putImageData(id, 0, 0);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  async function exportZip() {
    if (!state.frames.length) { setStatus('画像が未読込'); return; }
    if (typeof JSZip === 'undefined') { setStatus('JSZip読込失敗（オンライン要）'); return; }
    setStatus('ZIP生成中...');
    const zip = new JSZip();
    const obj = state.object;
    const entries = [];
    for (const fr of state.frames) {
      const stem = fr.name.replace(/\.[^.]+$/, '');
      const maskName = `${stem}_${obj}_mask.png`;
      entries.push({ file: fr.name, mask: maskName, has_mask: anySet(fr.mask) });
      zip.file(maskName, await maskToPngBlob(fr));
    }
    const manifest = {
      object: obj, long_side: LONG,
      mask_size_hw: [state.frames[0].H, state.frames[0].W],
      frames: entries,
    };
    zip.file(`manifest_${obj}.json`, JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const prefix = state.packName ? state.packName + '_' : '';
    downloadBlob(blob, `${prefix}${obj}_masks.zip`);
    setStatus(`ZIP出力: ${entries.filter((e) => e.has_mask).length}枚にマスク`);
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ── UI 配線 ──────────────────────────────────────────────
  $('btnLoadFrames').onclick = () => $('fileFrames').click();
  $('btnLoadBg').onclick = () => $('fileBg').click();
  $('fileFrames').onchange = (e) => onLoadFrames(e.target.files);
  $('fileBg').onchange = (e) => { if (e.target.files[0]) onLoadBg(e.target.files[0]); };

  $('packName').onchange = (e) => setPackName(e.target.value);
  $('objSelect').onchange = (e) => switchObject(e.target.value);
  $('btnMode').onclick = () => {
    state.addMode = !state.addMode;
    const b = $('btnMode');
    b.textContent = state.addMode ? 'ADD' : 'REMOVE';
    b.className = state.addMode ? 'mode-add' : 'mode-rem';
  };
  $('btnPrev').onclick = () => gotoFrame(state.idx - 1);
  $('btnNext').onclick = () => gotoFrame(state.idx + 1);
  $('btnUndo').onclick = undo;
  $('btnClear').onclick = clearFrame;
  $('btnDiff').onclick = () => { state.showDiff = !state.showDiff; render(); };
  $('btnFit').onclick = () => { fitView(); render(); };
  $('btnExport').onclick = exportZip;

  $('sBrush').oninput = (e) => { state.brushPx = +e.target.value; $('vBrush').textContent = e.target.value; };
  $('sSim').oninput = (e) => { state.similarity = +e.target.value; $('vSim').textContent = e.target.value; };
  $('sReach').oninput = (e) => { state.reach = +e.target.value; $('vReach').textContent = e.target.value; };

  // 初期化
  resizeView();
})();
