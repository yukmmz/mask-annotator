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
  const COPY_PREVIEW = [0, 200, 255]; // コピー移動/回転のプレビュー色（緑の確定マスクと区別）
  const AUTO_PREVIEW = [60, 130, 255]; // 自動シード(link)の青プレビュー色
  const HANDLE_GAP_PX = 34;          // 回転ハンドルのマスク上端からの距離（画面px一定で描画）
  const HANDLE_R_PX = 11;            // 回転ハンドル円の半径（画面px）

  const $ = (id) => document.getElementById(id);

  const state = {
    frames: [],        // [{name,W,H,bitmap,diffBitmap,imgData,diff,mask,history}]
    bg: null,          // {W,H,imgData}
    idx: 0,
    object: 'robot',
    addMode: true,
    lassoOutside: false,   // 外側選択（なげなわ）モード。ON中はPencilで囲って外側をADD/REMOVE
    showDiff: false,
    brushPx: 8, similarity: 20, reach: 30,
    packName: '',      // データセット名（ZIP名・IndexedDB名前空間に使用）
    datasetKey: '',
    cam: { scale: 1, tx: 0, ty: 0 },
    transform: null,   // コピー移動/回転モード中の状態（null=非モード）。詳細は enterTransformMode。
    threePoint: null,  // 翼3点楕円モード中の状態（null=非モード）。{center,tip,trailing,previewCanvas}
    autoSeed: null,    // 自動シード(link)のプレビュー（null=なし）。{mask, canvas}
    autoParams: { motion: 45, white: 110, yellow: 35, min_area: 400 }, // LinkSeed と同値の既定
  };

  // モーダル編集モード（コピー移動/回転・翼3点）中か。これらの間はフレーム移動等をブロックする。
  // 自動シードのプレビューは非モーダル（ブラシ通常動作を妨げない）なので含めない。
  function modalBusy() { return !!(state.transform || state.threePoint); }

  // 0/1 マスクから、指定色で塗った不透明キャンバス（W×H）を作る（プレビュー描画用）。
  function maskToCanvas(mask, W, H, rgb) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cc = c.getContext('2d');
    const id = cc.createImageData(W, H);
    for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
      if (mask[i]) { id.data[j] = rgb[0]; id.data[j + 1] = rgb[1]; id.data[j + 2] = rgb[2]; id.data[j + 3] = 255; }
    }
    cc.putImageData(id, 0, 0);
    return c;
  }

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
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
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
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
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
    // 移動/回転モード中は確定マスク（緑）を隠し、コピープレビュー（シアン）だけ見せる
    if (maskCanvas && !state.transform) ctx.drawImage(maskCanvas, 0, 0);
    if (strokeCanvas) ctx.drawImage(strokeCanvas, 0, 0);
    if (state.autoSeed) { ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(state.autoSeed.canvas, 0, 0); ctx.restore(); }
    if (state.transform) drawTransformOverlay();
    if (state.threePoint) drawThreePointOverlay();
  }

  // 翼3点モードのプレビュー（1/4楕円を緑で塗る＋配置済み点のマーカー）を world 座標で描く。
  function drawThreePointOverlay() {
    const tp = state.threePoint; const scale = state.cam.scale;
    if (tp.previewCanvas) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(tp.previewCanvas, 0, 0); ctx.restore();
    }
    const order = WingEllipse.POINT_ORDER;       // center→tip→trailing
    const colors = { center: '#ff3b30', tip: '#ffcc00', trailing: '#ff2d95' };
    const r = 7 / scale;
    for (const k of order) {
      const pt = tp[k]; if (!pt) continue;
      ctx.save();
      ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
      ctx.fillStyle = colors[k]; ctx.fill();
      ctx.lineWidth = 1.5 / scale; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
    }
  }

  // コピー移動/回転のプレビュー（シアンのマスク＋上部の回転ハンドル）を world 座標で描く。
  // ハンドルはズーム率に依らず画面上で一定サイズになるよう半径/間隔を 1/scale する。
  function drawTransformOverlay() {
    const t = state.transform;
    const scale = state.cam.scale;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(t.pivotX + t.tx, t.pivotY + t.ty);
    ctx.rotate(t.angle);
    ctx.translate(-t.pivotX, -t.pivotY);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(t.srcCanvas, 0, 0);
    ctx.restore();
    // 回転ハンドル（マスク上端中央から伸ばした棒＋円）
    const gapW = HANDLE_GAP_PX / scale;
    const anchor = MaskTransform.handlePoint(t.pivotX, t.pivotY, t.top, 0, t.tx, t.ty, t.angle);
    const h = MaskTransform.handlePoint(t.pivotX, t.pivotY, t.top, gapW, t.tx, t.ty, t.angle);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 2 / scale;
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(h.x, h.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, HANDLE_R_PX / scale, 0, Math.PI * 2);
    ctx.fillStyle = '#4a9eff'; ctx.fill();
    ctx.lineWidth = 1.5 / scale; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }

  // 回転ハンドルの画面（canvas css）座標。ヒットテスト用。
  function handleScreenPos() {
    const t = state.transform, scale = state.cam.scale;
    const h = MaskTransform.handlePoint(t.pivotX, t.pivotY, t.top, HANDLE_GAP_PX / scale, t.tx, t.ty, t.angle);
    return { x: h.x * scale + state.cam.tx, y: h.y * scale + state.cam.ty };
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
  // コピー移動/回転モードのドラッグ状態
  let movingMask = false, rotatingMask = false, tformPointerId = null, tformStartVals = null;
  // 外側選択（なげなわ）モードのドラッグ状態。state.lassoOutside がトグルON/OFF。
  let lassoing = false, lassoId = null, lassoPts = [];
  // 上部バーの折りたたみ（画像面積を最大化）。クイックバー(頻用コントロール)は畳まず常時表示。
  let chromeCollapsed = false;
  function setChromeCollapsed(v) {
    chromeCollapsed = v;
    $('app').classList.toggle('collapsed', v);
    $('btnChrome').textContent = v ? 'メニュー ▼' : '隠す ▲';
    resizeView();   // キャンバス実寸を測り直して再描画（カメラはそのまま）
  }
  // モード（移動/回転・翼3点・Auto）に入った時、畳まれていれば展開して操作ボタンを見せる
  function revealChrome() { if (chromeCollapsed) setChromeCollapsed(false); }

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
      if (state.threePoint) {          // 翼3点モード: Pencilタップで center→tip→trailing を配置
        placeThreePoint(toWorld(p.x, p.y)); e.preventDefault(); return;
      }
      if (state.transform) {           // 移動/回転モード: Pencil=移動 or ハンドル=回転
        tformPointerId = e.pointerId; view.setPointerCapture(e.pointerId);
        const w = toWorld(p.x, p.y);
        const hs = handleScreenPos();
        const t = state.transform;
        if (Math.hypot(p.x - hs.x, p.y - hs.y) <= HANDLE_R_PX + 18) {
          rotatingMask = true;        // ハンドルを掴んだ → 回転（掴んだ瞬間を基準にしてジャンプを防ぐ）
          const a0 = MaskTransform.angleFromPointer(t.pivotX, t.pivotY, t.tx, t.ty, w.x, w.y);
          tformStartVals = { angleOffset: t.angle - a0 };
        } else {
          movingMask = true;          // それ以外 → 平行移動
          tformStartVals = { startTx: t.tx, startTy: t.ty, sx: w.x, sy: w.y };
        }
        e.preventDefault(); return;
      }
      if (state.lassoOutside) {         // 外側選択: Pencilでなぞって範囲を囲む
        lassoing = true; lassoId = e.pointerId; view.setPointerCapture(e.pointerId);
        const w = toWorld(p.x, p.y); lassoPts = [[w.x, w.y]];
        drawLassoPreview(); e.preventDefault(); return;
      }
      drawing = true; drawId = e.pointerId; view.setPointerCapture(e.pointerId);
      startStroke(p.x, p.y); e.preventDefault();
    } else { // touch
      if (drawing || movingMask || rotatingMask || lassoing) return;  // ペン操作中の手のひら等は無視
      touches.set(e.pointerId, p);
      gesturePrev = null;
    }
  });
  view.addEventListener('pointermove', (e) => {
    const p = clientToLocal(e.clientX, e.clientY);
    if ((movingMask || rotatingMask) && e.pointerId === tformPointerId) {
      const w = toWorld(p.x, p.y); const t = state.transform;
      if (rotatingMask) {
        t.angle = MaskTransform.angleFromPointer(t.pivotX, t.pivotY, t.tx, t.ty, w.x, w.y) + tformStartVals.angleOffset;
        updateRotReadout();
      } else {
        t.tx = tformStartVals.startTx + (w.x - tformStartVals.sx);
        t.ty = tformStartVals.startTy + (w.y - tformStartVals.sy);
      }
      render(); e.preventDefault(); return;
    }
    if (lassoing && e.pointerId === lassoId) {
      const w = toWorld(p.x, p.y); lassoPts.push([w.x, w.y]);
      drawLassoPreview(); e.preventDefault(); return;
    }
    if (drawing && e.pointerId === drawId) { stampPath(p.x, p.y); e.preventDefault(); return; }
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      onTouchMove(); e.preventDefault();
    }
  });
  function endPointer(e) {
    if ((movingMask || rotatingMask) && e.pointerId === tformPointerId) {
      movingMask = false; rotatingMask = false; tformPointerId = null; tformStartVals = null; return;
    }
    if (lassoing && e.pointerId === lassoId) {
      lassoing = false; lassoId = null;
      applyLassoOutside(lassoPts); lassoPts = []; return;
    }
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
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    clearAutoSeed();   // 自動シードプレビューはフレーム固有なので移動時に破棄
    state.idx = Math.max(0, Math.min(state.frames.length - 1, i));
    rebuildOverlays(); updateFrameLabel();
  }
  function undo() {
    if (modalBusy()) { setStatus('編集モード中です（取消で破棄できます）'); return; }
    const fr = curFrame(); if (fr && fr.history.length) { fr.mask = fr.history.pop(); repaintMask(); render(); autosave(fr); }
  }
  function clearFrame() {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    const fr = curFrame(); if (!fr) return;
    fr.history.push(fr.mask.slice()); fr.mask = new Uint8Array(fr.W * fr.H);
    repaintMask(); render(); autosave(fr);
  }
  async function switchObject(obj) {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    clearAutoSeed();
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
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
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

  // ── ZIP 取り込み（再開）─────────────────────────────────────
  // エクスポート済みマスクZIP（manifest_<object>.json + *_mask.png）を読み、
  // フレーム名で突合して IndexedDB へ書き戻す。現在対象のマスクは即時再描画。
  // マスク PNG は現在フレーム解像度へ「最近傍」リサイズして2値化する
  // （long_side 丸め差を吸収しつつ 0/1 をぼかさないため imageSmoothingEnabled=false）。
  async function maskBinaryFromBlob(blob, targetW, targetH) {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = targetW; c.height = targetH;
    const cc = c.getContext('2d', { willReadFrequently: true });
    cc.imageSmoothingEnabled = false;   // 2値マスクをぼかさない（最近傍リサイズ）
    cc.drawImage(bmp, 0, 0, targetW, targetH);
    if (bmp.close) bmp.close();
    const id = cc.getImageData(0, 0, targetW, targetH);
    return MaskIO.thresholdToMask(id.data, targetW * targetH, 127);
  }

  async function onImportZips(files) {
    const list = [...files].filter((f) => /\.zip$/i.test(f.name));
    if (!list.length) return;
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    if (!state.frames.length) { setStatus('先に「画像を読込」してください（再開は画像読込後）'); return; }
    if (typeof JSZip === 'undefined') { setStatus('JSZip読込失敗（オンライン要）'); return; }
    if (!state.packName) { setStatus('先に「背景」を読み込んでpack名を確定してから取り込んでください'); return; }

    setStatus('ZIP解析中...');
    const loadedNames = new Set(state.frames.map((f) => f.name));
    const plan = [];          // {object, name, entry(JSZipオブジェクト)}
    const unmatched = [];      // 現在の読込画像に存在しないフレーム名（has_mask:true のみ）

    // Phase 1: 全ZIPを解析・検証（この段では IndexedDB へ一切書き込まない）
    try {
      for (const file of list) {
        const zip = await JSZip.loadAsync(file);
        const manifestPaths = Object.keys(zip.files)
          .filter((p) => !zip.files[p].dir && /(^|\/)manifest_.+\.json$/i.test(p));
        if (!manifestPaths.length) { setStatus(`manifestが見つかりません: ${file.name}`); return; }
        for (const mp of manifestPaths) {
          const man = MaskIO.parseManifest(await zip.file(mp).async('string'));
          const dir = mp.replace(/[^/]+$/, '');   // manifest と同じ階層を mask の基準に
          for (const fr of man.frames) {
            if (!fr.has_mask) continue;             // 未注釈フレームは取り込まない（既存維持）
            if (!loadedNames.has(fr.file)) { unmatched.push(fr.file); continue; }
            const entry = zip.file(fr.mask) || zip.file(dir + fr.mask);
            if (!entry) { setStatus(`マスクPNGが欠落: ${fr.mask}（${file.name}）`); return; }
            plan.push({ object: man.object, name: fr.file, entry });
          }
        }
      }
    } catch (err) {
      setStatus('ZIP解析エラー: ' + err.message); return;
    }

    // 未マッチが1件でもあれば中止（部分取り込みはしない）
    if (unmatched.length) {
      const head = unmatched.slice(0, 3).join(', ');
      const more = unmatched.length > 3 ? ' ...' : '';
      setStatus(`中止: ${unmatched.length}件のマスクが現在の画像と未マッチ (${head}${more})。同じキーフレームを読み込んでから再試行してください`);
      return;
    }
    if (!plan.length) { setStatus('取り込めるマスクがありません（has_mask が全て false）'); return; }

    // Phase 2: 検証通過後にのみ デコード→リサイズ→IndexedDB 書込
    setStatus(`取込中... (${plan.length}枚)`);
    const frByName = new Map(state.frames.map((f) => [f.name, f]));
    const objects = new Set();
    try {
      for (const p of plan) {
        const tf = frByName.get(p.name);
        const blob = await p.entry.async('blob');
        const data = await maskBinaryFromBlob(blob, tf.W, tf.H);
        // 同じ datasetKey 名前空間。manifest の object（現在の選択と異なってよい）へ書く。
        await idbPut(`${state.datasetKey}::${p.object}::${p.name}`, { W: tf.W, H: tf.H, data });
        objects.add(p.object);
      }
    } catch (err) {
      setStatus('取込エラー: ' + err.message); return;
    }
    // 現在対象は IndexedDB から再読込して即時反映。他対象は switchObject で復元される。
    await restoreMasks(); rebuildOverlays(); updateFrameLabel();
    setStatus(`取込完了: ${plan.length}枚 / 対象 ${[...objects].join(',')}（上書き）`);
  }

  // ── 前フレームのマスクをコピー → 移動/回転 → 確定 ────────────
  // コピーされたマスクは確定後に通常マスクと同じ（ADD/REMOVE/Undo で調整可能）。
  function normDeg(rad) {
    let d = (rad * 180 / Math.PI) % 360;
    if (d > 180) d -= 360; if (d <= -180) d += 360;
    return Math.round(d);
  }
  function updateRotReadout() {
    const t = state.transform; if (t) $('rotReadout').textContent = normDeg(t.angle) + '°';
  }

  function copyPrevMask() {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    if (!state.frames.length) { setStatus('画像が未読込'); return; }
    if (state.idx <= 0) { setStatus('前のフレームがありません（先頭フレーム）'); return; }
    const prev = state.frames[state.idx - 1];
    const cur = curFrame();
    if (!anySet(prev.mask)) { setStatus('前フレームにマスクがありません'); return; }
    // 既にマスクがある時は誤操作防止の確認（Undoでも戻せるが二重に保護する）
    if (anySet(cur.mask)) {
      const ok = window.confirm(
        'このフレームには既にマスクがあります。\n前フレームのマスクで置き換えますか?\n（あとで Undo で戻せます）');
      if (!ok) { setStatus('コピーを中止しました'); return; }
    }
    enterTransformMode(prev.mask, prev.W, prev.H);
  }

  function enterTransformMode(srcMask, srcW, srcH) {
    clearAutoSeed();   // 非モーダルな自動シードプレビューが残っていれば消す
    setLassoOutside(false);
    revealChrome();    // 確定/取消が見えるよう、畳まれていれば展開
    const b = MaskTransform.bboxCenter(srcMask, srcW, srcH);
    state.transform = {
      srcMask, srcW, srcH,
      srcCanvas: maskToCanvas(srcMask, srcW, srcH, COPY_PREVIEW),
      pivotX: b.cx, pivotY: b.cy, top: b.empty ? 0 : b.miny,
      tx: 0, ty: 0, angle: 0,
    };
    $('transformBar').hidden = false;
    updateRotReadout();
    setStatus('Pencilでドラッグ=移動 / 上の○ハンドルをドラッグ=回転 → 確定');
    render();
  }

  function applyTransform() {
    const fr = curFrame(); const t = state.transform; if (!fr || !t) return;
    // 確定は純関数の逆ワープ（最近傍）で厳密にラスタ化。プレビュー(canvas)と同じ剛体変換式。
    const result = MaskTransform.transformMask(
      t.srcMask, t.srcW, t.srcH, fr.W, fr.H, t.pivotX, t.pivotY, t.tx, t.ty, t.angle);
    fr.history.push(fr.mask.slice());        // Undo で戻せるよう退避
    if (fr.history.length > 20) fr.history.shift();
    fr.mask = result;
    exitTransform();
    repaintMask(); clearStrokeCanvas(); render(); autosave(fr); updateFrameLabel();
    setStatus('コピーを確定（ADD/REMOVEで調整できます）');
  }
  function exitTransform() { state.transform = null; $('transformBar').hidden = true; }
  function cancelTransform() {
    if (!state.transform) return;
    exitTransform();
    rebuildOverlays();   // 確定マスク（緑）の表示を戻す
    setStatus('コピーを取消しました');
  }

  // ── 翼3点 1/4楕円ツール（対象=wing 用の別モード）────────────
  // center→tip→trailing の3点を Pencil タップで配置 → 緑で楕円プレビュー → 確定でマスクに合流。
  function enterThreePoint() {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    if (!state.frames.length) { setStatus('画像が未読込'); return; }
    if (state.object !== 'wing') { setStatus('3点(翼)モードは対象=wingで使います（対象をwingに）'); return; }
    clearAutoSeed();
    setLassoOutside(false);
    revealChrome();
    state.threePoint = { center: null, tip: null, trailing: null, previewCanvas: null };
    $('threePointBar').hidden = false;
    setStatus('翼3点: center をPencilでタップ（順: center→tip→trailing）');
    render();
  }
  function recomputeThreePointPreview() {
    const tp = state.threePoint; const fr = curFrame(); if (!tp || !fr) return;
    if (tp.center && tp.tip && tp.trailing) {
      const em = WingEllipse.quarterEllipseMask(fr.W, fr.H, tp.center, tp.tip, tp.trailing);
      tp.previewCanvas = maskToCanvas(em, fr.W, fr.H, GREEN);   // 退化時は空（透明）でよい
    } else {
      tp.previewCanvas = null;
    }
  }
  function placeThreePoint(w) {
    const tp = state.threePoint; if (!tp) return;
    const order = WingEllipse.POINT_ORDER;
    const idx = order.findIndex((k) => tp[k] == null);
    if (idx === -1) { setStatus('3点配置済み。確定 / 1点戻す / クリア'); return; }
    tp[order[idx]] = [w.x, w.y];
    recomputeThreePointPreview();
    const next = order.findIndex((k) => tp[k] == null);
    setStatus(next === -1 ? '3点配置完了 → 確定 で塗る' : `次の点: ${order[next]} をタップ`);
    render();
  }
  function undoThreePoint() {
    const tp = state.threePoint; if (!tp) return;
    const order = WingEllipse.POINT_ORDER;
    for (let i = order.length - 1; i >= 0; i--) { if (tp[order[i]] != null) { tp[order[i]] = null; break; } }
    recomputeThreePointPreview();
    const next = order.findIndex((k) => tp[k] == null);
    setStatus(next === -1 ? '3点配置完了 → 確定' : `次の点: ${order[next]} をタップ`);
    render();
  }
  function clearThreePoint() {
    const tp = state.threePoint; if (!tp) return;
    tp.center = tp.tip = tp.trailing = null; tp.previewCanvas = null;
    setStatus('点をクリア。center からタップ');
    render();
  }
  function applyThreePoint() {
    const fr = curFrame(); const tp = state.threePoint; if (!fr || !tp) return;
    if (!(tp.center && tp.tip && tp.trailing)) { setStatus('3点を配置してください'); return; }
    const em = WingEllipse.quarterEllipseMask(fr.W, fr.H, tp.center, tp.tip, tp.trailing);
    if (!anySet(em)) { setStatus('退化した3点（一直線）。置き直してください'); return; }
    fr.history.push(fr.mask.slice());               // Undo で戻せるよう退避
    if (fr.history.length > 20) fr.history.shift();
    for (let i = 0; i < em.length; i++) { if (em[i]) fr.mask[i] = 1; }  // 既存マスクへユニオン（加算）
    exitThreePoint();
    repaintMask(); clearStrokeCanvas(); render(); autosave(fr); updateFrameLabel();
    setStatus('翼楕円を確定（ADD/REMOVEで調整できます）');
  }
  function exitThreePoint() { state.threePoint = null; $('threePointBar').hidden = true; }
  function cancelThreePoint() {
    if (!state.threePoint) return;
    exitThreePoint();
    rebuildOverlays();
    setStatus('翼3点モードを取消しました');
  }

  // ── 自動シード(link): 黒背景の白リンクの土台マスクを自動生成（非モーダル）────
  function toggleAutoPanel() {
    const bar = $('autoBar');
    bar.hidden = !bar.hidden;
    if (bar.hidden) { clearAutoSeed(); }   // 閉じたらプレビューを破棄
    else { revealChrome(); setStatus('Auto(link): スライダ調整 →「Auto実行」で現フレームのシードを計算'); }
  }
  function runAutoSeed() {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    const fr = curFrame(); if (!fr) { setStatus('画像が未読込'); return; }
    if (!fr.diff) { setStatus('背景未読込のため自動シードは使えません（背景を読み込む）'); return; }
    const mask = LinkSeed.linkSeedFromDiff(fr.imgData.data, fr.diff, fr.W, fr.H, state.autoParams);
    let cnt = 0; for (let i = 0; i < mask.length; i++) cnt += mask[i];
    state.autoSeed = { mask, canvas: maskToCanvas(mask, fr.W, fr.H, AUTO_PREVIEW) };
    render();
    setStatus(`自動シード: ${cnt}px（青）→「適用」でマスクに合流（ADD/REMOVE準拠）`);
  }
  function applyAutoSeed() {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    const fr = curFrame(); if (!fr || !state.autoSeed) { setStatus('先に「Auto実行」してください'); return; }
    fr.history.push(fr.mask.slice());
    if (fr.history.length > 20) fr.history.shift();
    const sm = state.autoSeed.mask;
    // Auto(link)の「適用」は ADD/REMOVE モードに関わらず常にマスクへ追加（union）する
    for (let i = 0; i < sm.length; i++) { if (sm[i]) fr.mask[i] = 1; }
    clearAutoSeed();
    repaintMask(); render(); autosave(fr); updateFrameLabel();
    setStatus('自動シードを追加で適用（Undoで戻せます）');
  }
  function clearAutoSeed() { if (state.autoSeed) { state.autoSeed = null; render(); } }

  // ── 外側選択（なげなわ）: 囲んだ範囲の外側を ADD/REMOVE ─────────
  function setLassoOutside(on) {
    state.lassoOutside = on;
    const b = $('btnLasso');
    if (b) b.classList.toggle('lasso-on', on);
    if (!on && lassoing) { lassoing = false; lassoId = null; lassoPts = []; clearStrokeCanvas(); render(); }
  }
  function toggleLassoOutside() {
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); return; }
    setLassoOutside(!state.lassoOutside);
    setStatus(state.lassoOutside
      ? ' 外側選択ON: Pencilで囲むと外側を' + (state.addMode ? '追加' : '削除') + '（OFFで通常ブラシ）'
      : '外側選択OFF');
  }

  // ドラッグ中のなげなわ輪郭を strokeCanvas に描く（終点→始点を結んで閉じた形を表示）
  function drawLassoPreview() {
    const fr = curFrame(); if (!fr || !strokeCtx) return;
    ensureOverlayCanvases(fr.W, fr.H);
    strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    if (lassoPts.length >= 1) {
      const col = state.addMode ? PURPLE : ORANGE;
      strokeCtx.save();
      strokeCtx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
      strokeCtx.lineWidth = Math.max(0.5, 2 / state.cam.scale);
      strokeCtx.beginPath();
      strokeCtx.moveTo(lassoPts[0][0], lassoPts[0][1]);
      for (let i = 1; i < lassoPts.length; i++) strokeCtx.lineTo(lassoPts[i][0], lassoPts[i][1]);
      strokeCtx.closePath();   // 終点→始点（自動クローズ）を可視化
      strokeCtx.stroke();
      strokeCtx.restore();
    }
    render();
  }

  function applyLassoOutside(pts) {
    const fr = curFrame(); if (!fr) return;
    clearStrokeCanvas();
    if (pts.length < 3) { render(); setStatus('範囲が小さすぎます（もっと大きく囲む）'); return; }
    const inside = Lasso.polygonFillMask(pts, fr.W, fr.H);
    let nin = 0; for (let i = 0; i < inside.length; i++) nin += inside[i];
    if (nin === 0) { render(); setStatus('範囲を囲めませんでした'); return; }
    fr.history.push(fr.mask.slice());            // Undo で戻せるよう退避
    if (fr.history.length > 20) fr.history.shift();
    if (state.addMode) { for (let i = 0; i < inside.length; i++) { if (!inside[i]) fr.mask[i] = 1; } }
    else { for (let i = 0; i < inside.length; i++) { if (!inside[i]) fr.mask[i] = 0; } }
    repaintMask(); render(); autosave(fr); updateFrameLabel();
    setStatus(`囲んだ範囲の外側を${state.addMode ? '追加' : '削除'}（Undoで戻せます）`);
  }

  // ── UI 配線 ──────────────────────────────────────────────
  $('btnLoadFrames').onclick = () => $('fileFrames').click();
  $('btnLoadBg').onclick = () => $('fileBg').click();
  $('fileFrames').onchange = (e) => onLoadFrames(e.target.files);
  $('fileBg').onchange = (e) => { if (e.target.files[0]) onLoadBg(e.target.files[0]); };
  $('btnImport').onclick = () => $('fileImport').click();
  $('fileImport').onchange = (e) => { onImportZips(e.target.files); e.target.value = ''; };

  $('packName').onchange = (e) => setPackName(e.target.value);
  $('objSelect').onchange = (e) => {
    // 編集モード中の対象切替はブロックし、ドロップダウン表示を元に戻す
    if (modalBusy()) { setStatus('編集モード中です。先に確定/取消してください'); e.target.value = state.object; return; }
    switchObject(e.target.value);
  };
  $('btnCopyPrev').onclick = copyPrevMask;
  $('btnTransformApply').onclick = applyTransform;
  $('btnTransformCancel').onclick = cancelTransform;

  // 上部バーの折りたたみ
  $('btnChrome').onclick = () => setChromeCollapsed(!chromeCollapsed);

  // 翼3点モード
  $('btn3pt').onclick = enterThreePoint;
  $('btn3ptUndo').onclick = undoThreePoint;
  $('btn3ptClear').onclick = clearThreePoint;
  $('btn3ptApply').onclick = applyThreePoint;
  $('btn3ptCancel').onclick = cancelThreePoint;

  // 自動シード(link)
  $('btnAuto').onclick = toggleAutoPanel;
  $('btnAutoRun').onclick = runAutoSeed;
  $('btnAutoApply').onclick = applyAutoSeed;
  $('btnAutoClose').onclick = () => { $('autoBar').hidden = true; clearAutoSeed(); };
  $('aMotion').oninput = (e) => { state.autoParams.motion = +e.target.value; $('vMotion').textContent = e.target.value; };
  $('aWhite').oninput = (e) => { state.autoParams.white = +e.target.value; $('vWhite').textContent = e.target.value; };
  $('aYellow').oninput = (e) => { state.autoParams.yellow = +e.target.value; $('vYellow').textContent = e.target.value; };
  $('aMinArea').oninput = (e) => { state.autoParams.min_area = +e.target.value; $('vMinArea').textContent = e.target.value; };
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
  $('btnLasso').onclick = toggleLassoOutside;
  $('btnExport').onclick = exportZip;

  $('sBrush').oninput = (e) => { state.brushPx = +e.target.value; $('vBrush').textContent = e.target.value; };
  $('sSim').oninput = (e) => { state.similarity = +e.target.value; $('vSim').textContent = e.target.value; };
  $('sReach').oninput = (e) => { state.reach = +e.target.value; $('vReach').textContent = e.target.value; };

  // 初期化
  resizeView();
})();
