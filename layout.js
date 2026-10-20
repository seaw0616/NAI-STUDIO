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
 */
/* ── NAI 화면 배치 (Page Layout, 빌드 b50892a) ─────────────────────────────────────────────
   NAI 그림 생성 화면은 «배치 틀»(preset)로 그린다. 열(columns)은 패널(panel)과 결과 화면(stage)이고,
   그 안에 칸(element)·줄(row)·묶음(group)·탭(tabs)을 놓는다 (배치 틀 모듈 builtInPresets, 그리는 쪽 GQ·Gr·Gm·Gu·Gh·GT·GD·Gz·GH·G$·GA).
   · NAI 설정 «Page Layout»(디버그 설정 화면)의 기본값은 "classic" 인데, 그 이름의 배치가 목록에 없어 Layout A 로 그린다
     (GQ: builtInPresets.find(id) ?? layoutA). 곧 NAI 실제 그림 생성 화면은 Layout A 다.
   · 우리 앱은 «NAI Studio 3단 배치»(classic, 예전부터 쓰던 화면)가 기본이고, ⚙ «화면 배치»에서 Layout A~E 를 고른다.
   · 패널: 넓이(가장자리 8px 를 끌어서 바꿈, 최소·최대) · 접기(세로 띠 rail 이나 작은 단추 icon) · 창이 좁으면 shrinkPriority 가 낮은 것부터 접힘(Gr)
     — 저절로 접힌 패널은 띠·단추를 누르면 떠서 열리고 바깥을 누르면 닫힌다. 넓이·접기·묶음 접기·묶음 높이·고른 탭은 배치마다 기억한다(NAI ImageLayoutOverlay).
   · 묶음: 제목 · 여백(inset) · 접기(접으면 요약 칩 H4) · 높이 끌기(dragTop·dragBottom) · 스크롤(scroll) · 탭: 탭 단추에 개수 배지(H8) · 접힌 띠에 배지(H7)
   · 칸이 보이는 조건은 NAI 칸 성질표(Af)와 같다: 캐릭터(V4 이상) · 바이브(받는 모델이고 레퍼런스가 없을 때) · 정밀 레퍼런스(V4.5) ·
     스텝·샘플러(「절약」 모드가 아닐 때) · Rescale · 노이즈 스케줄 · 레거시 칸
   · 결과 화면 단추 줄은 배치마다 위·아래·왼쪽·오른쪽에 놓는다(options.bars, 없으면 기본 Fz). 넘치면 덜 중요한 단추부터 ⋯ 메뉴로(우선순위 FU).
     NAI 처럼 보고 있는 그림이 없으면 단추 줄을 숨긴다(그림 단추는 그림이 있어야 나오고, 위 단추 줄은 hideWithout:"image").
   · 폭 900 이하(NAI MOBILE_WIDTH — NAI 는 휴대폰 화면을 따로 그린다)이거나 메인 화면이 아니면 3단 배치로 돌아간다.
   우리 앱의 칸은 원래 자리에 표시(주석 노드)를 남기고 옮겼다가 그 자리로 되돌린다. 칸의 동작 코드는 그대로 쓴다.
   NAI 에 없는 우리 기능(옵션·인핸스 기본값·짤뽑·자동 저장)은 «이미지 설정» 칸이 있는 패널의 스크롤 묶음 끝에 둔다. */

/* NAI 배치 틀 Layout A~E (빌드 b50892a builtInPresets 그대로 — 패널 이름·묶음 제목은 NAI 화면 글 열쇠, nlText 가 한국어로) */
const NL_PRESETS = [
  {"id":"layout-a","name":"Layout A","columns":[{"kind":"panel","id":"sidebar","name":"image.settings","width":400,"minWidth":400,"maxWidth":700,"shrinkPriority":2,"items":[{"kind":"row","className":"image-gen-nav-row","bar":true,"justify":"space-between","items":[{"kind":"element","id":"nav-back","flex":0},{"kind":"element","id":"anlas-balance","flex":0},{"kind":"element","id":"nav-menu","flex":0}]},{"kind":"group","scroll":true,"items":[{"kind":"group","inset":"open-bottom","gap":16,"items":[{"kind":"element","id":"dev-tools"},{"kind":"element","id":"model-mode-row"},{"kind":"element","id":"legacy-notice"},{"kind":"element","id":"prompt"},{"kind":"element","id":"characters"},{"kind":"group","title":"image.imageInputs","gap":10,"items":[{"kind":"element","id":"input-image"},{"kind":"element","id":"vibe-transfer"},{"kind":"element","id":"character-references"}]},{"kind":"group","title":"image.imageSettings","items":[{"kind":"element","id":"resolution"},{"kind":"element","id":"image-count"}]}]}]},{"kind":"group","className":"image-gen-footer","inset":true,"gap":10,"items":[{"kind":"group","title":"image.aiSettings","collapsible":true,"collapsed":true,"summaryRows":[["steps","guidance","seed","sampler"],["cfg-rescale","noise-schedule","legacy-uc"]],"headerElement":"ai-settings-reset","items":[{"kind":"element","id":"steps"},{"kind":"element","id":"guidance"},{"kind":"row","gap":10,"items":[{"kind":"element","id":"seed"},{"kind":"element","id":"sampler"}]},{"kind":"group","title":"image.advancedSettings","collapsible":true,"collapsed":true,"items":[{"kind":"element","id":"cfg-rescale"},{"kind":"element","id":"noise-schedule"},{"kind":"element","id":"legacy-uc"}]}]},{"kind":"element","id":"banner-stack"},{"kind":"element","id":"generate"}]}]},{"kind":"stage","items":[{"kind":"element","id":"results-viewer"}]},{"kind":"panel","id":"history-rail","name":"image.history","icon":"history","width":140,"minWidth":140,"maxWidth":420,"collapsible":true,"shrinkPriority":1,"items":[{"kind":"element","id":"history"}],"collapseStyle":"icon"}]},
  {"id":"layout-b","name":"Layout B","columns":[{"kind":"panel","id":"params","collapsible":true,"name":"Nav + Settings","width":340,"minWidth":350,"maxWidth":500,"shrinkPriority":3,"items":[{"kind":"row","className":"image-gen-nav-row","bar":true,"justify":"start","items":[{"kind":"element","id":"nav-back","flex":0},{"kind":"element","id":"anlas-balance","flex":0},{"kind":"element","id":"spacer","flex":1},{"kind":"element","id":"nav-menu","flex":0},{"kind":"element","id":"panel-collapse","flex":0}]},{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"items":[{"kind":"element","id":"model-mode-row"}]},{"kind":"element","id":"divider"},{"kind":"group","inset":"open-bottom","gap":20,"items":[{"kind":"element","id":"legacy-notice"},{"kind":"element","id":"dev-tools"}]},{"kind":"group","title":"image.imageSettings","inset":"open-bottom","items":[{"kind":"element","id":"resolution"},{"kind":"element","id":"image-count"}]},{"kind":"group","inset":true,"items":[{"kind":"group","title":"image.aiSettings","collapsible":true,"summaryRows":[["steps","guidance","seed","sampler"],["cfg-rescale","noise-schedule","legacy-uc"]],"headerElement":"ai-settings-reset","items":[{"kind":"element","id":"steps"},{"kind":"element","id":"guidance"},{"kind":"row","gap":20,"items":[{"kind":"element","id":"seed"},{"kind":"element","id":"sampler"}]},{"kind":"group","title":"image.advancedSettings","collapsible":true,"collapsed":true,"items":[{"kind":"element","id":"cfg-rescale"},{"kind":"element","id":"noise-schedule"},{"kind":"element","id":"legacy-uc"}]}]}]}]},{"kind":"group","className":"image-gen-footer","inset":true,"gap":15,"items":[{"kind":"element","id":"banner-stack"},{"kind":"element","id":"generate"}]}]},{"kind":"stage","items":[{"kind":"element","id":"results-viewer","options":{"bars":{"right":{"hideWithout":"image","center":[["actions.enhance","actions.variations","actions.upscale","actions.set-init","actions.edit","actions.inpaint","actions.send-to-tools"]]},"bottom":{"overflow":"wrap","start":[["display.resolution","display.settings"]],"end":[["display.old-compare"],["save.contest","save.pin","save.copy","save.download"],["save.info"],["save.explore-upload"]]}}}},{"kind":"group","background":"bg2","gap":0,"inset":true,"dragTop":true,"minHeight":250,"items":[{"kind":"element","id":"prompt","options":{"fill":true,"disableUcDetach":true}}]}]},{"kind":"panel","id":"inputs","name":"History + Inputs","width":320,"minWidth":280,"maxWidth":500,"collapsible":true,"collapseStyle":"rail","shrinkPriority":2,"items":[{"kind":"group","height":300,"minHeight":250,"maxHeight":400,"dragBottom":true,"items":[{"kind":"element","id":"history"}]},{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"gap":10,"items":[{"kind":"element","id":"import-image"},{"kind":"tabs","id":"input-tabs","tabs":[{"title":"Image","icon":"img2img","items":[{"kind":"group","items":[{"kind":"element","id":"input-image"}]}]},{"title":"Characters","icon":"person","items":[{"kind":"group","items":[{"kind":"element","id":"characters"}]}]},{"title":"Vibes","icon":"vibe-transfer","items":[{"kind":"group","items":[{"kind":"element","id":"vibe-transfer"}]}]},{"title":"References","icon":"reference","items":[{"kind":"group","items":[{"kind":"element","id":"character-references"}]}]}]}]}]}]}]},
  {"id":"layout-c","name":"Layout C","columns":[{"kind":"panel","id":"controls","name":"image.settings","width":380,"minWidth":340,"maxWidth":560,"shrinkPriority":2,"items":[{"kind":"row","className":"image-gen-nav-row","bar":true,"justify":"start","items":[{"kind":"element","id":"nav-back","flex":0},{"kind":"element","id":"nav-menu","flex":0},{"kind":"element","id":"spacer","flex":1},{"kind":"element","id":"anlas-balance","flex":0}]},{"kind":"group","className":"image-gen-footer","inset":true,"gap":15,"items":[{"kind":"element","id":"banner-stack"},{"kind":"element","id":"generate"}]},{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"gap":10,"items":[{"kind":"tabs","id":"focus-tabs","tabs":[{"title":"Prompt","icon":"prompt","items":[{"kind":"group","gap":10,"items":[{"kind":"element","id":"legacy-notice"},{"kind":"element","id":"dev-tools"},{"kind":"element","id":"prompt","options":{"minLines":10,"maxLines":18}},{"kind":"element","id":"characters"}]}]},{"title":"Image","icon":"img2img","items":[{"kind":"group","gap":10,"items":[{"kind":"element","id":"input-image"},{"kind":"element","id":"vibe-transfer"},{"kind":"element","id":"character-references"}]}]},{"title":"Settings","icon":"settings","items":[{"kind":"group","gap":10,"items":[{"kind":"element","id":"model-mode-row"},{"kind":"element","id":"resolution"},{"kind":"element","id":"image-count"},{"kind":"element","id":"steps"},{"kind":"element","id":"guidance"},{"kind":"row","gap":20,"items":[{"kind":"element","id":"seed"},{"kind":"element","id":"sampler"}]},{"kind":"group","title":"image.advancedSettings","collapsible":true,"collapsed":true,"inline":true,"items":[{"kind":"element","id":"cfg-rescale"},{"kind":"element","id":"noise-schedule"},{"kind":"element","id":"legacy-uc"}]}]}]}]}]}]}]},{"kind":"stage","items":[{"kind":"element","id":"results-viewer"}]},{"kind":"panel","id":"history-rail","name":"image.history","icon":"history","width":140,"minWidth":140,"maxWidth":420,"collapsible":true,"collapseStyle":"rail","shrinkPriority":1,"items":[{"kind":"element","id":"history"}]}]},
  {"id":"layout-d","name":"Layout D","columns":[{"kind":"panel","id":"creative","name":"Prompt","width":400,"minWidth":360,"maxWidth":640,"shrinkPriority":3,"items":[{"kind":"row","className":"image-gen-nav-row","bar":true,"justify":"space-between","items":[{"kind":"element","id":"nav-back","flex":0},{"kind":"element","id":"anlas-balance","flex":0},{"kind":"element","id":"nav-menu","flex":0}]},{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"items":[{"kind":"element","id":"model-mode-row"}]},{"kind":"element","id":"divider"},{"kind":"group","inset":true,"gap":10,"items":[{"kind":"element","id":"legacy-notice"},{"kind":"element","id":"dev-tools"},{"kind":"tabs","id":"prompt-tabs","tabs":[{"title":"Prompt","icon":"prompt","items":[{"kind":"element","id":"prompt","options":{"minLines":8,"maxLines":14}}]},{"title":"Characters","icon":"person","items":[{"kind":"element","id":"characters"}]}]}]},{"kind":"element","id":"divider"},{"kind":"group","inset":true,"gap":10,"items":[{"kind":"element","id":"import-image"},{"kind":"tabs","id":"input-tabs","tabs":[{"title":"Image","icon":"img2img","items":[{"kind":"element","id":"input-image"}]},{"title":"Vibes","icon":"vibe-transfer","items":[{"kind":"element","id":"vibe-transfer"}]},{"title":"References","icon":"reference","items":[{"kind":"element","id":"character-references"}]}]}]}]},{"kind":"group","className":"image-gen-footer","inset":true,"gap":15,"items":[{"kind":"element","id":"banner-stack"},{"kind":"element","id":"generate"}]}]},{"kind":"stage","items":[{"kind":"element","id":"results-viewer","options":{"bars":{"top":{"overflow":"wrap","start":[["display.resolution","divider","display.settings"]],"end":[["display.old-compare"],["save.contest","save.pin","save.copy","save.download"],["save.info"],["save.explore-upload"]]},"bottom":{"hideWithout":"image","center":[["actions.enhance","actions.variations","actions.upscale","divider","actions.set-init","actions.edit","actions.inpaint","actions.send-to-tools"]]}}}}]},{"kind":"panel","id":"settings","name":"image.settings","width":320,"minWidth":280,"maxWidth":460,"collapsible":true,"collapseStyle":"rail","shrinkPriority":2,"items":[{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"gap":10,"items":[{"kind":"element","id":"resolution"},{"kind":"element","id":"image-count"},{"kind":"element","id":"steps"},{"kind":"element","id":"guidance"},{"kind":"row","gap":20,"items":[{"kind":"element","id":"seed"},{"kind":"element","id":"sampler"}]},{"kind":"group","title":"image.advancedSettings","collapsible":true,"collapsed":true,"inline":true,"items":[{"kind":"element","id":"cfg-rescale"},{"kind":"element","id":"noise-schedule"},{"kind":"element","id":"legacy-uc"}]}]}]}]},{"kind":"panel","id":"history-rail","name":"image.history","icon":"history","width":140,"minWidth":140,"maxWidth":420,"collapsible":true,"collapseStyle":"rail","shrinkPriority":1,"items":[{"kind":"element","id":"history"}]}]},
  {"id":"layout-e","name":"Layout E","columns":[{"kind":"panel","id":"history-rail","name":"image.history","icon":"history","width":320,"minWidth":200,"maxWidth":800,"collapsible":true,"collapseStyle":"rail","shrinkPriority":2,"items":[{"kind":"element","id":"history"}]},{"kind":"stage","items":[{"kind":"element","id":"results-viewer","options":{"bars":{"top":{"start":[["display.resolution"]]},"right":{"start":[["display.settings"],["display.old-compare"],["save.contest","save.pin","save.copy","save.download"],["save.info"],["save.explore-upload"]]},"bottom":{"hideWithout":"image","center":[["actions.enhance","actions.variations","actions.upscale","divider","actions.set-init","actions.edit","actions.inpaint","actions.send-to-tools"]]}}}}]},{"kind":"panel","id":"settings","name":"image.settings","width":320,"minWidth":280,"maxWidth":460,"collapsible":true,"collapseStyle":"rail","shrinkPriority":1,"items":[{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"gap":10,"items":[{"kind":"element","id":"resolution"},{"kind":"element","id":"image-count"},{"kind":"element","id":"steps"},{"kind":"element","id":"guidance"},{"kind":"row","gap":20,"items":[{"kind":"element","id":"seed"},{"kind":"element","id":"sampler"}]},{"kind":"group","title":"image.advancedSettings","collapsible":true,"collapsed":true,"inline":true,"items":[{"kind":"element","id":"cfg-rescale"},{"kind":"element","id":"noise-schedule"},{"kind":"element","id":"legacy-uc"}]}]}]}]},{"kind":"panel","id":"controls","name":"image.settings","width":450,"minWidth":450,"maxWidth":640,"shrinkPriority":3,"items":[{"kind":"row","className":"image-gen-nav-row","bar":true,"justify":"space-between","items":[{"kind":"element","id":"nav-menu","flex":0},{"kind":"element","id":"anlas-balance","flex":0},{"kind":"element","id":"nav-back","flex":0}]},{"kind":"group","scroll":true,"items":[{"kind":"group","inset":true,"items":[{"kind":"element","id":"model-mode-row"}]},{"kind":"element","id":"divider"},{"kind":"group","inset":true,"items":[{"kind":"element","id":"import-image"}]},{"kind":"element","id":"divider"},{"kind":"group","inset":true,"gap":20,"items":[{"kind":"element","id":"legacy-notice"},{"kind":"element","id":"dev-tools"},{"kind":"element","id":"prompt","options":{"minLines":6,"maxLines":10}}]},{"kind":"element","id":"divider"},{"kind":"group","inset":true,"gap":10,"items":[{"kind":"tabs","id":"input-tabs","tabs":[{"title":"Image","icon":"img2img","items":[{"kind":"element","id":"input-image"}]},{"title":"Vibes","icon":"vibe-transfer","items":[{"kind":"element","id":"vibe-transfer"}]},{"title":"References","icon":"reference","items":[{"kind":"element","id":"character-references"}]}]}]},{"kind":"element","id":"divider"},{"kind":"group","inset":true,"items":[{"kind":"element","id":"characters"}]}]},{"kind":"group","className":"image-gen-footer","inset":true,"gap":15,"items":[{"kind":"element","id":"banner-stack"},{"kind":"element","id":"generate"}]}]}]}
];
/* 결과 화면 단추 줄 — 배치에 bars 가 없을 때(Layout A·C) NAI 기본값 Fz, 단추 이름 목록 FF, 넘칠 때 남기는 우선순위 FU(작을수록 먼저 ⋯ 로) */
const NL_BARS_DEFAULT = { top: { hideWithout: 'image', center: [['actions.enhance', 'actions.variations', 'actions.upscale', 'divider', 'actions.set-init', 'actions.edit', 'actions.inpaint', 'actions.send-to-tools']] },
  bottom: { overflow: 'wrap', start: [['display.resolution', 'divider', 'display.settings', 'save.seed']], end: [['display.old-compare'], ['save.contest', 'save.pin', 'save.copy', 'save.download'], ['save.info'], ['save.explore-upload']] } };
const NL_PRIO = { divider: 0, 'actions.enhance': 10, 'actions.variations': 9, 'actions.upscale': 8, 'actions.set-init': 5, 'actions.edit': 6, 'actions.inpaint': 4, 'actions.send-to-tools': 3,
  'display.resolution': 5, 'display.settings': 5, 'display.old-compare': 3, 'save.contest': 7, 'save.pin': 8, 'save.copy': 9, 'save.download': 10, 'save.seed': 2, 'save.info': 2, 'save.explore-upload': 1 };
/* NAI 단추 → 우리 단추. 우리에게만 있는 단추는 NAI 의 비슷한 단추 옆에 같이 둔다(바이브·레퍼런스로 보내기는 «바탕 그림으로» 옆 등).
   save.contest(콘테스트 출품)·save.explore-upload(Explore 올리기)는 우리 앱에 없다 — Explore 는 2026-10-16 사용자가 «넣지 않기»를 골랐다. */
const NL_WIDGETS = {
  'actions.enhance': ['#tEnhance'], 'actions.variations': ['#tVary'], 'actions.upscale': ['#tUpscale'], 'actions.set-init': ['#tToI2i', '#tToVibe', '#tToPref'],
  'actions.edit': ['#tEdit'], 'actions.inpaint': ['#tInpaint'], 'actions.send-to-tools': ['#tDirector'],
  'display.resolution': ['#viewerMeta'], 'display.settings': ['#tView'], 'display.old-compare': ['#tOld', '#tInspect'],
  'save.contest': [], 'save.pin': ['#tFav', '#tPin'], 'save.copy': ['#tCopyImg', '#tCopy'], 'save.download': ['#tSave', '#tSaveClean'],
  'save.seed': ['#tSeed', '#tApply'], 'save.info': ['#tMeta'], 'save.explore-upload': [],
};
/* NAI 화면 글 열쇠 → 우리 화면 글 */
const NL_TEXT = { 'image.settings': '설정', 'image.history': '히스토리', 'image.imageInputs': '이미지 입력', 'image.imageSettings': '이미지 설정',
  'image.aiSettings': 'AI 설정', 'image.advancedSettings': '고급 설정', 'Nav + Settings': '메뉴 + 설정', 'History + Inputs': '히스토리 + 입력', Prompt: '프롬프트',
  Image: '이미지', Characters: '캐릭터', Vibes: '바이브', References: '레퍼런스', Settings: '설정' };
const NL_ICON = { img2img: '🖼', person: '👤', 'vibe-transfer': '🎨', history: '🕘', reference: '🪞', prompt: '✎', settings: '⚙' };
const NL_PANEL_MIN = 200;     // NAI Gm: minWidth 이 없으면 200
const NL_RAIL = 40;           // 접힌 띠 폭 (NAI Gv)
const NL_STAGE_MIN = 360;     // 창이 좁을 때 결과 화면에 남길 폭 (NAI Gr 의 +360)
const NL_MOBILE = 900;        // NAI MOBILE_WIDTH

const NL = { on: false, id: '', pieces: null, marks: new Map(), park: null, root: null, menuPop: null, menuOpen: false, squeezed: new Set(), floatId: '',
  drag: false, sig: '', rq: 0, bars: null, iconSide: { left: false, right: false }, noUcDetach: false, rzT: 0, obs: null, seen: false };

const nlPreset = () => NL_PRESETS.find(p => p.id === S.pageLayout) || null;
function nlOv(pid) {
  if (!S.layoutOverlay || typeof S.layoutOverlay !== 'object' || Array.isArray(S.layoutOverlay)) S.layoutOverlay = {};
  const o = S.layoutOverlay[pid];
  return o && typeof o === 'object' ? o : (S.layoutOverlay[pid] = {});
}
// NAI ImageLayoutOverlay 쓰기: { [배치]: { panelWidths, collapsedPanels, collapsed, groupHeights, activeTabs } }
function nlOvPut(pid, key, sub, val) { const o = nlOv(pid); o[key] = { ...(o[key] && typeof o[key] === 'object' ? o[key] : {}), [sub]: val }; save(); }
const nlOvGet = (pid, key, sub) => { const o = nlOv(pid)[key]; return o && typeof o === 'object' ? o[sub] : undefined; };
const nlText = k => (k == null ? '' : (NL_TEXT[k] || k));
function nlH(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
// NAI AC: 스크롤 막대가 자리를 차지하지 않는(겹치는) 화면인가 — 묶음의 오른쪽 여백을 정한다
function nlOverlayScroll() {
  if (NL._ovs != null) return NL._ovs;
  const e = document.createElement('div'); e.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;padding:0;border:0;overflow:scroll';
  document.body.appendChild(e); NL._ovs = e.offsetWidth === e.clientWidth; e.remove(); return NL._ovs;
}

/* ── 칸이 보이는 조건 (NAI Af) ── */
function nlVisible(id) {
  const c = capsOf(S.model), fx = fixedOf(S.model);
  switch (id) {
    case 'characters': return !!c.maxChars;
    case 'vibe-transfer': return !!c.vibe && !R.prefs.length;
    case 'character-references': return !!c.charRef;
    case 'steps': case 'sampler': return !fx;
    case 'cfg-rescale': return !!c.cfgRescale;
    // NAI N9: 노이즈 스케줄을 안 쓰는 샘플러(DDIM)면 칸이 비고, V5 는 칸 자체가 없다
    case 'noise-schedule': return !!c.noiseSchedule && schedulesFor(S.model, effSampler(S.model)).length > 0;
    case 'legacy-uc': return !!c.noiseSchedule && !!c.legacyUcOk;
    case 'legacy-notice': case 'dev-tools': case 'model': return false;   // legacy_v3_extend 는 늘 false · 개발 도구는 실제 사이트에 없음 · model 은 배치 틀에 없음
    default: return true;
  }
}
function nlAnyVisible(items) {
  return (items || []).some(it => it.kind === 'element' ? nlVisible(it.id)
    : (it.kind === 'row' || it.kind === 'group') ? nlAnyVisible(it.items) : it.kind === 'tabs' ? it.tabs.some(t => nlAnyVisible(t.items)) : false);
}
function nlIds(items) {   // NAI GY: 묶음·줄·탭 안의 칸 이름 전부(묶음 머리 칸 포함)
  const out = [];
  for (const it of items || []) {
    if (it.kind === 'element') out.push(it.id);
    else if (it.kind === 'row') out.push(...it.items.map(x => x.id));
    else if (it.kind === 'group') { if (it.headerElement) out.push(it.headerElement); out.push(...nlIds(it.items)); }
    else if (it.kind === 'tabs') for (const t of it.tabs) out.push(...nlIds(t.items));
  }
  return out;
}

/* ── 우리 앱의 칸 (처음 켤 때 한 번 찾아 둔다) ── */
function nlPieceNodes() {
  const q = s => document.querySelector(s), up = (s, sel) => { const e = q(s); return e ? e.closest(sel) : null; };
  const seedBody = up('#seed', '.card-body');
  return {
    'anlas-balance': [q('#anlas')],
    'model-mode-row': [up('#model', '.row'), q('#effortSeg'), q('#furryRow')],   // NAI 모델·모드(Anime/Furry)·생성 모드(Effort)
    'resolution': [up('#sizePreset', '.row')],
    'image-count': [q('#batchSeg')],
    // NAI 프롬프트 칸에는 프롬프트 설정(퀄리티 태그·UC 프리셋·투명 배경)이 같이 있다
    'prompt': [q('#promptCard'), up('#quality', 'label'), up('#ucPreset', 'label'), q('#transpRow')],
    'characters': [up('#btnAddChar', '.chead'), q('#charList'), q('#charWarn')],
    'input-image': [q('#panelI2i')], 'vibe-transfer': [q('#panelVibe')], 'character-references': [q('#panelPref')],
    'steps': [up('#steps', 'label')],
    // NAI 가이던스 칸: 슬라이더 + Variety+·디크리스퍼 + 경고 (N7)
    'guidance': [up('#scale', 'label'), q('#scaleWarn'), q('#sigmaWarn'), up('#variety', '.grid2')],
    'cfg-rescale': [up('#rescale', 'label')],
    'sampler': [up('#sampler', 'label'), q('#v3Box')],
    'noise-schedule': [up('#schedule', 'label')],
    'legacy-uc': [q('#v4Box')],
    'ai-settings-reset': [q('#btnAiReset')],
    'seed': seedBody ? [...seedBody.children] : [],
    'banner-stack': [q('#opusBar'), q('#attachBar')],   // NAI 사용량 막대(OpusUsageBanner) 자리 + 우리 «붙은 이미지» 칩
    'generate': [q('#center > .genbar')],
    'results-viewer': [q('#center > .card.viewer')],
    'history': [up('#histGrid', '.card')],
    'x-extras': [up('#quality', 'details.card'), up('#enhStr', 'details.card'), up('#autoCount', '.card'), up('#autoSaveOn', 'details.card')],
  };
}
const NL_HEAD = { 'input-image': '이미지→이미지', 'vibe-transfer': '바이브', 'character-references': 'Precise Reference' };
function nlMark(n) {   // 원래 자리에 표시를 남긴다 (한 번만)
  if (!n || NL.marks.has(n)) return;
  const m = document.createComment('nl'); n.parentNode.insertBefore(m, n); NL.marks.set(n, m);
}
function nlBack(n) { const m = NL.marks.get(n); if (m && m.parentNode && n) m.parentNode.insertBefore(n, m.nextSibling); }
function nlPieces() {
  if (NL.pieces) return NL.pieces;
  const defs = nlPieceNodes(), out = new Map();
  for (const [id, nodes] of Object.entries(defs)) {
    const xs = nodes.filter(Boolean);
    if (!xs.length) { logErr('화면 배치: 칸 «' + id + '» 를 찾지 못했습니다'); continue; }
    const w = nlH('div', 'nl-el'); w.dataset.nlEl = id;
    if (NL_HEAD[id]) w.appendChild(nlH('div', 'nl-el-head', NL_HEAD[id]));
    out.set(id, { nodes: xs, wrap: w });
  }
  NL.pieces = out; return out;
}

/* ── 켜기·끄기 ── */
function nlWanted() { return S.mode === 'main' && !!nlPreset() && window.innerWidth > NL_MOBILE; }
function nlSync() {
  const want = nlWanted();
  if (NL.on && (!want || NL.id !== S.pageLayout)) nlExit();
  if (want && !NL.on) nlEnter();
  else if (NL.on) nlRefresh();
}
function nlEnter() {
  const p = nlPreset(); if (!p) return;
  const pieces = nlPieces();
  NL.park = NL.park || Object.assign(nlH('div', 'nl-park'), { hidden: true });
  document.body.appendChild(NL.park);
  for (const { nodes, wrap } of pieces.values()) { for (const n of nodes) { nlMark(n); wrap.appendChild(n); } NL.park.appendChild(wrap); }
  // 머리 줄(메뉴·모드 탭·도구 단추)은 NAI 처럼 ☰ 메뉴 안으로
  const tb = $('#topbar');
  if (tb) { nlMark(tb); NL.menuPop = NL.menuPop || Object.assign(nlH('div', 'nl-menu-pop'), { id: 'nlMenuPop', hidden: true }); NL.menuPop.appendChild(tb); document.body.appendChild(NL.menuPop); }
  NL.root = nlH('div', 'nl-root'); NL.root.id = 'nlRoot';
  $('#layout').appendChild(NL.root);
  document.body.classList.add('nl-on');
  NL.on = true; NL.id = p.id; NL.floatId = ''; NL.menuOpen = false;
  // NAI 의 이미지 입력 칸은 탭으로 고르지 않고 칸마다 보인다
  for (const id of ['#panelI2i', '#panelVibe', '#panelPref']) { const e = $(id); if (e) e.hidden = false; }
  NL.noUcDetach = nlHasOpt(p, 'prompt', 'disableUcDetach');
  if (typeof applyUcLayout === 'function') applyUcLayout();
  nlBarsBuild(p);
  nlRender();
  if (!NL.obs) nlObserveAlerts();
  if (typeof ovwSync === 'function') setTimeout(ovwSync, 0);
}
function nlExit() {
  if (!NL.on) return;
  nlMenuShow(false);
  nlBarsRestore();
  for (const { nodes } of NL.pieces.values()) for (const n of nodes) nlBack(n);
  const tb = $('#topbar'); if (tb) nlBack(tb);
  if (NL.root) NL.root.remove(); NL.root = null;
  if (NL.park) NL.park.remove();
  if (NL.menuPop) NL.menuPop.remove();
  document.body.classList.remove('nl-on');
  // 배치 때 붙인 표시를 지운다 (3단 배치에서는 효과가 없지만 남겨 두지 않는다)
  for (const e of [...document.querySelectorAll('.nl-off')]) e.classList.remove('nl-off');
  { const pr = $('#promptCard'); if (pr) { pr.classList.remove('nl-lines', 'nl-fill'); pr.style.removeProperty('--nl-minl'); pr.style.removeProperty('--nl-maxl'); } }
  NL.on = false; NL.id = ''; NL.sig = ''; NL.noUcDetach = false;
  if (typeof applyUcLayout === 'function') applyUcLayout();
  const t = $('.reftab.on'); if (typeof switchRefTab === 'function') switchRefTab(t ? t.dataset.t : 'i2i');
  if (typeof ovwSync === 'function') setTimeout(ovwSync, 0);
  if (typeof fitViewerBg === 'function') setTimeout(fitViewerBg, 0);
}
function nlHasOpt(p, id, key) {
  const walk = items => (items || []).some(it => (it.kind === 'element' && it.id === id && it.options && it.options[key])
    || ((it.kind === 'row' || it.kind === 'group') && walk(it.items)) || (it.kind === 'tabs' && it.tabs.some(t => walk(t.items))));
  return p.columns.some(c => walk(c.items));
}

/* ── 그리기 ── */
function nlParkIn(el) {   // el 안에 든 우리 칸을 보관함으로 (새로 그리기 전에)
  if (!el || !NL.park) return;
  for (const w of [...el.querySelectorAll('.nl-el')]) if (w.dataset.nlEl && NL.pieces.get(w.dataset.nlEl) && NL.pieces.get(w.dataset.nlEl).wrap === w) NL.park.appendChild(w);
}
function nlVisSig() { return ['characters', 'vibe-transfer', 'character-references', 'steps', 'sampler', 'cfg-rescale', 'noise-schedule', 'legacy-uc'].map(id => +nlVisible(id)).join(''); }
/* 다시 그리면 스크롤 칸이 새로 생기거나 옮겨져 맨 위로 돌아간다 — 그리기 전 자리를 적어 두었다가 되돌린다 */
function nlScrollKeep() {
  const out = [];
  if (!NL.root) return out;
  for (const e of NL.root.querySelectorAll('.nl-group.scroll[data-path], .nl-panel, #histGrid, textarea, .nl-tabbody')) {
    if (e.scrollTop > 0) out.push({ key: e.id ? '#' + e.id : (e.dataset.path ? 'p:' + e.dataset.path : (e.dataset.panel ? 'panel:' + e.dataset.panel : '')), el: e.id || e.tagName === 'TEXTAREA' ? e : null, top: e.scrollTop });
  }
  return out;
}
function nlScrollBack(list) {
  for (const s of list) {
    const e = s.el && s.el.isConnected ? s.el : (s.key.startsWith('p:') ? NL.root.querySelector(`.nl-group.scroll[data-path="${s.key.slice(2)}"]`) : s.key.startsWith('panel:') ? NL.root.querySelector(`.nl-panel[data-panel="${s.key.slice(6)}"]`) : null);
    if (e) e.scrollTop = s.top;
  }
}
function nlRender() {
  const p = nlPreset(); if (!p || !NL.root) return;
  const keep = nlScrollKeep();
  nlParkIn(NL.root); NL.root.innerHTML = '';
  NL.squeezed = nlSqueezed(p);
  NL.sig = nlVisSig();
  const si = p.columns.findIndex(c => c.kind === 'stage'), ov = nlOv(p.id);
  // NAI Gr 의 Fq: 작은 단추(icon)로 접혔거나 저절로 접힌 icon 패널이 있는 쪽은 결과 화면 위 단추 줄이 32px 비켜 선다
  NL.iconSide = { left: false, right: false };
  p.columns.forEach((c, i) => {
    if (c.kind !== 'panel' || nlIsRail(c)) return;
    if ((c.collapsible && (ov.collapsedPanels || {})[c.id]) || NL.squeezed.has(c.id)) NL.iconSide[si !== -1 && i > si ? 'right' : 'left'] = true;
  });
  p.columns.forEach((c, i) => NL.root.appendChild(c.kind === 'stage' ? nlStage(p, c, 's' + i) : nlPanel(p, c, si !== -1 && i > si ? 'right' : 'left')));
  nlScrollBack(keep);
  nlRefresh(true);
}
const nlIsRail = c => (c.collapseStyle || 'rail') === 'rail';
function nlPanelW(p, c) { const v = (nlOv(p.id).panelWidths || {})[c.id]; return v != null ? v : (c.width != null ? c.width : 150); }
function nlSqueezed(p) {   // NAI Gr: 창이 좁으면 shrinkPriority 낮은 패널부터 접는다 (360 은 결과 화면 몫)
  const ov = nlOv(p.id), isCol = c => !!(c.collapsible && (ov.collapsedPanels || {})[c.id]);
  const panels = p.columns.filter(c => c.kind === 'panel'), open = panels.filter(c => !isCol(c));
  let g = open.reduce((a, c) => a + nlPanelW(p, c), 0) + NL_RAIL * panels.filter(c => isCol(c) && nlIsRail(c)).length + NL_STAGE_MIN;
  const out = new Set();
  for (const c of open.filter(c => c.shrinkPriority !== undefined).sort((a, b) => (a.shrinkPriority || 0) - (b.shrinkPriority || 0))) {
    if (g <= window.innerWidth) break;
    out.add(c.id); g -= nlPanelW(p, c) - NL_RAIL * (nlIsRail(c) ? 1 : 0);
  }
  return out;
}
function nlStage(p, c, key) {
  const d = nlH('div', 'nl-stage'); d.style.flex = `${c.flex != null ? c.flex : 1} 1 0px`;
  nlItems(p, c.items, key, { insideTitled: false, insideScroll: false }, d);
  const hint = nlH('div', 'nl-hint', '패널 하나가 접혀서 자리를 만듭니다'); hint.hidden = true; d.appendChild(hint);   // NAI stageSqueezeHint
  return d;
}
function nlPanel(p, c, side) {
  const ov = nlOv(p.id), collapsed = !!(c.collapsible && (ov.collapsedPanels || {})[c.id]), squeezed = NL.squeezed.has(c.id), rail = nlIsRail(c);
  const name = nlText(c.name) || c.id;
  const col = nlH('div', 'nl-col'); col.dataset.panel = c.id; col.dataset.side = side;
  const setCollapsed = v => { nlOvPut(p.id, 'collapsedPanels', c.id, v); nlRender(); };
  if (collapsed) {
    // NAI: 접힌 패널을 펴면, 창이 좁아 저절로 접힐 패널이면 떠서 열린다
    const open = () => { nlOvPut(p.id, 'collapsedPanels', c.id, false); NL.floatId = nlSqueezed(p).has(c.id) ? c.id : ''; nlRender(); };
    col.appendChild(rail ? nlRailBtn(p, c, side, name, open) : nlIconBtn(c, side, name, open));
    col.classList.add(rail ? 'rail' : 'iconc');
    return col;
  }
  if (squeezed) {
    const toggle = () => { NL.floatId = NL.floatId === c.id ? '' : c.id; nlRender(); };
    col.classList.add(rail ? 'rail' : 'iconc');
    col.appendChild(rail ? nlRailBtn(p, c, side, name, toggle) : nlIconBtn(c, side, name, toggle));
    if (NL.floatId === c.id) {
      const fl = nlH('div', 'nl-float'); fl.dataset.side = side; fl.style[side] = rail ? '100%' : '0';
      fl.appendChild(nlPanelBody(p, c, side, true, () => { NL.floatId = ''; nlRender(); }));
      col.appendChild(fl);
    }
    return col;
  }
  col.appendChild(nlPanelBody(p, c, side, false, () => setCollapsed(true)));
  return col;
}
function nlRailBtn(p, c, side, name, onClick) {   // NAI Gv: 40px 띠 — 아이콘 · 세로 제목 · 배지(H7)
  const b = nlH('button', 'nl-rail'); b.type = 'button'; b.dataset.side = side; b.title = name + ' 열기';
  b.appendChild(nlH('span', 'nl-rail-ico', NL_ICON[c.icon] || (side === 'right' ? '◀' : '▶')));
  b.appendChild(nlH('span', 'nl-rail-t', name));
  const bd = nlH('span', 'nl-rail-bd'); bd.dataset.ids = [...new Set(nlIds(c.items))].join(','); b.appendChild(bd);
  b.onclick = onClick; return b;
}
function nlIconBtn(c, side, name, onClick) {   // NAI collapseStyle "icon": 위쪽 18px·옆 7px 에 뜬 30px 단추
  const w = nlH('div', 'nl-iconw'); w.dataset.side = side;
  const b = nlH('button', 'nl-icon', NL_ICON[c.icon] || (side === 'right' ? '◀' : '▶')); b.type = 'button'; b.title = name + ' 열기';
  b.onclick = onClick; w.appendChild(b); return w;
}
function nlPanelBody(p, c, side, floating, collapse) {
  const ov = nlOv(p.id), clamp = w => Math.min(Math.max(w, c.minWidth != null ? c.minWidth : NL_PANEL_MIN), c.maxWidth != null ? c.maxWidth : Number.MAX_SAFE_INTEGER);
  const pw = (ov.panelWidths || {})[c.id], width = c.width === undefined ? undefined : clamp(pw != null ? pw : c.width);
  const d = nlH('div', 'nl-panel'); d.dataset.side = side; d.dataset.panel = c.id;
  if (c.frame !== false || floating) d.classList.add('framed');
  if (width !== undefined) d.style.width = width + 'px';
  d.style.flex = floating ? '1 1 auto' : '0 0 auto';
  if (c.width !== undefined && c.minWidth !== c.maxWidth) {
    d.appendChild(Object.assign(nlH('div', 'nl-dragbar'), { title: '끌어서 패널 넓이 바꾸기' }));
    d.addEventListener('mousedown', e => nlPanelDrag(e, p, c, side, d, clamp));
  }
  const ids = nlIds(c.items);
  if (c.collapsible && !ids.includes('panel-collapse')) {   // NAI Gy: 결과 화면 쪽 끝에 접기 단추
    const hd = nlH('div', 'nl-phead'); hd.dataset.side = side;
    const b = nlH('button', 'nl-pcollapse'); b.type = 'button'; b.title = (nlText(c.name) || c.id) + ' 접기';
    b.textContent = side === 'right' ? (nlText(c.name) || c.id) + ' ▸' : '◂ ' + (nlText(c.name) || c.id);
    b.onclick = collapse; hd.appendChild(b); d.appendChild(hd);
  }
  nlItems(p, c.items, c.id, { insideTitled: false, insideScroll: false, collapse: c.collapsible ? collapse : null, side }, d);
  return d;
}
function nlPanelDrag(e, p, c, side, d, clamp) {   // NAI Gm: 결과 화면 쪽 가장자리 8px 안에서 누르면 넓이 끌기
  const r = d.getBoundingClientRect(), dist = side === 'right' ? e.clientX - r.left : r.right - e.clientX;
  if (dist > 8 || dist < 0 || e.button !== 0) return;
  e.preventDefault();
  NL.drag = true; d.classList.add('dragging');
  const us = document.body.style.userSelect; document.body.style.userSelect = 'none';
  // NAI 는 clientWidth 에서 시작한다 — NAI 패널은 보통 상자(content-box)라 그 값이 곧 넓이다. 우리 앱은 테두리까지 넓이(border-box)라 offsetWidth 가 같은 값
  const x0 = e.pageX, w0 = d.offsetWidth, dir = side === 'right' ? -1 : 1;
  const mv = ev => { ev.preventDefault(); d.style.width = clamp(w0 + dir * (ev.pageX - x0)) + 'px'; nlHint(); };
  document.addEventListener('mousemove', mv);
  document.addEventListener('mouseup', () => {
    NL.drag = false; d.classList.remove('dragging'); document.body.style.userSelect = us; document.removeEventListener('mousemove', mv);
    const w = parseInt(d.style.width, 10); nlHint();
    if (!Number.isNaN(w)) { nlOvPut(p.id, 'panelWidths', c.id, w); if (nlSigSqueeze(p)) nlRender(); }
  }, { once: true });
}
function nlSigSqueeze(p) { const s = nlSqueezed(p); return s.size !== NL.squeezed.size || [...s].some(x => !NL.squeezed.has(x)); }
function nlHint() {   // NAI Gh: 패널을 끄는 동안 결과 화면 폭이 360 아래면 «패널 하나가 접힙니다»
  const st = NL.root && NL.root.querySelector('.nl-stage'); if (!st) return;
  const h = st.querySelector('.nl-hint'); if (h) h.hidden = !(NL.drag && st.clientWidth < NL_STAGE_MIN);
}

/* 칸 목록 (NAI GT) — 스크롤 묶음 앞뒤·결과 화면과 묶음 사이에 구분선 */
function nlItems(p, items, path, ctx, into) {
  const isScroll = it => it && it.kind === 'group' && it.scroll === true, isBar = it => it && it.kind === 'row' && it.bar === true, isRV = it => it && it.kind === 'element' && it.id === 'results-viewer';
  (items || []).forEach((it, i) => {
    const prev = i > 0 ? items[i - 1] : undefined, key = path + '.' + i;
    if (prev !== undefined && ((isScroll(prev) !== isScroll(it) && !isBar(prev) && !isBar(it)) || (isRV(prev) && it.kind === 'group') || (prev.kind === 'group' && isRV(it)))) into.appendChild(nlH('div', 'nl-sep'));
    const el = it.kind === 'element' ? nlElement(p, it, ctx) : it.kind === 'group' ? nlGroup(p, it, key, ctx) : it.kind === 'row' ? nlRow(p, it, ctx) : it.kind === 'tabs' ? nlTabs(p, it, ctx) : null;
    if (el) into.appendChild(el);
  });
}
function nlElement(p, it, ctx) {
  if (!nlVisible(it.id)) return null;
  switch (it.id) {
    case 'nav-back': {   // NAI: 펜 단추 = 고른 그림을 풀기(SelectedImageResult 비움)
      const b = nlH('button', 'nl-nb', '✒'); b.type = 'button'; b.title = '고른 그림 풀기 — 결과를 고르지 않은 상태로 (NAI 펜 단추)';
      b.onclick = () => { R.cur = -1; if (typeof clearViewer === 'function') clearViewer(); if (typeof histMarkCur === 'function') histMarkCur(-1); }; return b;
    }
    case 'nav-menu': {
      const b = nlH('button', 'nl-nb nl-menu-btn', '☰'); b.type = 'button'; b.title = '메뉴 — 모드 탭·도구·설정';
      b.onclick = e => { e.stopPropagation(); nlMenuShow(!NL.menuOpen, b); }; NL.menuBtn = b; nlMenuBadge(); return b;
    }
    case 'panel-collapse': {
      if (!ctx.collapse) return null;
      const b = nlH('button', 'nl-nb', ctx.side === 'right' ? '▸' : '◂'); b.type = 'button'; b.title = '패널 접기'; b.onclick = ctx.collapse; return b;
    }
    case 'spacer': return null;
    case 'divider': return nlH('div', 'nl-divider');
    case 'import-image': {   // NAI 이미지 가져오기 칸: 그림을 골라 가져오기 창으로 (화면에 끌어다 놓아도 같음)
      const box = nlH('div', 'nl-import');
      box.appendChild(nlH('span', 'nl-import-ico', '📥'));
      const tx = nlH('div', 'nl-import-tx'); tx.appendChild(nlH('b', '', '이미지 가져오기')); tx.appendChild(nlH('div', 'hint', '고치거나 참고로 쓸 그림을 가져옵니다.')); box.appendChild(tx);
      const b = nlH('button', 'btn sm', '📥'); b.type = 'button'; b.title = '그림 파일 고르기';
      b.onclick = () => pickFiles(false, f => { if (typeof openImportDialog === 'function') openImportDialog(f); });
      box.appendChild(b); return box;
    }
    default: {
      const pc = NL.pieces.get(it.id); if (!pc) return null;
      const w = pc.wrap;
      w.classList.toggle('fill', !!(it.options && it.options.fill) || it.id === 'results-viewer' || it.id === 'history');
      const pr = it.id === 'prompt' ? $('#promptCard') : null;
      if (pr) {
        const o = it.options || {};
        if (o.minLines) pr.style.setProperty('--nl-minl', o.minLines); else pr.style.removeProperty('--nl-minl');
        if (o.maxLines) pr.style.setProperty('--nl-maxl', o.maxLines); else pr.style.removeProperty('--nl-maxl');
        pr.classList.toggle('nl-fill', !!o.fill); pr.classList.toggle('nl-lines', !!(o.minLines || o.maxLines));
      }
      return w;
    }
  }
}
function nlRow(p, it, ctx) {   // NAI Gz
  const d = nlH('div', 'nl-row' + (it.bar ? ' bar' : '') + (it.className ? ' ' + it.className : ''));
  d.style.justifyContent = { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' }[it.justify || 'start'];
  d.style.gap = (it.gap != null ? it.gap : 10) + 'px';
  for (const e of it.items) {
    const el = nlElement(p, e, ctx);
    if (e.flex === undefined) { if (el) d.appendChild(el); continue; }
    const w = nlH('div', 'nl-flex'); w.style.flex = e.flex === 0 ? '0 0 auto' : `${e.flex} 1 0px`;
    if (el) w.appendChild(el); d.appendChild(w);
  }
  return d;
}
function nlGroup(p, g, path, ctx) {   // NAI GD
  const titled = g.title !== undefined, collapsed = !!g.collapsible && (nlOvGet(p.id, 'collapsed', path) ?? g.collapsed ?? false);
  if (titled && !nlAnyVisible(g.items)) return null;
  const T = nlOverlayScroll(), R12 = ctx.insideScroll && !T ? 0 : 12, P = ctx.insideTitled || g.inline === true;
  const L = !!g.scroll || (!g.inset && (!titled || !g.collapsible || P) && ctx.insideScroll);
  const toggle = () => { nlOvPut(p.id, 'collapsed', path, !collapsed); nlRender(); };
  const pad = g.inset === 'open-bottom' ? `12px ${R12}px 0 12px` : g.inset ? `12px ${R12}px 12px 12px` : '';
  const st = {};
  if (g.background !== undefined) Object.assign(st, { background: g.background === 'bg2' ? 'var(--bg1)' : 'var(--bg0)', borderRadius: '8px', border: '1px solid var(--line)' });
  if (g.maxHeight !== undefined) Object.assign(st, { maxHeight: g.maxHeight + 'px', overflowY: 'auto', scrollbarGutter: 'stable' }, T && !g.inset ? { paddingRight: '12px' } : {});
  const dragOk = !!(g.dragTop || g.dragBottom) && !g.scroll && !g.collapsible;
  const clampH = h => Math.min(Math.max(h, g.minHeight != null ? g.minHeight : 0), g.maxHeight != null ? g.maxHeight : Number.MAX_SAFE_INTEGER);
  const savedH = nlOvGet(p.id, 'groupHeights', path), H = (g.height === undefined && savedH === undefined) ? undefined : clampH(savedH != null ? savedH : (g.height || 0));
  if (!g.scroll) {
    if (g.minHeight !== undefined) st.minHeight = g.minHeight + 'px';
    if (H !== undefined) Object.assign(st, { height: H + 'px', flexShrink: '0', overflowY: 'auto', scrollbarGutter: 'stable' }, T && !g.inset ? { paddingRight: '12px' } : {});
    if (dragOk) st.position = 'relative';
  }
  const kids = (into, insideTitled) => nlItems(p, g.items, path, { ...ctx, insideTitled, insideScroll: L }, into);
  const addDrag = d => {
    if (!dragOk) return;
    for (const edge of ['top', 'bottom']) {
      if (!(edge === 'top' ? g.dragTop : g.dragBottom)) continue;
      const h = nlH('div', 'nl-gdrag ' + edge); h.title = '끌어서 높이 바꾸기';
      h.onmousedown = e => {
        e.preventDefault(); h.classList.add('on');
        const us = document.body.style.userSelect; document.body.style.userSelect = 'none';
        const y0 = e.pageY, h0 = d.offsetHeight, s = edge === 'bottom' ? 1 : -1;   // 우리 앱은 테두리까지 높이(border-box) — 끄는 만큼만 바뀌게
        const mv = ev => { ev.preventDefault(); d.style.height = clampH(h0 + s * (ev.pageY - y0)) + 'px'; d.style.flexShrink = '0'; };
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', () => { h.classList.remove('on'); document.body.style.userSelect = us; document.removeEventListener('mousemove', mv);
          const v = parseInt(d.style.height, 10); if (!Number.isNaN(v)) nlOvPut(p.id, 'groupHeights', path, v); }, { once: true });
      };
      d.appendChild(h);
    }
  };
  if (!titled) {
    const d = nlH('div', 'nl-group' + (g.className ? ' ' + g.className : ''));
    if (pad) { d.style.padding = pad; d.style.width = '100%'; }
    Object.assign(d.style, st);
    if (g.gap !== undefined) Object.assign(d.style, { display: 'flex', flexDirection: 'column', gap: g.gap + 'px' });
    if (g.scroll) { Object.assign(d.style, { flex: `${g.flex != null ? g.flex : 1} 1 0px`, minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'auto', scrollbarGutter: 'stable' }); d.classList.add('scroll'); d.dataset.path = path; }
    if (H !== undefined || g.maxHeight !== undefined) Object.assign(d.style, { display: 'flex', flexDirection: 'column' });   // 높이가 정해진 묶음 안의 히스토리가 그 높이를 채운다
    addDrag(d); kids(d, ctx.insideTitled);
    if (g.scroll && nlIds(g.items).includes('image-count')) nlExtras(d);
    return d;
  }
  const cls = 'nl-group titled' + (g.className ? ' ' + g.className : '');
  const title = nlText(g.title);
  if (!g.collapsible) {   // 제목만 있는 묶음
    const d = nlH('div', cls); if (pad) { d.style.padding = pad; d.style.width = '100%'; } Object.assign(d.style, st);
    const hd = nlH('div', 'nl-ghead'); hd.appendChild(nlH('span', 'nl-gtitle', title));
    if (g.headerElement) { const he = nlElement(p, { kind: 'element', id: g.headerElement }, ctx); if (he) hd.appendChild(he); }
    const body = nlH('div', 'nl-gbody'); body.style.gap = (g.gap != null ? g.gap : 10) + 'px';
    d.appendChild(hd); d.appendChild(body); addDrag(d); kids(body, true);
    return d;
  }
  if (P) {   // 다른 제목 묶음 안이거나 inline: 제목 단추 + 화살표
    const d = nlH('div', cls + ' inline');
    const b = nlH('button', 'nl-gtoggle'); b.type = 'button';
    b.appendChild(nlH('span', 'nl-gtitle', title)); b.appendChild(nlH('span', 'nl-garrow', collapsed ? '▸' : '▾'));
    b.onclick = toggle; d.appendChild(b);
    if (!collapsed) { const body = nlH('div', 'nl-gbody'); body.style.marginTop = '5px'; body.style.gap = (g.gap != null ? g.gap : 10) + 'px'; d.appendChild(body); kids(body, true); }
    return d;
  }
  // 접는 카드 묶음 (NAI GN): 접으면 요약 칩(H4), 펴면 제목·머리 칸·접기 단추와 내용
  const d = nlH('div', cls + ' card' + (collapsed ? ' collapsed' : ''));
  if (collapsed) {
    const hd = nlH('div', 'nl-chead');
    const rows = nlH('div', 'nl-chips');
    for (const r of (g.summaryRows || [[...new Set(nlIds(g.items))]])) {
      const ids = r.filter(id => NL_CHIP[id] && nlVisible(id)); if (!ids.length) continue;
      const row = nlH('div', 'nl-chiprow'); row.dataset.ids = ids.join(','); rows.appendChild(row);
    }
    hd.appendChild(rows);
    const b = nlH('button', 'nl-cexp', '▸'); b.type = 'button'; b.title = title + ' 펴기'; b.onclick = toggle; hd.appendChild(b);
    d.appendChild(hd);
    return d;
  }
  const hd = nlH('div', 'nl-chead divided'); hd.appendChild(nlH('span', 'nl-gtitle', title));
  const rt = nlH('div', 'nl-chead-r');
  if (g.headerElement) { const he = nlElement(p, { kind: 'element', id: g.headerElement }, ctx); if (he) rt.appendChild(he); }
  const b = nlH('button', 'nl-cexp', '▾'); b.type = 'button'; b.title = title + ' 접기'; b.onclick = toggle; rt.appendChild(b);
  hd.appendChild(rt); d.appendChild(hd);
  const body = nlH('div', 'nl-cbody'); body.style.gap = (g.gap != null ? g.gap : 10) + 'px'; d.appendChild(body);
  kids(body, true);
  return d;
}
function nlExtras(into) {   // NAI 에 없는 우리 기능 묶음
  const pc = NL.pieces.get('x-extras'); if (!pc) return;
  const d = nlH('div', 'nl-extras');
  d.appendChild(nlH('div', 'nl-gtitle', 'NAI Studio 기능'));
  d.appendChild(pc.wrap); into.appendChild(d);
}
function nlTabs(p, it, ctx) {   // NAI GH·G$
  const vis = it.tabs.map((t, i) => ({ t, i })).filter(x => nlAnyVisible(x.t.items));
  if (!vis.length) return null;
  const want = nlOvGet(p.id, 'activeTabs', it.id) ?? 0, sel = vis.some(x => x.i === want) ? want : vis[0].i;
  const d = nlH('div', 'nl-tabs'); d.dataset.tabs = it.id;
  const bar = nlH('div', 'nl-tabbar');
  for (const { t, i } of vis) {
    const b = nlH('button', 'nl-tab' + (i === sel ? ' on' : '')); b.type = 'button';
    if (t.icon && NL_ICON[t.icon]) b.appendChild(nlH('span', 'nl-tab-ico', NL_ICON[t.icon]));
    b.appendChild(nlH('span', '', nlText(t.title)));
    const bd = nlH('span', 'nl-tab-bd'); bd.dataset.ids = nlIds(t.items).filter(x => NL_TABBADGE[x] && nlVisible(x)).join(','); b.appendChild(bd);
    b.onclick = () => { if (i === sel) return; nlOvPut(p.id, 'activeTabs', it.id, i); nlRender(); };
    bar.appendChild(b);
  }
  d.appendChild(bar);
  const body = nlH('div', 'nl-tabbody');
  nlItems(p, it.tabs[sel].items, it.id + '.' + sel, { ...ctx, insideTitled: false }, body);
  d.appendChild(body);
  return d;
}

/* ── 요약 칩 (NAI H4) · 탭 배지 (H8) · 띠 배지 (H7) ── */
const nlSeedSet = () => !S.randomSeed && S.seed !== '' && S.seed != null;
const nlChars = () => (typeof curChars === 'function' ? curChars() : S.chars) || [];
function nlChipBox(label, ...kids) { const d = nlH('label', 'nl-chip'); d.appendChild(nlH('span', 'nl-chip-l', label)); for (const k of kids) if (k) d.appendChild(k); return d; }
function nlChipIn(id, v, min, max, step, title) {   // 칩 안 숫자 칸 — 바꾸면 원래 칸에 넣고 원래 칸의 동작(저장·요금)을 그대로 부른다
  const i = nlH('input', 'nl-chip-in'); i.type = 'number'; i.value = v; i.min = min; i.max = max; i.step = step; i.title = title;
  i.onchange = () => { const src = $('#' + id); if (!src) return; const n = Math.min(+max, Math.max(+min, +i.value || 0)); src.value = n; src.dispatchEvent(new Event('input', { bubbles: true })); src.dispatchEvent(new Event('change', { bubbles: true })); };
  return i;
}
const nlDot = () => nlH('span', 'nl-dot');
const NL_CHIP = {
  steps: () => { const fx = fixedOf(S.model); return nlChipBox('Steps', nlChipIn('steps', fx ? fx.steps : S.steps, 1, 50, 1, 'Steps')); },
  guidance: () => {
    const c = capsOf(S.model), b = nlChipBox('Guidance', nlChipIn('scale', S.scale, 0, 10, 0.1, 'Prompt Guidance'));
    if (c.dynThr && S.decrisper) b.appendChild(nlDot());   // NAI: 디크리스퍼가 켜져 있으면 점
    return b;
  },
  seed: () => {
    const it = curItem(), b = nlH('button', 'nl-chip-b'); b.type = 'button';
    if (nlSeedSet()) { b.textContent = S.seed; b.title = '시드 지우기 (생성할 때마다 무작위)'; b.onclick = e => { e.preventDefault(); S.seed = ''; S.randomSeed = true; syncUI(); save(); }; }
    else { b.textContent = '🌱'; b.title = '보고 있는 그림의 시드 쓰기'; b.disabled = !(it && it.seed != null); b.onclick = e => { e.preventDefault(); if (it && it.seed != null && window.fixSeed) { window.fixSeed(it.seed); syncUI(); } }; }
    return nlChipBox('시드', b);
  },
  sampler: () => {
    const c = capsOf(S.model), s = nlH('select', 'nl-chip-sel'), src = $('#sampler');
    if (src) { s.innerHTML = src.innerHTML; s.value = src.value; s.disabled = src.disabled; }
    s.onchange = () => { if (!src) return; src.value = s.value; src.dispatchEvent(new Event('change', { bubbles: true })); };
    const b = nlChipBox('Sampler', s);
    if ((MODELS[S.model] || {}).ver === 30 && S.autoSmea !== false) b.appendChild(nlDot());   // NAI: SMEA(자동 SMEA)가 켜져 있으면 점 — V3 만 SMEA 가 있다
    return b;
  },
  'cfg-rescale': () => {
    if (!S.rescale) return null;
    const x = nlH('button', 'nl-chip-x', '×'); x.type = 'button'; x.title = '0 으로';
    x.onclick = e => { e.preventDefault(); const src = $('#rescale'); src.value = 0; src.dispatchEvent(new Event('input', { bubbles: true })); src.dispatchEvent(new Event('change', { bubbles: true })); };
    return nlChipBox('Rescale', nlH('span', 'nl-chip-v', String(S.rescale)), x);
  },
  'noise-schedule': () => {
    const smp = effSampler(S.model), def = defaultSchedule(smp);
    if (S.schedule === def) return null;
    const x = nlH('button', 'nl-chip-x', '×'); x.type = 'button'; x.title = '이 샘플러의 기본값(' + def + ')으로';
    x.onclick = e => { e.preventDefault(); const src = $('#schedule'); S.schedule = def; if (src) { src.value = def; src.dispatchEvent(new Event('change', { bubbles: true })); } save(); };
    return nlChipBox('Noise', nlH('span', 'nl-chip-v', S.schedule), x);
  },
  'legacy-uc': () => (S.legacyUc ? nlChipBox('레거시 컨디셔닝', nlH('span', 'nl-chip-v', '✓')) : null),
  characters: () => { const n = nlChars().length; return n ? nlChipBox('👤 캐릭터', nlH('span', 'nl-chip-v', String(n))) : null; },
  'vibe-transfer': () => (R.vibes.length ? nlChipBox('🎨 바이브', nlH('span', 'nl-chip-v', String(R.vibes.length))) : null),
  'character-references': () => (R.prefs.length ? nlChipBox('🪞 레퍼런스', nlH('span', 'nl-chip-v', String(R.prefs.length))) : null),
  'input-image': () => (R.i2iBlob ? nlChipBox(hasMask() ? '🖌 이미지' : '🖼 이미지', nlH('span', 'nl-chip-v', hasMask() ? '인페인트' : 'i2i')) : null),
};
/* 탭 배지 (H8): 켜 둔 캐릭터·바이브·레퍼런스 수, 시드를 정해 두면 점.
   NAI 의 «이미지» 탭 배지는 그림 설정(ImageParams)의 initImage 를 보는데, 바탕 그림은 따로 둔 값(InitImage)이라
   그 칸은 비어 있어 배지가 나오지 않는다(빌드 b50892a). 똑같이 둔다 — 접힌 띠 배지(H7)는 바탕 그림을 제대로 본다. */
const NL_TABBADGE = {
  'input-image': () => null,
  characters: () => { const n = nlChars().filter(c => c && !c.off).length; return n ? nlH('span', 'nl-bnum', String(n)) : null; },
  'vibe-transfer': () => { const n = R.vibes.filter(v => !v.off).length; return n ? nlH('span', 'nl-bnum', String(n)) : null; },
  'character-references': () => { const n = R.prefs.filter(v => !v.off).length; return n ? nlH('span', 'nl-bnum', String(n)) : null; },
  seed: () => (nlSeedSet() ? nlH('span', 'nl-bseed', '🌱') : null),
};
/* 띠 배지 (H7): 그림(인페인트면 붓) · 캐릭터·바이브·레퍼런스 수 · 시드 · 핀 수 */
const NL_RAILBADGE = {
  'input-image': () => (R.i2iBlob ? nlH('span', 'nl-rb', hasMask() ? '🖌•' : '🖼•') : null),
  characters: () => { const n = nlChars().length; return n ? nlH('span', 'nl-rb', '👤' + n) : null; },
  'vibe-transfer': () => (R.vibes.length ? nlH('span', 'nl-rb', '🎨' + R.vibes.length) : null),
  'character-references': () => (R.prefs.length ? nlH('span', 'nl-rb', '🪞' + R.prefs.length) : null),
  seed: () => (nlSeedSet() ? nlH('span', 'nl-rb', '🌱') : null),
  history: () => { const n = typeof pbResolved === 'function' ? pbResolved().length : 0; return n ? nlH('span', 'nl-rb', '📌' + n) : null; },
};
function nlPaintBadges() {
  if (!NL.root) return;
  for (const row of NL.root.querySelectorAll('.nl-chiprow')) {
    row.innerHTML = '';
    for (const id of row.dataset.ids.split(',')) { const f = NL_CHIP[id]; const e = f && nlVisible(id) ? f() : null; if (e) row.appendChild(e); }
  }
  for (const bd of NL.root.querySelectorAll('.nl-tab-bd')) {
    bd.innerHTML = '';
    for (const id of (bd.dataset.ids || '').split(',').filter(Boolean)) { const f = NL_TABBADGE[id]; const e = f && nlVisible(id) ? f() : null; if (e) bd.appendChild(e); }
  }
  for (const bd of NL.root.querySelectorAll('.nl-rail-bd')) {
    bd.innerHTML = '';
    for (const id of (bd.dataset.ids || '').split(',').filter(Boolean)) { const f = NL_RAILBADGE[id]; const e = f && nlVisible(id) ? f() : null; if (e) bd.appendChild(e); }
  }
}
function nlRefresh(fromRender) {
  if (!NL.on) return;
  if (!fromRender && NL.sig !== nlVisSig()) { nlRender(); return; }   // 모델이 바뀌어 칸이 생기거나 사라지면 다시 그린다
  for (const [id, pc] of NL.pieces) pc.wrap.classList.toggle('nl-off', !nlVisible(id));
  // NAI 가이던스 칸: Variety+ 는 받는 모델에서만, 디크리스퍼는 V3 에서만 보인다 (3단 배치는 흐리게 두고 까닭을 적는다)
  { const c = capsOf(S.model), v = $('#variety'), dc = $('#decrisper');
    if (v) v.closest('label').classList.toggle('nl-off', !c.cfgDelay);
    if (dc) dc.closest('label').classList.toggle('nl-off', !c.dynThr); }
  nlPaintBadges();
  nlMenuBadge();
  nlBarsPaint(curItem());
}
function nlRefreshSoon() { if (!NL.on || NL.rq) return; NL.rq = setTimeout(() => { NL.rq = 0; nlRefresh(); }, 0); }
/* 다른 곳(이미지 입력 칩 등)에서 칸을 열어 달라고 할 때: 그 칸이 든 패널·접힌 묶음·탭을 연다 */
function nlReveal(elId) {
  const p = nlPreset(); if (!NL.on || !p) return false;
  const ov = nlOv(p.id); let found = null;
  const walk = (items, path, chain) => {
    (items || []).forEach((it, i) => {
      if (found) return;
      const key = path + '.' + i;
      if (it.kind === 'element' && it.id === elId) { found = chain; return; }
      if (it.kind === 'row' && it.items.some(x => x.id === elId)) { found = chain; return; }
      if (it.kind === 'group') walk(it.items, key, it.collapsible ? [...chain, { g: key }] : chain);
      if (it.kind === 'tabs') it.tabs.forEach((t, ti) => { if (!found) walk(t.items, it.id + '.' + ti, [...chain, { t: it.id, i: ti }]); });
    });
  };
  for (const c of p.columns) { if (found) break; walk(c.items, c.kind === 'stage' ? 's' + p.columns.indexOf(c) : c.id, c.kind === 'panel' ? [{ panel: c.id }] : []); }
  if (!found) return false;
  for (const s of found) {
    if (s.panel) { if ((ov.collapsedPanels || {})[s.panel]) nlOvPut(p.id, 'collapsedPanels', s.panel, false); NL.floatId = nlSqueezed(p).has(s.panel) ? s.panel : ''; }
    if (s.g) nlOvPut(p.id, 'collapsed', s.g, false);
    if (s.t) nlOvPut(p.id, 'activeTabs', s.t, s.i);
  }
  nlRender();
  const pc = NL.pieces.get(elId); if (pc && pc.wrap.isConnected) pc.wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}

/* ── ☰ 메뉴: 머리 줄 전부(앱 이름·서버 상태·모드 탭·도구 단추·설정) ── */
function nlMenuShow(on, btn) {
  const pop = NL.menuPop; if (!pop) return;
  NL.menuOpen = !!on && NL.on;
  pop.hidden = !NL.menuOpen;
  if (NL.menuBtn) NL.menuBtn.classList.toggle('on', NL.menuOpen);
  if (!NL.menuOpen) return;
  // NAI: 메뉴 단추가 든 패널 폭으로, 그 줄 바로 아래에
  const b = btn || NL.menuBtn, panel = b && b.closest('.nl-panel'), bar = b && (b.closest('.nl-row.bar') || b);
  if (!panel || !bar) return;
  const pr = panel.getBoundingClientRect(), br = bar.getBoundingClientRect();
  Object.assign(pop.style, { top: br.bottom + 'px', left: pr.left + 'px', width: Math.max(260, pr.width - 1) + 'px' });
}
function nlMenuBadge() {   // 메뉴 안에 숨은 알림(새 버전·점검 문제·서버 끊김)이 있으면 ☰ 에 점
  const b = NL.menuBtn; if (!b) return;
  const up = $('#btnUpdate'), he = $('#btnHealth'), sd = $('#srvDot');
  const alert = (up && !up.hidden) || (he && !he.hidden) || (sd && sd.classList.contains('bad'));
  b.classList.toggle('alert', !!alert);
  b.title = '메뉴 — 모드 탭·도구·설정' + (alert ? ' (확인할 알림이 있습니다)' : '');
}
function nlObserveAlerts() {
  NL.obs = new MutationObserver(() => nlMenuBadge());
  for (const id of ['#btnUpdate', '#btnHealth', '#srvDot']) { const e = $(id); if (e) NL.obs.observe(e, { attributes: true, attributeFilter: ['hidden', 'class'] }); }
}

/* ── 결과 화면 단추 줄 (NAI VO·V_·Vk·VS) ── */
function nlBarsBuild(p) {
  const st = $('#vstage'); if (!st) return;
  let cfg = null;
  for (const c of p.columns) for (const it of c.items || []) if (it.kind === 'element' && it.id === 'results-viewer') cfg = (it.options && it.options.bars) || null;
  cfg = cfg || NL_BARS_DEFAULT;
  const used = new Set(), widgets = [];
  let ord = 0;
  const chrome = nlH('div', 'nl-chrome'); chrome.id = 'nlChrome';
  const top = nlH('div', 'nl-ch-top'), mid = nlH('div', 'nl-ch-mid'), bottom = nlH('div', 'nl-ch-bottom');
  const left = nlH('div', 'nl-ch-side left'), right = nlH('div', 'nl-ch-side right');
  mid.append(left, nlH('div', 'nl-ch-gap'), right); chrome.append(top, mid, bottom);
  const mkWidget = id => {
    if (id === 'divider') { const d = nlH('span', 'nl-wdiv'); d.dataset.w = 'divider'; d.dataset.ord = ord++; return d; }
    const nodes = (NL_WIDGETS[id] || []).map(s => { const n = $(s); return n && n.id === 'tView' ? (n.closest('.viewpop-wrap') || n) : n; }).filter(n => n && !used.has(n));
    if (!nodes.length) return null;
    const w = nlH('span', 'nl-w'); w.dataset.w = id; w.dataset.ord = ord++;
    for (const n of nodes) { used.add(n); nlMark(n); w.appendChild(n); }
    widgets.push(w); return w;
  };
  const bars = {};
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const z = cfg[side]; if (!z || typeof z !== 'object') continue;
    const axis = side === 'top' || side === 'bottom' ? 'row' : 'column';
    const strat = axis === 'row' ? (z.overflow || 'menu') : 'menu';   // NAI: 세로 줄은 늘 메뉴
    const bar = nlH('div', `nl-bar nl-bar-${side} ${axis} ${strat}`); bar.dataset.side = side;
    if (z.hideWithout === 'image') bar.dataset.hideWithout = 'image';
    let any = false;
    for (const zone of ['start', 'center', 'end']) {
      if (strat === 'menu' && zone !== 'start') bar.appendChild(nlH('div', 'nl-zgap'));
      const zl = z[zone]; const zd = nlH('div', 'nl-zone ' + zone); zd.dataset.zone = zone;
      for (const cl of Array.isArray(zl) ? zl : []) {
        const g = nlH('div', 'vgroup nl-cl');
        for (const id of Array.isArray(cl) ? cl : [cl]) { const w = mkWidget(id); if (w) { w._home = g; g.appendChild(w); } }
        if (g.querySelector('.nl-w')) { zd.appendChild(g); any = true; }
      }
      const more = nlH('div', 'nl-more'); more.hidden = true;
      const mb = nlH('button', 'tb nl-more-b', '⋯'); mb.type = 'button'; mb.title = '단추 더 보기';
      const mp = nlH('div', 'nl-more-pop vgroup'); mp.hidden = true;
      mb.onclick = e => { e.stopPropagation(); mp.hidden = !mp.hidden; };
      more.append(mb, mp); zd.appendChild(more);
      bar.appendChild(zd);
    }
    if (!any) continue;
    bars[side] = bar;
    (side === 'top' ? top : side === 'bottom' ? bottom : side === 'left' ? left : right).appendChild(bar);
  }
  // NAI 에 없는 우리 단추(🗑 지우기 등)와 배치에 없는 단추는 «내려받기»가 든 묶음 끝에 (없으면 마지막 묶음 끝)
  const rest = [...document.querySelectorAll('.vtools .tb, .vtools .viewpop-wrap')].filter(n => !used.has(n) && !(n.classList.contains('tb') && n.closest('.viewpop-wrap')));
  if (rest.length) {
    const cls = chrome.querySelectorAll('.nl-cl');
    const host = (widgets.find(w => w.dataset.w === 'save.download') || {})._home || cls[cls.length - 1] || null;
    if (host) {
      const w = nlH('span', 'nl-w'); w.dataset.w = 'rest'; w.dataset.ord = ord++; w._home = host;
      for (const n of rest) { used.add(n); nlMark(n); w.appendChild(n); }
      host.appendChild(w); widgets.push(w);
    }
  }
  top.classList.toggle('has', !!bars.top); bottom.classList.toggle('has', !!bars.bottom);
  st.appendChild(chrome); st.classList.toggle('nl-has-top', !!bars.top);
  NL.bars = { chrome, bars, widgets, used: [...used] };
  if (typeof ResizeObserver === 'function') { NL.bars.ro = new ResizeObserver(() => nlFitBars()); for (const b of Object.values(bars)) NL.bars.ro.observe(b); }
}
function nlBarsRestore() {
  const B = NL.bars; if (!B) return;
  if (B.ro) B.ro.disconnect();
  for (const n of B.used) nlBack(n);
  B.chrome.remove(); const st = $('#vstage'); if (st) st.classList.remove('nl-has-top');
  NL.bars = null;
}
function nlBarsPaint(it) {
  const B = NL.bars; if (!B) return;
  // NAI: 그림 단추는 보고 있는 그림이 있어야 나오고, 위 단추 줄은 그림이 없으면 숨는다(hideWithout) — 그림이 없으면 줄 전부가 빈다
  B.chrome.hidden = !it;
  const T = B.bars.top; if (T) { T.style.paddingLeft = NL.iconSide.left ? '32px' : ''; T.style.paddingRight = NL.iconSide.right ? '32px' : ''; }
  if (it) setTimeout(nlFitBars, 0);
}
function nlFitBars() {   // NAI V_: 넘치면 우선순위(FU)가 낮은 단추부터 ⋯ 메뉴로 — 세로 줄·«menu» 줄만 (wrap 줄은 줄을 바꾼다)
  const B = NL.bars; if (!B || B.chrome.hidden) return;
  for (const bar of Object.values(B.bars)) {
    const zones = [...bar.querySelectorAll(':scope > .nl-zone')];
    // 먼저 메뉴에 넣었던 단추를 원래 묶음의 원래 차례 자리로
    for (const z of zones) {
      const mp = z.querySelector('.nl-more-pop');
      for (const w of [...mp.querySelectorAll(':scope > .nl-w')]) {
        const home = w._home; if (!home) continue;
        const after = [...home.children].find(c => +c.dataset.ord > +w.dataset.ord);
        home.insertBefore(w, after || null);
      }
      mp.hidden = true; z.querySelector('.nl-more').hidden = true;
    }
    if (bar.classList.contains('wrap')) continue;
    const col = bar.classList.contains('column'), size = e => (col ? e.offsetHeight : e.offsetWidth), avail = col ? bar.clientHeight : bar.clientWidth;
    if (!avail) continue;
    const items = [];
    for (const z of zones) {
      const ws = [...z.querySelectorAll('.nl-cl > .nl-w, .nl-cl > .nl-wdiv')];
      const sizes = ws.map(size), sum = sizes.reduce((a, b) => a + b, 0), cnt = sizes.filter(x => x > 0).length;
      const slack = cnt ? Math.max(0, (col ? z.scrollHeight : z.scrollWidth) - sum) / cnt : 0;
      ws.forEach((w, i) => items.push({ z, w, id: w.dataset.w || 'rest', size: sizes[i] > 0 ? sizes[i] + slack : 0 }));
    }
    const gaps = 10 * (zones.filter(z => z.querySelector('.nl-w')).length + 1);
    const hid = new Set(), menuZ = new Set();
    const fits = () => items.reduce((a, x) => a + (hid.has(x) ? 0 : x.size), 0) + 44 * menuZ.size + gaps <= avail;
    const order = items.filter(x => x.size > 0).sort((a, b) => (NL_PRIO[a.id] || 0) - (NL_PRIO[b.id] || 0));
    for (const x of order) { if (fits()) break; hid.add(x); if (x.id !== 'divider') menuZ.add(x.z); }
    for (const x of [...order].reverse()) {   // 넉넉해졌으면 중요한 것부터 되살린다
      if (!hid.has(x) || x.id === 'divider') continue;
      const other = [...hid].some(y => y !== x && y.z === x.z && y.id !== 'divider');
      hid.delete(x); if (!other) menuZ.delete(x.z);
      if (!fits()) { hid.add(x); if (!other) menuZ.add(x.z); }
    }
    for (const x of [...hid].sort((a, b) => +a.w.dataset.ord - +b.w.dataset.ord)) {
      if (x.id === 'divider') { x.w.classList.add('nl-off'); continue; }
      x.z.querySelector('.nl-more-pop').appendChild(x.w); x.z.querySelector('.nl-more').hidden = false;
    }
    for (const x of items) if (!hid.has(x) && x.id === 'divider') x.w.classList.remove('nl-off');
    for (const g of bar.querySelectorAll('.nl-cl')) g.classList.toggle('nl-off', !g.querySelector('.nl-w'));
  }
}

/* ── 바깥 누르기·창 크기 ── */
document.addEventListener('mousedown', e => {
  if (!NL.on) return;
  if (NL.menuOpen && !e.target.closest('#nlMenuPop') && !e.target.closest('.nl-menu-btn')) nlMenuShow(false);
  if (NL.floatId && !e.target.closest('.nl-float') && !e.target.closest('.nl-rail') && !e.target.closest('.nl-icon') && !e.target.closest('.modal, #modal, .modal-wrap')) { NL.floatId = ''; nlRender(); }
  if (!e.target.closest('.nl-more')) for (const mp of document.querySelectorAll('.nl-more-pop')) mp.hidden = true;
}, true);
window.addEventListener('resize', () => {
  clearTimeout(NL.rzT);
  NL.rzT = setTimeout(() => {
    if (NL.on !== nlWanted()) { nlSync(); return; }
    if (!NL.on) return;
    const p = nlPreset(); if (p && nlSigSqueeze(p)) nlRender(); else { nlFitBars(); nlMenuShow(NL.menuOpen); }
  }, 120);
});
// 요약 칩이 보여 주는 값이 바뀌면 칩을 다시 그린다 (값을 바꾸는 코드는 원래 칸의 것)
document.addEventListener('input', e => { if (NL.on && e.target && /^(steps|scale|rescale|seed)$/.test(e.target.id)) nlRefreshSoon(); }, true);
document.addEventListener('change', e => { if (NL.on && e.target && /^(steps|scale|rescale|seed|randomSeed|sampler|schedule|legacyUc|decrisper|variety|autoSmea)$/.test(e.target.id)) nlRefreshSoon(); }, true);
