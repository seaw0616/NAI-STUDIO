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
/* ═══════════ 스타일 프리셋(고정 프롬프트) · 씬 모드(가변 프롬프트 자동 짤뽑) · 라이브러리 ═══════════ */

/* ─────────────── 스타일 프리셋 ───────────────
   고정 프롬프트 = 작화 스타일·품질·체형·기본 네거티브 처럼 매번 유지되는 부분.
   prefix(앞), suffix(뒤), uc(네거) 로 저장하고, 메인/씬의 가변 프롬프트를 감쌉니다.   */
function renderStyleSelects() {
  const opts = ['<option value="">스타일 없음</option>'].concat(S.styles.map(s => `<option value="${s.id}">${esc(s.name)}</option>`)).join('');
  $$('.style-sel').forEach(sel => {
    const v = sel.dataset.scene ? (getScene(sel.dataset.scene) || {}).styleId || '' : (S.activeStyle || '');
    sel.innerHTML = opts; sel.value = v || '';
  });
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function openStyleManager(editId) {
  openModal('스타일 프리셋 (고정 프롬프트)', body => {
    body.innerHTML = `<div class="hint">매번 반복되는 <b>작화 스타일·품질·체형·기본 네거티브</b>를 스타일로 고정해 두고, 프롬프트에는 <b>캐릭터 외모·의상·표정·포즈·배경</b>처럼 바뀌는 부분만 쓰세요.
      최종 프롬프트 = <b>앞 고정</b> + 내 프롬프트 + <b>뒤 고정</b> (+퀄리티 태그) · 네거티브 = 프리셋 + <b>고정 네거</b> + 내 네거</div>
      <div id="stList"></div>
      <div class="row"><button class="btn sm" id="stAdd">＋ 새 스타일</button><button class="btn sm" id="stFromMain">현재 메인 프롬프트로 만들기</button>
        <button class="btn sm" id="stExport">내보내기</button><button class="btn sm" id="stImport">가져오기</button></div>`;
    const list = body.querySelector('#stList');
    const draw = () => {
      list.innerHTML = '';
      if (!S.styles.length) list.innerHTML = '<div class="hint">아직 스타일이 없습니다.</div>';
      S.styles.forEach((s, i) => {
        const d = document.createElement('div'); d.className = 'style-card';
        d.innerHTML = `<div class="row"><input type="text" class="st-name" placeholder="스타일 이름 (예: 커플 일러스트, SD 캐릭터, 오컬트 표지)"><button class="btn xs" data-a="use">메인에 적용</button><button class="ic" data-a="del" title="삭제">✕</button></div>
          <label class="fld">앞 고정 프롬프트 (작화·품질·인원·체형 등)<textarea class="ac st-pre" rows="2"></textarea></label>
          <label class="fld">뒤 고정 프롬프트 (선택)<textarea class="ac st-suf" rows="1"></textarea></label>
          <label class="fld">고정 네거티브<textarea class="ac st-uc" rows="1"></textarea></label>`;
        const [n, pre, suf, uc] = [d.querySelector('.st-name'), d.querySelector('.st-pre'), d.querySelector('.st-suf'), d.querySelector('.st-uc')];
        n.value = s.name; pre.value = s.prefix || ''; suf.value = s.suffix || ''; uc.value = s.uc || '';
        n.oninput = () => { s.name = n.value; save(); renderStyleSelects(); };
        pre.oninput = () => { s.prefix = pre.value; save(); };
        suf.oninput = () => { s.suffix = suf.value; save(); };
        uc.oninput = () => { s.uc = uc.value; save(); };
        d.querySelector('[data-a="use"]').onclick = () => { S.activeStyle = s.id; save(); renderStyleSelects(); toast('메인 스타일: ' + s.name); };
        d.querySelector('[data-a="del"]').onclick = () => { tomb('style', s.id); S.styles.splice(i, 1); if (S.activeStyle === s.id) S.activeStyle = null; S.scenes.forEach(sc => { if (sc.styleId === s.id) sc.styleId = null; }); save(); draw(); renderStyleSelects(); };
        list.appendChild(d);
        if (editId === s.id) setTimeout(() => n.focus(), 30);
      });
    };
    draw();
    body.querySelector('#stAdd').onclick = () => { S.styles.push({ id: uid(), name: '스타일 ' + (S.styles.length + 1), prefix: '', suffix: '', uc: '', createdAt: Date.now() }); save(); draw(); renderStyleSelects(); };
    body.querySelector('#stFromMain').onclick = () => {
      /* 프롬프트를 스타일로 옮겨 담는 기능이다. 그런데 원래 칸을 그대로 두면, 그 스타일을
         고르는 순간 앞 고정 프롬프트 + 칸 내용으로 전부 두 번 나간다(토큰·Anlas 낭비에
         그림도 망가진다). 예전엔 토스트 한 줄이 유일한 경고라 알아채기 어려웠다.
         → 옮긴 것인지 복사한 것인지 그 자리에서 정하게 한다. */
      const p = S.prompt.trim(), u = S.uc.trim();
      if (!p && !u) { toast('프롬프트가 비어 있습니다', 'err'); return; }
      const newId = uid();
      S.styles.push({ id: newId, name: '내 스타일 ' + (S.styles.length + 1), prefix: p, suffix: '', uc: u, createdAt: Date.now() });
      const moved = confirm('현재 프롬프트를 스타일에 담았습니다.\n\n프롬프트 칸을 비울까요?\n\n'
        + '[확인] 비우기 — 스타일이 그 내용을 넣어줍니다 (권장)\n'
        + '[취소] 그대로 두기 — 이 스타일을 고르면 같은 내용이 두 번 들어갑니다');
      // 칸을 비웠으면 방금 만든 스타일을 곧바로 적용해야 한다.
      // 안 그러면 프롬프트만 사라지고 아무것도 안 들어가 "다 날아갔다" 가 된다.
      if (moved) {
        S.prompt = ''; S.secText = {}; S.uc = ''; S.activeStyle = newId;
        if (typeof renderSections === 'function') renderSections();
        if (typeof syncUI === 'function') syncUI();
      }
      save(); draw(); renderStyleSelects();
      toast(moved ? '스타일로 옮기고 바로 적용했습니다 — 프롬프트 칸은 비웠습니다' : '스타일로 복사했습니다 — 칸에 남은 내용과 겹치면 두 번 들어갑니다');
    };
    body.querySelector('#stExport').onclick = () => downloadBlob(new Blob([JSON.stringify(S.styles, null, 2)], { type: 'application/json' }), 'nai-styles.json');
    body.querySelector('#stImport').onclick = () => pickFiles(false, async f => {
      try { const arr = JSON.parse(await f.text()); for (const s of arr) if (s.name) S.styles.push({ id: uid(), name: s.name, prefix: s.prefix || '', suffix: s.suffix || '', uc: s.uc || '', createdAt: Date.now() }); save(); draw(); renderStyleSelects(); }
      catch (e) { toast('스타일 파일이 아닙니다', 'err'); }
    }, '.json');
  }, true);
}

/* ─────────────── 캐릭터 라이브러리 ───────────────
   자주 쓰는 캐릭터(외모·의상)를 저장해 두고 메인/씬의 캐릭터 프롬프트에 불러옵니다.  */
function saveCharToLibrary(c) {
  openModal('캐릭터 라이브러리에 저장', body => {
    body.innerHTML = `<label class="fld">캐릭터 이름<input type="text" id="clName" placeholder="예: 미쿠, 주인공A"></label>
      <label class="fld">프롬프트<textarea id="clPrompt" class="ac" rows="3"></textarea></label>
      <label class="fld">네거티브 (선택)<textarea id="clUc" class="ac" rows="1"></textarea></label>
      <div class="row"><button class="btn primary" id="clSave">저장</button></div>`;
    body.querySelector('#clPrompt').value = c.prompt || ''; body.querySelector('#clUc').value = c.uc || '';
    const n = body.querySelector('#clName'); setTimeout(() => n.focus(), 40);
    body.querySelector('#clSave').onclick = () => {
      const name = n.value.trim(); if (!name) { toast('이름을 입력하세요', 'err'); return; }
      const ex = S.characters.find(x => x.name === name);
      const rec = { id: ex ? ex.id : uid(), name, prompt: body.querySelector('#clPrompt').value.trim(), uc: body.querySelector('#clUc').value.trim() };
      if (ex) Object.assign(ex, rec); else S.characters.push({ ...rec, createdAt: rec.createdAt || Date.now() });
      c.libId = rec.id; save(); closeModal(); toast('캐릭터 저장: ' + name); renderChars(); if (S.mode === 'scene') renderSceneEditor();
    };
  });
}
function openCharLibrary() {
  openModal('캐릭터 라이브러리', body => {
    body.innerHTML = `<div class="hint">저장한 캐릭터는 메인/씬의 캐릭터 카드에서 "라이브러리…"로 불러올 수 있고, 프롬프트에서 <b>@캐릭터이름</b>처럼 쓰려면 청크로도 저장하세요.</div>
      <div id="clRows"></div>
      <div class="row"><button class="btn sm" id="clAdd">＋ 새 캐릭터</button><button class="btn sm" id="clExport">내보내기</button><button class="btn sm" id="clImport">가져오기</button></div>`;
    const rows = body.querySelector('#clRows');
    const draw = () => {
      rows.innerHTML = '';
      if (!S.characters.length) rows.innerHTML = '<div class="hint">아직 캐릭터가 없습니다.</div>';
      S.characters.forEach((ch, i) => {
        const d = document.createElement('div'); d.className = 'style-card';
        d.innerHTML = `<div class="row"><input type="text" class="st-name" placeholder="이름"><button class="btn xs" data-a="main">메인에 추가</button><button class="btn xs" data-a="chunk">청크로도 저장</button><button class="ic" data-a="del">✕</button></div>
          <textarea class="ac" rows="2" placeholder="프롬프트"></textarea><textarea class="ac" rows="1" placeholder="네거티브 (선택)"></textarea>`;
        const [n, p, u] = [d.querySelector('.st-name'), d.querySelectorAll('textarea')[0], d.querySelectorAll('textarea')[1]];
        n.value = ch.name; p.value = ch.prompt || ''; u.value = ch.uc || '';
        /* 이름을 바꾸면 옛 이름을 '지웠다'고 남겨야 한다. 안 그러면 서버 병합이 옛 이름
           캐릭터를 되살려 중복이 생긴다 (청크는 처리했는데 캐릭터만 빠져 있었다).
           타자 도중(oninput)이 아니라 다 치고 난 뒤(onchange)에 한 번만 남긴다 —
           안 그러면 'a','ab','abc' 처럼 중간 이름까지 전부 톰스톤이 박힌다. */
        n.dataset.orig = ch.name || '';
        n.oninput = () => { ch.name = n.value; save(); };
        n.onchange = () => {
          const oldName = n.dataset.orig;
          if (oldName && oldName.trim() && oldName !== ch.name) tomb('char', oldName);
          n.dataset.orig = ch.name || ''; save();
        }; p.oninput = () => { ch.prompt = p.value; save(); }; u.oninput = () => { ch.uc = u.value; save(); };
        d.querySelector('[data-a="main"]').onclick = () => { S.chars.push({ prompt: ch.prompt, uc: ch.uc || '', x: null, y: null, libId: ch.id }); save(); renderChars(); toast('메인 캐릭터에 추가'); };
        d.querySelector('[data-a="chunk"]').onclick = () => { const name = ch.name.replace(/\s+/g, '_'); const ex = S.chunks.find(c => c.name === name); if (ex) ex.text = ch.prompt; else S.chunks.push({ name, text: ch.prompt, cat: '캐릭터', createdAt: Date.now() }); save(); renderChunkBar(); toast('청크 @' + name + ' 저장'); };
        d.querySelector('[data-a="del"]').onclick = () => { tomb('char', ch.name); S.characters.splice(i, 1); save(); draw(); };
        rows.appendChild(d);
      });
    };
    draw();
    body.querySelector('#clAdd').onclick = () => { S.characters.push({ id: uid(), name: '캐릭터 ' + (S.characters.length + 1), prompt: '', uc: '', createdAt: Date.now() }); save(); draw(); };
    body.querySelector('#clExport').onclick = () => downloadBlob(new Blob([JSON.stringify(S.characters, null, 2)], { type: 'application/json' }), 'nai-characters.json');
    body.querySelector('#clImport').onclick = () => pickFiles(false, async f => { try { for (const c of JSON.parse(await f.text())) if (c.name) S.characters.push({ id: uid(), name: c.name, prompt: c.prompt || '', uc: c.uc || '', createdAt: Date.now() }); save(); draw(); } catch (e) { toast('파일 오류', 'err'); } }, '.json');
  }, true);
}
window.saveCharToLibrary = saveCharToLibrary;

/* ─────────────── 씬 ─────────────── */
const SCENE_SIZES = [
  ['p', '세로 (832×1216)', 832, 1216], ['l', '가로 (1216×832)', 1216, 832], ['s', '정사각 (1024×1024)', 1024, 1024],
  ['pl', '세로 L (1024×1536)', 1024, 1536], ['ll', '가로 L (1536×1024)', 1536, 1024], ['main', '메인 설정 크기 사용', 0, 0],
];
const getScene = id => S.scenes.find(s => s.id === id) || null;
const curScene = () => getScene(S.curScene) || S.scenes[0] || null;
const SR = { on: false, stop: false, done: 0, total: 0, sceneId: null };
function sceneImages(id) { return R.hist.filter(h => h.sceneId === id); }
/* 씬에 실제로 그릴 내용이 있는가 — 전체 생성 필터와 개별 실행 가드가 같은 기준을 써야 한다 */
function sceneHasContent(s) {
  // 메인 프롬프트를 이어받는 설정이면 메인 내용도 "내용 있음"으로 친다
  const main = S.sceneUseMain !== false && (getMainPrompt().trim() || S.chars.some(c => (c.prompt || '').trim()));
  return !!(main || s.prompt.trim() || (s.styleExplicit && getStyle(s.styleId)) || (s.chars || []).some(c => (c.prompt || '').trim()));
}
function newScene(pre) {
  const sc = { id: uid(), name: pre && pre.name || `씬 ${S.scenes.length + 1}`, prompt: pre && pre.prompt || '', uc: '', size: 'p', count: pre && pre.count != null ? pre.count : 4, styleId: S.activeStyle || null, chars: pre && pre.chars ? pre.chars.map(c => ({ ...c })) : [], t: Date.now() };
  sc.createdAt = sc.createdAt || Date.now(); S.scenes.push(sc); S.curScene = sc.id; save();
  return sc;
}
function sceneOv(sc) { // 씬 → 생성 오버라이드
  const st = getStyle(sc.styleId);
  const sz = SCENE_SIZES.find(z => z[0] === sc.size) || SCENE_SIZES[0];
  // 메인 프롬프트를 그대로 이어받고 씬 프롬프트는 "추가분"으로 붙인다 (NAI Studio 3 방식).
  // 끄면 씬 프롬프트만 쓴다.
  const useMain = S.sceneUseMain !== false;
  const mainP = useMain ? getMainPrompt() : '';
  const mainUc = useMain ? (S.uc || '').trim() : '';
  const mainChars = useMain ? S.chars.filter(c => c.prompt && c.prompt.trim()) : [];
  const ov = {
    prompt: expandAll(joinParts(st && st.prefix, mainP, sc.prompt.trim(), st && st.suffix)),
    ucExtra: joinParts(st && expandAll(st.uc || ''), expandAll(mainUc), expandAll((sc.uc || '').trim())),   // 프리셋+auto-nsfw 조립은 buildPayload 가 담당 (메인과 동일 규칙)
    sceneId: sc.id, sceneName: sc.name, n: 1, style: st || null,
    // NAI 는 캐릭터를 6명까지만 받는다. 메인 캐릭터와 씬 캐릭터를 그냥 더하면 넘어가서
    // 요청 자체가 거절된다 → 앞에서부터 6명까지만 보낸다.
    chars: mainChars.concat((sc.chars || []).filter(c => c.prompt && c.prompt.trim())).slice(0, 6),
    // 씬 모드에선 왼쪽 패널이 숨겨져 i2i/마스크가 보이지도, 해제되지도 않는다.
    // 이걸 막지 않으면 메인에 남아 있던 이미지 때문에 모든 씬이 img2img·인페인트로 나간다.
    noRef: true,
  };
  if (sz[2]) { ov.w = sz[2]; ov.h = sz[3]; }
  return ov;
}
async function runScenes(list) { // list: [{scene, count}]
  if (SR.on) { toast('이미 씬 생성 중입니다'); return; }
  if (R.auto.on || R.auto.running) { toast('자동 짤뽑을 먼저 정지하세요', 'err'); return; }
  if (R.gen) { toast('이미 다른 생성이 진행 중입니다', 'err'); return; }
  if (!hasToken()) { toast('먼저 ⚙설정에서 API 토큰을 저장하세요', 'err'); openSettings(); return; }   // 서버에 저장된 토큰도 인정
  SR.on = true; SR.stop = false; SR.done = 0; SR.total = list.reduce((a, x) => a + x.count, 0);
  let errStreak = 0;
  updateSceneRunUI();
  outer: for (const { scene, count } of list) {
    SR.sceneId = scene.id;
    for (let i = 0; i < count; i++) {
      if (SR.stop) break outer;
      updateSceneRunUI(`${scene.name} ${i + 1}/${count}`);
      try { const it = await doGenerate(sceneOv(scene), '씬: ' + scene.name); if (!it) throw new Error('생성 실패'); SR.done++; errStreak = 0; }
      catch (e) {
        errStreak++;
        const msg = String(e.message || '');
        if (errStreak >= 5 || msg.includes('토큰') || msg.includes('Anlas')) { toast('씬 생성 중지: ' + msg, 'err'); break outer; }
        // 다른 생성과 겹쳐서 실패한 것은 장수를 까먹지 않고 다시 시도한다
        if (msg.includes('진행 중')) { i--; await sleep(1500); continue; }
        await sleep(msg.includes('429') ? 15000 : 4000);
      }
      if (SR.stop) break outer;
      await sleep(S.autoDelay * 1000 + Math.random() * 600);
    }
  }
  SR.on = false; SR.sceneId = null;
  updateSceneRunUI();
  toast(`씬 생성 종료 · ${SR.done}장`);
}
function updateSceneRunUI(msg) {
  const st = $('#scRunState'); if (!st) return;
  st.textContent = SR.on ? `● 생성 중 ${SR.done}/${SR.total}${msg ? ' · ' + msg : ''}` : (SR.done ? `완료 ${SR.done}장` : '');
  $('#scStop').hidden = !SR.on; $('#scRunAll').disabled = SR.on;
  $$('.sc-run').forEach(b => b.disabled = SR.on);
  $$('.sc-item').forEach(el => el.classList.toggle('running', SR.on && el.dataset.id === SR.sceneId));
}

function renderScenes() {
  if ($('#sceneView').hidden) return;
  renderSceneList();
  renderSceneEditor();
}
function renderSceneList() {
  const listEl = $('#scList'); listEl.innerHTML = '';
  S.scenes.forEach(sc => {
    const d = document.createElement('div'); d.className = 'sc-item' + (sc.id === S.curScene ? ' on' : '') + (SR.on && SR.sceneId === sc.id ? ' running' : '');
    d.dataset.id = sc.id;
    const n = sceneImages(sc.id).length, favs = sceneImages(sc.id).filter(h => h.fav).length;
    d.innerHTML = `<div class="sc-name"></div><div class="sc-sub"></div>`;
    d.querySelector('.sc-name').textContent = sc.name;
    d.querySelector('.sc-sub').textContent = `${n}장${favs ? ' · ★' + favs : ''}${sc.prompt ? ' · ' + sc.prompt.slice(0, 40) : ''}`;
    d.onclick = () => { S.curScene = sc.id; save(); renderScenes(); };
    listEl.appendChild(d);
  });
}
function renderSceneEditor() {
  const sc = curScene(); const ed = $('#scEditor');
  if (!sc) { ed.innerHTML = `<div class="vempty"><div class="vempty-ico">🎬</div><div>씬이 없습니다</div><div class="hint">왼쪽 "＋ 새 씬"을 누르거나 "감정 12종 세트"로 시작하세요</div></div>`; return; }
  if (S.curScene !== sc.id) { S.curScene = sc.id; }
  ed.innerHTML = `
    <div class="sc-head">
      <button class="ic" id="scPrev" title="이전 씬">‹</button>
      <div class="sc-title"><input type="text" id="scName" class="sc-name-in"><div class="hint">씬 프롬프트 = 이 씬에서만 바뀌는 부분 (가변). 작화·품질은 스타일로 고정하세요</div></div>
      <select id="scSize" class="sc-size"></select>
      <div class="stepper"><button id="scMinus">−</button><input type="number" id="scCount" min="0" max="999"><button id="scPlus">＋</button></div>
      <button class="btn primary sc-run" id="scRun">▶ 이미지 생성</button>
      <button class="ic danger" id="scDel" title="씬 삭제">🗑</button>
    </div>
    <div class="row sc-opts">
      <label class="fld" style="flex:1">스타일 (고정 프롬프트)<div class="row"><select class="style-sel" data-scene="${sc.id}" id="scStyle" style="flex:1"></select><button class="btn sm" id="scStyleMng">관리</button></div></label>
    </div>
    <div class="sc-main">
      <label class="ck" title="켜면 메인 탭의 프롬프트·네거티브·캐릭터를 그대로 쓰고, 아래 씬 프롬프트를 뒤에 덧붙입니다. 끄면 씬 프롬프트만 씁니다."><input type="checkbox" id="scUseMain"> <b>기본 프롬프트</b> 이어받기 <span class="hint" id="scMainPv"></span></label>
      <div id="scMainBox">
        <div id="scMainSecs" class="sc-main-secs"></div>
        <details class="sub"><summary>기본 네거티브</summary><textarea id="scMainU" class="ta ac" rows="1"></textarea></details>
      </div>
    </div>
    <label class="fld">씬 프롬프트 <span class="hint">(메인에 <b>덧붙일</b> 부분만 쓰면 됩니다)</span><textarea id="scPrompt" class="ta ac big" rows="4" spellcheck="false" placeholder="예: school uniform, sitting on bench, park, smile"></textarea></label>
    <div id="scChunkBar" class="chunkbar" data-ta="scPrompt"></div>
    <details class="sub"><summary>씬 네거티브 추가</summary><textarea id="scUc" class="ta ac" rows="1"></textarea></details>
    <div class="chead"><span class="ptitle">씬 캐릭터 <span class="hint">V4+ · 이 씬에만 적용</span></span>
      <div class="row"><button class="btn xs" id="scCharLib">👤 라이브러리</button><button class="btn xs" id="scAddChar">＋ 캐릭터</button></div></div>
    <div id="scCharList"></div>
    <div class="sc-gal-head">
      <span class="ptitle">생성된 이미지 <span id="scGalN" class="hint"></span></span>
      <div class="ptool-r">
        <button class="btn xs ghost" id="scFavOnly">☆ 즐겨찾기만</button>
        <button class="btn xs ghost danger" id="scDelNonFav">🗑 즐겨찾기 제외 삭제</button>
        <button class="btn xs ghost" id="scSaveFav">💾 즐겨찾기 저장</button>
      </div>
    </div>
    <div id="scGal" class="scgal"></div>`;
  $('#scName').value = sc.name;
  const sz = $('#scSize'); SCENE_SIZES.forEach(z => { const o = document.createElement('option'); o.value = z[0]; o.textContent = z[1]; sz.appendChild(o); }); sz.value = sc.size || 'p';
  $('#scCount').value = sc.count; $('#scPrompt').value = sc.prompt || ''; $('#scUc').value = sc.uc || '';
  if (typeof refreshHighlights === 'function') refreshHighlights();   // 이미 붙어 있던 칸이면 색칠이 안 따라온다
  renderStyleSelects();
  sc.chars = sc.chars || [];
  const drawChars = () => { const l = $('#scCharList'); l.innerHTML = ''; sc.chars.forEach((c, i) => l.appendChild(charCard(c, i, () => { sc.chars.splice(i, 1); save(); drawChars(); }, () => save()))); };
  drawChars();
  $('#scAddChar').onclick = () => { if (sc.chars.length >= 6) { toast('캐릭터는 최대 6명', 'err'); return; } sc.chars.push({ prompt: '', uc: '', x: null, y: null }); save(); drawChars(); };
  $('#scCharLib').onclick = () => openCharLibrary();
  $('#scName').oninput = () => { sc.name = $('#scName').value; save(); const it = $(`.sc-item[data-id="${sc.id}"] .sc-name`); if (it) it.textContent = sc.name; };
  sz.onchange = () => { sc.size = sz.value; save(); };
  const setCount = v => { sc.count = Math.max(0, Math.min(999, v | 0)); $('#scCount').value = sc.count; save(); };
  $('#scCount').onchange = () => setCount(+$('#scCount').value);
  $('#scMinus').onclick = () => setCount(sc.count - 1); $('#scPlus').onclick = () => setCount(sc.count + 1);
  // 기본(메인) 프롬프트를 씬 화면에서도 그대로 보고 고칠 수 있게 — 탭을 오갈 필요 없이
  // 기본(메인) 프롬프트를 씬 화면에서도 그대로 보고 고칠 수 있게 — 탭을 오갈 필요가 없다.
  // 메인의 칸 구성을 그대로 재현해 S.secText 를 직접 편집한다 (합쳐서 넣으면 칸이 깨진다).
  const um = $('#scUseMain'), pv = $('#scMainPv'), box = $('#scMainBox'), mu = $('#scMainU');
  const secs = $('#scMainSecs');
  const buildMainSecs = () => {
    secs.innerHTML = '';
    if (S.singleBox) {
      const l = document.createElement('label'); l.className = 'fld';
      l.innerHTML = '기본 프롬프트<textarea class="ta ac" rows="3" spellcheck="false"></textarea>';
      const t = l.querySelector('textarea'); t.value = S.prompt || '';
      // 값을 코드로 바꿔치면 input 이 안 나서 뒤에 깔린 색칠 레이어가 옛 글자를 그대로 들고 있는다
      t.addEventListener('input', () => { S.prompt = t.value; const m = $('#prompt'); if (m) { m.value = t.value; if (m._hlSync) m._hlSync(); } save(); drawMainPv(); });
      secs.appendChild(l); attachHighlight(t);
      return;
    }
    S.secText = S.secText || {};
    (S.sections || []).forEach(sec => {
      const l = document.createElement('label'); l.className = 'fld';
      l.innerHTML = `<span>${esc(sec.name)} <span class="hint">${esc(sec.hint || '')}</span></span><textarea class="ta ac" rows="2" spellcheck="false"></textarea>`;
      const t = l.querySelector('textarea');
      t.value = S.secText[sec.id] || ''; t.placeholder = sec.hint || ''; t.dataset.sec = sec.id;
      t.addEventListener('input', () => {
        S.secText[sec.id] = t.value;
        syncPromptFromSections();
        if (typeof renderSections === 'function') renderSections();   // 메인 탭 쪽도 맞춰준다
        save(); drawMainPv();
      });
      secs.appendChild(l); attachHighlight(t);
    });
  };
  const drawMainPv = () => {
    const on = S.sceneUseMain !== false;
    um.checked = on; box.hidden = !on;
    const m = getMainPrompt().trim();
    pv.textContent = on ? (m ? '' : '(비어 있음)') : '씬 프롬프트만 사용';
  };
  buildMainSecs();
  mu.value = S.uc || '';
  mu.addEventListener('input', () => { S.uc = mu.value; const u = $('#uc'); if (u) { u.value = mu.value; if (u._hlSync) u._hlSync(); } save(); });
  drawMainPv();
  um.onchange = () => { S.sceneUseMain = um.checked; save(); drawMainPv(); };
  $('#scPrompt').addEventListener('input', () => { sc.prompt = $('#scPrompt').value; save(); });
  $('#scUc').addEventListener('input', () => { sc.uc = $('#scUc').value; save(); });
  // 사용자가 직접 고른 스타일만 "내용 있음"으로 친다 — 메인에서 상속된 스타일은 제외
  // (안 그러면 빈 씬까지 전체 생성에 끼어 기본 4장씩 뽑힌다)
  $('#scStyle').onchange = () => { sc.styleId = $('#scStyle').value || null; sc.styleExplicit = !!sc.styleId; save(); };
  $('#scStyleMng').onclick = () => openStyleManager();
  $('#scRun').onclick = () => { if (!sc.count) { toast('장수를 1 이상으로', 'err'); return; } if (!sceneHasContent(sc)) { toast('씬 프롬프트를 입력하세요', 'err'); return; } runScenes([{ scene: sc, count: sc.count }]); };
  $('#scDel').onclick = () => {
    if (SR.on) { toast('씬 생성 중에는 삭제할 수 없습니다 — 먼저 ■ 정지', 'err'); return; }
    openModal('씬 삭제', body => {
      body.innerHTML = `<div>"${esc(sc.name)}" 씬을 삭제합니다. 생성된 이미지는 히스토리에 남습니다.</div>`;
      const b = document.createElement('button'); b.className = 'btn danger'; b.textContent = '삭제';
      b.onclick = () => { tomb('scene', sc.id); S.scenes = S.scenes.filter(x => x !== sc); S.curScene = S.scenes.length ? S.scenes[0].id : null; save(); closeModal(); renderScenes(); };
      body.appendChild(b);
    });
  };
  $('#scPrev').onclick = () => { const i = S.scenes.indexOf(sc); if (i > 0) { S.curScene = S.scenes[i - 1].id; save(); renderScenes(); } };
  renderChunkBar($('#scChunkBar')); attachHighlight($('#scPrompt'));
  $('#scFavOnly').onclick = () => { sc.favOnly = !sc.favOnly; renderSceneGallery(sc); };
  $('#scDelNonFav').onclick = () => {
    const del = sceneImages(sc.id).filter(h => !h.fav);
    if (!del.length) { toast('삭제할 이미지가 없습니다'); return; }
    openModal('즐겨찾기 제외 삭제', body => {
      body.innerHTML = `<div>이 씬의 즐겨찾기(★)가 아닌 ${del.length}장을 삭제합니다.</div>`;
      const b = document.createElement('button'); b.className = 'btn danger'; b.textContent = '삭제';
      b.onclick = () => { del.forEach(h => deleteItem(h, true)); refreshAfterBulk(); closeModal(); renderScenes(); };
      body.appendChild(b);
    });
  };
  $('#scSaveFav').onclick = () => { const favs = sceneImages(sc.id).filter(h => h.fav); if (!favs.length) { toast('즐겨찾기가 없습니다'); return; } bulkSave(favs, S.stripOnSave); };
  renderSceneGallery(sc);
  updateSceneRunUI();
}
function renderSceneGallery(sc) {
  const gal = $('#scGal'); if (!gal) return; gal.innerHTML = '';
  let imgs = sceneImages(sc.id); const total = imgs.length;
  if (sc.favOnly) imgs = imgs.filter(h => h.fav);
  $('#scGalN').textContent = `(${imgs.length}${sc.favOnly ? '/' + total : ''})`;
  $('#scFavOnly').style.color = sc.favOnly ? 'var(--gold)' : '';
  if (!imgs.length) {
    if (sc.favOnly && total > 0) {   // 필터 때문에 빈 것을 "이미지 없음"으로 오해하지 않게
      gal.innerHTML = `<div class="vempty"><div class="vempty-ico">☆</div><div class="hint">즐겨찾기한 이미지가 없습니다 (전체 ${total}장)</div><button class="btn sm" id="scFavClear">필터 해제</button></div>`;
      const b = gal.querySelector('#scFavClear'); if (b) b.onclick = () => { sc.favOnly = false; renderSceneGallery(sc); };
    } else gal.innerHTML = `<div class="vempty"><div class="vempty-ico">🖼</div><div class="hint">아직 생성된 이미지가 없습니다 — ▶ 이미지 생성</div></div>`;
    return;
  }
  for (let i = imgs.length - 1; i >= 0; i--) {
    const h = imgs[i];
    const d = document.createElement('div'); d.className = 'scg-item' + (h.saved ? ' saved' : '');
    d.innerHTML = `<img loading="lazy"><button class="scg-fav" title="즐겨찾기 (F)">${h.fav ? '★' : '☆'}</button>${h.saved ? '<span class="svd">💾</span>' : ''}<div class="scg-cap"></div>`;
    d.querySelector('img').src = h.url;
    d.querySelector('.scg-cap').textContent = `seed ${h.seed}`;
    d.querySelector('.scg-fav').classList.toggle('on', !!h.fav);
    d.querySelector('.scg-fav').onclick = e => { e.stopPropagation(); toggleFav(h); renderSceneGallery(sc); };
    d.onclick = () => openLightbox(h);
    gal.appendChild(d);
  }
}
function openLightbox(h) {
  openModal('', body => {
    body.innerHTML = `<div class="lb"><img src="${h.url}"></div>
      <div class="row" style="justify-content:center">
        <button class="btn sm" id="lbFav">${h.fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</button>
        <button class="btn sm" id="lbSave">💾 저장</button>
        <button class="btn sm" id="lbMain">↗ 메인 뷰어에서 열기</button>
        <button class="btn sm" id="lbI2i">↪ i2i로</button>
        <button class="btn sm" id="lbApply">⤴ 설정 불러오기</button>
        <button class="btn sm danger" id="lbDel">🗑 삭제</button>
      </div><div class="hint" style="text-align:center">seed ${h.seed} · ${h.w}×${h.h}${h.label ? ' · ' + h.label : ''}</div>`;
    body.querySelector('#lbFav').onclick = () => { toggleFav(h); closeModal(); if (window.renderScenes) renderScenes(); if (window.renderLibrary) renderLibrary(); };
    body.querySelector('#lbSave').onclick = () => saveItem(h, S.stripOnSave);
    body.querySelector('#lbMain').onclick = () => { closeModal(); setMode('main'); showImage(R.hist.indexOf(h)); };
    body.querySelector('#lbI2i').onclick = () => { setI2I(h.blob); closeModal(); setMode('main'); toast('i2i 소스로 설정됨'); };
    body.querySelector('#lbApply').onclick = () => { applyMeta(h.meta); closeModal(); setMode('main'); };
    body.querySelector('#lbDel').onclick = () => { deleteItem(h); closeModal(); if (window.renderScenes) renderScenes(); if (window.renderLibrary) renderLibrary(); };
  }, true);
}

/* 템플릿: 감정 12종 등 */
const EMO_SET = [
  ['기쁨', 'happy, smile, open mouth'], ['슬픔', 'sad, tears, downcast eyes'], ['분노', 'angry, furrowed brow, clenched teeth'],
  ['당황', 'embarrassed, flustered, sweatdrop, wavy mouth'], ['무표정', 'expressionless, closed mouth'], ['수줍음', 'shy, blush, looking away'],
  ['놀람', 'surprised, wide-eyed, open mouth'], ['피곤함', 'tired, half-closed eyes, sleepy'], ['비웃음', 'smirk, smug, half-closed eyes'],
  ['울먹임', 'tearing up, wavy mouth, trembling'], ['짜증', 'annoyed, frown, v-shaped eyebrows'], ['공포', 'scared, wide-eyed, trembling, sweat'],
];
function openSceneTemplates() {
  openModal('씬 세트 만들기 (템플릿)', body => {
    const cur = curScene();
    body.innerHTML = `<div class="hint">공통 프롬프트(캐릭터 외모 등)에 항목별 태그를 붙여 씬을 한 번에 여러 개 만듭니다. 이후 "전체 씬 생성"을 누르면 순서대로 자동 짤뽑됩니다.</div>
      <label class="fld">공통 프롬프트 (각 씬 앞에 붙음)<textarea id="tpBase" class="ta ac" rows="2" placeholder="예: @캐릭A, upper body, simple background"></textarea></label>
      <div class="grid2"><label class="fld">씬당 장수<input type="number" id="tpCount" value="4" min="1" max="99"></label>
      <label class="fld">세트<select id="tpKind"><option value="emo">감정 12종 (기쁨·슬픔·분노·당황·무표정·수줍음·놀람·피곤함·비웃음·울먹임·짜증·공포)</option><option value="custom">직접 입력 (한 줄에 하나: 이름 | 태그)</option></select></label></div>
      <textarea id="tpCustom" class="ta" rows="5" hidden placeholder="교복 | school uniform, standing&#10;수영복 | swimsuit, beach&#10;잠옷 | pajamas, bed"></textarea>
      <div class="row"><button class="btn primary" id="tpMake">씬 만들기</button></div>`;
    body.querySelector('#tpBase').value = cur && cur.prompt ? cur.prompt : '';
    const kind = body.querySelector('#tpKind'), custom = body.querySelector('#tpCustom');
    kind.onchange = () => { custom.hidden = kind.value !== 'custom'; };
    body.querySelector('#tpMake').onclick = () => {
      const base = body.querySelector('#tpBase').value.trim(), count = Math.max(1, +body.querySelector('#tpCount').value || 1);
      let items = [];
      if (kind.value === 'emo') items = EMO_SET;
      else items = custom.value.split('\n').map(l => l.split('|')).filter(a => a.length >= 2).map(a => [a[0].trim(), a.slice(1).join('|').trim()]);
      if (!items.length) { toast('항목이 없습니다', 'err'); return; }
      let first = null;
      for (const [name, tags] of items) { const sc = newScene({ name, prompt: joinParts(base, tags), count }); if (!first) first = sc; }
      S.curScene = first.id; save(); closeModal(); renderScenes(); toast(`씬 ${items.length}개 생성`);
    };
  });
}

/* ─────────────── 라이브러리 ─────────────── */
const LIB = { scene: 'all', fav: false, sel: new Set() };
function renderLibrary() {
  const view = $('#libView'); if (view.hidden) return;
  const sel = $('#libScene');
  const cur = sel.value || LIB.scene;
  sel.innerHTML = '<option value="all">전체</option><option value="none">메인(씬 없음)</option>' + S.scenes.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'all'; LIB.scene = sel.value;
  let items = R.hist.slice();
  if (LIB.scene === 'none') items = items.filter(h => !h.sceneId);
  else if (LIB.scene !== 'all') items = items.filter(h => h.sceneId === LIB.scene);
  if (LIB.fav) items = items.filter(h => h.fav);
  $('#libN').textContent = `${items.length}장`;
  $('#libFav').style.color = LIB.fav ? 'var(--gold)' : '';
  const g = $('#libGrid'); g.innerHTML = '';
  if (!items.length) { g.innerHTML = '<div class="vempty"><div class="vempty-ico">🗂</div><div class="hint">이미지가 없습니다</div></div>'; updateLibSel(); return; }
  for (let i = items.length - 1; i >= 0; i--) {
    const h = items[i];
    const d = document.createElement('div'); d.className = 'scg-item' + (LIB.sel.has(h) ? ' sel' : '') + (h.saved ? ' saved' : '');
    d.innerHTML = `<img loading="lazy"><button class="scg-fav">${h.fav ? '★' : '☆'}</button><input type="checkbox" class="scg-ck">${h.saved ? '<span class="svd">💾</span>' : ''}<div class="scg-cap"></div>`;
    d.querySelector('img').src = h.url;
    d.querySelector('.scg-cap').textContent = (h.meta && h.meta.sceneName ? h.meta.sceneName + ' · ' : '') + `seed ${h.seed}`;
    d.querySelector('.scg-fav').classList.toggle('on', !!h.fav);
    d.querySelector('.scg-fav').onclick = e => { e.stopPropagation(); toggleFav(h); renderLibrary(); };
    const ck = d.querySelector('.scg-ck'); ck.checked = LIB.sel.has(h);
    ck.onclick = e => { e.stopPropagation(); if (ck.checked) LIB.sel.add(h); else LIB.sel.delete(h); d.classList.toggle('sel', ck.checked); updateLibSel(); };
    d.onclick = () => openLightbox(h);
    g.appendChild(d);
  }
  updateLibSel();
}
function updateLibSel() {
  // 히스토리에서 이미 사라진 항목은 선택에서 털어낸다 (지운 이미지가 다시 저장되던 문제)
  LIB.sel.forEach(h => { if (R.hist.indexOf(h) < 0) LIB.sel.delete(h); });
  $('#libSelN').textContent = LIB.sel.size ? `${LIB.sel.size}개 선택` : '';
  $('#libSelSave').disabled = $('#libSelDel').disabled = !LIB.sel.size;
}

/* ─────────────── init ─────────────── */
function initScenes() {
  if (new URLSearchParams(location.search).get('demo') && !S.scenes.length) {
    S.styles = [{ id: 'demo', name: '커플 일러스트', prefix: '2boys, flat color, clean lineart', suffix: '', uc: 'monochrome' }];
    S.chunks = [{ name: '퀄리티', text: 'best quality, amazing quality', cat: '기본' }, { name: '교복', text: 'school uniform, pleated skirt', cat: '의상' }, { name: '옷', text: '<school uniform|dress|kimono>', cat: '의상' }];
    S.secText = { qa: '퀄리티, artist:hoshi_(snowdrop)', char: '1girl, silver hair, 교복', act: '<smile|grin>, sitting, looking at viewer', bg: 'park, sunset', style: 'upper body, soft lighting' }; syncPromptFromSections(); renderSections(); renderChunkBar();
    ['벤치', '기쁨', '슬픔'].forEach((n, i) => newScene({ name: n, prompt: ['@옷, sitting on bench, park', '@옷, happy, smile', '@옷, sad, tears'][i], count: 4 }));
    S.curScene = S.scenes[0].id;
  }
  $('#scAdd').onclick = () => { newScene(); renderScenes(); setTimeout(() => { const n = $('#scName'); if (n) { n.focus(); n.select(); } }, 30); };
  $('#scTemplates').onclick = openSceneTemplates;
  $('#scRunAll').onclick = () => {
    const list = S.scenes.filter(s => s.count > 0 && sceneHasContent(s)).map(s => ({ scene: s, count: s.count }));
    if (!list.length) { toast('장수가 1 이상이고 프롬프트가 있는 씬이 없습니다', 'err'); return; }
    runScenes(list);
  };
  $('#scStop').onclick = () => { SR.stop = true; toast('현재 이미지 완료 후 정지합니다'); };
  $('#btnStyles').onclick = () => openStyleManager();
  $('#btnCharLib').onclick = () => openCharLibrary();
  $('#mainStyle').onchange = () => { S.activeStyle = $('#mainStyle').value || null; save(); };
  $('#libScene').onchange = () => { LIB.scene = $('#libScene').value; LIB.sel.clear(); renderLibrary(); };
  // 필터를 바꾸면 선택을 비운다. 안 그러면 화면에 보이지도 않는 이미지가
  // '선택 삭제'·'선택 저장' 에 그대로 휩쓸린다.
  $('#libFav').onclick = () => { LIB.fav = !LIB.fav; LIB.sel.clear(); renderLibrary(); };
  $('#libSelSave').onclick = () => { bulkSave([...LIB.sel], S.stripOnSave); };
  $('#libSelDel').onclick = () => { const n = LIB.sel.size; LIB.sel.forEach(h => deleteItem(h, true)); LIB.sel.clear(); refreshAfterBulk(); renderLibrary(); toast(n + '장 삭제'); };
  $('#libSelAll').onclick = () => { $$('#libGrid .scg-ck').forEach(ck => { if (!ck.checked) ck.click(); }); };
  $('#libSelNone').onclick = () => { LIB.sel.clear(); renderLibrary(); };
  renderStyleSelects();
  window.renderScenes = renderScenes; window.renderLibrary = renderLibrary;
  const softRefresh = () => {
    if (S.mode === 'scene') { renderSceneList(); const sc = curScene(); if (sc && $('#scGal')) renderSceneGallery(sc); else renderSceneEditor(); }
    if (S.mode === 'library') renderLibrary();
  };
  window.onHistChanged = softRefresh;
  // 이 훅은 스마트 툴도 쓴다. 통째로 덮어쓰면 스마트 툴 탭이 새 이미지를 못 받는다.
  window.onImageGenerated = (prev => it => { if (prev) prev(it); softRefresh(it); })(window.onImageGenerated);
}
