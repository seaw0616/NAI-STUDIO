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
 * NAIS3 (https://github.com/sunanakgo/NAIS3, GPL-3.0) 의 규격·구현을 참고했습니다.
 * 그 밖의 서드파티 고지는 NOTICE.txt 를 참고하십시오.
 */
/* ═══════════════════════════ NAI Studio v4 — core ═══════════════════════════ */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ─────────────── 모델 정의 (퀄리티 태그 / UC 프리셋: docs.novelai.net 원문 · ucPreset id는 NAI 정수값) ─────────────── */
const UC = {
  v45full: [
    { id: 0, name: 'Heavy', text: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page' },
    { id: 1, name: 'Light', text: 'lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page' },
    { id: 3, name: 'Human Focus', text: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy' },
    { id: 2, name: 'Furry Focus', text: '{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic' },
    { id: 4, name: '없음', text: '' },
  ],
  v45cur: [
    { id: 0, name: 'Heavy', text: 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, negative space, blank page' },
    { id: 1, name: 'Light', text: 'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page' },
    { id: 3, name: 'Human Focus', text: 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, mismatched pupils, glowing eyes, negative space, blank page' },
    { id: 4, name: '없음', text: '' },
  ],
  v4full: [
    { id: 0, name: 'Heavy', text: 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, too many watermarks' },
    { id: 1, name: 'Light', text: 'blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing' },
    { id: 4, name: '없음', text: '' },
  ],
  v4cur: [
    { id: 0, name: 'Heavy', text: 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views' },
    { id: 1, name: 'Light', text: 'blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing' },
    { id: 4, name: '없음', text: '' },
  ],
  v3: [
    { id: 0, name: 'Heavy', text: 'lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract]' },
    { id: 1, name: 'Light', text: 'lowres, jpeg artifacts, worst quality, watermark, blurry, very displeasing' },
    { id: 3, name: 'Human Focus', text: 'lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract], bad anatomy, bad hands, @_@, mismatched pupils, heart-shaped pupils, glowing eyes' },
    { id: 4, name: '없음', text: '' },
  ],
  furry3: [
    { id: 0, name: 'Heavy', text: '{{worst quality}}, [displeasing], {unusual pupils}, guide lines, {{unfinished}}, {bad}, url, artist name, {{tall image}}, mosaic, {sketch page}, comic panel, impact (font), [dated], {logo}, ych, {what}, {where is your god now}, {distorted text}, repeated text, {floating head}, {1994}, {widescreen}, absolutely everyone, sequence, {compression artifacts}, hard translated, {cropped}, {commissioner name}, unknown text, high contrast' },
    { id: 1, name: 'Light', text: '{worst quality}, guide lines, unfinished, bad, url, tall image, widescreen, compression artifacts, unknown text' },
    { id: 4, name: '없음', text: '' },
  ],
};
const MODELS = {
  'nai-diffusion-4-5-full':        { name: 'NAI Diffusion V4.5 Full', kind: '👤', ver: 45, inpaint: 'nai-diffusion-4-5-full-inpainting',    quality: ', very aesthetic, masterpiece, no text', ucs: UC.v45full },
  'nai-diffusion-4-5-curated':     { name: 'NAI Diffusion V4.5 Curated', kind: '👤', ver: 45, inpaint: 'nai-diffusion-4-5-curated-inpainting', quality: ', masterpiece, no text, -0.8::feet::, rating:general', ucs: UC.v45cur },
  'nai-diffusion-4-full':          { name: 'NAI Diffusion V4 Full', kind: '👤', ver: 40, inpaint: 'nai-diffusion-4-full-inpainting',        quality: ', no text, best quality, very aesthetic, absurdres', ucs: UC.v4full },
  'nai-diffusion-4-curated-preview': { name: 'NAI Diffusion V4 Curated', kind: '👤', ver: 40, inpaint: 'nai-diffusion-4-curated-inpainting', quality: ', rating:general, amazing quality, very aesthetic, absurdres', ucs: UC.v4cur },
  'nai-diffusion-3':               { name: 'NAI Diffusion Anime V3', kind: '👤', ver: 30, inpaint: 'nai-diffusion-3-inpainting',            quality: ', best quality, amazing quality, very aesthetic, absurdres', ucs: UC.v3 },
  'nai-diffusion-furry-3':         { name: 'NAI Diffusion Furry V3', kind: '🐾', ver: 30, inpaint: 'nai-diffusion-furry-3-inpainting',      quality: ', {best quality}, {amazing quality}', ucs: UC.furry3 },
};
const SAMPLERS = [
  ['k_euler_ancestral', 'Euler Ancestral'], ['k_euler', 'Euler'],
  ['k_dpmpp_2s_ancestral', 'DPM++ 2S Ancestral'], ['k_dpmpp_2m_sde', 'DPM++ 2M SDE'],
  ['k_dpmpp_2m', 'DPM++ 2M'], ['k_dpmpp_sde', 'DPM++ SDE'], ['ddim_v3', 'DDIM (V3)'],
];
const SCHEDULES = ['karras', 'exponential', 'polyexponential', 'native'];
const SIZES = [
  ['Normal · 세로 832×1216', 832, 1216], ['Normal · 가로 1216×832', 1216, 832], ['Normal · 정사각 1024×1024', 1024, 1024],
  ['Large · 세로 1024×1536', 1024, 1536], ['Large · 가로 1536×1024', 1536, 1024], ['Large · 정사각 1472×1472', 1472, 1472],
  ['Wallpaper · 세로 1088×1920', 1088, 1920], ['Wallpaper · 가로 1920×1088', 1920, 1088],
  ['Small · 세로 512×768', 512, 768], ['Small · 가로 768×512', 768, 512], ['Small · 정사각 640×640', 640, 640], ['커스텀', 0, 0],
];
const THEMES = {
  violet:  { name: 'Violet Night', dark: true,  sw: ['#12111f', '#a78bfa'] },
  ocean:   { name: 'Deep Ocean',   dark: true,  sw: ['#0d1626', '#38bdf8'] },
  forest:  { name: 'Forest',       dark: true,  sw: ['#0f1a14', '#4ade80'] },
  gold:    { name: 'Gold Noir',    dark: true,  sw: ['#14161c', '#f5d97e'] },
  yami:    { name: '멘헤라 나이트', dark: true,  sw: ['#16101a', '#ff5fa2'] },
  light:   { name: 'Clean Light',  dark: false, sw: ['#ffffff', '#18181b'] },
  pink:    { name: 'NAI Pink',     dark: false, sw: ['#fbeff8', '#c026a3'] },
  menhera: { name: '멘헤라',        dark: false, sw: ['#fff0f6', '#e0257a'] },
  sakura:  { name: '사쿠라',        dark: false, sw: ['#fff7f3', '#d64f7a'] },
  mint:    { name: '민트',          dark: false, sw: ['#f0fbf8', '#0f8a6e'] },
};
const isDarkTheme = t => !!(THEMES[t] && THEMES[t].dark);
const NSFW_EXEMPT = ['nai-diffusion-4-5-curated', 'nai-diffusion-4-curated-preview']; // NAI 웹에서 nsfw 자동 추가를 하지 않는 모델

/* ─────────────── 상태 ─────────────── */
const DEFAULTS = {
  model: 'nai-diffusion-4-5-full', w: 832, h: 1216, n: 1,
  steps: 28, scale: 5, rescale: 0, sampler: 'k_euler_ancestral', schedule: 'karras',
  seed: '', randomSeed: true,
  quality: true, ucPreset: 0, variety: false, decrisper: false, autoNsfw: true, stream: true, slashWild: false,
  smea: false, smeaDyn: false, ucStrength: 1, legacyUc: false, aiChoice: true,
  prompt: '', uc: '', chars: [],
  singleBox: false, secText: {}, autoMode: 'random', chunkCats: [],
  sections: [
    { id: 'qa', name: '중요 태그 (퀄리티 · 작가 · 캐릭터)', hint: '맨 앞에 둘 태그 — 예: masterpiece, artist:hoshi_(snowdrop), 1.2::wlop::, hatsune miku' },
    { id: 'char', name: '캐릭터 · 외모', hint: '인원, 외모, 의상 — 예: 1girl, silver hair, red eyes, school uniform' },
    { id: 'act', name: '행동 · 포즈 · 표정', hint: '예: sitting, looking at viewer, smile, hand on own cheek' },
    { id: 'bg', name: '배경 · 상황', hint: '예: park, sunset, cherry blossoms, night' },
    { id: 'style', name: '구도 · 스타일 · 기타', hint: '예: upper body, from side, soft lighting, sketch' },
  ],
  strength: 0.7, noise: 0, vibeNormalize: true,
  enhStr: 0.5, enhNoise: 0.1, enhScale: 1, varStr: 0.8, varNoise: 0.1,
  autoCount: 20, autoDelay: 3, autoSaveOn: false, stripOnSave: false,
  chunks: [], deleted: {}, ytQueue: [], ytPos: null, ytSize: 'normal', ytOpen: false, ytVol: 60, ytUsePop: false, ytPopMode: 'tab',
  theme: 'violet', lastDark: 'violet', lastLight: 'light', ov: {}, tagUnderscore: false,
  histFavOnly: false,
  mode: 'main', scenes: [], curScene: null, styles: [], activeStyle: null, characters: [],
};
let S = { ...DEFAULTS };
try { S = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('nst_state')) || {}) }; } catch (e) {}
let saveTimer = null, pushTimer = null;
function save() {
  // 초기화/서버 동기화가 끝나기 전(R.booted=false)의 내부 저장은 "사용자 편집"으로 치지 않음 → 빈 브라우저가 서버 설정을 덮어쓰는 사고 방지
  if (R.booted) S.savedAt = Date.now();
  if (typeof updatePreview === 'function') updatePreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localStorage.setItem('nst_state', JSON.stringify(S)), 250);
  if (R.booted) { clearTimeout(pushTimer); pushTimer = setTimeout(() => pushStateToServer(), 1200); }
}
const contentCount = s => ['chunks', 'styles', 'characters', 'scenes'].reduce((a, k) => a + ((s && s[k] && s[k].length) || 0), 0);
async function pushStateToServer(force) {
  if (!R.srvOk || !R.booted) return;
  // 보내는 순간의 savedAt 을 붙잡아 둔다. 왕복 도중 사용자가 한 글자만 쳐도 S.savedAt 이
  // 새로 찍히는데, 그 값을 기준으로 남기면 서버에 없는 버전을 기준 삼게 되어
  // 다음 부팅에서 애먼 '갈라짐' 판정이 난다.
  const sentAt = S.savedAt, sentBody = JSON.stringify(S);
  try {
    const r = await fetch(R.api + '/state' + (force ? '?force=1' : ''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: sentBody });
    if (r.status === 409) { // 서버가 보호: 서버 쪽 내용이 훨씬 많거나, 빈 프롬프트로 덮으려 함
      // 이 저장은 버려졌다. 로컬을 서버 것으로 맞춰 화면이 빈 채로 남지 않게 한다.
      pullStateFromServer(true).catch(() => {});
      const j = await r.json().catch(() => ({}));
      if (R.protectShown) return; R.protectShown = true;
      openModal('⚠ 설정 덮어쓰기 보호', body => {
        body.innerHTML = `<div class="hint">서버에 저장된 설정(청크·스타일·캐릭터·씬 합계 <b>${j.serverCount}</b>개)이 이 화면의 설정(<b>${j.incomingCount}</b>개)보다 훨씬 많아 자동 덮어쓰기를 막았습니다. 다른 브라우저/창에서 만든 설정일 수 있습니다.</div>
          <div class="row"><button class="btn primary" id="spPull">서버 설정을 가져와 합치기 (권장)</button><button class="btn danger sm" id="spForce">그래도 이 화면의 설정으로 덮어쓰기</button></div>`;
        body.querySelector('#spPull').onclick = async () => { closeModal(); R.protectShown = false; await pullStateFromServer(true); };
        body.querySelector('#spForce').onclick = async () => { closeModal(); R.protectShown = false; await pushStateToServer(true); toast('서버 설정을 덮어썼습니다'); };
        // ✕/Esc/바깥 클릭으로 닫아도 플래그를 풀어야 한다 — 안 그러면 그 세션 내내 서버 저장이 조용히 막힌다
      }, false, () => { R.protectShown = false; });
      R.stateSynced = false; logErr('서버 저장 보류(덮어쓰기 보호)');
      return;
    }
    if (!r.ok && r.status !== 409) { R.stateSynced = false; logErr('설정 서버 저장 실패 ' + r.status); }
    // 저장이 성공했다면 서버 버전 = 방금 보낸 것이다. 이걸 기준으로 남겨야 다음 부팅에서
    // 이 브라우저가 '지금 서버 버전을 보고 있는 상태'로 인정돼 설정이 그대로 유지된다.
    else { R.stateSynced = true; R.seenBase = sentAt || 0; try { localStorage.setItem('nst_base', String(sentAt || 0)); } catch (e) {} }
  } catch (e) { R.stateSynced = false; logErr('설정 서버 저장 실패: ' + e.message); }
}
/* 삭제 기록(툼스톤) — 지운 항목이 서버 동기화로 되살아나지 않게 */
function tomb(kind, key) {
  if (!key) return;
  S.deleted = S.deleted || {};
  S.deleted[kind + '|' + String(key).toLowerCase()] = Date.now();
  const ks = Object.keys(S.deleted);
  if (ks.length > 400) { ks.sort((a, b) => S.deleted[a] - S.deleted[b]).slice(0, ks.length - 400).forEach(k => delete S.deleted[k]); }
}
/* 삭제 기록(톰스톤) 판정.
   item 을 같이 넘기면 "톰스톤보다 나중에 만든 항목"은 살려둔다 — 지운 이름을 다시 쓰는 건
   기본 동작이라("청크1", "캐릭터 2" 처럼 번호가 재사용됨) 이게 없으면 새로 만든 항목이
   새로고침할 때마다 조용히 사라진다. createdAt 이 없는 옛 항목은 종전대로 삭제로 취급. */
const isTombed = (del, kind, key, item) => {
  const t = del && del[kind + '|' + String(key || '').toLowerCase()];
  if (!t) return false;
  return !(item && item.createdAt > t);
};
const mergeByKey = (a, b, key, kind, delA, delB) => {
  const kOf = x => ((x[key] != null ? x[key] : x.list) || '').toString().toLowerCase();
  const del = { ...(delA || {}), ...(delB || {}) };
  const out = (a || []).filter(x => !(kind && isTombed(del, kind, kOf(x), x)));
  (b || []).forEach(x => {
    const kx = kOf(x); if (!kx) return;
    if (kind && isTombed(del, kind, kx, x)) return;         // 어느 쪽에서든 지운 것은 부활시키지 않음
    if (!out.some(y => kOf(y) === kx)) out.push(x);
  });
  return out;
};
async function pullStateFromServer(forceMerge) { // 서버 설정 가져오기: 내용 목록(청크·스타일·캐릭터·씬·유튜브)은 항상 합집합 → 어느 쪽 것도 사라지지 않음
  if (!R.srvOk) return false;
  try {
    const r = await fetch(R.api + '/state', { cache: 'no-store' }); if (!r.ok) { R.booted = true; return false; }
    const srv = await r.json();
    if (!srv || !srv.savedAt) { R.booted = true; pushStateToServer(); return false; }
    /* 어느 쪽이 이길지 정하는 규칙.

       원칙: 이 판정은 절대로 사용자의 설정을 없애는 쪽으로 기울면 안 된다.
       한때 "로컬이 지금 서버 버전을 보고 만들어진 것일 때만 이긴다"로 조였는데,
       그러면 서버 쪽이 뒤처져 있는 사람(저장이 막혀 있었거나, 서버를 늦게 띄웠거나,
       예전 버전의 state.json 이 남아 있는 경우)은 앱을 껐다 켜는 순간
       브라우저에 있던 최신 설정이 서버의 낡은 값으로 통째로 바뀌어 버렸다.
       실제로 그렇게 설정을 전부 잃은 사용자가 나왔다.

       그래서 판정은 예전 그대로 "시각이 늦은 쪽이 이긴다"로 두고,
       아래 nst_base 는 '갈라진 것 같다'고 알려주는 용도로만 쓴다.
       서버 쪽 값은 서버 백업(data/backups)에 남으므로 되찾을 수 있다. */
    const rawBase = localStorage.getItem('nst_base');
    const seenBase = +(rawBase || 0);
    const tabBase = R.seenBase;
    const basedOnCurrent = rawBase != null && seenBase > 0 && seenBase === srv.savedAt
      && (tabBase == null || tabBase === srv.savedAt);
    /* 빈 쪽이 채워진 쪽을 이기는 일은 절대 없어야 한다.

       서버가 아직 안 떴을 때 앱을 열면 3번 실패 뒤 '로컬만 사용' 으로 넘어간다(app.js srvLoop).
       그 상태는 DEFAULTS(=빈 프롬프트)인데, 거기서 아무거나 한 번 건드리면 '지금' 시각이
       찍혀 서버보다 최신이 된다. 서버가 뜨는 순간 그 빈 상태가 이겨 화면이 비고,
       이어지는 저장이 서버의 프롬프트까지 지워버린다. 실제로 여러 번 났다.

       반대로 "무조건 서버 우선" 으로 바꿨더니, 서버가 뒤처진 사람의 설정이 날아갔다.
       그래서 판정은 시각대로 두되, '내용이 없는 쪽이 있는 쪽을 덮는' 경우만 막는다.
       이 조건은 어느 방향으로도 데이터를 없애지 않는다. */
    const hasText = o => !!((o.prompt || '').trim() || Object.values(o.secText || {}).some(v => (v || '').trim()));
    const localBare = !hasText(S) && contentCount(S) === 0;
    const srvHasStuff = hasText(srv) || contentCount(srv) > 0;
    const localNewer = (S.savedAt || 0) >= srv.savedAt && !(localBare && srvHasStuff) && !forceMerge;
    if (localBare && srvHasStuff && (S.savedAt || 0) >= srv.savedAt)
      toast('이 브라우저가 빈 상태라 서버에 저장된 내용을 불러왔습니다');
    // 로컬이 이기는데 그 로컬이 지금 서버 버전을 보고 만든 게 아니면, 서버 쪽 설정이
    // 이 저장으로 덮인다 → 조용히 넘어가지 않고 알린다 (덮어쓰기는 그대로 진행).
    const diverged = localNewer && rawBase != null && !basedOnCurrent;
    const base = localNewer ? { ...S } : { ...DEFAULTS, ...srv }, other = localNewer ? srv : S;
    // 대기열·기록은 합치지 않는다. 톰스톤이 없어서 합집합이 곧 '절대 못 지움'이 되기 때문에
    // 대기열에서 뺀 곡이 서버/다른 탭에서 그대로 되살아났다. 이 둘은 최신 쪽(base)을 그대로 쓴다.
    for (const [k, key, kind] of [['chunks', 'name', 'chunk'], ['styles', 'id', 'style'], ['characters', 'name', 'char'], ['scenes', 'id', 'scene']])
      base[k] = mergeByKey(base[k], other[k], key, kind, S.deleted, srv.deleted);
    base.deleted = { ...(srv.deleted || {}), ...(S.deleted || {}) };
    base.chunkCats = [...new Set([...(base.chunkCats || []), ...(other.chunkCats || [])])].filter(c => !isTombed(base.deleted, 'cat', c));
    // 복구용 백업은 "실제로 내용이 줄어드는" 경우에만 남긴다.
    // 예전엔 부팅할 때마다 무조건 덮어써서 🛟복구가 이미 깨진 상태만 보여줬다.
    if (contentCount(base) < contentCount(S) || diverged) { try { localStorage.setItem('nst_state_prev', JSON.stringify(S)); } catch (e) {} }
    R.seenBase = srv.savedAt || 0;
    try { localStorage.setItem('nst_base', String(srv.savedAt || 0)); } catch (e) {}   // 용량 초과로 pull 전체가 중단되면 안 된다
    if (localNewer) { S = base; R.booted = true; save(); if (diverged) toast('이 브라우저 설정으로 서버를 갱신했습니다 — 다른 창/기기에서 바꾼 설정이 있었다면 📦백업에서 되돌릴 수 있습니다'); if (typeof renderChunkBar === 'function') renderChunkBar(); if (typeof renderStyleSelects === 'function') renderStyleSelects(); return false; }
    S = base;
    localStorage.setItem('nst_state', JSON.stringify(S));
    if (!MODELS[S.model]) S.model = DEFAULTS.model;
    syncUI(); renderChars(); applyTheme();
    if (typeof renderChunkBar === 'function') renderChunkBar();
    if (typeof renderStyleSelects === 'function') renderStyleSelects();
    if (typeof renderYtQueue === 'function') renderYtQueue();
    setMode(S.mode || 'main');
    R.booted = true; save();
    toast('서버에 저장된 설정(청크·스타일·씬)을 불러와 합쳤습니다');
    return true;
  } catch (e) { R.booted = true; return false; }
}
const getToken = () => localStorage.getItem('nst_token') || '';
const hasToken = () => !!getToken() || !!R.srvToken;

/* 런타임 */
const R = {
  i2iBlob: null, maskCanvas: null, vibes: [], prefs: [],
  hist: [], cur: -1, dirHandle: null, gen: false,
  auto: { on: false, done: 0 }, lastSeed: null,
  api: '', srvOk: false, srvToken: false, lastTA: null, lastErr: '',
};

/* ─────────────── 유틸 ─────────────── */
const ERRLOG = [];
function logErr(msg) { ERRLOG.push({ t: new Date().toLocaleTimeString(), msg: String(msg) }); if (ERRLOG.length > 30) ERRLOG.shift(); }
function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  if (type === 'err') logErr(msg);
  setTimeout(() => t.remove(), type === 'err' ? 6500 : 3000);
}
function bufToB64(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s);
}
const randSeed = () => Math.floor(Math.random() * 4294967296);
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : '' + n;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeName = s => (s || '').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 40);
function joinParts() { return [...arguments].map(x => (x || '').trim()).filter(Boolean).join(', '); }
function ts() {
  const d = new Date(), p = n => ('' + n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
/* ── 조각/와일드카드 ──────────────────────────────────────────────
   <a|b|c>   인라인 랜덤
   <이름>    청크가 여러 줄이면 "조각" — 그 중 한 줄을 랜덤으로 뽑음 (뽑힌 줄 안의 <…>도 재귀 치환)
   <*이름>   순차 선택 — 짤뽑을 돌릴 때마다 다음 줄로 (조각별 카운터)
   (a/b/c)   괄호 와일드카드 — 설정에서 켤 때만 (기본 끔)
   a/b/c     단순 슬래시 — 설정에서 켤 때만 (fate/zero 같은 정상 태그를 깨뜨려서)
   없는 이름은 그대로 두고, 자기 참조는 깊이 가드로 멈춘다.                        */
const SEQ = {};                       // 조각별 순차 카운터
function resetSeqCounters() { for (const k in SEQ) delete SEQ[k]; }
function fragLines(name) {            // 청크 → 조각 줄 목록 (여러 줄일 때만 조각으로 취급)
  const c = S.chunks.find(c => normKey(c.name) === normKey(name));
  if (!c) return null;
  const lines = String(c.text || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  return lines.length > 1 ? lines : null;
}
function expandWild(s, peek, depth) {
  depth = depth || 0;
  if (!s || depth > 10) return s;
  s = String(s).replace(/<([^<>]+)>/g, (m, inner) => {
    const t = inner.trim();
    if (t.includes('|')) {            // <a|b|c>
      const opts = t.split('|').map(o => o.trim()).filter(Boolean);
      if (!opts.length) return m;
      /* 뽑힌 값이 청크 이름이면 그것도 풀어야 한다. 예전엔 그대로 내보내서 청크 이름이
         태그인 척 NAI 로 나갔다. 이름이면 <이름> 으로 다시 태워, 여러 줄 조각일 때
         전부가 아니라 한 줄만 뽑히게 한다. */
      const pick = opts[Math.floor(Math.random() * opts.length)];
      const isChunk = S.chunks.some(c => normKey(c.name) === normKey(pick));
      return isChunk ? expandWild('<' + pick + '>', peek, depth + 1)
                     : expandWild(chunksKeepTags(pick), peek, depth + 1);
    }
    const seq = t.startsWith('*'), name = (seq ? t.slice(1) : t).trim().replace(/\s*\/\s*/g, '/');
    if (!name) return m;
    const lines = fragLines(name);
    if (!lines) {
      /* 여러 줄이 아니면 조각이 아니다. 그래도 <이름> 으로 부른 이상 내용으로 바꿔줘야
         한다 — 예전엔 꺾쇠째 남아 "<작태>" 가 그대로 프롬프트에 실려 나갔다. */
      const one = S.chunks.find(c => normKey(c.name) === normKey(name));
      if (!one) return m;             // 없는 이름은 원본 유지
      return expandWild(chunksKeepTags(String(one.text || '').trim()), peek, depth + 1);
    }
    let line;
    if (seq) {
      const i = SEQ[normKey(name)] || 0;
      line = lines[i % lines.length];
      if (!peek) SEQ[normKey(name)] = i + 1;   // 미리보기는 카운터를 소모하지 않음
    } else line = lines[Math.floor(Math.random() * lines.length)];
    return expandWild(chunksKeepTags(line), peek, depth + 1);   // 뽑힌 줄 안의 청크 이름도 풀어준다
  });
  // 슬래시 와일드카드는 기본 꺼둔다 — 단부루에는 fate/zero, (fate/apocrypha), k/da 처럼
  // 슬래시가 이름의 일부인 정상 태그가 많아서(번들 DB 기준 97개+) 켜면 그 태그들이 망가진다.
  if (S.slashWild) {
    s = s.replace(/\(([^()]*\/[^()]*)\)/g, (m, inner) => {   // (a, b/c, d)
      const opts = inner.split('/').map(o => o.trim()).filter(Boolean);
      return opts.length > 1 ? opts[Math.floor(Math.random() * opts.length)] : m;
    });
    // 단순 슬래시: 치환이 실제로 일어나는 태그만 바꿔 사용자의 줄바꿈/띄어쓰기를 보존한다
    s = s.replace(/[^,\n]+/g, seg => {
      const t = seg.trim();
      if (!t.includes('/') || t.includes(' ') || t.includes('://') || t.startsWith('http')) return seg;
      if (/[{}\[\]]|::/.test(t)) return seg;            // {{a/b}} · 1.5::a/b:: 같은 가중치 문법은 건드리지 않음
      const opts = t.split('/').map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) return seg;
      const pick = opts[Math.floor(Math.random() * opts.length)];
      return seg.replace(t, pick);
    });
  }
  return s;
}
/* 청크 치환: 프롬프트의 토큰(쉼표/줄바꿈/괄호로 구분)이 청크 이름과 같으면 내용으로 바뀜. @이름 형식도 계속 지원 */
const normKey = s => String(s || '').trim().toLowerCase().replace(/[\s_]+/g, '_'); // 띄어쓰기/밑줄 차이 무시
function chunkMap() { const m = {}; for (const c of S.chunks) if (c.name) m[normKey(c.name)] = c.text; return m; }
function expandChunks(s, depth, active) {
  /* 청크 안에서 다른 청크를 부르는 건 되지만, 자기 자신(또는 돌아오는 참조)은 막아야 한다.
     예전엔 바꾼 결과를 처음부터 다시 훑어서, 이름을 본문에 포함한 청크가 깊이 한도(5)만큼
     겹겹이 복제됐다 — 한 번 쓴 이름이 여섯 번 들어가는 식이었다.
     이제는 치환한 자리에서 바로 안쪽만 풀고, 지금 풀고 있는 이름은 건너뛴다. */
  depth = depth || 0;
  active = active || new Set();
  if (depth > 5 || !S.chunks.length) return s;
  const map = chunkMap();
  return String(s).replace(/([^,\n{}\[\]<>|]+)/g, seg => {
    const m = seg.match(/^(\s*)(-?[\d.]+::)?(@?)(.*?)(::)?(\s*)$/);
    if (!m) return seg;
    const key = normKey(m[4]);
    if (!key || !(key in map) || active.has(key)) return seg;
    const next = new Set(active); next.add(key);
    const inner = expandChunks(map[key], depth + 1, next);
    return m[1] + (m[2] || '') + inner + (m[5] || '') + m[6];
  });
}
function isChunkToken(tok) { const t = normKey(tok.replace(/^-?[\d.]+::/, '').replace(/::$/, '').replace(/^@/, '')); return !!t && S.chunks.some(c => normKey(c.name) === t); }
/* 최종 프롬프트에서 두 번 이상 나오는 태그를 찾는다.
   가중치 표기(1.4::tag::, {tag}, [tag])와 대소문자·공백·언더바 차이는 같은 태그로 본다. */
function dupTags(text) {
  const seen = new Map();
  for (let t of String(text || '').split(/[,\n]/)) {
    t = t.replace(/-?[\d.]+::/g, '').replace(/::/g, '').replace(/[{}\[\]]/g, '')
         .replace(/_/g, ' ').trim().toLowerCase();
    if (t.length < 2) continue;                       // 빈 칸이나 한 글자는 무시
    seen.set(t, (seen.get(t) || 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }));
}

/* 최종 프롬프트 미리보기 (실제 전송될 형태 — 랜덤 <a|b>는 생성 때 다시 뽑힘) */
function previewFinal() {
  const st = getStyle(S.activeStyle);
  // peek=true — 미리보기는 <*조각> 순차 카운터를 소모하지 않는다 (실제 생성 때 밀리면 안 됨)
  let p = expandAll(joinParts(st && st.prefix, getMainPrompt(), st && st.suffix), true);
  if (S.quality) p += getQuality(S.model);
  let uc = joinParts(getUcText(S.model, ucIdx()), st && expandAll(st.uc || '', true), expandAll(S.uc.trim(), true));
  if (S.autoNsfw !== false && !NSFW_EXEMPT.includes(S.model) && getUcText(S.model, ucIdx()) && !p.toLowerCase().includes('nsfw') && !/^nsfw\b/i.test(uc)) uc = uc ? 'nsfw, ' + uc : 'nsfw';
  return { p, uc };
}
function updatePreview() {
  const box = $('#pvBox'); if (!box || box.hidden) return;
  const { p, uc } = previewFinal();
  $('#pvPrompt').textContent = p; $('#pvUc').textContent = uc;
  const nChunks = (getMainPrompt().match(/[^,\n{}\[\]<>|]+/g) || []).filter(t => isChunkToken(t)).length;
  const nFrag = (getMainPrompt().match(/<[^<>]+>/g) || []).length;
  // 토큰 수 (T5, V4/4.5 한도 512) — 넘으면 뒤가 잘리므로 눈에 띄게
  const tok = typeof countTokens === 'function' ? countTokens(p) : null;
  const tokTxt = tok == null ? '' : ` · 토큰 ${tok}/512${tok > 512 ? ' ⚠ 초과분은 무시됩니다' : ''}`;
  // 같은 태그가 여러 번 들어가는 것을 눈에 보이게 한다.
  // 스타일 프리셋의 앞 고정 프롬프트가 지금 칸에 있는 내용과 겹치면 프롬프트가 통째로
  // 두 번 나가는데(토큰·Anlas 낭비에 그림도 망가진다) 예전엔 알 방법이 전혀 없었다.
  const dup = dupTags(p);
  const dupTxt = dup.length ? ` · ⚠ 중복 태그 ${dup.length}개` : '';
  $('#pvInfo').textContent = `${p.length}자${tokTxt} · 청크 ${nChunks}개 치환` + (nFrag ? ` · 조각/랜덤 ${nFrag}개` : '')
    + (S.activeStyle && getStyle(S.activeStyle) ? ' · 스타일 "' + getStyle(S.activeStyle).name + '" 적용' : '') + dupTxt + ' · 생성할 때마다 다시 랜덤';
  $('#pvInfo').title = dup.length
    ? '두 번 이상 들어간 태그: ' + dup.slice(0, 12).map(d => `${d.tag} ×${d.n}`).join(', ')
      + (dup.length > 12 ? ` … 외 ${dup.length - 12}개` : '')
      + '\n스타일 프리셋의 앞/뒤 고정 프롬프트와 프롬프트 칸에 같은 내용이 들어 있지 않은지 확인해 보세요.'
    : '';
}
/* 청크 치환 — 단, <...> 안(조각 이름·랜덤 옵션)은 건드리지 않는다.
   이걸 안 하면 <의상> 의 "의상" 이 청크 본문으로 먼저 바뀌어 <본문전체> 가 되고,
   조각 뽑기가 통째로 죽는다 (꺾쇠와 줄바꿈이 그대로 NAI 로 전송됨). */
function chunksKeepTags(s) {
  const held = [];
  const MARK = '\u0001';   // 프롬프트에 나올 일이 없는 제어문자로 <...> 구간을 잠시 대치
  let t = String(s || '').replace(/<[^<>]*>/g, m => { held.push(m); return MARK + (held.length - 1) + MARK; });
  t = expandChunks(t);
  return t.replace(/\u0001(\d+)\u0001/g, (m, i) => (held[+i] != null ? held[+i] : m));
}
const expandAll = (s, peek) => expandWild(chunksKeepTags(s), peek);
function blobToImage(blob) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); res(img); };
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}
async function blobToB64Resized(blob, w, h) { // cover-crop
  const img = await blobToImage(blob);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const r = Math.max(w / img.width, h / img.height);
  const dw = img.width * r, dh = img.height * r;
  x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c.toDataURL('image/png').split(',')[1];
}
async function blobToB64Letterbox(blob) { // Precise Reference용: 허용 캔버스에 레터박스(검정 여백)
  const img = await blobToImage(blob);
  const CANV = [[1024, 1536], [1536, 1024], [1472, 1472]];
  const ar = img.width / img.height;
  let best = CANV[0], bd = 1e9;
  for (const c of CANV) { const d = Math.abs(c[0] / c[1] - ar); if (d < bd) { bd = d; best = c; } }
  const [w, h] = best;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  const r = Math.min(w / img.width, h / img.height);
  const dw = Math.round(img.width * r), dh = Math.round(img.height * r);
  x.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  return cv.toDataURL('image/png').split(',')[1];
}
async function blobToB64(blob) { return bufToB64(await blob.arrayBuffer()); }
async function blobSize(blob) { const i = await blobToImage(blob); return [i.width, i.height]; }
function snap64(v) { return Math.max(64, Math.min(2048, Math.round(v / 64) * 64)); }

/* IndexedDB */
function idb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('nst', 2);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('hist')) db.createObjectStore('hist', { keyPath: 'id', autoIncrement: true });
    };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
}
async function idbSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const rq = db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); }
async function histPut(rec) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('hist', 'readwrite'); const rq = tx.objectStore('hist').put(rec); rq.onsuccess = () => res(rq.result); tx.onerror = () => rej(tx.error); }); }
async function histDel(id) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('hist', 'readwrite'); tx.objectStore('hist').delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function histAll() { const db = await idb(); return new Promise((res, rej) => { const rq = db.transaction('hist').objectStore('hist').getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error); }); }
async function histClearDb() { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('hist', 'readwrite'); tx.objectStore('hist').clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

/* ─────────────── ZIP / PNG ─────────────── */
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP 형식이 아닙니다');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    let data = u8.slice(ds, ds + csize);
    if (method === 8) { const st = new Response(data).body.pipeThrough(new DecompressionStream('deflate-raw')); data = new Uint8Array(await new Response(st).arrayBuffer()); }
    out.push({ name, data });
    off += 46 + nlen + elen + clen;
  }
  return out;
}
async function respImages(res) {
  const buf = await res.arrayBuffer(); const u8 = new Uint8Array(buf);
  if (u8[0] === 0x89 && u8[1] === 0x50) return [new Blob([u8], { type: 'image/png' })];
  const files = await unzip(buf);
  return files.filter(f => /\.png$/i.test(f.name)).map(f => new Blob([f.data], { type: 'image/png' }));
}
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
function pngWalk(u8, cb) {
  if (u8.length < 8 || PNG_SIG.some((b, i) => u8[i] !== b)) return false;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let pos = 8;
  while (pos + 12 <= u8.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
    if (cb(type, pos + 8, len, pos, len + 12) === false) break;
    pos += len + 12;
    if (type === 'IEND') break;
  }
  return true;
}
async function pngTextChunks(u8) {
  const out = [], jobs = [];
  pngWalk(u8, (type, ds, len) => {
    const data = u8.subarray(ds, ds + len);
    if (type === 'tEXt') { const z = data.indexOf(0); out.push({ key: new TextDecoder('latin1').decode(data.subarray(0, z)), text: new TextDecoder('latin1').decode(data.subarray(z + 1)) }); }
    else if (type === 'zTXt') {
      // 키워드  + 압축방식(1바이트) + zlib(deflate) 본문.
      // 이 분기가 없어서, 프롬프트가 zTXt 에 든 파일을 "청크 0개"(=깨끗함)로 보고했다.
      const z = data.indexOf(0);
      if (z > 0) {
        const key = new TextDecoder('latin1').decode(data.subarray(0, z));
        const body = data.subarray(z + 2);
        jobs.push((async () => {
          try { const st = new Response(body).body.pipeThrough(new DecompressionStream('deflate')); out.push({ key, text: await new Response(st).text() }); }
          catch (e) { out.push({ key, text: '(압축 해제 실패)' }); }
        })());
      }
    }
    else if (type === 'iTXt') {
      const z = data.indexOf(0); const key = new TextDecoder().decode(data.subarray(0, z)); const compFlag = data[z + 1];
      let p = z + 3; p = data.indexOf(0, p) + 1; p = data.indexOf(0, p) + 1;
      const body = data.subarray(p);
      if (compFlag === 0) out.push({ key, text: new TextDecoder().decode(body) });
      else jobs.push((async () => { try { const st = new Response(body).body.pipeThrough(new DecompressionStream('deflate')); out.push({ key, text: await new Response(st).text() }); } catch (e) {} })());
    }
  });
  await Promise.all(jobs);
  return out;
}
function pngStrip(u8) {
  const DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
  const parts = [u8.subarray(0, 8)];
  const ok = pngWalk(u8, (type, ds, dlen, cs, clen) => { if (!DROP.has(type)) parts.push(u8.subarray(cs, cs + clen)); });
  if (!ok) return u8;
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let pos = 0; for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}
/* stealth pnginfo (알파 채널 LSB에 숨긴 메타) 검출: 비트를 x→y 순서로 읽어 헤더 "stealth_png..." 확인 */
function stealthDetect(imgData) {
  const { data, width, height } = imgData;
  const need = 'stealth_pngcomp'.length * 8; let bits = '', n = 0;
  outer: for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) { bits += (data[(y * width + x) * 4 + 3] & 1); if (++n >= need) break outer; }
  let s = ''; for (let i = 0; i + 8 <= bits.length; i += 8) s += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  return /^stealth_png(info|comp)/.test(s) ? s.slice(0, 15) : null;
}
async function stripBlob(blob) { // 완전 제거: 텍스트 청크 제거 + 픽셀 재인코딩(알파 LSB를 1로 고정 → 숨은 stealth 메타 파괴). 보이는 이미지는 그대로.
  const img = await blobToImage(blob);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height); const d = id.data;
  // 알파 최하위 비트를 1로 만들어 숨은 stealth 메타를 깬다.
  // 다만 완전 투명(alpha 0)은 건드리면 안 된다 — 0|1 = 1 이 되어 배경 제거 결과의
  // 투명 영역이 옅은 검정으로 남는다. alpha 0 에는 애초에 숨길 비트도 없다.
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) d[i] |= 1;
  x.putImageData(id, 0, 0);
  const out = await new Promise(res => c.toBlob(res, 'image/png'));
  return new Blob([pngStrip(new Uint8Array(await out.arrayBuffer()))], { type: 'image/png' });
}
async function blobHasStealth(blob) {
  try { const img = await blobToImage(blob); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return stealthDetect(x.getImageData(0, 0, c.width, c.height)); } catch (e) { return null; }
}

/* ─────────────── 서버 연결 / API ─────────────── */
const IS_FILE = location.protocol === 'file:';
const PORTS = [8765, 8766, 8767, 8768, 8769];
const APP_VERSION = '11.20';   // 화면 표시용 앱 버전 (상단)
const NEED_SERVER_VER = 17;   // 이 앱(html/js)이 필요로 하는 server.py 버전 — 낮으면 "start.bat 재실행" 안내
async function tryHealth(base) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(base + '/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}
async function probeServer() {
  R.probeTried = [];
  // 1) 같은 주소(서버로 열었을 때)
  if (!IS_FILE) {
    const j = await tryHealth('');
    R.probeTried.push(location.origin);
    if (j) { R.api = ''; R.srvOk = true; R.srvInfo = j; R.srvToken = !!j.hasToken; R.srvTokenHint = j.tokenHint || ''; R.oldServer = false; return j; }
  }
  // 2) 다른 포트에서 실행 중인 서버 찾기 (file:// 로 열었거나, 예전 포트 탭/즐겨찾기로 열었을 때)
  for (const p of PORTS) {
    const base = 'http://127.0.0.1:' + p;
    if (!IS_FILE && base === location.origin.replace('localhost', '127.0.0.1')) continue;
    R.probeTried.push(base);
    const j = await tryHealth(base);
    if (j) {
      // 예전 포트(예: 8766)로 열린 탭/즐겨찾기인데 지금 서버는 다른 포트 → 올바른 주소로 이동 (히스토리·설정이 주소별로 저장되므로)
      if (!IS_FILE && PORTS.includes(+location.port) && location.port !== String(p)) { location.replace(base + '/' + location.search); return j; }
      R.api = base; R.srvOk = true; R.srvInfo = j; R.srvToken = !!j.hasToken; R.srvTokenHint = j.tokenHint || ''; R.oldServer = false; return j;
    }
  }
  R.srvOk = false;
  // 정적 파일은 오는데 /health 가 없으면 = 예전 버전 서버 창이 아직 떠 있는 것
  R.oldServer = false;
  if (!IS_FILE) { try { const r = await fetch('/style.css', { cache: 'no-store' }); if (r.ok) R.oldServer = true; } catch (e) {} }
  return null;
}
function setSrvUI(ok, info) {
  const dot = $('#srvDot'), tx = $('#srvText');
  dot.className = 'dot ' + (ok ? 'ok' : 'bad');
  const stale = ok && info && (info.version || 0) < NEED_SERVER_VER;
  if (ok) {
    tx.textContent = stale ? '⚠ 서버가 예전 버전 — start.bat 재실행 필요' : (IS_FILE ? `연결됨 (${R.api.replace('http://', '')})` : '서버 연결됨');
    const t = info && info.tags; if (!stale && t && t.state !== 'ready' && t.msg) tx.textContent += ' · ' + t.msg;
    if (stale) dot.className = 'dot warn';
  } else tx.textContent = R.oldServer ? '예전 서버 실행 중 — 검은 창 모두 닫고 start.bat 재실행' : 'start.bat 꺼짐 — 실행하면 자동 연결';
  let w = $('#fileWarn');
  if (stale) {
    if (!w) { w = document.createElement('div'); w.id = 'fileWarn'; document.body.prepend(w); }
    w.innerHTML = `⚠ <b>지금 켜져 있는 서버(검은 창)가 예전 버전(v${info.version})입니다.</b> 새 기능(직접 재생·계정 연결·서버 상태 등)이 동작하지 않습니다 → 검은 창을 <b>모두 닫고 start.bat을 다시 실행</b>한 뒤 새로고침하세요. (필요 버전 v${NEED_SERVER_VER})`;
    updateAnlasLabel(); return;
  }
  if (!ok) {
    if (!w) { w = document.createElement('div'); w.id = 'fileWarn'; document.body.prepend(w); }
    const tried = [...new Set(R.probeTried || [])].map(t => t.replace('http://', '')).join(', ');
    w.innerHTML = (R.oldServer
      ? '⚠ <b>예전 버전의 서버 창이 아직 켜져 있습니다.</b> 열려 있는 검은 창(start.bat)을 <b>모두 닫고</b> start.bat을 다시 실행한 뒤 새로고침하세요.'
      : '⚠ <b>로컬 서버(start.bat)에 연결되지 않았습니다.</b> 같은 폴더의 <b>start.bat</b>을 실행하면 자동으로 연결됩니다 (3초마다 재시도). 검은 창이 켜져 있는데도 이 배너가 남아 있으면 검은 창에 표시된 주소(예: http://127.0.0.1:8765/)를 그대로 주소창에 입력해 여세요.')
      + `<div class="hint" style="color:#fff;opacity:.85;margin-top:4px">현재 주소: ${escHtml(location.href.split('?')[0])} · 시도한 서버: ${escHtml(tried || '-')} <button class="btn xs" id="srvRetry" style="margin-left:8px">지금 다시 연결</button></div>`;
    const rb = w.querySelector('#srvRetry'); if (rb) rb.onclick = async () => { rb.textContent = '연결 중…'; const info = await probeServer(); setSrvUI(R.srvOk, info); if (R.srvOk) { refreshAnlas().catch(() => {}); if (window.onServerUp) window.onServerUp(); } };
  } else if (w) w.remove();
  updateAnlasLabel();
}
async function srvLoop() {
  const info = await probeServer();
  const was = R.srvOkPrev;
  setSrvUI(R.srvOk, info);
  if (R.srvOk && !was) { await pullStateFromServer(); refreshAnlas().catch(() => {}); if (window.onServerUp) window.onServerUp(); }
  if (!R.srvOk && !R.booted && (R.probeFails = (R.probeFails || 0) + 1) >= 3) R.booted = true; // 서버가 없으면 로컬만 사용
  // 서버가 10분마다 GitHub 를 확인해 /health 에 실어 준다. srvLoop 는 15초마다 도므로
  // 새 버전이 올라오면 몇 초 안에 버튼이 뜬다 (예전엔 앱이 6시간에 한 번만 물어봤다).
  if (info && info.upd) applyUpdInfo(info.upd);
  R.srvOkPrev = R.srvOk;
  setTimeout(srvLoop, R.srvOk ? 15000 : 3000);
}
/* /health 가 알려준 업데이트 상태를 화면에 반영한다.
   updateCheck() 와 같은 표시를 쓰되, 여기서는 GitHub 를 직접 부르지 않는다. */
function applyUpdInfo(u) {
  const b = document.getElementById('btnUpdate');
  if (!b || !u || !u.configured) return;
  b.hidden = !u.available;
  b.textContent = u.available ? `⬆ 업데이트 ${u.latest}` : '';
  if (u.available && S.updSeen !== u.latest) {
    S.updSeen = u.latest; save();
    if (typeof toast === 'function') toast(`새 버전 ${u.latest} 이 나왔습니다 — 상단 ⬆ 버튼으로 받으세요`);
  }
}
function authHeaders(json) {
  const h = {};
  const t = getToken(); if (t) h['Authorization'] = 'Bearer ' + t;   // 없으면 서버가 저장된 토큰을 넣음
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
async function apiFetch(path, opts) {
  if (!R.srvOk) { await probeServer(); setSrvUI(R.srvOk, R.srvInfo); if (!R.srvOk) throw new Error('로컬 서버에 연결할 수 없습니다 — start.bat을 실행하세요'); }
  try { return await fetch(R.api + path, opts); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    R.srvOk = false; setSrvUI(false);
    throw new Error('로컬 서버와 연결이 끊겼습니다 — start.bat 창을 확인하세요');
  }
}
async function apiError(res) {
  let msg = res.status + ' ' + res.statusText, raw = '';
  try { raw = await res.text(); const j = JSON.parse(raw); msg = j.message || j.error || msg; } catch (e) {}
  R.lastErr = `${res.status} ${msg}`;
  if (res.status === 401) msg = '토큰이 유효하지 않습니다 (' + msg + ') — ⚙설정에서 새 토큰 저장';
  if (res.status === 400 && /refresh NovelAI|image URL/i.test(msg)) msg = 'NAI 서버 주소가 바뀌었습니다 (' + msg + ') — 앱 업데이트가 필요합니다. 어떤 기능에서 났는지 알려주세요';
  if (res.status === 402) msg = 'Anlas 부족 또는 구독 필요';
  if (res.status === 429) msg = '동시 생성 제한(429) — 잠시 후 다시 시도';
  if (res.status >= 500) { // NAI 서버 오류 → 공식 상태가 장애면 그 사실을 함께 알림 (내 문제 아님)
    const o = NST.last && NST.last.official, img = o && officialImg(o);
    if (img && img.code > 100) msg += ' · NAI 공식 상태: 이미지 생성 ' + img.status + ' (NAI 쪽 문제입니다)';
    else msg += ' · NAI 서버 오류 — 상단 NAI 상태를 확인하세요';
  }
  return new Error(msg);
}
function updateAnlasLabel() {
  if (!hasToken()) { $('#anlas').textContent = '◈ 토큰 없음'; $('#anlas').title = '⚙설정에서 API 토큰 저장'; }
}
async function refreshAnlas() {
  if (!hasToken()) { updateAnlasLabel(); return null; }
  try {
    // 2026 NAI 프론트엔드 기준: user/subscription 은 image.novelai.net 으로 이동 (api.novelai.net 은 400 "update to the image URL")
    const res = await apiFetch('/img/user/subscription', { headers: authHeaders() });
    if (!res.ok) throw await apiError(res);
    const j = await res.json();
    const t = j.trainingStepsLeft || {};
    const total = (t.fixedTrainingStepsLeft || 0) + (t.purchasedTrainingSteps || 0);
    R.tier = j.tier;
    $('#anlas').textContent = '◈ ' + total.toLocaleString(); updateCostHint();
    $('#anlas').title = 'Anlas ' + total.toLocaleString() + (j.tier === 3 ? ' · Opus' : '') + ' (클릭: 새로고침)';
    return total;
  } catch (e) { $('#anlas').textContent = '◈ ?'; $('#anlas').title = e.message; throw e; }
}

/* ─────────────── 프리셋 / 스타일 ─────────────── */
const getQuality = m => (S.ov[m] && S.ov[m].q != null) ? S.ov[m].q : MODELS[m].quality;
// 모델마다 UC 프리셋 개수가 달라, 실제로 생성에 쓰는 모델(m)을 기준으로 잡아야 한다.
// S.model 로만 보면 인핸스·변형처럼 다른 모델로 돌릴 때 엉뚱한 프리셋이 나갔다.
function ucIdx(m) { const mm = MODELS[m] ? m : S.model; const n = MODELS[mm].ucs.length; return S.ucPreset < n ? S.ucPreset : 0; }
function getUcText(m, idx) {
  const o = S.ov[m];
  if (o && o.uc && o.uc[idx] != null) return o.uc[idx];
  const p = MODELS[m].ucs[idx]; return p ? p.text : '';
}
const getStyle = id => id ? (S.styles.find(s => s.id === id) || null) : null;
const isV4 = () => MODELS[S.model].ver >= 40;

/* ─────────────── 페이로드 ─────────────── */
// Variety+ (skip_cfg_above_sigma) — NAI 웹 실캡처 확정: V4.5 계열은 계수 58, 그 외 19. 반올림하지 않는다.
// 검증: 1216×832 → 58 정확히, 1024×1024 → 59.04722600415217
function varietySigma(m, w, h) { return (String(m).includes('nai-diffusion-4-5') ? 58 : 19) * Math.sqrt(w * h / (832 * 1216)); }
function buildPayload(ov) {
  ov = ov || {};
  const m = ov.model || S.model, info = MODELS[m];
  const seed = ov.seed != null ? ov.seed : (S.randomSeed || S.seed === '' ? randSeed() : (parseInt(S.seed, 10) || 0));
  R.lastSeed = seed;
  const style = ov.style !== undefined ? ov.style : getStyle(S.activeStyle);
  let prompt = ov.prompt != null ? ov.prompt : expandAll(joinParts(style && style.prefix, getMainPrompt(), style && style.suffix));
  if (S.quality && !ov.noQuality) prompt += getQuality(m);
  let uc = ov.uc != null ? ov.uc : joinParts(getUcText(m, ucIdx(m)), ov.ucExtra != null ? ov.ucExtra : joinParts(style && expandAll(style.uc || ''), expandAll(S.uc.trim())));
  // NAI 웹 숨은 규칙: 프롬프트에 nsfw 가 없으면 네거티브 맨 앞에 "nsfw, " 자동 추가 (Curated 모델·UC 프리셋 "없음" 제외)
  if (ov.uc == null && S.autoNsfw !== false && !NSFW_EXEMPT.includes(m) && getUcText(m, ucIdx(m)) && !prompt.toLowerCase().includes('nsfw') && !/^nsfw\b/i.test(uc)) uc = uc ? 'nsfw, ' + uc : 'nsfw';
  const chars = (ov.chars || S.chars.filter(c => c.prompt.trim())).map(c => ({ ...c }));
  const useCoords = !S.aiChoice && chars.some(c => c.x != null);
  const w = ov.w || S.w, h = ov.h || S.h;
  const p = {
    params_version: 3, width: w, height: h,
    scale: S.scale, sampler: S.sampler, steps: S.steps, n_samples: ov.n || S.n || 1,
    ucPreset: (info.ucs[ucIdx()] || {}).id != null ? info.ucs[ucIdx()].id : 0, qualityToggle: S.quality, autoSmea: false,
    dynamic_thresholding: S.decrisper, controlnet_strength: 1, legacy: false, add_original_image: true,
    cfg_rescale: S.rescale, noise_schedule: S.schedule, legacy_v3_extend: false,
    skip_cfg_above_sigma: S.variety ? varietySigma(m, w, h) : null, use_coords: useCoords, seed,
    // NAI 웹이 항상 보내는 필드 (인페인트에서만 strength로 덮어씀)
    normalize_reference_strength_multiple: true, inpaintImg2ImgStrength: 1, image_format: 'png',
    characterPrompts: chars.map(c => ({
      prompt: expandAll(c.prompt.trim()), uc: expandAll((c.uc || '').trim()),
      center: { x: (useCoords && c.x != null) ? c.x : 0.5, y: (useCoords && c.y != null) ? c.y : 0.5 }, enabled: true,
    })),
    negative_prompt: uc, deliberate_euler_ancestral_bug: false, prefer_brownian: true,
  };
  const body = { input: prompt, model: m, action: 'generate', parameters: p };
  if (info.ver >= 40) {
    p.v4_prompt = { caption: { base_caption: prompt, char_captions: p.characterPrompts.map(c => ({ char_caption: c.prompt, centers: [c.center] })) }, use_coords: useCoords, use_order: true };
    p.v4_negative_prompt = { caption: { base_caption: uc, char_captions: p.characterPrompts.map(c => ({ char_caption: c.uc, centers: [c.center] })) } };
    // legacy_uc 는 NAI 웹이 보내지 않는다 → 켠 경우에만 명시적으로 추가
    if (S.legacyUc) { p.legacy_uc = true; p.v4_negative_prompt.legacy_uc = true; }
  } else {
    p.params_version = 1;
    p.sm = !!S.smea && S.sampler !== 'ddim_v3'; p.sm_dyn = !!S.smea && !!S.smeaDyn && S.sampler !== 'ddim_v3';
    p.uncond_scale = S.ucStrength;
    ['autoSmea', 'use_coords', 'characterPrompts', 'skip_cfg_above_sigma', 'deliberate_euler_ancestral_bug', 'prefer_brownian',
      'normalize_reference_strength_multiple', 'inpaintImg2ImgStrength', 'image_format'].forEach(k => delete p[k]);
    if (S.variety) p.skip_cfg_above_sigma = varietySigma(m, w, h);
  }
  return body;
}
async function attachImages(body, ov) {
  ov = ov || {};
  const p = body.parameters, info = MODELS[body.model];
  const srcBlob = ov.image || (ov.noRef ? null : R.i2iBlob);
  if (srcBlob) {
    p.image = await blobToB64Resized(srcBlob, p.width, p.height);
    const strength = ov.strength != null ? ov.strength : S.strength;
    p.noise = ov.noise != null ? ov.noise : S.noise;
    if (!ov.image && R.maskCanvas) {
      // 인페인트. 규격은 NAI 서버 스키마(image.novelai.net/docs/doc.json)와 웹 번들로 확인:
      //  · request_type / NativeInfillingRequest 는 NAI 에 존재하지 않는 필드다 (스키마 0회, 번들 0회).
      //    예전에 이걸 보내던 것이 마스크 영역이 뭉개지던 원인.
      //  · 강도를 1 이 아닌 값으로 주려면 top-level strength 가 아니라
      //    img2img:{strength, color_correct} 서브객체로 보내야 한다 (스키마: "used by inpaint").
      //  · inpaintImg2ImgStrength 는 t2i 포함 모든 요청에 늘 들어간다(실캡처 12/12, 기본 1).
      body.action = 'infill'; body.model = info.inpaint;
      p.mask = maskToB64(p.width, p.height);
      if (info.ver >= 40) {
        if (strength !== 1) {
          p.inpaintImg2ImgStrength = strength;
          p.img2img = { strength, color_correct: true };
        }
      } else p.strength = strength;
    } else {
      body.action = 'img2img';
      p.strength = strength;
      p.extra_noise_seed = Math.max(0, p.seed - 1); // 실캡처 확정: seed - 1
      p.color_correct = false;
    }
    if (info.ver < 40) { p.sm = false; p.sm_dyn = false; }
  }
  if (ov.noVibe) return body;
  // noRef 는 i2i 만 막는다. 씬 모드처럼 '메인 화면의 이미지 입력을 쓰지 않는' 경우에는
  // 바이브·정밀 레퍼런스도 함께 빠져야 한다. 안 그러면 씬 화면에서는 보이지도 지울 수도
  // 없는 바이브가 모든 씬 이미지에 계속 붙는다.
  const prefs = (!ov.noRef && info.ver >= 45) ? R.prefs.filter(v => v.b64) : [];
  // V4.5 전용인데 모델을 바꾼 경우 — 조용히 빠지지 않도록 알린다 (배지·비용 표시도 syncUI 에서 함께 정리)
  if (!ov.noRef && info.ver < 45 && R.prefs.some(v => v.b64)) toast('Precise Reference는 V4.5 전용이라 이번 생성에서는 제외했습니다');
  // 라이브러리에서 불러온 바이브는 원본 이미지(b64) 없이 인코딩(enc)만 있을 수 있다 — 그것도 포함해야 한다
  const vibes = ov.noRef ? [] : R.vibes.filter(v => v.b64 || (info.ver >= 40 && v.enc));
  if (prefs.length) { // Precise Reference (V4.5) — 바이브와 동시 사용 불가
    p.director_reference_images = prefs.map(v => v.b64);
    p.director_reference_descriptions = prefs.map(v => ({ caption: { base_caption: v.type, char_captions: [] }, legacy_uc: false }));
    p.director_reference_strength_values = prefs.map(v => v.strength);
    p.director_reference_secondary_strength_values = prefs.map(v => Math.round((1 - v.fidelity) * 100) / 100);
    p.director_reference_information_extracted = prefs.map(() => 1);
    if (vibes.length) toast('Precise Reference와 바이브 트랜스퍼는 동시에 쓸 수 없어 바이브는 제외했습니다');
    return body;
  }
  if (vibes.length) {
    if (info.ver >= 40) {
      await ensureVibes();
      // 원본 없는 라이브러리 바이브는 재인코딩이 불가하므로 현재 모델용 인코딩일 때만 쓴다
      const ready = R.vibes.filter(v => v.enc && (v.b64 || v.encModel === S.model));
      if (ready.length < R.vibes.filter(v => v.enc || v.b64).length) toast('현재 모델용 인코딩이 없는 바이브는 제외했습니다');
      if (ready.length) { p.reference_image_multiple = ready.map(v => v.enc); p.reference_strength_multiple = ready.map(v => v.strength); p.normalize_reference_strength_multiple = S.vibeNormalize; }
    } else {
      p.reference_image_multiple = vibes.map(v => v.b64); p.reference_information_extracted_multiple = vibes.map(v => v.ie); p.reference_strength_multiple = vibes.map(v => v.strength);
    }
  }
  return body;
}
async function ensureVibes() {
  for (const v of R.vibes) {
    if (!v.b64) continue;
    if (v.enc && v.encModel === S.model && v.encIe === v.ie) continue;
    const mdl = S.model, ie = v.ie;    // await 전에 캡처 — 인코딩 도중 모델/IE 를 바꾸면 캐시 키가 어긋난다
    v.state = '인코딩 중…'; v.stateCls = ''; renderVibes();
    try {
      const res = await apiFetch('/img/ai/encode-vibe', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ image: v.b64, model: mdl, information_extracted: ie }) });
      if (!res.ok) throw await apiError(res);
      const enc = bufToB64(await res.arrayBuffer());
      if (mdl !== S.model || ie !== v.ie) { v.state = '설정이 바뀌어 다시 인코딩 필요'; v.stateCls = ''; }  // 결과 폐기 → 다음 생성에서 재인코딩
      else { v.enc = enc; v.encModel = mdl; v.encIe = ie; v.state = '인코딩 완료'; v.stateCls = 'ok'; }
    } catch (e) { v.enc = null; v.state = '실패: ' + e.message; v.stateCls = 'err'; toast('바이브 인코딩 실패: ' + e.message, 'err'); }
    renderVibes();
  }
}
function metaOf(body, ov) {
  const p = { ...body.parameters };
  ['image', 'mask', 'reference_image_multiple', 'reference_strength_multiple', 'reference_information_extracted_multiple', 'normalize_reference_strength_multiple',
    'director_reference_images', 'director_reference_descriptions', 'director_reference_strength_values', 'director_reference_secondary_strength_values', 'director_reference_information_extracted'].forEach(k => delete p[k]);
  const m = { input: body.input, model: body.model, action: body.action, parameters: p };
  if (ov && ov.sceneId) { m.sceneId = ov.sceneId; m.sceneName = ov.sceneName || ''; }
  return m;
}

/* ─────────────── msgpack 디코더 (스트리밍 미리보기용 최소 구현) ─────────────── */
function msgpackDecode(u8) {
  let p = 0;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const str = n => { const s = new TextDecoder().decode(u8.subarray(p, p + n)); p += n; return s; };
  const bin = n => { const b = u8.subarray(p, p + n); p += n; return b; };
  function read() {
    const b = u8[p++];
    if (b <= 0x7f) return b;                       // positive fixint
    if (b >= 0xe0) return b - 256;                 // negative fixint
    if ((b & 0xf0) === 0x80) { const n = b & 0x0f, o = {}; for (let i = 0; i < n; i++) { const k = read(); o[k] = read(); } return o; }  // fixmap
    if ((b & 0xf0) === 0x90) { const n = b & 0x0f, a = []; for (let i = 0; i < n; i++) a.push(read()); return a; }                        // fixarray
    if ((b & 0xe0) === 0xa0) return str(b & 0x1f); // fixstr
    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: { const n = u8[p++]; return bin(n); }
      case 0xc5: { const n = dv.getUint16(p); p += 2; return bin(n); }
      case 0xc6: { const n = dv.getUint32(p); p += 4; return bin(n); }
      case 0xca: { const v = dv.getFloat32(p); p += 4; return v; }
      case 0xcb: { const v = dv.getFloat64(p); p += 8; return v; }
      case 0xcc: return u8[p++];
      case 0xcd: { const v = dv.getUint16(p); p += 2; return v; }
      case 0xce: { const v = dv.getUint32(p); p += 4; return v; }
      case 0xcf: { const v = Number(dv.getBigUint64(p)); p += 8; return v; }
      case 0xd0: { const v = dv.getInt8(p); p += 1; return v; }
      case 0xd1: { const v = dv.getInt16(p); p += 2; return v; }
      case 0xd2: { const v = dv.getInt32(p); p += 4; return v; }
      case 0xd3: { const v = Number(dv.getBigInt64(p)); p += 8; return v; }
      case 0xd9: { const n = u8[p++]; return str(n); }
      case 0xda: { const n = dv.getUint16(p); p += 2; return str(n); }
      case 0xdb: { const n = dv.getUint32(p); p += 4; return str(n); }
      case 0xdc: { const n = dv.getUint16(p); p += 2; const a = []; for (let i = 0; i < n; i++) a.push(read()); return a; }
      case 0xdd: { const n = dv.getUint32(p); p += 4; const a = []; for (let i = 0; i < n; i++) a.push(read()); return a; }
      case 0xde: { const n = dv.getUint16(p); p += 2; const o = {}; for (let i = 0; i < n; i++) { const k = read(); o[k] = read(); } return o; }
      case 0xdf: { const n = dv.getUint32(p); p += 4; const o = {}; for (let i = 0; i < n; i++) { const k = read(); o[k] = read(); } return o; }
      default: throw new Error('msgpack: 알 수 없는 타입 0x' + b.toString(16));
    }
  }
  return read();
}

/* ─────────────── Anlas 비용 계산 (NAI 웹 비용 함수 기준) ─────────────── */
function anlasEstimate(o) {
  const px = Math.max((o.width || 0) * (o.height || 0), 65536);
  const strength = o.strength == null ? 1 : o.strength;
  const base = Math.ceil(2.951823174884865e-6 * px + 5.753298233447344e-7 * px * (o.steps || 0));
  const perImage = Math.max(Math.ceil(base * strength), 2);
  const free = px <= 1048576 && (o.steps || 0) <= 28 && !!o.isOpus;
  // Opus 무료는 '한 장' 에만 걸린다. 예전엔 장수 전체를 0 으로 표시해서, 4장을 뽑아도
  // 비용이 0 으로 보이고 실제로는 Anlas 가 빠져나갔다.
  // 모르는 쪽으로 틀릴 때는 적게 표시하는 것보다 많게 표시하는 편이 낫다.
  const generation = free ? perImage * Math.max(0, (o.batch || 1) - 1) : perImage * (o.batch || 1);
  const charRef = (o.charRefCount || 0) * 5 * (o.batch || 1);   // 캐릭터 레퍼런스 장당 5
  const vibeEncoding = (o.unencodedVibes || 0) * 2;             // encode-vibe 1회 2 (캐시되면 0)
  return { perImage, generation, charRef, vibeEncoding, total: generation + charRef + vibeEncoding };
}
function directorToolCost(w, h, isOpus) {
  const px = w * h;
  if (isOpus && px <= 409600) return 0;
  if (px <= 262144) return 1; if (px <= 409600) return 2; if (px <= 524288) return 3; if (px <= 786432) return 5;
  return 7;
}

/* ─────────────── 생성 ─────────────── */
async function doGenerate(ov, label) {
  ov = ov || {}; label = label || '생성';   // 메인 생성 버튼은 인자 없이 부른다 — 여기서 정규화
  // 가드는 try 밖이라 아래 catch 가 못 잡는다 → 여기서 직접 알린다 (인핸스·변형이 조용히 죽던 문제)
  if (R.gen) { toast('이미 다른 생성이 진행 중입니다', 'err'); throw new Error('이미 다른 생성이 진행 중입니다'); }
  if (!hasToken()) { openSettings(); throw new Error('NAI API 토큰이 없습니다 — ⚙설정에서 저장하세요'); }
  R.gen = true;
  const cont = R.auto.on && $('#contGen').checked;   // 연속 모드에선 버튼이 '정지'라 비활성화하지 않음
  const btn = $('#btnGen'); btn.disabled = !cont; btn.classList.add('busy');
  $('#genStatus').textContent = label + ' 중…';
  const t0 = Date.now();
  try {
    const body = await attachImages(buildPayload(ov), ov);
    R.abort = new AbortController();
    let blobs;
    if (S.stream !== false && !ov.noStream) {
      blobs = await generateStreaming(body);   // 실시간 미리보기 (msgpack 스트림)
    } else {
      const res = await apiFetch('/img/ai/generate-image', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(body), signal: R.abort.signal });
      if (!res.ok) throw await apiError(res);
      blobs = await respImages(res);
    }
    if (!blobs.length) throw new Error('응답에 이미지가 없습니다');
    let item = null; const meta = metaOf(body, ov);
    for (let k = 0; k < blobs.length; k++) {
      // 배치(장수 2~4)는 장마다 meta 를 복제하고 시드를 보정 — 같은 객체 공유·같은 파일명으로 덮어쓰기 방지
      const m = blobs.length > 1 ? { ...meta, parameters: { ...meta.parameters, seed: (meta.parameters.seed || 0) + k }, batchIndex: k } : meta;
      item = await addToHistory(blobs[k], m, label + (blobs.length > 1 ? ` (${k + 1}/${blobs.length})` : ''));
      if (S.autoSaveOn) await autoSave(item);
    }
    if (window.onImageGenerated) window.onImageGenerated(item);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    if (typeof recordGenTime === 'function') recordGenTime(+sec, { ...body.parameters, __model: body.model });
    $('#genStatus').textContent = `완료 · ${sec}s · seed ${body.parameters.seed}` + (blobs.length > 1 ? ` · ${blobs.length}장` : '');
    $('#lastSeed').textContent = '최근 시드: ' + body.parameters.seed;
    refreshAnlas().catch(() => {});
    return item;
  } catch (e) {
    if (e.name === 'AbortError') { $('#genStatus').textContent = '취소됨'; hidePreview(); return null; }
    if (typeof recordGenFail === 'function') recordGenFail(e.message);
    $('#genStatus').textContent = '오류: ' + e.message; toast(e.message, 'err'); throw e;
  } finally { R.gen = false; R.abort = null; btn.disabled = false; btn.classList.remove('busy'); hidePreview(); $('#btnCancel').hidden = true; }
}

/* ─────────────── 스트리밍 생성 (실시간 미리보기) ─────────────── */
function showPreview(pngBytes, step, total, t0, sampIx, nSamp, sampStep) {
  const st = $('#vstage'); let img = $('#previewImg');
  if (!img) { img = document.createElement('img'); img.id = 'previewImg'; st.appendChild(img); }
  if (R._prevUrl) URL.revokeObjectURL(R._prevUrl);
  R._prevUrl = URL.createObjectURL(new Blob([pngBytes], { type: 'image/png' }));
  img.src = R._prevUrl; img.hidden = false;
  $('#viewerEmpty').hidden = true;
  let bar = $('#genBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'genBar'; bar.innerHTML = '<div class="gb-fill"></div><span class="gb-txt"></span>'; st.appendChild(bar); }
  bar.hidden = false;
  // step/total 은 배치 전체 기준(장수 2~4면 장이 넘어가도 이어서 찬다)
  const tot = total || S.steps;
  bar.querySelector('.gb-fill').style.width = Math.min(100, Math.round((step / tot) * 100)) + '%';
  // 남은 시간: 배치 전체 진행도로 계산해야 장이 바뀔 때 부풀지 않는다
  let eta = '';
  if (t0 && step > 0) {
    const left = Math.max(0, Math.round(((Date.now() - t0) / step) * (tot - step) / 1000));
    if (left > 0) eta = ` · 약 ${left}초 남음`;
  }
  const who = (nSamp > 1) ? `${sampIx}/${nSamp}장 ` : '';
  const st2 = sampStep != null ? sampStep : step, tot2 = (nSamp > 1) ? Math.round(tot / nSamp) : tot;
  bar.querySelector('.gb-txt').textContent = `${who}${st2}/${tot2}${eta}`;
}
function hidePreview() {
  const img = $('#previewImg'); if (img) img.hidden = true;
  const bar = $('#genBar'); if (bar) bar.hidden = true;
  if (R._prevUrl) { URL.revokeObjectURL(R._prevUrl); R._prevUrl = null; }
  if (!R.hist.length) $('#viewerEmpty').hidden = false;
}
async function generateStreaming(body) {
  const payload = { ...body, parameters: { ...body.parameters, stream: 'msgpack' } };
  const steps = payload.parameters.steps;
  const nS = payload.parameters.n_samples || 1;
  const total = steps * nS;             // 장수 2~4면 배치 전체 스텝 기준으로 진행바를 채운다
  const res = await apiFetch('/img/ai/generate-image-stream', {
    method: 'POST', headers: { ...authHeaders(true), Accept: 'application/x-msgpack' },
    body: JSON.stringify(payload), signal: R.abort && R.abort.signal,
  });
  if (!res.ok) throw await apiError(res);
  if (!res.body) throw new Error('스트리밍 응답 없음');
  $('#btnCancel').hidden = false;
  const reader = res.body.getReader();
  let buf = new Uint8Array(0); const finals = []; let finished = false;
  const t0 = Date.now();
  try {
    while (true) {
      if (R.abort && R.abort.signal.aborted) { await reader.cancel().catch(() => {}); throw new DOMException('Aborted', 'AbortError'); }
      const { done, value } = await reader.read();
      if (value && value.length) {
        const m = new Uint8Array(buf.length + value.length); m.set(buf); m.set(value, buf.length); buf = m;
        while (buf.length >= 4) {
          const len = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
          if (len <= 0 || len > 50000000) throw new Error('잘못된 스트림 길이: ' + len);
          if (buf.length < 4 + len) break;
          const msg = buf.slice(4, 4 + len); buf = buf.slice(4 + len);
          let d; try { d = msgpackDecode(msg); } catch (e) { logErr('msgpack: ' + e.message); continue; }
          if (d && (d.error || (d.message && !d.image))) throw new Error('NAI 스트림 오류: ' + (d.error || d.message));
          const ev = d && (d.event_type || d.event);
          if (ev === 'intermediate' && d.image) {
            // 몇 번째 장인지: samp_ix 가 오면 그걸 쓰고, 없으면 이미 완료된 final 개수로 대체
            const si = d.samp_ix != null ? d.samp_ix : finals.length;
            const st = d.step_ix != null ? d.step_ix : 0;
            showPreview(d.image, si * steps + st, total, t0, si + 1, nS, st);
          }
          else if (ev === 'final' && d.image) finals.push(new Blob([d.image], { type: 'image/png' }));
        }
      }
      if (done) { finished = true; break; }
    }
  } catch (e) {
    // 사용자가 취소한 건 그대로 올린다. 그 외의 연결 끊김은 이미 받은 최종 이미지가 있으면 살린다
    // (프록시가 도중에 끊겨도 완성된 장을 버리지 않도록)
    if (e.name === 'AbortError' || !finals.length) throw e;
    logErr('스트림 중단(받은 ' + finals.length + '장 사용): ' + e.message);
  } finally {
    // 중단·오류로 빠져나갈 땐 스트림을 닫아야 프록시 연결이 바로 정리된다
    if (!finished) { try { await reader.cancel(); } catch (e) {} }
    try { reader.releaseLock(); } catch (e) {}
  }
  if (!finals.length) throw new Error('스트림에서 최종 이미지를 받지 못했습니다');
  return finals;
}

/* ─────────────── 히스토리 / 뷰어 ─────────────── */
async function addToHistory(blob, meta, label) {
  const p = meta.parameters || {};
  const [w, h] = await blobSize(blob).catch(() => [p.width, p.height]);
  const item = { blob, meta, seed: p.seed, model: meta.model, w, h, fav: false, t: Date.now(), label: label || '', sceneId: meta.sceneId || null,
    name: `${meta.sceneName ? safeName(meta.sceneName) + '_' : 'nai_'}${ts()}_${p.seed != null ? p.seed : 'x'}_${uid()}.png` };
  try { item.id = await histPut({ blob, meta, seed: item.seed, model: item.model, w, h, fav: false, t: item.t, name: item.name, label: item.label, sceneId: item.sceneId }); }
  catch (e) { item.unsaved = true; logErr('히스토리 저장 실패: ' + e.message); toast('이미지를 브라우저 저장소에 못 넣었습니다 (공간 부족?) — 새로고침하면 사라집니다', 'err'); }
  item.url = URL.createObjectURL(blob);
  R.hist.push(item);
  await pruneHistory(); renderHist(); showImage(R.hist.length - 1);
  return item;
}
async function pruneHistory() {
  const MAX = 400;
  while (R.hist.length > MAX) {
    const idx = R.hist.findIndex(h => !h.fav); if (idx < 0) break;
    const [old] = R.hist.splice(idx, 1); URL.revokeObjectURL(old.url);
    if (typeof LIB !== 'undefined' && LIB.sel) LIB.sel.delete(old);
    if (old.id != null) histDel(old.id).catch(() => {});
    if (R.cur > idx) R.cur--;
  }
}
async function loadHistory() {
  try {
    const all = await histAll(); all.sort((a, b) => a.t - b.t);
    R.hist = all.map(r => ({ ...r, url: URL.createObjectURL(r.blob) }));
    renderHist(); if (R.hist.length) showImage(R.hist.length - 1);
  } catch (e) { console.warn('hist load fail', e); }
}
function visibleHist() { const idx = []; R.hist.forEach((h, i) => { if (!S.histFavOnly || h.fav) idx.push(i); }); return idx; }
function renderHist() {
  const g = $('#histGrid'); g.innerHTML = '';
  const idx = visibleHist();
  for (let k = idx.length - 1; k >= 0; k--) {
    const i = idx[k], it = R.hist[i];
    const d = document.createElement('div'); d.className = 'hitem' + (i === R.cur ? ' cur' : '') + (it.saved ? ' saved' : ''); d.dataset.i = i;
    const img = document.createElement('img'); img.src = it.url; img.loading = 'lazy'; img.title = (it.label ? it.label + ' · ' : '') + `seed ${it.seed}` + (it.saved ? ' · 💾 저장됨' : '');
    d.appendChild(img);
    if (it.fav) { const f = document.createElement('span'); f.className = 'fav'; f.textContent = '★'; d.appendChild(f); }
    if (it.saved) { const s = document.createElement('span'); s.className = 'svd'; s.textContent = '💾'; s.title = '저장됨'; d.appendChild(s); }
    d.onclick = () => showImage(i);
    g.appendChild(d);
  }
  $('#histCount').textContent = R.hist.length ? `(${idx.length}${S.histFavOnly ? '/' + R.hist.length : ''})` : '';
  $('#histFavOnly').style.color = S.histFavOnly ? 'var(--gold)' : '';
}
function showImage(i) {
  if (i < 0 || i >= R.hist.length) return;
  R.cur = i; const it = R.hist[i];
  $('#viewerImg').src = it.url; $('#viewerImg').hidden = false; $('#viewerEmpty').hidden = true;
  const p = (it.meta && it.meta.parameters) || {};
  $('#viewerMeta').innerHTML = '';
  const bits = [`${i + 1}/${R.hist.length}`, `${it.w}×${it.h}`, `seed ${it.seed}`, MODELS[it.model] ? MODELS[it.model].name.replace('NAI Diffusion ', '') : it.model, p.steps ? `${p.steps}st · g${p.scale}` : '', it.label];
  for (const b of bits) if (b) { const s = document.createElement('span'); s.textContent = b; $('#viewerMeta').appendChild(s); }
  $('#tFav').textContent = it.fav ? '★' : '☆'; $('#tFav').classList.toggle('on', !!it.fav);
  $('#tSeedV').textContent = it.seed != null ? String(it.seed).slice(0, 10) : '';
  paintSavedUI(it);
  if (it.saved) { const s = document.createElement('span'); s.textContent = '💾 저장됨'; s.style.color = 'var(--green)'; $('#viewerMeta').appendChild(s); }
  renderHist();
}
const curItem = () => (R.cur >= 0 && R.cur < R.hist.length) ? R.hist[R.cur] : null;
function stepImage(d) {
  const idx = visibleHist(); if (!idx.length) return;
  let k = idx.indexOf(R.cur); k = k < 0 ? idx.length - 1 : Math.max(0, Math.min(idx.length - 1, k + d));
  showImage(idx[k]);
}
function clearViewer() {
  $('#viewerImg').hidden = true; $('#viewerEmpty').hidden = false; $('#viewerMeta').textContent = ''; $('#tSeedV').textContent = '';
  // 툴바도 초기화 — 안 하면 이미지가 없는데 ★즐겨찾기·✔저장됨 표시가 남는다
  const f = $('#tFav'); if (f) { f.textContent = '☆'; f.classList.remove('on'); }
  if (typeof paintSavedUI === 'function') paintSavedUI(null);
}
function persistItem(it) { if (it.id != null) histPut({ id: it.id, blob: it.blob, meta: it.meta, seed: it.seed, model: it.model, w: it.w, h: it.h, fav: it.fav, t: it.t, name: it.name, label: it.label, sceneId: it.sceneId || null, saved: it.saved || null }).catch(() => {}); }
function markSaved(it, how, silent) { // 저장됨 표시 (히스토리 배지·뷰어 아이콘)
  it.saved = { t: Date.now(), how: how || 'save' }; persistItem(it);
  if (silent) return;
  if (R.hist[R.cur] === it) paintSavedUI(it);
  renderHist();
  // 라이브러리·씬 갤러리에도 💾 표시가 바로 뜨게 (예전엔 히스토리만 갱신돼 저장한 티가 안 났다)
  if (S.mode === 'library' && window.renderLibrary) window.renderLibrary();
  if (S.mode === 'scene' && window.renderScenes) window.renderScenes();
  if (window.onHistChanged) window.onHistChanged();
}
function paintSavedUI(it) {
  const b = $('#tSave'); if (!b) return;
  b.textContent = it && it.saved ? '✔' : '💾'; b.classList.toggle('on', !!(it && it.saved));
  b.title = it && it.saved ? '저장됨 (' + new Date(it.saved.t).toLocaleTimeString() + (it.saved.how === 'auto' ? ' · 자동 저장' : '') + ') — 다시 저장' : '저장';
}
async function toggleFav(item) {
  const it = item || curItem(); if (!it) return;
  it.fav = !it.fav; persistItem(it);
  if (R.cur >= 0 && R.hist[R.cur]) showImage(R.cur); else renderHist();
  if (window.onHistChanged) window.onHistChanged();
}
async function deleteItem(it, silent) {   // silent: 일괄 삭제용 — 화면 갱신을 건너뛰고 마지막에 한 번만 (대량 삭제 프리즈 방지)
  const i = R.hist.indexOf(it); if (i < 0) return;
  R.hist.splice(i, 1); URL.revokeObjectURL(it.url);
  if (typeof LIB !== 'undefined' && LIB.sel) LIB.sel.delete(it);
  if (it.id != null) histDel(it.id).catch(() => {});
  if (R.cur >= i) R.cur = Math.min(R.cur - (R.cur > i ? 1 : 0), R.hist.length - 1);
  if (silent) return;
  if (R.cur >= 0) showImage(R.cur); else { clearViewer(); renderHist(); }
  if (window.onHistChanged) window.onHistChanged();
}
function refreshAfterBulk() {   // 일괄 작업 후 한 번만 갱신
  if (R.cur >= 0 && R.hist[R.cur]) showImage(R.cur); else { clearViewer(); renderHist(); }
  if (window.onHistChanged) window.onHistChanged();
}
async function deleteCur() { const it = curItem(); if (it) deleteItem(it); }

/* ─────────────── 저장 ─────────────── */
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function writeToDir(blob, name, sub) {
  let perm = await R.dirHandle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') perm = await R.dirHandle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') throw new Error('폴더 권한 없음');
  let dir = R.dirHandle;
  if (sub) dir = await dir.getDirectoryHandle(safeName(sub) || 'scene', { create: true });
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable(); await w.write(blob); await w.close();
}
async function saveItem(item, strip, silent) {
  let blob = item.blob; if (strip) blob = await stripBlob(blob);
  const name = (strip ? 'clean_' : '') + item.name;
  if (R.dirHandle) { try { await writeToDir(blob, name, item.meta && item.meta.sceneName); if (!silent) toast((strip ? '메타데이터 제거 후 ' : '') + '저장됨: ' + name); markSaved(item, 'save', silent); return; } catch (e) { toast('폴더 저장 실패, 다운로드로 대체: ' + e.message, 'err'); } }
  if (strip && !silent) toast('메타데이터(청크+숨은 stealth) 제거 후 저장: ' + name);
  downloadBlob(blob, name); markSaved(item, 'save', silent);
}
async function bulkSave(items, strip) {   // 일괄 저장 — 진행 표시 + 마지막에 한 번만 갱신
  let n = 0;
  for (const it of items) { await saveItem(it, strip, true); n++; if (n % 5 === 0) $('#genStatus').textContent = `저장 중… ${n}/${items.length}`; }
  refreshAfterBulk(); $('#genStatus').textContent = ''; toast(`${n}장 저장됨`);
}
async function autoSave(item) {
  try {
    let blob = item.blob; if (S.stripOnSave) blob = await stripBlob(blob);
    const sub = item.meta && item.meta.sceneName ? item.meta.sceneName : null;
    // 폴더 쓰기가 실패해도(새로고침 뒤 권한이 'prompt' 로 돌아가는 경우가 흔하다)
    // 그냥 넘어가면 이미지가 디스크에 한 장도 안 남는다. 수동 저장처럼 다운로드로 대체한다.
    if (R.dirHandle) {
      try { await writeToDir(blob, item.name, sub); }
      catch (e) { toast('폴더 저장 실패 — 다운로드로 대체합니다'); downloadBlob(blob, item.name); }
    } else downloadBlob(blob, item.name);
    markSaved(item, 'auto');
  } catch (e) { toast('자동 저장 실패: ' + e.message, 'err'); }
}

/* ─────────────── 자동 짤뽑 ─────────────── */
function fixedSnapshotOv() { // "지금 조합 고정": 랜덤·청크를 지금 한 번만 뽑아 두고 시드만 바꿔 반복
  const b = buildPayload();
  const p = b.parameters;
  return { prompt: b.input, noQuality: true, uc: p.negative_prompt, style: null,
    chars: (p.characterPrompts || []).map(c => ({ prompt: c.prompt, uc: c.uc, x: p.use_coords ? c.center.x : null, y: p.use_coords ? c.center.y : null })) };
}
function setAutoUI(on) {
  $('#btnAutoStart').disabled = on; $('#btnAutoStop').disabled = !on;
  const b = $('#btnGen'); b.classList.toggle('stop', on && $('#contGen').checked);
  $('#btnGenLbl').textContent = on && $('#contGen').checked ? '정지' : ($('#contGen').checked ? '연속 생성' : '생성');
}
function startAuto() {
  // R.auto.on 은 "계속 돌아라" 신호일 뿐, 루프가 아직 살아있는지는 R.auto.running 으로 따로 본다.
  // (정지 직후 루프가 doGenerate 안에서 살아있는 동안 다시 누르면 루프가 두 개 돌던 문제)
  if (R.auto.on || R.auto.running) return;
  if (typeof SR !== 'undefined' && SR.on) { toast('씬 모드가 실행 중입니다 — 먼저 중지하세요', 'err'); return; }
  R.auto.on = true; resetSeqCounters(); setAutoUI(true); autoLoop();
}
function stopAuto() { R.auto.on = false; $('#autoProg').textContent = '정지 중… (현재 생성 완료 후)'; }
async function autoLoop() {
  R.auto.running = true;
  try { await autoLoopBody(); } finally { R.auto.running = false; }
}
async function autoLoopBody() {
  const total = S.autoCount; let errStreak = 0; R.auto.done = 0;
  const ov = S.autoMode === 'fixed' ? fixedSnapshotOv() : undefined;
  if (ov) toast('지금 조합을 고정하고 시드만 바꿔 뽑습니다');
  while (R.auto.on && (total === 0 || R.auto.done < total)) {
    $('#autoProg').textContent = `${R.auto.done}${total ? '/' + total : ''} 생성 중…`;
    try { await doGenerate(ov ? { ...ov } : undefined); R.auto.done++; errStreak = 0; }
    catch (e) {
      errStreak++; if (errStreak >= 5) { toast('오류 5연속 — 자동 짤뽑 중지', 'err'); break; }
      const msg = String(e.message || '');
      if (msg.includes('429')) await sleep(15000);
      else if (msg.includes('Anlas') || msg.includes('토큰')) { toast('중지: ' + msg, 'err'); break; }
      else if (msg.includes('서버')) await sleep(5000);
    }
    if (!R.auto.on) break;
    await sleep(S.autoDelay * 1000 + Math.random() * 800);
  }
  R.auto.on = false; setAutoUI(false);
  $('#autoProg').textContent = `종료 (${R.auto.done}장)`;
}

/* ─────────────── 캐릭터 프롬프트 (메인) ─────────────── */
const POS_LABELS = 'ABCDE';
function posName(c) { if (c.x == null) return '자동'; return POS_LABELS[Math.round((c.x - 0.1) / 0.2)] + (Math.round((c.y - 0.1) / 0.2) + 1); }
function renderChars() {
  const list = $('#charList'); list.innerHTML = '';
  S.chars.forEach((c, i) => list.appendChild(charCard(c, i, () => { S.chars.splice(i, 1); save(); renderChars(); }, () => save())));
  $('#aiChoiceBtn').classList.toggle('on', !!S.aiChoice);
  $('#aiChoiceBtn').textContent = S.aiChoice ? '✔ AI 자동 배치' : '☐ 좌표 지정 사용';
}
function charCard(c, i, onDel, onChange) { // 메인·씬 공용 카드
  const card = document.createElement('div'); card.className = 'char-card';
  card.innerHTML = `<div class="ch-top"><span class="ch-name">캐릭터 ${i + 1}</span>
      <select class="ch-lib" title="캐릭터 라이브러리에서 불러오기"><option value="">라이브러리…</option></select>
      <button class="btn xs pos">위치: ${posName(c)}</button><button class="btn xs ghost savelib" title="이 캐릭터를 라이브러리에 저장">저장</button><button class="ic del" title="삭제">✕</button></div>
    <textarea class="ac cprompt" rows="2" spellcheck="false" placeholder="캐릭터 프롬프트 (외모·의상 등)"></textarea>
    <div class="chunkbar mini"></div>
    <details class="sub"><summary>캐릭터 네거티브</summary><textarea class="ac cuc" rows="1" spellcheck="false"></textarea></details>`;
  const tp = card.querySelector('.cprompt'), tu = card.querySelector('.cuc'), lib = card.querySelector('.ch-lib');
  tp.value = c.prompt || ''; tu.value = c.uc || '';
  tp.id = tp.id || ('cta_' + uid());
  const cb = card.querySelector('.chunkbar'); cb.dataset.ta = tp.id; if (typeof renderChunkBar === 'function') renderChunkBar(cb);
  attachHighlight(tp);
  (S.characters || []).forEach(ch => { const o = document.createElement('option'); o.value = ch.id; o.textContent = ch.name; lib.appendChild(o); });
  lib.onchange = () => { const ch = S.characters.find(x => x.id === lib.value); if (ch) { c.prompt = ch.prompt; c.uc = ch.uc || ''; c.libId = ch.id; tp.value = c.prompt; tu.value = c.uc; onChange(); } lib.value = ''; };
  tp.addEventListener('input', () => { c.prompt = tp.value; onChange(); });
  tu.addEventListener('input', () => { c.uc = tu.value; onChange(); });
  card.querySelector('.del').onclick = onDel;
  card.querySelector('.pos').onclick = () => openPosPicker(c, () => { onChange(); card.querySelector('.pos').textContent = '위치: ' + posName(c); });
  card.querySelector('.savelib').onclick = () => { if (!c.prompt.trim()) { toast('프롬프트가 비었습니다', 'err'); return; } if (window.saveCharToLibrary) saveCharToLibrary(c); };
  return card;
}
function openPosPicker(c, after) {
  openModal('캐릭터 위치', body => {
    body.innerHTML = '<div class="hint">칸을 고르면 좌표 지정 · "자동"은 AI가 배치. (좌표를 쓰려면 위 "AI 자동 배치"를 꺼야 합니다)</div>';
    const auto = document.createElement('button'); auto.className = 'btn sm'; auto.textContent = 'AI 자동 배치'; auto.style.alignSelf = 'center';
    auto.onclick = () => { c.x = null; c.y = null; after(); closeModal(); };
    body.appendChild(auto);
    const grid = document.createElement('div'); grid.className = 'pos-grid';
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const b = document.createElement('button'); b.className = 'pos-cell';
      const x = 0.1 + col * 0.2, y = 0.1 + row * 0.2;
      b.textContent = POS_LABELS[col] + (row + 1);
      if (c.x != null && Math.abs(c.x - x) < .01 && Math.abs(c.y - y) < .01) b.classList.add('on');
      b.onclick = () => { c.x = x; c.y = y; S.aiChoice = false; renderChars(); after(); closeModal(); };
      grid.appendChild(b);
    }
    body.appendChild(grid);
  });
}

/* ─────────────── i2i / 마스크 / 바이브 / 정밀 레퍼런스 ─────────────── */
function setI2I(blob) { R.i2iBlob = blob; R.maskCanvas = null; updateI2IUI(); switchRefTab('i2i'); }
function clearI2I() { R.i2iBlob = null; R.maskCanvas = null; updateI2IUI(); }
function updateI2IUI() {
  const drop = $('#i2iDrop'), badge = $('#modeBadge');
  if (R.i2iBlob) { drop.style.backgroundImage = `url(${URL.createObjectURL(R.i2iBlob)})`; drop.classList.add('has'); badge.hidden = false; badge.textContent = R.maskCanvas ? '인페인트 모드' : 'img2img 모드'; }
  else { drop.style.backgroundImage = ''; drop.classList.remove('has'); badge.hidden = true; }
  $('#maskState').textContent = R.maskCanvas ? '마스크 있음 → 인페인트' : '';
  updateRefBadge();
}
function switchRefTab(t) {
  $$('.reftab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#panelI2i').hidden = t !== 'i2i'; $('#panelVibe').hidden = t !== 'vibe'; $('#panelPref').hidden = t !== 'pref';
}
function maskToB64(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  // 원본 이미지와 동일한 커버-크롭 변환을 써야 마스크 위치가 어긋나지 않음 (blobToB64Resized 와 동일)
  if (R.maskCanvas) {
    const mc = R.maskCanvas, r = Math.max(w / mc.width, h / mc.height);
    const dw = mc.width * r, dh = mc.height * r;
    x.drawImage(mc, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  // 이진화 + 8x8 격자 정렬.
  // 모델은 마스크를 1/8 해상도(latent)로 줄여서 쓴다. 브러시로 1px 단위로 칠한 경계를
  // 그대로 보내면 격자에 안 맞아 경계가 뭉개진다. NAI 웹도 1/8 로 줄였다가 되돌리고,
  // bedovyy 클라이언트도 ceil(w/64)*8 로 줄인 뒤 8배 확대한다 — 결과는 8x8 블록 양자화.
  const d = x.getImageData(0, 0, w, h);
  const px = d.data;
  const on = new Uint8Array(w * h);
  for (let i = 0, k = 0; i < px.length; i += 4, k++) {
    on[k] = (px[i] + px[i + 1] + px[i + 2]) / 3 > 20 ? 1 : 0;
  }
  for (let by = 0; by < h; by += 8) {
    for (let bx = 0; bx < w; bx += 8) {
      let any = 0;
      const ye = Math.min(by + 8, h), xe = Math.min(bx + 8, w);
      for (let y = by; y < ye && !any; y++) for (let xx = bx; xx < xe; xx++) if (on[y * w + xx]) { any = 1; break; }
      const v = any ? 255 : 0;
      for (let y = by; y < ye; y++) for (let xx = bx; xx < xe; xx++) {
        const i = (y * w + xx) * 4;
        px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
      }
    }
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
}
async function openMaskEditor() {
  if (!R.i2iBlob) { toast('먼저 i2i 이미지를 넣으세요', 'err'); return; }
  const img = await blobToImage(R.i2iBlob);
  openModal('인페인트 마스크 — 칠한 부분이 다시 그려집니다', body => {
    const ctl = document.createElement('div'); ctl.className = 'row';
    ctl.innerHTML = `<label class="hint">브러시 <input type="range" id="mBrush" min="5" max="140" value="44" style="width:130px"></label>
      <button class="btn sm" id="mErase">지우개: OFF</button><button class="btn sm danger" id="mClear">전체 지우기</button><button class="btn sm go" id="mSave">✔ 적용</button>`;
    body.appendChild(ctl);
    const wrap = document.createElement('div'); wrap.id = 'maskCanvasWrap';
    const scale = Math.min(1, 640 / img.width, (innerHeight * 0.6) / img.height);
    const cw = Math.round(img.width * scale), ch = Math.round(img.height * scale);
    const base = document.createElement('canvas'); base.width = cw; base.height = ch; base.getContext('2d').drawImage(img, 0, 0, cw, ch);
    const paint = document.createElement('canvas'); paint.id = 'maskPaint'; paint.width = cw; paint.height = ch;
    const px = paint.getContext('2d'); if (R.maskCanvas) px.drawImage(R.maskCanvas, 0, 0, cw, ch);
    wrap.appendChild(base); wrap.appendChild(paint); body.appendChild(wrap);
    let drawing = false, erase = false, last = null;
    const pos = e => { const r = paint.getBoundingClientRect(); return [(e.clientX - r.left) * (cw / r.width), (e.clientY - r.top) * (ch / r.height)]; };
    const stroke = (x, y) => {
      const size = +ctl.querySelector('#mBrush').value;
      px.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      px.strokeStyle = px.fillStyle = '#fff'; px.lineWidth = size; px.lineCap = 'round'; px.lineJoin = 'round';
      if (last) { px.beginPath(); px.moveTo(last[0], last[1]); px.lineTo(x, y); px.stroke(); } else { px.beginPath(); px.arc(x, y, size / 2, 0, Math.PI * 2); px.fill(); }
      last = [x, y];
    };
    paint.addEventListener('pointerdown', e => { drawing = true; last = null; paint.setPointerCapture(e.pointerId); stroke(...pos(e)); });
    paint.addEventListener('pointermove', e => { if (drawing) stroke(...pos(e)); });
    paint.addEventListener('pointerup', () => { drawing = false; last = null; });
    ctl.querySelector('#mErase').onclick = e => { erase = !erase; e.target.textContent = '지우개: ' + (erase ? 'ON' : 'OFF'); };
    ctl.querySelector('#mClear').onclick = () => px.clearRect(0, 0, cw, ch);
    ctl.querySelector('#mSave').onclick = () => { const blank = !px.getImageData(0, 0, cw, ch).data.some((v, i) => i % 4 === 3 && v > 0); R.maskCanvas = blank ? null : paint; updateI2IUI(); closeModal(); };
  });
}
function renderVibes() {
  const list = $('#vibeList'); list.innerHTML = '';
  R.vibes.forEach((v, i) => {
    const d = document.createElement('div'); d.className = 'vibe-slot';
    d.innerHTML = `<img class="vthumb"><div class="vctl">
      <label class="rng">Strength <output class="vs"></output><input type="range" class="rs" min="0.01" max="1" step="0.01"></label>
      <label class="rng">Info Extracted <output class="vi"></output><input type="range" class="ri" min="0.01" max="1" step="0.01"></label>
      <div class="row"><span class="vibe-state" style="flex:1"></span><button class="btn xs vlib" title="인코딩된 바이브를 라이브러리에 저장 (다음부터 Anlas 없이 재사용)">📚 저장</button></div></div><button class="ic" title="제거">✕</button>`;
    d.querySelector('.vthumb').src = v.thumb;
    const rs = d.querySelector('.rs'), ri = d.querySelector('.ri'); rs.value = v.strength; ri.value = v.ie;
    const upd = () => { d.querySelector('.vs').textContent = v.strength; d.querySelector('.vi').textContent = v.ie; }; upd();
    rs.oninput = () => { v.strength = +rs.value; upd(); }; ri.oninput = () => { v.ie = +ri.value; upd(); };
    const st = d.querySelector('.vibe-state'); st.textContent = v.state || (v.enc ? '인코딩 있음' : ''); st.className = 'vibe-state ' + (v.stateCls || '');
    d.querySelector('.vlib').onclick = () => saveVibeToLib(v);
    d.querySelector('button.ic').onclick = () => { R.vibes.splice(i, 1); renderVibes(); };
    list.appendChild(d);
  });
  $('#vibeN').textContent = R.vibes.length ? `(${R.vibes.length})` : '';
  updateRefBadge();
}
async function addVibe(blob) {
  if (R.vibes.length >= 4) { toast('바이브는 최대 4개', 'err'); return; }
  const b64 = await blobToB64(blob);
  // 여러 장을 한 번에 넣으면 위 검사는 전부 통과한 뒤에야 push 가 일어난다 → 넣기 직전에 다시 센다
  if (R.vibes.length >= 4) { toast('바이브는 최대 4개', 'err'); return; }
  R.vibes.push({ b64, thumb: URL.createObjectURL(blob), strength: 0.6, ie: 1, enc: null, state: '대기 (생성 시 인코딩)', stateCls: '' });
  renderVibes(); switchRefTab('vibe');
}
/* 바이브 라이브러리 — 인코딩 결과(모델·IE별)를 저장해 재사용 (인코딩 Anlas 절약) · .naiv4vibe 가져오기 */
async function vibeLibAll() { return (await idbGet('vibelib')) || []; }
async function vibeLibSave(list) { await idbSet('vibelib', list); }
/* 라이브러리는 '읽고 → 고치고 → 쓰기' 라, 여러 파일을 한 번에 넣으면 모두 같은 옛 목록을
   읽어가 마지막 하나만 남는다. 갱신은 한 줄로 세워서 처리한다. */
let _vibeLibQ = Promise.resolve();
function vibeLibUpdate(fn) {
  _vibeLibQ = _vibeLibQ.then(async () => {
    const cur = await vibeLibAll();
    const next = await fn(cur);
    if (next) await vibeLibSave(next);
    return next;
  }).catch(e => { logErr('바이브 라이브러리 저장 실패: ' + e.message); });
  return _vibeLibQ;
}
async function saveVibeToLib(v) {
  const name = prompt('바이브 이름', v.libName || ''); if (name == null) return;
  if (!v.enc && MODELS[S.model].ver >= 40) { toast('인코딩 중… (Anlas 소량)'); await ensureVibes(); if (!v.enc) { toast('인코딩 실패로 저장 못 함', 'err'); return; } }
  const lib = await vibeLibAll();
  let rec = lib.find(r => r.name === name);
  if (!rec) { rec = { id: uid(), name, thumb: null, image: v.b64, encodings: {} }; lib.push(rec); }
  const th = await makeThumb(v.b64, 96); rec.thumb = th || rec.thumb;
  if (v.enc) rec.encodings[S.model + '|' + v.ie] = v.enc;
  await vibeLibSave(lib); v.libName = name; toast('바이브 라이브러리에 저장: ' + name);
}
async function makeThumb(b64, size) {
  try { const img = await blobToImage(new Blob([b64ToU8(b64)], { type: 'image/png' })); const c = document.createElement('canvas'); const r = Math.max(size / img.width, size / img.height); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); } catch (e) { return null; }
}
function b64ToU8(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function openVibeLib() {
  const lib = await vibeLibAll();
  openModal('📚 바이브 라이브러리', body => {
    body.innerHTML = `<div class="hint">저장된 바이브는 같은 모델·Info Extracted 값이면 <b>다시 인코딩하지 않고</b>(Anlas 0) 바로 쓰입니다. NAI 웹에서 내보낸 <b>.naiv4vibe</b> 파일도 드롭해서 가져올 수 있습니다.</div>
      <div class="drop" id="vlDrop" style="width:100%;min-height:56px">.naiv4vibe / 이미지 드롭 → 라이브러리에 추가</div>
      <div id="vlGrid" class="vl-grid"></div>`;
    const grid = body.querySelector('#vlGrid');
    const draw = async () => {
      const cur = await vibeLibAll(); grid.innerHTML = '';
      if (!cur.length) grid.innerHTML = '<div class="hint">아직 저장된 바이브가 없습니다. 바이브 탭에서 "📚 저장"을 누르세요.</div>';
      cur.forEach(rec => {
        const d = document.createElement('div'); d.className = 'vl-item';
        const encs = Object.keys(rec.encodings || {});
        const has = encs.some(k => k.startsWith(S.model + '|'));
        d.innerHTML = `<img src="${rec.thumb || ''}"><div class="vl-name"></div><div class="hint">${encs.length}개 인코딩${has ? ' · 현재 모델 ✔' : ''}</div><div class="row"><button class="btn xs" data-a="use">사용</button><button class="btn xs ghost danger" data-a="del">✕</button></div>`;
        d.querySelector('.vl-name').textContent = rec.name;
        d.querySelector('[data-a="use"]').onclick = () => {
          if (R.vibes.length >= 4) { toast('바이브는 최대 4개', 'err'); return; }
          /* 저장된 인코딩의 키는 '모델|IE' 다. IE 를 1 로 고정하면 다른 IE 로 인코딩해 둔 것을
             못 찾아, 돈 주고 만든 인코딩을 두고 또 인코딩하게 된다.
             → 현재 모델로 저장된 것 중 하나를 골라 그 IE 를 쓴다. */
          const encs = rec.encodings || {};
          const mine = Object.keys(encs).filter(k => k.startsWith(S.model + '|'));
          const pick = mine.includes(S.model + '|1') ? S.model + '|1' : mine[0];
          const ie = pick ? +pick.split('|')[1] : 1;
          const enc = pick ? encs[pick] : null;
          const v = { b64: rec.image || null, thumb: rec.thumb, strength: 0.6, ie, enc, encModel: enc ? S.model : null, encIe: enc ? ie : null, state: enc ? '라이브러리 인코딩 사용 (Anlas 0)' : (rec.image ? '대기 (생성 시 인코딩)' : '이미지 없음 — 이 모델용 인코딩이 없어 사용 불가'), stateCls: enc ? 'ok' : (rec.image ? '' : 'err'), libName: rec.name };
          if (!enc && !rec.image) { toast('이 모델용 인코딩이 없고 원본 이미지도 없어 사용할 수 없습니다', 'err'); return; }
          R.vibes.push(v); renderVibes(); switchRefTab('vibe'); toast('바이브 추가: ' + rec.name); closeModal();
        };
        d.querySelector('[data-a="del"]').onclick = async () => { const l = await vibeLibAll(); await vibeLibSave(l.filter(x => x.id !== rec.id)); draw(); };
        grid.appendChild(d);
      });
    };
    draw();
    const drop = body.querySelector('#vlDrop');
    const handle = async f => {
      try {
        if (/\.naiv4vibe$|\.json$/i.test(f.name)) {
          const j = JSON.parse(await f.text());
          const lib = await vibeLibAll();
          const rec = { id: uid(), name: j.name || f.name.replace(/\.naiv4vibe$/i, ''), thumb: j.thumbnail ? (j.thumbnail.startsWith('data:') ? j.thumbnail : 'data:image/png;base64,' + j.thumbnail) : null, image: j.image || null, encodings: {} };
          // encodings: { modelKey: { hash: { encoding, params:{information_extracted} } } }
          const MK = { 'v4full': 'nai-diffusion-4-full', 'v4curated': 'nai-diffusion-4-curated-preview', 'v4-5full': 'nai-diffusion-4-5-full', 'v4-5curated': 'nai-diffusion-4-5-curated', 'v45full': 'nai-diffusion-4-5-full', 'v45curated': 'nai-diffusion-4-5-curated' };
          for (const [mk, obj] of Object.entries(j.encodings || {})) {
            const model = MK[mk] || Object.keys(MODELS).find(m => m.replace(/-/g, '').includes(mk.replace(/[-_]/g, ''))) || mk;
            for (const e of Object.values(obj || {})) { if (e && e.encoding) rec.encodings[model + '|' + ((e.params && e.params.information_extracted) || 1)] = e.encoding; }
          }
          if (!rec.thumb && rec.image) rec.thumb = await makeThumb(rec.image, 96);
          lib.push(rec); await vibeLibSave(lib); toast('가져옴: ' + rec.name + ' (인코딩 ' + Object.keys(rec.encodings).length + '개)'); draw();
        } else if (f.type.startsWith('image/')) {
          const b64 = await blobToB64(f); const lib = await vibeLibAll();
          lib.push({ id: uid(), name: f.name.replace(/\.[^.]+$/, ''), thumb: await makeThumb(b64, 96), image: b64, encodings: {} }); await vibeLibSave(lib); draw();
        }
      } catch (e) { toast('가져오기 실패: ' + e.message, 'err'); }
    };
    bindDrop(drop, handle, true); drop.onclick = () => pickFiles(true, handle, '.naiv4vibe,.json,image/*');
  }, true);
}
function renderPrefs() {
  const list = $('#prefList'); list.innerHTML = '';
  R.prefs.forEach((v, i) => {
    const d = document.createElement('div'); d.className = 'vibe-slot';
    d.innerHTML = `<img class="vthumb"><div class="vctl">
      <div class="seg pref-type"><button data-t="character">캐릭터</button><button data-t="character&style">캐릭터+스타일</button><button data-t="style">스타일</button></div>
      <label class="rng">Strength <output class="vs"></output><input type="range" class="rs" min="0" max="1" step="0.05"></label>
      <label class="rng">Fidelity <output class="vf"></output><input type="range" class="rf" min="0" max="1" step="0.05"></label>
      </div><button class="ic" title="제거">✕</button>`;
    d.querySelector('.vthumb').src = v.thumb;
    d.querySelectorAll('.pref-type button').forEach(b => { b.classList.toggle('on', b.dataset.t === v.type); b.onclick = () => { v.type = b.dataset.t; renderPrefs(); }; });
    const rs = d.querySelector('.rs'), rf = d.querySelector('.rf'); rs.value = v.strength; rf.value = v.fidelity;
    const upd = () => { d.querySelector('.vs').textContent = v.strength; d.querySelector('.vf').textContent = v.fidelity; }; upd();
    rs.oninput = () => { v.strength = +rs.value; upd(); }; rf.oninput = () => { v.fidelity = +rf.value; upd(); };
    d.querySelector('.ic').onclick = () => { R.prefs.splice(i, 1); renderPrefs(); };
    list.appendChild(d);
  });
  $('#prefN').textContent = R.prefs.length ? `(${R.prefs.length})` : '';
  updateRefBadge();
}
async function addPref(blob) {
  if (MODELS[S.model].ver < 45) { toast('Precise Reference는 V4.5 모델에서만 사용 가능합니다', 'err'); return; }
  if (R.prefs.length >= 4) { toast('레퍼런스는 최대 4개', 'err'); return; }
  const pb64 = await blobToB64Letterbox(blob);
  // await 사이에 다른 파일이 먼저 들어갔을 수 있다 → 넣기 직전에 다시 센다
  if (R.prefs.length >= 4) { toast('레퍼런스는 최대 4개', 'err'); return; }
  R.prefs.push({ b64: pb64, thumb: URL.createObjectURL(blob), type: 'character', strength: 1, fidelity: 0.75 });
  renderPrefs(); switchRefTab('pref');
}

/* ─────────────── 구조화 프롬프트 칸 (NAI 권장 순서: 캐릭터 → 행동 → 배경 → 스타일) ─────────────── */
function getMainPrompt() {
  if (S.singleBox) return (S.prompt || '').trim();
  return joinParts(...(S.sections || []).map(s => (S.secText || {})[s.id] || ''));
}
function syncPromptFromSections() { if (!S.singleBox) S.prompt = getMainPrompt(); }
function setPromptText(text) { // 불러오기(PNG/메타)용: 한 칸 모드면 그대로, 칸 모드면 "캐릭터" 칸(없으면 첫 칸)에 넣고 나머지 비움
  S.prompt = text || '';
  if (!S.singleBox && S.sections && S.sections.length) { S.secText = {}; const tgt = S.sections.find(s => s.id === 'char') || S.sections[0]; S.secText[tgt.id] = S.prompt; }
  renderSections();
}
function renderSections() {
  const list = $('#secList'); if (!list) return;
  const single = $('#prompt');
  const wrap = single.parentNode && single.parentNode.classList.contains('pwrap') ? single.parentNode : null;
  if (S.singleBox) { list.innerHTML = ''; single.hidden = false; if (wrap) wrap.hidden = false; single.value = S.prompt || ''; if (single._hlSync) single._hlSync(); return; }
  single.hidden = true; if (wrap) wrap.hidden = true;
  S.secText = S.secText || {};
  // 칸 구성이 그대로면 DOM 을 새로 만들지 않고 값만 갱신한다.
  // syncUI() 는 스텝·CFG·샘플러를 바꿀 때마다 불리는데, 그때마다 textarea 를 새로 만들면
  // R.lastTA / AC.ta 가 죽은 노드를 가리켜 태그·청크가 엉뚱한 칸(항상 1번 칸)에 삽입된다.
  const secs = S.sections || [];
  const sig = 'v1|' + secs.map(s => [s.id, s.name, s.hint || ''].join('')).join('');
  if (list._sig === sig && list.querySelectorAll('textarea.sec-ta').length === secs.length) {
    secs.forEach(sec => {
      const ta = list.querySelector('textarea.sec-ta[data-sec="' + CSS.escape(sec.id) + '"]');
      if (!ta) return;
      const v = S.secText[sec.id] || '';
      if (ta.value !== v) ta.value = v;
      if (ta._hlSync) ta._hlSync();
    });
    return;
  }
  // 실제로 다시 만들 때는 포커스가 있던 칸과 커서 위치를 새 노드로 옮겨준다
  const prevSec = R.lastTA && R.lastTA.dataset ? R.lastTA.dataset.sec : null;
  const prevS = R.lastTA ? R.lastTA.selectionStart : null, prevE = R.lastTA ? R.lastTA.selectionEnd : null;
  list.innerHTML = '';
  secs.forEach((sec, i) => {
    const d = document.createElement('div'); d.className = 'sec';
    d.innerHTML = `<div class="sec-h"><span class="sec-n">${i + 1}</span><span class="sec-name"></span><span class="sec-hint hint"></span><button class="ic xs sec-clr" title="이 칸 비우기">✕</button></div>
      <textarea class="ta ac sec-ta" rows="2" spellcheck="false"></textarea>`;
    d.querySelector('.sec-name').textContent = sec.name;
    d.querySelector('.sec-hint').textContent = sec.hint || '';
    const ta = d.querySelector('textarea'); ta.value = S.secText[sec.id] || ''; ta.placeholder = sec.hint || ''; ta.dataset.sec = sec.id;
    ta.addEventListener('input', () => { S.secText[sec.id] = ta.value; syncPromptFromSections(); save(); });
    d.querySelector('.sec-clr').onclick = () => { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); if (ta._hlSync) ta._hlSync(); };
    list.appendChild(d);
    attachHighlight(ta);
  });
  list._sig = sig;
  if (prevSec) {
    const nt = list.querySelector('textarea.sec-ta[data-sec="' + CSS.escape(prevSec) + '"]');
    if (nt) {
      R.lastTA = nt;
      if (prevS != null) { try { nt.setSelectionRange(prevS, prevE); } catch (e) {} }
      if (typeof AC !== 'undefined' && AC.ta && !document.contains(AC.ta)) AC.ta = nt;
    } else R.lastTA = null;
  }
}
function openSectionEditor() {
  openModal('프롬프트 칸 편집', body => {
    body.innerHTML = `<div class="hint">NAI가 잘 알아듣는 순서(중요 태그[퀄리티·작가·캐릭터] → 인원·외모 → 행동·포즈 → 배경 → 구도·스타일)로 칸을 나눠 두면 프롬프트가 깔끔해집니다. 칸은 위에서 아래 순서로 쉼표로 이어져 하나의 프롬프트가 됩니다. 이름·설명·순서를 자유롭게 바꾸고 추가/삭제하세요.</div>
      <label class="ck"><input type="checkbox" id="seSingle"> 칸 나누지 않고 한 칸으로 쓰기</label>
      <div id="seRows"></div>
      <div class="row"><button class="btn sm" id="seAdd">＋ 칸 추가</button><button class="btn sm" id="seReset">기본 5칸으로 복원</button><span class="hint">변경은 즉시 반영</span></div>`;
    const single = body.querySelector('#seSingle'); single.checked = !!S.singleBox;
    single.onchange = () => { if (single.checked && !S.singleBox) { S.prompt = getMainPrompt(); } else if (!single.checked && S.singleBox) { S.secText = {}; if (S.sections.length) S.secText[S.sections[0].id] = S.prompt; } S.singleBox = single.checked; save(); renderSections(); draw(); };
    const rows = body.querySelector('#seRows');
    const draw = () => {
      rows.innerHTML = ''; rows.hidden = !!S.singleBox;
      S.sections.forEach((sec, i) => {
        const d = document.createElement('div'); d.className = 'se-row';
        d.innerHTML = `<span class="sec-n">${i + 1}</span><input type="text" class="se-name" placeholder="칸 이름"><input type="text" class="se-hint" placeholder="설명/예시 (placeholder)"><button class="ic" data-a="up" title="위로">↑</button><button class="ic" data-a="dn" title="아래로">↓</button><button class="ic danger" data-a="del" title="삭제">✕</button>`;
        const n = d.querySelector('.se-name'), h = d.querySelector('.se-hint'); n.value = sec.name; h.value = sec.hint || '';
        n.oninput = () => { sec.name = n.value; save(); renderSections(); }; h.oninput = () => { sec.hint = h.value; save(); renderSections(); };
        d.querySelector('[data-a="up"]').onclick = () => { if (i > 0) { S.sections.splice(i - 1, 0, S.sections.splice(i, 1)[0]); syncPromptFromSections(); save(); renderSections(); draw(); } };
        d.querySelector('[data-a="dn"]').onclick = () => { if (i < S.sections.length - 1) { S.sections.splice(i + 1, 0, S.sections.splice(i, 1)[0]); syncPromptFromSections(); save(); renderSections(); draw(); } };
        d.querySelector('[data-a="del"]').onclick = () => { if (S.sections.length <= 1) { toast('칸은 최소 1개', 'err'); return; } delete S.secText[sec.id]; S.sections.splice(i, 1); syncPromptFromSections(); save(); renderSections(); draw(); };
        rows.appendChild(d);
      });
    };
    draw();
    body.querySelector('#seAdd').onclick = () => { S.sections.push({ id: uid(), name: '새 칸', hint: '' }); save(); renderSections(); draw(); };
    body.querySelector('#seReset').onclick = () => {
      const cur = getMainPrompt();   // 현재 내용 보존 (한 칸 모드에서 날아가던 문제)
      S.sections = JSON.parse(JSON.stringify(DEFAULTS.sections)); S.singleBox = false; single.checked = false;
      S.secText = {}; if (cur) S.secText[S.sections[0].id] = cur;
      S.prompt = cur; save(); renderSections(); draw();
    };
  }, true);
}

/* ─────────────── 프롬프트 하이라이트 (청크 = 칩, <a|b> = 랜덤 표시) ───────────────
   textarea 뒤에 같은 서체의 미러 레이어를 깔아 토큰을 색칠합니다. 입력은 그대로 textarea. */
const escHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function hlHtml(text) {
  let out = '';
  const re = /(<[^<>\n]*\|[^<>\n]*>)|([^,\n{}\[\]<>|]+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    out += escHtml(text.slice(last, m.index));
    if (m[1]) out += '<mark class="hl-wild">' + escHtml(m[1]) + '</mark>';
    else {
      const seg = m[2], lead = seg.match(/^\s*/)[0], trail = seg.match(/\s*$/)[0];
      const core = seg.slice(lead.length, seg.length - trail.length);
      if (core && isChunkToken(core)) out += escHtml(lead) + '<mark class="hl-chunk" style="--cc:' + chunkColorOf(core) + '">' + escHtml(core) + '</mark>' + escHtml(trail);
      else out += escHtml(seg);
    }
    last = m.index + m[0].length;
  }
  return out + escHtml(text.slice(last)) + '\n';
}
function chunkColorOf(tok) {
  const t = normKey(tok.replace(/^-?[\d.]+::/, '').replace(/::$/, '').replace(/^@/, ''));
  const c = S.chunks.find(x => normKey(x.name) === t);
  return (typeof catColor === 'function' && c) ? catColor(c.cat) : 'var(--acc)';
}
function attachHighlight(ta) {
  if (!ta || ta.dataset.hl) return;
  ta.dataset.hl = '1';
  const wrap = document.createElement('div'); wrap.className = 'pwrap';
  ta.parentNode.insertBefore(wrap, ta);
  const hl = document.createElement('div'); hl.className = 'phl' + (ta.classList.contains('big') ? ' big' : ''); hl.setAttribute('aria-hidden', 'true');
  wrap.appendChild(hl); wrap.appendChild(ta);
  const sync = () => { hl.innerHTML = hlHtml(ta.value); hl.scrollTop = ta.scrollTop; hl.style.height = ta.offsetHeight + 'px'; };
  ta.addEventListener('input', sync); ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; });
  new ResizeObserver(sync).observe(ta);
  ta._hlSync = sync; sync();
}
function refreshHighlights() { $$('textarea[data-hl]').forEach(t => t._hlSync && t._hlSync()); }

/* ─────────────── 모달 / 파일 ─────────────── */
function openModal(title, build, wide, onClose) {
  if (R._modalClose) { const f = R._modalClose; R._modalClose = null; try { f(); } catch (e) {} }
  $('#modalTitle').textContent = title; $('#modal').classList.toggle('wide', !!wide);
  const body = $('#modalBody'); body.innerHTML = ''; build(body); $('#modalOverlay').hidden = false;
  R._modalClose = onClose || null;
}
function closeModal() { $('#modalOverlay').hidden = true; const f = R._modalClose; R._modalClose = null; if (f) { try { f(); } catch (e) {} } }
function pickFiles(multi, cb, accept) {
  const inp = document.createElement('input'); inp.type = 'file'; if (multi) inp.multiple = true; inp.accept = accept || 'image/*';
  inp.onchange = () => { [...inp.files].forEach(f => cb(f)); }; inp.click();
}
function bindDrop(el, cb, multi) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('over');
    const fs = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/') || /\.(png|json|zip|naiv4vibe)$/i.test(f.name));
    (multi ? fs : fs.slice(0, 1)).forEach(f => cb(f));
  });
}

/* ─────────────── 테마 / 모드 ─────────────── */
function applyTheme() {
  if (!THEMES[S.theme]) S.theme = 'violet';
  document.documentElement.dataset.theme = S.theme;
  const dark = isDarkTheme(S.theme);
  if (dark) S.lastDark = S.theme; else S.lastLight = S.theme;
  const b = $('#btnTheme'); if (b) { b.textContent = dark ? '☀' : '🌙'; b.title = (dark ? '라이트 모드로' : '다크 모드로') + ' (현재: ' + THEMES[S.theme].name + ')'; }
}
function toggleTheme() { S.theme = isDarkTheme(S.theme) ? (S.lastLight || 'light') : (S.lastDark || 'violet'); applyTheme(); save(); }
function setMode(m) {
  S.mode = m; save();
  $$('.nav-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === m));
  $('#left').hidden = $('#center').hidden = m !== 'main';
  $('#right').hidden = m === 'library';
  $('#sceneView').hidden = m !== 'scene'; $('#libView').hidden = m !== 'library';
  const tv = $('#toolView'); if (tv) tv.hidden = m !== 'tools';
  $('#right').hidden = (m === 'library' || m === 'tools');
  document.body.dataset.mode = m;
  if (m === 'scene' && window.renderScenes) renderScenes();
  if (m === 'library' && window.renderLibrary) renderLibrary();
  if (m === 'tools' && window.renderSmartTools) renderSmartTools();
}

/* ─────────────── 설정 ─────────────── */
async function saveTokenToServer(tok) {
  const res = await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tok }) });
  if (!res.ok) throw new Error('서버 저장 실패 ' + res.status);
  const j = await res.json(); R.srvToken = !!j.hasToken; R.srvTokenHint = j.tokenHint || '';
  return j;
}
function openSettings() {
  openModal('설정', body => {
    body.innerHTML = `
      <div class="mtitle">NovelAI API 토큰</div>
      <input type="password" id="mTok" placeholder="pst-… (Persistent API Token) — 붙여넣기" autocomplete="off">
      <div class="hint">novelai.net → Settings → Account → <b>Get Persistent API Token</b>. 토큰은 <b>로컬 서버 파일(data/config.json)</b>에 저장되어 브라우저·시크릿모드·쿠키 삭제와 무관하게 유지됩니다.</div>
      <div class="row"><button class="btn primary sm" id="mTokSave">토큰 저장 + 연결 테스트</button><button class="btn sm danger" id="mTokDel">토큰 삭제</button><span class="hint" id="mTokState"></span></div>
      <div class="hint" id="mDiag"></div>
      <hr>
      <div class="mtitle">업데이트 <span class="hint">(GitHub 릴리스에서 새 버전 확인)</span></div>
      <input type="text" id="mUpd" placeholder="사용자명/저장소  예: myname/NAI-Studio" autocomplete="off">
      <div class="hint">지정한 저장소의 최신 릴리스를 6시간마다 확인하고, 새 버전이 있으면 상단에 ⬆ 버튼이 뜹니다.</div>
      <div class="row"><button class="btn primary sm" id="mUpdSave">저장</button><button class="btn sm" id="mUpdNow">지금 확인</button><span class="hint" id="mUpdState"></span></div>
      <hr>
      <div class="mtitle">Gemini API 키 <span class="hint">(✨ AI 프롬프트 생성용 · 선택)</span></div>
      <input type="password" id="mGem" placeholder="AIza… — Google AI Studio 에서 발급" autocomplete="off">
      <div class="hint">aistudio.google.com/apikey 에서 무료로 발급받습니다. 키도 <b>서버 파일에만</b> 저장되고 브라우저로 내려오지 않습니다.</div>
      <div class="row"><button class="btn primary sm" id="mGemSave">키 저장</button><button class="btn sm danger" id="mGemDel">삭제</button><span class="hint" id="mGemState"></span></div>
      <hr>
      <div class="mtitle">테마 (상단 ☀/🌙 = 다크↔라이트 빠른 전환)</div>
      <div class="theme-grid" id="mThemes"></div>
      <hr>
      <div class="mtitle">태그 삽입</div>
      <label class="ck"><input type="checkbox" id="mUnderscore"> 태그를 언더스코어(_) 그대로 삽입 (기본: 공백 변환 — NAI 권장)</label>
      <label class="ck"><input type="checkbox" id="mShowChunks"> 청크 칩을 프롬프트 아래에 항상 표시 (기본: 칸에 커서가 있을 때만 떠서 보임)</label>
      <hr>
      <div class="mtitle">NAI 웹과 동일하게 재현하기</div>
      <div class="hint">NAI 웹에서 만든 PNG를 아래에 드롭하면 프롬프트·시드·스텝·가이던스·UC 프리셋·Variety 등이 <b>전부 그대로</b> 복원됩니다. 그 상태로 생성하면 NAI 웹과 같은 결과가 나와야 정상입니다 (다르면 알려주세요).</div>
      <div class="drop" id="mPngDrop" style="width:100%;min-height:64px">NAI PNG 드롭 → 설정 복원</div>
      <hr>
      <div class="mtitle">백업 / 복원</div>
      <div class="row"><button class="btn primary sm" id="mBackup">📦 전체 백업 · 복원 (설정 + 이미지, ZIP)</button><button class="btn sm" id="mExport">설정만 내보내기 (JSON)</button><button class="btn sm" id="mImport">설정 JSON 가져오기</button></div>`;
    const tok = body.querySelector('#mTok'); tok.value = getToken();
    const st = body.querySelector('#mTokState'), diag = body.querySelector('#mDiag');
    const showDiag = () => {
      const errs = ERRLOG.slice(-6).reverse().map(e => `<div>· ${e.t} ${escHtml(e.msg)}</div>`).join('');
      diag.innerHTML = `<b>진단</b> — 브라우저: ${escHtml(navigator.userAgent.match(/(Firefox|Edg|Chrome)\/[\d.]+/) ? navigator.userAgent.match(/(Firefox|Edg|Chrome)\/[\d.]+/)[0] : '?')} · 주소: ${escHtml(location.href.split('?')[0])}<br>
        서버: <b>${R.srvOk ? '연결됨 ' + (R.api || location.origin) : '연결 안 됨'}</b> · 서버 저장 토큰: <b>${R.srvToken ? '있음 ' + (R.srvTokenHint || '') : '없음'}</b> · 브라우저 토큰: <b>${getToken() ? '있음' : '없음'}</b>${R.lastErr ? ' · 마지막 API 오류: <b>' + escHtml(R.lastErr) + '</b>' : ''}
        ${errs ? '<div class="errlog"><b>최근 오류</b>' + errs + '<button class="btn xs" id="mCopyErr">오류 로그 복사</button></div>' : ''}`;
      const cb = diag.querySelector('#mCopyErr');
      if (cb) cb.onclick = () => navigator.clipboard.writeText(ERRLOG.map(e => e.t + ' ' + e.msg).join('\n') + '\n' + navigator.userAgent + '\n' + location.href).then(() => toast('복사됨 — 붙여넣어 주세요'));
    };
    showDiag();
    const updSt = body.querySelector('#mUpdState');
    body.querySelector('#mUpd').value = (R.srvInfo && R.srvInfo.updateRepo) || '';
    if (R.srvInfo && R.srvInfo.release) updSt.textContent = '현재 v' + R.srvInfo.release;
    body.querySelector('#mUpdSave').onclick = async () => {
      const v = body.querySelector('#mUpd').value.trim();
      try {
        await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updateRepo: v }) });
        R.srvInfo = { ...(R.srvInfo || {}), updateRepo: v };
        updSt.textContent = '저장됨'; toast('업데이트 저장소를 저장했습니다');
      } catch (e) { updSt.textContent = '실패: ' + e.message; }
    };
    body.querySelector('#mUpdNow').onclick = async () => {
      updSt.textContent = '확인 중…';
      const j = typeof updateCheck === 'function' ? await updateCheck(false) : null;
      updSt.textContent = !j ? '확인 실패' : (!j.configured ? (j.error || '저장소를 먼저 지정하세요') : (j.available ? '새 버전 ' + j.latest : '최신입니다'));
    };
    const gemSt = body.querySelector('#mGemState');
    if (R.srvInfo && R.srvInfo.hasGemini) gemSt.textContent = '저장됨';
    body.querySelector('#mGemSave').onclick = async () => {
      const k = body.querySelector('#mGem').value.trim();
      if (!k) { gemSt.textContent = '키를 입력하세요'; return; }
      try {
        const r = await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geminiKey: k }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        R.srvInfo = { ...(R.srvInfo || {}), hasGemini: true };
        gemSt.textContent = '저장됨'; body.querySelector('#mGem').value = ''; toast('Gemini 키 저장');
      } catch (e) { gemSt.textContent = '실패: ' + e.message; }
    };
    body.querySelector('#mGemDel').onclick = async () => {
      try { await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geminiKey: '' }) });
        R.srvInfo = { ...(R.srvInfo || {}), hasGemini: false }; gemSt.textContent = '삭제됨'; toast('Gemini 키 삭제'); } catch (e) {}
    };
    body.querySelector('#mTokSave').onclick = async () => {
      const v = tok.value.trim();
      if (!v) { st.textContent = '토큰을 붙여넣으세요'; return; }
      st.textContent = '저장 중…';
      try {
        await saveTokenToServer(v);
        localStorage.removeItem('nst_token'); tok.value = '';
        st.textContent = '서버에 저장됨 · 연결 확인 중…';
        const n = await refreshAnlas();
        st.textContent = `✔ 연결 성공 · Anlas ${n.toLocaleString()}`;
      } catch (e) {
        if (!R.srvToken) { localStorage.setItem('nst_token', v); }
        try { const n = await refreshAnlas(); st.textContent = `✔ (브라우저 저장) 연결 성공 · Anlas ${n.toLocaleString()}`; }
        catch (e2) { st.textContent = '✖ ' + e2.message; }
      }
      showDiag();
    };
    body.querySelector('#mTokDel').onclick = async () => { localStorage.removeItem('nst_token'); try { await saveTokenToServer(''); } catch (e) {} tok.value = ''; updateAnlasLabel(); st.textContent = '토큰 삭제됨'; showDiag(); };
    const tg = body.querySelector('#mThemes');
    for (const [id, t] of Object.entries(THEMES)) {
      const d = document.createElement('div'); d.className = 'theme-sw' + (id === S.theme ? ' on' : '');
      d.style.background = t.sw[0]; d.style.color = t.sw[1]; d.textContent = (t.dark ? '🌙 ' : '☀ ') + t.name;
      d.onclick = () => { S.theme = id; applyTheme(); save(); tg.querySelectorAll('.theme-sw').forEach(x => x.classList.toggle('on', x === d)); };
      tg.appendChild(d);
    }
    const us = body.querySelector('#mUnderscore'); us.checked = !!S.tagUnderscore; us.onchange = () => { S.tagUnderscore = us.checked; save(); };
    const sc = body.querySelector('#mShowChunks'); sc.checked = !!S.showChunkBars; sc.onchange = () => { S.showChunkBars = sc.checked; document.body.classList.toggle('show-chunks', sc.checked); save(); };
    body.querySelector('#mBackup').onclick = () => openBackup();
    body.querySelector('#mExport').onclick = () => downloadBlob(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), 'nai-studio-settings.json');
    body.querySelector('#mImport').onclick = () => pickFiles(false, async f => {
      try { S = { ...DEFAULTS, ...JSON.parse(await f.text()) }; save(); syncUI(); renderChars(); if (window.renderChunkBar) renderChunkBar(); applyTheme(); toast('설정을 가져왔습니다'); closeModal(); }
      catch (e) { toast('설정 파일이 아닙니다', 'err'); }
    }, '.json');
    const pd = body.querySelector('#mPngDrop'); bindDrop(pd, f => importFromPng(f)); pd.onclick = () => pickFiles(false, f => importFromPng(f), 'image/png');
  });
}

/* ─────────────── UI 동기화 ─────────────── */
function syncUI() {
  $('#model').value = S.model; rebuildUcPresets();
  $('#w').value = S.w; $('#h').value = S.h; syncSizePreset();
  $$('#batchSeg button').forEach(b => b.classList.toggle('on', +b.dataset.n === S.n));
  const setR = k => { $('#' + k).value = S[k]; $('#' + k + 'V').textContent = S[k]; };
  ['steps', 'scale', 'rescale', 'strength', 'noise', 'enhStr', 'enhNoise', 'varStr', 'varNoise', 'ucStrength'].forEach(setR);
  $('#enhScale').value = S.enhScale; $('#sampler').value = S.sampler; $('#schedule').value = S.schedule;
  $('#seed').value = S.seed; $('#randomSeed').checked = S.randomSeed;
  ['quality', 'variety', 'decrisper', 'smea', 'smeaDyn', 'legacyUc', 'vibeNormalize', 'autoSaveOn', 'stripOnSave', 'slashWild'].forEach(k => { $('#' + k).checked = !!S[k]; });
  $('#autoNsfw').checked = S.autoNsfw !== false;
  $('#prompt').value = S.prompt; $('#uc').value = S.uc;
  renderSections();
  $('#autoCount').value = S.autoCount; $('#autoDelay').value = S.autoDelay;
  $$('#autoModeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === (S.autoMode || 'random')));
  $('#autoModeHint').textContent = S.autoMode === 'fixed' ? '지금 조합(랜덤·청크 치환 결과)을 고정하고 시드만 바꿔 뽑습니다' : '<a|b|c>·청크가 매번 새로 뽑힙니다';
  $('#v3Box').hidden = isV4(); $('#v4Box').hidden = !isV4();
  $('#smeaDyn').disabled = !S.smea;
  $('#modelKind').textContent = MODELS[S.model].kind;
  $('#sampSum').textContent = `${S.steps}st · g${S.scale}${S.rescale ? ' · r' + S.rescale : ''} · ${(SAMPLERS.find(s => s[0] === S.sampler) || [])[1] || S.sampler}`;
  const uName = (MODELS[S.model].ucs[ucIdx()] || {}).name || '';
  $('#optSum').textContent = [S.quality ? '퀄리티' : '', 'UC ' + uName, S.variety ? 'Variety+' : '', S.decrisper ? 'Decrisper' : ''].filter(Boolean).join(' · ');
  syncAdvanced(); updateCostHint(); updateRefBadge();
  if (typeof renderStyleSelects === 'function') renderStyleSelects();
  // 코드로 value 를 바꾼 textarea 들은 input 이벤트가 안 나므로 하이라이트 미러를 직접 다시 그린다
  if (typeof refreshHighlights === 'function') refreshHighlights();
}
function updateRefBadge() {
  const b = $('#refBadge'); if (!b) return;
  const prefOk = MODELS[S.model].ver >= 45;   // Precise Reference 는 V4.5 전용 — 아니면 실제로 안 나가니 배지도 그렇게 표시
  const parts = [R.i2iBlob ? (R.maskCanvas ? '인페인트' : 'i2i') : '', R.vibes.length ? '바이브 ' + R.vibes.length : '',
    R.prefs.length ? '레퍼런스 ' + R.prefs.length + (prefOk ? '' : ' (V4.5 전용·미적용)') : ''].filter(Boolean);
  b.textContent = parts.join(' · ');
  renderAttachBar();
}
/* 붙어 있는 이미지 입력을 생성 버튼 옆에서 바로 떼는 줄.
   칩 본문을 누르면 해당 패널이 열리고, ✕ 를 누르면 그 자리에서 떨어진다. */
function renderAttachBar() {
  const bar = $('#attachBar'); if (!bar) return;
  const prefOk = MODELS[S.model].ver >= 45;
  const chips = [];
  if (R.i2iBlob && R.maskCanvas) chips.push({ ico: '🖌', txt: '인페인트 마스크', tip: '마스크만 떼기 — 이미지는 남아서 일반 i2i 가 됩니다',
    tab: 'i2i', off: () => { R.maskCanvas = null; updateI2IUI(); toast('마스크를 뗐습니다 — 이제 일반 i2i 입니다'); } });
  if (R.i2iBlob) chips.push({ ico: '🖼', txt: R.maskCanvas ? '원본 이미지' : 'i2i 이미지', tip: '이미지 입력을 완전히 떼기 (t2i 로 돌아감)',
    tab: 'i2i', off: () => { clearI2I(); toast('이미지 입력을 뗐습니다 — 일반 생성(t2i)'); } });
  if (R.vibes.length) chips.push({ ico: '🎨', txt: `바이브 ${R.vibes.length}`, tip: '바이브 트랜스퍼 전부 떼기',
    tab: 'vibe', off: () => { R.vibes = []; renderVibes(); toast('바이브를 전부 뗐습니다'); } });
  if (R.prefs.length) chips.push({ ico: '📐', txt: `레퍼런스 ${R.prefs.length}${prefOk ? '' : ' (V4.5 전용·미적용)'}`, tip: 'Precise Reference 전부 떼기',
    tab: 'pref', off: () => { R.prefs = []; renderPrefs(); toast('레퍼런스를 전부 뗐습니다'); } });

  bar.hidden = !chips.length;
  bar.innerHTML = '';
  if (!chips.length) return;
  bar.appendChild(Object.assign(document.createElement('span'), { className: 'hint', textContent: '붙은 이미지' }));
  for (const c of chips) {
    const el = document.createElement('span'); el.className = 'achip'; el.title = c.tip;
    el.innerHTML = `<b></b><i></i><button class="x" title="떼기">✕</button>`;
    el.querySelector('b').textContent = c.ico;
    el.querySelector('i').textContent = c.txt;
    el.onclick = e => { if (e.target.closest('.x')) return; openRefPanel(c.tab); };
    el.querySelector('.x').onclick = e => { e.stopPropagation(); c.off(); };
    bar.appendChild(el);
  }
  if (chips.length > 1) {
    const all = document.createElement('button'); all.className = 'btn xs danger'; all.textContent = '전부 떼기';
    all.title = '붙어 있는 이미지 입력을 모두 떼고 일반 생성으로 돌아갑니다';
    all.onclick = () => { clearI2I(); R.vibes = []; renderVibes(); R.prefs = []; renderPrefs(); toast('붙은 이미지를 전부 뗐습니다'); };
    bar.appendChild(all);
  }
}
function openRefPanel(tab) {   // '이미지 입력' 카드를 펼치고 해당 탭으로 (칩에서 바로 이동)
  const card = $('#refBadge') && $('#refBadge').closest('details');
  if (card) { card.open = true; card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  switchRefTab(tab);
}
function rebuildUcPresets() {
  const sel = $('#ucPreset'); sel.innerHTML = '';
  MODELS[S.model].ucs.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = p.name; sel.appendChild(o); });
  if (S.ucPreset >= MODELS[S.model].ucs.length) S.ucPreset = 0;
  sel.value = S.ucPreset;
}
function syncSizePreset() { const idx = SIZES.findIndex(s => s[1] === S.w && s[2] === S.h); $('#sizePreset').value = idx >= 0 ? idx : SIZES.length - 1; }
function syncAdvanced() { $('#qtagsEdit').value = getQuality(S.model); $('#ucEdit').value = getUcText(S.model, ucIdx()); }
function updateCostHint() {
  const isOpus = R.tier === 3;
  const est = anlasEstimate({ width: S.w, height: S.h, steps: S.steps, batch: S.n,
    strength: R.i2iBlob ? S.strength : 1, isOpus,
    charRefCount: MODELS[S.model].ver >= 45 ? R.prefs.length : 0,   // V4.5 아니면 실제로 안 나가므로 비용도 0
    unencodedVibes: R.vibes.filter(v => !v.enc && v.b64).length });
  const el = $('#genCost');
  if (!hasToken()) { el.textContent = ''; return; }
  el.textContent = est.total === 0 ? 'Opus 무료' : `◈ ${est.total}` + (S.n > 1 ? ` (${S.n}장)` : '');
  el.title = `장당 ${est.perImage} · 생성 ${est.generation}` + (est.charRef ? ` · 레퍼런스 ${est.charRef}` : '') + (est.vibeEncoding ? ` · 바이브 인코딩 ${est.vibeEncoding}` : '') + (isOpus ? '' : ' (Opus 구독이면 1024²·28스텝 이하 무료)');
}

/* ─────────────── 초기화 ─────────────── */
function init() {
  const qp = new URLSearchParams(location.search);
  if (qp.get('theme')) S.theme = qp.get('theme');
  if (qp.get('mode')) S.mode = qp.get('mode');
  applyTheme();
  const fill = (sel, items) => { for (const [v, n] of items) { const o = document.createElement('option'); o.value = v; o.textContent = n; sel.appendChild(o); } };
  fill($('#model'), Object.entries(MODELS).map(([id, m]) => [id, m.kind + ' ' + m.name]));
  fill($('#sampler'), SAMPLERS); fill($('#schedule'), SCHEDULES.map(v => [v, v])); fill($('#sizePreset'), SIZES.map((s, i) => [i, s[0]]));
  if (!MODELS[S.model]) S.model = DEFAULTS.model;
  syncUI(); renderChars();
  // 기존 사용자: 예전 기본 4칸(캐릭터부터)이면 맨 앞에 "퀄리티·작가 태그" 칸을 추가
  if (Array.isArray(S.sections) && S.sections.length && S.sections[0].id === 'char' && !S.sections.some(s => s.id === 'qa')) { S.sections.unshift({ ...DEFAULTS.sections[0] }); save(); }
  { const qa = (S.sections || []).find(s => s.id === 'qa'); if (qa && qa.name === '퀄리티 · 작가 태그') { qa.name = DEFAULTS.sections[0].name; qa.hint = DEFAULTS.sections[0].hint; save(); } }
  attachHighlight($('#prompt')); attachHighlight($('#uc')); renderSections();
  $('#pvWrap').addEventListener('toggle', updatePreview); updatePreview();
  if (!S.singleBox && (!S.secText || !Object.keys(S.secText).length) && S.prompt) { S.secText = {}; S.secText[S.sections[0].id] = S.prompt; renderSections(); } // 예전 단일 프롬프트 이관

  $('#model').onchange = () => {
    const oldId = (MODELS[S.model].ucs[ucIdx()] || {}).id;
    S.model = $('#model').value;
    const i = MODELS[S.model].ucs.findIndex(u => u.id === oldId);
    if (i >= 0) S.ucPreset = i; else { S.ucPreset = 0; if (oldId != null) toast('이 모델에는 그 UC 프리셋이 없어 Heavy로 바뀌었습니다'); }
    syncUI(); save();
  };
  $('#sizePreset').onchange = () => { const s = SIZES[$('#sizePreset').value]; if (s[1]) { S.w = s[1]; S.h = s[2]; $('#w').value = S.w; $('#h').value = S.h; updateCostHint(); save(); } };
  $('#w').onchange = () => { S.w = snap64(+$('#w').value); $('#w').value = S.w; syncSizePreset(); updateCostHint(); save(); };
  $('#h').onchange = () => { S.h = snap64(+$('#h').value); $('#h').value = S.h; syncSizePreset(); updateCostHint(); save(); };
  $('#btnSwap').onclick = () => { [S.w, S.h] = [S.h, S.w]; $('#w').value = S.w; $('#h').value = S.h; syncSizePreset(); save(); };
  $$('#batchSeg button').forEach(b => b.onclick = () => { S.n = +b.dataset.n; $$('#batchSeg button').forEach(x => x.classList.toggle('on', x === b)); updateCostHint(); save(); });
  const bindRange = key => { $('#' + key).oninput = () => { S[key] = +$('#' + key).value; $('#' + key + 'V').textContent = S[key]; updateCostHint(); save(); }; };
  ['steps', 'scale', 'rescale', 'strength', 'noise', 'enhStr', 'enhNoise', 'varStr', 'varNoise', 'ucStrength'].forEach(bindRange);
  $('#enhScale').onchange = () => { S.enhScale = +$('#enhScale').value; save(); };
  $('#sampler').onchange = () => { S.sampler = $('#sampler').value; save(); };
  $('#schedule').onchange = () => { S.schedule = $('#schedule').value; save(); };
  $('#seed').oninput = () => { S.seed = $('#seed').value.replace(/\D/g, ''); $('#seed').value = S.seed; save(); };
  const fixSeed = v => { S.seed = String(v); $('#seed').value = S.seed; S.randomSeed = false; $('#randomSeed').checked = false; save(); };
  window.fixSeed = fixSeed;
  $('#btnDice').onclick = () => fixSeed(randSeed());
  $('#btnSeedLast').onclick = () => { if (R.lastSeed != null) fixSeed(R.lastSeed); };
  const bindCk = (id, key, after) => { $('#' + id).onchange = () => { S[key] = $('#' + id).checked; save(); if (after) after(); }; };
  ['randomSeed', 'quality', 'variety', 'decrisper', 'legacyUc', 'vibeNormalize', 'autoSaveOn', 'stripOnSave', 'smeaDyn', 'autoNsfw', 'slashWild'].forEach(k => bindCk(k, k, updateCostHint));
  bindCk('smea', 'smea', () => { $('#smeaDyn').disabled = !S.smea; if (!S.smea) { S.smeaDyn = false; $('#smeaDyn').checked = false; } updateCostHint(); });
  $('#aiChoiceBtn').onclick = () => { S.aiChoice = !S.aiChoice; save(); renderChars(); };
  $('#ucPreset').onchange = () => { S.ucPreset = +$('#ucPreset').value; syncAdvanced(); save(); };
  $('#qtagsEdit').oninput = () => { S.ov[S.model] = S.ov[S.model] || {}; S.ov[S.model].q = $('#qtagsEdit').value; save(); };
  $('#ucEdit').oninput = () => { S.ov[S.model] = S.ov[S.model] || {}; S.ov[S.model].uc = S.ov[S.model].uc || {}; S.ov[S.model].uc[ucIdx()] = $('#ucEdit').value; save(); };
  $('#btnResetPreset').onclick = () => { delete S.ov[S.model]; syncAdvanced(); save(); toast('프리셋 기본값 복원'); };
  $('#prompt').addEventListener('input', () => { S.prompt = $('#prompt').value; save(); });
  $('#uc').addEventListener('input', () => { S.uc = $('#uc').value; save(); });
  $('#btnPromptClear').onclick = () => { S.prompt = ''; S.secText = {}; $('#prompt').value = ''; renderSections(); save(); };
  $('#btnSecEdit').onclick = openSectionEditor;
  $$('#autoModeSeg button').forEach(b => b.onclick = () => { S.autoMode = b.dataset.m; save(); syncUI(); });
  $('#contGen').onchange = () => setAutoUI(R.auto.on);
  ['steps', 'scale', 'rescale', 'sampler', 'schedule', 'quality', 'ucPreset', 'variety', 'decrisper'].forEach(id => $('#' + id).addEventListener('change', () => setTimeout(syncUI, 0)));
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('textarea.ac')) R.lastTA = e.target; });
  $('#autoCount').onchange = () => { S.autoCount = Math.max(0, +$('#autoCount').value || 0); save(); };
  $('#autoDelay').onchange = () => { S.autoDelay = Math.max(0, +$('#autoDelay').value || 0); save(); };
  $('#btnAddChar').onclick = () => { if (S.chars.length >= 6) { toast('캐릭터는 최대 6명', 'err'); return; } S.chars.push({ prompt: '', uc: '', x: null, y: null }); save(); renderChars(); };

  $$('.reftab').forEach(b => b.onclick = () => switchRefTab(b.dataset.t));
  const drop = $('#i2iDrop'); bindDrop(drop, f => setI2I(f)); drop.onclick = () => pickFiles(false, f => setI2I(f));
  $('#btnI2iClear').onclick = clearI2I; $('#btnMask').onclick = openMaskEditor;
  $('#vibeAdd').onclick = () => pickFiles(true, f => addVibe(f)); bindDrop($('#panelVibe'), f => addVibe(f), true);
  $('#vibeLibBtn').onclick = openVibeLib;
  $('#prefAdd').onclick = () => pickFiles(true, f => addPref(f)); bindDrop($('#panelPref'), f => addPref(f), true);

  const genClick = () => { if ($('#contGen').checked) { if (R.auto.on) stopAuto(); else startAuto(); } else doGenerate().catch(() => {}); };
  $('#btnCancel').onclick = () => { if (R.abort) { R.abort.abort(); toast('생성을 취소했습니다'); } if (R.auto.on) stopAuto(); if (typeof SR !== 'undefined' && SR.on) SR.stop = true; };
  $('#btnGen').onclick = genClick;
  document.addEventListener('keydown', e => {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (e.ctrlKey && e.key === 'Enter') {   // 씬 모드에선 현재 씬 생성
      // 모달(AI 프롬프트 창 등)이 열려 있으면 그 창의 일이다 — 뒤에서 생성이 같이 돌면 안 된다
      if (!$('#modalOverlay').hidden) return;
      e.preventDefault();
      if (S.mode === 'scene') { const b = $('#scRun'); if (b && !b.disabled) b.click(); } else if (S.mode === 'main') genClick();
      return;
    }
    if (!$('#modalOverlay').hidden || typing) return;
    if (S.mode !== 'main') return;   // 뷰어 단축키는 메인에서만 (씬/라이브러리의 다른 이미지에 오작동하던 문제)
    // Ctrl/Alt/Meta 가 눌린 조합은 브라우저·앱의 다른 단축키다. 걸러내지 않으면
    // Ctrl+F(찾기) 가 즐겨찾기를 토글하는 식으로 오작동한다.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowLeft') stepImage(-1); if (e.key === 'ArrowRight') stepImage(1);
    if (e.key === 'Delete') deleteCur(); if (e.key === 'f' || e.key === 'F') toggleFav();
  });
  $('#btnPrev').onclick = () => stepImage(-1); $('#btnNext').onclick = () => stepImage(1);
  $('#tFav').onclick = () => toggleFav();
  $('#tSave').onclick = () => { const it = curItem(); if (it) saveItem(it, !!S.stripOnSave); }; // 💾 = 설정("저장 시 메타데이터 제거")을 따름
  $('#tSaveClean').onclick = () => { const it = curItem(); if (it) saveItem(it, true); };  // 🧹 = 항상 제거
  $('#tToI2i').onclick = () => { const it = curItem(); if (it) { setI2I(it.blob); toast('i2i 소스로 설정됨'); } };
  $('#tToVibe').onclick = () => { const it = curItem(); if (it) addVibe(it.blob); };
  $('#tToPref').onclick = () => { const it = curItem(); if (it) addPref(it.blob); };
  $('#tMeta').onclick = () => { const it = curItem(); if (it) openMetaViewer(it.blob, '생성 이미지 메타데이터'); };
  $('#tDelete').onclick = deleteCur;
  $('#tSeed').onclick = () => { const it = curItem(); if (it && it.seed != null) { fixSeed(it.seed); toast('시드 고정: ' + it.seed); } };
  $('#tCopy').onclick = () => { const it = curItem(); if (!it) return;
    openModal('복사', body => {
      const p = it.meta.parameters || {};
      body.innerHTML = `<div class="row"><button class="btn sm" id="cpPrompt">프롬프트만 복사</button><button class="btn sm" id="cpUc">네거티브만 복사</button><button class="btn sm" id="cpAll">전체 설정(JSON) 복사</button><button class="btn sm" id="cpSeed">시드 복사</button></div>
        <pre>${escHtml(it.meta.input || '')}</pre>`;
      const cp = async (t, m) => { try { await navigator.clipboard.writeText(t); toast(m + ' 복사됨'); closeModal(); } catch (e) { toast('클립보드 실패: ' + e.message, 'err'); } };
      body.querySelector('#cpPrompt').onclick = () => cp(it.meta.input || '', '프롬프트');
      body.querySelector('#cpUc').onclick = () => cp(p.negative_prompt || '', '네거티브');
      body.querySelector('#cpAll').onclick = () => cp(JSON.stringify(it.meta, null, 2), '설정 JSON');
      body.querySelector('#cpSeed').onclick = () => cp(String(it.seed), '시드');
    });
  };
  $('#tApply').onclick = () => { const it = curItem(); if (it) applyMeta(it.meta); };
  $('#histFavOnly').onclick = () => { S.histFavOnly = !S.histFavOnly; save(); renderHist(); };
  $('#histClear').onclick = () => {
    if (!R.hist.length) return;
    openModal('히스토리 비우기', body => {
      body.innerHTML = `<div>즐겨찾기(★)를 제외한 ${R.hist.filter(h => !h.fav).length}장을 삭제합니다.</div>`;
      const b = document.createElement('button'); b.className = 'btn danger'; b.textContent = '삭제';
      b.onclick = async () => {
        const keep = R.hist.filter(h => h.fav);
        for (const h of R.hist) if (!h.fav) {
          URL.revokeObjectURL(h.url);
          if (typeof LIB !== 'undefined' && LIB.sel) LIB.sel.delete(h);   // 지운 이미지가 라이브러리 선택에 남아 되살아나던 문제
          if (h.id != null) await histDel(h.id).catch(() => {});
        }
        R.hist = keep; R.cur = R.hist.length - 1;
        closeModal(); refreshAfterBulk();
        if (typeof updateLibSel === 'function') updateLibSel();
      };
      body.appendChild(b);
    });
  };
  $('#btnAutoStart').onclick = startAuto;
  $('#btnAutoStop').onclick = stopAuto;
  $('#btnPickDir').onclick = async () => {
    if (!window.showDirectoryPicker) { toast('이 브라우저는 폴더 지정 미지원 → 다운로드 폴더로 저장됩니다 (Chrome/Edge는 폴더 지정 가능)', 'err'); return; }
    try { R.dirHandle = await showDirectoryPicker({ mode: 'readwrite' }); $('#dirName').textContent = '📂 ' + R.dirHandle.name; idbSet('dir', R.dirHandle).catch(() => {}); } catch (e) {}
  };
  idbGet('dir').then(h => { if (h) { R.dirHandle = h; $('#dirName').textContent = '📂 ' + h.name; } }).catch(() => {});

  $('#anlas').onclick = () => { if (!hasToken()) openSettings(); else refreshAnlas().catch(e => toast(e.message, 'err')); };
  $('#btnSettings').onclick = openSettings; $('#btnTheme').onclick = toggleTheme;
  $('#btnReload').onclick = () => { if (R.gen || R.auto.on) { if (!confirm('생성 중입니다. 새로고침하면 진행 중인 작업이 끊깁니다. 계속할까요?')) return; } location.reload(); };
  $$('.nav-tab').forEach(t => t.onclick = () => setMode(t.dataset.mode));
  $('#modalClose').onclick = closeModal;
  // 바깥 클릭으로 닫기: 입력 칸이 없는 안내용 창만. 편집 중인 창(청크·스타일·캐릭터·설정 등)은 ✕ 또는 Esc 로만 닫힘 (실수로 날아가는 것 방지)
  $('#modalOverlay').addEventListener('click', e => { if (e.target !== $('#modalOverlay')) return; const editing = $('#modalBody').querySelector('input:not([type=checkbox]):not([type=range]), textarea, select'); if (!editing) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || $('#modalOverlay').hidden) return;
    const a = document.activeElement; if (a && /INPUT|TEXTAREA/.test(a.tagName) && a.value && a.closest('#modalBody')) { a.blur(); return; } // 입력 중이면 첫 Esc는 포커스만 해제
    closeModal();
  });

  if (typeof initTags === 'function') initTags();
  if (typeof initTools === 'function') initTools();
  if (typeof initScenes === 'function') initScenes();
  setMode(S.mode || 'main'); applyTheme();
  loadHistory().then(() => { if (window.onHistChanged) window.onHistChanged(); });
  srvLoop(); naiStatusLoop();
  $('#naiStat').onclick = openNaiStatus;
  $('#appVer').textContent = 'v' + APP_VERSION;
  $('#appVer').onclick = () => openModal('버전', body => { body.innerHTML = `<div class="nai-st"><div><b>앱(화면)</b><div>v${APP_VERSION}</div></div><div><b>서버(server.py)</b><div>v${R.srvInfo && R.srvInfo.version != null ? R.srvInfo.version : '?'} ${R.srvInfo && R.srvInfo.version < NEED_SERVER_VER ? '⚠ 예전 버전 — 검은 창 닫고 start.bat 재실행' : ''}</div></div><div><b>직접 재생 엔진</b><div>${R.srvInfo && R.srvInfo.ytEngine ? '설치됨' : '없음'}</div></div><div><b>브라우저</b><div>${escHtml((navigator.userAgent.match(/(Firefox|Edg|Chrome)\/[\d.]+/) || ['?'])[0])}</div></div></div>`; });
}

/* ─────────────── NAI 서버 상태 (NAI 웹과 같은 방식: 접속 확인 + static.novelai.net/status 공지) ─────────────── */
const NST = { last: null, genTimes: [], q: null };   // q = 그림 품질 캐시 (상단 표시등도 이 값을 본다)
async function naiStatusLoop() {
  if (!R.srvOk) { setTimeout(naiStatusLoop, 3000); return; }
  /* 그림 품질도 여기서 잰다. 예전엔 상세창을 열 때만 쟀기 때문에, 품질이 빨강이어도
     상단 표시등은 그 사실을 모른 채 초록이었다 (상세창은 빨강, 상단은 초록).
     새 이미지가 생겼을 때만 다시 재서 매번 8장을 디코드하지 않게 한다. */
  try {
    const h = R.hist || [];
    const key = h.length + '|' + (h.length ? (h[h.length - 1].t || h[h.length - 1].name || '') : '');
    if (typeof qualityHealth === 'function' && key !== NST.qKey) {
      NST.q = await qualityHealth(8).catch(() => null);
      NST.qKey = key;
    }
  } catch (e) {}
  try { const r = await fetch(R.api + '/nai/status', { cache: 'no-store' }); if (r.ok) { NST.last = await r.json(); NST.at = Date.now(); } } catch (e) {}
  paintNaiStatus();
  setTimeout(naiStatusLoop, 120000);
}
const IMG_SVC = /image/i; // 공식 상태페이지의 "Image Generation" 항목
function officialImg(o) { return o && (o.services || []).find(s => IMG_SVC.test(s.name || '')); }
/* NAI 상태 항목별 판정 — 상단 표시등과 상세창이 같은 기준을 쓴다.
   lv: 0 정상 · 1 주의(주황) · 2 나쁨(빨강) · -1 정보 없음
   q 는 qualityHealth() 결과(선택). 없으면 그림 품질 항목은 "정보 없음". */
function naiMarks(q) {
  const s = NST.last || {};
  const o = s.official, img = officialImg(o);
  const gh = genHealth();
  const marks = [];
  const add = (name, lv, txt) => marks.push({ name, lv, txt });

  if (!NST.last) add('NAI 접속', -1, '확인 중');
  else if (!s.api_ok || !s.img_ok) add('NAI 접속', 2, `api ${s.api_ok ? s.api_ms + 'ms' : '불가'} · image ${s.img_ok ? s.img_ms + 'ms' : '불가'}`);
  else {
    const worst = Math.max(s.api_ms || 0, s.img_ms || 0);
    add('NAI 접속', worst > 2500 ? 1 : 0, `api ${s.api_ms}ms · image ${s.img_ms}ms`);
  }

  if (!o) add('공식 상태', -1, s.official_error ? '가져오기 실패' : '확인 중');
  else if (o.code >= 400 || (img && img.code >= 400)) add('공식 상태', 2, '이미지 생성 장애');
  else if (img && img.code > 100) add('공식 상태', 1, '이미지 생성 성능 저하');
  else if (o.code > 100) add('공식 상태', 1, o.overall || '일부 서비스 저하');
  else if ((o.incidents || []).length) add('공식 상태', 1, '진행 중 장애 공지 있음');
  else if (o.maintenance_active) add('공식 상태', 1, '점검 진행 중');
  else add('공식 상태', 0, o.overall || 'Operational');

  // 공식 서비스 중 하나라도 초록이 아니면 주의 (이미지 생성 외 서비스도 표시)
  const svcBad = (o && (o.services || []).filter(x => x.code != null && x.code !== 100)) || [];
  if (svcBad.length) add('공식 서비스', svcBad.some(x => x.code >= 400) ? 2 : 1,
    svcBad.map(x => x.name).slice(0, 3).join(', '));

  if (s.notice) add('사이트 공지', 1, String(s.notice).slice(0, 60));

  if (!gh.enough) add('내 생성 속도', -1,
    `같은 설정으로 ${SPD.minN}장 이상 쌓이면 판정합니다 (지금 ${gh.groupN}장)`);
  else {
    const bits = [`최근 ${gh.recentSec.toFixed(1)}s · 평소 ${gh.baseSec.toFixed(1)}s`,
      `평균 <b>${gh.meanR.toFixed(2)}배</b>`];
    if (gh.slow) bits.push(`<b>${gh.slow}/${gh.win}장</b>이 평소의 1.6배 넘게 느림`);
    bits.push(`${gh.cfg} 기준 ${gh.baseN}장`);
    add('내 생성 속도', gh.lv, bits.join(' · '));
  }
  // 실패는 원래 거의 없는 일이라(실측 359장 중 0건) 조금만 나도 알린다.
  // 단 1건짜리 잡음은 걸러내려고 2건 이상일 때부터 본다.
  if (gh.total >= 8) add('실패율(24h)',
    (gh.fails >= 2 && gh.failRate >= 0.2) ? 2 : (gh.fails >= 2 && gh.failRate >= 0.08) ? 1 : 0,
    `${gh.fails}/${gh.total}회 실패 (${Math.round(gh.failRate * 100)}%)`);

  if (!q || !q.enough) add('그림 품질', -1, `최근 이미지 ${(q && q.n) || 0}장 (3장 이상 필요)`);
  else if (!q.ratio) add('그림 품질', -1, `선명도 ${q.cur.lap} · 대비 ${q.cur.sd} · 다양성 ${q.cur.ent} — “평소로 기준 저장”을 눌러두면 다음부터 비교합니다`);
  else {
    const r = q.ratio;
    const bad = r.lap < 0.5 || r.sd < 0.6 || r.ent < 0.75;
    const warn = r.lap < 0.75 || r.sd < 0.8 || r.ent < 0.9;
    add('그림 품질', bad ? 2 : warn ? 1 : 0,
      `선명도 ${(r.lap * 100).toFixed(0)}% · 대비 ${(r.sd * 100).toFixed(0)}% · 다양성 ${(r.ent * 100).toFixed(0)}% (평소=100%)`);
  }
  return marks;
}
const naiWorst = marks => marks.reduce((a, m) => Math.max(a, m.lv), -1);

function paintNaiStatus() {
  const s = NST.last; const dot = $('#naiDot'), ms = $('#naiMs'), pill = $('#naiStat');
  if (!s || !dot) return;
  // 항목이 하나라도 주황이면 상단도 주황, 하나라도 빨강이면 빨강 (상세창과 같은 기준)
  const marks = naiMarks(NST.q);
  const lv = naiWorst(marks);
  const cls = lv >= 2 ? 'bad' : lv === 1 ? 'warn' : 'ok';
  dot.className = 'dot ' + cls;
  if (pill) pill.className = 'pill tiny ' + cls;

  const worstMs = Math.max(s.api_ms || 0, s.img_ms || 0);
  const flagged = marks.filter(m => m.lv >= 1);
  ms.textContent = !s.api_ok || !s.img_ok ? '접속 불가'
    : (lv >= 2 ? '이상' : (worstMs / 1000).toFixed(1) + 's' + (lv === 1 ? ' ⚠' : ''));

  const strip = t => String(t).replace(/<[^>]*>/g, '');
  if (pill) pill.title = 'NovelAI 상태 — ' + (lv >= 2 ? '🔴 정상 아님' : lv === 1 ? '🟡 평소보다 나쁨' : '🟢 정상')
    + (flagged.length ? '\n\n' + flagged.map(m => (m.lv >= 2 ? '🔴 ' : '🟡 ') + m.name + ': ' + strip(m.txt)).join('\n') : '')
    + '\n\n(클릭: 자세히)';
}
/* 생성 실적 기록 — 설정(스텝·해상도·장수)이 다르면 초 단위는 비교가 안 되므로
   "메가픽셀·스텝당 초"로 정규화해서 함께 남긴다. 이게 있어야 "22초가 느린 건지"를 판정할 수 있다. */
function genUnit(sec, p) {
  const mp = ((p.width || 832) * (p.height || 1216)) / 1e6;
  const st = p.steps || 28, n = p.n_samples || 1;
  const work = mp * st * n;
  return work > 0 ? sec / work : null;
}
function recordGenTime(sec, params, extra) {
  NST.genTimes.push(sec); if (NST.genTimes.length > 20) NST.genTimes.shift();
  const p = params || {};
  const rec = { t: Date.now(), sec, u: genUnit(sec, p), st: p.steps || null, w: p.width || null, h: p.height || null,
    n: p.n_samples || 1, m: (p.__model || '').slice(0, 28) };
  if (extra) Object.assign(rec, extra);
  S.genLog = S.genLog || [];
  S.genLog.push(rec);
  if (S.genLog.length > 400) S.genLog = S.genLog.slice(-400);   // 기준선 계산용으로 넉넉히
  save();
}
function recordGenFail(msg) {
  S.genLog = S.genLog || [];
  S.genLog.push({ t: Date.now(), fail: String(msg || '').slice(0, 60) });
  if (S.genLog.length > 400) S.genLog = S.genLog.slice(-400);
  save();
}
const med = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

/* 내 생성 실적 판정 — 사용자 실제 기록 359장으로 검증해 두 가지를 고쳤다.

   (1) 설정이 다르면 비교하면 안 된다.
       genUnit() 이 메가픽셀·스텝으로 나눠도 정규화가 덜 된다. 실측 u 중앙값:
         1216x832 28st = 0.2295 | 832x1216 28st = 0.3106 | 1024x1024 28st = 0.3474
       832x1216 과 1216x832 는 픽셀 수가 똑같은데 1.35배 차이다(세로가 느리다).
       해상도만 바꿔도 지표가 1.5배 튀어 경보가 떴다 — 헛경보 14회의 주원인이었다.
       → 같은 (해상도·스텝·장수·모델) 그룹 안에서만 비교한다.

   (2) 중앙값으로는 간헐적 지연을 원리상 못 잡는다.
       12장 중 5장이 4배로 느려도 중앙값은 7번째 값이라 안 움직인다.
       실측 2000회: 정상 중앙값비 최대 1.206 vs 고장 최소 0.969 — 완전히 겹친다.
       → 평균배율 + "느린 장 개수" 로 바꿨다. 이 둘은 깨끗이 갈린다.
           평균배율    정상 최대 1.255 · 고장 최소 2.026
           느린 장 수  정상 최대 2장   · 고장 최소 5장

   임계값은 실제 359장에서 헛경보 0회가 되도록 잡았다(평균 1.6/2.0 · 느린장 3/5).
   같은 설정 안에서도 자연 변동이 1.52배까지 가므로 그보다 낮추면 정상에도 경보가 뜬다. */
const SPD = { warnMean: 1.6, badMean: 2.0, warnSlow: 3, badSlow: 5, slowAt: 1.6, win: 12, minN: 20 };
const cfgKey = r => [r.w, r.h, r.st, r.n || 1, r.m || ''].join('|');

function genHealth() {
  const log = (S.genLog || []).filter(x => x && x.t);
  const okAll = log.filter(x => x.u > 0);
  const groups = {};
  for (const r of okAll) (groups[cfgKey(r)] = groups[cfgKey(r)] || []).push(r);
  let g = null;
  for (const k in groups) if (!g || groups[k].length > g.length) g = groups[k];

  const day = Date.now() - 864e5;
  const recentAll = log.filter(x => x.t > day);
  const fails = recentAll.filter(x => x.fail).length;
  const out = { n: okAll.length, fails, total: recentAll.length,
    failRate: recentAll.length ? fails / recentAll.length : 0,
    groupN: g ? g.length : 0, groups: Object.keys(groups).length, enough: false };

  if (!g || g.length < SPD.minN) return out;
  const recent = g.slice(-SPD.win), prior = g.slice(0, -SPD.win);
  if (prior.length < 8) return out;
  const B = med(prior.map(x => x.u));
  const meanR = (recent.reduce((a, x) => a + x.u, 0) / recent.length) / B;
  const slow = recent.filter(x => x.u > SPD.slowAt * B).length;
  out.enough = true;
  out.meanR = meanR; out.slow = slow; out.win = recent.length;
  out.recentSec = med(recent.map(x => x.sec));
  out.baseSec = med(prior.map(x => x.sec));
  out.baseN = prior.length;
  out.lv = (meanR >= SPD.badMean || slow >= SPD.badSlow) ? 2
    : (meanR >= SPD.warnMean || slow >= SPD.warnSlow) ? 1 : 0;
  out.cfg = `${recent[0].w}×${recent[0].h} ${recent[0].st}st`;
  return out;
}
function openNaiStatus() {
  openModal('NovelAI 상태 종합 판정', async body => {
    // 상세창을 열 때는 그림 품질을 새로 재서 캐시에 넣는다 (상단 표시등도 이 값을 쓴다)
    if (typeof qualityHealth === 'function') { NST.q = await qualityHealth(8).catch(() => null); paintNaiStatus(); }
    const s = NST.last || {};
    const o = s.official, img = officialImg(o);
    const ico = c => c == null ? '·' : c === 100 ? '🟢' : c >= 400 ? '🔴' : '🟡';
    const svcRows = o ? (o.services || []).map(x => `<span class="svc ${x.code === 100 ? 'ok' : x.code >= 400 ? 'bad' : 'warn'}">${ico(x.code)} ${escHtml(x.name)}</span>`).join('') : '';
    const incRows = o && (o.incidents || []).length ? o.incidents.map(i => `<div class="inc"><b>${escHtml(i.name || '')}</b> <span class="hint">${escHtml((i.status || '') + ' · ' + (i.at || '').slice(0, 16).replace('T', ' '))}</span><div>${escHtml((i.detail || '').slice(0, 300))}</div></div>`).join('') : '';

    const marks = naiMarks(NST.q);
    const worstLv = Math.max(...marks.map(m => m.lv));
    const verdict = worstLv >= 2
      ? '🔴 정상이 아닙니다 — 아래 빨간 항목을 보세요'
      : worstLv === 1 ? '🟡 평소보다 나쁩니다' : '🟢 정상';
    const dot = lv => lv === 2 ? '🔴' : lv === 1 ? '🟡' : lv === 0 ? '🟢' : '⚪';

    body.innerHTML = `<div class="nai-st">
      <div><b>종합 판정</b><div style="font-size:15px">${verdict}</div></div>
      <div><b>항목별</b><div class="judge-list">${marks.map(m => `<div class="jrow"><span>${dot(m.lv)} ${escHtml(m.name)}</span><span class="hint">${m.txt}</span></div>`).join('')}</div></div>
      ${incRows ? `<div><b>진행 중 장애</b><div>${incRows}</div></div>` : ''}
      <div><b>공식 서비스별</b><div class="svcs">${svcRows || '<span class="hint">확인 중</span>'}</div></div>
      <div><b>사이트 공지</b><div>${s.notice ? escHtml(s.notice) : '없음'}</div></div>
      <div><b>정밀 판정</b><div class="hint">최근 이미지를 AI 가 보고 손가락·해부학·그림체·프롬프트 준수도를 채점합니다 (Gemini 키 필요)</div>
        <div class="row"><button class="btn sm" id="nsJudge">🔬 최근 이미지 채점</button><span class="hint" id="nsJudgeSt"></span></div>
        <div id="nsJudgeOut"></div></div>
      </div>
      <div class="hint">2분마다 자동 확인 · 공식 상태 출처: status.novelai.net · 속도는 <b>내 과거 기록</b>과 비교합니다(스텝·해상도 차이를 보정).</div>
      <div class="row"><button class="btn sm" id="nsNow">지금 다시 확인</button>
        <button class="btn sm" id="nsBase">지금을 “평소”로 기준 저장</button>
        <a class="btn sm" href="https://status.novelai.net/" target="_blank" rel="noopener">공식 상태 페이지</a></div>`;

    body.querySelector('#nsNow').onclick = async () => { const r = await fetch(R.api + '/nai/status', { cache: 'no-store' }); NST.last = await r.json(); paintNaiStatus(); closeModal(); openNaiStatus(); };
    body.querySelector('#nsBase').onclick = async () => {
      const qq = await qualityHealth(12);
      if (!qq.enough) { toast('이미지가 3장 이상 있어야 기준을 잡을 수 있습니다', 'err'); return; }
      setQualityBaseline(qq.cur);
    };
    body.querySelector('#nsJudge').onclick = async () => {
      const it = (R.hist || []).filter(h => h.blob).slice(-1)[0];
      const st = body.querySelector('#nsJudgeSt'), out = body.querySelector('#nsJudgeOut');
      if (!it) { st.textContent = '채점할 이미지가 없습니다'; return; }
      st.textContent = '채점 중…';
      try {
        const p = (it.meta && it.meta.input) || '';
        const res = await apiFetch('/ai/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: await blobToB64(it.blob), prompt: p, model: S.aiModel || 'gemini-2.5-flash' }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 실패 원인을 그대로 보여준다 (모델·중단사유·응답 일부)
          const detail = [j.finish ? '중단사유 ' + j.finish : '', j.model ? '모델 ' + j.model : ''].filter(Boolean).join(' · ');
          out.innerHTML = detail || j.raw ? `<div class="hint">${escHtml(detail)}${j.raw ? '<br>응답: ' + escHtml(String(j.raw).slice(0, 200)) : ''}</div>` : '';
          throw new Error(j.message || ('HTTP ' + res.status));
        }
        const g = j.judge || {};
        const row = (k, label) => g[k] ? `<div class="jrow"><span>${label} <b>${g[k].score}/10</b></span><span class="hint">${escHtml(g[k].note || '')}</span></div>` : '';
        out.innerHTML = `<div class="judge-list">
          ${row('hands', '✋ 손가락')}${row('anatomy', '🧍 해부학')}${row('style', '🎨 그림체')}
          ${row('artifacts', '🧩 뭉갬·노이즈')}${row('prompt_follow', '📝 프롬프트 준수')}
          <div class="jrow"><span><b>종합 ${g.overall != null ? g.overall + '/10' : '-'}</b></span><span class="hint">${escHtml(g.summary || '')}</span></div></div>`;
        st.textContent = '';
      } catch (e) { st.textContent = '✖ ' + e.message; }
    };
  }, true);
}
window.addEventListener('error', e => { if (e.message) toast('오류: ' + e.message + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : ''), 'err'); });
window.addEventListener('unhandledrejection', e => { logErr('unhandled: ' + (e.reason && e.reason.message || e.reason)); });
document.addEventListener('DOMContentLoaded', () => {
  try { init(); } catch (e) { logErr('init 실패: ' + e.message); toast('초기화 오류: ' + e.message, 'err'); throw e; }
  if (new URLSearchParams(location.search).get('selftest')) setTimeout(runSelfTest, 1500);
});

/* ─────────────── 셀프테스트 (?selftest=1 — 결과를 서버 data/selftest.json 으로 전송) ─────────────── */
async function runSelfTest() {
  const r = { ua: navigator.userAgent, href: location.href, errors: ERRLOG.slice(), steps: {} };
  const step = async (name, fn) => { try { r.steps[name] = await fn(); } catch (e) { r.steps[name] = 'FAIL: ' + (e && e.message || e); } };
  await step('server', async () => (await probeServer()) ? 'ok ' + R.api : 'no server');
  await step('tagdb', async () => { for (let i = 0; i < 40 && !(window.TAGDB && TAGDB.rows); i++) await sleep(300); return TAGDB.rows ? TAGDB.rows.length + ' rows; 흰머리→' + tagSearchLocal('흰머리', 1)[0][0] : 'not loaded: ' + TAGDB.state + ' ' + TAGDB.msg; });
  await step('token', async () => { await saveTokenToServer('pst-selftest'); let msg = ''; try { await refreshAnlas(); msg = 'unexpected ok'; } catch (e) { msg = e.message; } await saveTokenToServer(''); return msg; });
  await step('yt', async () => { const res = await apiFetch('/yt/search?q=lofi'); const j = await res.json(); return (j.items || []).length + ' results'; });
  await step('payload', async () => { const b = buildPayload(); return b.model + ' v' + b.parameters.params_version + ' q=' + b.input.slice(-20); });
  await step('idb', async () => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const blob = await new Promise(res => c.toBlob(res, 'image/png')); const it = await addToHistory(blob, { parameters: { seed: 1, width: 8, height: 8 }, model: S.model }, 'selftest'); const all = await histAll(); await deleteItem(it); return 'stored ' + all.length; });
  await step('unzip', async () => { const fname = new TextEncoder().encode('a.png'), fdata = new TextEncoder().encode('X'); const u16 = v => [v & 255, v >> 8], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; const lh = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(1), ...u32(1), ...u16(fname.length), ...u16(0), ...fname, ...fdata]; const cd = [0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(1), ...u32(1), ...u16(fname.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...fname]; const eocd = [0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(1), ...u16(1), ...u32(cd.length), ...u32(lh.length), ...u16(0)]; const f = await unzip(new Uint8Array([...lh, ...cd, ...eocd]).buffer); return f.map(x => x.name).join(','); });
  await step('deflate', async () => { const st = new Response(new Uint8Array([0x4b, 4, 0])).body.pipeThrough(new DecompressionStream('deflate-raw')); return 'ok ' + (await new Response(st).arrayBuffer()).byteLength; });
  await step('ui', async () => ({ modelOpts: $('#model').options.length, srvText: $('#srvText').textContent, anlas: $('#anlas').textContent, hl: !!$('#prompt').dataset.hl }));
  r.errors = ERRLOG.slice();
  await fetch(R.api + '/selftest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }).catch(() => {});
  console.log('selftest', r);
  return r;
}
