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
   그림판 3D 모델 레이어 — NAI 웹 그림판(빌드 b50892a)의 3D 레이어를 따라 만든 것
   ───────────────────────────────────────────────────────────────────────────
   NAI 번들에서 읽고 옮긴 것: 3D 관리자(wV) · 화면 조종(wl: 원근·직교 카메라, 궤도 조종, 옮기기 손잡이, 바닥 격자·축, WASDQE 이동)
   · 도구 포즈(gt)·모델 변형(gi) · 파일 읽기(x_·xp·xc·xl·xd·xf: glb·gltf·vrm·pmx·pmd·zip·그림)
   · MMD 표정 덧붙임(재질·뼈·UV·그룹 모프 — NAI 가 MMD 불러오기의 모양 만들기에 더한 것)
   쓰는 공개 라이브러리 (assets/three, NOTICE.txt): three.js r182(본체·GLTF·궤도·옮기기 손잡이·TGA)
   · three.js r171 MMD 부품(MMDLoader·MMDAnimationHelper·MMDPhysics·CCDIKSolver·mmd-parser·MMDToonShader — NAI 도 r182 본체에
     r171 MMD 셰이더를 그대로 쓴다, 번들 글자로 확인) · ammo.js(물리) · @pixiv/three-vrm 3.5.5 · JSZip 3.10.1
   NAI 와 다르게 한 것 (NAI 코드로 확인한 고장만 고쳤다)
   · 압축하지 않은 .pmx·.pmd 를 넣으면 NAI 는 압축 파일 읽기로 넘겨 실패한다(x_ → xc) — 우리는 그림 없이 그대로 읽는다
   · NAI 는 PMD 의 표정 분류 번호(눈·입·기타)를 PMX 모프 종류로 읽어 표정이 있는 PMD 를 읽다 멈춘다 — 우리는 PMX 에만 덧붙인다
   · 압축 파일 속 그림이 다 읽히기 전에 임시 주소를 지우지 않는다(NAI 는 모델을 만든 바로 뒤에 지운다)
   · MMD 동작을 틀 때 뼈 모프가 걸린 뼈의 동작이 멈추지 않게 한다(NAI 는 매 프레임 그 뼈를 처음 자세로 되돌린다 — applyRuntimeMorphs)
   · 3D 화면 그림 버퍼의 긴 쪽을 4096 장치 화소로 묶는다(VIEW_MAX — NAI 는 한도 없음) · 레이어를 버릴 때 WebGL 문맥도 놓는다
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';
import { MMDParser } from 'three/addons/libs/mmdparser.module.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const VENDOR = '/vendor/three/';
/* 우리 앱만: 3D 화면 그림 버퍼의 긴 쪽 한도(장치 화소). NAI 는 한도가 없어 크게 확대하면 버퍼가 화면 크기 × 배율로 커진다
   (2560 그림을 10배 → 25600 화소, 안티에일리어싱까지 그래픽 메모리 수 GB). 넘으면 화소 배율만 낮춘다 — 저장 그림은 그림판 크기라 그대로다. */
const VIEW_MAX = 4096;
const viewPixelRatio = (w, h) => Math.min(window.devicePixelRatio || 1, VIEW_MAX / Math.max(w, h, 1));
/* NAI 모델 넣기 단추가 받는 파일 (C5 의 input accept) */
export const MODEL_ACCEPT = '.glb,.gltf,.vrm,.pmx,.pmd,.zip,.png,.jpg,.jpeg,.webp,.bmp,.gif';
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];
const isImageName = n => { const t = String(n).toLowerCase(); return IMG_EXT.some(e => t.endsWith(e)); };
export function isModelFileName(n) { const t = String(n || '').toLowerCase(); return /\.(glb|gltf|vrm|pmx|pmd|zip)$/.test(t) || isImageName(t); }
/* NAI 3D 설정 창의 빛 방향 6가지 (T8) */
export const LIGHT_DIRS = [{ key: 'front', x: 0, y: 0, z: 500 }, { key: 'frontTop', x: 0, y: 200, z: 500 }, { key: 'top', x: 0, y: 500, z: 100 },
  { key: 'left', x: -500, y: 100, z: 200 }, { key: 'right', x: 500, y: 100, z: 200 }, { key: 'back', x: 0, y: 100, z: -500 }];
export const SHADOW_QUALITY_MAP = { veryLow: 512, low: 1024, medium: 2048, high: 4096, veryHigh: 8192 };
const LOOK_AT_EXPRESSIONS = new Set(['lookUp', 'lookDown', 'lookLeft', 'lookRight']);

/* three.js r171 MMD 부품은 만들 때마다 «r172 에서 없어진다»는 안내를 콘솔에 찍는다(NAI 사본에는 이 줄이 없다).
   그 안내 한 줄만 거른다 — 다른 경고는 그대로 나간다. */
const R172_NOTE = /has been deprecated and will be removed with r172/;
function quietR172(fn) {
  const w = console.warn;
  console.warn = function (...a) { if (!R172_NOTE.test(String(a[0]))) return w.apply(this, a); };
  try { return fn(); } finally { console.warn = w; }
}
function m3dWarn(where, err) {
  const msg = '3D 레이어: ' + where + ' — ' + (err && err.message ? err.message : err);
  console.warn(msg);
  if (typeof window.logErr === 'function') { try { window.logErr(msg); } catch (e) { console.warn('logErr 실패', e); } }
}

/* ── 압축 파일 (JSZip, 파일 이름은 UTF-8 이 아니면 Shift_JIS — NAI xo) ── */
const NAME_UTF8 = new TextDecoder('utf8', { fatal: true }), NAME_SJIS = new TextDecoder('shift_jis', { fatal: false });
const ZIP_OPTS = { decodeFileName(b) { const u = b instanceof Uint8Array ? b : new Uint8Array(b.map(c => c.codePointAt(0))); try { return NAME_UTF8.decode(u); } catch (e) { return NAME_SJIS.decode(u); } } };
let ZIP_P = null;
function jszip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return ZIP_P || (ZIP_P = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = VENDOR + 'jszip/jszip.min.js'; s.async = true;
    s.addEventListener('load', () => (window.JSZip ? res(window.JSZip) : rej(new Error('JSZip 을 찾지 못했습니다'))));
    s.addEventListener('error', () => { ZIP_P = null; rej(new Error('jszip.min.js 를 불러오지 못했습니다')); });
    document.head.append(s);
  }));
}
/* 그림 같은 딸린 파일이 다 읽힐 때까지 기다릴 수 있는 LoadingManager (NAI 는 m_ 를 그대로 쓰고 바로 주소를 지운다) */
function trackedManager() {
  const mgr = new THREE.LoadingManager(); let pending = 0, waiters = [];
  const start = mgr.itemStart.bind(mgr), end = mgr.itemEnd.bind(mgr);
  mgr.itemStart = u => { pending++; start(u); };
  mgr.itemEnd = u => { pending = Math.max(0, pending - 1); end(u); if (!pending) { const w = waiters; waiters = []; w.forEach(f => f()); } };
  mgr.idle = (ms = 20000) => (pending ? Promise.race([new Promise(r => waiters.push(r)), new Promise(r => setTimeout(r, ms))]) : Promise.resolve());
  return mgr;
}

/* ── 물리 (ammo.js — NAI ensureModelHelper: 처음 쓸 때 한 번 불러온다) ── */
let AMMO_P = null, AMMO_OK = false;
function loadAmmo() {
  if (AMMO_OK) return Promise.resolve();
  return AMMO_P || (AMMO_P = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = VENDOR + 'jsm/libs/ammo.wasm.js'; s.async = true;
    s.addEventListener('load', () => {
      const f = window.Ammo;
      if (typeof f !== 'function') { rej(new Error('ammo 를 찾지 못했습니다')); return; }
      f({ locateFile: n => VENDOR + 'jsm/libs/' + n }).then(a => { window.Ammo = a; AMMO_OK = true; res(); }).catch(rej);
    });
    s.addEventListener('error', () => { AMMO_P = null; rej(new Error('ammo.wasm.js 를 불러오지 못했습니다')); });
    document.head.append(s);
  }));
}

/* ── MMD: NAI 가 모양 만들기(GeometryBuilder)에 더한 재질·뼈·UV·그룹 모프 표 (PMX 만 — 본문 머리 주석) ── */
function mmdMorphExtras(e) {
  const v = {}, b = {}, x = {}, w = {};
  if (!e || !e.metadata || e.metadata.format !== 'pmx') return { materialMorphs: v, boneMorphs: b, uvMorphs: x, groupMorphSubs: w };
  for (let t = 0; t < e.metadata.morphCount; t++) {
    const i = e.morphs[t];
    if (i.type === 8) v[i.name] = i.elements.map(el => ({ index: el.index, type: el.type, diffuse: Array.from(el.diffuse), specular: Array.from(el.specular), shininess: el.shininess, ambient: Array.from(el.ambient), edgeColor: Array.from(el.edgeColor), edgeSize: el.edgeSize }));
    else if (i.type === 2) b[i.name] = i.elements.map(el => ({ index: el.index, position: Array.from(el.position), rotation: Array.from(el.rotation) }));
    else if (i.type >= 3 && i.type <= 7) x[i.name] = { channel: i.type - 3, elements: i.elements.map(el => ({ index: el.index, uv: Array.from(el.uv) })) };
  }
  for (let t = 0; t < e.metadata.morphCount; t++) {
    const i = e.morphs[t]; if (i.type !== 0) continue;
    const r = [];
    for (let k = 0; k < i.elementCount; k++) {
      const n = i.elements[k].index, a = i.elements[k].ratio;
      if (n < 0 || n >= e.metadata.morphCount) continue;
      const o = e.morphs[n]; if (o.type !== 1) r.push({ name: o.name, type: o.type, ratio: a });
    }
    if (r.length) w[i.name] = r;
  }
  return { materialMorphs: v, boneMorphs: b, uvMorphs: x, groupMorphSubs: w };
}
function mmdLoader(manager) {
  const l = quietR172(() => new MMDLoader(manager)), mb = l.meshBuilder, build = mb.build.bind(mb);
  mb.build = (data, ...rest) => { const mesh = build(data, ...rest); Object.assign(mesh.geometry.userData.MMD, mmdMorphExtras(data)); return mesh; };
  return l;
}
/* VPD 자세 파일 → 한 장짜리 동작 (NAI xc 안의 함수) */
function vpdClip(text, mesh, name) {
  const vpd = new MMDParser.Parser().parseVpd(text, true), tracks = [], have = new Set(mesh.skeleton.bones.map(b => b.name));
  for (const b of vpd.bones) {
    if (!have.has(b.name)) continue;
    const bone = mesh.skeleton.getBoneByName(b.name); if (!bone) continue;
    const p = bone.position.toArray(), key = '.bones[' + b.name + ']';
    tracks.push(new THREE.VectorKeyframeTrack(key + '.position', [0], [p[0] + b.translation[0], p[1] + b.translation[1], p[2] + b.translation[2]]),
      new THREE.QuaternionKeyframeTrack(key + '.quaternion', [0], b.quaternion));
  }
  return tracks.length ? { name, clip: new THREE.AnimationClip(name, 1 / 30, tracks) } : null;
}
const bonesOf = root => { const m = new Map(); root.traverse(o => { if (o instanceof THREE.Bone) m.set(o.name, o); }); return m; };
const safeDecode = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };   // «%» 가 깨진 주소는 그대로 쓴다 (NAI 와 같음)
const decodeText = bytes => { try { return NAME_UTF8.decode(bytes); } catch (e) { return NAME_SJIS.decode(bytes); } };
const baseName = n => n.replace(/\\/g, '/').split('/').pop() || n;

/* ── 파일 읽기 (NAI xs·xl·xc·xd·xu·xh·xp·xf·x_) ── */
function gltfEntry(g) { const group = new THREE.Group(); group.add(g.scene); return { group, bones: bonesOf(g.scene), clips: g.animations.map(c => ({ name: c.name || 'Animation', clip: c })) }; }
function loadGltfUrl(url, manager) {
  const l = new GLTFLoader(manager);
  return new Promise((res, rej) => l.load(url, g => res(gltfEntry(g)), undefined, e => rej(new Error('GLTF 모델을 읽지 못했습니다: ' + (e && e.message || e)))));
}
async function loadGltfZip(buf) {
  const Z = await jszip(), z = await Z.loadAsync(buf, ZIP_OPTS), names = Object.keys(z.files);
  const main = names.find(n => n.toLowerCase().endsWith('.glb')) ?? names.find(n => n.toLowerCase().endsWith('.gltf'));
  if (!main) throw new Error('압축 파일 안에 .gltf·.glb 파일이 없습니다');
  if (main.toLowerCase().endsWith('.glb')) {
    const u = URL.createObjectURL(new Blob([await z.files[main].async('arraybuffer')], { type: 'model/gltf-binary' }));
    try { return await loadGltfUrl(u); } finally { URL.revokeObjectURL(u); }
  }
  const map = new Map();
  for (const [n, f] of Object.entries(z.files)) { if (f.dir) continue; map.set(n, URL.createObjectURL(await f.async('blob'))); }
  const mgr = trackedManager();
  mgr.setURLModifier(u => {
    const t = safeDecode(u);
    if (map.has(t)) return map.get(t);
    const i = t.replace(/^\.\//, '').replace(/^\//, ''); if (map.has(i)) return map.get(i);
    const r = i.split('/').pop() || i; for (const [k, v] of map) if (k.endsWith('/' + r) || k === r) return v;
    return u;
  });
  try { const out = await loadGltfUrl(map.get(main), mgr); await mgr.idle(); return out; } finally { for (const v of map.values()) URL.revokeObjectURL(v); }
}
async function loadMmdMesh(loader, url) {
  const mesh = await new Promise((res, rej) => loader.load(url, res, () => {}, rej));
  if (Array.isArray(mesh.material)) for (const m of mesh.material) if ('emissive' in m) m.emissive.set(0);   // NAI 와 같이 MMD 주변색(ambient→emissive)을 끈다
  return mesh;
}
async function loadMmdZip(buf) {
  const Z = await jszip(), z = await Z.loadAsync(buf, ZIP_OPTS), names = Object.keys(z.files);
  const main = names.find(n => n.toLowerCase().endsWith('.pmx')) ?? names.find(n => n.toLowerCase().endsWith('.pmd'));
  if (!main) throw new Error('압축 파일 안에 .pmx·.pmd 파일이 없습니다');
  const vmds = names.filter(n => n.toLowerCase().endsWith('.vmd')), map = new Map();
  for (const [n, f] of Object.entries(z.files)) { if (f.dir) continue; map.set(n.replace(/\\/g, '/'), URL.createObjectURL(await f.async('blob'))); }
  const dir = main.replace(/\\/g, '/').replace(/[^/]*$/, ''), mgr = trackedManager();
  mgr.setURLModifier(u => {
    const t = safeDecode(u.replace(/\\/g, '/'));
    if (map.has(t)) return map.get(t);
    const i = t.replace(/^blob:[a-z]+:\/\/[^/]+\//, ''); if (map.has(i)) return map.get(i);
    const r = dir + i; if (map.has(r)) return map.get(r);
    const n = i.replace(/^\.\//, '').replace(/^\//, ''); if (map.has(n)) return map.get(n);
    const s = n.split('/').pop() || n; for (const [k, v] of map) if ((k.split('/').pop() || k) === s) return v;
    return u;
  });
  const url = map.get(main), loader = mmdLoader(mgr);
  try {
    const mesh = await loadMmdMesh(loader, url), clips = [];
    for (const [k, n] of vmds.entries()) {
      try { const clip = await new Promise((res, rej) => loader.loadAnimation([map.get(n.replace(/\\/g, '/'))], mesh, res, () => {}, rej)); clips.push({ name: baseName(n).replace(/\.vmd$/i, '') || `Animation ${k + 1}`, clip }); }
      catch (e) { m3dWarn('VMD 동작 «' + baseName(n) + '» 을 읽지 못했습니다', e); }
    }
    for (const n of names.filter(n => n.toLowerCase().endsWith('.vpd'))) {
      try { const c = vpdClip(decodeText(await z.files[n].async('uint8array')), mesh, baseName(n).replace(/\.vpd$/i, '')); if (c) clips.push(c); }
      catch (e) { m3dWarn('VPD 자세 «' + baseName(n) + '» 를 읽지 못했습니다', e); }
    }
    await mgr.idle();
    const group = new THREE.Group(); group.add(mesh);
    return { group, bones: bonesOf(mesh), clips, mesh };
  } finally { for (const v of map.values()) URL.revokeObjectURL(v); }
}
/* 압축하지 않은 .pmx·.pmd (NAI 는 실패 — 본문 머리 주석): 딸린 그림이 없으니 그림은 빈 흰색으로 */
const WHITE_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADklEQVR4AWL6////fwAAAAD//w7I1cwAAAAGSURBVAMACgUD/9k79a8AAAAASUVORK5CYII=';   // 흰 점 1×1 (브라우저가 만든 PNG — 시험이 255,255,255,255 로 확인)
async function loadMmdBare(buf) {
  const url = URL.createObjectURL(new Blob([buf])), mgr = trackedManager();
  mgr.setURLModifier(u => (u === url || /^data:/.test(u) ? u : WHITE_PX));
  try { const mesh = await loadMmdMesh(mmdLoader(mgr), url); await mgr.idle(); const group = new THREE.Group(); group.add(mesh); return { group, bones: bonesOf(mesh), clips: [], mesh }; }
  finally { URL.revokeObjectURL(url); }
}
async function loadVrmUrl(url) {
  const l = new GLTFLoader(); l.register(p => new VRMLoaderPlugin(p));
  const g = await l.loadAsync(url), vrm = g.userData.vrm;
  if (!vrm) throw new Error('VRM 정보를 찾지 못했습니다');
  VRMUtils.removeUnnecessaryVertices(g.scene); VRMUtils.combineSkeletons(g.scene); VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse(o => { if (o instanceof THREE.Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.alphaTest > 0 && m.uniforms && m.uniforms.alphaTest) m.uniforms.alphaTest.value = m.alphaTest; });
  const group = new THREE.Group(); group.add(vrm.scene);
  return { group, bones: bonesOf(vrm.scene), clips: g.animations.map(c => ({ name: c.name || 'Animation', clip: c })), vrm };
}
async function loadVrmBlob(blob) { const u = URL.createObjectURL(blob); try { return await loadVrmUrl(u); } finally { URL.revokeObjectURL(u); } }
async function loadVrmZip(buf) {
  const Z = await jszip(), z = await Z.loadAsync(buf, ZIP_OPTS), n = Object.keys(z.files).find(f => f.toLowerCase().endsWith('.vrm'));
  if (!n) throw new Error('압축 파일 안에 .vrm 파일이 없습니다');
  return loadVrmBlob(new Blob([await z.files[n].async('arraybuffer')], { type: 'application/octet-stream' }));
}
async function loadZip(buf) {
  const Z = await jszip(), names = Object.keys((await Z.loadAsync(buf, ZIP_OPTS)).files).map(n => n.toLowerCase());
  if (names.some(n => n.endsWith('.pmx') || n.endsWith('.pmd'))) return loadMmdZip(buf);
  if (names.some(n => n.endsWith('.vrm'))) return loadVrmZip(buf);
  if (names.some(n => n.endsWith('.glb') || n.endsWith('.gltf'))) return loadGltfZip(buf);
  throw new Error('압축 파일 안에 넣을 수 있는 모델(.glb·.gltf·.vrm·.pmx·.pmd)이 없습니다');
}
/* 그림 → 두께 없는 판 (높이 1, 가로는 그림 비율 — NAI xf: 표준 재질·양면·투명·alphaTest 0.01) */
async function loadImagePlane(blob) {
  const u = URL.createObjectURL(blob);
  try {
    const t = await new THREE.TextureLoader().loadAsync(u); t.colorSpace = THREE.SRGBColorSpace;
    const ar = t.image.width / t.image.height, mesh = new THREE.Mesh(new THREE.PlaneGeometry(+ar, 1), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, transparent: true, alphaTest: 0.01 }));
    const group = new THREE.Group(); group.add(mesh); return { group, bones: new Map(), clips: [] };
  } finally { URL.revokeObjectURL(u); }
}
async function loadModelData(name, buf) {
  const t = String(name || '').toLowerCase();
  if (buf.byteLength >= 4 && new DataView(buf).getUint16(0) === 0x504b) return loadZip(buf);   // «PK» = 압축 파일 (NAI 는 이름보다 먼저 본다)
  if (isImageName(t)) return loadImagePlane(new Blob([buf]));
  if (t.endsWith('.zip')) return loadZip(buf);
  if (t.endsWith('.vrm')) return loadVrmBlob(new Blob([buf]));
  if (t.endsWith('.glb') || t.endsWith('.gltf')) { const u = URL.createObjectURL(new Blob([buf])); try { return await loadGltfUrl(u); } finally { URL.revokeObjectURL(u); } }
  if (t.endsWith('.pmx') || t.endsWith('.pmd')) return loadMmdBare(buf);
  throw new Error('넣을 수 없는 파일입니다. .glb·.gltf·.vrm·.pmx·.pmd·.zip 이나 그림 파일을 넣으세요');
}

/* ═══ 화면 조종 (NAI wl) ═══ */
class ViewportController {
  constructor(renderer, scene) {
    this._projectionType = 'perspective'; this.animationId = null; this.keysPressed = new Set(); this.lastTime = 0; this.moveSpeed = 200;
    this.beforeRenderCallbacks = []; this.helpers = []; this.outputCtx = null; this.outputWidth = 0; this.outputHeight = 0; this.onOutputRendered = null;
    this.renderer = renderer; this.scene = scene;
    const el = renderer.domElement, ar = el.width / el.height || 1;
    this.perspCamera = new THREE.PerspectiveCamera(50, ar, 0.1, 1e4); this.perspCamera.position.set(0, 150, 400); this.perspCamera.lookAt(0, 50, 0);
    this.orthoCamera = new THREE.OrthographicCamera(-200 * ar, 200 * ar, 200, -200, 0.1, 1e4); this.orthoCamera.position.copy(this.perspCamera.position); this.orthoCamera.lookAt(0, 50, 0);
    this.orbitControls = new OrbitControls(this.camera, el); this.orbitControls.target.set(0, 50, 0); this.orbitControls.enableDamping = true; this.orbitControls.dampingFactor = 0.1;
    this.transformControls = new TransformControls(this.camera, el); this.transformControls.setSize(0.8);
    const gizmo = this.transformControls.getHelper(); this.scene.add(gizmo);
    this.transformControls.addEventListener('dragging-changed', e => { this.orbitControls.enabled = !e.value; });
    this.grid = new THREE.GridHelper(1e3, 50, 0x888888, 0x444444); const gm = this.grid.material; gm.transparent = true; gm.opacity = 0.3; this.grid.visible = false; this.scene.add(this.grid);
    this.axes = new THREE.AxesHelper(100); this.axes.visible = false; this.scene.add(this.axes);
    this.helpers = [this.grid, this.axes, gizmo];
    this.renderLoop = () => {
      this.animationId = requestAnimationFrame(this.renderLoop);
      const now = performance.now(), dt = (now - this.lastTime) / 1e3; this.lastTime = now;
      for (const f of this.beforeRenderCallbacks) f(dt);
      this.updateMovement(dt); this.orbitControls.update(); this.renderer.render(this.scene, this.camera);
    };
    this.handleKeyDown = e => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) this.keysPressed.add(k); };
    this.handleKeyUp = e => { this.keysPressed.delete(e.key.toLowerCase()); };
  }
  get camera() { return this._projectionType === 'perspective' ? this.perspCamera : this.orthoCamera; }
  get projectionType() { return this._projectionType; }
  setProjection(p) {
    if (p === this._projectionType) return;
    const cam = this.camera, tgt = this.orbitControls.target.clone();
    if (p === 'orthographic') {
      const h = cam.position.distanceTo(tgt) * Math.tan(this.perspCamera.fov * Math.PI / 180 / 2), ar = this.perspCamera.aspect, o = this.orthoCamera;
      o.left = -h * ar; o.right = h * ar; o.top = h; o.bottom = -h; o.near = this.perspCamera.near; o.far = this.perspCamera.far;
      o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.zoom = 1; o.updateProjectionMatrix();
    } else { this.perspCamera.position.copy(cam.position); this.perspCamera.quaternion.copy(cam.quaternion); this.perspCamera.updateProjectionMatrix(); }
    this._projectionType = p; this.orbitControls.object = this.camera; this.transformControls.camera = this.camera; this.orbitControls.update();
  }
  addHelper(h) { this.helpers.push(h); }
  setOutputTarget(ctx, w, h, cb) { this.outputCtx = ctx; this.outputWidth = w; this.outputHeight = h; this.onOutputRendered = cb; }
  start(w, h) {
    if (this.animationId !== null) return;
    this.renderer.setPixelRatio(viewPixelRatio(w, h)); this.renderer.setSize(w, h); this.updateCameraAspect(w, h);
    this.grid.visible = true; this.axes.visible = true;
    window.addEventListener('keydown', this.handleKeyDown); window.addEventListener('keyup', this.handleKeyUp);
    this.lastTime = performance.now(); this.renderLoop();
  }
  stop() {
    if (this.animationId !== null) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    window.removeEventListener('keydown', this.handleKeyDown); window.removeEventListener('keyup', this.handleKeyUp);
    this.keysPressed.clear(); this.transformControls.detach(); this.renderToOutput(); this.grid.visible = false; this.axes.visible = false;
  }
  resize(w, h) { this.renderer.setPixelRatio(viewPixelRatio(w, h)); this.renderer.setSize(w, h); this.updateCameraAspect(w, h); }
  updateCameraAspect(w, h) {
    const ar = w / h || 1; this.perspCamera.aspect = ar; this.perspCamera.updateProjectionMatrix();
    const half = (this.orthoCamera.top - this.orthoCamera.bottom) / 2; this.orthoCamera.left = -half * ar; this.orthoCamera.right = half * ar; this.orthoCamera.updateProjectionMatrix();
  }
  attachToObject(o, mode) { this.transformControls.attach(o); this.transformControls.setMode(mode); }
  detach() { this.transformControls.detach(); }
  setTransformMode(m) { this.transformControls.setMode(m); }
  getTransformMode() { return this.transformControls.mode; }
  get isActive() { return this.animationId !== null; }
  fitToBox(box) {
    const c = new THREE.Vector3(); box.getCenter(c);
    const s = new THREE.Vector3(); box.getSize(s);
    const r = Math.max(s.x, s.y, s.z), d = r / (2 * Math.tan(this.perspCamera.fov * (Math.PI / 180) / 2)) * 1.6;
    this.perspCamera.position.set(c.x, c.y + 0.15 * r, c.z + d); this.orthoCamera.position.copy(this.perspCamera.position);
    this.orbitControls.target.copy(c); this.camera.lookAt(c); this.orbitControls.update();
    const g0 = this.grid, gi = this.helpers.indexOf(g0);
    this.scene.remove(g0); g0.dispose(); this.grid = new THREE.GridHelper(5 * r, 50, 0x888888, 0x444444);
    const gm = this.grid.material; gm.transparent = true; gm.opacity = 0.3; this.grid.visible = g0.visible; this.scene.add(this.grid);
    if (gi >= 0) this.helpers[gi] = this.grid; else this.helpers.push(this.grid);
    const a0 = this.axes, ai = this.helpers.indexOf(a0);
    this.scene.remove(a0); a0.dispose(); this.axes = new THREE.AxesHelper(0.5 * r); this.axes.visible = a0.visible; this.scene.add(this.axes);
    if (ai >= 0) this.helpers[ai] = this.axes; else this.helpers.push(this.axes);
    this.moveSpeed = +r; this.perspCamera.near = 0.001 * r; this.perspCamera.far = 100 * r; this.perspCamera.updateProjectionMatrix();
    const h = 0.8 * r, ar = this.perspCamera.aspect, o = this.orthoCamera;
    o.left = -h * ar; o.right = h * ar; o.top = h; o.bottom = -h; o.near = 0.001 * r; o.far = 100 * r; o.updateProjectionMatrix();
  }
  renderToOutput() {
    if (!this.outputCtx) return;
    const vis = this.helpers.map(h => h.visible);
    for (const h of this.helpers) h.visible = false;
    this.renderer.render(this.scene, this.camera);
    this.outputCtx.clearRect(0, 0, this.outputWidth, this.outputHeight); this.outputCtx.drawImage(this.renderer.domElement, 0, 0, this.outputWidth, this.outputHeight);
    for (let i = 0; i < this.helpers.length; i++) this.helpers[i].visible = vis[i];
    this.renderer.render(this.scene, this.camera);
    if (this.onOutputRendered) this.onOutputRendered();
  }
  addBeforeRender(f) { this.beforeRenderCallbacks.push(f); }
  removeBeforeRender(f) { const i = this.beforeRenderCallbacks.indexOf(f); if (i >= 0) this.beforeRenderCallbacks.splice(i, 1); }
  dispose() {
    this.stop(); this.orbitControls.dispose(); this.transformControls.dispose();
    this.scene.remove(this.grid); this.scene.remove(this.axes); this.scene.remove(this.transformControls.getHelper()); this.grid.dispose(); this.axes.dispose();
  }
  updateMovement(dt) {
    if (!this.keysPressed.size) return;
    const step = this.moveSpeed * dt, fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(); right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const mv = new THREE.Vector3(), k = this.keysPressed;
    if (k.has('w')) mv.add(fwd.clone().multiplyScalar(step)); if (k.has('s')) mv.add(fwd.clone().multiplyScalar(-step));
    if (k.has('a')) mv.add(right.clone().multiplyScalar(-step)); if (k.has('d')) mv.add(right.clone().multiplyScalar(step));
    if (k.has('q')) mv.y -= step; if (k.has('e')) mv.y += step;
    this.camera.position.add(mv); this.orbitControls.target.add(mv);
  }
}

/* ═══ 3D 관리자 (NAI wV) — 레이어 하나에 하나. 그린 결과는 outputCanvas(2D) 로 그림판이 합친다 ═══ */
export class Model3DManager {
  constructor(w, h) {
    this.models = new Map(); this._selectedModelId = null; this.nextModelId = 1; this.showBoneHelpers = true; this.viewportActive = false; this.modelCount = 0;
    this._shadowsEnabled = false; this._shadowQuality = 'high'; this._physicsEnabled = false; this._layerActive = true;
    this._selectedBoneName = null; this._selectedBoneModelId = null; this._listeners = new Set();
    this.animationFrameId = null; this.animationLastTime = 0; this._onAnimationFrame = null;
    this.width = w; this.height = h;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    this.renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, preserveDrawingBuffer: true, antialias: true });
    this.renderer.setSize(w, h); this.renderer.setClearColor(0, 0); this.renderer.shadowMap.enabled = false; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6); this.scene.add(this.ambientLight);
    const d = this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(0, 200, 500); d.castShadow = false;
    d.shadow.mapSize.width = 4096; d.shadow.mapSize.height = 4096; d.shadow.bias = -0.001; d.shadow.normalBias = 0.02; this.scene.add(d);
    this.backLight = new THREE.DirectionalLight(0xffffff, 0.3); this.backLight.position.set(0, -100, -300); this.scene.add(this.backLight);
    this.allBoneHelpers = new THREE.Group(); this.scene.add(this.allBoneHelpers);
    this._outputCanvas = document.createElement('canvas'); this._outputCanvas.width = w; this._outputCanvas.height = h; this._outputCtx = this._outputCanvas.getContext('2d');
    this._viewportController = new ViewportController(this.renderer, this.scene); this._viewportController.addHelper(this.allBoneHelpers);
    this._viewportController.setOutputTarget(this._outputCtx, w, h, () => {});
    this.boundTickAnimation = dt => this.tickAnimation(dt);
  }
  get outputCanvas() { return this._outputCanvas; }
  get outputCtx() { return this._outputCtx; }
  get viewportController() { return this._viewportController; }
  get selectedModelId() { return this._selectedModelId; }
  set selectedModelId(id) { if (id === null || this.models.has(id)) this._selectedModelId = id; }
  selectModel(id) { this.selectedModelId = id; }

  async addModelFromData(fileName, buf) {
    const dt = await loadModelData(fileName, buf);
    this.modelCount++;
    const name = fileName || `Model ${this.modelCount}`, id = `model_${this.nextModelId++}`, grp = new THREE.Group();
    grp.name = id; grp.userData.modelId = id; grp.add(dt.group);
    const box = new THREE.Box3().setFromObject(grp), sz = new THREE.Vector3(); box.getSize(sz);
    const diag = sz.length();
    if (this.models.size > 0) {   // 앞 모델들 오른쪽에 둔다
      let mx = 0; for (const m of this.models.values()) { const x = new THREE.Box3().setFromObject(m.group).max.x; if (x > mx) mx = x; }
      grp.position.x = mx + 0.5 * sz.x + 0.2 * diag;
    }
    this.scene.add(grp); grp.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    const hg = new THREE.Group(); hg.name = `helpers_${id}`; this.allBoneHelpers.add(hg);
    const rest = new Map(); for (const [n, b] of dt.bones) rest.set(n, { position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone() });
    let materialMorphs, baseMaterialStates, boneMorphs, uvMorphs, groupMorphSubs, baseUVs;
    if (dt.mesh) {
      const M = dt.mesh.geometry.userData && dt.mesh.geometry.userData.MMD;
      if (M) {
        if (M.materialMorphs && Object.keys(M.materialMorphs).length) { materialMorphs = M.materialMorphs; baseMaterialStates = (Array.isArray(dt.mesh.material) ? dt.mesh.material : [dt.mesh.material]).map(m => ({ opacity: m.opacity, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), transparent: m.transparent })); }
        if (M.boneMorphs && Object.keys(M.boneMorphs).length) boneMorphs = M.boneMorphs;
        if (M.uvMorphs && Object.keys(M.uvMorphs).length) { uvMorphs = M.uvMorphs; const uv = dt.mesh.geometry.getAttribute('uv'); if (uv) baseUVs = new Float32Array(uv.array); }
        if (M.groupMorphSubs && Object.keys(M.groupMorphSubs).length) groupMorphSubs = M.groupMorphSubs;
      }
    }
    const en = { id, name, group: grp, bones: dt.bones, boneHelpers: hg, source: { fileName }, boundingSize: diag, fileData: buf, clips: dt.clips, mmdMesh: dt.mesh, restPose: rest,
      initialPosition: grp.position.clone(), activeClipIndex: 0, animPlaying: false, animTime: 0, animDuration: dt.clips[0] ? dt.clips[0].clip.duration : 0, animSpeed: 1,
      mmdHelper: null, helperMode: 'none', vrm: dt.vrm, lookAtValues: { lookUp: 0, lookDown: 0, lookLeft: 0, lookRight: 0 },
      materialMorphs, baseMaterialStates, boneMorphs, uvMorphs, groupMorphSubs, baseUVs };
    this.models.set(id, en);
    this.buildBoneHelpersForModel(en); this.updatePhysicsBoneVisibility(en); this.updateSpringBoneMatrixAutoUpdate(en); this.updateShadowCamera();
    if (en.mmdMesh) for (const m of Array.isArray(en.mmdMesh.material) ? en.mmdMesh.material : [en.mmdMesh.material]) if (m.opacity === 0) m.visible = false;
    if (en.vrm && this._physicsEnabled) this.updateLoop();
    else if (dt.mesh && this._physicsEnabled) { await this.registerForPhysics(en); this.updateLoop(); }
    else if (dt.mesh && dt.clips.length > 0) this.ensureModelHelper(en).catch(e => m3dWarn('물리 엔진(ammo) 미리 불러오기 실패', e));
    if (this.models.size === 1 || this._selectedModelId === null) this._selectedModelId = id;
    if (this.models.size === 1) this._viewportController.fitToBox(new THREE.Box3().setFromObject(grp));
    this._viewportController.transformControls.setSize(Math.max(0.01, Math.min(1, diag / 2)));
    return id;
  }
  removeModel(id) {
    const m = this.models.get(id); if (!m) return;
    if (m.animMixer) { m.animMixer.stopAllAction(); m.animMixer = undefined; }
    this.unregisterFromHelper(m, false); this.scene.remove(m.group); this.allBoneHelpers.remove(m.boneHelpers);
    m.group.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => x.dispose()); } });
    m.boneHelpers.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { o.geometry.dispose(); o.material.dispose(); } });
    this.models.delete(id); this.updateLoop();
    if (this._selectedModelId === id) { const ks = [...this.models.keys()]; this._selectedModelId = ks.length ? ks[0] : null; }
  }
  getModels() { return [...this.models.values()].map(m => ({ id: m.id, name: m.name, source: m.source })); }
  getEntry(id) { const k = id ?? this._selectedModelId; return k ? this.models.get(k) ?? null : null; }
  getModelGroup(id) { const m = this.getEntry(id); return m ? m.group : new THREE.Group(); }
  getBones(id) { const m = this.getEntry(id); return m ? m.bones : new Map(); }
  getBoneHelpersGroup() { return this.allBoneHelpers; }
  buildBoneHelpersForModel(m) {
    while (m.boneHelpers.children.length) m.boneHelpers.remove(m.boneHelpers.children[0]);
    if (!this.showBoneHelpers) return;
    let sum = 0, n = 0;
    for (const [, b] of m.bones) if (b.parent && b.parent instanceof THREE.Bone) { const a = new THREE.Vector3(), p = new THREE.Vector3(); b.getWorldPosition(a); b.parent.getWorldPosition(p); sum += a.distanceTo(p); n++; }
    const geo = new THREE.SphereGeometry(Math.max(0.001, 0.08 * (n > 0 ? sum / n : 0.05 * m.boundingSize)), 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5, depthTest: false });
    const lmat = new THREE.LineBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5, depthTest: false });
    for (const [name, b] of m.bones) {
      const s = new THREE.Mesh(geo, mat.clone()); s.name = `helper_${m.id}_${name}`; s.userData.modelId = m.id; s.userData.boneName = name; s.renderOrder = 999; m.boneHelpers.add(s);
      if (b.parent && b.parent instanceof THREE.Bone) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const l = new THREE.Line(g, lmat.clone()); l.name = `line_${m.id}_${name}`; l.userData.modelId = m.id; l.userData.boneName = name; l.renderOrder = 998; m.boneHelpers.add(l);
      }
    }
  }
  updateBoneHelperPositions() {
    for (const m of this.models.values()) for (const h of m.boneHelpers.children) {
      const name = h.userData.boneName; if (!name) continue;
      const b = m.bones.get(name); if (!b) continue;
      if (h instanceof THREE.Mesh) { const p = new THREE.Vector3(); b.getWorldPosition(p); h.position.copy(p); }
      else if (h instanceof THREE.Line) {
        const a = h.geometry.getAttribute('position'), p = new THREE.Vector3(); b.getWorldPosition(p); a.setXYZ(0, p.x, p.y, p.z);
        if (b.parent && b.parent instanceof THREE.Bone) { const q = new THREE.Vector3(); b.parent.getWorldPosition(q); a.setXYZ(1, q.x, q.y, q.z); } else a.setXYZ(1, p.x, p.y, p.z);
        a.needsUpdate = true;
      }
    }
  }
  render() {
    this.updateBoneHelperPositions();
    if (this.viewportActive) return;
    const cam = this._viewportController.camera, ar = this.width / this.height;
    if (cam instanceof THREE.PerspectiveCamera) cam.aspect = ar; else { const h = (cam.top - cam.bottom) / 2; cam.left = -h * ar; cam.right = h * ar; }
    cam.updateProjectionMatrix(); this.allBoneHelpers.visible = false;
    const gz = this._viewportController.transformControls.getHelper(), was = gz.visible; gz.visible = false;
    this.renderer.render(this.scene, cam); this._outputCtx.clearRect(0, 0, this.width, this.height); this._outputCtx.drawImage(this.renderer.domElement, 0, 0);
    gz.visible = was; this.allBoneHelpers.visible = this.showBoneHelpers;
  }
  getDomElement() { return this.renderer.domElement; }
  startViewport(w, h) { this.viewportActive = true; this._viewportController.addBeforeRender(this.boundTickAnimation); this.stopAnimationLoop(); this._viewportController.start(w, h); }
  stopViewport() {
    this._viewportController.removeBeforeRender(this.boundTickAnimation); this._viewportController.stop(); this.viewportActive = false;
    this.renderer.setPixelRatio(1); this.renderer.setSize(this.width, this.height); this.updateLoop();
  }
  renderToOutput() { this.updateBoneHelperPositions(); this._viewportController.renderToOutput(); }
  getScene() { return this.scene; }
  getPoseSnapshot(id) {
    const m = this.getEntry(id);
    if (!m) return { boneRotations: [], modelPosition: [0, 0, 0], modelRotation: [0, 0, 0, 1], modelScale: [1, 1, 1] };
    const r = []; for (const [n, b] of m.bones) r.push({ boneName: n, quaternion: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] });
    const g = m.group; return { boneRotations: r, modelPosition: [g.position.x, g.position.y, g.position.z], modelRotation: [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w], modelScale: [g.scale.x, g.scale.y, g.scale.z] };
  }
  applyPoseSnapshot(s, id) {
    const m = this.getEntry(id); if (!m) return;
    for (const r of s.boneRotations) { const b = m.bones.get(r.boneName); if (b) b.quaternion.set(r.quaternion[0], r.quaternion[1], r.quaternion[2], r.quaternion[3]); }
    m.group.position.set(s.modelPosition[0], s.modelPosition[1], s.modelPosition[2]); m.group.quaternion.set(s.modelRotation[0], s.modelRotation[1], s.modelRotation[2], s.modelRotation[3]); m.group.scale.set(s.modelScale[0], s.modelScale[1], s.modelScale[2]);
  }
  resetPose(id) {
    const m = this.getEntry(id); if (!m) return;
    for (const [, b] of m.bones) b.quaternion.identity();
    m.group.position.set(0, 0, 0); m.group.quaternion.identity(); m.group.scale.set(1, 1, 1);
  }
  resize(w, h) {
    this.width = w; this.height = h; this._outputCanvas.width = w; this._outputCanvas.height = h;
    this._viewportController.setOutputTarget(this._outputCtx, w, h, () => {});
    if (!this.viewportActive) this.renderer.setSize(w, h);
  }
  dispose() {
    for (const m of this.models.values()) { m.animPlaying = false; if (m.animMixer) { m.animMixer.stopAllAction(); m.animMixer = undefined; } this.unregisterFromHelper(m, false); }
    this.stopAnimationLoop(); this._viewportController.removeBeforeRender(this.boundTickAnimation); this._viewportController.dispose(); this.renderer.dispose();
    this.scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => x.dispose()); } });
    try { this.renderer.forceContextLoss(); } catch (e) { m3dWarn('WebGL 문맥 놓기', e); }   // 그림판을 여러 번 열어도 WebGL 문맥이 쌓이지 않게 (브라우저 한도 16개)
  }
  async ensureModelHelper(m) {
    if (m.mmdHelper) return m.mmdHelper;
    await loadAmmo();
    m.mmdHelper = quietR172(() => new MMDAnimationHelper({ sync: true, afterglow: 0, resetPhysicsOnLoop: true }));
    return m.mmdHelper;
  }
  async registerForPhysics(m) {
    if (!m.mmdMesh || m.helperMode !== 'none') return;
    const h = await this.ensureModelHelper(m); quietR172(() => h.add(m.mmdMesh, { physics: true, warmup: 60 })); m.helperMode = 'physics';
  }
  async registerForAnimation(m) {
    if (!m.mmdMesh) return;
    this.unregisterFromHelper(m, false);
    const h = await this.ensureModelHelper(m), c = m.clips[m.activeClipIndex] && m.clips[m.activeClipIndex].clip;
    if (c) { quietR172(() => h.add(m.mmdMesh, { animation: c, physics: this._physicsEnabled, warmup: 60 })); m.helperMode = 'animation'; }
  }
  unregisterFromHelper(m, restore) {
    if (m.helperMode === 'none' || !m.mmdHelper || !m.mmdMesh) return;
    try { m.mmdHelper.remove(m.mmdMesh); } catch (e) { m3dWarn('MMD 도우미에서 빼기', e); }
    if (restore) this.restoreRestPose(m);
    m.helperMode = 'none';
  }
  tickAnimation(dt) {
    for (const m of this.models.values()) {
      const s = Math.min(dt, 1 / 30);
      if (m.vrm || !m.mmdMesh) {
        if (m.animPlaying && m.animMixer) { m.animMixer.update(s * m.animSpeed); m.animTime += s * m.animSpeed; if (m.animDuration > 0 && m.animTime >= m.animDuration) m.animTime %= m.animDuration; }
        if (m.vrm && (this._physicsEnabled || m.animPlaying)) { if (m.vrm.nodeConstraintManager) m.vrm.nodeConstraintManager.update(); if (m.vrm.springBoneManager) m.vrm.springBoneManager.update(s); }
        continue;
      }
      if (!m.mmdHelper) continue;
      if (m.animPlaying && m.helperMode === 'animation') { const k = s * m.animSpeed; m.mmdHelper.update(k); m.animTime += k; if (m.animDuration > 0 && m.animTime >= m.animDuration) m.animTime %= m.animDuration; this.applyRuntimeMorphs(m); }
      else if (m.helperMode === 'physics') m.mmdHelper.update(s);
    }
    this.updateBoneHelperPositions();
  }
  needsSimulationLoop() {
    if (!this._layerActive) return false;
    for (const m of this.models.values()) if (m.animPlaying || m.helperMode === 'physics' || (m.vrm && this._physicsEnabled)) return true;
    return false;
  }
  setLayerActive(on) { this._layerActive = on; this.updateLoop(); }
  updateLoop() { if (this.viewportActive) return; if (this.needsSimulationLoop()) this.startAnimationLoop(); else this.stopAnimationLoop(); }
  startAnimationLoop() {
    if (this.animationFrameId !== null) return;
    this.animationLastTime = performance.now();
    const f = () => { this.animationFrameId = requestAnimationFrame(f); const now = performance.now(), dt = (now - this.animationLastTime) / 1e3; this.animationLastTime = now; this.tickAnimation(dt); this.render(); if (this._onAnimationFrame) this._onAnimationFrame(); };
    this.animationFrameId = requestAnimationFrame(f);
  }
  stopAnimationLoop() { if (this.animationFrameId !== null) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; } }
  async playAnimation(id) {
    const m = this.getEntry(id); if (!m || !m.clips.length) return;
    if (m.vrm || !m.mmdMesh) {
      const root = m.vrm ? m.vrm.scene : m.group; if (!m.animMixer) m.animMixer = new THREE.AnimationMixer(root);
      const c = m.clips[m.activeClipIndex] && m.clips[m.activeClipIndex].clip; if (c) { m.animMixer.stopAllAction(); m.animMixer.clipAction(c).play(); }
      m.animPlaying = true; this.updateLoop(); return;
    }
    if (m.helperMode !== 'animation') await this.registerForAnimation(m);
    m.animPlaying = true; this.updateLoop();
  }
  pauseAnimation(id) { const m = this.getEntry(id); if (m) { m.animPlaying = false; this.updateLoop(); } }
  stopAnimation(id) {
    const m = this.getEntry(id); if (!m) return;
    m.animPlaying = false; m.animTime = 0;
    if (m.vrm || !m.mmdMesh) { if (m.animMixer) { m.animMixer.stopAllAction(); m.animMixer = undefined; } this.restoreRestPose(m); this.updateLoop(); return; }
    this.unregisterFromHelper(m, true);
    if (this._physicsEnabled && m.mmdMesh && m.mmdHelper) this.registerForPhysics(m).catch(e => m3dWarn('물리 다시 켜기', e));
    this.updateLoop();
  }
  restoreRestPose(m) {
    for (const [n, r] of m.restPose) { const b = m.bones.get(n); if (b) { b.position.copy(r.position); b.quaternion.copy(r.quaternion); b.scale.copy(r.scale); } }
    if (m.mmdMesh && m.mmdMesh.morphTargetInfluences) for (let i = 0; i < m.mmdMesh.morphTargetInfluences.length; i++) m.mmdMesh.morphTargetInfluences[i] = 0;
    if (m.materialMorphs) this.applyMaterialMorphs(m); if (m.uvMorphs) this.applyUVMorphs(m);
    this.notify();
  }
  isAnimationPlaying(id) { const m = this.getEntry(id); return m ? m.animPlaying : false; }
  getAnimationTime(id) { const m = this.getEntry(id); return m ? m.animTime : 0; }
  getAnimationDuration(id) { const m = this.getEntry(id); return m ? m.animDuration : 0; }
  setAnimationSpeed(v, id) { const m = this.getEntry(id); if (m) m.animSpeed = v; }
  getAnimationSpeed(id) { const m = this.getEntry(id); return m ? m.animSpeed : 1; }
  hasAnimation(id) { const m = this.getEntry(id); return (m ? m.clips.length : 0) > 0; }
  setOnAnimationFrame(f) { this._onAnimationFrame = f; }
  getAnimations(id) { const m = this.getEntry(id); return m ? m.clips.map((c, i) => ({ name: c.name, index: i })) : []; }
  getActiveAnimationIndex(id) { const m = this.getEntry(id); return m ? m.activeClipIndex : 0; }
  setActiveAnimation(i, id) {
    const m = this.getEntry(id); if (!m || i < 0 || i >= m.clips.length) return;
    const was = m.animPlaying; this.stopAnimation(m.id); m.activeClipIndex = i; m.animDuration = m.clips[i] ? m.clips[i].clip.duration : 0;
    if (was) this.playAnimation(m.id).catch(e => m3dWarn('동작 다시 틀기', e));
  }
  resetModelPosition(id) {
    const m = this.getEntry(id); if (!m) return;
    if (m.animPlaying) { m.animPlaying = false; m.animTime = 0; if (m.animMixer) { m.animMixer.stopAllAction(); m.animMixer = undefined; } }
    this.unregisterFromHelper(m, false); this.restoreRestPose(m);
    m.group.position.copy(m.initialPosition); m.group.quaternion.identity(); m.group.scale.set(1, 1, 1);
    if (this._physicsEnabled && m.mmdMesh && m.mmdHelper) this.registerForPhysics(m).catch(e => m3dWarn('물리 다시 켜기', e));
    this.updateLoop();
  }
  setShowBoneHelpers(on) {
    this.showBoneHelpers = on; this.allBoneHelpers.visible = on;
    if (on) for (const m of this.models.values()) { this.buildBoneHelpersForModel(m); this.updatePhysicsBoneVisibility(m); }
  }
  highlightBone(id, name) {
    for (const m of this.models.values()) for (const h of m.boneHelpers.children) if (h instanceof THREE.Mesh && h.userData.boneName) {
      const mat = h.material;
      if (h.userData.modelId === id && h.userData.boneName === name) { mat.color.setHex(0xff4400); mat.opacity = 0.9; } else { mat.color.setHex(0x00aaff); mat.opacity = 0.7; }
    }
  }
  selectBone(id, name) {
    this._selectedBoneModelId = id; this._selectedBoneName = name; this.selectedModelId = id; this.highlightBone(id, name);
    const b = this.getBones(id).get(name); if (b) this._viewportController.attachToObject(b, this._viewportController.getTransformMode());
    this.notify();
  }
  deselectBone() { this._selectedBoneModelId = null; this._selectedBoneName = null; this.highlightBone(null, null); this._viewportController.detach(); this.notify(); }
  getSelectedBoneName() { return this._selectedBoneName; }
  getSelectedBoneModelId() { return this._selectedBoneModelId; }
  subscribe(f) { this._listeners.add(f); return () => this._listeners.delete(f); }
  notify() { for (const f of this._listeners) f(); }
  getPhysicsBoneNamesForModel(id) { const m = this.getEntry(id); return m ? this.getPhysicsBoneNames(m) : new Set(); }
  getExpressions(id) {
    const m = this.getEntry(id); if (!m || !m.vrm || !m.vrm.expressionManager) return [];
    const em = m.vrm.expressionManager, out = [];
    for (const n of em.expressions.map(e => e.expressionName)) out.push({ name: n, value: LOOK_AT_EXPRESSIONS.has(n) ? (m.lookAtValues[n] ?? 0) : (em.getValue(n) ?? 0) });
    return out;
  }
  setExpressionValue(name, v, id) {
    const m = this.getEntry(id); if (!m || !m.vrm || !m.vrm.expressionManager) return;
    if (LOOK_AT_EXPRESSIONS.has(name)) { m.lookAtValues[name] = v; this.applyLookAt(m); return; }
    m.vrm.expressionManager.setValue(name, v); m.vrm.expressionManager.update();
  }
  applyLookAt(m) {
    const ap = m.vrm && m.vrm.lookAt && m.vrm.lookAt.applier; if (!ap) return;
    const l = m.lookAtValues; ap.applyYawPitch((l.lookLeft - l.lookRight) * 90, (l.lookDown - l.lookUp) * 90);
  }
  getMorphMeshes(m) {
    if (m.mmdMesh && m.mmdMesh.morphTargetDictionary) return [m.mmdMesh];
    const out = []; m.group.traverse(o => { if (o instanceof THREE.Mesh && o.morphTargetDictionary) out.push(o); }); return out;
  }
  getMorphTargets(id) {
    const m = this.getEntry(id); if (!m) return [];
    const ms = this.getMorphMeshes(m); if (!ms.length) return [];
    const map = new Map();
    for (const o of ms) { const inf = o.morphTargetInfluences ?? []; for (const [n, i] of Object.entries(o.morphTargetDictionary)) { const v = inf[i] ?? 0, a = map.get(n); if (a === undefined || v > a) map.set(n, v); } }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }
  setMorphTargetValue(name, v, id) {
    const m = this.getEntry(id); if (!m) return;
    for (const o of this.getMorphMeshes(m)) { const i = o.morphTargetDictionary[name]; if (i !== undefined && o.morphTargetInfluences) o.morphTargetInfluences[i] = v; }
    let mat = !!(m.materialMorphs && m.materialMorphs[name]), bone = !!(m.boneMorphs && m.boneMorphs[name]), uv = !!(m.uvMorphs && m.uvMorphs[name]);
    if (m.groupMorphSubs && m.groupMorphSubs[name]) for (const s of m.groupMorphSubs[name]) { if (s.type === 8) mat = true; else if (s.type === 2) bone = true; else if (s.type >= 3 && s.type <= 7) uv = true; }
    if (mat) this.applyMaterialMorphs(m); if (bone) this.applyBoneMorphs(m); if (uv) this.applyUVMorphs(m);
  }
  hasMorphTargets(id) { const m = this.getEntry(id); return !!m && this.getMorphMeshes(m).length > 0; }
  /* 동작을 트는 동안 매 프레임 (NAI applyRuntimeMorphs). NAI 는 여기서도 뼈 모프가 걸린 뼈를 처음 자세로 되돌려 그 뼈의 동작이 멈춘다.
     MMD 도우미가 매 프레임 동작 자세로 뼈를 되돌려 놓으므로(_restoreBones → 섞기 → _saveBones) 그 위에 뼈 모프만 더한다. */
  applyRuntimeMorphs(m) { if (m.materialMorphs) this.applyMaterialMorphs(m); if (m.boneMorphs) this.applyBoneMorphs(m, true); if (m.uvMorphs) this.applyUVMorphs(m); }
  getMorphWeight(m, name) { const d = (m.mmdMesh && m.mmdMesh.morphTargetDictionary) || {}, inf = (m.mmdMesh && m.mmdMesh.morphTargetInfluences) || [], i = d[name]; return i !== undefined ? inf[i] ?? 0 : 0; }
  applyMaterialMorphElement(e, w, mats, base) {
    const a = e.index === -1 ? 0 : e.index, b = e.index === -1 ? mats.length : e.index + 1;
    for (let o = a; o < b && o < mats.length; o++) {
      const n = mats[o]; if (!base[o]) continue;
      if (e.type === 1) {   // 더하기
        n.opacity = Math.max(0, Math.min(1, n.opacity + e.diffuse[3] * w));
        if (n.color) { n.color.r = Math.max(0, Math.min(1, n.color.r + e.diffuse[0] * w)); n.color.g = Math.max(0, Math.min(1, n.color.g + e.diffuse[1] * w)); n.color.b = Math.max(0, Math.min(1, n.color.b + e.diffuse[2] * w)); }
      } else {               // 곱하기
        n.opacity *= 1 + (e.diffuse[3] - 1) * w; n.opacity = Math.max(0, Math.min(1, n.opacity));
        if (n.color) { n.color.r *= 1 + (e.diffuse[0] - 1) * w; n.color.g *= 1 + (e.diffuse[1] - 1) * w; n.color.b *= 1 + (e.diffuse[2] - 1) * w; }
      }
      n.needsUpdate = true;
    }
  }
  applyMaterialMorphs(m) {
    if (!m.mmdMesh || !m.materialMorphs || !m.baseMaterialStates) return;
    const mats = Array.isArray(m.mmdMesh.material) ? m.mmdMesh.material : [m.mmdMesh.material], base = m.baseMaterialStates;
    for (let i = 0; i < mats.length && i < base.length; i++) { mats[i].opacity = base[i].opacity; if (mats[i].color) mats[i].color.copy(base[i].color); }
    for (const [n, els] of Object.entries(m.materialMorphs)) { const w = this.getMorphWeight(m, n); if (w !== 0) for (const e of els) this.applyMaterialMorphElement(e, w, mats, base); }
    if (m.groupMorphSubs) for (const [n, subs] of Object.entries(m.groupMorphSubs)) {
      const w = this.getMorphWeight(m, n); if (w === 0) continue;
      for (const s of subs) { if (s.type !== 8 || !m.materialMorphs[s.name]) continue; const k = w * s.ratio; for (const e of m.materialMorphs[s.name]) this.applyMaterialMorphElement(e, k, mats, base); }
    }
    for (const x of mats) x.visible = x.opacity > 0;
  }
  applyBoneMorphs(m, onAnimatedPose) {
    if (!m.mmdMesh || !m.boneMorphs) return;
    const M = m.mmdMesh.geometry.userData && m.mmdMesh.geometry.userData.MMD; if (!M || !M.bones) return;
    const bones = M.bones; if (!onAnimatedPose) this.restoreBoneRestPose(m);
    for (const [n, els] of Object.entries(m.boneMorphs)) { const w = this.getMorphWeight(m, n); if (w !== 0) this.applyBoneMorphElements(m, els, w, bones); }
    if (m.groupMorphSubs) for (const [n, subs] of Object.entries(m.groupMorphSubs)) {
      const w = this.getMorphWeight(m, n); if (w === 0) continue;
      for (const s of subs) if (s.type === 2 && m.boneMorphs[s.name]) this.applyBoneMorphElements(m, m.boneMorphs[s.name], w * s.ratio, bones);
    }
  }
  restoreBoneRestPose(m) {
    if (!m.boneMorphs) return;
    const M = m.mmdMesh && m.mmdMesh.geometry.userData && m.mmdMesh.geometry.userData.MMD; if (!M || !M.bones) return;
    const bones = M.bones, idx = new Set();
    for (const els of Object.values(m.boneMorphs)) for (const e of els) idx.add(e.index);
    if (m.groupMorphSubs) for (const subs of Object.values(m.groupMorphSubs)) for (const s of subs) if (s.type === 2 && m.boneMorphs[s.name]) for (const e of m.boneMorphs[s.name]) idx.add(e.index);
    for (const i of idx) { if (i < 0 || i >= bones.length) continue; const n = bones[i].name, r = m.restPose.get(n), b = m.bones.get(n); if (r && b) { b.position.copy(r.position); b.quaternion.copy(r.quaternion); } }
  }
  applyBoneMorphElements(m, els, w, bones) {
    const q = new THREE.Quaternion(), id = new THREE.Quaternion();
    for (const e of els) {
      if (e.index < 0 || e.index >= bones.length) continue;
      const b = m.bones.get(bones[e.index].name); if (!b) continue;
      b.position.x += e.position[0] * w; b.position.y += e.position[1] * w; b.position.z += e.position[2] * w;
      q.set(e.rotation[0], e.rotation[1], e.rotation[2], e.rotation[3]); q.slerp(id, 1 - w); b.quaternion.multiply(q);
    }
  }
  applyUVMorphs(m) {
    if (!m.mmdMesh || !m.uvMorphs || !m.baseUVs) return;
    const at = m.mmdMesh.geometry.getAttribute('uv'); if (!at) return;
    const arr = at.array; arr.set(m.baseUVs);
    for (const [n, u] of Object.entries(m.uvMorphs)) { if (u.channel !== 0) continue; const w = this.getMorphWeight(m, n); if (w !== 0) this.applyUVMorphElements(arr, u.elements, w); }
    if (m.groupMorphSubs) for (const [n, subs] of Object.entries(m.groupMorphSubs)) {
      const w = this.getMorphWeight(m, n); if (w === 0) continue;
      for (const s of subs) { if (s.type < 3 || s.type > 7) continue; const u = m.uvMorphs[s.name]; if (u && u.channel === 0) this.applyUVMorphElements(arr, u.elements, w * s.ratio); }
    }
    at.needsUpdate = true;
  }
  applyUVMorphElements(arr, els, w) { for (const e of els) { const i = e.index; arr[2 * i] += e.uv[0] * w; arr[2 * i + 1] += e.uv[1] * w; } }
  getShadowsEnabled() { return this._shadowsEnabled; }
  setShadowsEnabled(on) { this._shadowsEnabled = on; this.renderer.shadowMap.enabled = on; this.directionalLight.castShadow = on; this.renderer.shadowMap.needsUpdate = true; }
  getShadowQuality() { return this._shadowQuality; }
  setShadowQuality(q) {
    this._shadowQuality = q; const s = SHADOW_QUALITY_MAP[q], sh = this.directionalLight.shadow;
    sh.mapSize.width = s; sh.mapSize.height = s; if (sh.map) { sh.map.dispose(); sh.map = null; } this.renderer.shadowMap.needsUpdate = true;
  }
  getPhysicsEnabled() { return this._physicsEnabled; }
  setPhysicsEnabled(on) {
    this._physicsEnabled = on;
    for (const m of this.models.values()) if (m.animPlaying) { m.animPlaying = false; m.animTime = 0; if (m.animMixer) { m.animMixer.stopAllAction(); m.animMixer = undefined; } if (m.mmdMesh) this.unregisterFromHelper(m, true); else this.restoreRestPose(m); }
    for (const m of this.models.values()) if (!m.vrm && m.mmdMesh) {
      if (on && m.helperMode === 'none') this.registerForPhysics(m).then(() => this.updateLoop()).catch(e => m3dWarn('물리 켜기', e));
      else if (!on && m.helperMode === 'physics') this.unregisterFromHelper(m, false);
    }
    for (const m of this.models.values()) { this.updatePhysicsBoneVisibility(m); this.updateSpringBoneMatrixAutoUpdate(m); }
    this.updateLoop(); this.notify();
  }
  getShowBoneHelpers() { return this.showBoneHelpers; }
  getPhysicsBoneNames(m) {
    const out = new Set();
    if (m.vrm && m.vrm.springBoneManager) { for (const j of m.vrm.springBoneManager.joints) { const b = j.bone; if (b && b.name) out.add(b.name); } return out; }
    if (!m.mmdMesh) return out;
    const M = m.mmdMesh.geometry.userData && m.mmdMesh.geometry.userData.MMD; if (!M || !M.bones) return out;
    for (const b of M.bones) if (b.rigidBodyType === 1 || b.rigidBodyType === 2) out.add(b.name);
    return out;
  }
  updatePhysicsBoneVisibility(m) { const ph = this._physicsEnabled ? this.getPhysicsBoneNames(m) : new Set(); for (const h of m.boneHelpers.children) { const n = h.userData.boneName; if (n) h.visible = !ph.has(n); } }
  updateSpringBoneMatrixAutoUpdate(m) { if (!m.vrm || !m.vrm.springBoneManager) return; const on = !this._physicsEnabled; for (const j of m.vrm.springBoneManager.joints) j.bone.matrixAutoUpdate = on; }
  updateShadowCamera() {
    const box = new THREE.Box3(); for (const m of this.models.values()) box.expandByObject(m.group);
    if (box.isEmpty()) return;
    const s = new THREE.Vector3(); box.getSize(s); const c = new THREE.Vector3(); box.getCenter(c);
    const r = Math.max(s.x, s.y, s.z), cam = this.directionalLight.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 0.1; cam.far = 4 * r; cam.updateProjectionMatrix();
    const dir = this.directionalLight.position.clone().normalize();
    this.directionalLight.target.position.copy(c); this.directionalLight.target.updateMatrixWorld(); this.directionalLight.position.copy(c).add(dir.multiplyScalar(2 * r));
  }
  getProjection() { return this._viewportController.projectionType; }
  setProjection(p) { this._viewportController.setProjection(p); }
  getFov() { return this._viewportController.perspCamera.fov; }
  setFov(v) { this._viewportController.perspCamera.fov = v; this._viewportController.perspCamera.updateProjectionMatrix(); }
  getAmbientIntensity() { return this.ambientLight.intensity; }
  setAmbientIntensity(v) { this.ambientLight.intensity = v; }
  getDirectionalIntensity() { return this.directionalLight.intensity; }
  setDirectionalIntensity(v) { this.directionalLight.intensity = v; this.backLight.intensity = 0.375 * v; }
  getLightDirection() { const p = this.directionalLight.position; return { x: p.x, y: p.y, z: p.z }; }
  setLightDirection(x, y, z) { this.directionalLight.position.set(x, y, z); this.backLight.position.set(-x, -y, -z); this.updateShadowCamera(); }
  getSerializableState() {
    const cam = this._viewportController.camera, t = this._viewportController.orbitControls.target;
    return {
      models: [...this.models.values()].map(m => ({ name: m.name, fileName: m.source.fileName || m.name, fileData: m.fileData, poseSnapshot: this.getPoseSnapshot(m.id) })),
      selectedModelId: this._selectedModelId,
      renderSettings: { projection: this.getProjection(), fov: this.getFov(), ambientIntensity: this.getAmbientIntensity(), directionalIntensity: this.getDirectionalIntensity(), lightDirection: this.getLightDirection(),
        shadowsEnabled: this._shadowsEnabled, shadowQuality: this._shadowQuality, physicsEnabled: this._physicsEnabled, showBoneHelpers: this.showBoneHelpers },
      cameraState: { position: [cam.position.x, cam.position.y, cam.position.z], target: [t.x, t.y, t.z] },
    };
  }
  restoreRenderSettings(rs, cs) {
    this.setFov(rs.fov); this.setProjection(rs.projection); this.setAmbientIntensity(rs.ambientIntensity); this.setDirectionalIntensity(rs.directionalIntensity);
    this.setLightDirection(rs.lightDirection.x, rs.lightDirection.y, rs.lightDirection.z);
    if (rs.shadowsEnabled !== undefined) this.setShadowsEnabled(rs.shadowsEnabled); if (rs.shadowQuality !== undefined) this.setShadowQuality(rs.shadowQuality);
    if (rs.physicsEnabled !== undefined) this.setPhysicsEnabled(rs.physicsEnabled); if (rs.showBoneHelpers !== undefined) this.setShowBoneHelpers(rs.showBoneHelpers);
    this._viewportController.camera.position.set(cs.position[0], cs.position[1], cs.position[2]); this._viewportController.orbitControls.target.set(cs.target[0], cs.target[1], cs.target[2]); this._viewportController.orbitControls.update();
  }
  findModelIdForObject(o) { for (let t = o; t; t = t.parent) if (t.userData.modelId) return t.userData.modelId; return null; }
  getModelGroups() { return [...this.models.values()].map(m => m.group); }
}
/* NAI wH: 레이어마다 관리자를 만든다 */
export async function createModel3DManager(w, h) { return new Model3DManager(w, h); }

/* ═══ 도구 (NAI gt «Pose» · gi «Model Transform») — 그림판이 activate(관리자, 고리)·deactivate() 를 부른다
   고리: saved() = 놓았을 때(NAI onVersionChange → saveState + 레이어 작은 그림), switchTool(이름, 다음 할 일) ═══ */
function clickRay(mgr, e) {
  const el = mgr.getDomElement(), r = el.getBoundingClientRect(), p = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(2 * ((e.clientY - r.top) / r.height)) + 1), ray = new THREE.Raycaster();
  ray.setFromCamera(p, mgr.viewportController.camera); return ray;
}
function helperHits(mgr, ray) { const s = []; mgr.getBoneHelpersGroup().traverse(o => { if (o instanceof THREE.Mesh && o.userData.boneName && o.visible) s.push(o); }); return ray.intersectObjects(s, false); }
class ClickTool {
  activate(mgr, hooks) {
    this.mgr = mgr; this.hooks = hooks || {}; this.start = null;
    const el = mgr.getDomElement();
    this.down = e => { this.start = { x: e.clientX, y: e.clientY }; };
    this.up = e => { if (!this.start || !this.mgr) return; const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y; this.start = null; if (Math.sqrt(dx * dx + dy * dy) < 5) this.handleClick(e); };
    el.addEventListener('pointerdown', this.down); el.addEventListener('pointerup', this.up);
    this.drag = e => { if (!e.value && this.mgr) this.dragEnd(); };
    mgr.viewportController.transformControls.addEventListener('dragging-changed', this.drag);
  }
  deactivate() {
    if (this.mgr) {
      const el = this.mgr.getDomElement();
      el.removeEventListener('pointerdown', this.down); el.removeEventListener('pointerup', this.up);
      this.mgr.viewportController.transformControls.removeEventListener('dragging-changed', this.drag);
      this.leave();
    }
    this.mgr = null; this.hooks = null; this.start = null;
  }
}
export class PoseTool extends ClickTool {
  get name() { return 'pose'; }
  activate(mgr, hooks) { super.activate(mgr, hooks); mgr.deselectBone(); }
  leave() { this.mgr.deselectBone(); }
  dragEnd() { if (!this.mgr.getSelectedBoneName()) return; this.mgr.updateBoneHelperPositions(); this.mgr.renderToOutput(); if (this.hooks.saved) this.hooks.saved(); }
  handleClick(e) {
    const m = this.mgr, ray = clickRay(m, e), hh = helperHits(m, ray);
    if (hh.length) { const o = hh[0].object, id = o.userData.modelId, n = o.userData.boneName; if (id && n) { m.selectBone(id, n); return; } }
    const g = ray.intersectObjects(m.getModelGroups(), true);
    if (g.length) { const id = m.findModelIdForObject(g[0].object); if (id) { m.selectedModelId = id; if (this.hooks.switchTool) this.hooks.switchTool('modelTransform'); return; } }
    m.deselectBone();
  }
}
export class ModelTransformTool extends ClickTool {
  get name() { return 'modelTransform'; }
  activate(mgr, hooks) { super.activate(mgr, hooks); const id = mgr.selectedModelId; if (id) this.attachToModel(id); }
  leave() { this.mgr.viewportController.detach(); }
  dragEnd() { this.mgr.renderToOutput(); if (this.hooks.saved) this.hooks.saved(); }
  handleClick(e) {
    const m = this.mgr, ray = clickRay(m, e), hh = helperHits(m, ray);
    if (hh.length) { const o = hh[0].object, id = o.userData.modelId, n = o.userData.boneName; if (id && n) { if (this.hooks.switchTool) this.hooks.switchTool('pose', () => m.selectBone(id, n)); return; } }
    const g = ray.intersectObjects(m.getModelGroups(), true);
    if (g.length) { const id = m.findModelIdForObject(g[0].object); if (id) { m.selectedModelId = id; this.attachToModel(id); return; } }
    m.viewportController.detach();
  }
  attachToModel(id) { const vc = this.mgr.viewportController; vc.attachToObject(this.mgr.getModelGroup(id), vc.getTransformMode()); }
}
export function makeTool(name) { return name === 'pose' ? new PoseTool() : new ModelTransformTool(); }
/* 시험용: 라이브러리 묶음 (그림판은 쓰지 않는다) */
export const __lib = { THREE, MMDParser, jszip, loadAmmo, mmdMorphExtras };
