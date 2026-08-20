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
/* ═══════════════ 태그: 한글 단부루 DB + NAI 제안 자동완성 + 태그 검색 창 ═══════════════ */

const TAGDB = { rows: null, map: null, state: 'idle', msg: '', idx: null, groups: null, extraLoaded: false, koLoaded: false, nsfw: null };
const CAT_NAME = { 0: '일반', 1: '아티스트', 3: '작품', 4: '캐릭터', 5: '메타' };
const hasKo = s => /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(s);

async function loadTagDb() {
  if (TAGDB.rows || TAGDB.state === 'loading') return;
  TAGDB.state = 'loading';
  try {
    const res = await apiFetch('/tags/kr.json');
    if (res.status === 503) {
      const j = await res.json().catch(() => ({}));
      TAGDB.state = 'waiting'; TAGDB.msg = (j.tags && j.tags.msg) || '태그 DB 준비 중';
      setTimeout(loadTagDb, 5000);
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    const map = new Map();
    for (const r of rows) {
      // r: [tag, cat, cnt, path, kw, desc] → 검색 문자열 미리 계산해 r[6..10] 에 채움
      prepRow(r);
      map.set(r[0], r);
    }
    TAGDB.rows = rows; TAGDB.map = map; TAGDB.state = 'ready';
    console.log('[tags] loaded', rows.length);
    buildTagIndex();
    tagDbNotify();
    loadExtraTags();     // 영문 보강 사전(작가·캐릭터 위주)은 뒤이어 비동기로 덧붙인다
  } catch (e) {
    TAGDB.state = 'error'; TAGDB.msg = e.message;
    setTimeout(loadTagDb, 8000);
  }
}
/* 한 행을 검색용으로 가공 — r[6..10] 을 채운다 (본 사전/보강 사전 공통) */
function prepRow(r) {
  const t = r[0], sp = t.replace(/_/g, ' ');
  const s = (sp + ' ' + (r[4] || '') + ' ' + (r[3] || '')).toLowerCase();
  const kws = (r[4] || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  r[6] = s; r[7] = s.replace(/[\s,]/g, ''); r[8] = sp; r[9] = kws; r[10] = kws.map(x => x.replace(/\s/g, ''));
  return r;
}
/* 단어 시작 2글자 → 행 번호 목록.
   이게 없으면 키 입력마다 전체(20만 행)를 훑어 90~230ms 씩 멈춘다. 인덱스로 1~8ms. */
function buildTagIndex() {
  const rows = TAGDB.rows; if (!rows) return;
  const t0 = performance.now();
  const idx = new Map();
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i][6]; if (!s) continue;
    let prev = -1;
    for (let j = 0; j <= s.length; j++) {
      const ch = s.charCodeAt(j);
      // 공백 , > _ - 를 단어 경계로 (j===s.length 는 문자열 끝)
      const isSep = j === s.length || ch === 32 || ch === 44 || ch === 62 || ch === 95 || ch === 45;
      if (isSep) { prev = j; continue; }
      if (prev === j - 1) {
        const k = s.substr(j, 2);
        let a = idx.get(k); if (!a) { a = []; idx.set(k, a); }
        if (a[a.length - 1] !== i) a.push(i);
      }
    }
  }
  TAGDB.idx = idx;
  console.log('[tags] index', idx.size, 'keys in', Math.round(performance.now() - t0) + 'ms');
}
async function loadExtraTags() {
  if (TAGDB.extraLoaded) return;
  TAGDB.extraLoaded = true;
  try {
    const res = await apiFetch('/tags/extra.json');
    if (res.status === 204 || !res.ok) return;
    const rows = await res.json();
    let added = 0;
    for (const r of rows) {
      if (TAGDB.map.has(r[0])) continue;
      prepRow(r); TAGDB.rows.push(r); TAGDB.map.set(r[0], r); added++;
    }
    if (added) { buildTagIndex(); console.log('[tags] +extra', added, '→', TAGDB.rows.length); }
  } catch (e) {
    // 서버가 아직 안 떴을 뿐일 수 있다. 표시를 되돌려 다음에 다시 받아오게 한다
    // (안 그러면 작가·캐릭터 태그가 그 세션 내내 통째로 빠진다)
    TAGDB.extraLoaded = false;
  }
  finally { loadKoAlias(); tagDbNotify(); }
}
/* 한글 표현 별칭 — "얼굴이 작다" 처럼 문장으로 검색해도 태그가 나오게 (출처: novelai.app 태그생성기).
   실제로 단부루에 존재하는 태그에만 붙인다. */
async function loadKoAlias() {
  if (TAGDB.koLoaded) return;
  TAGDB.koLoaded = true;
  try {
    const res = await apiFetch('/tags/koalias.json');
    if (res.status === 204 || !res.ok) return;
    const j = await res.json();
    let n = 0;
    for (const tag in (j.alias || {})) {
      const r = TAGDB.map.get(tag);
      if (!r) continue;
      const add = j.alias[tag];
      r[4] = r[4] ? (r[4] + ', ' + add) : add;   // 기존 한글 키워드 뒤에 덧붙임
      prepRow(r); n++;
    }
    TAGDB.nsfw = new Set(j.nsfw || []);
    if (n) { buildTagIndex(); console.log('[tags] +한글표현', n); }
  } catch (e) { TAGDB.koLoaded = false; /* 다음에 다시 시도 */ }
  finally { tagDbNotify(); }
}

/* 사전이 (보강분까지) 새로 들어오면 열려 있는 창에 알려 다시 그리게 한다.
   창을 열 때 아직 로딩 중이면 "결과 없음" 이 그대로 굳어 버렸다. */
function tagDbNotify() {
  const w = TAGDB.waiters || [];
  TAGDB.waiters = w.filter(f => { try { return f() !== false; } catch (e) { return false; } });
}
async function loadTagGroups() {
  if (TAGDB.groups) return TAGDB.groups;
  /* 실패를 {} 로 캐시해 버리면 (서버가 늦게 뜬 것뿐인데도) 세션 내내 그룹 탐색이 빈 채로
     남는다 → 실패는 캐시하지 않고, 다음에 부를 때 다시 시도한다. */
  try {
    const res = await apiFetch('/tags/groups.json');
    if (res.status === 204) { TAGDB.groups = {}; return TAGDB.groups; }   // 서버가 "없음" 이라고 확답한 경우만 캐시
    if (!res.ok) return {};
    TAGDB.groups = await res.json();
  } catch (e) { return {}; }
  return TAGDB.groups;
}
window.onServerUp = () => { loadTagDb(); loadT5().then(() => { if (typeof updatePreview === 'function') updatePreview(); }); };

function tagSearchLocal(q, limit, cat, maxCand) {
  if (!TAGDB.rows) return [];
  q = q.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const qNoSp = q.replace(/[\s_]/g, '');
  const qSp = q.replace(/_/g, ' ');
  const termsN = terms.map(t => t.replace(/_/g, ''));   // 루프 안에서 매번 replace 하면 20% 느려진다
  const cap = maxCand || 4000;
  const rows = TAGDB.rows;

  const scan = list => {   // list: 행 번호 배열이거나 null(전체)
    const out = [];
    const n = list ? list.length : rows.length;
    for (let ii = 0; ii < n; ii++) {
      const r = rows[list ? list[ii] : ii];
      if (cat != null && r[1] !== cat) continue;
      const s = r[6], sn = r[7];
      let ok = true;
      for (let k = 0; k < terms.length; k++) { if (!s.includes(terms[k]) && !sn.includes(termsN[k])) { ok = false; break; } }
      if (!ok && !sn.includes(qNoSp)) continue;
      let score = 100;
      const tag = r[8], kws = r[9], kwn = r[10];
      if (tag === qSp) score = 500;
      else if (kws.includes(q) || kwn.includes(qNoSp)) score = 450;          // 한글 키워드 정확 일치
      else if (tag.startsWith(qSp)) score = 400;
      else if (kws.some(k => k.startsWith(q)) || kwn.some(k => k.startsWith(qNoSp))) score = 350;
      else if (tag.includes(qSp)) score = 300;
      else if (kwn.some(k => k.includes(qNoSp))) score = 250;
      out.push([score, r]);
      /* 상한은 점수를 매기기 전에 자르므로, 뒤에 덧붙인 보강 사전 태그는 완전 일치라도
         잘려나갔다(예: uniform 10만건이 자동완성에 안 떴다).
         → 높은 점수(정확/앞부분 일치)를 만나면 상한을 조금 넉넉히 봐준다. */
      if (out.length >= cap && score < 400) break;
      if (out.length >= cap * 2) break;
    }
    return out;
  };

  // 인덱스로 후보를 좁혀 먼저 훑고(대부분 여기서 끝난다), 결과가 모자랄 때만 전체 스캔으로 폴백.
  // 인덱스는 "단어 시작" 기준이라 단어 중간에 걸리는 일치(예: eyes 안의 yes)는 폴백이 잡는다.
  let out = null;
  if (TAGDB.idx) {
    const longest = terms.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (longest.length >= 2) {
      const bucket = TAGDB.idx.get(longest.slice(0, 2));
      out = bucket ? scan(bucket) : [];
    }
  }
  /* 인덱스는 "단어 시작" 기준이라 단어 중간 일치(eyes 안의 yes)와 한글 별칭 일부를 놓친다.
     예전엔 인덱스에서 한 건이라도 걸리면 전체 스캔을 통째로 건너뛰어서, 정답이 있는데도
     엉뚱한 한 건만 보여줬다. 그렇다고 매번 20만 행을 훑으면 타이핑이 끊긴다.
     → 인덱스 결과가 넉넉하면(8건 이상) 그대로 쓰고, 부족할 때만 전체를 훑는다. */
  const ENOUGH = Math.min(limit || 20, 8);
  if (!out || out.length < ENOUGH) {
    /* 한 단어짜리 질의가 전체 스캔에서도 0건이었다면, 거기에 글자를 더 붙인 질의도 0건이다
       (모든 항이 부분문자열로 포함돼야 하므로) → 타이핑 중 매 글자마다 훑는 낭비를 막는다.
       단 이 기억은 '그때 그 카테고리 안에서 0건' 이라는 뜻이다. 카테고리를 같이 적어두지
       않으면, 작가 칩으로 한 번 검색한 단어가 세션 내내 전 영역에서 0건이 돼버린다. */
    const dead = TAGDB.deadQ;
    if (terms.length === 1 && dead && dead.cat === cat && q.startsWith(dead.q)) return [];
    const full = scan(null);
    if (full.length) {
      // 인덱스 결과와 합치되 같은 행이 두 번 들어가지 않게
      const seen = new Set((out || []).map(x => x[1]));
      out = (out || []).concat(full.filter(x => !seen.has(x[1])));
      TAGDB.deadQ = null;
    } else if (terms.length === 1 && !(out && out.length)) {
      TAGDB.deadQ = { q, cat };
    }
    out = out || [];
  }
  out.sort((a, b) => b[0] - a[0] || b[1][2] - a[1][2]);
  return out.slice(0, limit).map(x => x[1]);
}
function krOf(tag) {
  const r = TAGDB.map && (TAGDB.map.get(tag) || TAGDB.map.get(tag.replace(/ /g, '_')));
  return r ? (r[4] || '').split(',')[0].trim() : '';
}
function catOf(tag) {
  const r = TAGDB.map && (TAGDB.map.get(tag) || TAGDB.map.get(tag.replace(/ /g, '_')));
  return r ? r[1] : 0;
}
function fmtTag(tag) {
  if (S.tagUnderscore) return tag;
  if (/^[\W_]+$/.test(tag)) return tag; // ^_^ @_@ 같은 기호 태그
  return tag.replace(/_/g, ' ');
}
function activeTA() { // 보이는 프롬프트 칸 (숨겨진 #prompt 로 들어가 사라지는 것 방지)
  const vis = t => t && document.contains(t) && t.offsetParent !== null;
  if (vis(R.lastTA)) return R.lastTA;
  if (S.mode === 'scene') { const s = $('#scPrompt'); if (vis(s)) return s; }
  if (!S.singleBox) { const s = $('#secList textarea.sec-ta'); if (vis(s)) return s; }
  const p = $('#prompt'); return vis(p) ? p : ($('#secList textarea.sec-ta') || p);
}
function insertIntoPrompt(text) {
  const ta = activeTA();
  if (!ta) { toast('프롬프트 칸을 먼저 클릭하세요', 'err'); return; }
  const v = ta.value;
  let a = ta.selectionStart, b = ta.selectionEnd;
  if (a == null) { a = b = v.length; }
  const before = v.slice(0, a), after = v.slice(b);
  const needComma = before.trim() && !/[,{[<(|:]\s*$/.test(before);
  const ins = (needComma ? ', ' : '') + text + (after.trim().startsWith(',') || !after.trim() ? '' : ', ');
  ta.value = before + ins + after;
  const np = a + ins.length;
  ta.setSelectionRange(np, np);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  // 태그 검색 모달에서 넣은 경우엔 모달 뒤 프롬프트로 포커스를 넘기면 안 된다
  // (자동완성 박스가 모달 위를 덮고 검색을 이어서 못 함). 모달 안의 칸이면 종전대로 포커스.
  const mo = $('#modalOverlay');
  if (mo && !mo.hidden && !ta.closest('#modalBody')) {
    if (typeof acDismiss === 'function') acDismiss();
    const q = $('#tsQ'); if (q) q.focus();
  } else ta.focus();
}

/* ─────────────── 자동완성 ─────────────── */
const AC = { box: null, ta: null, items: [], sel: -1, seg: null, ctl: null, timer: null, reqId: 0 };
function acSegment(ta) {
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const parts = before.split(/[,\n{}\[\]<>|]/);
  let last = parts[parts.length - 1].replace(/^\s+/, '');
  last = last.replace(/^-?[\d.]+::/, '');
  return { text: last, start: pos - last.length, pos };
}
function acHide() { if (AC.box) { AC.box.hidden = true; } AC.items = []; AC.sel = -1; }
/* 사용자가 직접 닫았을 때 — 진행 중인 NAI 제안 요청과 대기 중인 디바운스까지 무효화해서
   닫은 뒤에 응답이 도착해 박스가 되살아나지 않게 한다 */
function acDismiss() { AC.reqId++; if (AC.ctl) { try { AC.ctl.abort(); } catch (e) {} AC.ctl = null; } clearTimeout(AC.timer); acHide(); }
async function acQuery(ta) {
  const seg = acSegment(ta);
  AC.seg = seg; AC.ta = ta;
  const q = seg.text.trim();
  if (q.length < 2 && !q.startsWith('@')) { acHide(); return; }
  const rid = ++AC.reqId;
  const ko = hasKo(q);
  const local = tagSearchLocal(q, 12, null, 600);
  const ql = q.toLowerCase().replace(/^@/, '');
  const chunkHits = S.chunks.filter(c => c.name.toLowerCase().includes(ql)).slice(0, 4).map(c => ({ tag: c.name, chunk: true, cat: 9, kr: '🧩 청크 · ' + c.text.slice(0, 40), count: null }));
  let items = chunkHits.concat(local.map(r => ({ tag: r[0], count: r[2], cat: r[1], kr: (r[4] || '').split(',')[0].trim() })));
  if (rid !== AC.reqId) return;
  // 0건이면 무조건 닫는다 — 예전엔 이전 후보가 그대로 남아 엉뚱한 태그가 확정됐다
  if (items.length) acRender(items); else acHide();
  if (ko || !R.srvOk || q.startsWith('@')) return;
  // NAI 제안 병합 (모델별 학습 데이터 기준 카운트)
  if (AC.ctl) AC.ctl.abort();
  AC.ctl = new AbortController();
  try {
    const res = await apiFetch('/img/ai/generate-image/suggest-tags?model=' + encodeURIComponent(S.model) + '&prompt=' + encodeURIComponent(q),
      { headers: authHeaders(), signal: AC.ctl.signal });
    if (rid !== AC.reqId) return;
    if (!res.ok) { if (!items.length) acHide(); return; }
    const j = await res.json();
    const nai = (j.tags || []).map(t => ({ tag: t.tag.replace(/ /g, '_'), count: t.count, cat: catOf(t.tag), kr: krOf(t.tag), nai: true }));
    const seen = new Set(nai.map(t => t.tag));
    items = chunkHits.concat(nai, items.filter(t => !t.chunk && !seen.has(t.tag))).slice(0, 14);
    if (items.length) acRender(items); else acHide();
  } catch (e) { /* aborted */ }
}
function acRender(items) {
  AC.items = items; AC.sel = -1;
  const box = AC.box; box.innerHTML = '';
  items.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'ac-item';
    d.innerHTML = `<span class="ac-c c${t.cat}"></span><span><span class="ac-tag"></span><span class="ac-kr"></span></span><span class="cnt"></span>`;
    d.querySelector('.ac-tag').textContent = t.chunk ? t.tag : fmtTag(t.tag);
    if (t.chunk) d.classList.add('is-chunk');
    d.querySelector('.ac-kr').textContent = t.kr || '';
    d.querySelector('.cnt').textContent = t.count != null ? fmtN(t.count) : '';
    d.onmousedown = e => { e.preventDefault(); acPick(i); };
    box.appendChild(d);
  });
  const ta = AC.ta, r = ta.getBoundingClientRect();
  box.style.left = Math.min(r.left, innerWidth - 330) + 'px';
  box.style.top = Math.min(r.bottom + 4, innerHeight - 310) + 'px';
  box.style.width = Math.max(300, Math.min(r.width, 520)) + 'px';
  box.hidden = false;
}
function acPick(i) {
  const t = AC.items[i]; if (!t || !AC.ta) return;
  const ta = AC.ta, seg = acSegment(ta);   // 저장된 옛 위치가 아니라 현재 커서 기준
  const tag = t.chunk ? t.tag : fmtTag(t.tag);
  // 뒤가 이미 쉼표로 시작하면 구분자를 붙이지 않는다 (중간 삽입 시 ", ," 로 빈 태그가 생기던 문제)
  const rest = ta.value.slice(seg.pos);
  const sep = /^\s*,/.test(rest) ? '' : ', ';
  ta.value = ta.value.slice(0, seg.start) + tag + sep + rest;
  const np = seg.start + tag.length + sep.length;
  ta.setSelectionRange(np, np);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  acHide(); ta.focus();
}
function acMove(d) {
  if (!AC.items.length) return;
  AC.sel = (AC.sel + d + AC.items.length) % AC.items.length;
  [...AC.box.children].forEach((c, i) => c.classList.toggle('sel', i === AC.sel));
  AC.box.children[AC.sel].scrollIntoView({ block: 'nearest' });
}

/* ─────────────── 태그 검색 창 ─────────────── */
/* ═══════════ 작가 태그 브라우저 (단부루 연동) ═══════════
   작가를 검색 → 그 작가의 실제 그림 샘플을 보고 → 프롬프트에 넣고 → 비슷한 작가로 이어서 탐색.
   모든 요청은 로컬 서버가 대신 보낸다(브라우저 CORS 회피 + 캐시 + 초당 1회 제한). */
const ART = { name: '', safe: true };
function danThumb(b64) { return R.api + '/dan/img?u=' + encodeURIComponent(b64); }
async function danFetch(path) {
  const res = await apiFetch(path);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || ('HTTP ' + res.status));
  return j;
}
function openArtistBrowser(initial) {
  openModal('🎨 작가 태그 — 실제 그림을 보고 고르기', body => {
    body.innerHTML = `
      <div class="tsbar"><input type="text" id="abQ" placeholder="작가 이름 일부 (예: dishwasher, wlop, mery) — 내 사전 + 단부루에서 찾습니다" autocomplete="off">
        <label class="ck" title="끄면 전연령 필터 없이 가져옵니다"><input type="checkbox" id="abSafe" checked> 전연령만</label></div>
      <div class="tscats" id="abHits"></div>
      <div id="abHead" class="hint"></div>
      <div id="abGrid" class="ab-grid"></div>
      <div class="tscats" id="abRel"></div>
      <div class="tsdesc" id="abMsg">작가 이름을 입력하면 내 사전(작가 ${'93,362'.toString()}개)에서 후보를 찾고, 고르면 단부루에서 그 작가의 그림을 가져옵니다.</div>`;
    const q = body.querySelector('#abQ'), hits = body.querySelector('#abHits'), grid = body.querySelector('#abGrid'),
      rel = body.querySelector('#abRel'), msg = body.querySelector('#abMsg'), head = body.querySelector('#abHead');
    const safeCk = body.querySelector('#abSafe'); safeCk.checked = ART.safe;
    safeCk.onchange = () => { ART.safe = safeCk.checked; if (ART.name) showArtist(ART.name); };

    const localHits = s => tagSearchLocal(s, 14, 1)     // cat 1 = 아티스트
      .map(r => ({ name: r[0], count: r[2] }));

    const drawHits = list => {
      hits.innerHTML = '';
      for (const it of list) {
        const b = document.createElement('button'); b.className = 'chip cat';
        b.textContent = fmtTag(it.name) + (it.count != null ? ` (${fmtN(it.count)})` : '');
        b.onclick = () => showArtist(it.name);
        hits.appendChild(b);
      }
    };
    async function showArtist(name) {
      ART.name = name;
      head.innerHTML = `<b>artist:${escHtml(fmtTag(name))}</b>
        <button class="btn xs primary" id="abIns">프롬프트에 넣기</button>
        <button class="btn xs" id="abFrag">작가랜덤 조각에 추가</button>`;
      head.querySelector('#abIns').onclick = () => insertIntoPrompt('artist:' + fmtTag(name));
      head.querySelector('#abFrag').onclick = () => {
        const c = S.chunks.find(x => normKey(x.name) === normKey('작가랜덤'));
        const line = 'artist:' + fmtTag(name);
        if (!c) { S.chunks.push({ name: '작가랜덤', text: line, cat: '작가', createdAt: Date.now() }); addChunkCat('작가'); }
        else if (!c.text.split('\n').some(l => l.trim() === line)) c.text = (c.text.trim() + '\n' + line).trim();
        else { toast('이미 들어 있습니다'); return; }
        save(); renderChunkBar(); toast('작가랜덤 조각에 추가 — <작가랜덤> 으로 매번 다른 작가가 뽑힙니다');
      };
      grid.innerHTML = '<div class="hint">단부루에서 그림 가져오는 중…</div>'; rel.innerHTML = '';
      // 작가를 빠르게 여러 번 누르면 늦게 온 응답이 지금 보고 있는 작가의 그림을 덮어쓴다.
      // 지금 요청이 마지막인지 확인하고 나서만 화면을 건드린다.
      const myReq = (ART.seq = (ART.seq || 0) + 1);
      try {
        const j = await danFetch(`/dan/posts?tag=${encodeURIComponent(name)}&limit=12&safe=${ART.safe ? 1 : 0}`);
        if (myReq !== ART.seq) return;
        grid.innerHTML = '';
        if (!j.posts.length) { grid.innerHTML = `<div class="hint">샘플이 없습니다${ART.safe ? ' — 전연령만 체크를 꺼보세요' : ''}</div>`; }
        for (const p of j.posts) {
          const d = document.createElement('div'); d.className = 'ab-cell';
          const im = document.createElement('img'); im.src = danThumb(p.thumb);   // 12장뿐이라 lazy 안 씀 (안 보이는 창에서 안 뜨는 문제)
          im.onerror = () => { d.remove(); };
          d.appendChild(im);
          d.title = `#${p.id} · ${p.rating} · score ${p.score}`;
          d.onclick = () => window.open(danThumb(p.large), '_blank', 'noopener');
          grid.appendChild(d);
        }
        msg.textContent = `${j.posts.length}장 · 그림을 누르면 크게 봅니다`
          + (j.source === 'safebooru' ? ' · 단부루가 막혀 있어 safebooru.org 에서 가져왔습니다 (전연령)' : '');
      } catch (e) { grid.innerHTML = `<div class="hint">✖ ${escHtml(e.message)}</div>`; }
      try {
        const r = await danFetch(`/dan/related?tag=${encodeURIComponent(name)}`);
        rel.innerHTML = r.related.length ? '<span class="hint">비슷한 작가:</span>' : '';
        for (const it of r.related.slice(0, 14)) {
          const b = document.createElement('button'); b.className = 'chip cat';
          b.textContent = fmtTag(it.name) + (it.count ? ` (${fmtN(it.count)})` : '');
          b.onclick = () => showArtist(it.name);
          rel.appendChild(b);
        }
      } catch (e) {
        // 추천은 단부루 전용 API 라 차단된 망에서는 못 쓴다 → 내 작가 목록으로 대체 안내
        rel.innerHTML = '<span class="hint">비슷한 작가 추천은 단부루 연결이 필요합니다 — 대신 📚 그룹에서 “★ 내 작가 태그”를 훑어보세요</span>';
      }
    }
    let tm = null;
    q.oninput = () => {
      clearTimeout(tm);
      const s = q.value.trim();
      if (s.length < 2) { hits.innerHTML = ''; return; }
      drawHits(localHits(s));                       // 내 사전은 즉시
      tm = setTimeout(async () => {                 // 단부루 자동완성은 살짝 뒤에 합쳐서
        try {
          const j = await danFetch('/dan/ac?q=' + encodeURIComponent(s));
          const have = new Set(localHits(s).map(x => normKey(x.name)));
          const add = j.items.filter(x => x.cat === 1 && !have.has(normKey(x.name)));
          if (add.length) drawHits(localHits(s).concat(add.map(x => ({ name: x.name, count: x.count }))));
        } catch (e) { /* 오프라인이면 내 사전만 */ }
      }, 350);
    };
    q.onkeydown = e => { if (e.key === 'Enter' && q.value.trim()) { e.preventDefault(); showArtist(q.value.trim().replace(/^artist:/i, '')); } };
    setTimeout(() => q.focus(), 40);
    if (initial) { q.value = initial; showArtist(initial.replace(/^artist:/i, '')); }
  }, true);
}
function openTagSearch(initial) {
  openModal('태그 검색 — 한글/영어 · 클릭하면 프롬프트에 삽입', body => {
    body.innerHTML = `
      <div class="tsbar"><input type="text" id="tsQ" placeholder="예: 흰머리, 미소, white hair, hatsune miku …" autocomplete="off">
        <span class="hint" id="tsN"></span></div>
      <div class="tscats" id="tsCats"></div>
      <div class="tscats" id="tsGrpBar"><button class="chip cat" id="tsGrpBtn">📚 그룹으로 찾아보기</button><span class="hint" id="tsGrpNow"></span></div>
      <div class="tscats" id="tsGrps" hidden></div>
      <div class="tslist" id="tsList"></div>
      <div class="tsdesc" id="tsDesc">${TAGDB.rows ? `${TAGDB.rows.length.toLocaleString()}개 태그 · 한글 키워드/설명으로도 검색됩니다 · 행 위에 마우스를 올리면 설명 표시` : ('태그 DB ' + (TAGDB.msg || '로딩 중…'))}</div>`;
    const q = body.querySelector('#tsQ'), list = body.querySelector('#tsList'), desc = body.querySelector('#tsDesc');
    let cat = null;
    const cats = [[null, '전체'], [0, '일반'], [4, '캐릭터'], [3, '작품'], [1, '아티스트'], [5, '메타']];
    const catBox = body.querySelector('#tsCats');
    for (const [c, n] of cats) {
      const b = document.createElement('button'); b.className = 'chip' + (c === cat ? '' : ' cat');
      b.innerHTML = (c != null ? `<span class="cdot c${c}"></span>` : '') + n;
      b.onclick = () => { cat = c; [...catBox.children].forEach(x => x.className = 'chip cat'); b.className = 'chip'; run(); };
      catBox.appendChild(b);
    }
    // 단부루 태그 그룹 — 검색어를 모를 때 훑어보며 고르는 용도
    let grp = null;
    const grpBox = body.querySelector('#tsGrps'), grpNow = body.querySelector('#tsGrpNow');
    body.querySelector('#tsGrpBtn').onclick = async () => {
      const gs = await loadTagGroups();
      const names = Object.keys(gs).sort((a, b) => gs[b].length - gs[a].length);
      if (!names.length) { toast('태그 그룹 자료가 없습니다'); return; }
      grpBox.hidden = !grpBox.hidden;
      if (grpBox.children.length) return;
      for (const n of names) {
        const b = document.createElement('button'); b.className = 'chip cat';
        b.textContent = `${n} (${gs[n].length})`;
        b.onclick = () => {
          grp = (grp === n) ? null : n;
          [...grpBox.children].forEach(x => x.className = 'chip cat');
          if (grp) b.className = 'chip';
          grpNow.textContent = grp ? `그룹: ${grp}` : '';
          run();
        };
        grpBox.appendChild(b);
      }
    };
    const run = () => {
      let rows;
      if (grp && TAGDB.groups && TAGDB.groups[grp]) {
        // 그룹 안에서만 (검색어가 있으면 그 안에서 다시 거름)
        const qq = q.value.trim().toLowerCase().replace(/_/g, ' ');
        rows = TAGDB.groups[grp].map(t => TAGDB.map.get(t)).filter(Boolean)
          .filter(r => cat == null || r[1] === cat)
          // r[6] 은 공백이 살아있는 원문, r[7] 은 공백을 뺀 것.
          // 한글 별칭은 "흰 머리" 처럼 띄어져 있어서 r[6] 만 보면 "흰머리" 가 안 걸린다.
          .filter(r => !qq || r[6].includes(qq) || r[7].includes(qq.replace(/[\s,]/g, '')))
          .sort((a, b) => b[2] - a[2]).slice(0, 300);
      } else rows = tagSearchLocal(q.value, 300, cat);
      list.innerHTML = '';
      body.querySelector('#tsN').textContent = rows.length ? `${rows.length}${rows.length >= 300 ? '+' : ''}건` : (q.value.trim() ? '결과 없음' : '');
      for (const r of rows) {
        const d = document.createElement('div'); d.className = 'tsrow';
        d.innerHTML = `<span class="ts-c c${r[1]}"></span><span class="ts-tag"></span><span class="ts-kr"></span><span class="ts-path"></span><span class="ts-cnt"></span>`;
        d.children[1].textContent = fmtTag(r[0]);
        d.children[2].textContent = r[4] || '';
        d.children[3].textContent = r[3] ? r[3].replace('>', ' › ') : CAT_NAME[r[1]] || '';
        d.children[4].textContent = fmtN(r[2]);
        d.onmouseenter = () => { desc.innerHTML = `<b>${fmtTag(r[0])}</b> ${r[4] ? '· ' + r[4] : ''}<br>${r[5] || '(설명 없음)'}`; };
        d.onclick = e => {
          if (e.shiftKey) { navigator.clipboard.writeText(fmtTag(r[0])).then(() => toast('복사: ' + fmtTag(r[0]))); return; }
          insertIntoPrompt(fmtTag(r[0])); toast('삽입: ' + fmtTag(r[0]));
        };
        list.appendChild(d);
      }
    };
    let t = null;
    q.oninput = () => { clearTimeout(t); t = setTimeout(run, 120); };
    q.onkeydown = e => { if (e.key === 'Enter') { const first = list.querySelector('.tsrow'); if (first) first.click(); } };
    if (initial) { q.value = initial; run(); }
    setTimeout(() => q.focus(), 50);
    if (!TAGDB.rows) {
      loadTagDb();
      body.querySelector('#tsN').textContent = '사전 읽는 중…';
      // 다 읽히면 한 번 더 그린다. 창이 이미 닫혔으면 false 를 돌려 목록에서 빠진다.
      (TAGDB.waiters = TAGDB.waiters || []).push(() => body.isConnected && (run(), true));
    }
  }, true);
}

/* ─────────────── 프롬프트 토큰 수 (T5 unigram — V4/4.5 한도 512) ───────────────
   NAI 웹과 같은 방식: 가중치 문자([]{}, N::)를 지운 뒤 공백으로 나누고
   각 조각 앞에 ▁ 를 붙여 sentencepiece unigram 최적 분할, 마지막에 EOS 1개. */
const T5 = { vocab: null, maxLen: 0, unk: 0, state: 'idle' };
async function loadT5() {
  if (T5.state !== 'idle') return T5.vocab;
  T5.state = 'loading';
  try {
    const res = await apiFetch('/tags/t5.json');
    if (res.status === 204 || !res.ok) { T5.state = 'none'; return null; }
    const v = await res.json();
    const m = new Map(); let maxLen = 0, min = Infinity;
    for (let i = 0; i < v.length; i++) {
      const piece = v[i][0], score = v[i][1];
      m.set(piece, score);
      if (piece.length > maxLen) maxLen = piece.length;
      if (score < min) min = score;
    }
    T5.vocab = m; T5.maxLen = maxLen; T5.unk = min - 10; T5.state = 'ready';
  } catch (e) { T5.state = 'none'; }
  return T5.vocab;
}
function t5PieceCount(piece) {   // Viterbi: 이 조각을 최적 분할했을 때의 토큰 수
  const n = piece.length, v = T5.vocab;
  const bs = new Float64Array(n + 1).fill(-Infinity), bc = new Int32Array(n + 1);
  bs[0] = 0;
  for (let i = 0; i < n; i++) {
    if (bs[i] === -Infinity) continue;
    const max = Math.min(T5.maxLen, n - i);
    let matched = false;
    for (let len = 1; len <= max; len++) {
      const sc = v.get(piece.slice(i, i + len));
      if (sc === undefined) continue;
      matched = true;
      const s = bs[i] + sc;
      if (s > bs[i + len]) { bs[i + len] = s; bc[i + len] = bc[i] + 1; }
    }
    if (!matched) { const s = bs[i] + T5.unk; if (s > bs[i + 1]) { bs[i + 1] = s; bc[i + 1] = bc[i] + 1; } }
  }
  return bc[n];
}
function countTokens(text) {
  if (T5.state !== 'ready') return null;
  const cleaned = String(text || '').replace(/[[\]{}]/g, '').replace(/-?\d*\.?\d*::/g, '');
  let total = 1;   // EOS
  for (const part of cleaned.split(/\s+/)) if (part) total += t5PieceCount('▁' + part);
  return total;
}

/* NAI 편집기 단축키: Ctrl+↑/↓ = 커서(또는 선택) 위치 태그의 가중치 ±0.05 (V4: 1.05::tag:: · V3: {tag}/[tag]) */
function adjustWeight(ta, dir) {
  const v = ta.value; let a = ta.selectionStart, b = ta.selectionEnd;
  if (a === b) { // 커서가 있는 토큰 범위 (쉼표·줄바꿈·괄호를 경계로)
    /* 먼저 `1.2::red hair, blue eyes::` 처럼 여러 태그를 한 묶음으로 감싼 V4 가중치 안인지
       본다. 쉼표를 경계로 삼으면 묶음 한가운데가 잘려, 잘린 조각에 가중치를 또 씌우고
       :: 짝이 어긋난다 (되돌리기도 안 된다). 묶음 안이면 묶음 전체를 대상으로 잡는다. */
    const GROUP = /(-?[\d.]+)::([^:]*?)::/g;
    let g;
    while ((g = GROUP.exec(v))) {
      if (a > g.index && a < g.index + g[0].length) { a = g.index; b = g.index + g[0].length; break; }
    }
  }
  if (a === b) {
    const DELIM = /[,\n{}[\]<>|]/;
    while (a > 0 && !DELIM.test(v[a - 1])) a--;
    while (b < v.length && !DELIM.test(v[b])) b++;
    while (a < b && /\s/.test(v[a])) a++; while (b > a && /\s/.test(v[b - 1])) b--;
    if (!isV4()) {
      // V3: 감싸고 있는 {}/[] 쌍까지 토큰에 포함시켜야 "벗겨내기" 분기가 동작한다.
      // (안 그러면 {smile} 에 Ctrl+↓ 를 눌렀을 때 [smile] 이 아니라 {[smile]} 이 된다)
      for (;;) {
        let i = a - 1, j = b;
        while (i >= 0 && /\s/.test(v[i])) i--;
        while (j < v.length && /\s/.test(v[j])) j++;
        if (i >= 0 && j < v.length && ((v[i] === '{' && v[j] === '}') || (v[i] === '[' && v[j] === ']'))) { a = i; b = j + 1; }
        else break;
      }
    }
  }
  let tok = v.slice(a, b); if (!tok.trim()) return;
  let out;
  if (isV4()) {
    const m = tok.match(/^(-?[\d.]+)::(.*)::$/);
    let w = m ? parseFloat(m[1]) : 1, inner = m ? m[2] : tok;
    w = Math.round((w + dir * 0.05) * 100) / 100;
    out = Math.abs(w - 1) < 0.001 ? inner : `${w}::${inner}::`;
  } else {
    if (dir > 0) out = tok.startsWith('[') && tok.endsWith(']') ? tok.slice(1, -1) : `{${tok}}`;
    else out = tok.startsWith('{') && tok.endsWith('}') ? tok.slice(1, -1) : `[${tok}]`;
  }
  ta.value = v.slice(0, a) + out + v.slice(b);
  ta.setSelectionRange(a, a + out.length);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function initTags() {
  AC.box = $('#acBox');
  document.addEventListener('keydown', e => {
    if (!e.ctrlKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const t = document.activeElement; if (!t || !t.matches || !t.matches('textarea.ac')) return;
    e.preventDefault(); adjustWeight(t, e.key === 'ArrowUp' ? 1 : -1);
  });
  document.addEventListener('input', e => {
    if (!e.target.classList || !e.target.classList.contains('ac')) return;
    clearTimeout(AC.timer);
    AC.timer = setTimeout(() => acQuery(e.target), 160);
  });
  document.addEventListener('keydown', e => {
    if (!AC.box || AC.box.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Ctrl+↑/↓ 는 가중치 조절 전용 — 목록 이동과 이중으로 걸리지 않게 여기서 넘긴다
      if (e.ctrlKey || e.altKey || e.metaKey) { acHide(); return; }
      e.preventDefault(); acMove(e.key === 'ArrowDown' ? 1 : -1);
    }
    else if ((e.key === 'Enter' || e.key === 'Tab') && AC.sel >= 0) { e.preventDefault(); acPick(AC.sel); }
    else if (e.key === 'Enter' && e.ctrlKey) acDismiss();
    else if (e.key === 'Escape') { e.stopPropagation(); acDismiss(); }
  }, true);
  document.addEventListener('click', e => { if (AC.box && !AC.box.contains(e.target)) acDismiss(); });
  $('#btnTagSearch').onclick = () => openTagSearch();
  const ab = $('#btnArtist'); if (ab) ab.onclick = () => openArtistBrowser();
  document.addEventListener('keydown', e => {
    // 다른 창이 떠 있으면 그 창의 일이다 — 통째로 태그 검색으로 갈아치우면 하던 작업이 날아간다
    if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
      const ov = document.getElementById('modalOverlay');
      if (ov && !ov.hidden) return;
      e.preventDefault(); openTagSearch();
    }
  });
  loadTagDb();
}
