'use strict';
/*
 * NAI Studio — NovelAI 로컬 이미지 생성 스튜디오
 * Copyright (C) 2026 seaw0616
 *
 * 이 프로그램은 자유 소프트웨어입니다. 자유 소프트웨어 재단이 발표한
 * GNU 일반 공중 사용 허가서 버전 3 또는 (선택에 따라) 그 이후 버전의
 * 조건에 따라 재배포하거나 수정할 수 있습니다.
 *
 * 이 프로그램은 유용하게 쓰이기를 바라며 배포되지만 어떠한 보증도 하지 않습니다.
 * 자세한 내용은 GNU 일반 공중 사용 허가서를 보십시오: <https://www.gnu.org/licenses/>
 *
 * 그 밖의 서드파티 고지는 NOTICE.txt 를 참고하십시오.
 */
/* ═══════════════════════════════════════════════════════════════════════════
   그림판 — NAI 웹 그림판(빌드 78a367e 의 Canvas)을 따라 만든 것
   ───────────────────────────────────────────────────────────────────────────
   NAI 와 같게 한 것 (번들의 캔버스 관리자 cD · 도구 클래스 · 편집기 화면 · 크기 바꾸기 창 TD 를 읽고 옮김)
   · 두 모드: 일반(그림 고치기·새로 그리기) / 마스크(인페인트)
   · 레이어: 일반 레이어(원본 크기) · 마스크 레이어(1/8 크기 — 칸 하나가 그림의 8×8, 불투명도 0.5, 색 10가지를 돌려 씀)
   · 도구(일반): 그리기·지우기·네모 선택·채우기·올가미·색 고르기·흐리기·복제
     도구(마스크): 마스크 칠하기·마스크 지우기·집중 영역·마스크 채우기
   · 단축키: B·E·G·S·R·J·C·L, Alt+L 선택을 새 레이어로(Shift 면 잘라내기), [ ] 붓 크기, Ctrl+0 화면 맞춤, Ctrl+Z·Ctrl+Y
   · 붓: 크기 5~100(마스크 4~50 칸) · 모양 둥근/부드러운/네모 · 필압 · 채우기 허용 범위 0~100(처음 15) · 흐리기 세기 1~100(처음 50)
   · 캔버스 크기 바꾸기(크기 직접·가장 가까운 생성 크기로 자르기·가장자리 옮기기) — 마스크 모드는 64 배수, 늘린 곳은 마스크로 채움
   · 색조 조정(색상 −180~180° · 채도·밝기 −100~100%) · 마스크 표시 설정(색·불투명도·테두리·무늬)
   · 그림 파일을 끌어다 놓거나 붙여 넣으면 새 레이어(지금 레이어가 마스크면 그 모양을 마스크로)
   · 되돌리기 기록은 200MB 까지 · 다시 열면 같은 그림이면 레이어가 그대로
     (NAI canvas-state-cache: 저장할 때 저장한 그림의 SHA-256 으로 IndexedDB 에 남겨 앱을 다시 켜도, 최근 5개 · 같은 앱 안에서는 닫기만 해도 이어서)
   · 저장: 일반 = 레이어를 합친 그림 / 마스크 = 1/8 마스크 + 레이어를 합친 바탕 그림 + 집중 영역
   · 3D 모델 레이어 (12.26, NAI 빌드 b50892a — 관리자·도구·파일 읽기는 model3d.js): 레이어 목록의 «＋ 3D» · 모델 넣기(glb·gltf·vrm·pmx·pmd·zip·그림)
     · 도구 모델 변형(T)·포즈(P) · 이동·회전·크기 · 3D 설정(투영·시야각·조명·빛 방향·그림자·품질·뼈대 보이기·물리) · 뼈대 목록 · 표정·모프 · 동작 재생
     · 3D 레이어를 고르면 그 자리에 움직이는 3D 화면이 뜬다(NAI TP — 바탕은 테마에 따라 흰색·검은색, 바닥 격자·축, WASDQE 로 카메라 이동)
     · 3D 레이어는 되돌리기 기록에 들어가지 않는다(NAI 와 같음) · 다시 열면 모델·자세·조명·카메라가 그대로(NAI 가 그림 해시로 기억하는 것과 같은 내용)
   NAI 와 다르게 한 것: 화면 그리기는 WebGL 대신 2D 캔버스(결과 픽셀은 같은 셈) · 마스크 모드로 저장할 때도 3D 레이어를 새로 그려 합친다
     (NAI 는 마지막으로 그려 둔 3D 그림을 쓴다 — 카메라만 돌리고 저장하면 돌리기 전 모습이 들어간다)
     · 마스크 모드 기억: NAI 는 마스크 그림의 해시로 남기고 바탕 그림의 해시로 찾아 다시 열어도 되살아나지 않는다 → 저장한 바탕 그림의 해시로 남긴다
   ═══════════════════════════════════════════════════════════════════════════ */

const CV_DEF = { drawSize: 20, eraseSize: 20, maskSize: 4, safeAreaSize: 96, maskDrawShape: 'circle', brushTip: 'round', pressureSensitivity: false, fillTolerance: 15, blurIntensity: 50 };
const CV_MASK_COLORS = ['rgb(100, 100, 200)', 'rgb(230, 180, 60)', 'rgb(200, 80, 180)', 'rgb(60, 190, 190)', 'rgb(220, 75, 75)', 'rgb(75, 190, 90)', 'rgb(180, 110, 220)', 'rgb(220, 140, 60)', 'rgb(70, 140, 210)', 'rgb(180, 180, 70)'];
const CV_UNDO_CAP = 0xc800000;        // 200MB (NAI UNDO_MEMORY_CAP)
const CV_MAX_SIDE = 2560;             // 열 때 긴 쪽 한도 (NAI 와 같음)
const CV_FOCUS_MAX = 589824;          // 집중 영역 넓이 한도 768×768 (그림 화소)
const CV_SIZE_KEY = { draw: 'drawSize', erase: 'eraseSize', mask: 'maskSize' };
const CV_M3D_ACCEPT = '.glb,.gltf,.vrm,.pmx,.pmd,.zip,.png,.jpg,.jpeg,.webp,.bmp,.gif';   // NAI 3D «Import» 단추가 받는 파일 (model3d.js MODEL_ACCEPT 와 같아야 한다)
const CV_TOOLS = {
  normal: [
    { n: 'draw', ic: '✏️', t: '그리기 (B)', size: 'draw' },
    { n: 'erase', ic: '🧽', t: '지우기 (E)', size: 'erase' },
    { n: 'select', ic: '⬚', t: '네모 선택 (S) — 끌어서 옮기기·모서리로 크기·위 손잡이로 돌리기' },
    { n: 'fill', ic: '🪣', t: '채우기 (G)' },
    { n: 'lasso', ic: '➰', t: '올가미 선택 (L)' },
    { n: 'colorPicker', ic: '💧', t: '색 고르기 (C)' },
    { n: 'blur', ic: '🌫️', t: '흐리기 (R)', size: 'draw' },
    { n: 'clone', ic: '⎘', t: '복제 (J) — Alt+클릭으로 가져올 자리를 정합니다', size: 'draw' },
  ],
  mask: [
    { n: 'maskDraw', ic: '✏️', t: '마스크 칠하기 (B)', size: 'mask' },
    { n: 'maskErase', ic: '🧽', t: '마스크 지우기 (E)', size: 'mask' },
    { n: 'maskZoomSelection', ic: '⬚', t: '집중 영역 (S) — 이 네모 안만 크게 키워 다시 그립니다' },
    { n: 'maskFill', ic: '🪣', t: '마스크 채우기 (G)' },
  ],
  // NAI model3dTools = [gi «Model Transform», gt «Pose»] — 3D 레이어를 고르면 이 둘만 나온다
  model3d: [
    { n: 'modelTransform', ic: '✥', t: '모델 변형 (T) — 모델을 눌러 고르고, 손잡이로 옮기고 돌리고 크기를 바꿉니다' },
    { n: 'pose', ic: '🦴', t: '포즈 (P) — 파란 점(뼈)을 눌러 고르고, 손잡이로 돌립니다 · 모델 몸을 누르면 모델 변형으로' },
  ],
};
const CV = {
  el: null, open: false, mode: 'normal', w: 0, h: 0, layers: [], sel: 0, nextId: 1,
  tool: null, lastTool: null, ts: null, undo: [], redo: [], undoBytes: 0,
  view: { s: 1, x: 0, y: 0 }, dpr: 1, ptr: null, pan: null, space: false, act: null,
  focus: null, selT: null, onSave: null, src: null, resized: false, hsv: null, layersOpen: true,
  disp: { color: 0, opacity: 50, pattern: 'solid', border: true },
  // 3D 레이어: 손잡이 방식(NAI 그림판 상태 «translate»에서 시작) · 지금 3D 화면 · 지금 3D 도구 · 열린 칸(뼈대 목록·표정·3D 설정)
  m3dMode: 'translate', m3dView: null, m3dTool: null, m3dBones: false, m3dMorph: false,
  storeP: null,   // 저장한 레이어를 IndexedDB 에 쓰는 중이면 그 Promise (NAI canvas-state-cache)
};
const CV_CACHE = new WeakMap();       // 그림(Blob)마다 마지막 레이어 — 이 앱 안에서 다시 열면 이어서 고친다 (껐다 켜도 남기는 것은 cvStorePut)

/* ── 작은 도구들 ── */
function cvMk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function cvCtx(c) { return c.getContext('2d', { willReadFrequently: true }); }
function cvCur() { return CV.layers[CV.sel]; }
function cvIsMaskLayer(L) { return !!L && L.type === 'mask'; }
function cvIsM3d(L) { return !!L && L.type === 'model3d'; }
function cvToolDef(n) { return CV_TOOLS.normal.concat(CV_TOOLS.mask, CV_TOOLS.model3d).find(t => t.n === n); }
function cvTools() { const L = cvCur(); return CV_TOOLS[cvIsMaskLayer(L) ? 'mask' : cvIsM3d(L) ? 'model3d' : 'normal']; }
function cvOpaque(c) { const m = String(c).match(/^rgba?\(([^,]+),([^,]+),([^,]+)(?:,[^)]+)?\)$/); return m ? `rgb(${m[1].trim()}, ${m[2].trim()}, ${m[3].trim()})` : c; }
function cvRgb(c) { const m = String(c).match(/(\d+)\D+(\d+)\D+(\d+)/); return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 }; }
function cvHex(c) { const { r, g, b } = cvRgb(c); return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); }
function cvSaveTs() {   // NAI «canvas-toolSettings» 처럼 붓 설정을 기억한다
  const keep = {}; for (const k in CV_DEF) keep[k] = CV.ts[k];
  S.cvTools = keep; if (typeof save === 'function') save();
}

/* ── 레이어 (NAI cD.addLayer · addMaskLayer) ── */
function cvNewLayer(type) {
  const sc = type === 'mask' ? 8 : 1, c = cvMk(CV.w / sc, CV.h / sc);
  const n = CV.layers.filter(l => l.type === 'mask').length;
  return { id: 'layer-' + (CV.nextId++), type, canvas: c, ctx: cvCtx(c), scale: sc, opacity: type === 'mask' ? 0.5 : 1, maskColor: CV_MASK_COLORS[n % CV_MASK_COLORS.length], ver: 0 };
}
function cvAddLayer(snap) {
  const L = cvNewLayer('normal');
  if (CV.mode === 'mask') {
    const k = CV.layers.findIndex(l => l.type === 'mask');
    if (k >= 0) { CV.layers.splice(k, 0, L); CV.sel = k; } else { CV.layers.push(L); CV.sel = CV.layers.length - 1; }
  } else { CV.layers.push(L); CV.sel = CV.layers.length - 1; }
  if (snap) cvSaveState();
  cvSyncTools();
  return L;
}
function cvAddMaskLayer(snap) {
  const L = cvNewLayer('mask'); CV.layers.push(L); CV.sel = CV.layers.length - 1;
  if (snap) cvSaveState();
  cvSyncTools();
  return L;
}
function cvRemoveLayer(i) {
  if (CV.layers.length <= 1) return;
  if (CV.mode === 'mask' && CV.layers[i].type === 'mask' && CV.layers.filter(l => l.type === 'mask').length <= 1) return;
  cvCommitSelection();
  const L = CV.layers[i], m3 = cvIsM3d(L);
  if (m3) { if (CV.m3dView && CV.m3dView.L === L) cvM3dDetach(); L.m3d.dispose(); }   // NAI removeLayer: 3D 관리자를 버리고 기록을 비운다
  CV.layers.splice(i, 1);
  if (CV.sel >= CV.layers.length) CV.sel = CV.layers.length - 1;
  if (m3) cvClearHistory(); else cvSaveState();
  cvSyncTools(); cvUI();
}
function cvMoveLayer(from, to) {   // 마스크 레이어와 일반 레이어는 서로 자리를 넘지 않는다 (NAI moveLayer)
  if (to < 0 || to >= CV.layers.length || from === to) return;
  const a = CV.layers[from], b = CV.layers[to];
  if (!a || !b || (a.type === 'mask') !== (b.type === 'mask')) return;
  CV.layers.splice(to, 0, CV.layers.splice(from, 1)[0]);
  if (from === CV.sel) CV.sel = to; else if (from < CV.sel && to >= CV.sel) CV.sel--; else if (from > CV.sel && to <= CV.sel) CV.sel++;
  cvSaveState(); cvUI();
}
function cvSelectLayer(i) {
  if (i === CV.sel) return;
  cvCommitSelection();
  const before = cvCur() && cvCur().type;
  CV.sel = i;
  if (before !== cvCur().type) cvSyncTools();
  cvUI();
}
/* 지금 레이어 종류에 맞는 도구 묶음으로 (NAI syncToolsForCurrentLayer) — 붓 크기는 종류마다 따로 기억 */
function cvSyncTools() {
  const list = cvTools();
  if (!list.some(t => t.n === CV.tool)) cvSwitchTool(list[0].n, true);
}
function cvSwitchTool(n, quiet) {
  const prev = cvToolDef(CV.tool), next = cvToolDef(n);
  if (!next) return;
  cvCommitSelection();
  if (CV.tool === 'clone') CV.clone = null;
  if (prev && prev.size) CV.ts[CV_SIZE_KEY[prev.size]] = CV.ts.size;
  if (next.size) CV.ts.size = CV.ts[CV_SIZE_KEY[next.size]];
  CV.lastTool = CV.tool; CV.tool = n;
  cvM3dToolSync();
  if (!quiet) cvUI(); else cvRender();
}

/* ═══ 3D 모델 레이어 (NAI cD.addModel3DLayer · TP 3D 화면 · 도구 켜고 끄기 — 관리자는 model3d.js) ═══ */
let CV_M3D_P = null, CV_M3D = null;   // CV_M3D: 한 번 불러온 뒤에는 도구를 바로(같은 순간에) 켜기 위해 모듈을 들고 있다
function cvM3dLib() { return CV_M3D_P || (CV_M3D_P = import('/model3d.js').then(M => (CV_M3D = M)).catch(e => { CV_M3D_P = null; throw e; })); }
function cvM3dLayerOf(mgr, id, opacity) {
  return { id: id || 'layer-' + (CV.nextId++), type: 'model3d', m3d: mgr, canvas: mgr.outputCanvas, ctx: mgr.outputCtx, scale: 1, opacity: opacity != null ? opacity : 1, ver: 0 };
}
/* 3D 레이어 더하기: 마스크 레이어들 바로 아래에 넣고 기록을 비운다 (NAI 와 같음) */
async function cvAddModel3DLayer() {
  cvCommitSelection();
  let M, mgr;
  try { M = await cvM3dLib(); mgr = await M.createModel3DManager(CV.w, CV.h); }
  catch (e) { logErr('3D 레이어를 만들지 못했습니다: ' + e.message); toast('3D 레이어를 만들지 못했습니다 — ' + e.message, 'err'); return null; }
  if (!CV.open) { mgr.dispose(); return null; }
  mgr.render();
  const L = cvM3dLayerOf(mgr), k = CV.layers.findIndex(l => l.type === 'mask');
  if (k >= 0) { CV.layers.splice(k, 0, L); CV.sel = k; } else { CV.layers.push(L); CV.sel = CV.layers.length - 1; }
  cvClearHistory(); cvSyncTools(); cvUI();
  return L;
}
/* 다시 열 때: 기억해 둔 3D 레이어를 새로 만든다 (NAI I4: 모델 파일을 다시 읽고 자세·고른 모델·조명·카메라를 되돌린다) */
async function cvM3dRestore(list) {
  const out = [];
  let M; try { M = await cvM3dLib(); } catch (e) { logErr('3D 레이어를 되살리지 못했습니다: ' + e.message); toast('3D 레이어를 되살리지 못했습니다 — ' + e.message, 'err'); return out; }
  for (const it of list) {
    const mgr = await M.createModel3DManager(CV.w, CV.h), st = it.state;
    for (const m of st.models) {
      try { const id = await mgr.addModelFromData(m.fileName, m.fileData); mgr.applyPoseSnapshot(m.poseSnapshot, id); }
      catch (e) { logErr('3D 모델을 되살리지 못했습니다(' + m.fileName + '): ' + e.message); }
    }
    if (st.selectedModelId !== null) mgr.selectedModelId = st.selectedModelId;
    mgr.restoreRenderSettings(st.renderSettings, st.cameraState); mgr.render(); mgr.renderToOutput();
    out.push(cvM3dLayerOf(mgr, it.id, it.opacity));
  }
  return out;
}
function cvM3dSerialize() { return CV.layers.filter(cvIsM3d).map(L => ({ id: L.id, opacity: L.opacity, state: L.m3d.getSerializableState() })); }
function cvM3dDisposeAll() { cvM3dDetach(); for (const L of CV.layers) if (cvIsM3d(L)) { try { L.m3d.dispose(); } catch (e) { logErr('3D 레이어 정리 실패: ' + e.message); } } }
/* 지금 레이어가 3D 면 그 자리에 3D 화면을 띄운다 (NAI: 3D 레이어를 고른 동안 viewportActive, 고르지 않은 3D 레이어는 setLayerActive(false)) */
function cvM3dSync() {
  const L = CV.open ? cvCur() : null, want = cvIsM3d(L) ? L : null;
  if (CV.m3dView && CV.m3dView.L !== want) cvM3dDetach();
  for (const x of CV.layers) if (cvIsM3d(x)) x.m3d.setLayerActive(x === want);
  if (want && !CV.m3dView) cvM3dAttach(want);
  cvM3dToolSync();
}
function cvM3dAttach(L) {
  const view = $('#cvView'); if (!view) return;
  let box = $('#cvM3d'); if (!box) { box = document.createElement('div'); box.id = 'cvM3d'; box.className = 'cv-m3d'; view.appendChild(box); }
  const el = L.m3d.getDomElement(); el.style.width = '100%'; el.style.height = '100%'; el.style.display = 'block'; box.appendChild(el);
  CV.m3dView = { L, box, ro: null }; cvM3dPlace();
  const r = box.getBoundingClientRect();
  L.m3d.viewportController.setTransformMode(CV.m3dMode);
  L.m3d.startViewport(Math.max(1, r.width), Math.max(1, r.height));
  const ro = new ResizeObserver(es => { for (const e of es) { const { width: w, height: h } = e.contentRect; if (w > 0 && h > 0 && CV.m3dView && CV.m3dView.L === L) L.m3d.viewportController.resize(w, h); } });
  ro.observe(box); CV.m3dView.ro = ro;
}
function cvM3dDetach() {
  const V = CV.m3dView; if (!V) return;
  if (CV.m3dTool) { CV.m3dTool.deactivate(); CV.m3dTool = null; }
  if (V.ro) V.ro.disconnect();
  if (V.unsub) V.unsub();
  if (cvM3dSetOpen()) cvM3dSetClose();
  V.L.m3d.stopViewport();   // NAI stop: 손잡이를 떼고 지금 모습을 그림판 그림으로 남긴다
  const el = V.L.m3d.getDomElement(); if (el.parentElement === V.box) el.remove();
  V.box.remove(); CV.m3dView = null; cvBump(V.L);
  cvM3dAnimUI(); cvM3dSideUI();
}
/* 3D 화면 자리 = 그림판 그림이 놓인 자리 (NAI displayRect: 옮긴 만큼·확대한 만큼) */
function cvM3dPlace() {
  const V = CV.m3dView; if (!V) return;
  const v = CV.view, s = V.box.style, l = v.x + 'px', t = v.y + 'px', w = CV.w * v.s + 'px', h = CV.h * v.s + 'px';
  if (s.left !== l) s.left = l; if (s.top !== t) s.top = t; if (s.width !== w) s.width = w; if (s.height !== h) s.height = h;
}
/* 지금 도구가 3D 도구면 그 도구를 3D 화면에 건다 (NAI onActivate·onDeactivate)
   NAI 는 도구를 바꾸는 그 순간 켠다 — 모델 변형으로 뼈를 누르면 포즈로 바꾸고(포즈는 켤 때 고른 뼈를 푼다) 바로 뒤에 그 뼈를 고른다.
   그래서 모듈을 불러온 뒤에는 같은 순간에 켜고, 처음 한 번만 불러오기를 기다린다. */
function cvM3dToolSync() {
  const V = CV.m3dView, want = V && (CV.tool === 'pose' || CV.tool === 'modelTransform') ? CV.tool : null, T = CV.m3dTool;
  if (T && (T.name !== want || T.mgr !== (V && V.L.m3d))) { T.deactivate(); CV.m3dTool = null; }
  if (!want || CV.m3dTool) return;
  const on = M => {
    if (!CV.m3dView || CV.m3dView !== V || CV.tool !== want || CV.m3dTool) return;
    const t = M.makeTool(want);
    t.activate(V.L.m3d, {
      saved: () => { cvBump(V.L); cvSaveState(); cvBotUI(); },   // NAI onVersionChange = saveState(지금 레이어)
      switchTool: (n, then) => { cvSwitchTool(n); if (then) then(); cvM3dSideUI(); },
    });
    CV.m3dTool = t;
  };
  if (CV_M3D) on(CV_M3D); else cvM3dLib().then(on).catch(e => logErr('3D 도구를 켜지 못했습니다: ' + e.message));
}
/* 모델 넣기: 그림판 위 단추·끌어다 놓기·붙여 넣기 (NAI C5 Import · ImageGenImportOverlay — 3D 레이어면 그림도 판으로 넣는다) */
async function cvM3dImport(L, f, record) {
  if (!cvIsM3d(L) || !f) return;
  try {
    await L.m3d.addModelFromData(f.name, await f.arrayBuffer());
    L.m3d.render(); L.m3d.renderToOutput(); cvBump(L);
    if (record) cvSaveState();
    cvUI();
  } catch (e) { logErr('3D 모델 넣기 실패(' + f.name + '): ' + e.message); toast('모델을 넣지 못했습니다 — ' + e.message, 'err'); }
}
/* 3D 레이어 그림을 새로 그린다 (화면을 띄운 동안은 그 화면 크기로 — NAI renderToOutput) */
function cvM3dRefresh(L, record) { L.m3d.render(); L.m3d.renderToOutput(); cvBump(L); if (record) cvSaveState(); else { cvRender(); cvLayersUI(); } }

/* ── 되돌리기 (NAI saveState · undo · redo, 바뀌지 않은 레이어는 앞 기록의 픽셀을 같이 쓴다) ── */
function cvSaveState() {
  const prev = CV.undo[CV.undo.length - 1];
  let owned = 0;
  const data = CV.layers.map(L => {
    if (cvIsM3d(L)) return { id: L.id, m3d: true };   // NAI: 3D 레이어는 기록에 자리만 남긴다
    const old = prev && prev.data.find(d => d.id === L.id);
    if (old && old.ver === L.ver && old.img.width === L.canvas.width && old.img.height === L.canvas.height) return old;
    const img = L.ctx.getImageData(0, 0, L.canvas.width, L.canvas.height);
    owned += img.data.byteLength;
    return { id: L.id, ver: L.ver, img };
  });
  CV.undo.push({ data, meta: CV.layers.map(L => ({ id: L.id, type: L.type, scale: L.scale, opacity: L.opacity, maskColor: L.maskColor })), order: CV.layers.map(L => L.id), sel: CV.sel, w: CV.w, h: CV.h, owned });
  CV.undoBytes += owned; CV.redo = [];
  while (CV.undoBytes > CV_UNDO_CAP && CV.undo.length > 1) CV.undoBytes -= CV.undo.shift().owned;
  cvRender(); cvLayersUI();
}
function cvBump(L) { if (L) L.ver++; }
function cvRestore(st) {
  const byId = new Map(CV.layers.map(L => [L.id, L]));
  const out = [];
  for (const id of st.order) {
    const d = st.data.find(x => x.id === id), m = st.meta.find(x => x.id === id);
    if (!d || !m) continue;
    let L = byId.get(id);
    if (d.m3d) { if (cvIsM3d(L)) { L.opacity = m.opacity; out.push(L); } continue; }   // 3D 레이어는 그대로 둔다 (NAI restoreState)
    if (!L) { const c = cvMk(d.img.width, d.img.height); L = { id, type: m.type, canvas: c, ctx: cvCtx(c), scale: m.scale, opacity: m.opacity, maskColor: m.maskColor, ver: 0 }; }
    if (L.canvas.width !== d.img.width || L.canvas.height !== d.img.height) { L.canvas.width = d.img.width; L.canvas.height = d.img.height; }
    L.ctx.putImageData(d.img, 0, 0); L.ver = d.ver; L.opacity = m.opacity; L.maskColor = m.maskColor;
    out.push(L);
  }
  for (const L of CV.layers) if (cvIsM3d(L) && !st.order.includes(L.id)) out.push(L);   // NAI: 기록에 없는 3D 레이어도 버리지 않고 맨 위에
  CV.layers = out; CV.w = st.w; CV.h = st.h;
  CV.sel = Math.min(st.sel || 0, Math.max(0, out.length - 1));
  cvSyncTools();
}
function cvUndo() {
  if (CV.undo.length <= 1) return;
  cvCancelSelection();
  const e = CV.undo.pop(); CV.redo.push(e); CV.undoBytes -= e.owned;
  cvRestore(CV.undo[CV.undo.length - 1]); cvUI();
}
function cvRedo() {
  if (!CV.redo.length) return;
  cvCancelSelection();
  const e = CV.redo.pop(); CV.undo.push(e); CV.undoBytes += e.owned;
  cvRestore(e); cvUI();
}
function cvClearHistory() { CV.undo = []; CV.redo = []; CV.undoBytes = 0; cvSaveState(); }

/* ── 합치기 (NAI getImage · getBackgroundImage) ── */
function cvCompositeNormal() {
  for (const L of CV.layers) if (cvIsM3d(L)) L.m3d.renderToOutput();   // NAI getImage: 3D 레이어를 지금 모습으로 다시 그린 뒤 합친다
  const c = cvMk(CV.w, CV.h), x = c.getContext('2d');
  for (const L of CV.layers) { if (L.type === 'mask') continue; x.globalAlpha = L.opacity; x.drawImage(L.canvas, 0, 0, CV.w, CV.h); x.globalAlpha = 1; }
  return c;
}
/* 마스크 = 마스크 레이어를 합친 1/8 그림. 집중 영역이 있으면 그 안쪽(둘레 여유를 뺀 칸)만 남기고, 거기에 칠한 것이 없으면 안쪽을 통째로 칠한다 */
function cvCompositeMask() {
  const ms = CV.layers.filter(L => L.type === 'mask');
  if (!ms.length) return { canvas: null, full: false };
  const c = cvMk(ms[0].canvas.width, ms[0].canvas.height), x = cvCtx(c);
  for (const L of ms) x.drawImage(L.canvas, 0, 0);
  let full = false;
  if (CV.focus) {
    const f = CV.focus, m = CV.ts.safeAreaSize / 8;
    const x0 = Math.min(f.from.x, f.to.x), y0 = Math.min(f.from.y, f.to.y), x1 = Math.max(f.from.x, f.to.x), y1 = Math.max(f.from.y, f.to.y);
    const r = { x: x0 + m, y: y0 + m, w: x1 - x0 - 2 * m, h: y1 - y0 - 2 * m };
    if (r.w > 0 && r.h > 0) {
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; x.fillRect(r.x, r.y, r.w, r.h); x.globalCompositeOperation = 'source-over';
      const d = x.getImageData(r.x, r.y, r.w, r.h).data; let any = false;
      for (let i = 3; i < d.length; i += 4) if (d[i]) { any = true; break; }
      if (!any) { x.fillStyle = '#fff'; x.fillRect(r.x, r.y, r.w, r.h); full = true; }
    } else x.clearRect(0, 0, c.width, c.height);
  }
  return { canvas: c, full };
}

/* ── 열기 ── */
/* opts: { mode: 'normal'|'mask', image: Blob|null, mask: {w8,h8,data}|null, width, height, onSave(result) } */
async function cvOpen(opts) {
  cvBuild();
  CV.mode = opts.mode === 'mask' ? 'mask' : 'normal';
  CV.layers = []; CV.sel = 0; CV.nextId = 1; CV.undo = []; CV.redo = []; CV.undoBytes = 0;
  CV.focus = null; CV.selT = null; CV.clone = null; CV.resized = false; CV.hsv = null; CV.onSave = opts.onSave || null; CV.src = opts.image || null;
  CV.m3dView = null; CV.m3dTool = null; CV.m3dMode = 'translate'; CV.m3dBones = false; CV.m3dMorph = false;   // NAI 그림판을 열 때마다 처음 상태
  CV.ts = Object.assign({ color: 'rgb(0, 0, 0)', opacity: 1, size: 20 }, CV_DEF, S.cvTools || {});
  CV.tool = null;
  const d = S.cvMaskDisp || {}; CV.disp = { color: d.color != null ? d.color : 0, opacity: d.opacity != null ? d.opacity : 50, pattern: d.pattern || 'solid', border: d.border != null ? d.border : true };
  // 같은 그림을 같은 모드로 다시 열면 레이어를 그대로 — 이 앱 안에서는 CV_CACHE, 앱을 다시 켠 뒤에는 NAI 처럼 그림 해시로 IndexedDB 에서
  const cached = CV.src && CV_CACHE.get(CV.src);
  let stored = null;
  if (CV.src && !(cached && cached.mode === CV.mode)) {
    try { stored = await cvStoreGet(CV.src); if (stored && stored.mode !== CV.mode) stored = null; }
    catch (e) { logErr('그림판: 기억해 둔 레이어를 읽지 못했습니다(새로 엽니다): ' + e.message); }
  }
  if (stored) { try { await cvStoreRestore(stored); } catch (e) { stored = null; logErr('그림판: 기억해 둔 레이어를 되살리지 못했습니다(새로 엽니다): ' + e.message); } }
  if (cached && cached.mode === CV.mode) {
    CV.w = cached.st.w; CV.h = cached.st.h; CV.nextId = cached.nextId; CV.layers = [];
    if (cached.m3d && cached.m3d.length) CV.layers = await cvM3dRestore(cached.m3d);   // 3D 레이어를 먼저 다시 만들어야 기록이 그 자리에 놓는다
    cvRestore(cached.st); CV.focus = cached.focus || null; CV.resized = !!cached.resized;
  } else if (stored) {
    // cvStoreRestore 가 레이어·크기·고른 레이어·집중 영역을 채웠다
  } else if (!CV.src) {
    CV.w = Math.max(64, opts.width || 1024); CV.h = Math.max(64, opts.height || 1024);
    if (CV.mode === 'mask') { cvAddLayer(false); cvAddMaskLayer(false); } else cvAddLayer(false);
  } else {
    const img = await blobToImage(await cvStripStealth(CV.src));
    let w = img.width, h = img.height; const ar = w / h;
    if (w > CV_MAX_SIDE || h > CV_MAX_SIDE) { if (ar > 1) { w = CV_MAX_SIDE; h = Math.floor(CV_MAX_SIDE / ar); } else { w = Math.floor(CV_MAX_SIDE * ar); h = CV_MAX_SIDE; } }
    if (CV.mode === 'mask') { w = Math.ceil(w / 64) * 64; h = Math.ceil(h / 64) * 64; }
    CV.w = w; CV.h = h;
    const L = cvAddLayer(false); L.ctx.drawImage(img, 0, 0, w, h); cvBump(L);
    if (CV.mode === 'mask') {
      const M = cvAddMaskLayer(false);
      if (opts.mask && opts.mask.data) cvPutMask8(M, opts.mask);
      if (opts.focus) CV.focus = JSON.parse(JSON.stringify(opts.focus));
    }
    CV.sel = CV.mode === 'mask' ? CV.layers.length - 1 : 0;
  }
  CV.tool = null; cvSwitchTool(cvTools()[0].n, true);
  cvClearHistory();
  CV.open = true; R.cvOpen = true; CV.el.hidden = false;
  CV.layersOpen = true;
  cvFit(); cvUI();
}
/* NAI removeAlphaMetadata: 알파에 숨은 메타 점(stealth)을 지우고 연다 — 지우지 않으면 저장할 때 점이 그대로 다시 실린다 */
async function cvStripStealth(blob) {
  try {
    const img = await blobToImage(blob), c = cvMk(img.width, img.height), x = cvCtx(c);
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    if (typeof stealthDetect === 'function' && stealthDetect(d) === 'stealth_pngcomp') {   // NAI v(): stealth_pngcomp 꼴만
      const a = d.data; for (let i = 3; i < a.length; i += 4) { if (a[i] === 254) a[i] = 255; else if (a[i] === 1) a[i] = 0; }
      x.putImageData(d, 0, 0);
      return await new Promise(r => c.toBlob(r, 'image/png'));
    }
  } catch (e) { logErr('그림판: 숨은 메타 지우기 실패(그대로 엽니다): ' + e.message); }
  return blob;
}
function cvPutMask8(M, mk) {   // {w8,h8,data} → 마스크 레이어 (크기가 다르면 가장 가까운 칸으로 늘이고 줄인다)
  const src = cvMk(mk.w8, mk.h8), sx = cvCtx(src), d = sx.createImageData(mk.w8, mk.h8);
  for (let k = 0; k < mk.data.length; k++) if (mk.data[k]) { const i = k * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = d.data[i + 3] = 255; }
  sx.putImageData(d, 0, 0);
  M.ctx.imageSmoothingEnabled = false; M.ctx.drawImage(src, 0, 0, M.canvas.width, M.canvas.height); M.ctx.imageSmoothingEnabled = true;
  cvBump(M);
}
function cvMask8Of(c) {        // 1/8 마스크 그림 → {w8,h8,data} (NAI binarizeImageAlpha 155)
  const d = cvCtx(c).getImageData(0, 0, c.width, c.height).data, out = new Uint8Array(c.width * c.height);
  let any = 0;
  for (let k = 0; k < out.length; k++) if (d[k * 4 + 3] > 155) { out[k] = 1; any = 1; }
  return { w8: c.width, h8: c.height, data: out, any: !!any };
}
/* 다시 열 때 이어서 고치게 남기는 것 — 마지막 기록 + 3D 레이어(모델 파일·자세·조명·카메라, NAI getSerializableState) */
function cvCacheEntry() {
  return { mode: CV.mode, st: CV.undo[CV.undo.length - 1], nextId: CV.nextId, focus: CV.focus, resized: CV.resized, m3d: cvM3dSerialize() };
}
/* NAI canvas-state-cache (I6·IJ·I1·I0·I4): 저장한 그림의 SHA-256 을 열쇠로 레이어를 IndexedDB 에 남긴다 — 앱을 껐다 켜도, 최근 5개.
   NAI 와 다른 점: 마스크 모드에서 NAI 는 마스크 그림의 해시로 남기고 다시 열 때는 바탕 그림의 해시로 찾아 한 번도 맞지 않는다
   → 저장한 바탕 그림(다음 인페인트에 쓰이는 그림)의 해시로 남긴다. 같은 앱 안에서는 닫기만 해도 이어서 고친다(CV_CACHE, 우리 앱). */
const CV_STORE_KEEP = 5;
async function cvHash(b) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))].map(v => v.toString(16).padStart(2, '0')).join(''); }
async function cvStoreRec() {   // NAI I6 — 그림 레이어는 PNG, 3D 레이어는 모델 파일·자세·조명·카메라(파일이 있는 모델만, NAI filter(fileData))
  const png = c => new Promise(r => c.toBlob(r, 'image/png')), layers = [];
  for (const L of CV.layers) {
    if (cvIsM3d(L)) { const st = L.m3d.getSerializableState(); st.models = st.models.filter(m => m.fileData); layers.push({ id: L.id, type: L.type, opacity: L.opacity, state: st }); }
    else layers.push({ id: L.id, type: L.type, imageBlob: await png(L.canvas), scale: L.scale, opacity: L.opacity, maskColor: L.maskColor });
  }
  return { timestamp: Date.now(), mode: CV.mode, canvasWidth: CV.w, canvasHeight: CV.h, selectedLayer: CV.sel, focus: CV.focus, resized: CV.resized, layers };
}
async function cvStorePut(img, rec) {   // NAI IJ + I1: 넣은 뒤 오래된 것부터 지워 5개만 남긴다
  const key = await cvHash(img); rec.imageHash = key;
  await idbSet('cvc:' + key, rec);
  const idx = ((await idbGet('cvcidx')) || []).filter(x => x.key !== key).concat([{ key, timestamp: rec.timestamp }]).sort((a, b) => a.timestamp - b.timestamp);
  for (const o of idx.splice(0, Math.max(0, idx.length - CV_STORE_KEEP))) await idbDel('cvc:' + o.key);
  await idbSet('cvcidx', idx);
}
async function cvStoreGet(img) { return (await idbGet('cvc:' + await cvHash(img))) || null; }   // NAI I0
async function cvStoreRestore(r) {   // NAI I4: 레이어를 새로 만든다 · 겹친 번호는 새 번호로(syncNextLayerId)
  const out = [], ow = CV.w, oh = CV.h;
  CV.w = r.canvasWidth; CV.h = r.canvasHeight;   // 3D 관리자는 CV.w·CV.h 크기로 만든다
  try {
    for (const d of r.layers) {
      if (d.type === 'model3d') { out.push(...await cvM3dRestore([d])); continue; }
      const c = cvMk(CV.w / d.scale, CV.h / d.scale), x = cvCtx(c);
      x.drawImage(await blobToImage(d.imageBlob), 0, 0, c.width, c.height);
      out.push({ id: d.id, type: d.type, canvas: c, ctx: x, scale: d.scale, opacity: d.opacity, maskColor: d.maskColor, ver: 0 });
    }
    if (!out.length || (CV.mode === 'mask' && !out.some(L => L.type === 'mask'))) throw new Error('되살릴 레이어가 없습니다');
  } catch (e) { for (const L of out) if (cvIsM3d(L)) L.m3d.dispose(); CV.w = ow; CV.h = oh; throw e; }
  CV.nextId = 1 + Math.max(0, ...out.map(L => +((/^layer-(\d+)$/.exec(L.id) || [])[1] || 0)));
  const seen = new Set(); for (const L of out) { if (seen.has(L.id)) L.id = 'layer-' + (CV.nextId++); seen.add(L.id); }
  CV.layers = out; CV.sel = Math.max(0, Math.min(r.selectedLayer, out.length - 1)); CV.focus = r.focus || null; CV.resized = !!r.resized;
}
function cvClose(saved, entry) {
  if (!CV.open) return;
  cvCommitSelection();
  if (CV.hsv) cvHsvCancel();
  cvM3dDetach();
  const e = entry || cvCacheEntry();
  if (CV.src) CV_CACHE.set(CV.src, e);
  cvM3dDisposeAll();   // 3D 레이어의 WebGL 은 닫을 때 놓는다 — 다시 열면 기억한 내용으로 새로 만든다
  CV.open = false; R.cvOpen = false; CV.el.hidden = true; $('#cvPop').hidden = true;
  cvM3dAnimUI(); cvM3dSideUI();
  if (!saved) toast('그림판을 닫았습니다 — 저장하지 않은 고침은 다시 열면 이어서 할 수 있습니다');
}
async function cvSave() {
  cvCommitSelection();
  if (CV.hsv) cvHsvApply();
  const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
  const res = { mode: CV.mode, w: CV.w, h: CV.h };
  res.image = await toBlob(cvCompositeNormal());
  if (CV.mode === 'mask') {
    const m = cvCompositeMask();
    res.mask = m.canvas ? cvMask8Of(m.canvas) : null;
    if (CV.focus) {
      const f = CV.focus, x0 = Math.min(f.from.x, f.to.x), y0 = Math.min(f.from.y, f.to.y);
      res.focus = { x: x0, y: y0, width: Math.max(f.from.x, f.to.x) - x0, height: Math.max(f.from.y, f.to.y) - y0, fullSizeMask: m.full };
    } else res.focus = null;
  }
  const cb = CV.onSave, entry = cvCacheEntry();
  if (CV.src) CV_CACHE.set(CV.src, entry);
  // 저장한 그림으로도 다시 열면 이어서 고치게 같은 기록을 붙인다
  if (res.image) CV_CACHE.set(res.image, entry);
  // 앱을 다시 켠 뒤에도 (NAI: 저장할 때 저장한 그림의 해시로) — 3D 관리자를 버리기 전에 담는다
  let rec = null;
  if (res.image) { try { rec = await cvStoreRec(); } catch (e) { logErr('그림판: 레이어를 기억하지 못했습니다: ' + e.message); } }
  cvClose(true, entry);
  if (rec) CV.storeP = cvStorePut(res.image, rec).catch(e => logErr('그림판: 레이어를 기억하지 못했습니다: ' + e.message));
  if (cb) await cb(res);
}

/* ── 화면 (확대·옮기기·그리기) ── */
function cvFitScale() {   // NAI Iq fitScale: 둘레 여유를 뺀 자리에 그림이 다 들어가는 배율
  const r = $('#cvView').getBoundingClientRect();
  return r.width && r.height ? Math.max(0.01, Math.min((r.width - 40) / CV.w, (r.height - 40) / CV.h)) : 1;
}
function cvFit() {
  const v = $('#cvView'), r = v.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const s = cvFitScale();
  CV.view = { s, x: (r.width - CV.w * s) / 2, y: (r.height - CV.h * s) / 2 };
  cvResizeScreen(); cvRender();
}
function cvResizeScreen() {
  const v = $('#cvView'), sc = $('#cvScreen'), r = v.getBoundingClientRect();
  CV.dpr = window.devicePixelRatio || 1;
  sc.width = Math.max(1, Math.round(r.width * CV.dpr)); sc.height = Math.max(1, Math.round(r.height * CV.dpr));
  sc.style.width = r.width + 'px'; sc.style.height = r.height + 'px';
}
function cvRender() { if (!CV.open || CV._raf) return; CV._raf = requestAnimationFrame(() => { CV._raf = 0; cvDraw(); }); }
/* 투명한 곳 체크무늬 — NAI 그림판 C1: 흰 바탕에 #A0A0A0 15px 칸(화면 화소, 확대해도 칸 크기 그대로) /
   레이어 작은 그림 TH: 흰 바탕에 #a0a0a0 8px 칸 */
const CV_CHECK = {};
function cvChecker(x, small) {
  const k = small ? 'thumb' : 'stage';
  if (!CV_CHECK[k]) { const n = small ? 16 : 30, t = cvMk(n, n), c = t.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, n, n); c.fillStyle = small ? '#a0a0a0' : '#A0A0A0'; c.fillRect(0, 0, n / 2, n / 2); c.fillRect(n / 2, n / 2, n / 2, n / 2); CV_CHECK[k] = t; }
  return x.createPattern(CV_CHECK[k], 'repeat');
}
/* 3D 화면을 띄운 동안의 바탕 — NAI: 테마 바탕색(bg0)이 밝으면 흰색, 어두우면 검은색 (체크무늬 없음)
   밝다 = colorIsLight: polished getLuminance(sRGB 를 선형으로 바꾼 상대 휘도, 소수 셋째 자리) > 0.179 */
let CV_BG = null;
function cvStageBg() {
  const m = getComputedStyle(document.documentElement).getPropertyValue('--bg0').trim();
  if (CV_BG && CV_BG.k === m) return CV_BG.v;
  const c = cvMk(1, 1), x = c.getContext('2d'); x.fillStyle = m || '#000'; x.fillRect(0, 0, 1, 1);
  const [r, g, b] = [...x.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  CV_BG = { k: m, v: parseFloat((0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(3)) > 0.179 ? '#ffffff' : '#000000' };
  return CV_BG.v;
}
function cvDraw() {
  const sc = $('#cvScreen'), x = sc.getContext('2d'), v = CV.view, d = CV.dpr, m3on = !!CV.m3dView;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, sc.width, sc.height);
  x.setTransform(d, 0, 0, d, 0, 0);
  x.save(); x.translate(v.x, v.y);
  if (m3on) { x.fillStyle = cvStageBg(); x.fillRect(0, 0, CV.w * v.s, CV.h * v.s); } else { x.fillStyle = cvChecker(x); x.fillRect(0, 0, CV.w * v.s, CV.h * v.s); }
  x.restore();
  x.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y);
  const st = CV.ts;
  for (let i = 0; i < CV.layers.length; i++) {
    const L = CV.layers[i], cur = i === CV.sel;
    if (L.type === 'mask') { cvDrawMask(x, L); continue; }
    if (cvIsM3d(L)) {   // NAI: 3D 화면을 띄운 레이어는 그 화면이 대신 보인다
      if (cur && m3on) continue;
      x.imageSmoothingEnabled = true; x.globalAlpha = L.opacity; x.drawImage(L.canvas, 0, 0, CV.w, CV.h); x.globalAlpha = 1; continue;
    }
    x.imageSmoothingEnabled = v.s < 1;
    const ov = cur ? st.overlay : null;
    x.globalAlpha = L.opacity;
    if (!(ov && st.hidesLayer)) x.drawImage(L.canvas, 0, 0, CV.w, CV.h);
    if (ov) { x.globalAlpha = L.opacity * (st.overlayAlpha != null ? st.overlayAlpha : 1); x.drawImage(ov, 0, 0, CV.w, CV.h); }
    x.globalAlpha = 1;
    if (cur && CV.selT && CV.selT.cap) cvDrawSelContent(x);
  }
  x.setTransform(d, 0, 0, d, 0, 0);
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1; x.strokeRect(v.x, v.y, CV.w * v.s, CV.h * v.s);   // NAI: 그림판 테두리 (화면 1화소)
  cvDrawOverlay(x);
  cvM3dPlace();
}
/* 마스크 레이어 보이기 — NAI 마스크 표시 셰이더와 같은 뜻: 칠한 칸에 색을 입히고, 무늬·테두리(안쪽으로 깎은 자리)를 보이고, 불투명도를 건다 */
function cvDrawMask(x, L) {
  const v = CV.view, D = CV.disp, col = CV_MASK_COLORS[D.color] || L.maskColor;
  const sc = $('#cvScreen'), W = sc.width, H = sc.height, d = CV.dpr;
  if (!CV._mt || CV._mt.width !== W || CV._mt.height !== H) { CV._mt = cvMk(W, H); CV._mt2 = cvMk(W, H); }
  const t = CV._mt, tx = t.getContext('2d'); tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, W, H);
  tx.imageSmoothingEnabled = false;
  tx.setTransform(d * v.s * 8, 0, 0, d * v.s * 8, d * v.x, d * v.y); tx.drawImage(L.canvas, 0, 0); tx.setTransform(1, 0, 0, 1, 0, 0);
  const solid = D.pattern === 'solid';
  if (!solid || D.border) {
    const u = CV._mt2, ux = u.getContext('2d'); ux.setTransform(1, 0, 0, 1, 0, 0); ux.clearRect(0, 0, W, H);
    if (!solid) { ux.drawImage(t, 0, 0); ux.globalCompositeOperation = 'source-in'; ux.fillStyle = ux.createPattern(cvPatternTile(D.pattern), 'repeat'); ux.fillRect(0, 0, W, H); ux.globalCompositeOperation = 'source-over'; }
    else { ux.drawImage(t, 0, 0); }
    if (D.border && !solid) {   // 테두리 = 칠한 곳 − 안쪽으로 2px 깎은 곳 (8방향)
      const e = cvMk(W, H), ex = e.getContext('2d'); ex.drawImage(t, 0, 0); ex.globalCompositeOperation = 'destination-in';
      const bw = Math.max(1, Math.round(2 * d));
      for (const [ox, oy] of [[-bw, 0], [bw, 0], [0, -bw], [0, bw], [-bw, -bw], [-bw, bw], [bw, -bw], [bw, bw]]) ex.drawImage(t, ox, oy);
      const ring = cvMk(W, H), rx = ring.getContext('2d'); rx.drawImage(t, 0, 0); rx.globalCompositeOperation = 'destination-out'; rx.drawImage(e, 0, 0);
      ux.drawImage(ring, 0, 0);
    }
    tx.clearRect(0, 0, W, H); tx.drawImage(u, 0, 0);
  }
  tx.globalCompositeOperation = 'source-in'; tx.fillStyle = col; tx.fillRect(0, 0, W, H); tx.globalCompositeOperation = 'source-over';
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = D.opacity / 100; x.drawImage(t, 0, 0); x.restore();
}
const CV_PAT = {};
function cvPatternTile(p) {
  if (CV_PAT[p]) return CV_PAT[p];
  const s = Math.round(12 * (window.devicePixelRatio || 1)), t = cvMk(s, s), c = t.getContext('2d');
  c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, s / 6);
  if (p === 'stripes') { c.beginPath(); c.moveTo(0, s); c.lineTo(s, 0); c.moveTo(-s / 2, s / 2); c.lineTo(s / 2, -s / 2); c.moveTo(s / 2, s * 1.5); c.lineTo(s * 1.5, s / 2); c.stroke(); }
  else if (p === 'dots') { c.beginPath(); c.arc(s / 2, s / 2, s / 5, 0, Math.PI * 2); c.fill(); }
  else if (p === 'crosshatch') { c.beginPath(); c.moveTo(0, s); c.lineTo(s, 0); c.moveTo(0, 0); c.lineTo(s, s); c.stroke(); }
  else if (p === 'grid') { c.fillRect(0, 0, s, Math.max(1, s / 8)); c.fillRect(0, 0, Math.max(1, s / 8), s); }
  else if (p === 'checker') { c.fillRect(0, 0, s / 2, s / 2); c.fillRect(s / 2, s / 2, s / 2, s / 2); }
  else if (p === 'hearts') { const r = s / 4; c.beginPath(); c.moveTo(s / 2, s * 0.8); c.bezierCurveTo(s * 0.1, s * 0.5, s * 0.2, s * 0.15, s / 2, s * 0.35); c.bezierCurveTo(s * 0.8, s * 0.15, s * 0.9, s * 0.5, s / 2, s * 0.8); c.fill(); void r; }
  else c.fillRect(0, 0, s, s);
  CV_PAT[p] = t; return t;
}
/* 선택한 내용(옮기는 중) — NAI select·lasso 의 getTransformedContent 와 같은 자리에 그린다 */
function cvDrawSelContent(x) {
  const s = CV.selT, tf = s.tf;
  x.save(); x.imageSmoothingEnabled = false;
  x.translate(tf.x, tf.y); x.rotate(tf.rot * Math.PI / 180); x.scale(tf.sx, tf.sy); x.drawImage(s.cap, 0, 0);
  x.restore();
}
function cvToScreen(px, py) { return { x: CV.view.x + px * CV.view.s, y: CV.view.y + py * CV.view.s }; }
function cvDrawOverlay(x) {
  const v = CV.view;
  // 선택 영역 테두리 (점선)
  if (CV.selT) {
    const s = CV.selT;
    x.save(); x.lineWidth = 1; x.setLineDash([5, 4]);
    const path = () => {
      x.beginPath();
      if (s.cap) { cvSelCorners().forEach((p, i) => { const q = cvToScreen(p.x, p.y); if (i) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y); }); x.closePath(); }
      else if (s.kind === 'lasso' && s.path.length > 1) { s.path.forEach((p, i) => { const q = cvToScreen(p.x, p.y); if (i) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y); }); if (!s.selecting) x.closePath(); }
      else if (s.from && s.to) { const a = cvToScreen(Math.min(s.from.x, s.to.x), Math.min(s.from.y, s.to.y)), b = cvToScreen(Math.max(s.from.x, s.to.x), Math.max(s.from.y, s.to.y)); x.rect(a.x, a.y, b.x - a.x, b.y - a.y); }
    };
    x.strokeStyle = '#000'; path(); x.stroke(); x.lineDashOffset = 4.5; x.strokeStyle = '#fff'; path(); x.stroke();
    x.setLineDash([]);
    if (s.cap) {   // 크기·돌리기 손잡이
      for (const h of cvSelHandles()) { const q = cvToScreen(h.x, h.y); x.fillStyle = '#fff'; x.strokeStyle = '#333'; x.beginPath(); if (h.k === 'rot') x.arc(q.x, q.y, 6, 0, Math.PI * 2); else x.rect(q.x - 5, q.y - 5, 10, 10); x.fill(); x.stroke(); }
    }
    x.restore();
  }
  // 집중 영역 (마스크 모드): 바깥 네모 = 그릴 영역, 안쪽 점선 = 둘레 여유를 뺀 마스크가 쓰이는 곳
  if (CV.mode === 'mask' && CV.focus) {
    const f = CV.focus, x0 = Math.min(f.from.x, f.to.x) * 8, y0 = Math.min(f.from.y, f.to.y) * 8, x1 = Math.max(f.from.x, f.to.x) * 8, y1 = Math.max(f.from.y, f.to.y) * 8;
    const a = cvToScreen(x0, y0), b = cvToScreen(x1, y1), m = CV.ts.safeAreaSize * v.s;
    x.save(); x.strokeStyle = '#ffd34d'; x.lineWidth = 2; x.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    x.setLineDash([6, 4]); x.lineWidth = 1; if (b.x - a.x > 2 * m && b.y - a.y > 2 * m) x.strokeRect(a.x + m, a.y + m, b.x - a.x - 2 * m, b.y - a.y - 2 * m);
    x.setLineDash([]); x.fillStyle = '#ffd34d'; x.fillRect(b.x - 6, b.y - 6, 8, 8);
    x.restore();
  }
  // 복제 원본 자리
  if (CV.tool === 'clone' && CV.clone && CV.clone.src) {
    const p = CV.clone.drawing && CV.ptr ? { x: CV.ptr.x - CV.clone.off.x, y: CV.ptr.y - CV.clone.off.y } : CV.clone.src, q = cvToScreen(p.x, p.y);
    x.save(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(q.x - 7, q.y); x.lineTo(q.x + 7, q.y); x.moveTo(q.x, q.y - 7); x.lineTo(q.x, q.y + 7); x.stroke(); x.restore();
  }
  // 붓 모양 커서
  const td = cvToolDef(CV.tool);
  if (CV.ptr && td && td.size && !CV.pan) {
    const p = CV.ptr, mask = td.size === 'mask';
    x.save(); x.lineWidth = 1;
    const outline = () => {
      x.beginPath();
      if (mask) {   // 마스크 붓은 칸에 맞춘 네모·원 (NAI pixelRect 커서)
        const r = CV.ts.size / 2, cx = Math.floor(p.x / 8), cy = Math.floor(p.y / 8);
        if (CV.ts.maskDrawShape === 'square') { const sx = Math.round(p.x / 8 - r), sy = Math.round(p.y / 8 - r), a = cvToScreen(sx * 8, sy * 8); x.rect(a.x, a.y, CV.ts.size * 8 * v.s, CV.ts.size * 8 * v.s); }
        else { const q = cvToScreen((cx + 0.5) * 8, (cy + 0.5) * 8); x.arc(q.x, q.y, Math.max(1, Math.round(r) + 0.5) * 8 * v.s, 0, Math.PI * 2); }
      } else {
        const sz = CV.ts.size * (CV.ts.currentPressure || 1), q = cvToScreen(p.x, p.y);
        if ((CV.tool === 'draw' || CV.tool === 'erase') && CV.ts.brushTip === 'square') x.rect(q.x - sz * v.s / 2, q.y - sz * v.s / 2, sz * v.s, sz * v.s);
        else x.arc(q.x, q.y, Math.max(1, sz * v.s / 2), 0, Math.PI * 2);
      }
    };
    x.strokeStyle = '#000'; outline(); x.stroke(); x.strokeStyle = '#fff'; x.setLineDash([3, 3]); outline(); x.stroke();
    x.restore();
  }
}

/* ── 포인터 → 그림 좌표 ── */
function cvImgPt(e) {
  const r = $('#cvView').getBoundingClientRect();
  return { x: (e.clientX - r.left - CV.view.x) / CV.view.s, y: (e.clientY - r.top - CV.view.y) / CV.view.s };
}
function cvLayerPt(p) { const L = cvCur(); return L && L.scale !== 1 ? { x: p.x / L.scale, y: p.y / L.scale } : { x: p.x, y: p.y }; }
function cvPressureSize(e) {
  const ts = CV.ts, on = ts.pressureSensitivity && e.pointerType && e.pointerType !== 'mouse';
  CV._press = on ? (e.pressure || CV._press || 1) : 1; ts.currentPressure = CV._press;
  return ts.size * CV._press;
}

/* ═══ 도구 ═══ */
/* 그리기·지우기 (NAI c$ 의 2D 길: 붓 모양 둥근·부드러운·네모, 필압이면 굵기가 마디마다 다르다) */
function cvTip() { return CV.ts.brushTip === 'softRound' ? { cap: 'round', join: 'round', filter: s => `blur(${0.15 * s}px)`, square: false } : CV.ts.brushTip === 'square' ? { cap: 'square', join: 'miter', filter: null, square: true } : { cap: 'round', join: 'round', filter: null, square: false }; }
function cvStampSquares(c, a, b, sa, sb) {
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / Math.max(1, (sa + sb) / 2 * 0.25)));
  for (let i = 0; i <= n; i++) { const t = n === 0 ? 1 : i / n, x = a.x + dx * t, y = a.y + dy * t, s = sa + (sb - sa) * t; c.fillRect(x - s / 2, y - s / 2, s, s); }
}
function cvRedrawStroke(st) {
  const c = st.ctx, P = st.points; if (!c || !P.length) return;
  const tip = cvTip(), soft = !!tip.filter;
  if (P.length === 1) {
    c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.globalAlpha = 1; c.fillStyle = st.color;
    const p = P[0]; if (soft) c.filter = tip.filter(p.size);
    if (tip.square) c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); else { c.beginPath(); c.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); c.fill(); }
    if (soft) c.filter = 'none';
    st.last = 0; return;
  }
  if (tip.square) {
    const from = Math.max(1, st.last); if (from >= P.length) return;
    c.globalAlpha = 1; c.fillStyle = st.color;
    for (let i = from; i < P.length; i++) cvStampSquares(c, P[i - 1], P[i], P[i - 1].size, P[i].size);
    st.last = P.length - 1; return;
  }
  c.lineCap = tip.cap; c.lineJoin = tip.join; c.strokeStyle = st.color; c.globalAlpha = 1;
  if (!soft && st.uniform) {
    const from = Math.max(1, st.last); if (from >= P.length) return;
    c.lineWidth = P[0].size; c.beginPath(); c.moveTo(P[from - 1].x, P[from - 1].y);
    for (let i = from; i < P.length; i++) c.lineTo(P[i].x, P[i].y);
    c.stroke(); st.last = P.length - 1;
  } else if (soft && st.uniform) {
    c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.lineWidth = P[0].size; c.filter = tip.filter(P[0].size);
    c.beginPath(); c.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) c.lineTo(P[i].x, P[i].y); c.stroke(); c.filter = 'none';
  } else {
    const from = Math.max(1, st.last); if (from >= P.length) return;
    for (let i = from; i < P.length; i++) {
      const a = P[i - 1], b = P[i], w = (a.size + b.size) / 2; c.lineWidth = w; if (soft) c.filter = tip.filter(w);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    c.filter = 'none'; st.last = P.length - 1;
  }
}
function cvStrokeDown(p, e, erase) {
  const L = cvCur(), W = L.canvas.width, H = L.canvas.height;
  const st = CV.act = { kind: 'stroke', erase, points: [{ x: p.x, y: p.y, size: cvPressureSize(e) }], uniform: !(CV.ts.pressureSensitivity && e.pointerType !== 'mouse'), last: 0, color: erase ? 'rgb(255, 255, 255)' : cvOpaque(CV.ts.color) };
  st.canvas = cvMk(W, H); st.ctx = cvCtx(st.canvas);
  if (erase) { st.prev = cvMk(W, H); st.pctx = st.prev.getContext('2d'); CV.ts.overlay = st.prev; CV.ts.hidesLayer = true; CV.ts.overlayAlpha = 1; }
  else { CV.ts.overlay = st.canvas; CV.ts.hidesLayer = false; CV.ts.overlayAlpha = CV.ts.opacity; }
  cvRedrawStroke(st); if (erase) cvErasePreview(st, L);
}
function cvErasePreview(st, L) { const c = st.pctx; c.globalCompositeOperation = 'copy'; c.drawImage(L.canvas, 0, 0); c.globalCompositeOperation = 'destination-out'; c.drawImage(st.canvas, 0, 0); c.globalCompositeOperation = 'source-over'; }
function cvStrokeMove(p, e) { const st = CV.act; st.points.push({ x: p.x, y: p.y, size: cvPressureSize(e) }); cvRedrawStroke(st); if (st.erase) cvErasePreview(st, cvCur()); }
function cvStrokeUp(p, e) {
  const st = CV.act, L = cvCur(); st.points.push({ x: p.x, y: p.y, size: cvPressureSize(e) }); cvRedrawStroke(st);
  L.ctx.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over'; L.ctx.globalAlpha = st.erase ? 1 : CV.ts.opacity;
  L.ctx.drawImage(st.canvas, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = 'source-over';
  CV.ts.overlay = null; CV.ts.hidesLayer = false; cvBump(L); cvSaveState();
}
/* 채우기 (NAI cJ: 누른 칸과 색 거리(빨·초·파·투명 네 값의 제곱합)가 허용 범위² 이하인 이웃을 같은 색으로) */
function cvFill(p) {
  const L = cvCur(), c = L.ctx, W = L.canvas.width, H = L.canvas.height, ox = Math.floor(p.x), oy = Math.floor(p.y);
  if (ox < 0 || oy < 0 || ox >= W || oy >= H) return;
  const img = c.getImageData(0, 0, W, H), u = img.data, h = (oy * W + ox) * 4, R0 = u[h], G0 = u[h + 1], B0 = u[h + 2], A0 = u[h + 3];
  const col = cvRgb(CV.ts.color), A = Math.round(255 * CV.ts.opacity);
  if (R0 === col.r && G0 === col.g && B0 === col.b && A0 === A) return;
  const tol = CV.ts.fillTolerance || 0, tt = tol * tol;
  const near = i => { const a = u[i] - R0, b = u[i + 1] - G0, d = u[i + 2] - B0, e = u[i + 3] - A0; return a * a + b * b + d * d + e * e <= tt; };
  const put = i => { u[i] = col.r; u[i + 1] = col.g; u[i + 2] = col.b; u[i + 3] = A; };
  cvFlood(u, W, H, ox, oy, near, put);
  c.putImageData(img, 0, 0); cvBump(L); cvSaveState();
}
function cvFlood(u, W, H, ox, oy, near, put) {   // NAI 와 같은 줄 단위 채우기
  const seen = new Uint8Array(W * H); let S0 = 8192, st = new Int32Array(S0), k = 0;
  st[k++] = ox; st[k++] = oy; seen[oy * W + ox] = 1;
  const push = (x, y) => { if (k + 2 > S0) { const n = new Int32Array(S0 *= 2); n.set(st); st = n; } st[k++] = x; st[k++] = y; };
  while (k > 0) {
    const y = st[--k], x = st[--k], row = y * W; let l = x, r = x;
    while (l > 0 && !seen[row + l - 1] && near((row + l - 1) * 4)) seen[row + --l] = 1;
    while (r < W - 1 && !seen[row + r + 1] && near((row + r + 1) * 4)) seen[row + ++r] = 1;
    for (let t = l; t <= r; t++) {
      put((row + t) * 4);
      if (y > 0) { const i = (y - 1) * W + t; if (!seen[i] && near(4 * i)) { seen[i] = 1; push(t, y - 1); } }
      if (y < H - 1) { const i = (y + 1) * W + t; if (!seen[i] && near(4 * i)) { seen[i] = 1; push(t, y + 1); } }
    }
  }
}
/* 색 고르기 (NAI getCompositePixelColor: 보이는 레이어를 아래부터 불투명도까지 겹친 색) */
function cvPickColor(p) {
  const tx = Math.floor(p.x), ty = Math.floor(p.y); if (tx < 0 || ty < 0 || tx >= CV.w || ty >= CV.h) return;
  let r = 0, g = 0, b = 0, a = 0;
  for (const L of CV.layers) {
    const lx = Math.floor(tx / L.scale), ly = Math.floor(ty / L.scale); if (lx >= L.canvas.width || ly >= L.canvas.height) continue;
    const s = L.ctx.getImageData(lx, ly, 1, 1).data, al = s[3] / 255 * L.opacity; if (!al) continue;
    const na = al + a / 255 * (1 - al);
    if (na > 0) { r = (s[0] * al + a / 255 * r * (1 - al)) / na; g = (s[1] * al + a / 255 * g * (1 - al)) / na; b = (s[2] * al + a / 255 * b * (1 - al)) / na; a = 255 * na; }
  }
  CV.ts.color = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`; cvSettingsUI();
}
/* 흐리기 붓 (NAI c3: 가장자리를 늘린 흐린 사본을 만들고, 부드러운 붓 자국 모양으로만 흐린 사본을 덮는다) */
function cvBlurDown(p, e) {
  const L = cvCur(), W = L.canvas.width, H = L.canvas.height, ts = CV.ts;
  const st = CV.act = { kind: 'blur', points: [{ x: p.x, y: p.y, size: cvPressureSize(e) }], uniform: !(ts.pressureSensitivity && e.pointerType !== 'mouse') };
  const o = Math.max(1, 0.3 * ts.blurIntensity), sh = 0.15 * ts.size; st.feather = sh > 0 ? `blur(${sh}px)` : '';
  st.snap = cvMk(W, H); st.snap.getContext('2d').drawImage(L.canvas, 0, 0);
  const pad = Math.ceil(3 * o), big = cvMk(W + 2 * pad, H + 2 * pad), bx = big.getContext('2d'), s = L.canvas;
  bx.drawImage(s, pad, pad); bx.drawImage(s, 0, 0, W, 1, pad, 0, W, pad); bx.drawImage(s, 0, H - 1, W, 1, pad, H + pad, W, pad);
  bx.drawImage(s, 0, 0, 1, H, 0, pad, pad, H); bx.drawImage(s, W - 1, 0, 1, H, W + pad, pad, pad, H);
  bx.drawImage(s, 0, 0, 1, 1, 0, 0, pad, pad); bx.drawImage(s, W - 1, 0, 1, 1, W + pad, 0, pad, pad); bx.drawImage(s, 0, H - 1, 1, 1, 0, H + pad, pad, pad); bx.drawImage(s, W - 1, H - 1, 1, 1, W + pad, H + pad, pad, pad);
  st.blurred = cvMk(W, H); const pb = st.blurred.getContext('2d'); pb.filter = `blur(${o}px)`; pb.drawImage(big, -pad, -pad); pb.filter = 'none';
  st.mask = cvMk(W, H); st.mctx = st.mask.getContext('2d'); st.prev = cvMk(W, H); st.pctx = st.prev.getContext('2d');
  CV.ts.overlay = st.prev; CV.ts.hidesLayer = true; CV.ts.overlayAlpha = 1;
  cvBlurRedraw(st);
}
function cvBlurRedraw(st) {
  const c = st.mctx, P = st.points; c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.globalAlpha = 1; c.fillStyle = c.strokeStyle = '#fff';
  if (st.feather) c.filter = st.feather;
  if (P.length === 1) { c.beginPath(); c.arc(P[0].x, P[0].y, P[0].size / 2, 0, Math.PI * 2); c.fill(); }
  else if (st.uniform) { c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = P[0].size; c.beginPath(); c.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) c.lineTo(P[i].x, P[i].y); c.stroke(); }
  else { c.lineCap = 'round'; c.lineJoin = 'round'; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; c.lineWidth = (a.size + b.size) / 2; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); } }
  c.filter = 'none';
  const x = st.pctx; x.globalCompositeOperation = 'copy'; x.drawImage(st.blurred, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(st.mask, 0, 0);
  x.globalCompositeOperation = 'destination-over'; x.drawImage(st.snap, 0, 0); x.globalCompositeOperation = 'source-over';
}
function cvBlurMove(p, e) { CV.act.points.push({ x: p.x, y: p.y, size: cvPressureSize(e) }); cvBlurRedraw(CV.act); }
function cvBlurUp(p, e) {
  const st = CV.act, L = cvCur(); st.points.push({ x: p.x, y: p.y, size: cvPressureSize(e) }); cvBlurRedraw(st);
  L.ctx.globalCompositeOperation = 'copy'; L.ctx.drawImage(st.prev, 0, 0); L.ctx.globalCompositeOperation = 'source-over';
  CV.ts.overlay = null; CV.ts.hidesLayer = false; cvBump(L); cvSaveState();
}
/* 복제 붓 (NAI c5: Alt+클릭으로 가져올 자리를 정하고, 칠하는 자리와의 거리만큼 떨어진 곳을 둥글게 찍어 옮긴다) */
function cvCloneDown(p, e) {
  if (e.altKey) { CV.clone = { src: { x: p.x, y: p.y } }; return; }
  if (!CV.clone || !CV.clone.src) { toast('복제: 먼저 Alt+클릭으로 가져올 자리를 정해 주세요'); return; }
  const L = cvCur(), W = L.canvas.width, H = L.canvas.height;
  CV.clone.off = { x: p.x - CV.clone.src.x, y: p.y - CV.clone.src.y }; CV.clone.drawing = true;
  const st = CV.act = { kind: 'clone' };
  st.snap = cvMk(W, H); st.snap.getContext('2d').drawImage(L.canvas, 0, 0);
  st.out = cvMk(W, H); st.octx = st.out.getContext('2d'); st.octx.drawImage(L.canvas, 0, 0);
  CV.ts.overlay = st.out; CV.ts.hidesLayer = true; CV.ts.overlayAlpha = 1;
  const s = cvPressureSize(e); cvCloneStamp(st, p.x, p.y, s); st.last = { x: p.x, y: p.y }; st.lastSize = s;
}
function cvCloneStamp(st, x, y, size) {
  const c = st.octx, r = size / 2, sx = x - CV.clone.off.x, sy = y - CV.clone.off.y;
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip(); c.drawImage(st.snap, sx - r, sy - r, size, size, x - r, y - r, size, size); c.restore();
}
function cvCloneSeg(st, a, b, sa, sb) {
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / Math.max(1, (sa + sb) / 2 * 0.25)));
  for (let i = 0; i <= n; i++) { const t = n === 0 ? 1 : i / n; cvCloneStamp(st, a.x + dx * t, a.y + dy * t, sa + (sb - sa) * t); }
}
function cvCloneMove(p, e) { const st = CV.act; if (!st || st.kind !== 'clone') return; const s = cvPressureSize(e); cvCloneSeg(st, st.last, p, st.lastSize, s); st.last = { x: p.x, y: p.y }; st.lastSize = s; }
function cvCloneUp(p, e) {
  const st = CV.act, L = cvCur(); if (!st || st.kind !== 'clone') return;
  cvCloneSeg(st, st.last, p, st.lastSize, cvPressureSize(e));
  L.ctx.globalCompositeOperation = 'copy'; L.ctx.drawImage(st.out, 0, 0); L.ctx.globalCompositeOperation = 'source-over';
  CV.ts.overlay = null; CV.ts.hidesLayer = false; CV.clone.drawing = false; cvBump(L); cvSaveState();
}

/* ── 마스크 도구 (NAI c7·c9·dt·de — 1/8 레이어에 칸 단위로) ── */
function cvMaskStamp(c, x, y, erase) {
  const ts = CV.ts;
  if (ts.maskDrawShape === 'square') { const n = Math.round(x - ts.size / 2), m = Math.round(y - ts.size / 2); cvPixRect(c, n, m, ts.size, ts.size, erase); }
  else cvPixCircle(c, Math.floor(x), Math.floor(y), Math.round(ts.size / 2), erase);
}
function cvPixRect(c, x, y, w, h, erase) {   // NAI c6
  if (w <= 0 || h <= 0) return;
  const d = c.getImageData(x, y, w, h); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = erase ? 0 : 255; d.data[i + 3] = erase ? 0 : 255; }
  c.putImageData(d, x, y);
}
function cvPixCircle(c, cx, cy, r, erase) {  // NAI c4: 칸의 안쪽 모서리까지 거리로 정하는 정수 원
  const sx = cx - r, sy = cy - r, n = 2 * r + 1, d = c.getImageData(sx, sy, n, n), v = erase ? 0 : 255;
  for (let e = 0; e <= r; e++) for (let t = 0; t <= r; t++) {
    if (Math.min(Math.hypot(t + 0.5, e + 0.5), Math.hypot(t - 0.5, e - 0.5)) <= r) {
      for (const i of [(r + t) * 4 + (r + e) * n * 4, (r - t) * 4 + (r + e) * n * 4, (r + t) * 4 + (r - e) * n * 4, (r - t) * 4 + (r - e) * n * 4]) { d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = v; }
    }
  }
  c.putImageData(d, sx, sy);
}
function cvMaskDown(p, erase) { const L = cvCur(), q = cvLayerPt(p); CV.act = { kind: 'mask', erase, last: q }; cvMaskStamp(L.ctx, q.x, q.y, erase); cvBump(L); }
function cvMaskMove(p) {
  const st = CV.act, L = cvCur(), q = cvLayerPt(p), a = st.last, r = CV.ts.size / 2;
  const dx = q.x - a.x, dy = q.y - a.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, 0.5 * r)));
  for (let k = 1; k <= n; k++) cvMaskStamp(L.ctx, a.x + dx * k / n, a.y + dy * k / n, st.erase);
  st.last = q; cvBump(L);
}
function cvMaskFill(p) {   // NAI dt: 누른 칸과 똑같은 색인 이웃을 흰색으로
  const L = cvCur(), q = cvLayerPt(p), W = L.canvas.width, H = L.canvas.height, ox = Math.floor(q.x), oy = Math.floor(q.y);
  if (ox < 0 || oy < 0 || ox >= W || oy >= H) return;
  const img = L.ctx.getImageData(0, 0, W, H), u = img.data, h = (oy * W + ox) * 4, r0 = u[h], g0 = u[h + 1], b0 = u[h + 2], a0 = u[h + 3];
  if (r0 === 255 && g0 === 255 && b0 === 255 && a0 === 255) return;
  cvFlood(u, W, H, ox, oy, i => u[i] === r0 && u[i + 1] === g0 && u[i + 2] === b0 && u[i + 3] === a0, i => { u[i] = u[i + 1] = u[i + 2] = u[i + 3] = 255; });
  L.ctx.putImageData(img, 0, 0); cvBump(L); cvSaveState();
}
/* 집중 영역 (NAI de): 칸 단위 네모. 넓이는 768×768 화소까지, 오른쪽 아래 손잡이로 크기, 안을 끌면 옮김(둘레 여유만큼 밖으로 나갈 수 있음) */
function cvFocusDown(p) {
  const q = cvLayerPt(p), f = CV.focus; let handle = false;
  CV.act = { kind: 'focus', selecting: false, moving: false, last: q };
  if (f) {
    const x0 = Math.min(f.from.x, f.to.x), x1 = Math.max(f.from.x, f.to.x), y0 = Math.min(f.from.y, f.to.y), y1 = Math.max(f.from.y, f.to.y);
    const sw = Math.min(4, Math.abs(x0 - x1)), sh = Math.min(4, Math.abs(y0 - y1)), hx = f.to.x === x0 ? x0 : x1 - 4 + sw, hy = f.to.y === y0 ? y0 : y1 - 4 + sh;
    if (q.x >= hx - sw && q.x <= hx + sw && q.y >= hy - sh && q.y <= hy + sh) handle = true;
    else if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) CV.act.moving = true;
  }
  if (!CV.act.moving) { CV.act.selecting = true; if (!handle) { const t = { x: Math.round(q.x), y: Math.round(q.y) }; CV.focus = { from: t, to: { ...t } }; } }
}
function cvFocusMove(p) {
  const st = CV.act, f = CV.focus, L = cvCur(); if (!f) return;
  const q = cvLayerPt(p);
  if (st.selecting) {
    const t = { x: Math.round(Math.max(Math.min(q.x, L.canvas.width), 0)), y: Math.round(Math.max(Math.min(q.y, L.canvas.height), 0)) };
    const lim = CV_FOCUS_MAX / 64, area = Math.abs(f.from.x - t.x) * Math.abs(f.from.y - t.y);
    if (area > lim) { const k = Math.sqrt(lim / area); t.x = f.from.x + (t.x - f.from.x) * k; t.y = f.from.y + (t.y - f.from.y) * k; }
    CV.focus = { from: f.from, to: t };
  }
  if (st.moving) {
    const m = CV.ts.safeAreaSize / 8; let dx = q.x - st.last.x, dy = q.y - st.last.y;
    const x0 = Math.min(f.from.x, f.to.x), y0 = Math.min(f.from.y, f.to.y), x1 = Math.max(f.from.x, f.to.x), y1 = Math.max(f.from.y, f.to.y);
    if (x0 + dx < -m) dx = -m - x0; if (y0 + dy < -m) dy = -m - y0;
    if (x1 + dx > L.canvas.width + m) dx = L.canvas.width + m + 1 - x1; if (y1 + dy > L.canvas.height + m) dy = L.canvas.height + m + 1 - y1;
    const fx = dx > 0 ? dx - Math.floor(dx) : dx - Math.ceil(dx), fy = dy > 0 ? dy - Math.floor(dy) : dy - Math.ceil(dy);
    dx = dx > 0 ? Math.floor(dx) : Math.ceil(dx); dy = dy > 0 ? Math.floor(dy) : Math.ceil(dy);
    CV.focus = { from: { x: f.from.x + dx, y: f.from.y + dy }, to: { x: f.to.x + dx, y: f.to.y + dy } };
    if (dx) st.last.x = q.x - fx; if (dy) st.last.y = q.y - fy;
  }
}
function cvFocusUp() {
  const f = CV.focus;
  if (CV.act.selecting && f && (Math.abs(f.from.x - f.to.x) < 4 || Math.abs(f.from.y - f.to.y) < 4)) CV.focus = null;
}

/* ── 선택·올가미 (NAI cK·c1: 끌어서 고르고, 안을 끌면 떼어 내어 옮기고, 밖을 누르면 붙인다) ── */
function cvSelCorners() {
  const s = CV.selT, tf = s.tf, w = s.cap.width * tf.sx, h = s.cap.height * tf.sy, a = tf.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  const P = (px, py) => ({ x: tf.x + px * c - py * sn, y: tf.y + px * sn + py * c });
  return [P(0, 0), P(w, 0), P(w, h), P(0, h)];
}
function cvSelHandles() {
  const c = cvSelCorners(), s = CV.selT, tf = s.tf, a = tf.rot * Math.PI / 180;
  const top = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }, off = 24 / CV.view.s;
  return [{ k: 0, ...c[0] }, { k: 1, ...c[1] }, { k: 2, ...c[2] }, { k: 3, ...c[3] }, { k: 'rot', x: top.x + Math.sin(a) * off, y: top.y - Math.cos(a) * off }];
}
function cvSelHit(p) {   // 손잡이 > 안쪽 > 밖
  const s = CV.selT; if (!s) return null;
  if (s.cap) {
    const r = 9 / CV.view.s; for (const h of cvSelHandles()) if (Math.abs(p.x - h.x) <= r && Math.abs(p.y - h.y) <= r) return { handle: h.k };
    const tf = s.tf, a = tf.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), ox = p.x - tf.x, oy = p.y - tf.y;
    const lx = (ox * c + oy * sn) / tf.sx, ly = (-ox * sn + oy * c) / tf.sy;
    return lx >= 0 && lx <= s.cap.width && ly >= 0 && ly <= s.cap.height ? { inside: true } : null;
  }
  const x0 = Math.min(s.from.x, s.to.x), x1 = Math.max(s.from.x, s.to.x), y0 = Math.min(s.from.y, s.to.y), y1 = Math.max(s.from.y, s.to.y);
  return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 ? { inside: true } : null;
}
function cvSelCapture() {   // 고른 곳을 떼어 낸다 (지금 레이어에서 지우고 따로 든다)
  const s = CV.selT, L = cvCur(); if (!s || s.cap) return;
  const x0 = Math.floor(Math.min(s.from.x, s.to.x)), y0 = Math.floor(Math.min(s.from.y, s.to.y)), x1 = Math.ceil(Math.max(s.from.x, s.to.x)), y1 = Math.ceil(Math.max(s.from.y, s.to.y));
  const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
  const c = cvMk(w, h), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (s.kind === 'lasso') {
    x.beginPath(); s.path.forEach((p, i) => i ? x.lineTo(p.x - x0, p.y - y0) : x.moveTo(p.x - x0, p.y - y0)); x.closePath(); x.clip();
    x.drawImage(L.canvas, x0, y0, w, h, 0, 0, w, h);
    L.ctx.save(); L.ctx.beginPath(); s.path.forEach((p, i) => i ? L.ctx.lineTo(p.x, p.y) : L.ctx.moveTo(p.x, p.y)); L.ctx.closePath(); L.ctx.clip(); L.ctx.clearRect(x0, y0, w, h); L.ctx.restore();
  } else { x.drawImage(L.canvas, x0, y0, w, h, 0, 0, w, h); L.ctx.clearRect(x0, y0, w, h); }
  s.cap = c; s.orig = { x: x0, y: y0 }; s.tf = { x: x0, y: y0, rot: 0, sx: 1, sy: 1 }; s.layerId = L.id; cvBump(L);
}
function cvCommitSelection() {   // 옮긴 것을 그 자리에 붙이고 선택을 끝낸다
  const s = CV.selT; if (!s) return;
  CV.selT = null;
  if (!s.cap) { cvRender(); return; }
  const L = CV.layers.find(l => l.id === s.layerId) || cvCur(), x = L.ctx, tf = s.tf;
  x.save(); x.imageSmoothingEnabled = false;   // NAI commitToCanvas 도 늘·돌릴 때 가장 가까운 칸으로 그린다
  x.translate(tf.x, tf.y); x.rotate(tf.rot * Math.PI / 180); x.scale(tf.sx, tf.sy); x.drawImage(s.cap, 0, 0); x.restore();
  cvBump(L); cvSaveState();
}
function cvCancelSelection() { CV.selT = null; }
function cvSelDown(p, kind) {
  const s = CV.selT;
  if (s && !s.selecting) {
    const hit = cvSelHit(p);
    if (hit) {
      if (!s.cap) cvSelCapture();
      const tf = s.tf;
      CV.act = { kind: 'selmove', handle: hit.handle, start: p, tf0: { ...tf } };
      if (hit.handle === 'rot') { const c = cvSelCenter(); CV.act.c = c; CV.act.a0 = Math.atan2(p.y - c.y, p.x - c.x); }
      if (hit.handle != null && hit.handle !== 'rot') { const cs = cvSelCorners(); CV.act.opp = cs[(hit.handle + 2) % 4]; CV.act.oppK = (hit.handle + 2) % 4; }
      return;
    }
    cvCommitSelection();
  }
  CV.selT = { kind, selecting: true, from: { ...p }, to: { ...p }, path: [{ ...p }], cap: null };
  CV.act = { kind: 'sel' };
}
function cvSelCenter() { const c = cvSelCorners(); return { x: (c[0].x + c[2].x) / 2, y: (c[0].y + c[2].y) / 2 }; }
function cvSelMove(p, e) {
  const s = CV.selT, a = CV.act; if (!s) return;
  if (a.kind === 'sel') {
    const q = { x: Math.max(0, Math.min(p.x, CV.w)), y: Math.max(0, Math.min(p.y, CV.h)) };
    if (s.kind === 'lasso') s.path.push(q); s.to = s.kind === 'lasso' ? q : { ...p };
    if (s.kind === 'lasso') { const xs = s.path.map(t => t.x), ys = s.path.map(t => t.y); s.from = { x: Math.min(...xs), y: Math.min(...ys) }; s.to = { x: Math.max(...xs), y: Math.max(...ys) }; }
    return;
  }
  const tf = s.tf, t0 = a.tf0;
  if (a.handle == null) { tf.x = t0.x + p.x - a.start.x; tf.y = t0.y + p.y - a.start.y; return; }
  if (a.handle === 'rot') {
    const ang = Math.atan2(p.y - a.c.y, p.x - a.c.x) - a.a0; let rot = t0.rot + ang * 180 / Math.PI; if (e.shiftKey) rot = Math.round(rot / 15) * 15;
    tf.rot = rot; const r = rot * Math.PI / 180, w = s.cap.width * tf.sx, h = s.cap.height * tf.sy;
    tf.x = a.c.x - (Math.cos(r) * w / 2 - Math.sin(r) * h / 2); tf.y = a.c.y - (Math.sin(r) * w / 2 + Math.cos(r) * h / 2); return;
  }
  // 모서리: 맞은편 모서리를 그대로 두고 크기를 바꾼다 (Shift 를 누르면 가로세로를 따로)
  const r = t0.rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), dx = p.x - a.opp.x, dy = p.y - a.opp.y;
  let lw = Math.abs(dx * c + dy * sn), lh = Math.abs(-dx * sn + dy * c);
  const W = s.cap.width, H = s.cap.height;
  let sx = Math.max(1 / W, lw / W), sy = Math.max(1 / H, lh / H);
  if (!e.shiftKey) { const k = Math.max(sx, sy); sx = k; sy = k; }
  tf.sx = sx; tf.sy = sy;
  const ow = W * sx, oh = H * sy, oppLocal = [[0, 0], [ow, 0], [ow, oh], [0, oh]][a.oppK];
  tf.x = a.opp.x - (oppLocal[0] * c - oppLocal[1] * sn); tf.y = a.opp.y - (oppLocal[0] * sn + oppLocal[1] * c);
}
function cvSelUp() {
  const s = CV.selT, a = CV.act; if (!s) return;
  if (a.kind === 'sel') {
    s.selecting = false;
    if (s.kind === 'lasso' && (s.path.length < 3 || s.to.x - s.from.x < 2 || s.to.y - s.from.y < 2)) CV.selT = null;
    else if (s.kind === 'select' && (s.from.x === s.to.x || s.from.y === s.to.y)) CV.selT = null;
    else if (s.kind === 'select') { const x0 = Math.min(s.from.x, s.to.x), y0 = Math.min(s.from.y, s.to.y), x1 = Math.max(s.from.x, s.to.x), y1 = Math.max(s.from.y, s.to.y); s.from = { x: Math.max(0, x0), y: Math.max(0, y0) }; s.to = { x: Math.min(CV.w, x1), y: Math.min(CV.h, y1) }; }
  }
}
/* Alt+L: 고른 것을 새 레이어로 복사 · Alt+Shift+L: 잘라서 새 레이어로 (NAI eO) */
function cvSelToLayer(cut) {
  const s = CV.selT, L = cvCur(); if (!s || cvIsMaskLayer(L)) return;
  if (s.cap) {
    const tf = s.tf;
    if (!cut) { L.ctx.save(); L.ctx.imageSmoothingEnabled = false; if (s.kind === 'lasso') { L.ctx.beginPath(); s.path.forEach((p, i) => i ? L.ctx.lineTo(p.x, p.y) : L.ctx.moveTo(p.x, p.y)); L.ctx.closePath(); L.ctx.clip(); } L.ctx.drawImage(s.cap, s.orig.x, s.orig.y); L.ctx.restore(); cvBump(L); }
    CV.selT = null; const N = cvAddLayer(false);
    N.ctx.save(); N.ctx.translate(tf.x, tf.y); N.ctx.rotate(tf.rot * Math.PI / 180); N.ctx.scale(tf.sx, tf.sy); N.ctx.drawImage(s.cap, 0, 0); N.ctx.restore(); cvBump(N);
  } else {
    const x0 = Math.floor(Math.min(s.from.x, s.to.x)), y0 = Math.floor(Math.min(s.from.y, s.to.y)), w = Math.ceil(Math.max(s.from.x, s.to.x)) - x0, h = Math.ceil(Math.max(s.from.y, s.to.y)) - y0;
    CV.selT = null; const N = cvAddLayer(false), d = N.ctx; d.save(); d.imageSmoothingEnabled = false;
    if (s.kind === 'lasso') { d.beginPath(); s.path.forEach((p, i) => i ? d.lineTo(p.x, p.y) : d.moveTo(p.x, p.y)); d.closePath(); d.clip(); }
    d.drawImage(L.canvas, x0, y0, w, h, x0, y0, w, h); d.restore(); cvBump(N);
    if (cut) { L.ctx.save(); if (s.kind === 'lasso') { L.ctx.beginPath(); s.path.forEach((p, i) => i ? L.ctx.lineTo(p.x, p.y) : L.ctx.moveTo(p.x, p.y)); L.ctx.closePath(); L.ctx.clip(); } L.ctx.clearRect(x0, y0, w, h); L.ctx.restore(); cvBump(L); }
  }
  cvSaveState(); cvUI();
}

/* ── 포인터 묶음 ── */
/* 3D 화면 위의 누르기·휠은 3D 조종(궤도·손잡이·뼈 고르기)이 맡는다 — NAI 도 3D 화면이 그림판 위를 덮는다 */
function cvInM3d(e) { return !!(e.target && e.target.closest && e.target.closest('#cvM3d')); }
function cvPointerDown(e) {
  if (!CV.open || cvInM3d(e)) return;
  const view = $('#cvView');
  if (e.button === 1 || (e.button === 0 && CV.space)) { CV.pan = { x: e.clientX, y: e.clientY, vx: CV.view.x, vy: CV.view.y }; view.setPointerCapture(e.pointerId); e.preventDefault(); return; }
  if (e.button !== 0) return;
  view.setPointerCapture(e.pointerId);
  const p = cvImgPt(e); CV.ptr = p; const L = cvCur(); if (!L) return;
  switch (CV.tool) {
    case 'draw': cvStrokeDown(p, e, false); break;
    case 'erase': cvStrokeDown(p, e, true); break;
    case 'fill': cvFill(p); break;
    case 'select': cvSelDown(p, 'select'); break;
    case 'lasso': cvSelDown(p, 'lasso'); break;
    case 'colorPicker': CV.act = { kind: 'pick' }; break;
    case 'blur': cvBlurDown(p, e); break;
    case 'clone': cvCloneDown(p, e); break;
    case 'maskDraw': cvMaskDown(p, false); break;
    case 'maskErase': cvMaskDown(p, true); break;
    case 'maskFill': cvMaskFill(p); break;
    case 'maskZoomSelection': cvFocusDown(p); break;
  }
  cvRender();
}
function cvPointerMove(e) {
  if (!CV.open) return;
  if (CV.pan) { CV.view.x = CV.pan.vx + e.clientX - CV.pan.x; CV.view.y = CV.pan.vy + e.clientY - CV.pan.y; cvRender(); return; }
  if (!CV.act && cvInM3d(e)) { if (CV.ptr) { CV.ptr = null; cvRender(); } return; }
  const p = cvImgPt(e); CV.ptr = p;
  const a = CV.act;
  if (a) {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const q = cvImgPt(ev);
      if (a.kind === 'stroke') cvStrokeMove(q, ev);
      else if (a.kind === 'blur') cvBlurMove(q, ev);
      else if (a.kind === 'clone') cvCloneMove(q, ev);
      else if (a.kind === 'mask') cvMaskMove(q);
    }
    if (a.kind === 'sel' || a.kind === 'selmove') cvSelMove(p, e);
    else if (a.kind === 'focus') cvFocusMove(p);
  } else if (CV.tool === 'select' || CV.tool === 'lasso') {
    const h = cvSelHit(p); $('#cvView').style.cursor = h ? (h.handle === 'rot' ? 'grab' : h.handle != null ? 'nwse-resize' : 'move') : 'crosshair';
  }
  cvRender();
}
function cvPointerUp(e) {
  if (!CV.open) return;
  if (CV.pan) { CV.pan = null; return; }
  const a = CV.act; if (!a) return;
  const p = cvImgPt(e);
  if (a.kind === 'stroke') cvStrokeUp(p, e);
  else if (a.kind === 'blur') cvBlurUp(p, e);
  else if (a.kind === 'clone') cvCloneUp(p, e);
  else if (a.kind === 'mask') cvSaveState();
  else if (a.kind === 'sel' || a.kind === 'selmove') cvSelUp();
  else if (a.kind === 'focus') cvFocusUp();
  else if (a.kind === 'pick') cvPickColor(p);
  CV.act = null; cvRender(); cvLayersUI();
}
function cvWheel(e) {   // NAI C1: 한 칸에 1.1배 / 0.9배, 누른 자리 기준 · 맞춤 배율의 1/4 ~ 10배
  if (!CV.open || cvInM3d(e)) return;
  e.preventDefault();
  const r = $('#cvView').getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = CV.view;
  const ns = Math.max(0.25 * cvFitScale(), Math.min(10, e.deltaY > 0 ? v.s * 0.9 : v.s * 1.1));
  if (ns === v.s) return;
  v.x = mx - (mx - v.x) * ns / v.s; v.y = my - (my - v.y) * ns / v.s; v.s = ns; cvRender();
}
function cvSetSize(n) {
  const def = cvToolDef(CV.tool); if (!def || !def.size) return;
  const lim = def.size === 'mask' ? [1, 999] : [1, 9999];
  CV.ts.size = Math.max(lim[0], Math.min(lim[1], Math.round(n))); CV.ts[CV_SIZE_KEY[def.size]] = CV.ts.size; cvSaveTs(); cvSettingsUI(); cvRender();
}
function cvKey(e) {   // NAI 그림판 단축키 (글 칸에 쓰는 중이면 받지 않는다)
  if (!CV.open) return;
  if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { CV.space = e.type === 'keydown'; if (e.type === 'keydown') e.preventDefault(); return; }
  if (e.type !== 'keydown') return;
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !$('#modalOverlay').hidden) return;
  const mask = cvIsMaskLayer(cvCur()), ctrl = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const go = n => { if (cvTools().some(t => t.n === n)) cvSwitchTool(n); };
  let hit = true;
  /* 3D 레이어 (NAI): P 포즈 · T 모델 변형 — 그리기 도구 글쇠는 쓰지 않고, W·A·S·D·Q·E 는 3D 화면 카메라가 받는다 */
  if (cvIsM3d(cvCur()) && !ctrl) {
    if (k === 'p') go('pose'); else if (k === 't') go('modelTransform'); else return;
    e.preventDefault(); e.stopPropagation(); return;
  }
  switch (k) {
    case 'b': if (ctrl) { hit = false; break; } go(mask ? 'maskDraw' : 'draw'); break;
    case 'e': if (ctrl) { hit = false; break; } go(mask ? 'maskErase' : 'erase'); break;
    case 'g': if (ctrl) { hit = false; break; } go(mask ? 'maskFill' : 'fill'); break;
    case 's': if (ctrl) { hit = false; break; } go(mask ? 'maskZoomSelection' : 'select'); break;
    case 'r': if (mask || ctrl) { hit = false; break; } go('blur'); break;
    case 'j': if (mask || ctrl) { hit = false; break; } go('clone'); break;
    case 'c': if (mask || ctrl) { hit = false; break; } if (CV.tool === 'colorPicker' && CV.lastTool) cvSwitchTool(CV.lastTool); else go('colorPicker'); break;
    case 'l':
      if (e.altKey) { if ((CV.tool === 'select' || CV.tool === 'lasso') && CV.selT) cvSelToLayer(e.shiftKey); break; }
      if (mask || ctrl) { hit = false; break; } go('lasso'); break;
    case '[': { const s = CV.ts.size; if (mask) cvSetSize(s - 2); else cvSetSize(s <= 5 ? 1 : s <= 20 ? s - 5 : s <= 50 ? s - 10 : s <= 100 ? s - 25 : s - 50); break; }
    case ']': { const s = CV.ts.size; if (mask) cvSetSize(s + 2); else cvSetSize(s < 5 ? 5 : s < 20 ? s + 5 : s < 50 ? s + 10 : s < 100 ? s + 25 : s + 50); break; }
    case '0': if (ctrl) cvFit(); else hit = false; break;
    case 'z': if (ctrl) { if (e.shiftKey) cvRedo(); else cvUndo(); } else hit = false; break;
    case 'y': if (ctrl) cvRedo(); else hit = false; break;
    case 'Escape': hit = false; break;
    default: hit = false;
  }
  if (hit) { e.preventDefault(); e.stopPropagation(); }
}

/* ── 그림 넣기: 끌어다 놓기·붙여 넣기·단추 (NAI ej) ── */
async function cvImportImage(blob) {
  const L = cvCur(); if (!L) return;
  const img = await blobToImage(await cvStripStealth(blob));
  if (L.type === 'mask') {   // 마스크 레이어면 그 그림의 모양(불투명한 곳)을 마스크로
    const t = cvMk(L.canvas.width, L.canvas.height), tx = cvCtx(t); tx.drawImage(img, 0, 0, t.width, t.height);
    const d = tx.getImageData(0, 0, t.width, t.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const on = a[i + 3] >= 255; a[i] = a[i + 1] = a[i + 2] = a[i + 3] = on ? 255 : 0; }
    L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height); tx.putImageData(d, 0, 0); L.ctx.drawImage(t, 0, 0); cvBump(L);
  } else {
    cvCommitSelection();
    const N = cvAddLayer(false), W = N.canvas.width, H = N.canvas.height;
    if (CV.resized) {   // 캔버스 크기를 바꾼 뒤면 비율을 지켜 가운데를 잘라 채운다
      const ir = img.width / img.height, cr = W / H;
      if (ir > cr) { const sw = img.height * cr, sx = (img.width - sw) / 2; N.ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, W, H); }
      else { const sh = img.width / cr, sy = (img.height - sh) / 2; N.ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, W, H); }
    } else N.ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);
    cvBump(N);
  }
  cvSaveState(); cvUI();
}

/* ── 캔버스 크기 바꾸기 (NAI TD + changeCanvasDimensions) ── */
function cvChangeDims(top, left, right, bottom) {
  cvCommitSelection();
  const nw = CV.w + left + right, nh = CV.h + top + bottom;
  if (nw < 8 || nh < 8) { toast('그보다 작게는 줄일 수 없습니다', 'err'); return false; }
  CV.layers = CV.layers.map(L => {
    if (cvIsM3d(L)) { L.m3d.resize(nw, nh); L.m3d.render(); L.ver++; return L; }   // NAI: 3D 레이어는 그림 크기만 바꿔 다시 그린다
    const k = L.scale, W = Math.round(nw / k), H = Math.round(nh / k), l = left / k, t = top / k;
    const c = cvMk(W, H), x = cvCtx(c);
    x.drawImage(L.canvas, Math.max(0, -l), Math.max(0, -t), W, H, Math.max(0, l), Math.max(0, t), W, H);
    if (L.type === 'mask') {   // 늘린 곳은 마스크로 채운다 (아웃페인트)
      const n = Math.max(0, l), a = Math.max(0, t), ow = L.canvas.width, oh = L.canvas.height;
      const m = Math.min(W - n, ow - Math.max(0, -l)), g = Math.min(H - a, oh - Math.max(0, -t));
      x.fillStyle = '#fff';
      if (left > 0) x.fillRect(0, 0, n + 1, H); if (top > 0) x.fillRect(0, 0, W, a + 1);
      if (right > 0) x.fillRect(n + m - 1, 0, W - n - m + 1, H); if (bottom > 0) x.fillRect(0, a + g - 1, W, H - a - g + 1);
    }
    return { ...L, canvas: c, ctx: x, ver: L.ver + 1 };
  });
  CV.w = nw; CV.h = nh;   // 집중 영역 칸 좌표는 NAI 처럼 그대로 둔다 (changeCanvasDimensions 가 건드리지 않는다)
  CV.resized = true; cvClearHistory(); cvFit(); cvUI();
  return true;
}
function cvOpenResize() {
  const W0 = CV.w, H0 = CV.h, mask = CV.mode === 'mask', step = 64;
  let top = 0, left = 0, right = 0, bottom = 0;
  openModal('캔버스 크기 바꾸기', body => {
    body.innerHTML = `
      ${mask ? '' : `<div class="row"><b>크기 직접</b> <span class="hint">[가로 × 세로]</span><button class="btn xs" id="cvrCrop" style="margin-left:auto" title="가로·세로를 64 의 배수로 줄입니다(양쪽을 똑같이 자름)">가장 가까운 생성 크기로 자르기</button></div>
      <div class="row"><input type="number" id="cvrW" min="8" style="width:110px"> <button class="btn xs" id="cvrSwap" title="가로와 세로를 바꿉니다">⇄</button> <input type="number" id="cvrH" min="8" style="width:110px"></div>
      <div class="hint" style="text-align:center;margin:6px 0">또는</div>`}
      <div class="row"><b>가장자리 옮기기</b> <span class="hint">늘리면 +, 자르면 − (화소)${mask ? ' · 마스크 모드는 64 의 배수로 올리고, 늘린 곳은 마스크로 칠합니다' : ''}</span></div>
      <div class="cvr-grid">
        <div></div><input type="number" id="cvrT" value="0"><div></div>
        <input type="number" id="cvrL" value="0"><canvas id="cvrPrev" width="170" height="170"></canvas><input type="number" id="cvrR" value="0">
        <div></div><input type="number" id="cvrB" value="0"><div></div>
      </div>
      <div class="row" style="justify-content:flex-end"><span class="hint" id="cvrInfo"></span><button class="btn go" id="cvrGo">크기 바꾸기</button></div>`;
    const q = s => body.querySelector(s);
    const draw = () => {   // NAI TL 미리 보기: 지금 캔버스(채운 네모)와 바뀐 크기(점선)
      const c = q('#cvrPrev'), x = c.getContext('2d'), f = W0 + left + right, g = H0 + top + bottom;
      const minX = Math.min(0, -left), minY = Math.min(0, -top), bw = Math.max(W0, W0 + right) - minX, bh = Math.max(H0, H0 + bottom) - minY, k = Math.min(160 / bw, 160 / bh, 1);
      x.clearRect(0, 0, c.width, c.height); x.save(); x.translate((170 - bw * k) / 2, (170 - bh * k) / 2);
      x.fillStyle = '#888a'; x.fillRect((0 - minX) * k, (0 - minY) * k, W0 * k, H0 * k);
      if (top || left || right || bottom) { x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--acc') || '#a78bfa'; x.lineWidth = 2; x.setLineDash([4, 3]); x.strokeRect((-left - minX) * k, (-top - minY) * k, Math.max(0, f) * k, Math.max(0, g) * k); }
      x.restore();
      q('#cvrInfo').textContent = `${W0}×${H0} → ${f}×${g}`;
      if (q('#cvrW')) { q('#cvrW').value = f; q('#cvrH').value = g; }
    };
    const fromEdges = () => { top = +q('#cvrT').value || 0; left = +q('#cvrL').value || 0; right = +q('#cvrR').value || 0; bottom = +q('#cvrB').value || 0; draw(); };
    const toEdges = () => { q('#cvrT').value = top; q('#cvrL').value = left; q('#cvrR').value = right; q('#cvrB').value = bottom; draw(); };
    ['#cvrT', '#cvrL', '#cvrR', '#cvrB'].forEach(s => { q(s).oninput = fromEdges; q(s).onfocus = e => e.target.select(); });
    if (!mask) {
      const fromSize = () => { const w = +q('#cvrW').value || W0, h = +q('#cvrH').value || H0; top = 0; left = 0; right = w - W0; bottom = h - H0; toEdges(); };
      q('#cvrW').onchange = fromSize; q('#cvrH').onchange = fromSize;
      q('#cvrSwap').onclick = () => { const w = +q('#cvrW').value, h = +q('#cvrH').value; q('#cvrW').value = h; q('#cvrH').value = w; fromSize(); };
      q('#cvrCrop').onclick = () => {   // NAI eI: 64 배수로 내려 양쪽을 똑같이 자른다
        const a = Math.floor(W0 / step) * step - W0, n = Math.floor(H0 / step) * step - H0;
        left = Math.floor(a / 2); top = Math.floor(n / 2); right = Math.ceil(a / 2); bottom = Math.ceil(n / 2); toEdges();
      };
    }
    q('#cvrGo').onclick = () => {
      let t = top, l = left, r = right, b = bottom;
      if (mask) { const up = v => Math.ceil(v / step) * step; t = up(t); l = up(l); r = up(r); b = up(b); }
      if (cvChangeDims(t, l, r, b)) closeModal();
    };
    draw();
  });
}

/* ── 색조 조정 (NAI IO: 미리 보기 → 적용·취소·처음으로) ── */
function cvRgb2Hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); let h = 0; if (d) { if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60; else if (mx === g) h = ((b - r) / d + 2) * 60; else h = ((r - g) / d + 4) * 60; } return { h, s: mx ? d / mx : 0, v: mx }; }
function cvHsv2Rgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs((h = ((h % 360) + 360) % 360) / 60 % 2 - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; } return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]; }
function cvHsvApplyTo(src, dh, ds, dv) {
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), a = src.data, o = out.data, sm = 1 + ds / 100, vm = 1 + dv / 100;
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    const { h, s, v } = cvRgb2Hsv(a[i], a[i + 1], a[i + 2]), [r, g, b] = cvHsv2Rgb(h + dh, Math.min(1, Math.max(0, s * sm)), Math.min(1, Math.max(0, v * vm)));
    o[i] = r; o[i + 1] = g; o[i + 2] = b;
  }
  return out;
}
function cvHsvOpen() {
  const L = cvCur(); if (!L || L.type !== 'normal') return;
  cvCommitSelection();
  CV.hsv = { layer: L, orig: L.ctx.getImageData(0, 0, L.canvas.width, L.canvas.height), h: 0, s: 0, v: 0 };
  const pop = $('#cvPop'); pop.hidden = false;
  pop.innerHTML = `<b>색조 조정</b>
    <label class="rng">색상 <output id="cvhH">0°</output><input type="range" id="cvhh" min="-180" max="180" step="1" value="0"></label>
    <label class="rng">채도 <output id="cvhS">0%</output><input type="range" id="cvhs" min="-100" max="100" step="1" value="0"></label>
    <label class="rng">밝기 <output id="cvhV">0%</output><input type="range" id="cvhv" min="-100" max="100" step="1" value="0"></label>
    <div class="row"><button class="btn xs" id="cvhReset">처음으로</button><span style="flex:1"></span><button class="btn xs" id="cvhCancel">취소</button><button class="btn xs go" id="cvhApply">적용</button></div>`;
  const upd = () => {
    const H = CV.hsv; if (!H) return;
    $('#cvhH').textContent = H.h + '°'; $('#cvhS').textContent = H.s + '%'; $('#cvhV').textContent = H.v + '%';
    if (CV._hsvRaf) cancelAnimationFrame(CV._hsvRaf);
    CV._hsvRaf = requestAnimationFrame(() => { CV._hsvRaf = 0; const H2 = CV.hsv; if (!H2) return; H2.layer.ctx.putImageData(H2.h || H2.s || H2.v ? cvHsvApplyTo(H2.orig, H2.h, H2.s, H2.v) : H2.orig, 0, 0); cvBump(H2.layer); cvRender(); });
  };
  $('#cvhh').oninput = e => { CV.hsv.h = +e.target.value; upd(); };
  $('#cvhs').oninput = e => { CV.hsv.s = +e.target.value; upd(); };
  $('#cvhv').oninput = e => { CV.hsv.v = +e.target.value; upd(); };
  $('#cvhReset').onclick = () => { CV.hsv.h = CV.hsv.s = CV.hsv.v = 0; $('#cvhh').value = 0; $('#cvhs').value = 0; $('#cvhv').value = 0; upd(); };
  $('#cvhCancel').onclick = cvHsvCancel; $('#cvhApply').onclick = cvHsvApply;
}
function cvHsvCancel() { const H = CV.hsv; if (!H) return; CV.hsv = null; H.layer.ctx.putImageData(H.orig, 0, 0); cvBump(H.layer); $('#cvPop').hidden = true; cvRender(); }
function cvHsvApply() { const H = CV.hsv; if (!H) return; H.layer.ctx.putImageData(H.h || H.s || H.v ? cvHsvApplyTo(H.orig, H.h, H.s, H.v) : H.orig, 0, 0); CV.hsv = null; cvBump(H.layer); $('#cvPop').hidden = true; cvSaveState(); }

/* ── 마스크 표시 설정 (NAI TW: 색·불투명도 10~100·테두리·무늬) ── */
function cvMaskDispOpen() {
  const pop = $('#cvPop'), D = CV.disp; pop.hidden = false;
  const PAT = [['solid', '채움'], ['stripes', '줄'], ['dots', '점'], ['crosshatch', '빗금'], ['grid', '격자'], ['checker', '체크'], ['hearts', '하트']];
  pop.innerHTML = `<b>마스크 표시</b>
    <div class="row cv-sw">${CV_MASK_COLORS.map((c, i) => `<button class="cv-swatch${i === D.color ? ' on' : ''}" data-i="${i}" style="background:${c}" title="마스크 색"></button>`).join('')}</div>
    <label class="rng">불투명도 <output id="cvmO">${D.opacity}%</output><input type="range" id="cvmo" min="10" max="100" step="5" value="${D.opacity}"></label>
    <label class="ck"><input type="checkbox" id="cvmB" ${D.border ? 'checked' : ''}> 테두리</label>
    <label class="fld">무늬<select id="cvmP">${PAT.map(([v, n]) => `<option value="${v}"${v === D.pattern ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="row" style="justify-content:flex-end"><button class="btn xs" id="cvmClose">닫기</button></div>`;
  const keep = () => { S.cvMaskDisp = { ...CV.disp }; if (typeof save === 'function') save(); cvRender(); };
  pop.querySelectorAll('.cv-swatch').forEach(b => b.onclick = () => { CV.disp.color = +b.dataset.i; pop.querySelectorAll('.cv-swatch').forEach(x => x.classList.toggle('on', x === b)); keep(); });
  $('#cvmo').oninput = e => { CV.disp.opacity = +e.target.value; $('#cvmO').textContent = CV.disp.opacity + '%'; keep(); };
  $('#cvmB').onchange = e => { CV.disp.border = e.target.checked; keep(); };
  $('#cvmP').onchange = e => { CV.disp.pattern = e.target.value; keep(); };
  $('#cvmClose').onclick = () => { pop.hidden = true; };
}

/* ═══ 앱과 잇기 (NAI actions.edit · actions.inpaint · 바탕 그림 칸의 펜) ═══ */
/* 편집: 그림을 그림판(일반 모드)에서 고치고, 저장하면 바탕 그림으로 넣는다. 생성 크기는 그림에 맞춘다(NAI cs). 마스크는 건드리지 않는다. */
async function cvEditImage(blob, meta) {
  if (!blob) { toast('고칠 그림이 없습니다', 'err'); return; }
  await cvOpen({ mode: 'normal', image: blob, onSave: async res => {
    const m8 = R.mask8, fo = R.focus;
    setI2I(res.image, meta || null, true);
    R.mask8 = m8; R.focus = fo; updateI2IUI();   // NAI 는 «편집» 저장 때 인페인트 마스크를 지우지 않는다
    toast('그림판에서 고친 그림을 바탕 그림으로 넣었습니다');
  } });
}
/* 새로 그리기: 지금 해상도의 빈 그림판 (NAI 바탕 그림 칸이 비었을 때의 펜) */
async function cvPaintNew() {
  await cvOpen({ mode: 'normal', image: null, width: S.w, height: S.h, onSave: async res => { setI2I(res.image, null, true); toast('그린 그림을 바탕 그림으로 넣었습니다'); } });
}
/* 인페인트: 바탕 그림을 마스크 모드로 연다. 저장하면 바탕 그림(그림판에서 칠한 것 포함)·1/8 마스크·집중 영역이 들어가고,
   생성 크기는 그림 크기로(3,145,728 화소를 넘으면 NAI cl 로) 맞춘다. 무작위 값은 처음 넣은 그림(R.i2iMarked)에서 읽는다. */
async function cvInpaint() {
  if (!R.i2iBlob) { toast('먼저 바탕 그림을 넣으세요', 'err'); return; }
  const marked = R.i2iMarked || R.i2iBlob, meta = R.i2iMeta;
  const f = R.focus;
  await cvOpen({ mode: 'mask', image: R.i2iBlob, mask: R.mask8, focus: f ? { from: { x: f.x, y: f.y }, to: { x: f.x + f.width, y: f.y + f.height } } : null, onSave: async res => {
    R.i2iBlob = res.image; R.i2iMeta = meta; R.i2iMarked = marked; R.maskCanvas = null;
    R.mask8 = res.mask && res.mask.any ? res.mask : null; R.focus = R.mask8 ? res.focus : null;
    if (res.w * res.h > SD_MAX_AREA) await setResForImage(res.image);
    else if (S.w !== res.w || S.h !== res.h) { S.w = res.w; S.h = res.h; save(); if (typeof syncUI === 'function') syncUI(); toast(`생성 크기를 그림판 크기 ${res.w}×${res.h} 로 맞췄습니다 (NAI 와 같습니다)`); }
    updateI2IUI();
    if (!R.mask8) toast('칠한 마스크가 없어 일반 i2i 로 둡니다');
  } });
}
/* 히스토리 그림으로 인페인트 (NAI actions.inpaint: 바탕 그림을 바꾸되, 앞서 칠한 마스크는 그대로 들고 간다) */
async function cvInpaintItem(blob, meta) {
  R.i2iBlob = blob; R.i2iMeta = meta || null; R.i2iMarked = blob; R.maskCanvas = null;
  updateI2IUI(); if (typeof switchRefTab === 'function') switchRefTab('i2i');
  await cvInpaint();
}

/* ── 화면 틀 ── */
function cvBuild() {
  if (CV.el) return;
  const el = document.createElement('div'); el.id = 'cvEd'; el.className = 'cved'; el.hidden = true;
  el.innerHTML = `
    <div class="cv-top"><div class="cv-set" id="cvSet"></div>
      <div class="cv-act">
        <button class="btn sm" id="cvImp" title="그림 파일을 새 레이어로 넣습니다 (끌어다 놓거나 붙여 넣어도 됩니다)">🖼 그림 넣기</button>
        <button class="btn sm" id="cvDl" title="지금 그림판을 PNG 로 내려받습니다 (마스크 모드면 마스크)">⬇ PNG</button>
        <button class="btn sm go" id="cvSave">저장 후 닫기</button>
        <button class="btn sm" id="cvX" title="저장하지 않고 닫기 — 다시 열면 이어서 고칠 수 있습니다">✕</button>
      </div></div>
    <div class="cv-mid"><div class="cv-view" id="cvView"><canvas id="cvScreen"></canvas></div><div class="cv-side" id="cvSide" hidden></div><div class="cv-layers" id="cvLayers"></div></div>
    <div class="cv-bot" id="cvBot"></div>
    <div class="cv-anim" id="cvAnim" hidden></div>
    <div class="cv-pop" id="cvPop" hidden></div>`;
  document.body.appendChild(el); CV.el = el;
  const v = $('#cvView');
  v.addEventListener('pointerdown', cvPointerDown);
  v.addEventListener('pointermove', cvPointerMove);
  v.addEventListener('pointerup', cvPointerUp);
  v.addEventListener('pointercancel', cvPointerUp);
  v.addEventListener('pointerleave', () => { if (!CV.act) { CV.ptr = null; cvRender(); } });
  v.addEventListener('wheel', cvWheel, { passive: false });
  v.addEventListener('contextmenu', e => e.preventDefault());
  v.addEventListener('dragover', e => { e.preventDefault(); });
  v.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    const fs = [...(e.dataTransfer && e.dataTransfer.files || [])], L = cvCur();
    if (cvIsM3d(L)) { if (fs[0]) cvM3dImport(L, fs[0], false); return; }   // NAI: 3D 레이어면 떨군 파일을 모델로 (그림도 판으로)
    const f = fs.find(f => /^image\//.test(f.type)); if (f) cvImportImage(f).catch(err => { logErr('그림판 그림 넣기 실패: ' + err.message); toast('그림을 넣지 못했습니다: ' + err.message, 'err'); });
  });
  document.addEventListener('keydown', cvKey, true); document.addEventListener('keyup', cvKey, true);
  document.addEventListener('paste', e => {
    if (!CV.open || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    const fs = [...(e.clipboardData && e.clipboardData.files || [])], L = cvCur();
    if (cvIsM3d(L)) { if (fs[0]) { e.preventDefault(); e.stopImmediatePropagation(); cvM3dImport(L, fs[0], false); } return; }
    const f = fs.find(f => /^image\//.test(f.type));
    if (f) { e.preventDefault(); e.stopImmediatePropagation(); cvImportImage(f).catch(err => { logErr('그림판 붙여 넣기 실패: ' + err.message); toast('붙여 넣지 못했습니다: ' + err.message, 'err'); }); }
  }, true);
  addEventListener('resize', () => { if (CV.open) { cvResizeScreen(); cvRender(); } });
  $('#cvSave').onclick = () => cvSave().catch(err => { logErr('그림판 저장 실패: ' + err.message); toast('그림판을 저장하지 못했습니다: ' + err.message, 'err'); });
  $('#cvX').onclick = () => cvClose(false);
  $('#cvImp').onclick = () => {
    const L = cvCur();
    if (cvIsM3d(L)) { pickFiles(false, f => cvM3dImport(L, f, true), CV_M3D_ACCEPT); return; }
    pickFiles(false, f => cvImportImage(f).catch(err => { logErr('그림판 그림 넣기 실패: ' + err.message); toast('그림을 넣지 못했습니다: ' + err.message, 'err'); }));
  };
  $('#cvDl').onclick = () => {
    const c = CV.mode === 'mask' ? cvCompositeMask().canvas : cvCompositeNormal();
    if (!c) { toast('내려받을 마스크가 없습니다', 'err'); return; }
    c.toBlob(b => { if (b) downloadBlob(b, 'canvas.png'); else toast('PNG 를 만들지 못했습니다', 'err'); }, 'image/png');
  };
}
function cvUI() { cvM3dSync(); cvSettingsUI(); cvBotUI(); cvLayersUI(); cvM3dSideUI(); cvM3dAnimUI(); cvRender(); }
/* 위 줄: 지금 도구의 설정 (NAI 도구 설정 칸) */
function cvSettingsUI() {
  const box = $('#cvSet'); if (!box) return;
  const ts = CV.ts, t = CV.tool, def = cvToolDef(t) || {}, mask = def.size === 'mask';
  const parts = [`<span class="cv-tname">${def.ic || ''} ${escHtml((def.t || '').replace(/ \(.*$/, '').replace(/ —.*$/, ''))}</span>`];
  const colorUI = `<label class="cv-col" title="색"><input type="color" id="cvColor" value="${cvHex(ts.color)}"></label>`;
  const sizeUI = def.size ? `<label class="rng cv-size">${mask ? '붓 크기(칸)' : '붓 크기'} <output>${ts.size}</output><input type="range" id="cvSize" min="${mask ? 4 : 5}" max="${mask ? 50 : 100}" step="${mask ? 1 : 5}" value="${ts.size}"></label>` : '';
  const tipUI = `<span class="cv-tips">${[['round', '●', '둥근 붓'], ['softRound', '◍', '부드러운 붓'], ['square', '■', '네모 붓']].map(([v, ic, tt]) => `<button class="btn xs${ts.brushTip === v ? ' primary' : ''}" data-tip="${v}" title="${tt}">${ic}</button>`).join('')}</span>`;
  const pressUI = `<button class="btn xs${ts.pressureSensitivity ? ' primary' : ''}" id="cvPress" title="필압 — 펜으로 누르는 힘에 따라 굵기가 바뀝니다">🖊 필압</button>`;
  if (t === 'draw') parts.push(colorUI, sizeUI, tipUI, pressUI);
  else if (t === 'erase') parts.push(sizeUI, tipUI, pressUI);
  else if (t === 'fill') parts.push(colorUI, `<label class="rng">허용 범위 <output>${ts.fillTolerance}</output><input type="range" id="cvTol" min="0" max="100" step="1" value="${ts.fillTolerance}"></label>`);
  else if (t === 'blur') parts.push(sizeUI, `<label class="rng">세기 <output>${ts.blurIntensity}</output><input type="range" id="cvBlurI" min="1" max="100" step="1" value="${ts.blurIntensity}"></label>`, pressUI);
  else if (t === 'clone') parts.push(sizeUI, pressUI, '<span class="hint">Alt+클릭으로 가져올 자리</span>');
  else if (t === 'colorPicker') parts.push(colorUI, '<span class="hint">그림을 누르면 그 색을 고릅니다 · C 를 다시 누르면 앞 도구로</span>');
  else if (t === 'select' || t === 'lasso') parts.push('<span class="hint">끌어서 고르기 · 안을 끌어 옮기기 · 모서리로 크기(Shift 는 가로세로 따로) · 위 동그라미로 돌리기 · Alt+L 새 레이어로 복사 · Alt+Shift+L 잘라내기</span>');
  else if (t === 'maskDraw' || t === 'maskErase') parts.push(sizeUI, `<button class="btn xs${ts.maskDrawShape === 'square' ? ' primary' : ''}" id="cvSq" title="네모 붓">■ 네모</button>`);
  else if (t === 'maskZoomSelection') parts.push(`<label class="rng">최소 둘레 <output>${ts.safeAreaSize}</output><input type="range" id="cvSafe" min="32" max="96" step="8" value="${ts.safeAreaSize}"></label>`, `<button class="btn xs" id="cvFocusClr" ${CV.focus ? '' : 'disabled'}>집중 영역 지우기</button>`);
  else if (t === 'pose' || t === 'modelTransform') parts.push(cvM3dBarHtml());
  box.innerHTML = parts.join('');
  cvM3dBarBind(box);
  const on = (id, ev, f) => { const n = $(id); if (n) n[ev] = f; };
  on('#cvColor', 'oninput', e => { const h = e.target.value; CV.ts.color = `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`; });
  on('#cvSize', 'oninput', e => { cvSetSize(+e.target.value); });
  box.querySelectorAll('[data-tip]').forEach(b => b.onclick = () => { CV.ts.brushTip = b.dataset.tip; cvSaveTs(); cvSettingsUI(); cvRender(); });
  on('#cvPress', 'onclick', () => { CV.ts.pressureSensitivity = !CV.ts.pressureSensitivity; cvSaveTs(); cvSettingsUI(); });
  on('#cvTol', 'oninput', e => { CV.ts.fillTolerance = +e.target.value; e.target.previousElementSibling.textContent = e.target.value; cvSaveTs(); });
  on('#cvBlurI', 'oninput', e => { CV.ts.blurIntensity = +e.target.value; e.target.previousElementSibling.textContent = e.target.value; cvSaveTs(); });
  on('#cvSq', 'onclick', () => { CV.ts.maskDrawShape = CV.ts.maskDrawShape === 'square' ? 'circle' : 'square'; cvSaveTs(); cvSettingsUI(); cvRender(); });
  on('#cvSafe', 'oninput', e => { CV.ts.safeAreaSize = +e.target.value; e.target.previousElementSibling.textContent = e.target.value; cvSaveTs(); cvRender(); });
  on('#cvFocusClr', 'onclick', () => { CV.focus = null; cvSettingsUI(); cvRender(); });
}
/* 아래 줄: 도구 단추 · 지금 레이어 지우기 · 캔버스 크기 · 되돌리기 · 색조 조정 / 마스크 표시 (NAI Tm) */
function cvBotUI() {
  const box = $('#cvBot'); if (!box) return;
  const L = cvCur(), list = cvTools(), m3 = cvIsM3d(L), setOpen = cvM3dSetOpen();
  box.innerHTML = list.map(t => `<button class="btn sm cv-tool${t.n === CV.tool ? ' primary' : ''}" data-t="${t.n}" title="${escHtml(t.t)}">${t.ic}</button>`).join('')
    + `<span class="cv-sep"></span>` + (m3 ? '' : `<button class="btn sm" id="cvClear" title="지금 레이어를 비웁니다">🗑 레이어 비우기</button>`)   // NAI: 3D 레이어에는 지우기 단추가 없다
    + `<button class="btn sm" id="cvResize" title="캔버스 크기 바꾸기 — 양옆·위아래로 늘리거나 자릅니다">⤢ 캔버스 크기</button>`
    + `<button class="btn sm" id="cvUndo" title="되돌리기 (Ctrl+Z)" ${CV.undo.length > 1 ? '' : 'disabled'}>↶</button><button class="btn sm" id="cvRedo" title="다시 하기 (Ctrl+Y)" ${CV.redo.length ? '' : 'disabled'}>↷</button>`
    + (L && L.type === 'normal' ? `<button class="btn sm" id="cvHsv" title="색조 조정 — 지금 레이어의 색상·채도·밝기">🎨 색조</button>` : '')
    + (CV.mode === 'mask' ? `<button class="btn sm" id="cvMaskDisp" title="마스크 표시 — 색·불투명도·테두리·무늬">👁 마스크 표시</button>` : '')
    + (m3 ? `<button class="btn sm${setOpen ? ' primary' : ''}" id="cvM3dSet" title="3D 설정 — 투영·시야각·조명·빛 방향·그림자·뼈대 보이기·물리">⚙ 3D 설정</button>`
      + `<button class="btn sm${CV.m3dBones ? ' primary' : ''}" id="cvM3dBones" title="뼈대 목록 — 누르면 그 뼈를 고릅니다">🦴 뼈대 목록</button>`
      + `<button class="btn sm${CV.m3dMorph ? ' primary' : ''}" id="cvM3dMorph" title="표정·모프 — VRM 표정과 모델의 모프 값을 바꿉니다">🙂 표정·모프</button>` : '')
    + `<span class="cv-sep"></span><button class="btn sm" id="cvFitB" title="화면에 맞추기 (Ctrl+0) · 휠로 확대 · 가운데 단추나 Space+끌기로 옮기기">⊡ 맞추기</button>`;
  box.querySelectorAll('.cv-tool').forEach(b => b.onclick = () => cvSwitchTool(b.dataset.t));
  if ($('#cvClear')) $('#cvClear').onclick = () => { const L2 = cvCur(); if (!L2 || cvIsM3d(L2)) return; cvCommitSelection(); L2.ctx.clearRect(0, 0, L2.canvas.width, L2.canvas.height); cvBump(L2); cvSaveState(); cvBotUI(); };
  if ($('#cvM3dSet')) $('#cvM3dSet').onclick = () => { if (cvM3dSetOpen()) cvM3dSetClose(); else cvM3dSetShow(); };
  if ($('#cvM3dBones')) $('#cvM3dBones').onclick = () => { CV.m3dBones = !CV.m3dBones; cvBotUI(); cvM3dSideUI(); };
  if ($('#cvM3dMorph')) $('#cvM3dMorph').onclick = () => { CV.m3dMorph = !CV.m3dMorph; cvBotUI(); cvM3dSideUI(); };
  $('#cvResize').onclick = cvOpenResize;
  $('#cvUndo').onclick = cvUndo; $('#cvRedo').onclick = cvRedo;
  if ($('#cvHsv')) $('#cvHsv').onclick = () => { if (CV.hsv) cvHsvCancel(); else cvHsvOpen(); };
  if ($('#cvMaskDisp')) $('#cvMaskDisp').onclick = () => { const p = $('#cvPop'); if (!p.hidden && p.querySelector('#cvmo')) p.hidden = true; else cvMaskDispOpen(); };
  $('#cvFitB').onclick = cvFit;
}
/* 오른쪽: 레이어 (NAI TN — 위가 맨 위 레이어) */
function cvLayersUI() {
  const box = $('#cvLayers'); if (!box || !CV.open) return;
  const n = CV.layers.length;
  const rows = CV.layers.map((L, i) => ({ L, i })).reverse().map(({ L, i }) => {
    const canMove = d => { const j = i + d, o = CV.layers[j]; return o && (o.type === 'mask') === (L.type === 'mask'); };
    return `<div class="cv-lay${i === CV.sel ? ' on' : ''}" data-i="${i}"><canvas class="cv-thumb" data-i="${i}"></canvas>
      <span class="cv-lname">${L.type === 'mask' ? '마스크' : cvIsM3d(L) ? '🧊 3D 모델' : '레이어'} ${i + 1}</span>
      <span class="cv-lbtn"><button class="btn xs" data-up="${i}" ${canMove(1) ? '' : 'disabled'} title="위로">↑</button><button class="btn xs" data-dn="${i}" ${canMove(-1) ? '' : 'disabled'} title="아래로">↓</button><button class="btn xs" data-del="${i}" ${n <= 1 || (CV.mode === 'mask' && L.type === 'mask' && CV.layers.filter(l => l.type === 'mask').length <= 1) ? 'disabled' : ''} title="레이어 지우기">✕</button></span></div>`;
  }).join('');
  box.innerHTML = `<div class="row"><b>레이어</b><button class="btn xs" id="cvAddL" style="margin-left:auto" title="빈 레이어를 더합니다">＋ 레이어</button><button class="btn xs" id="cvAdd3D" title="3D 모델 레이어 더하기 — 고르면 그 자리에 3D 화면이 뜨고, 모델(glb·gltf·vrm·pmx·pmd·zip·그림)을 넣을 수 있습니다">＋ 3D</button></div>${rows}`;
  box.querySelectorAll('.cv-thumb').forEach(c => {
    const L = CV.layers[+c.dataset.i], k = Math.min(56 / CV.w, 56 / CV.h); c.width = Math.max(1, Math.round(CV.w * k)); c.height = Math.max(1, Math.round(CV.h * k));
    const x = c.getContext('2d'); x.fillStyle = cvChecker(x, true); x.fillRect(0, 0, c.width, c.height);
    if (L.type === 'mask') { x.imageSmoothingEnabled = false; const t = cvMk(L.canvas.width, L.canvas.height), tx = t.getContext('2d'); tx.drawImage(L.canvas, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = CV_MASK_COLORS[CV.disp.color] || L.maskColor; tx.fillRect(0, 0, t.width, t.height); x.drawImage(t, 0, 0, c.width, c.height); }
    else x.drawImage(L.canvas, 0, 0, c.width, c.height);
  });
  box.querySelectorAll('.cv-lay').forEach(r => r.onclick = e => { if (e.target.closest('button')) return; cvSelectLayer(+r.dataset.i); });
  box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => cvMoveLayer(+b.dataset.up, +b.dataset.up + 1));
  box.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => cvMoveLayer(+b.dataset.dn, +b.dataset.dn - 1));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => cvRemoveLayer(+b.dataset.del));
  $('#cvAddL').onclick = () => { cvCommitSelection(); cvAddLayer(true); cvUI(); };
  $('#cvAdd3D').onclick = () => { cvAddModel3DLayer(); };
}

/* ── 3D 레이어 화면 (NAI C5 도구 설정 · Is 뼈대 목록 · If 표정 · T7 3D 설정 · IT 동작 재생) ── */
/* 위 줄: 모델 목록(누르면 고르기·🗑 빼기) · 모델 넣기 · 처음 자리로 · 이동·회전·크기 */
function cvM3dBarHtml() {
  const L = cvCur(); if (!cvIsM3d(L)) return '';
  const mgr = L.m3d, sel = mgr.selectedModelId;
  const chips = mgr.getModels().map(m => `<span class="cv-mchip${m.id === sel ? ' on' : ''}"><button class="cv-mname" data-mid="${escHtml(m.id)}" title="이 모델 고르기">${escHtml(m.name)}</button><button class="cv-mdel" data-mdel="${escHtml(m.id)}" title="모델 빼기">🗑</button></span>`).join('');
  const seg = [['translate', '✥', '이동'], ['rotate', '⟳', '회전'], ['scale', '⤡', '크기']].map(([v, ic, n]) => `<button class="btn xs${CV.m3dMode === v ? ' primary' : ''}" data-tm="${v}" title="손잡이: ${n}">${ic} ${n}</button>`).join('');
  return `<span class="cv-mlist">${chips}<button class="btn xs" id="cvM3dImp" title="3D 모델 넣기 — glb·gltf·vrm·pmx·pmd·zip·그림(그림은 판으로)">⬆ 모델 넣기</button><button class="btn xs" id="cvM3dReset" title="고른 모델을 처음 자리·처음 자세로">↺ 처음 자리로</button></span><span class="cv-seg">${seg}</span>`;
}
function cvM3dBarBind(box) {
  const L = cvCur(); if (!cvIsM3d(L)) return;
  const mgr = L.m3d;
  box.querySelectorAll('[data-mid]').forEach(b => b.onclick = () => {
    mgr.selectModel(b.dataset.mid);
    if (CV.m3dTool && CV.m3dTool.name === 'modelTransform') CV.m3dTool.attachToModel(b.dataset.mid);   // 손잡이도 고른 모델로 (NAI 는 목록에서 고르면 손잡이가 앞 모델에 남는다)
    cvBump(L); cvSaveState(); cvSettingsUI(); cvM3dSideUI(); cvM3dAnimUI();
  });
  box.querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => {
    const id = b.dataset.mdel;
    if (mgr.getSelectedBoneModelId() === id) mgr.deselectBone();
    mgr.removeModel(id);
    if (CV.m3dTool && CV.m3dTool.name === 'modelTransform') { mgr.viewportController.detach(); if (mgr.selectedModelId) CV.m3dTool.attachToModel(mgr.selectedModelId); }   // 뺀 모델에 손잡이가 남지 않게
    cvM3dRefresh(L, true); cvUI();
  });
  const on = (id, f) => { const n = box.querySelector(id); if (n) n.onclick = f; };
  on('#cvM3dImp', () => pickFiles(false, f => cvM3dImport(L, f, true), CV_M3D_ACCEPT));
  on('#cvM3dReset', () => { mgr.resetModelPosition(); cvM3dRefresh(L, true); cvUI(); });
  box.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { CV.m3dMode = b.dataset.tm; mgr.viewportController.setTransformMode(CV.m3dMode); cvSettingsUI(); });
}
/* 왼쪽 칸: 뼈대 목록 · 표정·모프 (NAI 그림판 왼쪽 위, 둘 다 켤 수 있다) */
function cvM3dSideUI() {
  const box = $('#cvSide'); if (!box) return;
  const V = CV.m3dView, L = V && V.L, show = CV.open && !!L && (CV.m3dBones || CV.m3dMorph);
  if (V && !V.unsub) V.unsub = L.m3d.subscribe(() => { if (CV.m3dView === V) cvM3dSideUI(); });
  box.hidden = !show; if (!show) { box.innerHTML = ''; return; }
  const mgr = L.m3d, mid = mgr.selectedModelId, parts = [];
  if (CV.m3dBones) {
    const bones = mid ? mgr.getBones(mid) : new Map(), phys = mid ? mgr.getPhysicsBoneNamesForModel(mid) : new Set(), pe = mgr.getPhysicsEnabled();
    const selB = mgr.getSelectedBoneName(), selM = mgr.getSelectedBoneModelId();
    const rows = mid && bones.size ? [...bones.keys()].map(n => { const on = selM === mid && selB === n, ph = pe && phys.has(n);
      return `<div class="cv-bone${on ? ' on' : ''}${ph ? ' phys' : ''}" data-bone="${escHtml(n)}" title="${escHtml(n)}${ph ? ' — 물리로 움직이는 뼈' : ''}">${escHtml(n)}${ph ? '<span class="cv-btag">P</span>' : ''}</div>`; }).join('')
      : '<div class="cv-empty">뼈대가 없습니다</div>';
    parts.push(`<div class="cv-panel cv-bones"><div class="cv-ptitle">뼈대 목록</div><div class="cv-plist" id="cvBoneList">${rows}</div></div>`);
  }
  if (CV.m3dMorph) {
    const ex = mid ? mgr.getExpressions(mid) : [], mt = mid ? mgr.getMorphTargets(mid) : [];
    const row = (k, n, v) => `<label class="cv-mrow" title="${escHtml(n)}"><span class="cv-mlab">${escHtml(n)}</span><input type="range" min="0" max="1" step="0.01" value="${v}" data-${k}="${escHtml(n)}"><output>${(+v).toFixed(2)}</output></label>`;
    parts.push(`<div class="cv-panel cv-morph">${ex.length ? `<div class="cv-psec${mt.length ? ' bordered' : ''}"><div class="cv-ptitle">표정</div>${ex.map(e => row('ex', e.name, e.value)).join('')}</div>` : ''}`
      + `<div class="cv-ptitle">모프</div><div class="cv-plist">${mt.length ? mt.map(e => row('mt', e.name, e.value)).join('') : '<div class="cv-empty">모프가 없습니다</div>'}</div></div>`);
  }
  // 슬라이더를 끄는 중이면 다시 그리지 않는다 (값 글자만 바꾼다)
  if (box.contains(document.activeElement) && document.activeElement.type === 'range' && box.dataset.sig === String(mid) + CV.m3dBones + CV.m3dMorph) return;
  box.dataset.sig = String(mid) + CV.m3dBones + CV.m3dMorph;
  box.innerHTML = parts.join('');
  box.querySelectorAll('[data-bone]').forEach(r => r.onclick = () => {
    const n = r.dataset.bone;
    if (mgr.getSelectedBoneModelId() === mid && mgr.getSelectedBoneName() === n) mgr.deselectBone(); else mgr.selectBone(mid, n);
  });
  const selRow = box.querySelector('.cv-bone.on'), list = $('#cvBoneList');
  if (selRow && list) { const t = selRow.offsetTop - list.offsetTop, b = t + selRow.offsetHeight; if (t < list.scrollTop || b > list.scrollTop + list.clientHeight) selRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  let raf = 0;
  const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; mgr.render(); mgr.renderToOutput(); cvBump(L); cvRender(); cvLayersUI(); }); };   // NAI If: 한 프레임에 한 번 그린다
  box.querySelectorAll('input[data-ex]').forEach(i => i.oninput = () => { const v = parseFloat(i.value); mgr.setExpressionValue(i.dataset.ex, v, mid); i.nextElementSibling.textContent = v.toFixed(2); redraw(); });
  box.querySelectorAll('input[data-mt]').forEach(i => i.oninput = () => { const v = parseFloat(i.value); mgr.setMorphTargetValue(i.dataset.mt, v, mid); i.nextElementSibling.textContent = v.toFixed(2); redraw(); });
}
/* 3D 설정 창 (NAI T7) — 바깥을 누르면 닫힌다 */
function cvM3dSetOpen() { const p = $('#cvPop'); return !!p && !p.hidden && !!p.querySelector('.cv-m3dset'); }
function cvM3dSetClose() { const p = $('#cvPop'); if (p && cvM3dSetOpen()) p.hidden = true; if (CV._m3dOut) { document.removeEventListener('mousedown', CV._m3dOut, true); CV._m3dOut = null; } cvBotUI(); }
async function cvM3dSetShow() {
  const L = cvCur(); if (!cvIsM3d(L)) return;
  const M = await cvM3dLib(), mgr = L.m3d, pop = $('#cvPop');
  if (CV.hsv) cvHsvCancel();
  const seg = (k, items, cur) => `<div class="cv-seg2" data-k="${k}">${items.map(([v, n]) => `<button class="btn xs${v === cur ? ' primary' : ''}" data-v="${v}">${n}</button>`).join('')}</div>`;
  const paint = () => {
    const proj = mgr.getProjection(), fov = mgr.getFov(), amb = Math.round(100 * mgr.getAmbientIntensity()), dir = Math.round(100 * mgr.getDirectionalIntensity()), ld = mgr.getLightDirection();
    let li = 1, best = -Infinity;   // NAI: 지금 빛 방향과 가장 가까운 단추
    for (const [i, r] of M.LIGHT_DIRS.entries()) { const a = Math.hypot(r.x, r.y, r.z), b = Math.hypot(ld.x, ld.y, ld.z); if (!a || !b) continue; const c = (r.x * ld.x + r.y * ld.y + r.z * ld.z) / (a * b); if (c > best) { best = c; li = i; } }
    const DIRN = { front: '앞', frontTop: '앞 위', top: '위', left: '왼쪽', right: '오른쪽', back: '뒤' };
    const QN = [['veryLow', '매우 낮음'], ['low', '낮음'], ['medium', '보통'], ['high', '높음'], ['veryHigh', '매우 높음']];
    pop.innerHTML = `<div class="cv-m3dset"><b>3D 설정</b>
      <div class="cv-sh">투영</div>${seg('proj', [['perspective', '원근'], ['orthographic', '직교']], proj)}
      ${proj === 'perspective' ? `<label class="rng">시야각 <output>${fov}</output><input type="range" id="cv3Fov" min="10" max="120" step="1" value="${fov}"></label>` : ''}
      <div class="cv-sh">조명</div>
      <label class="rng">주변광 <output>${amb}%</output><input type="range" id="cv3Amb" min="0" max="200" step="1" value="${amb}"></label>
      <label class="rng">직접광 <output>${dir}%</output><input type="range" id="cv3Dir" min="0" max="300" step="1" value="${dir}"></label>
      <div class="cv-sh">빛 방향</div>${seg('ld', M.LIGHT_DIRS.map((d, i) => [String(i), DIRN[d.key]]), String(li))}
      <div class="cv-sh">그림자</div>${seg('sh', [['1', '켬'], ['0', '끔']], mgr.getShadowsEnabled() ? '1' : '0')}
      ${mgr.getShadowsEnabled() ? `<div class="cv-sh sub">품질</div>${seg('q', QN, mgr.getShadowQuality())}` : ''}
      <div class="cv-sh">표시</div><div class="cv-sh sub">뼈대 보이기</div>${seg('bones', [['1', '켬'], ['0', '끔']], mgr.getShowBoneHelpers() ? '1' : '0')}
      <div class="cv-sh">물리</div>${seg('phys', [['1', '켬'], ['0', '끔']], mgr.getPhysicsEnabled() ? '1' : '0')}</div>`;
    const rng = (id, f, unit) => { const n = pop.querySelector(id); if (n) n.oninput = () => { f(+n.value); n.previousElementSibling.textContent = n.value + unit; }; };
    rng('#cv3Fov', v => mgr.setFov(v), ''); rng('#cv3Amb', v => mgr.setAmbientIntensity(v / 100), '%'); rng('#cv3Dir', v => mgr.setDirectionalIntensity(v / 100), '%');
    pop.querySelectorAll('.cv-seg2 button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.k, v = b.dataset.v;
      if (k === 'proj') mgr.setProjection(v);
      else if (k === 'ld') { const d = M.LIGHT_DIRS[+v]; mgr.setLightDirection(d.x, d.y, d.z); }
      else if (k === 'sh') mgr.setShadowsEnabled(v === '1');
      else if (k === 'q') mgr.setShadowQuality(v);
      else if (k === 'bones') { mgr.setShowBoneHelpers(v === '1'); }
      else if (k === 'phys') mgr.setPhysicsEnabled(v === '1');
      paint(); cvM3dSideUI();
    });
  };
  pop.hidden = false; paint(); cvBotUI();
  if (CV._m3dOut) document.removeEventListener('mousedown', CV._m3dOut, true);
  CV._m3dOut = e => { if (!pop.contains(e.target) && !(e.target.closest && e.target.closest('#cvM3dSet'))) cvM3dSetClose(); };
  document.addEventListener('mousedown', CV._m3dOut, true);
}
/* 동작 재생 줄 (NAI IT — 3D 화면을 띄웠고 고른 모델에 동작이 있을 때만) */
function cvM3dAnimUI() {
  const box = $('#cvAnim'); if (!box) return;
  const V = CV.m3dView, mgr = V && V.L.m3d, id = mgr && mgr.selectedModelId;
  if (!CV.open || !V || !id || !mgr.hasAnimation(id)) { box.hidden = true; box.innerHTML = ''; return; }
  const list = mgr.getAnimations(id), cur = mgr.getActiveAnimationIndex(id), playing = mgr.isAnimationPlaying(id), sp = mgr.getAnimationSpeed(id);
  box.hidden = false;
  box.innerHTML = (list.length > 1 ? `<select id="cvAnimSel" title="동작 고르기">${list.map(a => `<option value="${a.index}"${a.index === cur ? ' selected' : ''}>${escHtml(a.name)}</option>`).join('')}</select>` : `<span class="cv-aname" title="${escHtml(list[0].name)}">${escHtml(list[0].name)}</span>`)
    + `<button class="btn xs" id="cvAnimPlay" title="${playing ? '일시 정지' : '재생'}">${playing ? '⏸' : '▶'}</button><button class="btn xs" id="cvAnimStop" title="정지 — 처음 자세로">⏹</button>`
    + `<span class="cv-aspd"><output>${sp.toFixed(1)}x</output><input type="range" id="cvAnimSpd" min="0.1" max="3" step="0.1" value="${sp}" title="속도"></span>`;
  const done = () => { mgr.render(); mgr.renderToOutput(); cvBump(V.L); cvM3dAnimUI(); cvLayersUI(); };
  const sel = $('#cvAnimSel'); if (sel) sel.onchange = () => { mgr.setActiveAnimation(parseInt(sel.value, 10), id); done(); };
  $('#cvAnimPlay').onclick = async () => { if (mgr.isAnimationPlaying(id)) mgr.pauseAnimation(id); else { try { await mgr.playAnimation(id); } catch (e) { logErr('3D 동작 재생 실패: ' + e.message); toast('동작을 틀지 못했습니다 — ' + e.message, 'err'); } } cvM3dAnimUI(); };
  $('#cvAnimStop').onclick = () => { mgr.stopAnimation(id); done(); };
  $('#cvAnimSpd').oninput = e => { const v = parseFloat(e.target.value); mgr.setAnimationSpeed(v, id); e.target.previousElementSibling.textContent = v.toFixed(1) + 'x'; };
}
