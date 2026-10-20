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
/* ═══════════ 프롬프트 청크 · YouTube 플로팅 · 이미지 툴 · EXIF · 메타 ═══════════ */

/* ─────────────── 프롬프트 청크 ─────────────── */
const CHUNK_COLORS = ['#60a5fa', '#f472b6', '#4ade80', '#fbbf24', '#c084fc', '#fb923c', '#2dd4bf', '#f87171'];
function chunkCats() { // 분류 목록 = 등록된 분류(S.chunkCats, 순서 유지) ∪ 청크에 쓰인 분류
  const cats = [...(S.chunkCats || [])];
  for (const c of S.chunks) { const k = c.cat || '기본'; if (!cats.includes(k)) cats.push(k); }
  if (!cats.length) cats.push('기본');
  return cats;
}
function addChunkCat(name) {
  name = (name || '').trim(); if (!name) return null;
  S.chunkCats = S.chunkCats || [];
  // 분류는 문자열이라 createdAt 을 못 달므로, 다시 만들 때 삭제 기록을 무효화한다
  // (0 으로 덮어써야 서버 기록과 합쳐질 때도 이긴다 — isTombed 는 !!t 로 판정)
  if (S.deleted) S.deleted['cat|' + name.toLowerCase()] = 0;
  if (!S.chunkCats.includes(name)) S.chunkCats.push(name);
  save(); return name;
}
function catSelectHtml(id, cur) { return `<select id="${id}" class="cat-sel">${chunkCats().map(k => `<option value="${esc(k)}"${k === (cur || '기본') ? ' selected' : ''}>${esc(k)}</option>`).join('')}<option value="__new__">＋ 새 분류…</option></select>`; }
function bindCatSelect(sel, onPick) { // "새 분류…" 선택 시 이름 입력
  sel.onchange = () => { if (sel.value === '__new__') { const v = prompt('새 분류 이름'); const n = addChunkCat(v); sel.outerHTML = catSelectHtml(sel.id, n || '기본'); const ns = document.getElementById(sel.id); bindCatSelect(ns, onPick); if (n) onPick(n); return; } onPick(sel.value); };
}
/* 색 (NAI 프롬프트 청크는 청크마다·분류마다 색이 있다 — 빌드 b50892a 청크 편집 «Color»).
   분류 색은 정해 두면 그 색(S.chunkCatColors), 없으면 예전처럼 분류 차례대로 돌려 쓰는 색. 청크 색은 정해 두면 그 색, 없으면 분류 색. */
function catColor(cat) {
  const k = cat || '기본', set = S.chunkCatColors && S.chunkCatColors[k];
  if (set) return set;
  const cats = chunkCats(); return CHUNK_COLORS[Math.max(0, cats.indexOf(k)) % CHUNK_COLORS.length];
}
function chunkColor(c) { return (c && c.color) || catColor(c && c.cat); }
function renderChunkBar(target) {
  if (!target) {
    $$('.chunkbar[data-ta]').forEach(b => renderChunkBar(b));
    /* 플로팅 띠는 자기만의 📌·✕ 칩을 갖고 있다. 위 선택자에 걸려 통째로 다시 그려지면
       그 두 칩이 사라져 고정한 띠를 그 자리에서 끌 수 없게 됐다 — 자기 그리기 함수로 되살린다. */
    if (typeof window._chunkFloatRedraw === 'function') window._chunkFloatRedraw();
    if (typeof refreshHighlights === 'function') refreshHighlights();
  }
  const bar = target || $('#chunkBar'); if (!bar) return; bar.innerHTML = '';
  if (!S.chunks.length) return;
  for (const cat of chunkCats()) {
    const cc = document.createElement('span'); cc.className = 'chip cat'; cc.textContent = cat; bar.appendChild(cc);
    for (const c of S.chunks.filter(x => (x.cat || '기본') === cat)) {
      const b = document.createElement('button'); b.className = 'chip';
      b.innerHTML = `<span class="cdot" style="background:${chunkColor(c)}"></span>`;
      b.appendChild(document.createTextNode(c.name));
      /* 프롬프트 칸에는 언제나 '이름' 만 넣는다.
         후보 목록도 이름만 적으면 생성할 때마다 한 줄씩 뽑힌다 — chunkMap() 이 안에서 <이름> 으로 넘긴다.
         예전엔 후보 목록만 '<이름>' 형태로 넣어서 사용자 프롬프트에 <> 가 섞여 지저분했다. */
      const frag = typeof chunkIsFrag === 'function' && chunkIsFrag(c);
      const nline = typeof chunkLines === 'function' ? chunkLines(c).length : 1;
      b.title = c.text + (frag
        ? '\n\n후보 목록 (' + nline + '줄) — 클릭: 이름 삽입 (생성할 때마다 한 줄만 뽑힘) · Alt+클릭: 전체 내용 그대로'
        : (nline > 1
          ? '\n\n한 덩어리 (' + nline + '줄) — 클릭: 이름 삽입 (생성 시 전체가 한 줄로 이어져 들어감) · Alt+클릭: 내용 그대로'
          : '\n\n클릭: 청크 이름 삽입 (생성 시 내용으로 치환) · Alt+클릭: 내용 그대로')) + ' · 우클릭: 편집';
      b.onclick = e => { if (target && target.dataset.ta) R.lastTA = $('#' + target.dataset.ta);
        insertIntoPrompt(e.altKey ? c.text : c.name); };
      b.oncontextmenu = e => { e.preventDefault(); chunkMenu(e, c, target); };
      bar.appendChild(b);
    }
    cc.title = '우클릭: 분류 이름 변경/삭제';
    cc.oncontextmenu = e => { e.preventDefault(); catMenu(e, cat); };
    cc.onclick = () => openChunkManager(null, cat);
  }
}
/* 우클릭 메뉴 */
function popMenu(e, items) {
  document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
  const m = document.createElement('div'); m.className = 'ctxmenu';
  for (const [label, fn, cls] of items) {
    if (label === '-') { const hr = document.createElement('hr'); m.appendChild(hr); continue; }
    const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
    b.onclick = () => { m.remove(); fn(); }; m.appendChild(b);
  }
  document.body.appendChild(m);
  /* 가로를 상수 200 으로 막고 있었는데 실제 폭은 240px 쯤 된다
     ("🗑 분류 삭제 (청크는 "기본"으로 이동)" 처럼 긴 항목 + 사용자가 지은 분류 이름).
     body 에 overflow: hidden 이라 삐져나간 부분은 스크롤로도 못 본다.
     세로도 하한이 없어 메뉴가 창보다 높으면 위쪽 항목에 영영 못 닿았다.
     실제 크기를 재서 자리를 잡고, 아래가 좁으면 커서 위로 올린다 (자동완성과 같은 방식). */
  const mw = m.offsetWidth, mh = m.offsetHeight;
  const x = Math.max(4, Math.min(e.clientX, innerWidth - mw - 8));
  const below = innerHeight - e.clientY - 8, above = e.clientY - 8;
  let y;
  if (below >= mh) y = e.clientY + 4;
  else if (above >= mh) y = e.clientY - mh - 4;
  else if (below >= above) { y = e.clientY + 4; m.style.maxHeight = Math.max(120, below) + 'px'; }
  else { m.style.maxHeight = Math.max(120, above) + 'px'; y = Math.max(4, e.clientY - Math.min(mh, above) - 4); }
  m.style.left = x + 'px'; m.style.top = y + 'px';
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
  // 바깥 클릭 말고 Esc 로도 닫히게 (다른 떠 있는 것들과 같게)
  const esc = ev => { if (ev.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}
/* 우클릭 메뉴도 그 띠가 가리키는 칸(data-ta)을 좌클릭과 똑같이 존중한다 —
   예전엔 '마지막으로 만졌던 칸' 으로 넣어서 좌클릭과 다른 칸에 들어갔다. */
function chunkMenu(e, c, target) {
  if (target && target.dataset && target.dataset.ta) { const el = $('#' + target.dataset.ta); if (el) R.lastTA = el; }
  const cats = chunkCats().filter(k => k !== (c.cat || '기본'));
  popMenu(e, [
    ['✎ 편집', () => openChunkManager(c)],
    ['📋 내용 삽입', () => insertIntoPrompt(c.text)],
    ['📝 새 분류로 옮기기…', () => { const v = prompt('분류 이름 (' + chunkCats().join(', ') + ')', c.cat || '기본'); if (v != null) { c.cat = v.trim() || '기본'; addChunkCat(c.cat); save(); renderChunkBar(); } }],
    ...cats.slice(0, 5).map(k => ['   → ' + k, () => { c.cat = k; save(); renderChunkBar(); }]),
    ['-'],
    /* 되돌리기가 없다 — 내용이 있으면 확인을 받는다 (메뉴가 위로 뒤집히면 커서 바로 옆에 오는 항목이다) */
    ['🗑 삭제', () => { if ((c.text || '').trim() && !confirm('청크 "' + c.name + '" 를 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) return; tomb('chunk', c.name); S.chunks = S.chunks.filter(x => x !== c); save(); renderChunkBar(); toast('삭제: ' + c.name); }, 'danger'],
  ]);
}
function catMenu(e, cat) {
  popMenu(e, [
    ['✎ 분류 이름 변경', () => renameCat(cat)],
    ['📂 관리창에서 열기', () => openChunkManager(null, cat)],
    ['-'],
    ['🗑 분류 삭제 (청크는 "기본"으로 이동)', () => { tomb('cat', cat); S.chunks.forEach(c => { if ((c.cat || '기본') === cat) c.cat = '기본'; }); S.chunkCats = (S.chunkCats || []).filter(k => k !== cat); save(); renderChunkBar(); }],
    ['🗑 분류와 청크 모두 삭제', () => { const n = S.chunks.filter(c => (c.cat || '기본') === cat).length; if (!confirm(`"${cat}" 분류의 청크 ${n}개를 삭제할까요?`)) return; S.chunks.forEach(c => { if ((c.cat || '기본') === cat) tomb('chunk', c.name); }); tomb('cat', cat); S.chunks = S.chunks.filter(c => (c.cat || '기본') !== cat); S.chunkCats = (S.chunkCats || []).filter(k => k !== cat); save(); renderChunkBar(); }, 'danger'],
  ]);
}
function renameCat(cat) {
  const v = prompt('분류 이름 변경', cat); if (v == null) return;
  const nv = v.trim() || '기본';
  if (nv === cat) return;
  // 옛 이름을 지워진 것으로 남기지 않으면, 서버가 목록을 합칠 때 옛 분류가 빈 채로 되살아난다
  tomb('cat', cat);
  untomb('cat', nv);      // 예전에 지웠던 이름으로 바꾸는 경우 — 그 기록에 걸려 또 사라지면 안 된다
  S.chunks.forEach(c => { if ((c.cat || '기본') === cat) c.cat = nv; });
  S.chunkCats = (S.chunkCats || []).map(k => k === cat ? nv : k).filter((k, i, a) => a.indexOf(k) === i); if (!S.chunkCats.includes(nv)) S.chunkCats.push(nv);
  save(); renderChunkBar();
  if (!$('#modalOverlay').hidden && $('#ckRows')) openChunkManager(null, nv);
}
/* 포커스된 프롬프트 칸 아래에만 뜨는 청크 칩 (평소엔 숨김 · 설정 "청크 칩 항상 표시"로 고정 가능) */
function initChunkFloat() {
  const fl = document.createElement('div'); fl.id = 'chunkFloat'; fl.className = 'chunkbar floating'; fl.hidden = true; document.body.appendChild(fl);
  let hideT = null, curTa = null;
  let show = ta => {
    // 기본은 안 뜬다. 글 쓰려고 칸을 눌렀을 뿐인데 팔레트가 아래 칸을 덮는다는 얘기가 두 번 나왔다.
    if (!S.chunks.length || S.showChunkBars || !S.chunkFloatOn) { fl.hidden = true; return; }
    if (!ta.id) ta.id = 'ta_' + uid();
    curTa = ta; fl.dataset.ta = ta.id; renderChunkBar(fl);
    if (!fl.children.length) { fl.hidden = true; return; }
    const r = ta.getBoundingClientRect();
    fl.style.left = Math.max(8, Math.min(r.left, innerWidth - 420)) + 'px';
    fl.style.width = Math.max(240, Math.min(r.width, 520)) + 'px';
    /* 자리 잡기. 예전엔 무조건 칸 아래에 붙이고 화면 밖으로 나가면 위로 끌어올렸는데,
       그러면 글을 쓰고 있는 칸을 덮어버렸다. 아래에 자리가 없으면 칸 "위" 로 올린다. */
    fl.style.top = '0px'; fl.hidden = false;          // 높이를 재려면 일단 보여야 한다
    const h = fl.offsetHeight || 120;
    const below = innerHeight - r.bottom - 8;
    const above = r.top - 8;
    fl.style.top = (below >= h || below >= above ? Math.min(r.bottom + 4, innerHeight - h - 4)
                                                 : Math.max(4, r.top - h - 4)) + 'px';
  };
  const hideSoon = () => { clearTimeout(hideT); hideT = setTimeout(() => { if (S.chunkFloatPin) return; const a = document.activeElement; if (fl.matches(':hover') || (a && a === curTa)) return; fl.hidden = true; }, 350); };
  /* 청크를 넣을 수 있는 칸에서만 띄운다. 예전엔 자동완성이 붙은 칸이면 무엇이든(네거티브·모달 안 칸)
     띠를 띄워서, 거기서 칩을 누르면 보고 있지도 않은 다른 칸에 조용히 들어갔다. */
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('textarea.ac') && (typeof isPromptTarget !== 'function' || isPromptTarget(e.target))) { clearTimeout(hideT); show(e.target); } else if (!fl.contains(e.target)) hideSoon(); });
  document.addEventListener('focusout', e => { if (e.target.matches && e.target.matches('textarea.ac')) hideSoon(); });
  document.addEventListener('mousedown', e => { if (!fl.hidden && !fl.contains(e.target) && !(e.target.matches && e.target.matches('textarea.ac'))) hideSoon(); });
  fl.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); }); // 칩 클릭 시 포커스 유지
  /* 스크롤마다 칩을 전부 다시 만들 이유가 없다 — 자리만 옮기면 된다.
     예전엔 스크롤 한 번에 (칩 수 × 청크 수) 만큼 DOM 을 새로 만들어 스크롤이 끊겼다. */
  let _mv = 0;
  const moveOnly = () => {
    if (fl.hidden || !curTa || !document.contains(curTa)) return;
    const r = curTa.getBoundingClientRect(), h = fl.offsetHeight || 120;
    fl.style.left = Math.max(8, Math.min(r.left, innerWidth - 420)) + 'px';
    fl.style.width = Math.max(240, Math.min(r.width, 520)) + 'px';
    const below = innerHeight - r.bottom - 8, above = r.top - 8;
    fl.style.top = (below >= h || below >= above ? Math.min(r.bottom + 4, innerHeight - h - 4) : Math.max(4, r.top - h - 4)) + 'px';
  };
  window.addEventListener('scroll', () => { if (_mv) return; _mv = requestAnimationFrame(() => { _mv = 0; moveOnly(); }); }, true);
  window.addEventListener('resize', () => { if (!fl.hidden && curTa) show(curTa); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !S.chunkFloatPin) fl.hidden = true; });
  // 📌 고정: 켜면 포커스가 빠져도 띠가 남음
  const origRender = renderChunkBar;
  window._chunkFloatPin = () => { const p = document.createElement('button'); p.className = 'chip pin' + (S.chunkFloatPin ? ' on' : ''); p.textContent = S.chunkFloatPin ? '📌 고정됨' : '📌'; p.title = '띠를 고정 (포커스가 빠져도 유지)'; p.onclick = () => { S.chunkFloatPin = !S.chunkFloatPin; save(); if (curTa) show(curTa); }; return p; };
  /* ✕ — 그 자리에서 끄기.
     "그냥 프롬프트 쓰는데 태그 칸이 나온다" 는 얘기가 있었다. 설정까지 찾아 들어가지 않아도
     여기서 바로 끌 수 있어야 한다. 끄면 다음에도 안 뜬다. */
  const closeBtn = () => {
    const b = document.createElement('button');
    b.className = 'chip x'; b.textContent = '✕';
    b.title = '이 띠를 끕니다 (⚙설정 → "청크 칩 띠 띄우기" 에서 다시 켤 수 있어요)';
    b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      S.chunkFloatOn = false; save(); fl.hidden = true;
      // 설정 체크박스도 같이 꺼 준다 — 화면엔 켜져 있는데 안 뜨면 고장으로 보인다
      { const cb = document.querySelector('#chunkFloatOn'); if (cb) cb.checked = false; }
      if (typeof syncUI === 'function') syncUI();
      toast('청크 칩 띠를 껐습니다 — ⚙설정에서 다시 켤 수 있어요');
    };
    return b;
  };
  const origShow = show;
  show = ta => { origShow(ta); if (!fl.hidden) { fl.prepend(closeBtn()); fl.prepend(window._chunkFloatPin()); } };
  /* 밖에서 청크가 바뀌었을 때 이 띠만 제대로 다시 그리는 길 (📌·✕ 칩까지 붙여서) */
  window._chunkFloatRedraw = () => { if (!fl.hidden && curTa && document.contains(curTa)) show(curTa); };
  /* 탭을 옮기면 띠를 감춘다 — 📌 로 고정해 두면 라이브러리·스마트툴 탭까지 따라와 도구줄을 덮었다 */
  window._chunkFloatHide = () => { fl.hidden = true; };
}
function saveSelectionAsChunk() {
  /* 지금 글자를 고르고 있는 칸이 있으면 그 칸에서 가져온다 — **읽기** 는 네거티브·모달 칸이라도 안전하다.
     activeTA() 는 '넣을 곳' 을 고르는 함수라 네거티브를 걸러내는데, 그걸 그대로 쓰면
     네거티브 칸에서 ＋청크를 눌렀을 때 보고 있지도 않은 프롬프트 칸의 옛 선택이 저장됐다. */
  const ae = document.activeElement;
  const ta = (ae && ae.tagName === 'TEXTAREA' && document.contains(ae)) ? ae : activeTA();
  if (!ta) { toast('프롬프트 칸을 먼저 클릭하세요', 'err'); return; }
  let sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
  const wholePrompt = !sel; if (wholePrompt) sel = ta.value.trim();
  if (!sel) { toast('저장할 텍스트가 없습니다', 'err'); return; }
  openModal('선택 텍스트 저장', body => {
    body.innerHTML = `
      <div class="seg" id="ckKind" style="max-width:420px"><button data-k="chunk" class="on">🧩 청크로 (분류 지정)</button><button data-k="nocat">🧩 청크로 (분류 없이)</button><button data-k="char">👤 캐릭터로</button></div>
      <div class="grid2"><label class="fld"><span id="ckNameLbl">이름 (프롬프트에 이 이름을 쓰면 칩으로 표시되고 생성 시 내용으로 치환)</span><input type="text" id="ckName" placeholder="예: 퀄리티, 캐릭A, 교복"></label>
      <label class="fld" id="ckCatWrap">분류 ${catSelectHtml('ckCat', S.lastChunkCat)}</label></div>
      <label class="fld">내용<textarea id="ckText" rows="4"></textarea></label>
      ${wholePrompt ? '' : '<label class="ck" id="ckRepWrap"><input type="checkbox" id="ckReplace" checked> 프롬프트의 선택 영역을 청크 이름으로 치환</label>'}
      <div class="row"><button class="btn primary" id="ckSave">저장</button><span class="hint" id="ckDup"></span></div>`;
    body.querySelector('#ckText').value = sel;
    let kind = 'chunk';
    const seg = body.querySelector('#ckKind');
    seg.querySelectorAll('button').forEach(b => b.onclick = () => { kind = b.dataset.k; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); body.querySelector('#ckCatWrap').hidden = kind !== 'chunk'; const rw = body.querySelector('#ckRepWrap'); if (rw) rw.hidden = kind === 'char'; body.querySelector('#ckNameLbl').textContent = kind === 'char' ? '캐릭터 이름 (캐릭터 라이브러리에 저장 · 캐릭터 카드의 "라이브러리…"에서 불러옴)' : '이름 (프롬프트에 이 이름을 쓰면 칩으로 표시되고 생성 시 내용으로 치환)'; });
    /* S.lastChunkCat 이 이미 지운 분류면 select 는 그것을 못 고르고 첫 분류를 보여준다 —
       그런데 저장은 화면과 무관하게 lastChunkCat 으로 가서, 지운 분류가 되살아나고
       사용자는 다른 분류에 넣은 줄 알았다. 목록에 없으면 화면에 보이는 것을 쓴다. */
    const catsNow = chunkCats();
    let pickedCat = (S.lastChunkCat && catsNow.includes(S.lastChunkCat)) ? S.lastChunkCat : (catsNow[0] || '기본');
    bindCatSelect(body.querySelector('#ckCat'), v => { pickedCat = v; });
    const nameEl = body.querySelector('#ckName'); setTimeout(() => nameEl.focus(), 50);
    nameEl.oninput = () => { const ex = kind === 'char' ? (S.characters || []).find(c => c.name === nameEl.value.trim()) : S.chunks.find(c => normKey(c.name) === normKey(nameEl.value)); body.querySelector('#ckDup').textContent = ex ? `⚠ "${ex.name}" 이(가) 이미 있어 내용이 덮어써집니다` : ''; };
    body.querySelector('#ckSave').onclick = () => {
      const rawName = nameEl.value.trim(); if (!rawName) { toast('이름을 입력하세요', 'err'); return; }
      const text = body.querySelector('#ckText').value.trim();
      if (kind === 'char') {
        S.characters = S.characters || [];
        const ex = S.characters.find(c => c.name === rawName);
        if (ex) ex.prompt = text; else S.characters.push({ id: uid(), name: rawName, prompt: text, uc: '', createdAt: Date.now() });
        save(); renderChars(); closeModal(); toast('캐릭터 저장: ' + rawName); return;
      }
      const name = rawName.replace(/\s+/g, '_');
      const cat = kind === 'nocat' ? '기본' : (pickedCat || '기본');
      if (kind === 'chunk') { S.lastChunkCat = cat; addChunkCat(cat); }
      const ex = S.chunks.find(c => normKey(c.name) === normKey(name));
      if (ex) { ex.text = text; ex.cat = cat; } else S.chunks.push({ name, text, cat, createdAt: Date.now() });
      const rep = body.querySelector('#ckReplace');
      if (rep && rep.checked) { const a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + name + ta.value.slice(b); ta.dispatchEvent(new Event('input', { bubbles: true })); }
      save(); renderChunkBar(); closeModal(); toast('청크 저장: ' + name);
    };
  });
}
function openChunkManager(focus, onlyCat) {
  openModal('프롬프트 청크 관리', body => {
    body.innerHTML = `<div class="hint">청크 = 자주 쓰는 프롬프트 조각. 칩을 클릭하면 프롬프트에 <b>청크 이름</b>이 색칠된 태그로 들어가고, 생성할 때 내용으로 치환됩니다 (Alt+클릭 = 내용 그대로). 분류 제목의 ✎/🗑 으로 분류 이름 변경·삭제. 프롬프트 아래 칩/분류를 <b>우클릭</b>해도 같은 메뉴가 뜹니다.</div>
      <div class="row"><span class="hint">분류 보기:</span><select id="ckCatFilter" style="width:auto"></select></div>
      <div id="ckRows"></div>
      <div class="row"><button class="btn sm" id="ckAdd">＋ 새 청크</button><button class="btn sm" id="ckAddCat">＋ 새 분류</button><button class="btn sm" id="ckExport">내보내기</button><button class="btn sm" id="ckImport">가져오기</button><button class="btn sm ghost danger" id="ckDelAll" title="NAI «Delete All Prompt Chunks» — 청크와 분류를 모두 지웁니다">🗑 모두 지우기</button><span class="hint">변경은 즉시 저장 · ⠿ 를 끌어 순서와 분류를 바꿉니다</span></div>`;
    const rows = body.querySelector('#ckRows'), filt = body.querySelector('#ckCatFilter');
    let curCat = onlyCat || 'all';
    /* 끌어서 옮기기 (NAI 청크 목록: 청크는 다른 청크 앞이나 분류로, 분류는 다른 분류 자리로) */
    let dragChunk = null, dragCatName = null;
    const moveChunk = (src, before, cat) => {
      if (!src || src === before) return;
      S.chunks.splice(S.chunks.indexOf(src), 1);
      src.cat = cat || '기본';
      if (before) S.chunks.splice(S.chunks.indexOf(before), 0, src); else S.chunks.push(src);
      addChunkCat(src.cat); save(); renderChunkBar(); draw();
    };
    const moveCat = (from, to) => {
      if (!from || !to || from === to) return;
      const cats = chunkCats(), i = cats.indexOf(from), j = cats.indexOf(to);
      if (i < 0 || j < 0) return;
      cats.splice(i, 1); cats.splice(cats.indexOf(to) + (i < j ? 1 : 0), 0, from);
      S.chunkCats = cats; save(); renderChunkBar(); draw();
    };
    const draw = () => {
      const cats = chunkCats();
      filt.innerHTML = '<option value="all">전체</option>' + cats.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
      filt.value = cats.includes(curCat) ? curCat : 'all'; curCat = filt.value;
      rows.innerHTML = '';
      const shown = cats.filter(k => curCat === 'all' || k === curCat);
      for (const cat of shown) {
        const head = document.createElement('div'); head.className = 'ck-cat';
        head.innerHTML = `<span class="ck-drag" draggable="true" title="끌어서 분류 순서 바꾸기">⠿</span><input type="color" class="ck-ccol" title="분류 색 — 색을 따로 정하지 않은 청크가 이 색을 씁니다"><b></b><span class="hint"></span><span style="flex:1"></span><button class="btn xs" data-a="ren">✎ 이름 변경</button><button class="btn xs ghost danger" data-a="del">🗑 분류 삭제</button>`;
        head.querySelector('b').textContent = cat;
        { const cc = head.querySelector('.ck-ccol'); cc.value = catColor(cat);
          cc.onchange = () => { S.chunkCatColors = S.chunkCatColors || {}; S.chunkCatColors[cat] = cc.value; save(); renderChunkBar(); draw(); }; }
        { const hd = head.querySelector('.ck-drag');
          hd.addEventListener('dragstart', e => { dragCatName = cat; dragChunk = null; try { e.dataTransfer.setData('text/plain', cat); e.dataTransfer.effectAllowed = 'move'; } catch (er) { logErr('분류 끌기 시작 실패: ' + er.message); } });
          head.addEventListener('dragover', e => { if (dragCatName || dragChunk) { e.preventDefault(); head.classList.add('drop'); } });
          head.addEventListener('dragleave', () => head.classList.remove('drop'));
          head.addEventListener('drop', e => { head.classList.remove('drop'); e.preventDefault();
            if (dragChunk) { const c = dragChunk; dragChunk = null; moveChunk(c, null, cat); }
            else if (dragCatName) { const f = dragCatName; dragCatName = null; moveCat(f, cat); } }); }
        head.querySelector('.hint').textContent = S.chunks.filter(c => (c.cat || '기본') === cat).length + '개';
        head.querySelector('[data-a="ren"]').onclick = () => renameCat(cat);
        head.querySelector('[data-a="del"]').onclick = () => {
          const n = S.chunks.filter(c => (c.cat || '기본') === cat).length;
          openModal('분류 삭제: ' + cat, b2 => {
            b2.innerHTML = `<div>"${esc(cat)}" 분류에 청크 ${n}개가 있습니다.</div>`;
            const r = document.createElement('div'); r.className = 'row';
            const b1 = document.createElement('button'); b1.className = 'btn sm'; b1.textContent = '청크는 "기본"으로 옮기고 분류만 삭제';
            b1.onclick = () => { tomb('cat', cat); S.chunks.forEach(c => { if ((c.cat || '기본') === cat) c.cat = '기본'; }); S.chunkCats = (S.chunkCats || []).filter(k => k !== cat); save(); renderChunkBar(); openChunkManager(); };
            const bd = document.createElement('button'); bd.className = 'btn sm danger'; bd.textContent = '청크까지 모두 삭제';
            bd.onclick = () => { S.chunks.forEach(c => { if ((c.cat || '기본') === cat) tomb('chunk', c.name); }); tomb('cat', cat); S.chunks = S.chunks.filter(c => (c.cat || '기본') !== cat); S.chunkCats = (S.chunkCats || []).filter(k => k !== cat); save(); renderChunkBar(); openChunkManager(); };
            r.appendChild(b1); r.appendChild(bd); b2.appendChild(r);
          });
        };
        rows.appendChild(head);
        let anyRow = false;
        S.chunks.forEach((c, i) => {
          if ((c.cat || '기본') !== cat) return;
          anyRow = true;
          const d = document.createElement('div'); d.className = 'chunk-row';
          d.innerHTML = `<span class="ck-drag" draggable="true" title="끌어서 순서·분류 바꾸기">⠿</span><input type="text" placeholder="이름"><textarea rows="1" placeholder="내용" class="ac"></textarea><input type="color" class="ck-col" title="청크 색 — 분류 색과 같게 두면 분류 색을 따릅니다">${catSelectHtml('ckc_' + i, c.cat)}<button class="ic" title="삭제">✕</button>`;
          const [n, t] = [d.children[1], d.children[2]];
          n.value = c.name; t.value = c.text;
          { const col = d.querySelector('.ck-col'); col.value = chunkColor(c);
            col.onchange = () => { if (col.value.toLowerCase() === String(catColor(c.cat)).toLowerCase()) delete c.color; else c.color = col.value; save(); renderChunkBar(); }; }
          { const hd = d.querySelector('.ck-drag');
            hd.addEventListener('dragstart', e => { dragChunk = c; dragCatName = null; try { e.dataTransfer.setData('text/plain', c.name); e.dataTransfer.effectAllowed = 'move'; } catch (er) { logErr('청크 끌기 시작 실패: ' + er.message); } });
            d.addEventListener('dragover', e => { if (dragChunk) { e.preventDefault(); d.classList.add('drop'); } });
            d.addEventListener('dragleave', () => d.classList.remove('drop'));
            d.addEventListener('drop', e => { d.classList.remove('drop'); if (!dragChunk) return; e.preventDefault(); const s = dragChunk; dragChunk = null; moveChunk(s, c, c.cat); }); }
          n.onchange = () => { const nv = n.value.trim().replace(/\s+/g, '_'); const dup = S.chunks.find(x => x !== c && normKey(x.name) === normKey(nv)); if (dup) { toast('같은 이름의 청크가 이미 있습니다: ' + dup.name, 'err'); n.value = c.name; return; } const oldName = c.name; c.name = nv; if (oldName && normKey(oldName) !== normKey(nv)) tomb('chunk', oldName); untomb('chunk', nv); save(); renderChunkBar(); };
          /* 칩 띠를 글자마다 다시 그리면 안 된다 — 청크 77개를 매번 새로 만드는데,
             그때 화면엔 77행짜리 이 창이 떠 있어서 배치 계산이 통째로 다시 돈다.
             실측 글자당 42ms(최대 396ms). 편집 중에 칩 띠가 실시간으로 맞을 이유는 없다. */
          let barT = null;
          t.oninput = () => {
            c.text = t.value; save();
            clearTimeout(barT);
            barT = setTimeout(() => { renderChunkBar(); drawMode(); }, 200);
          };
          /* 여러 줄일 때만: 자동 판별 결과를 보여 주고, 틀렸으면 사람이 뒤집을 수 있게 한다.
             자동 판별은 쉼표 이어쓰기 신호를 보는 것이라 대개 맞지만 절대적이지는 않다. */
          const mode = document.createElement('div');
          mode.className = 'hint'; mode.style.cssText = 'grid-column:1/-1;padding:2px 0 6px';
          d.appendChild(mode);
          const drawMode = () => {
            const nl = typeof chunkLines === 'function' ? chunkLines(c).length : 1;
            if (nl < 2) { mode.textContent = ''; return; }
            const isFrag = chunkIsFrag(c);
            const auto = typeof c.frag !== 'boolean';
            mode.innerHTML = nl + '줄 · 지금 <b>' + (isFrag ? '후보 목록 (한 줄만 뽑힘)' : '한 덩어리 (전부 들어감)')
              + '</b>' + (auto ? ' <span class="hint">(자동 판별)</span>' : '') + ' ';
            const btn = document.createElement('button');
            btn.className = 'btn sm'; btn.textContent = isFrag ? '한 덩어리로 바꾸기' : '후보 목록으로 바꾸기';
            btn.onclick = () => { c.frag = !isFrag; save(); renderChunkBar(); drawMode(); };
            mode.appendChild(btn);
            if (!auto) {
              const r = document.createElement('button');
              r.className = 'btn sm'; r.textContent = '자동으로';
              r.onclick = () => { delete c.frag; save(); renderChunkBar(); drawMode(); };
              mode.appendChild(r);
            }
          };
          drawMode();
          bindCatSelect(d.querySelector('#ckc_' + i), v => { c.cat = v; save(); renderChunkBar(); draw(); });
          /* '그린 시점의 인덱스' 로 지우면 안 된다 — 창이 열려 있는 동안 밖에서 청크가 늘거나 줄면
             엉뚱한 청크가 지워진다. 항목 자체를 찾아서 지운다. */
          d.querySelector('button.ic').onclick = () => { tomb('chunk', c.name); const k = S.chunks.indexOf(c); if (k >= 0) S.chunks.splice(k, 1); save(); renderChunkBar(); draw(); };
          rows.appendChild(d);
          if (focus && focus === c) setTimeout(() => t.focus(), 30);
        });
        if (!anyRow) { const e = document.createElement('div'); e.className = 'hint'; e.style.padding = '2px 8px 6px'; e.textContent = '이 분류에 청크가 없습니다'; rows.appendChild(e); }
      }
      if (!S.chunks.length && !cats.length) rows.innerHTML = '<div class="hint">아직 청크가 없습니다. 프롬프트에서 텍스트를 선택하고 "＋청크로 저장"을 누르세요.</div>';
    };
    filt.onchange = () => { curCat = filt.value; draw(); };
    draw();
    body.querySelector('#ckAdd').onclick = () => { const cat = curCat === 'all' ? '기본' : curCat; let n = 1; while (S.chunks.some(c => normKey(c.name) === normKey('청크' + n))) n++; S.chunks.push({ name: '청크' + n, text: '', cat, createdAt: Date.now() }); addChunkCat(cat); save(); draw(); renderChunkBar(); };
    body.querySelector('#ckAddCat').onclick = () => { const v = prompt('새 분류 이름'); const n = addChunkCat(v); if (!n) return; curCat = n; draw(); renderChunkBar(); };
    // NAI «Delete All Prompt Chunks»: 청크와 분류를 모두 지운다(지운 기록을 남겨 다른 창·서버와 합칠 때 되살아나지 않게)
    body.querySelector('#ckDelAll').onclick = () => {
      if (!S.chunks.length && !(S.chunkCats || []).length) { toast('지울 청크가 없습니다'); return; }
      if (!confirm(`프롬프트 청크 ${S.chunks.length}개와 분류를 모두 지울까요? 되돌릴 수 없습니다.`)) return;
      for (const c of S.chunks) tomb('chunk', c.name);
      for (const k of chunkCats()) if (k !== '기본') tomb('cat', k);
      S.chunks = []; S.chunkCats = []; S.chunkCatColors = {};
      save(); renderChunkBar(); draw(); toast('프롬프트 청크를 모두 지웠습니다');
    };
    body.querySelector('#ckExport').onclick = () => downloadBlob(new Blob([JSON.stringify(S.chunks, null, 2)], { type: 'application/json' }), 'nai-chunks.json');
    body.querySelector('#ckImport').onclick = () => pickFiles(false, async f => {
      // 이름 비교는 프롬프트에서 청크를 찾을 때와 같은 기준이어야 한다 (대소문자·밑줄 무시).
      // 그냥 === 로 보면 "MyChunk" 와 "mychunk" 가 둘 다 들어가고, 실제로는 하나만 쓰인다.
      try { const arr = JSON.parse(await f.text()); if (!Array.isArray(arr)) throw 0;
        for (const c of arr) if (c.name) {
          const ex = S.chunks.find(x => normKey(x.name) === normKey(c.name));
          /* frag(사용자가 직접 정한 '한 덩어리/후보 목록')를 반드시 같이 옮긴다.
             예전엔 name·text·cat·createdAt 만 담아서, 내보냈다 다시 가져오면 자동 판별로 돌아가
             같은 청크가 반대로 동작했다(전부 들어가야 할 것이 한 줄만 나가거나 그 반대). */
          const rec = { name: c.name, text: c.text || '', cat: c.cat || '기본' };
          if (typeof c.frag === 'boolean') rec.frag = c.frag;
          /* createdAt 은 되돌리지 않는다 — 삭제 기록(톰스톤)보다 오래된 시각이 되면
             다음 동기화에서 '지운 것' 으로 걸려 방금 가져온 청크가 조용히 사라진다. */
          if (ex) { const born = ex.createdAt; Object.assign(ex, rec); ex.createdAt = Math.max(born || 0, c.createdAt || 0, Date.now()); if (typeof c.frag !== 'boolean') delete ex.frag; }
          else S.chunks.push({ ...rec, createdAt: c.createdAt || Date.now() });
          addChunkCat(rec.cat);
        } save(); draw(); renderChunkBar(); toast('청크 ' + arr.length + '개 가져옴'); }
      catch (e) { toast('청크 파일이 아닙니다', 'err'); }
    }, '.json');
  }, true);
}

/* ─────────────── YouTube (플로팅 플레이어) ─────────────── */
const YT = { cur: null, playing: false, min: false };
let ytLastResults = [];
function parseYt(u) {
  try {
    if (!/^https?:/i.test(u)) { if (!/youtu\.?be/.test(u)) return null; u = 'https://' + u; }
    const url = new URL(u);
    if (url.hostname.includes('youtu.be')) return { id: url.pathname.slice(1).split('/')[0], list: url.searchParams.get('list') };
    if (!url.hostname.includes('youtube.com')) return null;
    if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) return { id: url.pathname.split('/')[2] };
    return { id: url.searchParams.get('v'), list: url.searchParams.get('list') };
  } catch (e) { return null; }
}
function ytOpen(show) { const f = $('#ytFloat'); f.hidden = !show; S.ytOpen = !!show; save(); if (show) { YT.min = false; f.classList.remove('min'); ytApplyPos(); } }
function ytApplyPos() {
  const f = $('#ytFloat');
  f.classList.toggle('compact', S.ytSize === 'compact');
  ytApplyDim();
  if (!S.ytPos) return;
  /* 저장된 위치가 창 밖이면 창 안으로 끌어온다.
     예전에는 화면에 120px 만 남기고 잘랐다 — 380px 패널의 260px 이 화면 밖으로 나가,
     오른쪽 끝에 있는 탭(검색결과·대기열·내 목록·최근)이 통째로 안 보였다.
     창을 줄이거나 배율을 바꿔도 같은 일이 생기므로 resize 때도 다시 잡아준다. */
  const w = f.offsetWidth || (S.ytSize === 'compact' ? 300 : 380);
  const h = f.offsetHeight || 200;
  f.style.left = Math.max(4, Math.min(innerWidth - w - 4, S.ytPos.x)) + 'px';
  f.style.top = Math.max(4, Math.min(innerHeight - h - 4, S.ytPos.y)) + 'px';
  f.style.right = 'auto'; f.style.bottom = 'auto';
}
/* 직접 정한 크기를 적용한다. 화면보다 크면 화면에 맞춰 줄인다 —
   큰 모니터에서 크게 해두고 노트북에서 열면 창 밖으로 나가 손잡이를 못 잡는다. */
function ytApplyDim() {
  const f = $('#ytFloat');
  const d = S.ytDim;
  if (!d || !d.w || !d.h) { f.classList.remove('sized'); f.style.width = ''; f.style.height = ''; return; }
  f.classList.add('sized');
  const w = Math.max(240, Math.min(d.w, innerWidth - 16));
  const h = Math.max(120, Math.min(d.h, innerHeight - 16));
  f.style.width = w + 'px';
  f.style.height = h + 'px';
  // 저장된 자리가 새 크기로는 화면 밖이면 안으로 끌어온다
  const r = f.getBoundingClientRect();
  if (r.right > innerWidth - 4 || r.bottom > innerHeight - 4) {
    f.style.right = 'auto'; f.style.bottom = 'auto';
    f.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    f.style.top = Math.max(8, Math.min(r.top, innerHeight - h - 8)) + 'px';
  }
}
addEventListener('resize', () => { const f = $('#ytFloat'); if (!S || !f || f.hidden) return; ytApplyDim(); if (S.ytPos) ytApplyPos(); });
function ytPopupUrl(item) {
  if (item.list && !item.id) return `https://www.youtube.com/playlist?list=${item.list}`;
  return `https://www.youtube.com/watch?v=${item.id}${item.list ? '&list=' + item.list : ''}`;
}
/* 예약해 둔 자동 넘김도 반드시 같이 끈다 — 안 끄면 🡕 유튜브 탭으로 넘어간 뒤
   타이머가 터져 앱이 혼자 다음 곡을 틀어, 두 곳에서 음악이 동시에 난다. */
function ytStopLocal() { clearTimeout(YT._skipT); try { ytCmd('pauseVideo'); } catch (e) {} agcDetach(); if (typeof ytDestroyHls === 'function') ytDestroyHls(); const w = $('#ytPlayerWrap'); if (w) w.innerHTML = ''; ytPlayDirect._v = null; YT.direct = false; YT.playing = false; ytSetPlayIcon(false); }
function ytPopup(item) { // 유튜브 창(로그인 계정)으로 재생 — Premium이면 광고 없음. 창은 하나만 재사용, 대기열은 재생목록으로 함께 전달
  ytStopLocal();   // 내장 플레이어 정리 (두 곡 동시 재생 방지)
  let url = ytPopupUrl(item);
  /* 넘기는 순서도 ytNext 와 같아야 한다 — 예전엔 배열 순서 그대로 넘겨서,
     앱 안에서는 내 곡이 먼저 나오는데 탭/팝업에서는 알고리즘 곡부터 나왔다.
     넘긴 곡은 유튜브 창이 이어서 재생하므로 앱 대기열에서 뺀다. 남겨 두면
     ⏭ 를 눌렀을 때 방금 유튜브에서 들은 곡이 0초부터 다시 나온다. */
  const hand = ytOrder(S.ytQueue).filter(q => q.id).slice(0, 49);
  if (item.id && hand.length) {
    url = 'https://www.youtube.com/watch_videos?video_ids=' + [item.id, ...hand.map(q => q.id)].join(',');
    const keys = new Set(hand.map(ytKey));
    S.ytQueue = S.ytQueue.filter(q => !keys.has(ytKey(q)));
    ytTouch(); save(); renderYtQueue();
    toast(`대기열 ${hand.length}곡을 유튜브 창으로 넘겼습니다 — 유튜브가 이어서 재생하므로 앱 대기열에서는 뺐습니다`);
  }
  ytRemember(item);
  const asTab = S.ytPopMode === 'tab';
  if (YT.popWin && !YT.popWin.closed && YT.popIsTab === asTab) {
    try { YT.popWin.location.href = url; } catch (e) { YT.popWin = null; }
  }
  if (!YT.popWin || YT.popWin.closed || YT.popIsTab !== asTab) {
    YT.popWin = asTab ? window.open(url, 'nst_yt_tab')
      : window.open(url, 'nst_yt', 'popup=yes,width=480,height=380,left=' + Math.max(0, screen.width - 520) + ',top=' + Math.max(0, screen.height - 480));
    YT.popIsTab = asTab;
    if (!YT.popWin) { toast('팝업/새 창이 차단되었습니다 — 주소창의 차단 아이콘에서 이 사이트를 허용해 주세요', 'err'); return; }
  }
  YT.cur = item; YT.pop = true;
  $('#ytNow').hidden = false; $('#ytNowTitle').textContent = '🡕 ' + (item.title || item.id); $('#ytHeadTitle').textContent = item.title || item.id;
  renderYtQueue(); renderYtResults();
}
function openYtAccountGuide() {
  const ff = /Firefox/i.test(navigator.userAgent);
  openModal('🎵 내 유튜브 계정으로 듣기 (광고 없이, 팝업 없이)', body => {
    body.innerHTML = `
      <div class="hint">내장 플레이어는 유튜브를 "제3자"로 불러오기 때문에, 브라우저가 기본적으로 유튜브 로그인 쿠키를 막습니다. 아래처럼 <b>이 사이트에만</b> 예외를 주면 내장 플레이어가 내 계정(Premium)으로 재생되어 광고 없이, 팝업 없이 들을 수 있습니다. 한 번만 하면 됩니다.</div>
      ${ff ? `<div class="mtitle">가장 확실한 방법 — Edge/Chrome 앱 모드로 실행 (친구분 방식)</div>
      <div class="hint">Firefox는 임베드에 유튜브 로그인 쿠키를 잘 안 넘겨주지만, <b>Chrome·Edge는 기본으로 넘겨줍니다.</b> 폴더의 <b>start-edge.bat</b>(또는 start-chrome.bat)으로 실행하면 주소창 없는 앱 창으로 열리고, Edge/Chrome에서 유튜브에 로그인돼 있으면 내장 플레이어가 그 계정(Premium)으로 재생됩니다 — 광고·팝업 없이 앱 안에서. 히스토리는 브라우저별로 따로이니 처음엔 비어 보입니다(설정·청크는 서버에서 자동 복원).</div>` : ''}
      <div class="mtitle">${ff ? 'Firefox에서 그대로 쓰려면' : 'Chrome / Edge'}</div>
      ${ff ? `<ol class="guide">
        <li>주소창 왼쪽의 <b>🛡 방패 아이콘</b> 클릭</li>
        <li><b>"이 사이트에서 향상된 추적 방지 기능 끄기"</b> 스위치를 끔 (${esc(location.host)} 에만 적용)</li>
        <li>페이지가 새로고침되면 🎵 에서 아무 곡이나 재생 → 유튜브 플레이어 우하단 톱니/프로필이 내 계정으로 뜨면 성공</li>
        <li>안 되면: 설정 → 개인정보 및 보안 → "쿠키 및 사이트 데이터 → 예외 관리"에 <b>https://www.youtube.com</b> 허용 추가</li></ol>`
      : `<ol class="guide">
        <li>주소창 오른쪽 <b>👁/쿠키 아이콘</b> 클릭 → "서드파티 쿠키 허용" (이 사이트)</li>
        <li>또는 설정 → 개인정보 및 보안 → 서드파티 쿠키 → "서드파티 쿠키 사용이 허용된 사이트"에 <b>${esc(location.origin)}</b> 추가</li>
        <li>새로고침 후 🎵 에서 재생</li></ol>`}
      <div class="mtitle">재생 방식</div>
      <div class="hint"><b>직접 재생(추천)</b>: 서버가 영상 스트림을 직접 받아 앱 안 플레이어로 재생 — <b>임베드가 막힌 영상 포함 모든 영상, 광고 없음, 로그인 불필요</b>. 처음 한 번 엔진(yt-dlp) 설치가 필요합니다. 화질은 360p(음악 감상용) 또는 🎧 오디오만(고음질).<br>
      <b>임베드</b>: 유튜브 공식 플레이어. 일부 영상 재생 불가, 광고는 브라우저 로그인 상태에 따름.<br><b>탭/팝업</b>: 유튜브 페이지에서 내 계정으로 재생.</div>
      <div class="seg" id="gdMode" style="max-width:520px">
        <button data-m="direct">⚡ 직접 재생</button><button data-m="embed">임베드</button><button data-m="tab">탭</button><button data-m="popup">팝업</button>
      </div>
      <div class="hint">· <b>탭</b>: 유튜브 탭이 하나 열리고 앱 탭으로 돌아와도 소리는 계속 납니다. 탭을 옮겨다니기 싫으면 유튜브 영상 위에 마우스 → 브라우저 <b>PiP(화면 속 화면)</b> 버튼 → 작은 영상 창이 어떤 화면 위에도 떠 있습니다.<br>· <b>팝업</b>: 별도 작은 창. 위와 같이 PiP 가능.</div>
      <div class="mtitle">YouTube 계정 연결 (내 재생목록·좋아요 불러오기)</div>
      <div class="hint">🎵 창 <b>👤 내 목록</b> 탭에서 내 재생목록/좋아요를 불러와 재생·대기열에 넣을 수 있습니다 (Google 로그인, OAuth). <button class="btn xs" id="gdYtSetup">계정 연결 설정 열기</button></div>`;
    body.querySelector('#gdYtSetup').onclick = openYtAccountSetup;
    const seg = body.querySelector('#gdMode');
    const paint = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === ytMode()));
    paint();
    seg.querySelectorAll('button').forEach(b => b.onclick = async () => { const m = b.dataset.m; if (m === 'direct') { const ok = await ytEngineEnsure(true); if (!ok) return; } setYtMode(m); paint(); toast('재생 방식: ' + b.textContent); });
  });
}
function ytMode() { // direct(직접 재생) | embed | tab | popup
  if (S.ytMode) return S.ytMode;
  if (S.ytUsePop) return S.ytPopMode === 'popup' ? 'popup' : 'tab';
  return (R.srvInfo && R.srvInfo.ytEngine) ? 'direct' : 'embed';
}
function setYtMode(m) { S.ytMode = m; S.ytUsePop = (m === 'tab' || m === 'popup'); if (S.ytUsePop) S.ytPopMode = m; save(); const c = $('#ytUsePop'); if (c) c.checked = S.ytUsePop; const dl = $('#ytModeLbl'); if (dl) dl.textContent = ({ direct: '직접', embed: '임베드', tab: '탭', popup: '팝업' })[m]; }
async function ytEngineEnsure(interactive) {
  /* 예전엔 아래 catch 가 모든 오류를 삼켜서, 서버가 꺼져 있으면 '⚡ 직접 재생' 을 눌러도
     아무 반응이 없었다 (호출부는 false 면 조용히 끝낸다). 이유를 알려주고 끝낸다. */
  try {
    const r = await apiFetch('/yt/engine');
    if (r.status === 404) { toast('서버가 예전 버전입니다 — 검은 창을 닫고 start.bat을 다시 실행한 뒤 새로고침하세요', 'err'); return false; }
    const j = await r.json();
    if (j.installed) { if (R.srvInfo) R.srvInfo.ytEngine = true; return true; }
  } catch (e) {
    // 서버가 꺼져 있거나 포트가 바뀐 경우가 대부분이다 — 이유를 말해주지 않으면
    // 사용자는 버튼이 고장 난 줄 안다
    if (interactive) toast('재생 엔진을 확인하지 못했습니다: ' + e.message, 'err');
    return false;
  }
  if (!interactive) return false;
  return new Promise(resolve => {
    let settled = false; const done = v => { if (!settled) { settled = true; resolve(v); } };
    openModal('직접 재생 엔진 설치', body => {
      body.innerHTML = `<div class="hint">임베드가 막힌 영상까지 <b>모든 유튜브 영상을 앱 안에서 광고 없이</b> 재생하려면 오픈소스 추출기 <b>yt-dlp</b>가 필요합니다. 앱 폴더의 <code>vendor/</code> 안에만 설치되며(약 20MB, 1분) 다른 프로그램엔 영향이 없습니다. 인터넷 연결이 필요합니다.</div>
        <div class="row"><button class="btn primary" id="egGo">설치하기</button><button class="btn sm" id="egNo">나중에</button><span class="hint" id="egSt"></span></div>`;
      body.querySelector('#egNo').onclick = () => { closeModal(); done(false); };
      body.querySelector('#egGo').onclick = async () => {
        const st = body.querySelector('#egSt'); st.textContent = '설치 중… (최대 1~2분)'; body.querySelector('#egGo').disabled = true;
        try {
          const r = await apiFetch('/yt/engine', { method: 'POST' });
          if (r.status === 404) { st.textContent = '✖ 서버가 예전 버전입니다 — 검은 창을 닫고 start.bat을 다시 실행하세요'; return; }
          const j = await r.json();
          if (j.installed) { if (R.srvInfo) R.srvInfo.ytEngine = true; st.textContent = '✔ 설치됨 ' + (j.version || ''); toast('직접 재생 엔진 설치 완료'); setTimeout(() => { done(true); closeModal(); }, 600); }
          else { st.textContent = '✖ 실패: ' + ((j.log || j.message || '알 수 없는 오류').slice(-300)); body.querySelector('#egGo').disabled = false; }
        } catch (e) { st.textContent = '✖ ' + e.message; body.querySelector('#egGo').disabled = false; }
      };
    }, false, () => done(false));   // ✕/Esc 로 닫아도 반드시 resolve (재생이 영구 멈추던 문제)
  });
}
/* 자동 음량 맞춤 (라우드니스 노멀라이저): 유튜브 플레이어처럼 곡마다 음량을 비슷하게. Web Audio로 RMS를 재서 목표 레벨로 게인을 천천히 조절 */
const AGC = { ctx: null, src: null, gain: null, an: null, el: null, timer: null, target: 0.2, comp: null, user: null };
// 체인: 미디어 → gain(자동 보정) → 컴프레서 → 분석기(측정) → user(볼륨 슬라이더) → 스피커.  요소 볼륨은 1로 고정해 측정이 슬라이더와 무관하게.
function agcAttach(v) {
  if (!S.ytNormalize) return; // 기본 꺼짐 — 켰을 때만 자동 보정. 꺼져 있으면 설정한 볼륨을 그대로 유지
  try {
    if (!AGC.ctx) {
      AGC.ctx = new (window.AudioContext || window.webkitAudioContext)();
      AGC.gain = AGC.ctx.createGain(); AGC.comp = AGC.ctx.createDynamicsCompressor(); AGC.comp.threshold.value = -10; AGC.comp.knee.value = 12; AGC.comp.ratio.value = 3; AGC.comp.attack.value = 0.01; AGC.comp.release.value = 0.25;
      AGC.an = AGC.ctx.createAnalyser(); AGC.an.fftSize = 2048; AGC.user = AGC.ctx.createGain();
      AGC.gain.connect(AGC.comp); AGC.comp.connect(AGC.an); AGC.an.connect(AGC.user); AGC.user.connect(AGC.ctx.destination);
    }
    if (AGC.el === v) return;
    if (AGC.src) { try { AGC.src.disconnect(); } catch (e) {} }
    AGC.src = AGC.ctx.createMediaElementSource(v); AGC.src.connect(AGC.gain); AGC.el = v;
    AGC.gain.gain.value = AGC.lastGain || 1;
    AGC.user.gain.value = (S.ytVol == null ? 60 : S.ytVol) / 100; v.volume = 1;
    if (AGC.ctx.state === 'suspended') AGC.ctx.resume().catch(() => {});
    clearInterval(AGC.timer);
    const buf = new Float32Array(AGC.an.fftSize); let hist = [];
    AGC.timer = setInterval(() => {
      if (!AGC.el || AGC.el.paused || S.ytNormalize === false) return;
      AGC.an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; const rms = Math.sqrt(s / buf.length);
      if (rms < 0.004) return; // 무음 구간은 무시
      hist.push(rms); if (hist.length > 40) hist.shift(); // 최근 4초 평균
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      const g = AGC.gain.gain.value; const want = g * (AGC.target / avg);
      const next = Math.max(0.35, Math.min(2.2, g + (want - g) * 0.06)); // 천천히 따라감 (큰 곡은 내리고 작은 곡은 올림)
      AGC.gain.gain.setTargetAtTime(next, AGC.ctx.currentTime, 0.25); AGC.lastGain = next;
    }, 100);
  } catch (e) { logErr('노멀라이저 실패: ' + e.message); }
}
function agcDetach() { clearInterval(AGC.timer); if (AGC.src) { try { AGC.src.disconnect(); } catch (e) {} } AGC.src = null; AGC.el = null; }
function ytSetVolume(pct) { S.ytVol = pct; const live = (ytPlayDirect._v && ytPlayDirect._v.isConnected) ? ytPlayDirect._v : $('#ytVideo'); if (AGC.el && AGC.user && AGC.el === live) { AGC.user.gain.value = pct / 100; if (AGC.el.volume !== 1) AGC.el.volume = 1; } else { const v = ytPlayDirect._v && ytPlayDirect._v.isConnected ? ytPlayDirect._v : $('#ytVideo'); if (v) { v._progVol = true; v.volume = pct / 100; if (pct > 0 && v.muted) { v.muted = false; S.ytMuted = false; } setTimeout(() => { v._progVol = false; }, 50); } } }
/* 끊겼다 다시 틀 때 "보던 위치"를 잃지 않기 위한 장치.
   예전에는 화질을 바꾸거나 스트림이 한 번 끊기기만 해도 플레이어를 통째로 새로 만들어
   0초부터 다시 시작했다.

   목표 위치는 "실제로 그 지점까지 재생될 때까지" 붙잡고 있어야 한다. 한 번 쓰고 지우면
   복구 시도가 연달아 실패할 때(1080p→720p→480p) 두 번째 시도부터 위치가 0 으로 날아간다. */
function ytLiveVideo() { const v = ytPlayDirect._v; return (v && v.isConnected) ? v : $('#ytVideo'); }
function ytSetResume(item, t) { if (item && item.id && t > 1 && isFinite(t)) YT._resume = { id: item.id, t }; }
function ytWantResume(item) { const r = YT._resume; return (r && item && r.id === item.id) ? r.t : 0; }
function ytKeepPos() {          // 지금 보던 위치를 기억 (같은 곡을 다시 열 때만 쓰인다)
  const v = ytLiveVideo();
  if (v && isFinite(v.currentTime) && v.currentTime > 1) ytSetResume(YT.cur, v.currentTime);
  return ytWantResume(YT.cur);
}
function ytSeekTo(v, t) {       // 메타데이터가 준비된 뒤에 이동 (준비 전엔 무시된다)
  if (!v || !(t > 1)) return;
  const go = () => { try { if (Math.abs(v.currentTime - t) > 1.5) v.currentTime = t; } catch (e) {} };
  if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
}
function ytReplayHere() { const t = ytKeepPos(); if (YT.cur) ytPlayDirect(YT.cur); return t; }

function ytBindVideoEvents(v, item, cands, getCi, tryNext, load, diag) {
  // 플레이어 안 기본 컨트롤로 볼륨/음소거를 바꿔도 앱 설정과 슬라이더에 반영 → 다음 곡에도 그대로 유지
  v.onvolumechange = () => {
    if (v._progVol) return;
    if (!(AGC.el === v)) { const pct = Math.round(v.volume * 100); if (S.ytVol !== pct) { S.ytVol = pct; const sl = $('#ytVol'); if (sl) sl.value = pct; save(); } }
    if (S.ytMuted !== v.muted) { S.ytMuted = v.muted; save(); }
  };
  v.muted = !!S.ytMuted;
  v.onerror = () => {
    if (YT.cur !== item || !v.isConnected || !v.getAttribute('src')) return;   // 요소가 교체되면 isConnected 로 걸러진다
    if (YT._hls) return;                       // HLS 재생 중이면 hls.js 가 스스로 복구한다
    // 이미 잘 나오던 중에 난 오류는 "이 소스가 틀렸다"가 아니라 "도중에 끊겼다"는 뜻이다.
    // 다음 후보로 넘기면 0초부터 다시 시작하므로, 같은 소스로 보던 위치에서 이어 붙인다.
    const t = v.currentTime;
    /* 재시도 예산은 <video> 요소가 아니라 '이 곡' 에 붙여야 한다.
       예산을 요소에 두면, 주소를 새로 받으려고 ytPlayDirect 를 부르는 순간
       플레이어가 새로 만들어지면서 예산이 0 으로 돌아간다 → 같은 자리에서
       영원히 "재시도 → 새로 열기" 를 반복하고 다음 후보나 오류 패널로 못 간다.
       예산은 지난 오류 이후 20초 넘게 실제로 진행했을 때만 회복시킨다. */
    const rt = (YT._retry && YT._retry.id === item.id) ? YT._retry : (YT._retry = { id: item.id, n: 0, lastT: null });
    if (rt.lastT == null || t - rt.lastT > 20) rt.n = 0;
    rt.lastT = t;
    if (t > 1 && ++rt.n <= 3) {
      diag.push(`재생 중 끊김 ${t.toFixed(0)}s — 이어서 재시도 ${rt.n}/3`);
      ytSetResume(item, t);
      load.hidden = false; load.textContent = `⏳ 끊긴 지점(${fmtDur(t)})부터 이어서…`;
      /* 첫 번째는 같은 주소로 싸게 재시도한다(순간적인 끊김).
         그래도 또 끊기면 주소가 만료된 것이다. 같은 주소로 계속 매달리면 서버가 매번
         새로 추출해 다른 포맷을 이어붙이게 되고, 브라우저는 Format error 로 죽는다.
         → 스트림 주소부터 새로 받아 처음부터 다시 연다(위치는 위에서 기억해 뒀다). */
      if (rt.n === 1) { const src = v.src; v.src = src; v.load(); ytSeekTo(v, t); v.play().catch(() => {}); }
      else { diag.push('주소를 새로 받아 다시 엽니다'); ytPlayDirect(item); }
      return;
    }
    const ci = getCi(); diag.push(`${cands[ci - 1] ? cands[ci - 1][0] : '?'}: 재생 오류 코드 ${v.error ? v.error.code : '?'}`); tryNext();
  };
  v.onplaying = () => { load.hidden = true; YT.playing = true; YT._audioRetry = false; YT._failRun = 0; YT._goneRun = 0; clearTimeout(YT._skipT); if (YT._retry && YT._retry.id !== item.id) YT._retry = null; if (YT._resume && YT._resume.id === item.id && v.currentTime >= YT._resume.t - 3) YT._resume = null; ytSetPlayIcon(true); if (S.ytNormalize && v.crossOrigin === 'anonymous') agcAttach(v); else if (!AGC.el || AGC.el !== v) { const want = (S.ytVol == null ? 60 : S.ytVol) / 100; if (Math.abs(v.volume - want) > 0.005) { v._progVol = true; v.volume = want; setTimeout(() => { v._progVol = false; }, 50); } } };
  v.onpause = () => { YT.playing = false; ytSetPlayIcon(false); };
  v.onended = () => { YT.playing = false; ytSetPlayIcon(false); if (S.ytQueue.length || S.ytAutoRelated !== false) ytNext(); };
}
function fmtDur(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function ytPlayDirectMode(item, mode) { YT._forceMode = mode; const p = ytPlayDirect(item); YT._forceMode = null; return p; }
async function ytPlayDirect(item) {
  // 이어보기: 같은 곡을 다시 여는 경우(화질 변경·오디오 전환·오류 복구)에만 위치를 물려받는다.
  // 목록에서 곡을 새로 고른 경우에는 0초부터 — 그래서 자동이 아니라 호출한 쪽이 명시한다.
  if (!YT.cur || YT.cur.id !== item.id) { YT._resume = null; YT._qualCap = 0; YT._noHls = null; }
  const resumeAt = ytWantResume(item);
  /* 재진입 무효화 토큰. 예전에는 `YT.cur !== item` 으로만 걸렀는데, 화질 변경·오디오 전환은
     같은 item 객체를 그대로 다시 넘기므로 그 검사를 통과한다. 그러면 앞서 진행 중이던
     호출이 끝까지 살아남아 나중에 tryNext() 를 돌리고 ytPlayDirect._v 를 덮어써서,
     플레이어가 둘로 갈라지거나 방금 만든 요소가 엉뚱한 소스로 바뀐다. */
  const gen = (YT._gen = (YT._gen || 0) + 1);
  const stale = () => YT._gen !== gen;
  // 앞 곡의 hls.js 인스턴스를 반드시 여기서 정리한다. 남겨두면 HLS 를 안 쓰는 곡에서도
  // YT._hls 가 참인 채라 onerror 의 "HLS 는 hls.js 가 알아서 복구" 분기에 걸려
  // 재생이 끊겨도 아무 복구가 안 된다.
  ytDestroyHls();
  YT.cur = item; YT.pop = false; YT.direct = true; YT.directUrl = null; ytRemember(item);
  const wrap = $('#ytPlayerWrap');
  wrap.innerHTML = `<div class="ytv"><video id="ytVideo" controls autoplay playsinline preload="auto"${item.thumb ? ` poster="${esc(item.thumb)}"` : ''}></video>
    <div id="ytLoading" class="yt-loading">⏳ 스트림 준비 중…</div><div id="ytErr" class="yt-err" hidden></div></div>`;
  $('#ytNow').hidden = false; $('#ytNowTitle').textContent = item.title || item.id; $('#ytHeadTitle').textContent = item.title || item.id;
  renderYtQueue(); renderYtResults();
  const v = $('#ytVideo'); v.volume = (S.ytVol == null ? 60 : S.ytVol) / 100;
  const load = $('#ytLoading');
  try {
    const useMode = YT._forceMode ? YT._forceMode : (S.ytAudioOnly ? 'audio' : 'video'); YT._forceModeUsed = useMode;
    const r = await apiFetch('/yt/stream?id=' + encodeURIComponent(item.id) + '&mode=' + useMode);
    if (r.status === 404) {
      /* 지워졌거나 비공개인 영상. 몇 번을 해도 안 되므로 오류 패널을 띄우지 않고 바로 넘긴다.
         (예전에는 502 로 와서 "서버 오류" 취급을 받고, 다른 클라이언트로 계속 다시 시도했다) */
      const j = await r.json().catch(() => ({}));
      if (stale()) return;      // 그 사이 사용자가 다른 곡을 틀었다 — 옛 응답으로 지금 곡을 죽이면 안 된다
      if (j.gone) {
        load.hidden = true;
        YT.directFail = YT.directFail || {}; YT.directFail[item.id] = true;
        logErr('영상 없음 ' + item.id + ' ' + (j.detail || j.message || ''));
        ytAutoSkip('이 영상은 더 이상 볼 수 없습니다', { gone: true });
        return;
      }
    }
    if (r.status === 503) { load.textContent = '엔진 미설치'; const ok = await ytEngineEnsure(true); if (stale()) return; if (ok) return ytPlayDirect(item); setYtMode('embed'); return ytPlay(item, true); }
    if (!r.ok) throw await apiError(r);
    const j = await r.json();
    if (stale()) return;
    YT.directUrl = j.url;
    if (j.title) { $('#ytNowTitle').textContent = j.title; $('#ytHeadTitle').textContent = j.title; item.title = item.title || j.title; }
    if (!item.thumb && j.thumb) v.poster = j.thumb;
    YT.hls = (j.hls || []);
    ytFillQualSelect();
    // 소스 후보: ① 서버 경유(가장 안정적) ② 직접 URL. 각 후보는 재생 전에 미리 검사(Range 0-0)해 상태를 기록 → 실패 원인이 남음.
    // 다 실패하면 오디오만 한 번 더(이번 곡에만), 그래도 안 되면 오류 패널(자동 전환 없음 → 루프 방지)
    const proxyOf = u => R.api + '/yt/media?u=' + b64url(new TextEncoder().encode(u)) + '&id=' + encodeURIComponent(item.id) + '&mode=' + (YT._forceModeUsed || 'video');
    const cands = [['서버 경유', proxyOf(j.url)], ['직접 URL', j.url]];
    const diag = YT._diag = YT._diag || []; if (!YT._audioRetry) diag.length = 0;
    /* 어떤 포맷을 받았는지, 이 브라우저가 읽을 수 있다고 하는지 먼저 적어 둔다.
       "코드 4" 만 보여 주면 왜 안 되는지 알 수가 없다. 코덱 이름이 그대로 답이 되는 경우가 많다
       (예: av01 = AV1, 브라우저·그래픽 드라이버에 따라 못 읽음). */
    const cod = [j.vcodec, j.acodec].filter(x => x && x !== 'none');
    const fmtDesc = [j.ext, cod.join('+') || null, j.height ? j.height + 'p' : null].filter(Boolean).join(' ');
    const mime = (j.ext === 'webm' ? 'video/webm' : 'video/mp4') + (cod.length ? `; codecs="${cod.join(', ')}"` : '');
    let canPlay = '';
    try { canPlay = v.canPlayType(mime) || ''; } catch (e) {}
    YT._fmtDesc = fmtDesc; YT._canPlay = canPlay;
    diag.push(`포맷 ${fmtDesc || '?'}${canPlay ? '' : ' · 이 브라우저가 못 읽는 형식'}`);
    let ci = 0;
    const preflight = async (label, src) => { // 프록시만 검사 (직접 URL은 CORS로 fetch 불가 → 검사 생략)
      if (!src.startsWith(R.api + '/yt/media')) return true;
      try { const r = await fetch(src, { headers: { Range: 'bytes=0-1023' } }); const ct = r.headers.get('content-type') || ''; diag.push(`${label}: HTTP ${r.status} ${ct}`); try { r.body && r.body.cancel(); } catch (e) {} return r.ok && /^(video|audio)\//.test(ct); }
      catch (e) { diag.push(`${label}: 요청 실패 ${e.message}`); return false; }
    };
    const tryNext = async () => {
      if (ci >= cands.length) {
        const wasAudio = (S.ytAudioOnly || YT._forceModeUsed === 'audio');
        if (!YT._audioRetry) { // 한 번은 반대 모드로 재시도: 오디오 실패 → 영상(18, 가장 호환 좋음) / 영상 실패 → 오디오
          YT._audioRetry = true; load.hidden = false; load.textContent = wasAudio ? '⏳ 오디오 스트림 실패 — 영상 포맷(더 호환됨)으로 다시 시도…' : '⏳ 영상 스트림 실패 — 오디오만으로 다시 시도…';
          return ytPlayDirectMode(item, wasAudio ? 'video' : 'audio');
        }
        YT._audioRetry = false; YT.directFail = YT.directFail || {}; YT.directFail[item.id] = true;
        load.hidden = true; const er = $('#ytErr'); er.hidden = false;
        const me = v.error ? `코드 ${v.error.code}${v.error.message ? ' · ' + v.error.message : ''}` : '알 수 없음';
        // 원인을 문장으로 — 코덱을 못 읽는 것과 도중에 끊긴 것은 대처가 다르다
        const why = !YT._canPlay && YT._fmtDesc ? `이 브라우저가 ${YT._fmtDesc} 형식을 못 읽습니다`
          : (v.error && v.error.code === 2) ? '받는 도중 연결이 끊겼습니다 (유튜브 주소 만료·차단)'
          : (v.error && v.error.code === 4) ? '받은 스트림을 브라우저가 읽지 못했습니다'
          : '';
        er.innerHTML = `<div>이 영상은 직접 재생이 안 됩니다 (${esc(me)})</div>${why ? `<div class="hint" style="color:#eee">${esc(why)}</div>` : ''}<div class="hint" style="color:#ccc">${esc(diag.join(' · ') || '진단 정보 없음')}</div><div class="row" style="justify-content:center;margin-top:6px">
          <button class="btn sm primary" id="ytDrRetry">↻ 다시 시도</button><button class="btn sm" id="ytDrEmbed">임베드로 재생</button><button class="btn sm" id="ytDrTab">🡕 유튜브 탭</button>${S.ytQueue.length ? '<button class="btn sm" id="ytDrNext">⏭ 다음 곡</button>' : ''}<button class="btn sm" id="ytDrUpd">엔진 업데이트</button></div>`;
        er.querySelector('#ytDrRetry').onclick = () => { clearTimeout(YT._skipT); YT.directFail[item.id] = false; YT._noHls = null; ytPlayDirect(item); };
        er.querySelector('#ytDrEmbed').onclick = () => {
          // 이 버튼은 이 곡만이 아니라 재생 방식 기본값 자체를 바꾼다 — 말없이 바꾸면 안 된다
          setYtMode('embed'); toast('재생 방식을 임베드로 바꿨습니다 (설정에서 되돌릴 수 있어요)');
          YT._embedTry = 0; YT._embedList = null; ytPlay(item, true);
        };
        er.querySelector('#ytDrTab').onclick = () => ytPopup(item);
        const nb = er.querySelector('#ytDrNext'); if (nb) nb.onclick = ytNext;
        /* 업데이트는 1분 넘게 걸릴 수 있다. 먼저 자동 넘김을 끄지 않으면 그 사이 다음 곡으로
           넘어가 버리고, 끝난 뒤엔 실패했던 옛 곡을 다시 튼다. */
        er.querySelector('#ytDrUpd').onclick = async () => { clearTimeout(YT._skipT); const was = YT.cur; toast('엔진 업데이트 중…'); const r = await apiFetch('/yt/engine', { method: 'POST' }); const jj = await r.json(); toast(jj.installed ? '업데이트 완료 ' + jj.version : '실패'); if (YT.cur !== was) return; YT.directFail[item.id] = false; ytPlayDirect(item); };
        logErr('직접 재생 실패 ' + item.id + ' ' + me + ' | ' + diag.join(' · '));
        ytAutoSkip('이 곡은 재생이 안 됩니다');
        return;
      }
      const [label, src] = cands[ci++];
      load.hidden = false; load.textContent = '⏳ ' + label + ' 검사 중…';
      if (!(await preflight(label, src))) { if (stale()) return; return tryNext(); }
      if (stale()) return;
      load.textContent = '⏳ ' + label + '로 재생 준비…';
      const viaProxy = src.startsWith(R.api + '/yt/media');
      // 노멀라이저는 같은 출처(프록시) 스트림에서만 가능 — 직접 URL(교차 출처)에선 끔. 소스가 바뀌면 오디오 그래프에 물리지 않은 새 요소로 교체
      if (AGC.el === v && !viaProxy) { const nv = v.cloneNode(false); nv.removeAttribute('crossorigin'); v.replaceWith(nv); agcDetach(); ytBindVideoEvents(nv, item, cands, () => ci, tryNext, load, diag); ytPlayDirect._v = nv; }
      const vv = ytPlayDirect._v || v;
      vv._progVol = true; vv.volume = (S.ytVol == null ? 60 : S.ytVol) / 100; vv.muted = !!S.ytMuted; setTimeout(() => { vv._progVol = false; }, 50); // 요소가 바뀌어도 설정한 볼륨 유지
      if (viaProxy && S.ytNormalize) vv.crossOrigin = 'anonymous'; else vv.removeAttribute('crossorigin');
      // resumeAt(진입 시점 상수)이 아니라 최신 목표를 읽어야 한다. 재생 중 끊겨 여기까지 온 경우
      // onerror 가 그 사이 목표를 갱신해 두는데, 낡은 값을 쓰면 대체 후보가 0초부터 시작한다.
      vv.src = src; vv.load(); ytSeekTo(vv, ytWantResume(item) || resumeAt); vv.play().catch(() => { load.textContent = '▶ 를 눌러 재생 (브라우저 자동재생 차단)'; });
    };
    ytPlayDirect._v = v;
    ytBindVideoEvents(v, item, cands, () => ci, tryNext, load, diag);
    // 480p 이상은 유튜브가 HLS 로만 준다 → hls.js 로 재생 (progressive 는 itag 18 = 360p 뿐).
    // 이벤트를 먼저 걸어두는 이유: 예전엔 HLS 성공 즉시 return 해서 onended·볼륨 저장·재생아이콘이
    // 하나도 안 걸렸다. 그래서 HLS(=사실상 모든 영상 재생)에서는 곡이 끝나도 다음 곡으로 안 넘어갔다.
    if (useMode === 'video' && YT.hls.length && YT._noHls !== item.id) {
      let want = S.ytQual && S.ytQual !== 'auto' ? +S.ytQual : Math.max(...YT.hls.map(x => x.h));
      if (YT._qualCap && YT._qualCap < want) want = YT._qualCap;   // 끊겨서 임시로 낮춘 경우
      const pick = YT.hls.find(x => x.h === want) || YT.hls.find(x => x.h <= want) || YT.hls[0];
      if (pick && await ytPlayHls(v, pick, load, item, resumeAt)) return;
    }
    tryNext();
  } catch (e) {
    if (stale()) return;   // 그 사이 다른 곡으로 넘어갔다 — 죽은 요청의 실패로 지금 곡을 덮으면 안 된다
    load.hidden = true; const er = $('#ytErr'); er.hidden = false;
    /* 스트림 주소를 받는 데 실패한 자리다 (서버가 클라이언트 후보를 다 돌고도 못 고른 경우 등).
       예전에는 기록도 안 남고 "다음 곡" 버튼도 없어서, 대기열이 아무 흔적 없이 멈췄다. */
    er.innerHTML = `<div>${esc('스트림을 가져오지 못했습니다: ' + e.message)}</div><div class="row" style="justify-content:center;margin-top:6px"><button class="btn sm" id="ytDrEmbed">임베드로 재생</button>${S.ytQueue.length ? '<button class="btn sm" id="ytDrNext2">⏭ 다음 곡</button>' : ''}<button class="btn sm" id="ytDrUpd">엔진 업데이트</button></div>`;
    /* 되돌릴 때 'direct' 를 박아 두면, 임베드/탭/팝업으로 쓰던 사람의 저장된 재생 방식이
       이 버튼 한 번에 '직접' 으로 바뀐다(이 패널은 모드와 무관하게 뜬다). 원래 값으로 돌린다. */
    er.querySelector('#ytDrEmbed').onclick = () => { clearTimeout(YT._skipT); const prev = S.ytMode; S.ytMode = 'embed'; ytPlay(item, true); S.ytMode = prev; };
    const nb2 = er.querySelector('#ytDrNext2'); if (nb2) nb2.onclick = () => { clearTimeout(YT._skipT); ytNext(); };
    er.querySelector('#ytDrUpd').onclick = async () => { clearTimeout(YT._skipT); toast('엔진 업데이트 중…'); const r = await apiFetch('/yt/engine', { method: 'POST' }); const j = await r.json(); toast(j.updated ? ('업데이트 완료 ' + j.version) : (j.log || '갱신할 수 없습니다'), j.updated ? '' : 'err'); ytPlayDirect(item); };
    logErr('스트림 준비 실패 ' + item.id + ' ' + e.message);
    ytAutoSkip('스트림을 가져오지 못했습니다');
  }
}
/* 대기열 상한. 없으면 재생목록을 부를 때마다 무한히 쌓이고,
   그 전부가 설정(state.json)에 실려 매 저장마다 서버로 오간다. */
const YT_QUEUE_MAX = 500;
async function ytPlayList(item) { // 재생목록 → 서버가 항목을 풀어 대기열로
  toast('재생목록을 불러오는 중…');
  try {
    const r = await apiFetch('/yt/playlist?list=' + encodeURIComponent(item.list)); if (!r.ok) throw await apiError(r);
    const j = await r.json(); const items = j.items || [];
    if (!items.length) { toast('재생목록이 비어 있거나 비공개입니다', 'err'); return; }
    /* 넣는 문은 ytQueueAdd 하나. 예전엔 여기만 따로 중복·상한을 처리했고,
       상한을 넘으면 배열 꼬리(=내가 모아 둔 곡)부터 잘라 냈다. */
    const put = ytQueueAdd(items.slice(1), { front: true });   // 이 블록엔 이미 r(응답)이 있다
    save(); renderYtQueue();
    /* 목록을 받아오는 동안 사용자가 다른 곡을 틀었으면 그 곡을 빼앗지 않는다 — 대기열만 채운다. */
    if (YT.cur && ytKey(YT.cur) !== ytKey(item) && YT.playing) { toast('대기열에만 넣었습니다 (지금 곡은 그대로)'); return; }
    toast(ytAddNote(put, `재생목록 "${(j.title || '').slice(0, 30)}" ${items.length}곡 중 ${put.added}곡 추가 — 첫 곡부터 재생`));
    ytPlay(items[0], true);
  } catch (e) { toast('재생목록 불러오기 실패: ' + e.message, 'err'); }
}
/* 지금 트는 곡은 대기열에서 뺀다.
   예전엔 대기열에서 곡을 눌러 틀어도 그 곡이 대기열에 남아 있었다 —
   곡이 끝나면 ytNext() 가 맨 앞(=방금 튼 그 곡)을 다시 꺼내 **첫 곡이 무한 반복**됐다.
   목록 어디에서 틀었든 같은 곡이 대기열에 남아 있으면 안 된다. */
function ytDropFromQueue(item) {
  if (!item || !S.ytQueue || !S.ytQueue.length) return;
  const n0 = S.ytQueue.length;
  S.ytQueue = S.ytQueue.filter(q => !((item.id && q.id === item.id) || (!item.id && item.list && q.list === item.list)));
  if (S.ytQueue.length !== n0) { ytTouch(); save(); renderYtQueue(); }
}
function ytPlay(item, force) {
  ytDropFromQueue(item);
  /* 여기로 들어온다는 것은 "이 곡을 새로 튼다"는 뜻이다 — 목록 클릭, 대기열 자동 진행(ytNext),
     전부 재생, 검색창에 주소 입력. 끊김 복구는 ytPlayDirect 를 직접 부르므로 여기를 거치지 않는다.
     남아 있던 이어보기 목표를 안 지우면 대기열에 같은 곡이 두 번 있을 때 두 번째가 중간부터 나온다. */
  clearTimeout(YT._skipT);          // 사용자가 직접 곡을 골랐다 — 예약된 자동 넘김은 취소
  YT._resume = null; YT._qualCap = 0; YT._noHls = null;
  if (!YT.cur || YT.cur.id !== item.id || YT.cur.list !== item.list) { YT._embedTry = 0; YT._embedList = null; YT.altTries = 0; YT.altSeen = null; }
  const mode = ytMode();
  if (!force && (mode === 'tab' || mode === 'popup')) { ytPopup(item); return; }
  if (mode === 'direct' && !(force && S.ytMode === 'embed')) {
    if (item.id) { ytPlayDirect(item); return; }
    if (item.list) { ytPlayList(item); return; }
  }
  YT.pop = false; YT.direct = false;
  YT.cur = item; ytRemember(item);
  if (item.list && !item.id && (R.srvInfo && R.srvInfo.ytEngine)) { ytPlayList(item); return; }
  // 영상 ID 가 있으면 믹스 링크라도 단일 영상으로 임베드할 수 있다 (id 없이 믹스만 있을 때만 포기)
  if (item.list && !item.id && /^(RD|UL|LL)/.test(item.list)) { toast('유튜브 자동생성 믹스/목록은 임베드가 안 됩니다 — 직접 재생 모드를 쓰세요'); return; }
  const origin = encodeURIComponent(location.origin.startsWith('http') ? location.origin : 'http://127.0.0.1');
  const host = (YT._embedTry === 1) ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com'; // 1차 실패 시 nocookie 도메인으로 재시도
  let src;
  if (YT._embedList) src = `${host}/embed/videoseries?list=${YT._embedList}&autoplay=1&enablejsapi=1&origin=${origin}`;  // 2차: 임시 재생목록 트릭
  else if (item.list && !item.id) src = `${host}/embed/videoseries?list=${item.list}&autoplay=1&enablejsapi=1&origin=${origin}`;
  /* 예전엔 여기에 &list= 를 붙였다. 그러면 유튜브 플레이어가 **그 목록을 스스로 진행**해
     우리 대기열을 통째로 무시한다 — "곡 틀면 그 곡의 알고리즘대로 다음 곡이 나온다" 가 이것이다.
     다음 곡을 고르는 건 우리 대기열이지 유튜브가 아니다. 그래서 한 곡만 띄운다. */
  else src = `${host}/embed/${item.id}?autoplay=1&enablejsapi=1&origin=${origin}`;
  $('#ytPlayerWrap').innerHTML = `<iframe id="ytFrame" src="${src}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div id="ytErr" class="yt-err" hidden></div>`;
  const fr = $('#ytFrame');
  fr.onload = () => { try { fr.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'nst' }), '*'); setTimeout(() => ytCmd('setVolume', [S.ytVol]), 800); } catch (e) {} };
  YT.playing = true;
  $('#ytNow').hidden = false;
  const title = item.title || item.id || '재생 중';
  $('#ytNowTitle').textContent = title; $('#ytHeadTitle').textContent = title;
  ytSetPlayIcon(true);
  renderYtQueue(); renderYtResults();
}
async function ytEmbedError(code) { // 101/150 = 임베드 금지·연령제한·라이선스, 153 = 리퍼러 문제, 100 = 삭제/비공개, 2/5 = 잘못된 ID
  const why = (code === 101 || code === 150) ? '이 영상은 다른 사이트에서 재생이 막혀 있습니다 (소유자 설정·연령 제한·라이선스)' :
    code === 153 ? '유튜브가 이 페이지의 리퍼러를 거부했습니다' : code === 100 ? '삭제되었거나 비공개 영상입니다' : '임베드 재생 실패 (' + code + ')';
  // 임베드 우회 자동 시도: ① youtube-nocookie 도메인 ② 임시 재생목록 트릭 → 그래도 안 되면 직접 재생
  if ((code === 101 || code === 150 || code === 153) && YT.cur && YT.cur.id && !YT.direct) {
    const tries = YT._embedTry = (YT._embedTry || 0) + 1;
    if (tries === 1) { toast('임베드 제한 — 다른 방식(nocookie)으로 다시 시도'); const it = YT.cur; setTimeout(() => ytPlay(it, true), 200); return; }
    if (tries === 2) {
      try {
        /* 기다리는 동안 사용자가 다른 곡을 고르면, 옛 곡의 임시 목록을 새 곡에 씌우게 된다
           → 방금 고른 곡 대신 아까 실패한 곡이 나온다. 기준 곡을 붙잡아 두고 확인한다. */
        const it = YT.cur;
        const r = await apiFetch('/yt/templist?id=' + encodeURIComponent(it.id)); const j = await r.json();
        if (YT.cur !== it) return;
        if (j.list) { YT._embedList = j.list; toast('임시 재생목록으로 재시도'); setTimeout(() => ytPlay(it, true), 200); return; }
      } catch (e) {}
    }
  }
  YT._embedTry = 0; YT._embedList = null;
  const er = $('#ytErr'); if (!er) return;
  er.hidden = false;
  const hasEngine = !!(R.srvInfo && R.srvInfo.ytEngine) && YT.cur && YT.cur.id && !(YT.directFail && YT.directFail[YT.cur.id]);
  if (hasEngine) { toast(why + ' — 직접 재생으로 전환'); const it = YT.cur; setTimeout(() => ytPlayDirect(it), 300); return; }
  const alt = YT.altTries < 3 && YT.cur && YT.cur.id;
  er.innerHTML = `<div>${esc(why)}</div><div class="row" style="justify-content:center;margin-top:6px">
    <button class="btn sm primary" id="ytErrDirect">⚡ 직접 재생 엔진 설치 후 재생</button>
    ${alt ? '<button class="btn sm" id="ytErrAlt">🔎 다른 업로드 찾기</button>' : ''}${S.ytQueue.length ? '<button class="btn sm" id="ytErrNext">⏭ 다음 곡</button>' : ''}</div>`;
  er.querySelector('#ytErrDirect').onclick = async () => { clearTimeout(YT._skipT); const it = YT.cur; if (await ytEngineEnsure(true)) { if (YT.cur !== it) return; setYtMode('direct'); ytPlayDirect(it); } };
  const ab = er.querySelector('#ytErrAlt'); if (ab) ab.onclick = () => ytFindAlternative(YT.cur);
  const nb = er.querySelector('#ytErrNext'); if (nb) nb.onclick = () => { clearTimeout(YT._skipT); ytNext(); };
  ytAutoSkip(why);
}
async function ytFindAlternative(item) { // 제목으로 다시 검색해 재생 가능한 다른 업로드를 찾음
  if (!item) return;
  clearTimeout(YT._skipT);   // 검색을 기다리는 동안 자동 넘김이 터지면 엉뚱한 곡 위에 덮어쓴다
  YT.altTries = (YT.altTries || 0) + 1; YT.altSeen = YT.altSeen || new Set(); YT.altSeen.add(item.id);
  const q = (item.title || '').replace(/[\[【（(][^\]】）)]*[\]】）)]/g, ' ').replace(/[|｜].*$/, '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (!q) { toast('제목이 없어 대체 영상을 찾을 수 없습니다', 'err'); return; }
  try {
    const res = await apiFetch('/yt/search?q=' + encodeURIComponent(q)); const j = await res.json();
    const cands = (j.items || []).filter(i => i.id && !YT.altSeen.has(i.id));
    if (!cands.length) { toast('대체 영상을 찾지 못했습니다', 'err'); return; }
    const chk = await (await apiFetch('/yt/check?ids=' + cands.slice(0, 15).map(c => c.id).join(','))).json().catch(() => ({ embeddable: {} }));
    const pick = cands.find(c => chk.embeddable && chk.embeddable[c.id] !== false) || cands[0];
    if (YT.cur !== item) return;   // 그 사이 사용자가 직접 다른 곡을 골랐다
    toast('대체 재생: ' + (pick.title || '').slice(0, 40));
    ytPlay(pick, true);
  } catch (e) { toast('대체 영상 검색 실패: ' + e.message, 'err'); }
}
async function markEmbeddable(items) { // 검색 결과에 임베드 불가(🚫) 표시
  const ids = items.filter(i => i.id).map(i => i.id).slice(0, 30); if (!ids.length) return;
  try {
    const j = await (await apiFetch('/yt/check?ids=' + ids.join(','))).json();
    let n = 0;
    for (const it of items) { if (j.embeddable && j.embeddable[it.id] === false) { it.noembed = true; n++; } }
    if (n) renderYtResults();
  } catch (e) {}
}
function ytSetPlayIcon(p) { const t = p ? '❚❚' : '▶'; $('#ytNowToggle').textContent = t; $('#ytPlayBtn').textContent = t; }
function ytCmd(func, args) {
  const v = ytPlayDirect._v && ytPlayDirect._v.isConnected ? ytPlayDirect._v : $('#ytVideo');
  if (v) { // 직접 재생 모드
    if (func === 'pauseVideo') v.pause(); else if (func === 'playVideo') v.play().catch(() => {}); else if (func === 'seekTo') v.currentTime = (args && args[0]) || 0; else if (func === 'setVolume') ytSetVolume((args && args[0]) || 0);
    return;
  }
  const fr = $('#ytFrame'); if (!fr) return; try { fr.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (e) {}
}
function ytToggle() {
  if (!YT.cur) { ytOpen(true); return; }
  /* 탭·팝업 모드에서는 그 창을 우리가 조작할 수 없다. 예전엔 여기서 ytPopup 을 다시 불러
     같은 주소를 재대입했는데, 그러면 일시정지가 아니라 곡이 0초부터 다시 시작했다.
     → 창을 앞으로 불러오기만 하고, 재생 조작은 그 창에서 하도록 알린다. */
  if (YT.pop) {
    if (YT.popWin && !YT.popWin.closed) { try { YT.popWin.focus(); } catch (e) {} toast('재생·정지는 열린 유튜브 창에서 해주세요'); }
    else ytPopup(YT.cur);
    return;
  } if (YT.playing) { ytCmd('pauseVideo'); YT.playing = false; } else { ytCmd('playVideo'); YT.playing = true; } ytSetPlayIcon(YT.playing); }
/* 한 곡이 실패했다고 남은 대기열이 통째로 멈추면 안 된다.
   그렇다고 무조건 넘기면, 전부 실패하는 상황에서 대기열 300곡을 몇 초 만에 태워 버린다.
   → 연속 3회까지만 자동으로 넘기고 그 뒤엔 손을 뗀다.
   한 곡이라도 실제로 재생되면(onplaying) 카운터가 0 으로 돌아간다.
   YT._gen 은 재생 시도마다 올라가는 세대 번호다 — 그 사이 사용자가 직접 다른 곡을 틀었으면
   예약해 둔 건너뛰기는 조용히 취소된다. */
function ytAutoSkip(reason, opt) {
  opt = opt || {};
  /* 대기열이 비었어도 자동 이어듣기가 켜져 있으면 ytNext 가 연관 곡을 채워 이어 갈 수 있다.
     예전엔 여기서 그냥 손을 떼서, 실패한 곡 하나에 음악이 통째로 멈췄다.
     (614행 v.onended 는 처음부터 두 조건을 다 봤는데 여기만 빠져 있었다) */
  const canGo = S.ytQueue.length || (S.ytAutoRelated !== false && YT.cur && YT.cur.id && R.srvInfo && R.srvInfo.ytEngine);
  if (!canGo) { toast(reason + ' — 대기열이 비어 있습니다', 'err'); return; }
  /* 두 가지를 따로 센다.
     · 지워진 영상(gone) — 판정이 2초면 끝나고 아무리 기다려도 안 되니 바로 넘긴다.
       재생목록에 죽은 링크가 여럿 섞여 있는 건 흔한 일이라 여유를 더 준다.
     · 그 밖의 실패 — 유튜브가 막고 있거나 네트워크 문제일 수 있어 3곡에서 멈춘다. */
  const key = opt.gone ? '_goneRun' : '_failRun';
  const cap = opt.gone ? 10 : 3;
  YT[key] = (YT[key] || 0) + 1;
  if (YT[key] > cap) { toast(`연속 ${cap}곡이 재생되지 않아 자동 넘김을 멈췄습니다 — ⏭ 를 눌러 계속하세요`, 'err'); return; }
  const g = YT._gen;
  clearTimeout(YT._skipT);
  const wait = opt.gone ? 800 : 5000;
  toast(`${reason} — 다음 곡으로 넘어갑니다 (${YT[key]}/${cap})`);
  YT._skipT = setTimeout(() => { if (YT._gen === g) ytNext(); }, wait);
}
/* 내가 넣은 곡 = related 표시가 없는 곡. 자동 이어듣기가 채운 곡만 related 다. */
/* ── 대기열 규칙은 여기 한 곳에만 둔다 ───────────────────────────────────
   같은 규칙이 ytNext·ytPopup·renderYtQueue·ytEnqueue·ytAddMany 에 따로 박혀 있어서,
   한쪽을 고치면 다른 쪽에서 그대로 재발했다. 실제로 세 번 그랬다. */
function ytKey(it) { return (it && (it.id || it.list)) || ''; }   // 곡을 가리키는 단 하나의 열쇠
/* 대기열·기록을 **실제로 바꾼** 순간에만 찍는 시각. 창을 두 개 열어 뒀을 때,
   대기열을 건드리지도 않은 창의 낡은 사본이 재생 중인 창의 진행을 되돌리는 것을 막는다. */
function ytTouch() { S.ytTouchedAt = Date.now(); }
function ytMineLeft() { return S.ytQueue.filter(q => !q.related).length; }
/* 재생될 순서 — 내가 넣은 곡이 먼저, 자동 이어듣기가 채운 곡은 그 뒤.
   ytNext 도 ytPopup 도 대기열 화면도 전부 이 함수 하나를 본다. */
function ytOrder(q) { return q.filter(x => !x.related).concat(q.filter(x => x.related)); }
/* 상한을 넘으면 **알고리즘 곡부터** 버린다. 예전엔 배열 꼬리를 그냥 잘라서
   내가 하나하나 모아 둔 곡이 먼저 사라졌다. */
function ytQueueTrim() {
  let over = S.ytQueue.length - YT_QUEUE_MAX;
  if (over <= 0) return 0;
  const cut = over;
  for (let i = S.ytQueue.length - 1; i >= 0 && over > 0; i--) if (S.ytQueue[i].related) { S.ytQueue.splice(i, 1); over--; }
  if (over > 0) S.ytQueue.length = YT_QUEUE_MAX;
  return cut;
}
/* 대기열에 넣는 단 하나의 문. 중복·지금 트는 곡·상한을 여기서 전부 막는다.
   예전엔 넣는 길이 다섯 개였고 그중 셋에 방어가 없었다. */
function ytQueueAdd(items, opt) {
  opt = opt || {};
  const have = new Set(S.ytQueue.map(ytKey).filter(Boolean));
  const cur = YT.cur ? ytKey(YT.cur) : '';
  let self = 0;
  const add = [];
  for (const it of (items || [])) {
    const k = ytKey(it);
    if (!k) continue;
    if (k === cur) { self++; continue; }   // 지금 트는 곡을 다시 넣으면 끝나자마자 또 나온다
    if (have.has(k)) continue;
    have.add(k); add.push(it);
  }
  if (add.length) {
    if (opt.front) S.ytQueue = add.concat(S.ytQueue);
    else if (opt.related) S.ytQueue = S.ytQueue.concat(add);
    else {                                 // 내가 고른 곡은 알고리즘 곡보다 앞에
      const at = S.ytQueue.findIndex(q => q.related);
      if (at >= 0) S.ytQueue.splice(at, 0, ...add); else S.ytQueue = S.ytQueue.concat(add);
    }
  }
  const cut = ytQueueTrim();
  if (add.length || cut) ytTouch();
  return { added: add.length, dup: (items || []).length - add.length - self, self, cut };
}
function ytAddNote(r, head) {   // 넣은 결과를 숨기지 않고 그대로 알린다
  return head + (r.dup ? ` (이미 있던 ${r.dup}곡 제외)` : '') + (r.self ? ' (지금 재생 중인 곡 제외)' : '')
    + (r.cut ? ` · 상한 ${YT_QUEUE_MAX}곡을 넘어 알고리즘 곡 ${r.cut}곡을 뺐습니다` : '');
}
async function ytNext() {
  /* 순서가 아니라 **자격**으로 고른다.
     예전엔 무조건 맨 앞을 꺼냈는데, 자동 이어듣기가 채워 둔 알고리즘 곡이 대기열 중간에
     박히면 내가 나중에 넣은 곡이 그 뒤로 밀려 "대기열 놔두고 알고리즘 곡을 튼다"가 됐다.
     (실제로 대기열 148곡 중 117~137번째가 알고리즘 곡이었다)
     이제 내가 넣은 곡이 하나라도 남아 있으면 알고리즘 곡은 절대 먼저 나가지 않는다.
     위치와 무관한 규칙이라, 대기열에 넣는 새 경로가 생겨도 다시 깨지지 않는다. */
  if (!S.ytQueue.length) {
    if (S.ytAutoRelated !== false && YT.cur && YT.cur.id && R.srvInfo && R.srvInfo.ytEngine) { // 알고리즘 이어듣기: 유튜브 믹스에서 연관 곡을 채움
      const was = YT.cur;
      const ok = await ytFillRelated(YT.cur, true);
      /* 연관 곡을 받아오는 몇 초 사이에 사용자가 직접 곡을 골랐으면 그쪽이 이긴다 —
         알고리즘이 사람이 고른 곡을 밀어내면 안 된다. */
      if (YT.cur !== was) return;
      if (!ok) { toast('연관 곡을 찾지 못했습니다'); return; }
    } else { toast('대기열이 비었습니다'); return; }
  }
  const next = ytOrder(S.ytQueue)[0];       // 남은 게 알고리즘 곡뿐일 때만 그걸 튼다
  if (!next) { toast('대기열이 비었습니다'); return; }
  S.ytQueue.splice(S.ytQueue.indexOf(next), 1);
  ytTouch(); save(); ytPlay(next);
}
async function ytFillRelated(seed, silent) {
  /* 자동 이어듣기(silent=자동 호출)는 내가 넣은 곡이 다 떨어졌을 때만 돈다.
     🎶 버튼처럼 사용자가 직접 부른 경우는 그대로 채운다. */
  if (silent && ytMineLeft()) return false;
  seed = seed || YT.cur || (S.ytHistory || [])[0];
  if (!seed || !seed.id) { toast('기준이 될 곡이 없습니다 — 먼저 한 곡 재생하거나 검색 결과의 🎶를 누르세요', 'err'); return false; }
  try {
    if (!silent) toast('🎶 연관 곡 찾는 중… (' + (seed.title || seed.id).slice(0, 24) + ')');
    const r = await apiFetch('/yt/related?id=' + encodeURIComponent(seed.id));
    if (r.status === 404) { toast('서버가 예전 버전입니다 — 검은 창을 닫고 start.bat을 다시 실행하세요', 'err'); return false; }
    if (r.status === 503) { const ok = await ytEngineEnsure(true); if (!ok) return false; return ytFillRelated(seed, silent); }
    if (!r.ok) { const e = await apiError(r); toast('연관 곡 실패: ' + e.message, 'err'); return false; }
    const j = await r.json();
    const played = new Set((S.ytHistory || []).slice(0, 60).map(h => h.id));
    const fresh = (j.items || []).filter(it => !played.has(it.id) && !S.ytQueue.some(q => q.id === it.id));
    const pick = fresh.slice(0, 10);
    if (!pick.length) { if (!silent) toast('새로운 연관 곡이 없습니다 (전부 최근에 들었거나 대기열에 있음)'); return false; }
    pick.forEach(it => { it.related = true; });
    ytQueueAdd(pick, { related: true }); save(); renderYtQueue();
    if (!silent) toast(`🎶 알고리즘: "${(seed.title || '').slice(0, 24)}" 연관 곡 ${pick.length}곡 — 내가 넣은 곡이 다 나간 뒤에 재생됩니다`);
    return true;
  } catch (e) { toast('연관 곡 실패: ' + e.message, 'err'); return false; }
}
/* 대기열을 비우지 않는다 — 내가 넣어 둔 곡을 말없이 버리면 안 된다.
   연관 곡은 지금 대기열 **뒤에** 붙고, 지금 트는 게 없을 때만 바로 이어서 튼다. */
function ytPlayRelatedNow(item) { ytFillRelated(item).then(ok => { if (ok && !YT.cur) ytNext(); }); }
/* 대기열에 여러 곡을 넣을 때, 이미 쌓여 있으면 어디에 넣을지 묻는다.
   그냥 뒤에 붙이면 앞선 수백 곡이 다 나온 뒤에야 재생돼서, 방금 넣은 재생목록이
   안 나오고 '엉뚱한 곡이 나온다'고 느끼게 된다. */
function ytAddMany(items, label) {
  if (!items || !items.length) { toast('넣을 곡이 없습니다', 'err'); return; }
  const ahead = S.ytQueue.length;
  /* 예전엔 items 를 그대로 concat 만 했다 — 중복 검사도, 상한도, '지금 트는 곡 빼기'도 없었다.
     기록 탭의 '＋ 전부 대기열' 은 S.ytHistory 를 통째로 넘기는데 그 첫 항목이 **지금 트는 곡**이라,
     누르는 순간 지금 곡이 대기열 1번이 되고 끝나자마자 같은 곡이 다시 나왔다.
     두 번 누르면 대기열이 정확히 두 배가 됐다. 이제 넣는 문은 ytQueueAdd 하나뿐이다. */
  const put = front => {
    const r = ytQueueAdd(items, { front });
    save(); renderYtQueue();
    if (!r.added) { toast(ytAddNote(r, '새로 넣을 곡이 없습니다'), 'err'); return; }
    toast(ytAddNote(r, front ? `${r.added}곡을 대기열 맨 앞에 넣었습니다`
      : `${r.added}곡을 대기열 뒤(${ahead + 1}번째부터)에 넣었습니다`));
  };
  if (ahead <= 3) { put(false); return; }
  // confirm 은 선택지가 둘뿐이라 '그만두기' 를 만들 수 없었다 → 앱 모달로 세 갈래를 준다
  openModal('대기열에 넣기', body => {
    body.innerHTML = `<div class="hint">${esc(label || '')}<b>${items.length}곡</b>을 대기열에 넣습니다. 앞에 이미 <b>${ahead}곡</b>이 있습니다.</div>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="qFront">맨 앞에 넣어 바로 듣기</button>
      <button class="btn" id="qBack">맨 뒤에 붙이기</button><button class="btn ghost" id="qNo">그만두기</button></div>`;
    body.querySelector('#qFront').onclick = () => { closeModal(); put(true); };
    body.querySelector('#qBack').onclick = () => { closeModal(); put(false); };
    body.querySelector('#qNo').onclick = () => closeModal();
  });
}
function ytEnqueue(item) {
  const k = ytKey(item);
  if (!k) { toast('넣을 수 없는 항목입니다', 'err'); return; }
  if (YT.cur && ytKey(YT.cur) === k) { toast('지금 재생 중인 곡입니다'); return; }
  const i = S.ytQueue.findIndex(q => ytKey(q) === k);   // 열쇠는 id||list — 예전엔 id 만 봐서
  if (i >= 0) {                                        // id 없는 재생목록끼리 같은 곡으로 판정됐다
    if (!S.ytQueue[i].related) { toast('이미 대기열에 있습니다: ' + (item.title || '')); return; }
    /* 알고리즘이 미리 담아 둔 곡을 내가 직접 골랐다 = **내 곡으로 승격**한다.
       예전엔 '이미 있습니다' 로 거절해서, 그 곡은 🎶 딱지가 붙은 채 내 곡이 다 나갈 때까지
       안 나오고 '알고리즘 곡 빼기' 에 같이 지워졌다. */
    item = S.ytQueue.splice(i, 1)[0];
    delete item.related;
  }
  if (S.ytQueue.length >= YT_QUEUE_MAX) { toast(`대기열이 가득 찼습니다 (${YT_QUEUE_MAX}곡) — 먼저 정리해 주세요`, 'err'); return; }
  const r = ytQueueAdd([item]);              // 내가 고른 곡은 알고리즘 곡보다 앞에 (ytQueueAdd 기본)
  save(); renderYtQueue();
  if (!r.added) { toast('이미 대기열에 있습니다: ' + (item.title || '')); return; }
  const pos = ytOrder(S.ytQueue).findIndex(q => ytKey(q) === k) + 1;   // 화면·재생과 같은 순서로 센다
  toast(ytAddNote(r, `대기열 ${pos}번째에 추가: ` + (item.title || '')));
}
function ytRemember(item) { // 최근 재생 기록 (최대 200곡) — 대기열에서 빠져도 여기 남음
  if (!item || !(item.id || item.list)) return;
  S.ytHistory = (S.ytHistory || []).filter(h => !(h.id && h.id === item.id) && !(h.list && !h.id && h.list === item.list));
  S.ytHistory.unshift({ id: item.id, list: item.list, title: item.title, channel: item.channel, len: item.len, thumb: item.thumb, t: Date.now() });
  if (S.ytHistory.length > 200) S.ytHistory.length = 200;
  ytTouch(); save();
}
function renderYtHistory() {
  const box = $('#ytHist'); if (!box) return; box.innerHTML = '';
  const h = S.ytHistory || [];
  const bar = document.createElement('div'); bar.className = 'row'; bar.style.padding = '2px 4px 6px';
  bar.innerHTML = `<span class="hint" style="flex:1">최근 재생 ${h.length}곡 · 대기열에서 빠져도 여기 남습니다</span><button class="btn xs" id="ytHistAll">＋ 전부 대기열</button><button class="btn xs ghost" id="ytHistRecover">🛟 복구</button><button class="btn xs danger" id="ytHistClear" title="재생 기록을 전부 지웁니다">🗑</button>`;
  box.appendChild(bar);
  bar.querySelector('#ytHistAll').onclick = () => ytAddMany(h.slice(), '기록 ');
  bar.querySelector('#ytHistRecover').onclick = openYtRecover;
  bar.querySelector('#ytHistClear').onclick = () => {
    if (!h.length || !confirm(`재생 기록 ${h.length}곡을 전부 지웁니다. 계속할까요?`)) return;
    S.ytHistory = []; save(); renderYtHistory(); toast('재생 기록을 지웠습니다');
  };
  h.forEach(it => box.appendChild(ytItemEl(it, {
    remove: x => { S.ytHistory = (S.ytHistory || []).filter(y => y !== x); save(); renderYtHistory(); },
    removeTip: '이 곡을 재생 기록에서 빼기',
  })));
  if (!h.length) { const e = document.createElement('div'); e.className = 'hint'; e.style.padding = '8px'; e.textContent = '아직 재생 기록이 없습니다'; box.appendChild(e); }
}
async function openYtRecover() { // 이전 브라우저/서버 이전 상태에서 대기열·검색결과·기록 복구
  const srcs = [];
  try { const p = JSON.parse(localStorage.getItem('nst_state_prev') || 'null'); if (p) srcs.push(['이 브라우저의 이전 상태 (서버 동기화로 덮어쓰기 전 백업)', p]); } catch (e) {}
  try { const r = await apiFetch('/state?prev=1'); if (r.ok) { const p = await r.json(); if (p && p.savedAt) srcs.push(['서버의 이전 저장본 (data/state.prev.json)', p]); } } catch (e) {}
  openModal('🛟 노래 목록 복구', body => {
    if (!srcs.length) { body.innerHTML = '<div class="hint">복구할 이전 상태가 없습니다. (백업은 이 버전부터 만들어지므로, 이전에 사라진 목록은 아쉽지만 되살릴 수 없습니다. 앞으로는 최근 재생 기록에 항상 남습니다.)</div>'; return; }
    body.innerHTML = '<div class="hint">발견된 이전 상태입니다. 항목을 골라 지금 대기열/기록에 <b>합칩니다</b>(덮어쓰지 않음).</div>';
    srcs.forEach(([label, p]) => {
      const q = p.ytQueue || [], hist = p.ytHistory || [], res = p.ytLastResults || [];
      const d = document.createElement('div'); d.className = 'style-card';
      d.innerHTML = `<b>${esc(label)}</b><div class="hint">${p.savedAt ? new Date(p.savedAt).toLocaleString() : ''} · 대기열 ${q.length}곡 · 최근 재생 ${hist.length}곡 · 검색결과 ${res.length}개</div>
        <div class="row">${q.length ? '<button class="btn xs" data-a="q">대기열 ' + q.length + '곡 합치기</button>' : ''}${hist.length ? '<button class="btn xs" data-a="h">최근 재생 합치기</button>' : ''}${res.length ? '<button class="btn xs" data-a="r">검색결과 불러오기</button>' : ''}</div>`;
      d.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (b.dataset.a === 'q') { const r = ytQueueAdd(q); renderYtQueue(); toast(ytAddNote(r, `대기열 ${r.added}곡 복구됨`)); }
        if (b.dataset.a === 'h') { S.ytHistory = S.ytHistory || []; hist.forEach(it => { if (ytKey(it) && !S.ytHistory.some(x => ytKey(x) === ytKey(it))) S.ytHistory.push(it); }); if (S.ytHistory.length > 200) S.ytHistory.length = 200; renderYtHistory(); toast('기록 복구됨'); }
        if (b.dataset.a === 'r') { ytLastResults = res; S.ytLastResults = res; renderYtResults(); $('#ytTabRes').click(); toast('검색결과 복구됨'); }
        save();
      });
      body.appendChild(d);
    });
  });
}
function ytItemEl(it, opts) {
  const d = document.createElement('div');
  d.className = 'ytitem' + (YT.cur && ((it.id && it.id === YT.cur.id) || (it.list && it.list === YT.cur.list)) ? ' playing' : '');
  d.innerHTML = `<img loading="lazy"><div class="yt-meta"><div class="yt-t"></div><div class="yt-s"></div></div><button class="ic yt-add" title="${opts.queue ? '대기열에서 제거' : '대기열에 추가'}">${opts.queue ? '✕' : '＋'}</button>`;
  d.querySelector('img').src = it.thumb || '';
  d.querySelector('.yt-t').textContent = it.title || it.id;
  d.querySelector('.yt-s').textContent = [it.related ? '🎶 연관' : '', it.noembed ? ((R.srvInfo && R.srvInfo.ytEngine) ? '🚫 임베드 불가 → 직접 재생' : '🚫 임베드 불가') : '', it.channel, it.len, it.views].filter(Boolean).join(' · ');
  if (!opts.queue && it.id) { const rb = document.createElement('button'); rb.className = 'ic yt-add'; rb.title = '이 곡 기반 연관 곡으로 이어듣기 (알고리즘)'; rb.textContent = '🎶'; rb.onclick = e => { e.stopPropagation(); ytFillRelated(it); }; d.appendChild(rb); }
  // 기록·내 재생목록처럼 "빼기"가 따로 필요한 목록은 제거 버튼을 하나 더 단다
  if (opts.remove) { const xb = document.createElement('button'); xb.className = 'ic yt-add yt-del'; xb.title = opts.removeTip || '목록에서 빼기'; xb.textContent = '✕'; xb.onclick = e => { e.stopPropagation(); opts.remove(it); }; d.appendChild(xb); }
  if (it.noembed) d.classList.add('noembed');
  // 목록에서 직접 고른 것은 '처음부터 듣겠다'는 뜻이다 — 남아 있던 이어보기 목표를 버린다
  d.onclick = () => { YT._resume = null; YT._qualCap = 0; YT._noHls = null; YT.altTries = 0; YT.altSeen = null; YT._embedTry = 0; YT._embedList = null; if (it.noembed && ytMode() === 'embed') { ytDropFromQueue(it); if (R.srvInfo && R.srvInfo.ytEngine) { toast('임베드가 막힌 영상 → 직접 재생'); ytPlayDirect(it); } else ytPopup(it); return; } ytPlay(it); };
  /* 렌더 시점 인덱스로 지우면, 그 사이 대기열이 바뀌었을 때 엉뚱한 곡이 지워진다
     (곡이 넘어가거나 설정을 가져온 직후에 실제로 그랬다). 항목 자체를 찾아 지운다. */
  d.querySelector('.yt-add').onclick = e => { e.stopPropagation(); if (opts.queue) { const i = S.ytQueue.indexOf(it); if (i >= 0) S.ytQueue.splice(i, 1); ytTouch(); save(); renderYtQueue(); } else ytEnqueue(it); };
  return d;
}
function renderYtResults() { const box = $('#ytResults'); box.innerHTML = ''; ytLastResults.forEach(it => box.appendChild(ytItemEl(it, {}))); }
/* S → 화면. 조작부는 initYouTube 에서 한 번만 세팅됐기 때문에, 서버에서 설정을 가져오거나
   백업을 복원해 S 가 통째로 바뀌면 화면이 옛 값으로 남았다. 그 상태에서 체크박스를 만지면
   화면의 잘못된 값이 진짜 설정을 덮어썼다 — '껐는데 다시 켜져 있다' 가 이것이다.
   S 를 갈아끼우는 자리에서 반드시 이 함수를 부른다. */
function syncYtUI() {
  const set = (sel, fn) => { const el = $(sel); if (el) fn(el); };
  set('#ytUsePop', el => { el.checked = !!S.ytUsePop; });
  set('#ytAutoRelated', el => { el.checked = S.ytAutoRelated !== false; });
  set('#ytNormalize', el => { el.checked = !!S.ytNormalize; });
  /* 화질 목록은 곡을 틀어야 채워진다. 없는 값을 넣으면 select 가 빈 칸이 되므로,
     있는 선택지일 때만 반영한다(없으면 다음 곡에서 ytFillQualSelect 가 맞춘다). */
  set('#ytQual', el => { const want = S.ytQual || 'auto'; if ([...el.options].some(o => o.value === want)) el.value = want; });
  set('#ytVol', el => { el.value = (S.ytVol == null ? 60 : S.ytVol); });
  set('#ytModeLbl', el => { el.textContent = ({ direct: '직접', embed: '임베드', tab: '탭', popup: '팝업' })[ytMode()] || ''; });
  if (typeof ytPaintAudioBtn === 'function') ytPaintAudioBtn();
  if (typeof ytApplyPos === 'function' && !$('#ytFloat').hidden) ytApplyPos();
  if (typeof ytCmd === 'function' && YT.cur) ytCmd('setVolume', [S.ytVol == null ? 60 : S.ytVol]);
}
function renderYtQueue() {
  const box = $('#ytQueue'); box.innerHTML = '';
  const n = S.ytQueue.length;
  if (n) {
    // 재생목록을 통째로 넣으면 수십~수백 곡이 쌓인다 → 한 곡씩 ✕ 말고 통째로 빼는 길도 준다
    const bar = document.createElement('div'); bar.className = 'row'; bar.style.padding = '2px 4px 6px';
    /* 자동 이어듣기가 끼워 넣은 곡이 몇 곡인지 숨기지 않는다 — 예전엔 대기열 중간에 조용히
       쌓여서 "내가 넣지도 않은 곡이 왜 나오나" 가 됐다. 내가 넣은 곡이 먼저 나간다는 것도 밝힌다. */
    const nRel = S.ytQueue.filter(q => q.related).length;
    bar.innerHTML = `<span class="hint" style="flex:1">${n}곡${nRel ? ` <b>(내가 넣은 ${n - nRel} + 🎶 알고리즘 ${nRel} — 내 곡 먼저)</b>` : ''} · 각 줄의 ✕ 로 한 곡씩</span>
      ${nRel ? '<button class="btn xs" id="ytQNoRel" title="자동 이어듣기가 채운 곡만 뺍니다">🎶 알고리즘 곡 빼기</button>' : ''}
      <button class="btn xs" id="ytQDedup" title="같은 곡이 여러 번 들어간 것을 정리">중복 정리</button>
      <button class="btn xs danger" id="ytQClear" title="대기열을 통째로 비웁니다">🗑 전부 빼기</button>`;
    box.appendChild(bar);
    const nr = bar.querySelector('#ytQNoRel');
    if (nr) nr.onclick = () => { S.ytQueue = S.ytQueue.filter(q => !q.related); ytTouch(); save(); renderYtQueue(); toast(`알고리즘 곡 ${nRel}곡을 뺐습니다`); };
    bar.querySelector('#ytQClear').onclick = () => {
      if (!confirm(`대기열 ${n}곡을 전부 뺍니다. 계속할까요?\n(기록 탭에 남아 있어 되돌릴 수 있습니다)`)) return;
      S.ytQueue = []; ytTouch(); save(); renderYtQueue(); toast(`${n}곡을 대기열에서 뺐습니다`);
    };
    bar.querySelector('#ytQDedup').onclick = () => {
      const seen = new Set(); const kept = S.ytQueue.filter(x => { const k = x.id || x.list; if (!k || seen.has(k)) return false; seen.add(k); return true; });
      const gone = n - kept.length;
      if (!gone) { toast('중복이 없습니다'); return; }
      S.ytQueue = kept; ytTouch(); save(); renderYtQueue(); toast(`중복 ${gone}곡 제거`);
    };
  }
  /* 화면에 보이는 순서 = 실제로 나올 순서. 예전엔 배열 순서 그대로 그려서,
     '내 곡 먼저' 라고 써 놓고 목록은 알고리즘 곡이 위에 있는 모순이 났다.
     ✕ 는 화면 순서가 아니라 배열의 진짜 자리를 지워야 한다. */
  const pos = new Map(S.ytQueue.map((it, i) => [it, i]));
  ytOrder(S.ytQueue).forEach(it => box.appendChild(ytItemEl(it, { queue: true, idx: pos.get(it) })));
  if (!n) box.innerHTML = '<div class="hint" style="padding:8px">대기열이 비었습니다 — 검색 결과의 ＋ 로 추가</div>';
  $('#ytQueueN').textContent = n ? `(${n})` : '';
}
async function ytSearch(q) {
  q = q.trim(); if (!q) return;
  const p = parseYt(q);
  if (p && (p.id || p.list)) { ytPlay({ id: p.id, list: p.list, title: q }); return; }
  $('#ytTabRes').click();
  $('#ytResults').innerHTML = '<div class="hint" style="padding:8px">검색 중…</div>';
  try {
    const res = await apiFetch('/yt/search?q=' + encodeURIComponent(q));
    if (!res.ok) throw await apiError(res);
    const j = await res.json(); ytLastResults = j.items || []; renderYtResults();
    S.ytLastResults = ytLastResults.slice(0, 40); S.ytLastQuery = q; save(); // 새로고침해도 검색결과 유지
    if (!ytLastResults.length) $('#ytResults').innerHTML = '<div class="hint" style="padding:8px">결과 없음</div>';
    else markEmbeddable(ytLastResults);
  } catch (e) { $('#ytResults').innerHTML = ''; toast('유튜브 검색 실패: ' + e.message, 'err'); }
}
/* ─────────────── YouTube 계정 연결 (Google OAuth · YouTube Data API) ─────────────── */
const YTA = { tok: null, exp: 0, view: 'lists', items: [] };
const ytaLinked = () => !!(R.srvInfo && R.srvInfo.ytLinked) || (YTA.tok && Date.now() < YTA.exp);
async function ytaEnsure() {
  if (YTA.tok && Date.now() < YTA.exp - 60000) return YTA.tok;
  const r = await apiFetch('/yt/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw await apiError(r);
  const j = await r.json(); YTA.tok = j.access_token; YTA.exp = Date.now() + ((j.expires_in || 3600) * 1000);
  return YTA.tok;
}
async function ytaApi(path) {
  const tok = await ytaEnsure();
  const r = await apiFetch('/g/youtube/v3/' + path, { headers: { Authorization: 'Bearer ' + tok } });
  if (r.status === 401) { YTA.tok = null; throw new Error('YouTube 인증이 만료되었습니다 — 다시 연결하세요'); }
  if (!r.ok) throw await apiError(r);
  return r.json();
}
function b64url(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function ytaLinkStart() {
  const cid = R.srvInfo && R.srvInfo.ytClientId;
  if (!cid) { openYtAccountSetup(); return; }
  if (IS_FILE || !location.origin.startsWith('http')) { toast('계정 연결은 start.bat으로 연 주소(http://127.0.0.1:…)에서만 가능합니다', 'err'); return; }
  const redirect = location.origin + '/';
  const useCode = !!(R.srvInfo && R.srvInfo.ytHasSecret);
  /* state 는 "내가 시작한 연결이 맞는지" 확인하는 값이라 매번 새로 만들어야 한다.
     'nst' 로 고정해 두고 확인도 안 하면, 남이 만든 콜백 주소를 열었을 때
     그 사람 계정 코드를 내 앱이 그대로 받아 넣게 된다. */
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem('yt_state', nonce);
  const p = new URLSearchParams({ client_id: cid, redirect_uri: redirect, scope: 'https://www.googleapis.com/auth/youtube.readonly', include_granted_scopes: 'true', state: nonce });
  if (useCode) {
    const arr = new Uint8Array(48); crypto.getRandomValues(arr); const verifier = b64url(arr);
    const chal = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    sessionStorage.setItem('yt_pkce', verifier);
    p.set('response_type', 'code'); p.set('code_challenge', chal); p.set('code_challenge_method', 'S256'); p.set('access_type', 'offline'); p.set('prompt', 'consent');
  } else p.set('response_type', 'token');
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}
async function ytaLinkFinish() { // 리디렉션으로 돌아왔을 때
  const qp = new URLSearchParams(location.search), hp = new URLSearchParams(location.hash.replace(/^#/, ''));
  // 돌아온 state 가 내가 보낸 것과 같을 때만 받는다 (아래 두 흐름 모두)
  const back = qp.get('code') || hp.get('access_token') || qp.get('error');
  if (back) {
    const want = sessionStorage.getItem('yt_state') || '';
    const got = qp.get('state') || hp.get('state') || '';
    sessionStorage.removeItem('yt_state');
    if (!want || got !== want) {
      toast('YouTube 연결을 확인하지 못했습니다 — 앱에서 다시 연결해 주세요', 'err');
      history.replaceState({}, '', location.pathname);
      return;
    }
  }
  if (qp.get('code')) {
    try {
      const r = await apiFetch('/yt/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: qp.get('code'), verifier: sessionStorage.getItem('yt_pkce') || '', redirect: location.origin + '/' }) });
      if (!r.ok) throw await apiError(r);
      const j = await r.json(); YTA.tok = j.access_token; YTA.exp = Date.now() + (j.expires_in || 3600) * 1000;
      if (R.srvInfo) R.srvInfo.ytLinked = true;
      toast('✔ YouTube 계정이 연결되었습니다'); ytOpen(true); $('#ytTabMine').click();
    } catch (e) { toast('YouTube 연결 실패: ' + e.message, 'err'); }
    history.replaceState({}, '', location.pathname);
  } else if (hp.get('access_token')) {
    YTA.tok = hp.get('access_token'); YTA.exp = Date.now() + (+hp.get('expires_in') || 3600) * 1000;
    toast('✔ YouTube 계정이 연결되었습니다 (1시간, 만료되면 다시 연결)'); history.replaceState({}, '', location.pathname); ytOpen(true); $('#ytTabMine').click();
  } else if (qp.get('error')) { toast('YouTube 연결 취소/실패: ' + qp.get('error'), 'err'); history.replaceState({}, '', location.pathname); }
}
function openYtAccountSetup() {
  openModal('YouTube 계정 연결 설정 (Google OAuth)', body => {
    const info = R.srvInfo || {};
    body.innerHTML = `<div class="hint">계정을 연결하면 🎵 창의 <b>👤 내 목록</b>에서 내 재생목록·좋아요 영상을 불러와 바로 재생/대기열에 넣을 수 있습니다. Google 정책상 <b>본인 Google Cloud 프로젝트의 OAuth 클라이언트 ID</b>가 필요합니다 (무료, 5분).</div>
      <ol class="guide">
        <li><a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a> → 프로젝트 만들기 → <b>YouTube Data API v3</b> "사용"</li>
        <li>API 및 서비스 → <b>OAuth 동의 화면</b>(Google Auth Platform) → 외부 → 앱 이름 아무거나 → <b style="color:var(--red)">대상(Audience) → 테스트 사용자에 내 Gmail 추가 (필수!)</b><br>
          <span class="hint">이걸 빼먹으면 로그인 시 "오류 403: access_denied — 앱은 현재 테스트 중" 이 뜹니다. <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noopener">테스트 사용자 바로가기</a></span></li>
        <li><b>사용자 인증 정보 → OAuth 클라이언트 ID 만들기 → 웹 애플리케이션</b><br>
          승인된 자바스크립트 원본: <code>${esc(location.origin)}</code><br>
          승인된 리디렉션 URI: <code>${esc(location.origin + '/')}</code></li>
        <li>발급된 <b>클라이언트 ID</b>(…apps.googleusercontent.com)를 아래에 붙여넣기. <b>클라이언트 보안 비밀</b>도 넣으면 1시간마다 재연결 없이 계속 유지됩니다(선택).</li>
      </ol>
      <label class="fld">클라이언트 ID<input type="text" id="ycId" placeholder="xxxx.apps.googleusercontent.com"></label>
      <label class="fld">클라이언트 보안 비밀 (선택 · 로컬 서버 파일에만 저장)<input type="password" id="ycSec" placeholder="GOCSPX-…"></label>
      <div class="row"><button class="btn primary sm" id="ycSave">저장</button><button class="btn sm" id="ycLink">🔗 Google 로그인으로 연결</button><button class="btn sm danger" id="ycUnlink">연결 해제</button><span class="hint" id="ycState"></span></div>`;
    body.querySelector('#ycId').value = info.ytClientId || '';
    const st = body.querySelector('#ycState'); st.textContent = info.ytLinked ? '상태: 연결됨' : (info.ytClientId ? '상태: ID 저장됨 · 아직 미연결' : '');
    body.querySelector('#ycSave').onclick = async () => {
      const id = body.querySelector('#ycId').value.trim(), sec = body.querySelector('#ycSec').value.trim();
      const bodyJ = { ytClientId: id }; if (sec) bodyJ.ytClientSecret = sec;
      const r = await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyJ) });
      const j = await r.json(); R.srvInfo = { ...(R.srvInfo || {}), ytClientId: j.ytClientId, ytHasSecret: j.ytHasSecret, ytLinked: j.ytLinked };
      st.textContent = '저장됨 — 이제 "Google 로그인으로 연결"'; body.querySelector('#ycSec').value = '';
    };
    body.querySelector('#ycLink').onclick = () => ytaLinkStart();
    body.querySelector('#ycUnlink').onclick = async () => { await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ytRefresh: '' }) }); YTA.tok = null; if (R.srvInfo) R.srvInfo.ytLinked = false; st.textContent = '연결 해제됨'; };
  }, true);
}
async function renderYtMine() {
  const box = $('#ytMine'); box.innerHTML = '';
  if (!ytaLinked()) {
    box.innerHTML = `<div class="hint" style="padding:8px">YouTube 계정이 연결되지 않았습니다.</div>`;
    const b = document.createElement('button'); b.className = 'btn sm primary'; b.textContent = '👤 계정 연결하기'; b.style.margin = '0 8px 8px'; b.onclick = () => (R.srvInfo && R.srvInfo.ytClientId) ? ytaLinkStart() : openYtAccountSetup(); box.appendChild(b);
    return;
  }
  const bar = document.createElement('div'); bar.className = 'row'; bar.style.padding = '2px 4px 6px';
  bar.innerHTML = `<button class="btn xs" data-v="lists">내 재생목록</button><button class="btn xs" data-v="liked">👍 좋아요</button><button class="btn xs ghost" data-v="setup">⚙</button><span class="hint" id="ytMineN"></span>`;
  bar.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === YTA.view); b.onclick = () => { if (b.dataset.v === 'setup') { openYtAccountSetup(); return; } YTA.view = b.dataset.v; YTA.pl = null; renderYtMine(); }; });
  box.appendChild(bar);
  const list = document.createElement('div'); list.className = 'ytlist'; box.appendChild(list);
  list.innerHTML = '<div class="hint" style="padding:8px">불러오는 중…</div>';
  try {
    if (YTA.view === 'lists' && !YTA.pl) {
      const j = await ytaApi('playlists?part=snippet,contentDetails&mine=true&maxResults=50');
      list.innerHTML = '';
      const all = [{ id: 'LL', snippet: { title: '👍 좋아요 표시한 동영상', thumbnails: {} }, contentDetails: {} }].concat(j.items || []);
      for (const pl of all) {
        const d = document.createElement('div'); d.className = 'ytitem';
        const th = pl.snippet.thumbnails && (pl.snippet.thumbnails.medium || pl.snippet.thumbnails.default);
        d.innerHTML = `<img loading="lazy"><div class="yt-meta"><div class="yt-t"></div><div class="yt-s"></div></div><button class="ic yt-add" title="전체를 대기열에 추가">＋</button>`;
        if (th) d.querySelector('img').src = th.url;
        d.querySelector('.yt-t').textContent = pl.snippet.title;
        d.querySelector('.yt-s').textContent = pl.contentDetails.itemCount != null ? pl.contentDetails.itemCount + '개' : '';
        d.onclick = () => { YTA.pl = { id: pl.id, title: pl.snippet.title }; renderYtMine(); };
        d.querySelector('.yt-add').onclick = async e => { e.stopPropagation(); const items = await ytaPlaylistItems(pl.id); ytAddMany(items, `"${pl.snippet.title}" `); };
        list.appendChild(d);
      }
      $('#ytMineN').textContent = `${all.length - 1}개 재생목록`;
    } else {
      const plId = YTA.view === 'liked' ? 'LL' : YTA.pl.id;
      const items = await ytaPlaylistItems(plId);
      list.innerHTML = '';
      const head = document.createElement('div'); head.className = 'row'; head.style.padding = '2px 4px 6px';
      head.innerHTML = `<button class="btn xs">‹ 목록</button><b style="font-size:12px;flex:1">${esc(YTA.view === 'liked' ? '👍 좋아요' : YTA.pl.title)}</b><button class="btn xs" id="ytPlAll">▶ 전부 재생</button><button class="btn xs" id="ytPlQ">＋ 전부 대기열</button>`;
      head.querySelector('button').onclick = () => { YTA.pl = null; YTA.view = 'lists'; renderYtMine(); };
      head.querySelector('#ytPlAll').onclick = () => {
      if (!items.length) return;
      // 대기열을 통째로 갈아치운다. 수백 곡을 쌓아둔 경우 되돌릴 방법이 사실상 없다 → 먼저 묻는다
      if (S.ytQueue.length && !confirm(`지금 대기열에 있는 ${S.ytQueue.length}곡을 버리고 이 목록(${items.length}곡)으로 바꿉니다.\n\n계속할까요? (이어서 넣으려면 옆의 "대기열에 추가" 를 쓰세요)`)) return;
      S.ytQueue = items.slice(1); save(); renderYtQueue(); ytPlay(items[0]);
    };
      head.querySelector('#ytPlQ').onclick = () => ytAddMany(items);
      list.appendChild(head);
      items.forEach(it => list.appendChild(ytItemEl(it, {})));
      $('#ytMineN').textContent = `${items.length}곡`;
    }
  } catch (e) { list.innerHTML = `<div class="hint" style="padding:8px">불러오기 실패: ${esc(e.message)}</div>`; }
}
async function ytaPlaylistItems(plId) {
  const out = []; let pageToken = '';
  for (let i = 0; i < 4; i++) { // 최대 200곡
    const j = await ytaApi(`playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(plId)}${pageToken ? '&pageToken=' + pageToken : ''}`);
    for (const it of j.items || []) {
      const vid = it.contentDetails && it.contentDetails.videoId; if (!vid) continue;
      const sn = it.snippet || {}; if (/^(Private|Deleted) video$/i.test(sn.title || '')) continue;
      out.push({ id: vid, title: sn.title, channel: sn.videoOwnerChannelTitle || '', thumb: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` });
    }
    pageToken = j.nextPageToken; if (!pageToken) break;
  }
  return out;
}

function initYouTube() {
  const f = $('#ytFloat'), head = $('#ytHead');
  $('#btnYt').onclick = () => { ytOpen(f.hidden); if (!f.hidden) setTimeout(() => $('#ytQ').focus(), 50); };
  $('#ytCloseBtn').onclick = () => ytOpen(false);
  $('#ytMinBtn').onclick = () => { YT.min = !YT.min; f.classList.toggle('min', YT.min); };
  head.ondblclick = e => { if (e.target.closest('button')) return; YT.min = !YT.min; f.classList.toggle('min', YT.min); };
  $('#ytSizeBtn').onclick = () => {
    // 직접 정한 크기가 남아 있으면 컴팩트/전체 전환이 안 먹는 것처럼 보인다 → 함께 푼다
    S.ytSize = S.ytSize === 'compact' ? 'normal' : 'compact'; S.ytDim = null; save(); ytApplyPos();
  };
  $('#ytPopBtn').onclick = () => { if (YT.cur) { ytCmd('pauseVideo'); ytPopup(YT.cur); } else toast('먼저 재생할 곡을 고르세요'); };
  const up = $('#ytUsePop'); up.checked = !!S.ytUsePop; up.onchange = () => { setYtMode(up.checked ? (S.ytPopMode === 'popup' ? 'popup' : 'tab') : ((R.srvInfo && R.srvInfo.ytEngine) ? 'direct' : 'embed')); };
  $('#ytGuideBtn').onclick = openYtAccountGuide;
  const ar = $('#ytAutoRelated'); ar.checked = S.ytAutoRelated !== false; ar.onchange = () => { S.ytAutoRelated = ar.checked; save(); };
  const nz = $('#ytNormalize'); nz.checked = !!S.ytNormalize; nz.onchange = () => { S.ytNormalize = nz.checked; save(); if (!nz.checked) { if (AGC.gain) AGC.gain.gain.value = 1; if (AGC.user) AGC.user.gain.value = (S.ytVol == null ? 60 : S.ytVol) / 100; toast('자동 음량 맞춤 끔 — 설정한 볼륨 그대로 재생 (다음 곡부터 완전 적용)'); } else toast('자동 음량 맞춤 켬 — 다음 곡부터 적용'); };
  $('#ytRelatedNow').onclick = async () => { const ok = await ytFillRelated(null); if (ok) { $('#ytTabQ').click(); if (!YT.cur && S.ytQueue.length) ytNext(); } };
  $('#ytAudioBtn').onclick = () => {
    S.ytAudioOnly = !S.ytAudioOnly; save(); ytPaintAudioBtn();
    if (YT.direct && YT.cur) ytReplayHere();
    toast(S.ytAudioOnly ? '🎧 오디오만 (고음질 · 화면 없음)' : '🎬 영상 + 오디오');
  };
  ytPaintAudioBtn();
  const qs2 = $('#ytQual');
  if (qs2) qs2.onchange = () => { S.ytQual = qs2.value; save(); YT._noHls = null; YT._qualCap = 0; if (YT.direct && YT.cur) ytReplayHere(); };  // 직접 고른 화질이 자동 강등에 눌리면 안 된다
  $('#ytModeBtn').onclick = openYtAccountGuide;
  $('#ytModeLbl').textContent = ({ direct: '직접', embed: '임베드', tab: '탭', popup: '팝업' })[ytMode()];
  window.onServerUp = (orig => () => { if (orig) orig(); const l = $('#ytModeLbl'); if (l) l.textContent = ({ direct: '직접', embed: '임베드', tab: '탭', popup: '팝업' })[ytMode()]; })(window.onServerUp);
  $('#ytGo').onclick = () => ytSearch($('#ytQ').value);
  $('#ytQ').addEventListener('keydown', e => { if (e.key === 'Enter') ytSearch($('#ytQ').value); });
  $('#ytNowToggle').onclick = ytToggle; $('#ytPlayBtn').onclick = ytToggle;
  $('#ytNowNext').onclick = ytNext; $('#ytNextBtn').onclick = ytNext;
  $('#ytPrevBtn').onclick = () => ytCmd('seekTo', [0, true]);
  $('#ytNowTitle').onclick = () => ytOpen(true);
  const vol = $('#ytVol'); vol.value = S.ytVol; vol.oninput = () => { S.ytVol = +vol.value; save(); ytCmd('setVolume', [S.ytVol]); };
  const ytTab = t => { $('#ytResults').hidden = t !== 'res'; $('#ytQueue').hidden = t !== 'q'; $('#ytMine').hidden = t !== 'mine'; $('#ytHist').hidden = t !== 'hist'; ['Res', 'Q', 'Mine', 'Hist'].forEach(k => $('#ytTab' + k).classList.toggle('on', t === k.toLowerCase())); if (t === 'mine') renderYtMine(); if (t === 'hist') renderYtHistory(); };
  $('#ytTabRes').onclick = () => ytTab('res'); $('#ytTabQ').onclick = () => ytTab('q'); $('#ytTabMine').onclick = () => ytTab('mine'); $('#ytTabHist').onclick = () => ytTab('hist');
  if (S.ytLastResults && S.ytLastResults.length) { ytLastResults = S.ytLastResults; renderYtResults(); if (S.ytLastQuery) $('#ytQ').value = S.ytLastQuery; }
  ytaLinkFinish();
  // 드래그 이동
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = f.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; head.setPointerCapture(e.pointerId);
    f.style.right = 'auto'; f.style.bottom = 'auto';
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return;
    // 창 밖으로 끌고 나가면 헤더(유일한 손잡이)까지 사라져 되돌릴 수가 없다 → 안쪽으로 제한
    const w = f.offsetWidth || 380, h = f.offsetHeight || 200;
    f.style.left = Math.max(4, Math.min(innerWidth - w - 4, e.clientX - drag.dx)) + 'px';
    f.style.top = Math.max(4, Math.min(innerHeight - h - 4, e.clientY - drag.dy)) + 'px';
  });
  head.addEventListener('pointerup', () => { if (!drag) return; drag = null; const r = f.getBoundingClientRect(); S.ytPos = { x: r.left, y: r.top }; save(); });
  /* 오른쪽 아래 모서리로 크기 조절.
     최소 크기를 두는 이유: 더 작아지면 헤더의 버튼들과 손잡이가 겹쳐 되돌릴 수가 없다. */
  const grip = $('#ytGrip');
  if (grip) {
    let rz = null;
    grip.addEventListener('pointerdown', e => {
      const r = f.getBoundingClientRect();
      rz = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top };
      grip.setPointerCapture(e.pointerId);
      f.classList.add('sized');
      f.style.right = 'auto'; f.style.bottom = 'auto';
      f.style.left = r.left + 'px'; f.style.top = r.top + 'px';
      e.preventDefault();
    });
    grip.addEventListener('pointermove', e => {
      if (!rz) return;
      /* 크기는 화면 크기까지만 제한하고, 자리는 그에 맞춰 밀어 넣는다.
         "지금 위치에서 오른쪽 끝까지" 로 제한하면, 창이 오른쪽 아래 구석에 붙어 있는
         기본 상태에서 늘릴 공간이 12px 뿐이라 손잡이가 안 듣는 것처럼 보인다.
         이제 오른쪽으로 끌면 왼쪽 모서리가 밀리면서 실제로 커진다. */
      const w = Math.max(240, Math.min(rz.w + (e.clientX - rz.x), innerWidth - 16));
      const h = Math.max(120, Math.min(rz.h + (e.clientY - rz.y), innerHeight - 16));
      f.style.width = w + 'px';
      f.style.height = h + 'px';
      f.style.left = Math.max(8, Math.min(rz.left, innerWidth - w - 8)) + 'px';
      f.style.top = Math.max(8, Math.min(rz.top, innerHeight - h - 8)) + 'px';
    });
    grip.addEventListener('pointerup', () => {
      if (!rz) return;
      rz = null;
      const r = f.getBoundingClientRect();
      S.ytDim = { w: Math.round(r.width), h: Math.round(r.height) };
      S.ytPos = { x: r.left, y: r.top };
      save();
    });
    // 더블클릭 = 원래 크기로. 실수로 이상하게 만들었을 때 되돌릴 길이 있어야 한다.
    grip.addEventListener('dblclick', () => { S.ytDim = null; save(); ytApplyDim(); toast('창 크기를 원래대로 되돌렸습니다'); });
  }
  window.addEventListener('message', e => {
    if (typeof e.data !== 'string' || !e.origin.includes('youtube')) return;
    try {
      const d = JSON.parse(e.data);
      if (d.event === 'onStateChange') {
        if (d.info === 0 && (S.ytQueue.length || S.ytAutoRelated !== false)) ytNext();
        else if (d.info === 1) { YT.playing = true; ytSetPlayIcon(true); YT._embedTry = 0; YT._embedList = null;
          /* 직접 재생은 onplaying 에서 하던 일을 임베드에도 똑같이 — 한 곡이라도 제대로 나왔으면
             연속 실패 카운터를 0 으로 돌리고 예약된 자동 넘김을 끈다. 예전엔 이게 없어서
             하루 동안 띄엄띄엄 3곡만 실패해도 그 뒤로 자동 넘김이 영영 멈췄다. */
          YT._failRun = 0; YT._goneRun = 0; clearTimeout(YT._skipT);
          const er = $('#ytErr'); if (er) er.hidden = true; }
        else if (d.info === 2) { YT.playing = false; ytSetPlayIcon(false); }
      }
      if (d.event === 'onError') ytEmbedError(d.info);
      if (d.event === 'infoDelivery' && d.info && d.info.videoData && d.info.videoData.title) { $('#ytNowTitle').textContent = d.info.videoData.title; $('#ytHeadTitle').textContent = d.info.videoData.title; }
      if (d.event === 'infoDelivery' && d.info && typeof d.info.volume === 'number' && !YT.direct) { // 임베드 플레이어 안에서 바꾼 볼륨도 앱 설정에 반영
        const pct = Math.round(d.info.volume); if (Math.abs((S.ytVol == null ? 60 : S.ytVol) - pct) >= 1) { S.ytVol = pct; const sl = $('#ytVol'); if (sl) sl.value = pct; save(); }
        if (typeof d.info.muted === 'boolean' && S.ytMuted !== d.info.muted) { S.ytMuted = d.info.muted; save(); }
      }
    } catch (x) {}
  });
  renderYtQueue(); ytApplyPos(); syncYtUI();
  if (S.ytOpen || new URLSearchParams(location.search).get('yt')) ytOpen(true);
  // 직접 재생 엔진이 있으면 탭/팝업 모드로 남아 있던 예전 설정을 직접 재생으로 되돌림 (한 번)
  const fixMode = () => {
    if (R.srvInfo && R.srvInfo.ytEngine && !S.ytDirectMigrated) { S.ytDirectMigrated = true; if (S.ytUsePop || S.ytMode === 'tab' || S.ytMode === 'popup' || !S.ytMode) setYtMode('direct'); save(); }
    // 예전에 켜 둔 '오디오만'이 남아 직접 재생에서 화면이 안 나오던 문제 → 한 번만 영상+오디오로 되돌린다
    if (!S.ytVideoMigrated) {
      S.ytVideoMigrated = true;
      if (S.ytAudioOnly) { S.ytAudioOnly = false; toast('🎬 직접 재생을 영상+오디오로 되돌렸습니다 (🎧 버튼으로 다시 오디오만 선택 가능)'); }
      save();
      if (YT.direct && YT.cur) ytPlayDirect(YT.cur);
    }
    ytPaintAudioBtn();
    const lab = $('#ytUsePop') && $('#ytUsePop').closest('label'); if (lab) lab.hidden = !!(R.srvInfo && R.srvInfo.ytEngine);
  };
  window.onServerUp = (orig => () => { if (orig) orig(); fixMode(); })(window.onServerUp);
  if (R.srvOk) fixMode();
}

/* ─────────────── 이미지 툴 ─────────────── */
function baseModelOf(m) { return m ? m.replace(/-inpainting$/, '') : S.model; }
/* 그림 기록 → 그 그림을 만든 조건 (변형이 쓴다 — NAI generateVariations 는 그림 자신의 모델·설정·프롬프트로 다시 그린다).
   글은 무작위 값 이어 쓰기·인핸스 덧붙이기 전의 원래 글(meta.pre)이 있으면 그것을 쓴다(NAI 가 그림에 남기는 글과 같다).
   설정 칸은 baseParams 로 넘겨 buildPayload 가 덮는다. 바이브·정밀 레퍼런스는 NAI 처럼 지금 화면 것을 쓴다(noVibe 없음). */
function ovFromMeta(meta) {
  const p = (meta && meta.parameters) || {}, pre = (meta && meta.pre) || {};
  const chars = (p.characterPrompts || []).map((c, i) => {
    const o = (pre.chars && pre.chars[i]) || {};
    return { prompt: o.prompt != null ? o.prompt : c.prompt, uc: o.uc != null ? o.uc : c.uc, x: p.use_coords ? c.center.x : null, y: p.use_coords ? c.center.y : null };
  });
  const ov = { noQuality: true, chars, model: MODELS[baseModelOf(meta && meta.model)] ? baseModelOf(meta.model) : S.model, n: 1, style: null, baseParams: p, useCoords: !!p.use_coords };
  if (pre.input != null) ov.prompt = pre.input; else if (meta && meta.input != null) ov.prompt = meta.input;
  if (pre.uc != null) ov.uc = pre.uc; else if (p.negative_prompt != null) ov.uc = p.negative_prompt;
  return ov;
}
/* 인핸스 배율 목록 — NAI 인핸스 창(빌드 78a367e)과 같다:
   832×1216·1216×832 는 [1.5, 1], 그 밖은 [2, 1.5, 1] 가운데 넓이×배율² ≤ 3145728 이고 가로·세로×배율이 64 의 배수인 것.
   V5(maxEnhance)는 넓이가 2516582.4 미만이면 맨 앞에 «Max»(같은 크기 + upscaled_enhance). NAI 는 처음에 목록의 첫째를 고른다. */
function enhanceOptions(it, model) {
  const w = it.w | 0, h = it.h | 0;
  let opts = ((w === 832 && h === 1216) || (w === 1216 && h === 832)) ? [1.5, 1]
    : [2, 1.5, 1].filter(e => w * e * h * e <= SD_MAX_AREA && (w * e) % 64 === 0 && (h * e) % 64 === 0);
  if (capsOf(model).maxEnhance && w * h > 0 && w * h < MAX_ENHANCE_AREA) opts = ['max', ...opts];
  return opts;
}
const enhLabel = v => (v === 'max' ? 'Max' : v + '×');
/* ── 인핸스 창 (NAI BG, 빌드 78a367e) ──
   ✨ 단추를 누르면 그림 아래에 뜨고, 떠 있는 동안 생성 단추가 «✨ 인핸스!»(그 요금)로 바뀐다(NAI EnhanceVisible).
   · 배율: 그 그림에서 쓸 수 있는 것만 작은 것부터(1×·1.5×·2×·Max). 그림 넓이마다 마지막으로 고른 배율을 기억한다
     (S.enhSizeCache — NAI 「image-enhance-size-cache」). 기억이 없으면 목록의 첫째(NAI 처음 값).
   · 세기: Magnitude 1~5(NAI EffectMagnitudes .2/0 · .4/0 · .5/0 · .6/0 · .7/.1). «고급 보기»면 세기·노이즈를 직접(S.enhAdvanced — NAI 「enhancedSettings」).
     Magnitude 눈금은 NAI 처럼 켤 때마다 2 에서 시작하고, 쓰는 세기·노이즈는 저장된 값(S.enhStr·S.enhNoise)이다 — 10-17 결정(저장된 값을 그대로 쓴다). */
const EFFECT_MAG = [{ s: 0.2, n: 0 }, { s: 0.4, n: 0 }, { s: 0.5, n: 0 }, { s: 0.6, n: 0 }, { s: 0.7, n: 0.1 }];
function enhPick(it) {   // NAI: 기억한 배율이 'max' 면 Max 가 있을 때만, 숫자면 그대로, 없으면 목록의 첫째
  const opts = enhanceOptions(it, S.model), c = (S.enhSizeCache || {})[it.w * it.h];
  if (c === 'max' && opts.includes('max')) return 'max';
  if (c != null) { const v = parseFloat(c); if (!isNaN(v)) return v; }
  return opts[0];
}
/* NAI maxEnhanceTargetSize — «Max» 의 요금을 셀 때 쓰는 크기 (서버가 키워 돌려주는 크기) */
function maxEnhanceTargetSize(w, h) {
  const t = 2, r = 8 * t, n = Math.floor(w / r) * r * t, i = Math.floor(h / r) * r * t, o = Math.min(1, Math.sqrt(3145728 / (n * i)));
  let l = 32 * Math.round(n * o / 32), s = 32 * Math.round(i * o / 32);
  if (l * s > 3145728) { l = 32 * Math.floor(n * o / 32); s = 32 * Math.floor(i * o / 32); }
  return { width: Math.max(32, l), height: Math.max(32, s) };
}
/* 생성 단추 요금 — 인핸스 창이 떠 있으면 인핸스 요청 크기·세기로 (NAI enhancePrice) */
function enhCostParams() {
  const it = curItem(); if (!R.enhOpen || !it) return null;
  const sc = enhPick(it); if (sc == null) return null;
  const sz = sc === 'max' ? maxEnhanceTargetSize(it.w, it.h) : { width: Math.floor(it.w * sc), height: Math.floor(it.h * sc) };
  return { width: sz.width, height: sz.height, batch: 1, strength: S.enhStr };
}
function enhPanelToggle(force) {
  R.enhOpen = force != null ? !!force : !R.enhOpen;
  if (R.enhOpen && !curItem()) { R.enhOpen = false; toast('인핸스할 그림이 없습니다', 'err'); }
  enhPanelRender(); if (typeof setAutoUI === 'function') setAutoUI(!!R.auto.on); refreshCost();
}
function enhPanelRender() {
  const box = $('#enhPanel'); if (!box) return;
  const it = curItem();
  $('#tEnhance') && $('#tEnhance').classList.toggle('on', !!R.enhOpen);
  if (!R.enhOpen || !it) { box.hidden = true; return; }
  const opts = enhanceOptions(it, S.model), sel = enhPick(it), adv = !!S.enhAdvanced, mag = R.enhMag || 2;
  const radio = [...opts].reverse().map(v => `<button class="btn xs${v === sel ? ' primary' : ''}" data-sc="${v}" title="${v === 'max' ? '같은 크기로 보내고 서버가 키웁니다 (V5)' : v + '배로 키워 다시 그립니다'}">${v === 'max' ? 'Max ✨' : v + 'x'}</button>`).join('');
  box.innerHTML = `<div class="enh-h"><b>✨ 인핸스</b><span class="hint">${it.w}×${it.h}</span><button class="ic" id="enhX" title="닫기">✕</button></div>
    <div class="enh-b"><div class="enh-c"><span class="hint">배율</span><div class="row">${radio || '<span class="hint">쓸 수 있는 배율 없음</span>'}</div></div>
    <div class="enh-c" style="flex:1">${adv
      ? `<label class="rng">세기 <output>${S.enhStr}</output><input type="range" id="enhPStr" min="0.01" max="0.99" step="0.01" value="${S.enhStr}"></label><label class="rng">노이즈 <output>${S.enhNoise}</output><input type="range" id="enhPNoise" min="0" max="0.99" step="0.01" value="${S.enhNoise}"></label>`
      : `<label class="rng">Magnitude <output>${mag}</output><input type="range" id="enhPMag" min="1" max="5" step="1" value="${mag}"></label>`}
      <button class="btn xs" id="enhAdv" style="align-self:flex-start">${adv ? '고급 숨기기' : '고급 보기'}</button></div></div>
    <div class="hint">생성 단추가 «✨ 인핸스!» 로 바뀌었습니다 — 눌러서 시작합니다</div>`;
  box.hidden = false;
  box.querySelector('#enhX').onclick = () => enhPanelToggle(false);
  box.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => {
    const v = b.dataset.sc === 'max' ? 'max' : parseFloat(b.dataset.sc);
    S.enhSizeCache = Object.assign({}, S.enhSizeCache, { [it.w * it.h]: v }); save(); enhPanelRender(); refreshCost();
  });
  const sync = () => { if (typeof syncUI === 'function') syncUI(); refreshCost(); };
  if (adv) {
    box.querySelector('#enhPStr').oninput = e => { S.enhStr = +e.target.value; e.target.previousElementSibling.textContent = S.enhStr; save(); sync(); };
    box.querySelector('#enhPNoise').oninput = e => { S.enhNoise = +e.target.value; e.target.previousElementSibling.textContent = S.enhNoise; save(); sync(); };
  } else box.querySelector('#enhPMag').oninput = e => {
    R.enhMag = +e.target.value; const m = EFFECT_MAG[R.enhMag - 1]; S.enhStr = m.s; S.enhNoise = m.n; e.target.previousElementSibling.textContent = R.enhMag; save(); sync();
  };
  box.querySelector('#enhAdv').onclick = () => { S.enhAdvanced = !S.enhAdvanced; save(); enhPanelRender(); };
}
/* NAI generateEnhance 그대로 (빌드 78a367e):
   · 무엇으로 그리나 = **지금 화면**의 모델·설정·프롬프트·네거티브·캐릭터·바이브·정밀 레퍼런스 (그림에 적힌 설정이 아니다)
   · Max 면 같은 크기 + upscaled_enhance, 아니면 floor(가로×배율)·floor(세로×배율)(뒤에서 64 배수로)
   · 시드는 새로 뽑고 장수 1, V4.5·V5 는 Max 가 아니면 프롬프트 덧붙이기(buildPayload 의 enhanceAdd)
   · 프롬프트의 무작위 묶음(«||가|나||»)은 그 그림(인핸스·인페인트로 나온 그림이면 그 원본)에 적힌 실제 값으로 바꿔 넣고,
     결과 그림에 그 원본 값을 기억시킨다(NAI promptRandomizerOriginImage)
   12.11 까지는 그림에 적힌 설정·모델로, 바이브 없이, 배율 1·1.5 만, 설정 시드로 그렸다. */
async function toolEnhance() {
  const it = curItem(); if (!it) return;
  const ov = { model: S.model };
  const opts = enhanceOptions(it, ov.model);
  if (!opts.length) { toast(`이 그림 크기(${it.w}×${it.h})로는 쓸 수 있는 인핸스 배율이 없습니다 (NAI 도 고를 수 없게 막습니다)`, 'err'); return; }
  const sc = enhPick(it);
  const max = sc === 'max';
  const w = max ? it.w : Math.floor(it.w * sc), h = max ? it.h : Math.floor(it.h * sc);
  const randFrom = await randInfoOf((it.vars && it.vars[0] && it.vars[0].blob) || it.blob, it.meta);
  // orig: 결과에 기억시킬 원본(NAI originalImage = 고른 변형) — 결과 아래 «✦ 원본» 단추로 비교한다
  await doGenerate({ image: it.blob, orig: it.blob, strength: S.enhStr, noise: S.enhNoise, w, h, n: 1, seed: randSeed(), upscaledEnhance: max, enhanceAdd: !max, randFrom, randKeep: true }, `인핸스 ${enhLabel(sc)}`).catch(() => {});
}
/* 변형 — NAI generateVariations (빌드 78a367e):
   · 그림 자신의 모델(절약 모드 포함)·설정·프롬프트·네거티브·캐릭터로 다시 그린다 (ovFromMeta)
   · 바이브·정밀 레퍼런스는 지금 화면에 붙은 것을 같이 보낸다
   · 무작위 묶음은 이 그림 자신의 실제 값으로 (NAI 는 변형 때 원본 표시를 따라가지 않는다)
   · 장수 min(3, 이 크기 상한) · 새 시드 · 그림 크기 · 세기·노이즈 0.8·0.1(NAI 고정값과 같은 처음 값)
   12.12 까지는 설정 칸을 지금 화면에서 가져오고 바이브·레퍼런스를 뺐다. */
async function toolVary() {
  const it = curItem(); if (!it) return;
  const w = snap64(it.w), h = snap64(it.h);
  const randFrom = await randInfoOf((it.vars && it.vars[0] && it.vars[0].blob) || it.blob, null);
  // varOrigOf: NAI 처럼 원본을 «ORIGINAL» 로 결과 묶음 맨 앞에 같이 넣는다 (대조표 A25)
  await doGenerate({ ...ovFromMeta(it.meta), randFrom, image: it.blob, strength: S.varStr, noise: S.varNoise, w, h, n: Math.min(3, batchMax(w, h)), seed: randSeed(), varOrigOf: it }, '변형').catch(() => {});
}
/* ── 업스케일 (NAI 현재 방식) ────────────────────────────────────────────
   NAI 가 업스케일을 바꿨다. 예전: api.novelai.net/ai/upscale {image,width,height,scale:2|4}
   지금: image.novelai.net/ai/upscale {image, model:'nai-diffusion-5-curated', declared_blur_sigma:0}
   — V5 모델로 다시 그리는 방식이고 **2배 고정**이다(번들 44868: gb·Kx·aS=2, class tK).
   옛 주소는 없어져 404 "Cannot POST /ai/upscale" 를 준다(2026-09-18 확인). 12.8 까지 우리 업스케일은
   그 옛 주소로 보내고 있어서 누르면 늘 실패했다.
   요금과 한도는 부르는 곳마다 다르다 (빌드 b50892a):
     · 생성 결과 아래 업스케일(actions.upscale): checkUpscalePrice — 넓이 ≤1048576 → 1 · ≤1747627 → 2 · ≤2446678 → 3 · ≤3145728 → 4,
       그보다 크면 막고 «Image is larger than 1536x2048.». Opus 여도 이 값을 그대로 보여 준다.
     · 이미지 툴 화면(우리 스마트 툴)의 업스케일: 넓이가 1048576 을 넘으면 막고, 그 안이면 Opus 무료 표시(imageIsOpusFree, 배경 제거만 빼고).
   12.16 까지는 결과 아래 업스케일도 1024×1024 를 넘으면 막아서, NAI 에서는 되는 1536×1024 같은 그림을 못 키웠다. */
const UPSCALE_MODEL = 'nai-diffusion-5-curated';
const UPSCALE_X = 2;
const UPSCALE_TABLE = [[1048576, 1], [1747627, 2], [2446678, 3], [3145728, 4]];
function upscaleCost(w, h, from, isOpus) {
  const px = w * h;
  if (!px) return null;
  if (from === 'tool') return px > 1048576 ? null : (isOpus ? 0 : 1);
  for (const [a, c] of UPSCALE_TABLE) if (px <= a) return c;
  return null;
}
function upscaleCostLabel(w, h, from) {
  const c = upscaleCost(w, h, from, !!R.isOpus);   // Opus 판정은 app.js refreshAnlas 한 곳에서만 (tier>=3 && 구독 활성)
  if (c == null) return from === 'tool' ? '1024×1024 이하만 가능' : '1536×2048 보다 크면 안 됨';
  return c === 0 ? 'Opus 무료' : '◈ ' + c;
}
function toolUpscale() {   // 2배 고정이라 고를 것이 없다 — 바로 실행 (NAI 웹도 한 번 누르면 바로 돈다)
  const it = curItem(); if (!it) return;
  runUpscale(it, 'result');
}
/* NAI actions.upscale: 단추에 요금(1~4)을 보이고, 1536×2048 보다 큰 그림이면 막고 «Image is larger than 1536x2048.» 을 띄운다 */
function paintUpscaleBtn(it) {
  const b = $('#tUpscale'); if (!b) return;
  const c = it && it.w ? upscaleCost(it.w, it.h, 'result', false) : null;
  b.disabled = !!it && c == null;
  b.title = !it ? '업스케일 2× — V5 로 다시 그려 확대'
    : (c == null ? `1536×2048 보다 큰 그림이라 업스케일할 수 없습니다 (지금 ${it.w}×${it.h}, NAI 와 같음)` : `업스케일 2× — V5 로 다시 그려 확대 (◈ ${c})`);
}
/* 진행·완료 표시. 메인 화면의 #genStatus 는 스마트 툴 탭에서는 숨겨져 있어
   툴을 돌려도 화면상 아무 일도 안 일어난 것처럼 보였다 → 스마트 툴 쪽에도 같이 쓴다. */
function setGenStatus(t) {
  const a = $('#genStatus'); if (a) a.textContent = t;
  const b = $('#stCost'); if (b && S.mode === 'tools') b.textContent = t;
}
async function runUpscale(it, from) {
  from = from === 'tool' ? 'tool' : 'result';
  // 실행 시점에 다시 검사 — 누르는 사이 생성이 시작됐을 수 있다 (runDirector 와 동일)
  if (R.gen) { toast('이미 작업 중'); return; }
  if (!it || !it.blob) { toast('업스케일할 이미지가 없습니다', 'err'); return; }
  // 크기 제한은 실행 지점에서 본다 — NAI 가 막는 크기는 보내지 않는다 (위 주석: 결과 아래는 1536×2048, 스마트 툴은 1024×1024)
  if (upscaleCost(it.w, it.h, from, false) == null) {
    toast(from === 'tool' ? `스마트 툴의 업스케일은 1024×1024(약 104만 화소) 이하만 됩니다 (지금 ${it.w}×${it.h}) — NAI 이미지 툴과 같은 한도`
                          : `1536×2048 보다 큰 그림은 업스케일할 수 없습니다 (지금 ${it.w}×${it.h}) — NAI 와 같은 한도`, 'err');
    return;
  }
  const tw = it.w * UPSCALE_X, th = it.h * UPSCALE_X;
  R.gen = true; setGenStatus(`업스케일 ${UPSCALE_X}× 중… ${it.w}×${it.h} → ${tw}×${th} (${upscaleCostLabel(it.w, it.h, from)})`); $('#btnGen').disabled = true;
  const gid = 'g' + Date.now().toString(36) + uid();   // 한 번에 받은 결과 묶음 (캔버스 결과 화면)
  // NAI Ex: 캔버스 결과 화면이면 결과 자리(빈 칸 한 장, 2배 크기)를 먼저 놓되 고르지는 않는다(deferFocus) — 다 되면 그 묶음을 고른다
  if (typeof ovwPendingStart === 'function') ovwPendingStart(gid, 1, tw, th, false);
  try {
    const res = await apiFetch('/img/ai/upscale', { method: 'POST', headers: naiReqHeaders(true),
      body: JSON.stringify({ image: await blobToB64(it.blob), model: UPSCALE_MODEL, declared_blur_sigma: 0 }) });
    if (!res.ok) throw await apiError(res);
    const imgs = await respImages(res);
    if (!imgs.length) throw new Error('업스케일 결과에 이미지가 없습니다');
    for (const b of imgs) { const item = await addToHistory(b, it.meta || { parameters: {} }, `업스케일 ${UPSCALE_X}×`, { tool: 'upscale', gid }); if (S.autoSaveOn) autoSave(item); }
    setGenStatus('업스케일 완료'); refreshAnlas().catch(() => {});
  } catch (e) { setGenStatus('오류: ' + e.message); toast(e.message, 'err'); }
  finally { R.gen = false; $('#btnGen').disabled = false; if (typeof ovwPendingEnd === 'function') ovwPendingEnd(); }
}
/* NAI actions.inpaint: 이 그림을 바탕 그림으로 넣고(앞서 칠한 마스크는 그대로) 그림판 마스크 모드를 연다 */
async function toolInpaint() { const it = curItem(); if (!it) return; await cvInpaintItem(it.blob, it.meta); }
/* NAI actions.edit: 이 그림을 그림판에서 고쳐 바탕 그림으로 넣는다 */
async function toolEdit() { const it = curItem(); if (!it) return; await cvEditImage(it.blob, it.meta); }
const DIRECTOR = [
  ['bg-removal', '🪄 배경 제거', '인물만 남기고 배경 투명'], ['lineart', '✒ 선화 추출', '이미지를 선화로'], ['sketch', '✏ 스케치', '연필 스케치 스타일'],
  ['colorize', '🎨 채색', '선화/흑백을 채색 (프롬프트·강도)'], ['emotion', '🙂 감정 변경', '표정 변경 (감정 선택)'], ['declutter', '🧽 정리', '텍스트·잡동사니 제거'],
  ['declutter-keep-bubbles', '💬 정리(말풍선 유지)', '잡동사니만 지우고 말풍선은 남김'],
  ['pixel-snap', '▦ Pixel Snap', 'AI 가 만든 도트 그림을 깔끔하게 다듬습니다 (브라우저에서 처리 · Anlas 안 듦)'],
];
/* NAI 웹 번들(31a484c, chunks/5196)의 감정 enum 전체 24종 — 순서까지 그대로.
   예전엔 19종만 있었고 주석에 '확정 19종' 이라고 적혀 있었다(틀린 주석이었다).
   빠져 있던 것: tired · excited · nervous · thinking · confused */
const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'tired', 'excited',
  'nervous', 'thinking', 'confused', 'shy', 'disgusted', 'smug', 'bored', 'laughing', 'irritated',
  'aroused', 'embarrassed', 'worried', 'love', 'determined', 'hurt', 'playful'];
/* 감정 세기 0~5 의 이름 — NAI imageTools.emotionStrengths (빌드 78a367e) 를 우리말로 (괄호는 NAI 원문) */
const EMO_STRENGTH = ['보통 (Normal)', '조금 약하게 (Slightly Weak)', '약하게 (Weak)', '더 약하게 (Even Weaker)', '아주 약하게 (Very Weak)', '가장 약하게 (Weakest)'];
/* tool 은 반드시 인자로 받는다. 12.8 에서 부르는 쪽 루프 변수(key)를 이 함수 안에서 그냥 썼다가
   ReferenceError 가 나서, 디렉터 툴 창에서 어떤 툴을 눌러도 실행 버튼이 안 떴다(배경 제거·채색 전부 먹통). */
function dtCostLabel(it, tool) {
  const c = typeof directorToolCost === 'function' ? directorToolCost(it.w, it.h, !!R.isOpus, R.opusUsage, tool) : null;
  // 툴은 V5 사용량 한도와 무관하다(NAI 가 V3 기준으로 매김) — 한도를 못 읽었어도 무료는 무료다
  return c == null ? '' : (c === 0 ? 'Opus 무료' : '◈ ' + c + ' 소모');
}
function openDirector() {
  const it = curItem(); if (!it) { toast('먼저 이미지를 선택하세요', 'err'); return; }
  openModal('디렉터 툴 (Anlas 소모 가능)', body => {
    body.innerHTML = `<div class="tool-grid" id="dtGrid"></div><div id="dtOpts"></div>`;
    const grid = body.querySelector('#dtGrid'), opts = body.querySelector('#dtOpts');
    for (const [key, name, desc] of DIRECTOR) {
      const b = document.createElement('button'); b.className = 'btn';
      b.innerHTML = `<b>${name.split(' ')[0]}</b><span>${name.split(' ').slice(1).join(' ')}</span><span class="hint">${desc}</span>`;
      b.onclick = () => {
        [...grid.children].forEach(x => x.classList.toggle('primary', x === b));
        if (key === 'pixel-snap') {   // NAI: 서버에 보내지 않고 브라우저 작업자로 — 요금 없음, 지원하지 않는 브라우저면 안내만
          opts.innerHTML = psSupported() ? `${psOptsHtml()}<div class="row"><button class="btn primary" id="dtRun">실행</button><span class="hint">무료 (브라우저에서 처리)</span></div>`
            : '<div class="hint" style="color:var(--gold)">이 브라우저에서는 Pixel Snap 을 쓸 수 없습니다</div>';
          if (psSupported()) { psBindOpts(opts); opts.querySelector('#dtRun').onclick = async () => { closeModal(); await runPixelSnap({ blob: it.blob, meta: it.meta }, PS.opts); }; }
          return;
        }
        const needPrompt = key === 'colorize' || key === 'emotion';
        opts.innerHTML = `${key === 'emotion' ? `<label class="fld">감정<select id="dtEmo">${EMOTIONS.map(e => `<option>${e}</option>`).join('')}</select></label>` : ''}
          ${needPrompt ? `<label class="fld">추가 프롬프트 (선택)<input type="text" id="dtPrompt" placeholder="예: blue hair, sunset"></label>
          <label class="rng">${key === 'emotion' ? '감정 세기 (Emotion Strength)' : 'Defry (0 = 강함 … 5 = 약함)'} <output id="dtDefryV">${key === 'emotion' ? EMO_STRENGTH[0] : '0'}</output><input type="range" id="dtDefry" min="0" max="5" step="1" value="0"></label>` : ''}
          <div class="row"><button class="btn primary" id="dtRun">실행</button><span class="hint">${dtCostLabel(it, key)}</span></div>`;
        const dr = opts.querySelector('#dtDefry'); if (dr) dr.oninput = () => opts.querySelector('#dtDefryV').textContent = key === 'emotion' ? EMO_STRENGTH[+dr.value] : dr.value;
        opts.querySelector('#dtRun').onclick = async () => {
          const req = { req_type: key, width: it.w, height: it.h, image: await blobToB64(it.blob) };
          if (needPrompt) { req.defry = +opts.querySelector('#dtDefry').value; const pr = opts.querySelector('#dtPrompt').value.trim(); req.prompt = key === 'emotion' ? `${opts.querySelector('#dtEmo').value};;${pr}` : pr; }
          closeModal(); await runDirector(req, name, it);
        };
      };
      grid.appendChild(b);
    }
  });
}
async function runDirector(req, label, srcItem) {
  if (R.gen) { toast('이미 작업 중'); return; }
  R.gen = true; setGenStatus(label + ' 처리 중…'); $('#btnGen').disabled = true;
  try {
    /* 보내기 전 크기 맞추기 — NAI 와 같은 범위(104만~314만 화소)로.
       작으면 키워야 품질이 나오고, 크면 줄여야 서버가 거절하지 않는다.
       원본 blob 이 없으면(예: 이미 base64 만 있는 경로) 건드리지 않는다. */
    /* NAI useDoTool: 크기가 같아도 늘 resizeImageToSize(그림, 가로, 세로)로 다시 그린 PNG 를 보낸다 — 다르면 pica Lanczos3(대조표 B3, 12.23 까지는 캔버스) */
    if (typeof fitForTool === 'function' && srcItem && srcItem.blob && req.width && req.height) {
      const f = fitForTool(req.width, req.height);
      try {
        req.image = await naiResizeImageToSize(new Uint8Array(await srcItem.blob.arrayBuffer()), f.w, f.h);
        if (f.w !== req.width || f.h !== req.height) {
          const was = req.width + '×' + req.height;
          req.width = f.w; req.height = f.h;
          setGenStatus(`${label} — ${was} → ${f.w}×${f.h} 로 맞춰 보냅니다`);
        }
      } catch (e) { logErr('툴 크기 보정 실패(원본 그대로 보냅니다): ' + e.message); }
    }
    // NAI rt.request: { req_type, use_new_shared_trial: true, …나머지 } · 머리글 x-correlation-id·x-initiated-at
    const { req_type: rqt, ...rest } = req;
    const res = await apiFetch('/img/ai/augment-image', { method: 'POST', headers: naiReqHeaders(true), body: JSON.stringify({ req_type: rqt, use_new_shared_trial: true, ...rest }) });
    if (!res.ok) throw await apiError(res);
    /* 결과에 붙일 메타는 '방금 처리한 그 이미지' 것이어야 한다.
       예전엔 curItem() 으로 지금 히스토리에서 선택된 것을 집어와서, 스마트 툴에
       다른 이미지를 올려두면 엉뚱한 이미지의 프롬프트·씬·파일명이 붙었다. */
    const it = srcItem || curItem();
    let last = null;
    /* 배경 제거는 세 장이 온다. NAI 번들(빌드 78a367e) toolVariationNames {"bg-removal":["masked","generated","blend"]} 대로
       ZIP 안 순서가 곧 마스크·생성·혼합이다. NAI 는 이 세 장을 «그림 한 장의 세 변형»으로 넣고, 지금 고른 변형 번호
       (새로 뽑은 뒤면 0 = Masked)로 보여 주며 아래 단추로 바꿔 본다. 12.11 까지는 세 장을 따로 넣고 마지막(Blend)을
       화면·스마트 툴에 올려서, 인물 가장자리가 섞인 Blend 가 먼저 보였다(깨져 보이고 이상하게 지워진다는 보고). */
    const VAR_TAGS = { 'bg-removal': ['masked', 'generated', 'blend'] };
    const tags = VAR_TAGS[req.req_type];
    const imgs = await respImages(res);
    if (tags && imgs.length > 1) {
      const vars = imgs.map((b, i) => ({ blob: b, tag: tags[i] || String(i) }));
      last = await addToHistory(vars[0].blob, (it && it.meta) || { parameters: {} }, label, { vars, tool: req.req_type });
      if (S.autoSaveOn) autoSave(last);
    } else {
      const gid = 'g' + Date.now().toString(36) + uid();   // 한 번에 받은 결과 묶음 (캔버스 결과 화면)
      for (let i = 0; i < imgs.length; i++) {
        const item = await addToHistory(imgs[i], (it && it.meta) || { parameters: {} }, label, { tool: req.req_type, gid });
        last = item; if (S.autoSaveOn) autoSave(item);
      }
    }
    // 스마트 툴 탭에서 돌렸으면 결과를 그 화면에 바로 올려준다 (연달아 툴을 걸 수 있게).
    // 예전엔 히스토리에만 들어가서, 방금 만든 결과가 아니라 원본에 다음 툴이 걸렸다.
    if (last && S.mode === 'tools' && typeof stSet === 'function') stSet(last.blob, last.meta);
    setGenStatus(label + ' 완료'); refreshAnlas().catch(() => {});
  } catch (e) { setGenStatus('오류: ' + e.message); toast(e.message, 'err'); }
  finally { R.gen = false; $('#btnGen').disabled = false; }
}

/* ── NAI Pixel Snap (도트 그림 다듬기, 빌드 b50892a PixelSnapWorkerInterface·isPixelSnapSupported) ──────────────
   NAI 는 이 툴을 서버가 아니라 브라우저 안 작업자(Worker)에서 돌린다(웹GL·웹GPU·WASM 차례로, Anlas 안 듦).
   작업자 파일은 NAI 저작물이라 저장소에 넣지 않고, 서버가 사용자 PC 에서 NAI 공개 사이트 파일을 받아 NAI 와 같은 경로(/_next/static/…)로 내준다.
   작업자 시작 파일에는 서버가 보안 규칙(CSP)을 붙여, 작업자가 그 파일들 말고는 아무 데도(앱 설정·토큰·생성 요청) 닿지 못한다.
   옵션은 NAI 와 같다: 색 줄이기 끔/자동/직접(16~256, 처음 64) · 찾은 도트 크기 그대로 쓰기(maxDetail null) · 원래 크기로 키우기. */
const PS = { worker: null, wait: new Map(), opts: { paletteMode: 'auto', colors: 64, avoidOverRefining: false, upscale: false } };
function psSupported() {   // NAI eM: OffscreenCanvas 2d 가 되어야 한다
  try { return typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1, 1).getContext('2d'); } catch (e) { return false; }
}
async function psWorker() {
  if (PS.worker) return PS.worker;
  const r = await fetch('/nai-pixelsnap', { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok || !j.worker || !Array.isArray(j.chunks) || !j.chunks.length) throw new Error(j.err || ('작업자를 준비하지 못했습니다 (HTTP ' + r.status + ')'));
  if (![j.worker, ...j.chunks].every(u => /^\/_next\/static\/chunks\/[\w-]+\.js$/.test(u))) throw new Error('작업자 파일 주소가 이상합니다');
  // NAI 터보팩 작업자 시작 규칙: #params=[청크 목록(거꾸로), 파일 꼬리, 기준 경로, 배포 번호, 파일 꼬리]
  const params = [j.chunks.slice().reverse(), '', '/_next/', '', ''];
  const w = new Worker(j.worker + '#params=' + encodeURIComponent(JSON.stringify(params)));
  w.addEventListener('message', e => { const d = e.data || {}, p = PS.wait.get(d.id); if (!p) return; PS.wait.delete(d.id); clearTimeout(p.to); d.error ? p.rej(new Error(d.error)) : p.res(d.data); });
  w.addEventListener('messageerror', () => logErr('Pixel Snap 작업자 메시지를 읽지 못함'));
  w.addEventListener('error', e => {
    logErr('Pixel Snap 작업자 오류: ' + (e.message || '알 수 없음'));
    for (const [, p] of PS.wait) { clearTimeout(p.to); p.rej(new Error(e.message || 'Pixel Snap 작업자 오류')); }
    PS.wait.clear(); if (PS.worker === w) PS.worker = null;
    try { w.terminate(); } catch (er) { logErr('작업자 끄기 실패: ' + er.message); }
  });
  PS.worker = w;
  return w;
}
function psRun(buf, opts, ms) {
  return psWorker().then(w => new Promise((res, rej) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    const to = setTimeout(() => { if (PS.wait.delete(id)) rej(new Error('Pixel Snap 이 2분 안에 끝나지 않았습니다')); }, ms || 120000);   // NAI 와 같은 2분
    PS.wait.set(id, { res, rej, to });
    w.postMessage({ task: 'pixelsnap', id, image: buf, opts }, [buf]);
  }));
}
/* NAI 와 같은 옵션 모양: 자동이면 {colors:'auto', autoTol:6.5}, 직접이면 {colors:N}, 끔이면 {colors:0} · 도트 크기 그대로면 maxDetail null */
function psOptsOf(o) {
  return { ...(o.paletteMode === 'auto' ? { colors: 'auto', autoTol: 6.5 } : { colors: o.paletteMode === 'custom' ? +o.colors : 0 }),
    maxDetail: o.avoidOverRefining ? null : undefined, upscale: !!o.upscale };
}
async function runPixelSnap(src, o) {   // src: { blob, meta }
  if (!psSupported()) { toast('이 브라우저에서는 Pixel Snap 을 쓸 수 없습니다', 'err'); return; }
  if (R.gen) { toast('이미 작업 중'); return; }
  R.gen = true; $('#btnGen').disabled = true;
  setGenStatus(PS.worker ? 'Pixel Snap 처리 중… (브라우저에서 처리 · Anlas 안 듦)' : 'NAI 에서 Pixel Snap 작업자를 받는 중… (처음 한 번)');
  try {
    const d = await psRun(await src.blob.arrayBuffer(), psOptsOf(o || PS.opts));
    if (!d || !d.png) throw new Error('결과 그림이 없습니다');
    const blob = new Blob([d.png], { type: 'image/png' });
    const item = await addToHistory(blob, src.meta || { parameters: {} }, 'Pixel Snap', { tool: 'pixel-snap' });
    if (S.autoSaveOn) autoSave(item);
    if (S.mode === 'tools' && typeof stSet === 'function') stSet(item.blob, item.meta);
    setGenStatus(`Pixel Snap 완료 — ${d.Wc}×${d.Hc} 칸${d.paletteSize ? ' · ' + d.paletteSize + '색' : ''}${d.note ? ' · ' + d.note : ''}`);
  } catch (e) { logErr('Pixel Snap: ' + e.message); setGenStatus('오류: ' + e.message); toast('Pixel Snap 을 하지 못했습니다 — ' + e.message, 'err'); }
  finally { R.gen = false; $('#btnGen').disabled = false; }
}
/* Pixel Snap 옵션 칸 (NAI 이미지 툴 화면과 같은 칸·설명) — 디렉터 툴 창과 스마트 툴 카드가 같이 쓴다. 바꾸면 PS.opts 에 둔다(NAI 처럼 켜 둔 동안만). */
function psOptsHtml() {
  const o = PS.opts;
  return `<label class="fld">색 줄이기 (Palettize)<select class="ps-mode"><option value="off"${o.paletteMode === 'off' ? ' selected' : ''}>끔</option><option value="auto"${o.paletteMode === 'auto' ? ' selected' : ''}>자동</option><option value="custom"${o.paletteMode === 'custom' ? ' selected' : ''}>직접</option></select></label>
    <label class="rng ps-colors-row"${o.paletteMode === 'custom' ? '' : ' hidden'}>색 수 <output class="ps-colorsV">${o.colors}</output><input type="range" class="ps-colors" min="16" max="256" step="16" value="${o.colors}"></label>
    <label class="ck"><input type="checkbox" class="ps-avoid"${o.avoidOverRefining ? ' checked' : ''}> 찾은 도트 크기 그대로 쓰기 (Avoid Over-Refining) <span class="hint ps-avoidH"></span></label>
    <label class="ck"><input type="checkbox" class="ps-up"${o.upscale ? ' checked' : ''}> 원래 크기로 키우기 (Upscale) <span class="hint ps-upH"></span></label>`;
}
function psBindOpts(root) {
  const q = s => root.querySelector(s), mode = q('.ps-mode'), cr = q('.ps-colors'), av = q('.ps-avoid'), up = q('.ps-up');
  const paint = () => {
    q('.ps-colors-row').hidden = mode.value !== 'custom'; q('.ps-colorsV').textContent = cr.value;
    q('.ps-avoidH').textContent = av.checked ? '— 찾아낸 도트 크기를 늘 그대로 씁니다' : '— 그림에 더 잘 맞으면 더 작은 도트 크기를 쓸 수도 있습니다';
    q('.ps-upH').textContent = up.checked ? '— 결과를 원래 그림 크기쯤으로 다시 키웁니다' : '— 결과를 찾은 도트 크기 그대로 둡니다';
  };
  const keep = () => { PS.opts = { paletteMode: mode.value, colors: +cr.value, avoidOverRefining: av.checked, upscale: up.checked }; paint(); };
  mode.onchange = keep; cr.oninput = keep; av.onchange = keep; up.onchange = keep;
  paint();
}

/* 메타에서 캐릭터 목록을 꺼낸다. 우리 이미지는 characterPrompts 에, novelai.net PNG 는
   v4_prompt.caption.char_captions (+ v4_negative_prompt 쪽 char_captions) 에 들어 있다.
   예전엔 characterPrompts 만 봐서 novelai.net 에서 받은 그림은 캐릭터가 전부 사라졌다. */
function metaUseCoords(p) { p = p || {}; return !!(p.use_coords != null ? p.use_coords : (p.v4_prompt && p.v4_prompt.use_coords)); }
function metaChars(p) {
  p = p || {};
  const useCoords = metaUseCoords(p);
  const pos = c => (useCoords && c && c.x != null) ? { x: c.x, y: c.y } : { x: null, y: null };
  if (Array.isArray(p.characterPrompts))
    return p.characterPrompts.filter(c => c && (c.enabled === undefined || c.enabled) && (c.prompt || '').length)
      .map(c => ({ prompt: c.prompt || '', uc: c.uc || '', ...pos(c.center) }));
  const cc = (p.v4_prompt && p.v4_prompt.caption && p.v4_prompt.caption.char_captions) || [];
  const nc = (p.v4_negative_prompt && p.v4_negative_prompt.caption && p.v4_negative_prompt.caption.char_captions) || [];
  return cc.map((c, i) => ({ prompt: (c && c.char_caption) || '', uc: (nc[i] && nc[i].char_caption) || '', ...pos(c && c.centers && c.centers[0]) }))
    .filter(c => c.prompt.length > 0);
}
const NO_META_MSG = '생성 정보가 없는 파일입니다 — 텍스트 메타도, 알파 채널에 숨은 메타도 없습니다. 디스코드·카톡·일부 저장 도구를 거치면 지워집니다. novelai.net 에서 직접 받은 원본 PNG 나 이 앱의 히스토리 이미지를 쓰세요';

/* 메타의 최종 프롬프트(서버에 보낸 그대로)에서 앱이 자동으로 붙이는 것 — 품질 태그 · 투명 배경 ·
   V5 'teXt:' 꼬리 — 를 떼어낸 "사용자가 쓴 프롬프트" 와, 그때 켜져 있던 토글을 되짚는다.
   불러오기(applyMeta)와 정보 화면(readImageMeta)이 같이 쓴다. */
function cleanMetaPrompt(p, modelId, rawPrompt) {
  p = p || {};
  const info = MODELS[modelId] || MODELS[S.model]; const caps = capsOf(modelId);
  /* 캐릭터를 먼저 꺼낸다 — 'teXt:' 꼬리를 되돌리려면 캐릭터 프롬프트의 따옴표 글자까지 알아야 한다 */
  const chars = metaChars(p);
  const useCoords = metaUseCoords(p);
  let prompt = String(rawPrompt || '');
  /* ⓪ Furry 모드가 맨 앞에 붙인 'fur dataset, ' — NAI 도 불러올 때 이것부터 떼고 모드를 켠다(없으면 끈다).
     안 떼면 Furry 가 켜진 채로 다시 뽑을 때 두 번 붙는다. */
  const fz = typeof stripFurry === 'function' ? stripFurry(prompt, modelId) : { prompt, furry: null };
  prompt = fz.prompt;
  /* ① V5 가 자동으로 붙인 'teXt: …' 꼬리 — 앱이 생성할 때 다시 붙이므로 떼어낸다 (novelai.net 도 그렇게 한다) */
  /* 'V5 글자 그리기 자동 처리' 를 꺼 뒀다면 생성할 때 다시 붙여 주지 않는다 —
     그때 떼면 그 프롬프트로 다시 뽑을 때 글자가 통째로 사라진다. */
  if (caps.autoText && S.autoText !== false)
    prompt = stripAutoTextV5(prompt, chars.map(c => ({ prompt: c.prompt, enabled: true, center: { x: c.x != null ? c.x : 0.5, y: c.y != null ? c.y : 0.5 } })), useCoords);
  /* ② 품질 태그 — addQualityTag 가 넣은 자리('text:' 앞 · '|' 첫 조각)에서 떼어낸다.
     예전엔 맨 끝(endsWith)만 봐서, 'text:' 가 있거나 teXt: 꼬리가 붙은 그림은 품질 태그가
     프롬프트에 그대로 남고 토글만 꺼졌다 → 다시 생성하면 두 벌로 붙었다.
     서버가 Comment 에 되돌려 준 힌트(tag_hint_qt: 0 없음 · 1 standard · 3 light,
     tag_hint_transparent_background)가 있으면 그 프리셋부터 맞춰 본다 (novelai.net 과 같은 순서). */
  const std = qNorm(info.quality), light = qNorm(info.quality2), cur = qNorm(getQuality(modelId));
  const list = [];
  if (cur && cur !== std && cur !== light) list.push({ q: cur, id: 1, keep: true });   // 직접 고친 품질 문구
  if (std) list.push({ q: std, id: 1 });
  if (light) list.push({ q: light, id: 3 });
  const transp = p.tag_hint_transparent_background === true || p.straight_alpha === true;
  const hint = typeof p.tag_hint_qt === 'number' ? p.tag_hint_qt : null;
  const tv = x => ({ q: x.q ? 'transparent background, ' + x.q : 'transparent background', id: x.id, keep: x.keep, t: true });
  const hinted = hint ? list.find(x => x.id === hint && !x.keep) : null;
  let cands = [];
  if (hint === 0 || (hint != null && !hinted)) cands = transp ? [tv({ q: '', id: 0 })] : [];   // 힌트가 '없음' — 뗄 게 없다
  else {
    if (hinted) cands.push(...(transp ? [tv(hinted)] : []), hinted);
    if (transp) cands.push(...list.map(tv), tv({ q: '', id: 0 }));
    cands.push(...list);
  }
  let hit = null;
  for (const c of cands) { const r = stripQualityTag(prompt, c.q, caps); if (r !== null) { prompt = r; hit = c; break; } }
  return { prompt, chars, useCoords, quality: !!(hit && hit.id), transparent: !!(hit && hit.t), qid: hit ? hit.id : 0, keep: !!(hit && hit.keep), furry: fz.furry, stripped: prompt !== String(rawPrompt || '') };
}
/* 네거티브에서 UC 프리셋 문구를 찾아 떼어낸다 → { uc: 나머지, presetIdx }. 서버 힌트(tag_hint_uc_preset)가 있으면 그것부터. */
function cleanMetaUc(p, modelId, uc) {
  p = p || {}; uc = String(uc || '');
  const info = MODELS[modelId] || MODELS[S.model];
  let presetIdx = -1;
  /* onlyIfEmpty 프리셋(V3 '없음' = lowres)은 사용자 입력이 있으면 안 붙는 값이라, 정확히 그 값일 때만 프리셋으로 본다.
     'lowres, bad hands' 에서 lowres 를 떼면 다시 생성할 때 lowres 가 빠진다. */
  const ucMatch = (u, t) => !!t && (u.onlyIfEmpty ? uc === t : uc.startsWith(t));
  const ucHint = typeof p.tag_hint_uc_preset === 'number' ? p.tag_hint_uc_preset : null;
  const hintIdx = ucHint != null ? info.ucs.findIndex(u => UC_HINT[u.id] === ucHint) : -1;
  if (hintIdx >= 0 && !getUcText(modelId, hintIdx) && !info.ucs[hintIdx].text) presetIdx = hintIdx;   // '없음'
  else if (hintIdx >= 0 && [getUcText(modelId, hintIdx), info.ucs[hintIdx].text].some(t => ucMatch(info.ucs[hintIdx], t))) presetIdx = hintIdx;
  else {
    if (p.ucPreset != null) presetIdx = info.ucs.findIndex(u => u.id === p.ucPreset);
    // 텍스트가 일치하는 프리셋 중 가장 긴 것 (Heavy가 Human Focus의 접두어라서).
    // 프리셋을 편집한 경우도 잡도록 "지금 쓰는 값"을 먼저 보고 내장 텍스트로 폴백한다.
    let byText = -1, bestLen = 0;
    info.ucs.forEach((u, i) => {
      for (const t of [getUcText(modelId, i), u.text]) {
        if (ucMatch(u, t) && t.length > bestLen) { bestLen = t.length; byText = i; break; }
      }
    });
    if (byText >= 0) presetIdx = byText;
  }
  if (presetIdx >= 0) {
    for (const t of [getUcText(modelId, presetIdx), info.ucs[presetIdx].text]) {
      if (ucMatch(info.ucs[presetIdx], t)) { uc = uc.slice(t.length).replace(/^,\s*/, ''); break; }
    }
  }
  else presetIdx = info.ucs.length - 1; // 없음
  return { uc, presetIdx };
}

/* ─────────────── 메타 → 설정 적용 (NAI PNG 재현) ─────────────── */
/* o (가져오기 창에서 고른 것 — NAI doImportSettings 의 importPrompt·importUc·importCharacters·appendCharacters·importSettings·importSeed·
   importVibeTransfer·appendVibeTransfer·cleanBrackets·actualPrompt). o 가 없으면 예전처럼 전부 가져온다(⤴ 단추·히스토리 Ctrl+클릭·설정 창 PNG 드롭).
   NAI 와 같게: 모델은 설정이나 바이브를 가져올 때만 바꾸고, 시드를 안 가져오면 지금 시드를 그대로 둔다. */
const cleanBrackets = s => String(s || '').replace(/[[\]{}]/g, '').replace(/,(?=[^ ])/g, ', ').replace(/ ,/g, ',');
function applyMeta(meta, o) {
  if (!meta) { toast('설정 정보가 없습니다', 'err'); return; }
  let p = meta.parameters || {};
  /* 생성 정보가 없는 이미지(스마트 툴로 올린 외부 PNG, 옛 백업의 빈 메타)에서 ⤴ 를 누르면
     예전엔 빈 값들이 그대로 적용돼 **지금 쓰던 프롬프트·캐릭터·네거티브가 통째로 지워졌다**.
     되돌릴 방법도 없었다 — 아무것도 안 바꾸고 알리기만 한다. */
  const anyPrompt = String(meta.input || (p.v4_prompt && p.v4_prompt.caption && p.v4_prompt.caption.base_caption) || p.prompt || '').trim();
  if (!anyPrompt && p.width == null && p.steps == null && !p.sampler && !p.characterPrompts) {
    toast('이 이미지에는 생성 정보가 없습니다 — 지금 설정은 그대로 둡니다', 'err'); return;
  }
  const want = k => !o || !!o[k];
  let rawInput = meta.input || (p.v4_prompt && p.v4_prompt.caption.base_caption) || '';
  /* 실제 무작위 값으로 (NAI Actual Prompt): 그림에 적힌 actual_prompts 로 프롬프트·네거티브·캐릭터를 쓴다.
     NAI 는 이때 v4 캡션을 {caption} 만으로 갈아 끼워 좌표 사용(use_coords) 값이 비어 «AI 자동 배치»가 된다 — 그대로 따른다. */
  if (o && o.actual && p.actual_prompts) {
    const ap = p.actual_prompts;
    rawInput = (ap.prompt && ap.prompt.base_caption) || rawInput;
    p = { ...p, characterPrompts: undefined, use_coords: undefined, v4_prompt: { caption: { ...(ap.prompt || {}) } }, v4_negative_prompt: { caption: { ...(ap.negative_prompt || {}) } },
      negative_prompt: ap.negative_prompt && ap.negative_prompt.base_caption != null ? ap.negative_prompt.base_caption : p.negative_prompt };
  }
  const m = baseModelOf(meta.model);
  /* hist = 히스토리 Ctrl+클릭(NAI 히스토리 설정 복사): 그림 설정을 통째로 옮기고 시드는 지금 것을 둔다(Ctrl+Shift 면 그림 시드).
     그 밖(가져오기 창·⤴·설정 창 PNG)은 NAI «그림에서 설정 가져오기»(빌드 b50892a)와 같게 한다. */
  const hist = !!(o && o.fromHist);
  const prevModel = S.model, prevP = pickModelParams(S);   // NAI o = 가져오기 전 지금 모델의 설정
  /* 설정·바이브를 가져오면 그림의 모델로 바꾼다. 다른 모델로 가면 NAI 는 그 모델이 기억한 값이 아니라
     기본값(getModelDefaultParams)에서 시작한다 — 지금 모델의 설정은 제 몫으로 넣어 두고 바꾼다. */
  if ((!o || o.settings || o.vibes || hist) && MODELS[m] && m !== S.model) {
    useModelParams(m);
    Object.assign(S, modelParamDefaults(m));
  }
  const info = MODELS[S.model];
  // 품질 태그·네거티브 프리셋을 떼는 기준은 그림을 만든 모델이다 (NAI: Source 의 모델로 찾는다)
  const detModel = MODELS[m] ? m : S.model;
  const cm = cleanMetaPrompt(p, detModel, rawInput);
  const { useCoords } = cm; let prompt = cm.prompt, chars = cm.chars;
  if (o && o.clean) { prompt = cleanBrackets(prompt); chars = chars.map(c => ({ ...c, prompt: cleanBrackets(c.prompt), uc: cleanBrackets(c.uc) })); }
  if (want('settings')) {
    /* NAI 설정 가져오기: 그 모델 기본값 위에 그림 값(settingsImportWhiteList — 스텝·가이던스·샘플러·스케줄·SMEA·디크리스퍼·
       리스케일·크기·Variety+·세기·노이즈)을 얹는다. 목록에 없는 칸은 기본값으로 돌아가되 장수와 바이브 세기 맞추기는 지금 값,
       시드는 «시드»를 같이 고르지 않았으면 비운다(무작위). 히스토리 Ctrl+클릭은 장수까지 그림 값으로 옮긴다. */
    const keepN = S.n, keepVN = S.vibeNormalize;
    Object.assign(S, modelParamDefaults(S.model));
    S.vibeNormalize = keepVN;
    S.n = hist && p.n_samples ? p.n_samples : keepN;
    S.quality = cm.quality;                 // 못 뗐으면 프롬프트에 이미 들어 있는 것 — 토글은 끈다 (두 벌 방지)
    S.transparent = cm.transparent;
  }
  /* Furry 모드 — NAI 와 같다: 접두어 'fur dataset, ' 이 있으면 켜고 없으면 끈다 (Furry 모드가 있는 모델에서만).
     그림에서 가져오기(빌드 b50892a doImportSettings)는 어떤 칸을 고르든 가져온 뒤 모델 기준으로 맞추고, 바뀌면 알린다(modelModeSwitched).
     히스토리 Ctrl+클릭(NAI 히스토리 복사)은 모드를 알리지 않으므로 예전처럼 프롬프트를 가져올 때만 맞춘다. */
  if (hist) { if (want('prompt') && cm.furry != null) S.furryMode = cm.furry; }
  else {
    const fz = stripFurry(rawInput, S.model);
    if (fz.furry != null && !!S.furryMode !== fz.furry) { S.furryMode = fz.furry; toast(fz.furry ? '그림에 맞춰 Furry 모드를 켰습니다' : '그림에 맞춰 Furry 모드를 껐습니다'); }
  }
  /* 이미지에 쓰인 프리셋(standard/light)에 맞춰 준다. 다만 사용자가 **직접 고쳐 둔 문구**는 지우지 않는다 —
     예전엔 이미지를 한 장 불러올 때마다 그 모델의 퀄리티 태그 편집본이 조용히 기본값으로 돌아갔다.
     (그 이미지가 실제로 편집본으로 만들어졌으면 cm.keep 이 서고, 이 분기 자체를 타지 않는다) */
  if (want('settings') && cm.qid && !cm.keep) {
    S.ov = S.ov || {}; const cur = (S.ov[S.model] || {}).q;
    const isCustom = cur != null && qNorm(cur) !== qNorm(info.quality) && qNorm(cur) !== qNorm(info.quality2);
    if (!isCustom) { S.ov[S.model] = S.ov[S.model] || {}; if (cm.qid === 3) S.ov[S.model].q = info.quality2; else delete S.ov[S.model].q; }
    else toast('이 모델의 퀄리티 태그는 직접 고쳐 두신 것이라 그대로 두었습니다');
  }
  if (want('prompt')) { setPromptText(prompt); S.activeStyle = null; S.randomPrompt = ''; }   // NAI: 프롬프트를 가져오면 무작위 프롬프트는 지운다
  let uc = p.negative_prompt != null ? p.negative_prompt : (p.v4_negative_prompt ? p.v4_negative_prompt.caption.base_caption : '');
  /* NAI 웹이 자동으로 붙인 "nsfw, " 는 떼어내고(앱이 같은 규칙으로 다시 붙임),
     사용자가 직접 쓴 경우(프롬프트에 nsfw 있음)는 유지.
     반대쪽도 맞춰야 한다 — 원본 네거티브에 nsfw 가 "없으면" 앱도 붙이면 안 된다.
     예전엔 이 경우 자동붙이기를 그대로 켜 둬서, 노출 있는 그림을 불러오면
     앱은 nsfw 를 네거티브에 넣어 옷 입은 그림을 만들었다. */
  const hadNsfw = /^nsfw(,\s*|$)/i.test(uc);
  const promptHasNsfw = (prompt || '').toLowerCase().includes('nsfw');
  if (hadNsfw && !promptHasNsfw) uc = uc.replace(/^nsfw(,\s*|$)/i, '');
  /* S.autoNsfw 는 이 이미지 하나가 아니라 앱 전체에 남는 설정이다.
     "원본에 nsfw 가 없다" 를 곧바로 "자동 붙이기를 끈다" 로 읽으면 안 된다 —
     Curated 모델이나 UC 프리셋 "없음" 은 애초에 NAI 도 안 붙이기 때문이다.
     그런 이미지를 한 장 불러왔다고 설정이 뒤집히면, 이후 모든 생성이 조용히 달라진다.
     → 앱이 "붙였을 상황" 일 때만 원본과 맞춘다. 판단은 프리셋을 정한 뒤(아래)로 미룬다. */
  const nsfwDecide = () => {
    if (promptHasNsfw) return;                                   // 프롬프트에 있으면 애초에 안 붙는다
    if (NSFW_EXEMPT.includes(S.model)) return;                   // Curated 등 — 원래 대상이 아니다
    if (!getUcText(S.model, ucIdx(S.model))) return;             // UC 프리셋 "없음" — 원래 대상이 아니다
    S.autoNsfw = hadNsfw;
  };
  /* 네거티브 프리셋은 네거티브를 가져올 때뿐 아니라 설정을 가져올 때도 그림의 것으로 바뀐다 (NAI: R.ucPresetId = 찾은 프리셋).
     그림 모델과 지금 모델이 다르면 같은 프리셋(id)을 이 모델 목록에서 찾는다(없으면 첫째). */
  if (want('uc') || want('settings')) {
    const cu = cleanMetaUc(p, detModel, uc);
    let pi = cu.presetIdx;
    if (detModel !== S.model && MODELS[detModel] && MODELS[S.model]) {
      const id = (MODELS[detModel].ucs[pi] || {}).id, j = MODELS[S.model].ucs.findIndex(u => u.id === id);
      pi = j >= 0 ? j : 0;
    }
    S.ucPreset = pi;
    if (want('uc')) {
      uc = cu.uc;
      S.uc = o && o.clean ? cleanBrackets(uc) : uc;
      nsfwDecide();     // 프리셋이 정해진 뒤에 판단한다 (프리셋이 "없음" 이면 건드리지 않는다)
    }
  }
  if (want('settings')) {
    if (p.width) S.w = p.width; if (p.height) S.h = p.height;
    if (p.steps) S.steps = p.steps; if (p.scale != null) S.scale = p.scale;
    if (p.cfg_rescale != null) S.rescale = p.cfg_rescale;
    if (p.sampler) S.sampler = p.sampler; if (p.noise_schedule) S.schedule = p.noise_schedule;
    // NAI 가져오기: 옛 샘플러 nai_smea·nai_smea_dyn 은 Euler Ancestral + SMEA(·DYN)로, DYN 만 켜져 있으면 SMEA 도 켠다
    if (S.sampler === 'nai_smea') { S.sampler = 'k_euler_ancestral'; p = { ...p, sm: true }; }
    else if (S.sampler === 'nai_smea_dyn') { S.sampler = 'k_euler_ancestral'; p = { ...p, sm: true, sm_dyn: true }; }
    if (p.strength != null) S.strength = p.strength;   // 세기·노이즈도 NAI 가져오기 목록에 든다 (그림을 넣어 만든 그림에만 적혀 있다)
    if (p.noise != null) S.noise = p.noise;
    // NAI: V4 묶음 모델에서 노이즈 스케줄 native 는 karras 로 가져온다
    if (S.schedule === 'native' && (MODELS[S.model] || {}).ver >= 40 && (MODELS[S.model] || {}).ver < 50) S.schedule = 'karras';
    /* Variety+ (NAI 가져오기): 그림에 적힌 skip_cfg_above_sigma 를 그 크기의 배율로 나눠 계수로 되돌리고 그대로 둔다.
       이 모델 값(V4.5 58 · 그 밖 19)과 다르면(다른 모델 그림) NAI 처럼 그 값을 쓰고 칸 아래에 경고를 띄운다. */
    S.variety = p.skip_cfg_above_sigma != null && p.skip_cfg_above_sigma !== 0;
    S.varietyCoef = null;
    if (S.variety && p.width && p.height) {
      const coef = p.skip_cfg_above_sigma / Math.sqrt(p.width * p.height / (832 * 1216));
      if (isFinite(coef) && Math.abs(coef - sigmaCoef(S.model)) > 1e-6) S.varietyCoef = coef;
    }
    S.decrisper = !!p.dynamic_thresholding;
    S.smea = !!p.sm || !!p.sm_dyn; S.smeaDyn = !!p.sm_dyn;
    // 네거티브 세기(uncond_scale)는 가져오지 않는다 — NAI 가져오기 목록(settingsImportWhiteList)에 없다 (대조표 A26)
    /* 레거시 프롬프트 컨디셔닝: 히스토리 복사는 그림 값, 가져오기는 NAI 처럼 «가져오기 전 모델이 V4 면 그 모델 값, 아니면 끔» */
    S.legacyUc = hist ? !!p.legacy_uc : (capsOf(prevModel).legacyUcOk ? !!prevP.legacyUc : false);
    S.aiChoice = !useCoords;   // 좌표 사용 여부는 설정에 든다 (NAI use_coords)
    /* V3 SMEA 자동(NAI): 가져오기 전 모델의 «SMEA 자동»을 따르되, 큰 크기인데 SMEA 가 꺼진 그림·작은 크기인데 SMEA 가 켜진 그림이면 끈다
       (그 그림이 SMEA 자동으로 만든 것이 아니라는 뜻이라서다). */
    if (capsOf(S.model).autoSmea) {
      const area = S.w * S.h;
      S.autoSmea = prevP.autoSmea !== false && !(area >= AUTO_SMEA_AREA && !S.smea) && !(area < AUTO_SMEA_AREA && S.smea);
    }
    if (!want('seed')) {
      if (hist) { S.seed = prevP.seed; S.randomSeed = prevP.randomSeed; }   // 히스토리 Ctrl+클릭은 지금 시드를 둔다
      else { S.seed = ''; S.randomSeed = true; }                             // 가져오기는 시드를 비운다(무작위)
    }
  }
  if (want('seed') && p.seed != null) { S.seed = String(p.seed); S.randomSeed = false; }
  if (want('chars')) {
    const got = chars.map(c => ({ prompt: c.prompt, uc: c.uc, x: c.x, y: c.y }));
    /* 캐릭터는 통째로 바꾼다(이어 붙이기를 고르면 뒤에 붙인다) — 예전엔 characterPrompts 가 없으면 이전 캐릭터가 그대로 남았다 */
    let next = o && o.appendChars ? (S.chars || []).concat(got) : got;
    const mx = capsOf(S.model).maxChars || 0;
    if (mx && next.length > mx) { toast(`캐릭터는 최대 ${mx}명이라 ${Math.max(0, mx - (o && o.appendChars ? (S.chars || []).length : 0))}명만 가져왔습니다 (NAI 와 같음)`, 'err'); next = next.slice(0, mx); }
    S.chars = next;
    S.randomChars = null;   // NAI: 캐릭터를 가져오면 무작위 캐릭터는 지운다 (RandomCharacterPrompts → null)
  }
  /* 바이브 (NAI importVibeTransfer): 그림에 든 인코딩(reference_image_multiple)을 인코딩만 있는 바이브로 넣는다 — 인코딩을 쓰는 모델(V4 이상)일 때만 */
  if (o && o.vibes && Array.isArray(p.reference_image_multiple) && p.reference_image_multiple.length && (MODELS[S.model] || {}).ver >= 40) {
    (async () => {
      const st = p.reference_strength_multiple || [], ie = p.reference_information_extracted_multiple || [];
      if (!o.appendVibes && st.length > 1) { const sum = st.reduce((a, b) => a + Math.abs(b), 0); if (sum >= .99 && sum <= 1.01) S.vibeNormalize = true; else if (sum > 1) S.vibeNormalize = false; }
      const d = vibeDefaults(S.model), got = [];
      for (let i = 0; i < p.reference_image_multiple.length; i++) {
        const enc = p.reference_image_multiple[i], id = await sha256Hex(enc);
        got.push({ id, name: `${id.slice(0, 6)}-${id.slice(-6)}`, b64: null, thumb: '', strength: st[i] != null ? st[i] : d.strength, ie: ie[i] != null ? ie[i] : d.ie,
          encs: { [vibeKey(S.model) + '|*']: enc }, enc: null, state: '그림에서 가져온 인코딩', stateCls: 'ok' });
      }
      R.vibes = o.appendVibes ? R.vibes.concat(got.filter(g => !R.vibes.some(v => v.id === g.id))) : got;
      renderVibes(); syncUI();
    })().catch(e => { logErr('그림의 바이브를 가져오지 못함: ' + e.message); toast('그림의 바이브를 가져오지 못했습니다: ' + e.message, 'err'); });
  }
  /* save() 가 아니라 savePrompt(). 불러온 프롬프트가 빈 이미지였을 때 save() 는
     서버의 빈-프롬프트 보호(409)에 걸리고, 그 되돌림이 방금 불러온 설정까지 통째로 지웠다. */
  savePrompt(); syncUI(); renderChars();
  if (o && o.quiet) return;   // 빠른 시작 그림 모음: NAI 처럼 그 그림 위 «가져왔습니다!» 로만 알린다
  if (!o) toast('프롬프트·설정을 불러왔습니다 (시드 고정됨)');
  else {
    const what = [want('prompt') && '프롬프트', want('uc') && '네거티브', want('chars') && '캐릭터', want('settings') && '설정', want('seed') && '시드', o.vibes && '바이브'].filter(Boolean);
    toast((what.length ? what.join('·') : '아무것도') + ' 가져왔습니다');
  }
}
async function importFromPng(blob) {
  const chunks = await pngTextChunks(new Uint8Array(await blob.arrayBuffer()));
  let comment = chunks.find(c => c.key === 'Comment');
  let src = (chunks.find(c => c.key === 'Source') || {}).text || '';
  if (!comment) {   // 텍스트 청크가 지워졌어도 알파 채널에 숨은 메타(stealth)가 남아 있으면 거기서 읽는다
    const st = await readStealthMeta(blob).catch(() => null);
    if (st && st.Comment) { comment = { key: 'Comment', text: String(st.Comment) }; src = String(st.Source || ''); toast('텍스트 메타가 없어 알파 채널에 숨은 메타에서 읽었습니다'); }
  }
  if (!comment) { toast(NO_META_MSG, 'err'); return; }
  let j; try { j = JSON.parse(comment.text); } catch (e) { toast('메타데이터 파싱 실패', 'err'); return; }
  applyMeta({ model: modelFromSource(src), input: j.prompt || (j.v4_prompt && j.v4_prompt.caption.base_caption) || '', parameters: { ...j, negative_prompt: j.uc != null ? j.uc : (j.v4_negative_prompt ? j.v4_negative_prompt.caption.base_caption : '') } });
  closeModal();
}
/* ── 그림 가져오기 창 (NAI «What do you want to do with this image?», 빌드 78a367e G3·ImageGenImportOverlay) ──
   쓰는 곳: i2i(바탕 그림) · 바이브 · 정밀 레퍼런스. 그림에 NAI 설정이 들어 있으면 고른 칸만 가져온다.
   고르기 칸의 처음 값과 기억은 NAI 와 같다: 프롬프트·네거티브·캐릭터 켬 / 이어 붙이기·설정·시드·바이브·괄호 정리·실제 무작위 값 끔 */
const IMPORT_DEF = { prompt: true, uc: true, chars: true, appendChars: false, settings: false, seed: false, vibes: false, appendVibes: false, clean: false, actual: false };
const importOpts = () => ({ ...IMPORT_DEF, ...(S.importOpts || {}) });
const SOURCE_KNOWN = src => /\bV?5\b/i.test(src) || /4\.5/.test(src) || /Diffusion V4/i.test(src) || /furry/i.test(src) || /V3/i.test(src);
async function readImportInfo(blob) {
  const u8 = new Uint8Array(await blob.arrayBuffer());
  const chunks = await pngTextChunks(u8);
  const get = k => (chunks.find(c => c.key === k) || {}).text;
  let comment = get('Comment'), src = get('Source') || '', soft = get('Software') || '';
  if (!comment) {
    const st = await readStealthMeta(blob).catch(e => { logErr('숨은 메타 읽기 실패: ' + e.message); return null; });
    if (st && st.Comment) { comment = String(st.Comment); src = String(st.Source || ''); soft = String(st.Software || ''); }
  }
  return importInfoOf(comment, src, soft);
}
/* 그림 기록 글(Comment·Source·Software) → 가져오기 정보. 그림 파일에서도, 빠른 시작 그림의 기록 묶음(NAI metadataBundle)에서도 쓴다. */
function importInfoOf(comment, src, soft) {
  src = String(src || ''); soft = String(soft || '');
  if (!comment) return null;
  let j; try { j = JSON.parse(comment); } catch (e) { logErr('그림 메타 해석 실패: ' + e.message); return null; }
  // NAI: Software 에 «NovelAI» 가 있고, 디렉터 툴 결과(req_type)가 아니어야 설정을 가져올 수 있다
  const isNai = /NovelAI/.test(soft) && j.req_type === undefined;
  let notRepro = null;
  if (j.request_type === 'Img2ImgRequest') notRepro = 'i2i';
  else if (j.request_type === 'NativeInfillingRequest') notRepro = '인페인트';
  else if (Array.isArray(j.reference_strength_multiple) && j.reference_strength_multiple.length && !(Array.isArray(j.reference_image_multiple) && j.reference_image_multiple.length)) notRepro = '바이브(인코딩이 들어 있지 않음)';
  else if (Array.isArray(j.director_reference_strengths) && j.director_reference_strengths.length) notRepro = '정밀 레퍼런스';
  const meta = { model: modelFromSource(src), input: j.prompt || (j.v4_prompt && j.v4_prompt.caption.base_caption) || '',
    parameters: { ...j, negative_prompt: j.uc != null ? j.uc : (j.v4_negative_prompt ? j.v4_negative_prompt.caption.base_caption : '') } };
  return { meta, isNai, notRepro, deprecated: !!src && !SOURCE_KNOWN(src),
    hasVibes: Array.isArray(j.reference_image_multiple) && j.reference_image_multiple.length > 0, hasActual: !!j.actual_prompts };
}
async function openImportDialog(file) {
  if (!file) return;
  const info = await readImportInfo(file).catch(e => { logErr('가져오기 정보 읽기 실패: ' + e.message); return null; });
  const url = URL.createObjectURL(file);
  openModal('이 그림으로 무엇을 할까요?', body => {
    const o = importOpts();
    const ck = (k, label, extra) => `<label class="ck${extra && extra.sub ? ' sub' : ''}"${extra && extra.title ? ` title="${extra.title}"` : ''}><input type="checkbox" data-k="${k}"${o[k] ? ' checked' : ''}> ${label}</label>`;
    const metaHtml = info && info.isNai ? `
      <div class="imp-meta">
        <div class="mtitle">이 그림에는 설정이 들어 있습니다! 대신 설정을 가져올까요?</div>
        ${info.notRepro ? `<div class="hint imp-warn">⚠ 이 그림은 ${info.notRepro}로 만든 것이라 설정만으로는 똑같이 다시 만들 수 없습니다 (NAI 와 같은 안내)</div>` : ''}
        <div class="imp-grid">
          <div class="imp-col">
            ${ck('prompt', '프롬프트')}${ck('uc', '네거티브')}${ck('chars', '캐릭터')}${ck('appendChars', '이어 붙이기', { sub: 1, title: '지금 캐릭터 뒤에 붙입니다 (끄면 바꿉니다)' })}
            ${info.hasVibes ? ck('vibes', '바이브') + ck('appendVibes', '이어 붙이기', { sub: 1, title: '지금 바이브 뒤에 붙입니다 (끄면 바꿉니다)' }) : ''}
            ${info.deprecated ? '<div class="hint imp-warn">옛 모델로 만든 그림이라 설정은 가져올 수 없습니다 (NAI 와 같음)</div>' : ck('settings', '설정') + ck('seed', '시드')}
          </div>
          <div class="imp-col">
            <button class="btn primary" data-a="meta">설정 가져오기</button>
            ${ck('clean', '괄호 정리', { title: '[ ] { } 를 지우고 쉼표 뒤에 빈칸을 넣습니다 (NAI Clean Imports)' })}
            ${info.hasActual ? ck('actual', '실제 무작위 값', { title: '프롬프트·네거티브를 무작위 묶음에서 실제로 뽑힌 값으로 가져옵니다 (NAI Actual Prompt)' }) : ''}
          </div>
        </div>
      </div>` : '';
    body.innerHTML = `<div class="imp-prev"><img src="${url}" alt=""></div>
      <div class="row imp-use"><button class="btn" data-a="i2i">🖼 i2i (바탕 그림)</button><button class="btn" data-a="vibe">🎨 바이브</button><button class="btn" data-a="pref">🪞 정밀 레퍼런스</button></div>${metaHtml}`;
    const paint = () => {
      const cur = importOpts();
      const ac = body.querySelector('[data-k="appendChars"]'); if (ac) ac.disabled = !cur.chars;
      const av = body.querySelector('[data-k="appendVibes"]'); if (av) av.disabled = !cur.vibes;
    };
    body.querySelectorAll('input[data-k]').forEach(i => { i.onchange = () => { S.importOpts = { ...importOpts(), [i.dataset.k]: i.checked }; save(); paint(); }; });
    paint();
    const done = () => closeModal();
    body.querySelector('[data-a="i2i"]').onclick = () => { setI2I(file, null, true); switchRefTab('i2i'); toast('바탕 그림으로 넣었습니다'); done(); };
    body.querySelector('[data-a="vibe"]').onclick = () => { done(); addVibe(file).catch(e => { logErr('바이브 넣기 실패: ' + e.message); toast('바이브를 넣지 못했습니다: ' + e.message, 'err'); }); };
    body.querySelector('[data-a="pref"]').onclick = () => { done(); addPref(file, { filename: file.name || 'reference.png' }).catch(e => { logErr('레퍼런스 넣기 실패: ' + e.message); toast('레퍼런스를 넣지 못했습니다: ' + e.message, 'err'); }); };
    const mb = body.querySelector('[data-a="meta"]');
    if (mb) mb.onclick = () => {
      const cur = importOpts();
      const sel = { ...cur, settings: !info.deprecated && cur.settings, seed: !info.deprecated && cur.seed, vibes: info.hasVibes && cur.vibes, actual: info.hasActual && cur.actual };
      done(); applyMeta(info.meta, sel);
    };
  }, false, () => URL.revokeObjectURL(url));
}
/* 여러 장 (NAI onFilesImport): 바이브가 이미 있으면 모두 바이브로, 정밀 레퍼런스가 있으면 모두 레퍼런스로, 둘 다 없으면 묻는다 */
function importManyImages(files) {
  if (!files.length) return;
  if (R.vibes.length) { importVibeFiles(files); return; }
  if (R.prefs.length) { (async () => { for (const f of files) await addPref(f, { filename: f.name, quiet: true }); renderPrefs(); switchRefTab('pref'); })().catch(e => { logErr('레퍼런스 여러 장 넣기 실패: ' + e.message); toast('레퍼런스를 넣지 못했습니다: ' + e.message, 'err'); }); return; }
  openModal(`그림 ${files.length}장 가져오기`, body => {
    body.innerHTML = `<div class="hint">이 그림들로 무엇을 할까요?</div><div class="row imp-use"><button class="btn" data-a="vibe">🎨 바이브</button><button class="btn" data-a="pref">🪞 정밀 레퍼런스</button></div>`;
    body.querySelector('[data-a="vibe"]').onclick = () => { closeModal(); importVibeFiles(files); };
    body.querySelector('[data-a="pref"]').onclick = () => { closeModal(); (async () => { for (const f of files) await addPref(f, { filename: f.name, quiet: true }); renderPrefs(); switchRefTab('pref'); })().catch(e => { logErr('레퍼런스 여러 장 넣기 실패: ' + e.message); toast('레퍼런스를 넣지 못했습니다: ' + e.message, 'err'); }); };
  });
}
/* 화면 아무 데나 끌어다 놓기 (NAI ImageGenImportOverlay): 메인 화면에서 파일이나 히스토리 그림을 끌고 오면 안내 덮개를 띄우고,
   각 칸(바탕 그림·바이브·레퍼런스·설정 창 드롭) 밖에 놓으면 가져오기 창을 연다. 각 칸에 놓는 것은 지금처럼 그 칸이 받는다. */
function initImportOverlay() {
  const ov = document.createElement('div'); ov.id = 'importOverlay'; ov.className = 'import-overlay'; ov.hidden = true;
  ov.innerHTML = '<div class="io-box"><div class="io-ico">⬆</div><div>여기에 놓으면 가져오기 창이 열립니다</div><div class="hint">바탕 그림·바이브·레퍼런스 칸에 놓으면 그 칸에 바로 들어갑니다</div></div>';
  document.body.appendChild(ov);
  const usable = e => S.mode === 'main' && $('#modalOverlay').hidden && !R.cvOpen && e.dataTransfer &&
    [...(e.dataTransfer.types || [])].some(t => t === 'Files' || t === 'text/nai-hist');
  document.addEventListener('dragover', e => {
    if (!usable(e)) { ov.hidden = true; return; }
    ov.hidden = !!(e.target.closest && e.target.closest('[data-dropzone]'));
  });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) ov.hidden = true; });
  document.addEventListener('dragend', () => { ov.hidden = true; });
  document.addEventListener('drop', async e => {
    ov.hidden = true;
    if (!usable(e) || (e.target.closest && e.target.closest('[data-dropzone]'))) return;
    e.preventDefault();
    const hid = e.dataTransfer.getData('text/nai-hist');
    if (hid) { const it = R.hist.find(h => String(h.id != null ? h.id : h.t) === hid); if (it) openImportDialog(new File([it.blob], (it.name || 'image.png'), { type: it.blob.type || 'image/png' })); return; }
    const fs = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/') || /\.(naiv4vibe|naiv4vibebundle|json)$/i.test(f.name));
    if (!fs.length) return;
    if (fs.some(f => /\.(naiv4vibe|naiv4vibebundle|json)$/i.test(f.name))) { importVibeFiles(fs); return; }
    if (fs.length > 1) importManyImages(fs); else openImportDialog(fs[0]);
  });
}
/* ── NAI 빠른 시작 그림 모음 (Quick Start Gallery, 빌드 b50892a FI·FP·Fj·Fb) ────────────────────────────
   보고 있는 그림이 없으면 큰 그림 자리에 NAI 빠른 시작 그림을 NAI 와 같은 차례(빌드 해시를 씨앗으로 섞은 차례, 6의 배수만큼)로 펼친다.
   그림을 누르면 그 그림의 프롬프트·네거티브·캐릭터·설정·바이브를 가져오고 시드는 두지 않는다(NAI 와 같음), 그림 위에 2초 동안 «가져왔습니다!».
   그림 번호·그림마다 붙은 생성 기록은 서버가 사용자 PC 에서 NAI 웹앱 스크립트로 뽑아 준다(/nai-quickstart — 이 저장소에는 넣지 않는다).
   그림 파일은 NAI 와 같은 주소(static.novelai.net)에서 바로 열고, NAI 처럼 화면 가까이 올 때만 작은 그림(1000px 앞)·큰 그림(100px 앞)을 받는다.
   ⚙ «빠른 시작 그림 모음 숨기기»(NAI hideQuickstartGallery)를 켜면 보이지 않는다. 위 줄 «🖼 빠른 시작»은 보던 그림을 닫고 이 모음을 연다(NAI 메뉴). */
const QS = { data: null, err: '', loading: null, built: '', io: [] };
function cyrb53a(str, seed = 0) {   // NAI gg 그대로 (빌드 해시 → 53비트 수)
  let t = 0xdeadbeef ^ seed, i = 0x41c6ce57 ^ seed;
  for (let g = 0, e; g < str.length; g++) { e = str.charCodeAt(g); t = Math.imul(t ^ e, 0x85ebca77); i = Math.imul(i ^ e, 0xc2b2ae3d); }
  t ^= Math.imul(t ^ (i >>> 15), 0x735a2d97); i ^= Math.imul(i ^ (t >>> 15), 0xcaf649a9); t ^= i >>> 16; i ^= t >>> 16;
  return 2097152 * (i >>> 0) + (t >>> 11);
}
class QsSeededRandom {   // NAI SeededRandom 그대로 (Lehmer — 첫 곱은 53비트를 넘으므로 NAI 처럼 실수 곱 그대로 둔다)
  constructor(s) { this.seed = s; }
  next() { this.seed = 48271 * this.seed % 0x7fffffff; return this.seed / 0x7fffffff; }
}
function qsOrder(d) {
  const rnd = new QsSeededRandom(cyrb53a(String(d.commit || ''))), ks = d.ids.map(() => rnd.next());
  const name = n => String(n).padStart(4, '0');
  return d.ids.map((n, k) => ({ file: name(n) + d.ext, src: d.base + name(n) + d.ext, tiny: d.base + name(n) + d.tiny, random: ks[k] }))
    .sort((a, b) => a.random - b.random).slice(0, 6 * Math.floor(d.ids.length / 6));
}
function qsValid(d) {
  return d && Array.isArray(d.ids) && d.ids.length > 0 && d.ids.every(n => Number.isInteger(n) && n >= 0 && n < 100000)
    && d.meta && typeof d.meta === 'object' && typeof d.commit === 'string' && d.commit.length > 0
    && /^https:\/\/static\.novelai\.net\/quickstart\/[\w./-]+\/$/.test(d.base || '') && /^\.\w+$/.test(d.ext || '') && /^_tiny\.\w+$/.test(d.tiny || '');
}
function qsLoad(force) {
  if (QS.loading) return QS.loading;
  QS.loading = (async () => {
    try {
      const r = await fetch('/nai-quickstart' + (force ? '?force=1' : ''), { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok || !j.data) throw new Error(j.err || ('HTTP ' + r.status));
      if (!qsValid(j.data)) throw new Error('받은 그림 목록의 모양이 이상합니다');
      if (j.data.orderOk === false) logErr('NAI 빠른 시작 그림 차례를 정하는 코드가 바뀌었습니다 — 차례가 NAI 와 다를 수 있습니다 (빌드 ' + (j.data.build || '?') + ')');
      QS.data = j.data; QS.err = '';
    } catch (e) { QS.err = e.message; logErr('빠른 시작 그림 모음을 불러오지 못함: ' + e.message); }
    finally { QS.loading = null; }
  })();
  return QS.loading;
}
/* 보일 때: 메인 화면 · 숨기기 꺼짐 · 보고 있는 그림 없음 · 생성 중(미리보기 자리)이 아님 — NAI H1 과 같은 조건(캐릭터 위치 판은 우리 앱에선 창이라 가리지 않는다) */
function qsWanted() {
  const pv = $('#previewImg');
  return S.mode === 'main' && !S.hideQuickstart && !curItem() && !R.gen && !(pv && !pv.hidden);
}
function qsSync() {
  const btn = $('#btnQuickstart'); if (btn) btn.hidden = !!S.hideQuickstart || S.mode !== 'main';
  let el = $('#qsGallery');
  if (!qsWanted()) { if (el) el.hidden = true; return; }
  if (!el) {
    const st = $('#vstage'); if (!st) return;
    el = document.createElement('div'); el.id = 'qsGallery'; el.className = 'qs-gallery';
    st.appendChild(el);
  }
  el.hidden = false;
  if (QS.data) { if (QS.built !== QS.data.commit + '|' + QS.data.build) qsRender(el); return; }
  qsRenderStatus(el);
  if (!QS.err) qsLoad(false).then(() => { if (!el.hidden) { if (QS.data) qsRender(el); else qsRenderStatus(el); } });
}
function qsRenderStatus(el) {
  QS.built = ''; QS.io.forEach(o => o.disconnect()); QS.io = [];
  el.innerHTML = '';
  const box = document.createElement('div'); box.className = 'qs-status';
  const msg = document.createElement('div');
  if (QS.err) {
    msg.textContent = 'NAI 빠른 시작 그림 모음을 불러오지 못했습니다: ' + QS.err;
    const again = document.createElement('button'); again.className = 'btn sm'; again.textContent = '다시 받기';
    again.onclick = () => { QS.err = ''; qsRenderStatus(el); qsLoad(true).then(() => { if (!el.hidden) { if (QS.data) qsRender(el); else qsRenderStatus(el); } }); };
    box.append(msg, again);
  } else { msg.textContent = 'NAI 에서 빠른 시작 그림 모음을 받는 중입니다… (처음 한 번은 10초쯤 걸립니다)'; box.appendChild(msg); }
  el.appendChild(box);
}
function qsRender(el) {
  const d = QS.data; QS.io.forEach(o => o.disconnect()); QS.io = [];
  el.innerHTML = '';
  const sc = document.createElement('div'); sc.className = 'qs-scroll';
  sc.innerHTML = '<div class="qs-gap-top"></div><div class="qs-deco" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>'
    + '<div class="qs-title">시작하기</div><div class="qs-sub">빠른 시작 그림 모음에서 아이디어를 얻어 보세요!</div>'
    + '<div class="qs-sub qs-sub2">그림을 누르면 그 그림의 프롬프트와 설정을 가져옵니다.</div><div class="qs-gap"></div>';
  const grid = document.createElement('div'); grid.className = 'qs-grid';
  // NAI Fb: 스크롤 칸 기준으로 아래 1000px 안에 오면 작은 그림(흐리게), 100px 안에 오면 큰 그림을 받는다
  const ioFull = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; ioFull.unobserve(e.target); const im = e.target.querySelector('.qs-full'); if (im && !im.src) im.src = im.dataset.src; }), { root: sc, rootMargin: '0px 0px 100px 0px', threshold: .1 });
  const ioTiny = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; ioTiny.unobserve(e.target); const im = e.target.querySelector('.qs-tiny'); if (im && !im.src) { im.src = im.dataset.src; im.hidden = false; e.target.querySelector('.qs-blur').hidden = false; } }), { root: sc, rootMargin: '0px 0px 1000px 0px', threshold: .1 });
  QS.io = [ioFull, ioTiny];
  const cells = [];
  for (const it of qsOrder(d)) {
    const cell = document.createElement('div'); cell.className = 'qs-cell';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'qs-btn';
    const tiny = document.createElement('img'); tiny.className = 'qs-tiny'; tiny.alt = ''; tiny.hidden = true; tiny.dataset.src = it.tiny; tiny.width = 832; tiny.height = 1216;
    const blur = document.createElement('span'); blur.className = 'qs-blur'; blur.hidden = true;
    const full = document.createElement('img'); full.className = 'qs-full'; full.alt = ''; full.dataset.src = it.src; full.width = 832; full.height = 1216; full.decoding = 'async';
    full.onerror = () => logErr('빠른 시작 그림을 받지 못함: ' + it.file);
    const cp = document.createElement('span'); cp.className = 'qs-copied'; cp.textContent = '가져왔습니다!';
    b.append(tiny, blur, full, cp);
    b.onclick = () => qsPick(cell, it.file);
    cell.appendChild(b); grid.appendChild(cell); cells.push(cell);
  }
  sc.appendChild(grid);
  const fade = document.createElement('div'); fade.className = 'qs-fade';
  el.append(sc, fade);
  cells.forEach(c => { ioFull.observe(c); ioTiny.observe(c); });   // 화면에 붙인 뒤에 지켜본다 (스크롤 칸 안에 있어야 셈이 맞다)
  QS.built = d.commit + '|' + d.build;
}
function qsPick(cell, file) {
  const b = QS.data && QS.data.meta ? QS.data.meta[file] : null;
  // NAI Fj: 기록 묶음으로 doImportSettings(설정·프롬프트·네거티브·캐릭터·바이브, 시드 빼고). 기록이 없으면 NAI 처럼 실패 알림만 뜬다
  const info = b ? importInfoOf(b.Comment, b.Source, b.Software) : null;
  if (!b) toast('그림에서 설정을 가져오지 못했습니다 — 그림 기록이 없습니다', 'err');
  else if (!info) toast('그림에서 설정을 가져오지 못했습니다 — 기록을 읽지 못했습니다', 'err');
  else applyMeta(info.meta, { prompt: true, uc: true, chars: true, settings: true, seed: false, vibes: true, quiet: true });
  const cp = cell.querySelector('.qs-copied');
  if (cp) { cp.classList.add('on'); clearTimeout(cp._t); cp._t = setTimeout(() => cp.classList.remove('on'), 2000); }
}
/* NAI 메뉴 «Quick Start Gallery»: 보던 그림을 닫는다(고른 그림 없음) → 큰 그림 자리에 빠른 시작 그림 모음이 뜬다 */
function openQuickstart() {
  if (S.hideQuickstart) return;
  if (S.mode !== 'main') setMode('main');
  R.cur = -1; clearViewer(); histMarkCur(-1);
  qsSync();
}
/* PNG 의 Source 문자열 → 모델 id.
   Source 에는 "curated" 라는 단어가 안 들어간다. 실제 형식은
   "NovelAI Diffusion V5 DB276663" 처럼 모델 이름 + 8자리 해시다.
   그래서 /curated/ 로 가르던 예전 코드는 Curated 분기가 통째로 죽어 있었고,
   Curated 로 뽑은 그림을 불러오면 전부 Full 로 잡혔다.
   NAI 웹과 같게 해시로 가른다 — 목록에 있는 것만 Full, 나머지는 Curated. */
function modelFromSource(src) {
  src = String(src || '');
  const FULL_HASH = {
    5: /\b(657484A5|0ADF9AB7)\b/i,
    45: /\b(4BDE2A90|1229B44F|B9F340FD|F3D95188)\b/i,
    40: /\b(37442FCA|4F49EC75|CA4B7203|79F47848|F6302A9D)\b/i,
  };
  // V5 Full 「절약」(Medium) — NAI 번들 출처 판별과 같은 표식 (2026-10 빌드: 93F4BD30 · 70AB5786)
  const MEDIUM_HASH = /\b(93F4BD30|70AB5786)\b/i;
  // V5 를 먼저 본다 — "V4.5" 검사보다 앞서야 한다 (둘 다 걸리는 문자열이 오는 경우가 있다)
  if (/\bV?5\b/i.test(src) && !/4\.5/.test(src)) return MEDIUM_HASH.test(src) ? 'nai-diffusion-5-full-medium'
    : FULL_HASH[5].test(src) ? 'nai-diffusion-5-full' : 'nai-diffusion-5-curated';
  if (/4\.5/.test(src)) return FULL_HASH[45].test(src) ? 'nai-diffusion-4-5-full' : 'nai-diffusion-4-5-curated';
  if (/Diffusion V4/i.test(src)) return FULL_HASH[40].test(src) ? 'nai-diffusion-4-full' : 'nai-diffusion-4-curated-preview';
  if (/furry/i.test(src)) return 'nai-diffusion-furry-3';
  if (/V3/i.test(src)) return 'nai-diffusion-3';
  return S.model;
}
/* ── 그림 정보 보기 (NAI «Image Inspector», 빌드 b50892a inspect 묶음) ─────────────────────────
   NAI 와 같은 순서: 그림 · 제목(Title) · 설명(Description) · 소프트웨어(Software) · 출처(Source + 모델 이름 + NAI 서명이 맞으면 ✓)
   · 요청 종류(텍스트로 그림·그림으로 그림·인페인트 + 바이브·그림에 넣은 바이브·정밀 레퍼런스) · «간단히 / 원본 매개변수»(마지막으로 본 쪽 기억).
   글 묶음이 지워진 그림은 투명도에 숨은 기록(stealth)에서 읽는다. 다른 그림을 열거나, 창에 끌어 놓거나, 붙여 넣어도 본다(NAI 와 같음).
   서명 확인도 NAI 와 같다: Comment 의 signed_hash 를 떼어 낸 글 + 그림 RGB(또는 투명도 맨 끝 비트를 지운 RGBA)를 NAI 공개 키로 Ed25519 확인. */
const NAI_SIGN_KEY = 'Y2JcQAOhLwzwSDUJPNgL04nS0Tbqm7cSRc4xk0vRMic=';
/* 8비트·인터레이스 없는 PNG(회색·회색+투명·RGB·RGBA)를 캔버스 없이 그대로 푼다. 캔버스는 반투명한 점의 색을 바꿀 수 있어 서명 확인에 쓸 수 없다. */
async function pngRgbaExact(u8) {
  if (!(u8 && u8.length > 33 && PNG_SIG.every((b, i) => u8[i] === b)) || typeof DecompressionStream !== 'function') return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0; const idat = [];
  while (p + 8 <= u8.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]), d0 = p + 8;
    if (type === 'IHDR') { w = dv.getUint32(d0); h = dv.getUint32(d0 + 4); depth = u8[d0 + 8]; ctype = u8[d0 + 9]; inter = u8[d0 + 12]; }
    else if (type === 'IDAT') idat.push(u8.subarray(d0, d0 + len));
    else if (type === 'IEND') break;
    p = d0 + len + 4;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (depth !== 8 || inter !== 0 || !ch || !w || !h || !idat.length) return null;
  const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const stride = w * ch; if (raw.length < h * (stride + 1)) return null;
  const out = new Uint8ClampedArray(w * h * 4); let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (ch === 4) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3]; }
      else if (ch === 3) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255; }
      else if (ch === 2) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1]; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
    }
    const t = prev; prev = cur; cur = t;
  }
  return { width: w, height: h, data: out };
}
async function canvasRgba(blob) {
  const img = await blobToImage(blob);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, c.width, c.height);
}
async function ed25519Verify(pubB64, sigB64, msg) {
  try {
    const key = await crypto.subtle.importKey('raw', b64ToU8(pubB64), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, b64ToU8(sigB64), msg);
  } catch (e) { return null; }   // 이 브라우저가 Ed25519 를 모르면 null — 그때는 ✓ 를 띄우지 않는다
}
/* NAI x(그림, Comment): 'valid' · 'invalid' · 'no_signature' · 'unsupported'  (pub: 시험 때만 다른 공개 키를 넣는다) */
async function naiSignCheck(blob, comment, pub) {
  const u8 = new Uint8Array(await blob.arrayBuffer());
  const isPng = PNG_SIG.every((b, i) => u8[i] === b), isWebp = u8.length > 12 && String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) === 'WEBP';
  if (!isPng && !isWebp) return 'unsupported';
  let t = String(comment || '');
  try { const j = JSON.parse(t); if (j && typeof j.Comment === 'string') t = j.Comment; } catch (e) { return 'no_signature'; }
  const m = t.match(/"signed_hash": "([^"]*)"/); if (!m) return 'no_signature';
  let stripped = t.replace(', ' + m[0], ''); if (stripped === t) stripped = t.replace(m[0] + ', ', ''); if (stripped === t) stripped = t.replace(m[0], '');
  const img = (isPng ? await pngRgbaExact(u8).catch(() => null) : null) || await canvasRgba(blob).catch(() => null);
  if (!img) return 'invalid';
  const tail = new TextEncoder().encode(stripped), n = img.width * img.height, d = img.data;
  const rgb = new Uint8Array(3 * n + tail.length);
  for (let i = 0; i < n; i++) { rgb[3 * i] = d[4 * i]; rgb[3 * i + 1] = d[4 * i + 1]; rgb[3 * i + 2] = d[4 * i + 2]; }
  rgb.set(tail, 3 * n);
  const rgba = new Uint8Array(4 * n + tail.length); rgba.set(d.subarray(0, 4 * n));
  for (let i = 3; i < 4 * n; i += 4) rgba[i] &= 254;
  rgba.set(tail, 4 * n);
  for (const msg of [rgb, rgba]) { const ok = await ed25519Verify(pub || NAI_SIGN_KEY, m[1], msg); if (ok === null) return 'unsupported'; if (ok) return 'valid'; }
  return 'invalid';
}
/* 그림 파일에서 NAI 가 읽는 기록(Title·Description·Software·Source·Comment·Generation time)을 꺼낸다 — 글 묶음이 없으면 숨은 기록에서 */
async function inspectMetaOf(blob) {
  const chunks = await pngTextChunks(new Uint8Array(await blob.arrayBuffer())).catch(() => []);
  const X = {}; for (const c of chunks) if (X[c.key] === undefined) X[c.key] = c.text;
  let viaStealth = false;
  if (X.Comment === undefined) {
    const st = await readStealthMeta(blob).catch(() => null);
    if (st && typeof st === 'object') { for (const k of Object.keys(st)) if (X[k] === undefined) X[k] = typeof st[k] === 'string' ? st[k] : JSON.stringify(st[k]); viaStealth = true; }
  }
  return { X, chunks, viaStealth };
}
const INSPECT_REQ = { 0: '알 수 없는 요청', PromptGenerateRequest: '텍스트로 그림 생성', Img2ImgRequest: '그림으로 그림 생성', NativeInfillingRequest: '인페인트' };
async function openMetaViewer(blob, title) {
  openModal(title || '그림 정보', body => {
    body.innerHTML = `<div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sm" id="insOpen" title="다른 그림 파일을 열어 정보를 봅니다 (이 창에 그림을 끌어 놓거나 붙여 넣어도 됩니다)">다른 그림 열기</button></div><div id="insBody"></div>`;
    const box = body.querySelector('#insBody');
    const show = async b => {
      box.innerHTML = '<div class="hint">읽는 중…</div>';
      let url = null;
      try {
        const { X, chunks, viaStealth } = await inspectMetaOf(b);
        url = URL.createObjectURL(b);
        box.innerHTML = '';
        const pic = document.createElement('div'); pic.className = 'ins-pic'; pic.style.backgroundImage = `url(${url})`; box.appendChild(pic);
        const line = (k, v, cls) => { const d = document.createElement('div'); d.className = 'ins-line' + (cls ? ' ' + cls : ''); const b1 = document.createElement('b'); b1.textContent = k + ': '; d.appendChild(b1); const s = document.createElement('span'); s.textContent = v; d.appendChild(s); box.appendChild(d); return s; };
        if (X.Comment === undefined) { const d = document.createElement('div'); d.className = 'hint'; d.style.textAlign = 'center'; d.textContent = '이 그림에는 생성 기록이 없습니다.'; box.appendChild(d); }
        else {
          let V = null; try { V = JSON.parse(X.Comment); } catch (e) { V = null; }
          if (X.Title !== undefined) line('제목', X.Title);
          if (X.Description !== undefined) line('설명', X.Description);
          if (X.Software !== undefined) line('소프트웨어', X.Software);
          if (X.Source !== undefined) {
            const mid = typeof modelFromSource === 'function' ? modelFromSource(X.Source) : '';
            const s = line('출처', X.Source + (MODELS[mid] ? ` (${MODELS[mid].name})` : ''));
            naiSignCheck(b, X.Comment).then(r => { if (r === 'valid') { const ok = document.createElement('span'); ok.className = 'ins-ok'; ok.textContent = ' ✓'; ok.title = 'NAI 서명이 맞습니다 — NovelAI 에서 만든 그대로인 그림입니다'; s.appendChild(ok); } }).catch(e => logErr('서명 확인 실패: ' + e.message));
          }
          if (V) {
            const rt = INSPECT_REQ[V.request_type != null ? V.request_type : 0] || String(V.request_type);
            const extra = [];
            if (V.controlnet_model) extra.push('controlnet: ' + V.controlnet_model);
            if ((Array.isArray(V.reference_strength_multiple) && V.reference_strength_multiple.length) || (V.reference_strength || 0) > 0)
              extra.push('바이브' + (Array.isArray(V.reference_image_multiple) && V.reference_image_multiple.length ? ', 그림에 넣은 바이브' : ''));
            if (Array.isArray(V.director_reference_strengths) && V.director_reference_strengths.length) extra.push('정밀 레퍼런스');
            line('요청 종류', rt + extra.map(x => ` (${x})`).join(''));
            const tabs = document.createElement('div'); tabs.className = 'seg ins-tabs'; tabs.innerHTML = '<button data-v="0">간단히</button><button data-v="1">원본 매개변수</button>'; box.appendChild(tabs);
            const area = document.createElement('div'); area.className = 'ins-area'; box.appendChild(area);
            let raw = false; try { raw = localStorage.getItem('inspect-viewraw') === '1'; } catch (e) { logErr('정보 보기 방식 읽기 실패(간단히로 봅니다): ' + e.message); }
            const paint = () => {
              tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', (x.dataset.v === '1') === raw));
              area.innerHTML = '';
              if (raw) { const pre = document.createElement('pre'); pre.textContent = JSON.stringify(V, null, 4); area.appendChild(pre); return; }
              const row = (k, v) => { if (v === undefined || v === null) return; const d = document.createElement('div'); d.className = 'ins-line'; const b1 = document.createElement('b'); b1.textContent = k + ': '; d.appendChild(b1); const s = document.createElement('span'); s.className = 'ins-val'; s.textContent = String(v); d.appendChild(s); area.appendChild(d); };
              row('프롬프트', V.prompt); row('네거티브', V.uc);
              const cc = (V.v4_prompt && V.v4_prompt.caption && V.v4_prompt.caption.char_captions) || [];
              const nc = (V.v4_negative_prompt && V.v4_negative_prompt.caption && V.v4_negative_prompt.caption.char_captions) || [];
              cc.forEach((c, i) => { row(`캐릭터 ${i + 1} 프롬프트`, c && c.char_caption); row(`캐릭터 ${i + 1} 네거티브`, nc[i] ? nc[i].char_caption : ''); });
              if (V.width !== undefined && V.height !== undefined) row('크기', `${V.width}x${V.height}`);
              row('시드', V.seed); row('스텝', V.steps);
              if (V.sampler !== undefined) row('샘플러', `${V.sampler} ${V.noise_schedule ? '(' + V.noise_schedule + ')' : ''} ${V.sm_dyn ? '[SMEA+DYN]' : V.sm ? '[SMEA]' : ''}`.trim());
              row('프롬프트 가이던스', V.scale); row('가이던스 리스케일', V.cfg_rescale); row('네거티브 세기', V.uncond_scale);
            };
            tabs.querySelectorAll('button').forEach(x => x.onclick = () => { raw = x.dataset.v === '1'; try { localStorage.setItem('inspect-viewraw', raw ? '1' : '0'); } catch (e) { logErr('정보 보기 방식 기억 실패: ' + e.message); } paint(); });
            paint();
          }
        }
        // 우리 앱에만 있는 것: 숨은 기록이 있는지(🧹 제거 저장이 지운다)와 글 묶음 원문
        const st = await blobHasStealth(b).catch(() => false);
        const sd = document.createElement('div'); sd.className = 'hint'; sd.style.marginTop = '10px';
        sd.innerHTML = (viaStealth ? '글 묶음이 지워져 있어 투명도에 숨은 기록에서 읽었습니다. ' : '') + (st ? '🕵 투명도에 숨은 기록(stealth) <b>있음</b> — 🧹 제거 저장을 쓰면 함께 지워집니다' : '숨은(stealth) 기록 없음');
        box.appendChild(sd);
        if (chunks.length) {
          const det = document.createElement('details'); det.className = 'sub'; det.innerHTML = `<summary>PNG 글 묶음 ${chunks.length}개 원문</summary>`;
          for (const c of chunks) { const h = document.createElement('div'); h.className = 'mtitle'; h.textContent = c.key; det.appendChild(h); const pre = document.createElement('pre'); let txt = c.text; if (c.key === 'Comment') { try { txt = JSON.stringify(JSON.parse(c.text), null, 2); } catch (e) { txt = c.text; /* JSON 이 아니면 원문 그대로 보인다 */ } } pre.textContent = txt; det.appendChild(pre); }
          box.appendChild(det);
        }
      } catch (e) { box.innerHTML = ''; const d = document.createElement('div'); d.className = 'hint'; d.textContent = '그림을 읽지 못했습니다: ' + e.message; box.appendChild(d); }
      finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 60000); }
    };
    body.querySelector('#insOpen').onclick = () => pickFiles(false, f => show(f), 'image/*');
    body.addEventListener('dragover', e => { e.preventDefault(); });
    body.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); e.stopPropagation(); show(f); } });
    body.addEventListener('paste', e => { const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); show(it.getAsFile()); } });
    body.tabIndex = -1;
    if (blob) show(blob); else box.innerHTML = '<div class="hint" style="text-align:center;margin-top:40px">«다른 그림 열기»를 누르거나 이 창에 그림을 끌어 놓으면 생성 기록을 보여 줍니다.</div>';
  }, true);
}


/* ─────────────── 이미지 메타 보기 / 가져다 쓰기 ─────────────── */

/* 파일(PNG)이든 히스토리 항목이든 같은 모양으로 꺼낸다.
   NAI PNG 는 Comment 청크에 JSON 이 들어 있고, 우리가 만든 이미지는 it.meta 에 있다. */
async function readImageMeta(src) {
  const out = { prompt: '', uc: '', rawPrompt: '', rawUc: '', chars: [], params: {}, model: '', modelId: '', source: '', hasMeta: false, item: null, viaStealth: false, stripped: false };
  /* 보여주고 넣는 값은 "사용자가 쓴 것" — 품질 태그·teXt: 꼬리·UC 프리셋은 앱이 생성할 때 다시 붙이므로 뺀다.
     예전엔 서버에 보낸 최종 문자열을 그대로 넣어서, 다시 생성하면 품질 태그가 두 벌로 붙었다. 원문은 rawPrompt 에. */
  const clean = (p, modelId) => {
    out.rawPrompt = out.prompt; out.rawUc = out.uc;
    /* 자동으로 붙은 "nsfw, " 는 프리셋 문구 앞에 오므로 먼저 떼야 프리셋이 맞는다 (applyMeta 와 같은 순서) */
    const cm = cleanMetaPrompt(p, modelId, out.prompt), cu = cleanMetaUc(p, modelId, String(out.uc || '').replace(/^nsfw(,\s*|$)/i, ''));
    /* 'fur dataset, ' 은 여기선 되붙인다. 이 화면의 '프롬프트에 넣기' 는 Furry 모드를 켜 주지 않으므로
       떼 버리면 원본과 다른 그림이 나온다. 붙이는 쪽(addFurry)이 이미 붙은 것은 건너뛰니 두 번 붙지 않는다. */
    out.prompt = cm.furry ? (cm.prompt ? 'fur dataset, ' + cm.prompt : 'fur dataset') : cm.prompt;
    out.uc = cu.uc; out.chars = cm.chars;
    out.stripped = out.prompt !== out.rawPrompt || out.uc !== out.rawUc;
  };
  if (src && src.meta) {                       // 히스토리 항목
    out.item = src;
    const p = (src.meta && src.meta.parameters) || {};
    out.prompt = src.meta.input || p.prompt || '';
    out.uc = p.negative_prompt || p.uc || '';
    out.params = p; out.model = src.meta.model || src.model || '';
    out.modelId = baseModelOf(out.model); if (!MODELS[out.modelId]) out.modelId = S.model;
    out.hasMeta = !!(out.prompt || Object.keys(p).length);
    if (out.hasMeta) clean(p, out.modelId);
    return out;
  }
  const u8 = new Uint8Array(await src.arrayBuffer());
  const chunks = await pngTextChunks(u8);
  let cmt = chunks.find(c => c.key === 'Comment');
  out.source = (chunks.find(c => c.key === 'Source') || {}).text || '';
  if (!cmt) {   // 텍스트 청크가 지워졌어도 알파 채널에 숨은 메타(stealth)가 남아 있으면 거기서 읽는다
    const st = await readStealthMeta(src).catch(() => null);
    if (st && st.Comment) { cmt = { key: 'Comment', text: String(st.Comment) }; out.source = String(st.Source || ''); out.viaStealth = true; }
  }
  if (cmt) {
    try {
      const j = JSON.parse(cmt.text);
      out.params = j;
      out.prompt = j.prompt || (j.v4_prompt && j.v4_prompt.caption && j.v4_prompt.caption.base_caption) || '';
      out.uc = j.uc != null ? j.uc
        : (j.v4_negative_prompt && j.v4_negative_prompt.caption && j.v4_negative_prompt.caption.base_caption) || '';
      out.hasMeta = true;
    } catch (e) { /* 형식이 다르면 아래에서 '메타 없음' 으로 처리된다 */ }
  }
  out.model = out.source;
  out.modelId = modelFromSource(out.source);
  if (out.hasMeta) clean(out.params, out.modelId);
  return out;
}

/* 텍스트를 청크로 저장한다. 이름이 겹치면 뒤에 번호를 붙인다. */
function saveTextAsChunk(text, suggest, cat) {
  text = String(text || '').trim();
  if (!text) { toast('저장할 내용이 없습니다', 'err'); return; }
  let name = prompt('청크 이름', suggest || '');
  if (name == null) return;
  name = name.trim().replace(/\s+/g, '_');
  if (!name) { toast('이름이 필요합니다', 'err'); return; }
  /* 쉼표·꺾쇠·중괄호가 든 이름은 프롬프트에서 토큰으로 잘려 영영 치환되지 않는다
     (칩을 눌러 넣어도 그 이름이 태그인 척 NAI 로 나간다) — 만들 때 걸러 준다. */
  if (/[,<>{}[\]|]/.test(name)) {
    const fixed = name.replace(/[,<>{}[\]|]/g, '_').replace(/_+/g, '_');
    if (!confirm('청크 이름에 쓸 수 없는 글자(, < > { } [ ] |)가 있습니다.\n프롬프트에서 치환되지 않으므로 "' + fixed + '" 로 바꿔 저장할까요?')) return;
    name = fixed;
  }
  /* normKey 로 같은 이름(띄어쓰기·밑줄·대소문자만 다른 것)은 프롬프트에서 **한 청크만** 쓰인다 —
     둘 다 만들어 두면 칩·색칠은 이쪽을 가리키는데 실제로는 저쪽이 치환돼 결과가 어긋난다.
     그래서 이름을 자동으로 비켜 준다. */
  if (S.chunks.some(c => normKey(c.name) === normKey(name))) {
    let n = 2;
    while (S.chunks.some(c => normKey(c.name) === normKey(name + '_' + n))) n++;
    name = name + '_' + n;
    toast('같은 이름의 청크가 있어 "' + name + '" 로 저장합니다');
  }
  const c = cat || '기본';
  addChunkCat(c);
  S.chunks.push({ name, text, cat: c, createdAt: Date.now() });
  untomb('chunk', name);
  save(); renderChunkBar();
  toast('청크로 저장했습니다: ' + name + ' (칩 띠에서 눌러 쓰세요)');
}

/* 이미지 한 장의 메타를 보여 주고, 거기서 바로 가져다 쓰게 한다.
   nav 가 있으면 ‹ › 로 앞뒤 사진을 넘길 수 있다. */
async function openImageMeta(src, opts) {
  opts = opts || {};
  let m;
  try { m = await readImageMeta(src); }
  catch (e) { toast('이미지를 읽지 못했습니다: ' + e.message, 'err'); return; }
  const nav = opts.nav || null;
  const url = (m.item && m.item.url) || (src instanceof Blob ? URL.createObjectURL(src) : '');
  const tmpUrl = !m.item && url;

  openModal(opts.title || '이미지 정보', body => {
    const p = m.params || {};
    const bits = [
      m.model && ('모델 ' + String(m.model).replace('NovelAI Diffusion ', 'V')),
      (p.width && p.height) ? (p.width + '×' + p.height) : (m.item ? m.item.w + '×' + m.item.h : ''),
      p.seed != null ? ('시드 ' + p.seed) : (m.item && m.item.seed != null ? ('시드 ' + m.item.seed) : ''),
      p.steps ? (p.steps + '스텝') : '',
      p.scale != null ? ('가이던스 ' + p.scale) : '',
      p.sampler || '',
      p.noise_schedule || '',
      p.cfg_rescale ? ('rescale ' + p.cfg_rescale) : '',
    ].filter(Boolean);

    body.innerHTML =
      '<div class="im-wrap">' +
        (url ? '<div class="im-pic"><img src="' + url + '"></div>' : '') +
        '<div class="im-side">' +
          (nav ? '<div class="row im-nav"><button class="btn sm" id="imPrev">‹ 이전</button>' +
                 '<span class="hint" id="imPos">' + (nav.index + 1) + ' / ' + nav.total + '</span>' +
                 '<button class="btn sm" id="imNext">다음 ›</button></div>' : '') +
          '<div class="hint im-bits">' + bits.map(esc).join(' · ') + '</div>' +
          (m.hasMeta ? (m.viaStealth ? '<div class="hint">텍스트 메타가 지워진 파일 — 알파 채널에 숨은 메타(stealth)에서 읽었습니다</div>' : '')
                     : '<div class="hint" style="color:var(--red)">' + esc(NO_META_MSG) + '</div>') +
          '<div class="mtitle">프롬프트' + (m.stripped ? ' <span class="hint">(품질 태그·자동 글자·UC 프리셋은 뺐습니다 — 생성할 때 앱이 다시 붙입니다)</span>' : '') + '</div>' +
          '<pre class="im-t" id="imP"></pre>' +
          '<div class="row">' +
            '<button class="btn sm primary" id="imPIns">프롬프트 칸에 넣기</button>' +
            '<button class="btn sm" id="imPChunk">청크로 저장</button>' +
            '<button class="btn sm" id="imPCopy">복사</button>' +
          '</div>' +
          '<div class="mtitle">네거티브</div>' +
          '<pre class="im-t" id="imU"></pre>' +
          '<div class="row">' +
            '<button class="btn sm" id="imUIns">네거티브 칸에 넣기</button>' +
            '<button class="btn sm" id="imUChunk">청크로 저장</button>' +
            '<button class="btn sm" id="imUCopy">복사</button>' +
          '</div>' +
          '<div class="mtitle">캐릭터' + (m.chars && m.chars.length ? ' ' + m.chars.length + '명' : '') + '</div>' +
          '<div id="imChars"></div>' +
          '<div class="row" style="margin-top:8px">' +
            '<button class="btn sm" id="imApply">⤴ 설정 전부 불러오기</button>' +
            (m.item ? '<button class="btn sm" id="imMain">↗ 메인 뷰어에서 열기</button>' +
                      '<button class="btn sm" id="imI2i">↪ i2i로</button>' +
                      '<button class="btn sm" id="imFav"></button>' +
                      '<button class="btn sm" id="imSave">💾 저장</button>' +
                      '<button class="btn sm danger" id="imDel">🗑 삭제</button>' : '') +
          '</div>' +
          '<details class="im-raw"><summary class="hint">설정 전문 (JSON)</summary><pre class="im-t" id="imRaw"></pre></details>' +
        '</div>' +
      '</div>';

    body.querySelector('#imP').textContent = m.prompt || '(없음)';
    body.querySelector('#imU').textContent = m.uc || '(없음)';
    body.querySelector('#imRaw').textContent = (() => {
      try { return (m.stripped ? '// 서버에 보낸 프롬프트 원문:\n' + m.rawPrompt + '\n// 네거티브 원문:\n' + m.rawUc + '\n\n' : '') + JSON.stringify(p, null, 2); } catch (e) { return String(p); }
    })();

    const cp = async (t, what) => {
      try { await navigator.clipboard.writeText(t); toast(what + ' 복사됨'); }
      catch (e) { toast('복사하지 못했습니다 — 직접 선택해 복사해 주세요', 'err'); }
    };
    body.querySelector('#imPIns').onclick = () => { closeModal(); insertIntoPrompt(m.prompt); };
    body.querySelector('#imPChunk').onclick = () => saveTextAsChunk(m.prompt, '', '기본');
    body.querySelector('#imPCopy').onclick = () => cp(m.prompt, '프롬프트');
    body.querySelector('#imUIns').onclick = () => {
      const ta = document.querySelector('#uc');
      if (!ta) { toast('네거티브 칸을 찾지 못했습니다', 'err'); return; }
      if (typeof setMode === 'function' && S.mode !== 'main') setMode('main');
      /* 네거티브 칸은 접힌 <details> 안에 있다 — 펴 주지 않으면 넣어도 아무 변화가 안 보인다 */
      { let d = ta.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } }
      ta.value = (ta.value.trim() ? ta.value.trim() + ', ' : '') + m.uc;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      closeModal(); toast('네거티브 칸에 넣었습니다');
    };
    body.querySelector('#imUChunk').onclick = () => saveTextAsChunk(m.uc, '', '기본');
    body.querySelector('#imUCopy').onclick = () => cp(m.uc, '네거티브');
    /* 캐릭터 프롬프트 — 한 명씩 캐릭터 칸에 넣거나 청크로 만든다 */
    const cw = body.querySelector('#imChars');
    if (!m.chars || !m.chars.length) cw.innerHTML = '<div class="hint">(없음)</div>';
    else m.chars.forEach((c, i) => {
      const d = document.createElement('div'); d.className = 'im-char';
      d.innerHTML = '<pre class="im-t"></pre>' + (c.uc ? '<pre class="im-t im-cuc"></pre>' : '') +
        '<div class="row"><button class="btn sm" data-a="add">캐릭터 칸에 추가</button>' +
        '<button class="btn sm" data-a="ins">프롬프트 칸에 넣기</button>' +
        '<button class="btn sm" data-a="chunk">청크로 저장</button>' +
        '<button class="btn sm" data-a="copy">복사</button></div>';
      d.querySelector('pre').textContent = (i + 1) + '. ' + c.prompt + (c.x != null ? '   (위치 ' + Math.round(c.x * 100) + '%, ' + Math.round(c.y * 100) + '%)' : '');
      if (c.uc) d.querySelector('.im-cuc').textContent = '네거티브: ' + c.uc;
      d.querySelector('[data-a=add]').onclick = () => {
        const mx = capsOf(S.model).maxChars || 0;
        if (!mx) { toast(MODELS[modelOf(S.model)].name + ' 은 캐릭터 프롬프트를 받지 않습니다', 'err'); return; }
        const cs = curChars();   // 지금 보이는 목록(무작위 캐릭터가 있으면 그 목록 — NAI 와 같음)
        if (cs.length >= mx) { toast('이 모델은 캐릭터를 최대 ' + mx + '명까지 받습니다', 'err'); return; }
        cs.push({ prompt: c.prompt, uc: c.uc || '', x: c.x, y: c.y });
        /* 좌표가 있는데 'AI 자동 배치' 가 켜져 있으면 그 좌표는 생성에서 버려진다 — 같이 꺼 준다 */
        if (c.x != null && S.aiChoice) { S.aiChoice = false; toast('좌표가 있어 \'AI 자동 배치\' 를 껐습니다'); }
        save(); renderChars();
        toast((Array.isArray(S.randomChars) ? '무작위 캐릭터 ' : '캐릭터 ') + cs.length + '번에 넣었습니다');
      };
      d.querySelector('[data-a=ins]').onclick = () => { closeModal(); insertIntoPrompt(c.prompt); };
      d.querySelector('[data-a=chunk]').onclick = () => saveTextAsChunk(c.prompt, '', '캐릭터');
      d.querySelector('[data-a=copy]').onclick = () => cp(c.prompt, '캐릭터 프롬프트');
      cw.appendChild(d);
    });
    body.querySelector('#imApply').onclick = () => {
      if (m.item) { applyMeta(m.item.meta); closeModal(); if (typeof setMode === 'function') setMode('main'); }
      else { importFromPng(src); }
    };
    if (m.item) {
      const h = m.item;
      body.querySelector('#imFav').textContent = h.fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기';
      body.querySelector('#imFav').onclick = () => { toggleFav(h); closeModal(); if (window.renderLibrary) renderLibrary(); };
      body.querySelector('#imSave').onclick = () => saveItem(h, S.stripOnSave);
      body.querySelector('#imMain').onclick = () => { closeModal(); setMode('main'); showImage(R.hist.indexOf(h)); };
      body.querySelector('#imI2i').onclick = () => { setI2I(h.blob, h.meta, true); closeModal(); setMode('main'); toast('i2i 소스로 설정됨'); };
      body.querySelector('#imDel').onclick = () => { deleteItem(h); closeModal(); if (window.renderLibrary) renderLibrary(); };
    }
    if (nav) {
      const go = d => { const t = nav.at(nav.index + d); if (t) openImageMeta(t.item, { title: opts.title, nav: t.nav }); };
      body.querySelector('#imPrev').onclick = () => go(-1);
      body.querySelector('#imNext').onclick = () => go(1);
      body.querySelector('#imPrev').disabled = nav.index <= 0;
      body.querySelector('#imNext').disabled = nav.index >= nav.total - 1;
      /* ←/→ 로도 넘긴다. 창이 닫히면 리스너를 떼야 메인 뷰어의 ←/→ 와 겹치지 않는다. */
      const key = e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
        e.preventDefault(); e.stopPropagation(); go(e.key === 'ArrowRight' ? 1 : -1);
      };
      document.addEventListener('keydown', key, true);
      R._imNavKey = () => document.removeEventListener('keydown', key, true);
    }
  }, true, () => {
    if (R._imNavKey) { R._imNavKey(); R._imNavKey = null; }
    if (tmpUrl) URL.revokeObjectURL(tmpUrl);
  });
}

function openNaiImport() {
  openModal('NAI 웹 설정 그대로 재현하기', body => {
    body.innerHTML = `<div class="hint">NAI 웹에서 만든 PNG(원본, 메타데이터 있는 파일)를 넣으면 <b>프롬프트·네거티브·시드·스텝·가이던스·리스케일·샘플러·노이즈 스케줄·UC 프리셋·Variety·Decrisper·SMEA·캐릭터·크기·모델</b>이 전부 복원되고 시드가 고정됩니다.</div>
      <div class="grid2">
        <div class="drop" id="niDrop" style="width:100%;min-height:90px;font-size:13px">설정만 복원<br><span class="hint">PNG 드롭 또는 클릭</span></div>
        <div class="drop" id="niRepro" style="width:100%;min-height:90px;font-size:13px;border-color:var(--acc)">🔬 재현 검증<br><span class="hint">PNG 드롭 → 같은 설정·시드로 1장 생성해 픽셀 비교</span></div>
      </div>
      <div class="drop" id="niPeek" style="width:100%;min-height:70px;font-size:13px">📄 먼저 보고 고르기<br><span class="hint">이미지 드롭 → 프롬프트·네거티브·설정을 보고, 필요한 것만 프롬프트 칸에 넣거나 청크로 저장</span></div>
      <div class="hint">"느낌 탓인지" 확인하려면 <b>재현 검증</b>을 쓰세요. 같은 시드에서 두 이미지가 (거의) 같으면 앱이 NAI 웹과 동일하게 동작하는 것이고, 평소 차이는 설정(가이던스·스텝·UC 프리셋·Variety·SMEA)이나 랜덤 시드 때문입니다. Opus 무료 조건(≤1024²·≤28스텝)이면 Anlas가 들지 않습니다.</div>`;
    const d = body.querySelector('#niDrop'); bindDrop(d, f => importFromPng(f)); d.onclick = () => pickFiles(false, f => importFromPng(f), 'image/png');
    const r = body.querySelector('#niRepro'); bindDrop(r, f => runRepro(f)); r.onclick = () => pickFiles(false, f => runRepro(f), 'image/png');
    const pk = body.querySelector('#niPeek');
    bindDrop(pk, f => openImageMeta(f, { title: '이미지 정보 — ' + (f.name || '') }));
    pk.onclick = () => pickFiles(false, f => openImageMeta(f, { title: '이미지 정보 — ' + (f.name || '') }), 'image/*');
  });
}
/* 원본 PNG 의 Comment 를 NAI 가 받는 parameters 모양으로 되돌린다.
   메타에만 있는 키와 이미지 계열은 빼고, uc 는 API 이름(negative_prompt)으로 바꾼다. */
function reproParams(j) {
  const raw = { ...j };
  for (const k of Object.keys(raw)) {
    if (/^(image|mask|reference_|director_reference)/.test(k)) delete raw[k];
  }
  if (raw.uc != null && raw.negative_prompt == null) raw.negative_prompt = raw.uc;
  /* NAI 가 메타에는 적지만 요청으로는 안 받는 것들. 그대로 보내면
     "… is not allowed" 로 통째로 거절당한다. 장수·요청종류는 이 검증에서 우리가 정한다. */
  for (const k of ['prompt', 'uc', 'request_type', 'signed_hash', 'n_samples',
    'extra_passthrough_testing', 'hide_debug_overlay']) delete raw[k];
  return raw;
}
async function runRepro(file) {
  const chunks = await pngTextChunks(new Uint8Array(await file.arrayBuffer()));
  const cmt = chunks.find(c => c.key === 'Comment');
  if (!cmt) { toast('NAI 메타데이터가 없는 파일입니다', 'err'); return; }
  let orig = {}; try { orig = JSON.parse(cmt.text); } catch (e) { toast('메타데이터 파싱 실패', 'err'); return; }
  /* 재현 검증은 "원본과 같은 조건" 이어야 하므로 붙어 있는 것들을 떼야 한다.
     그런데 그중엔 손으로 칠한 마스크나 Anlas 를 써서 만든 바이브 인코딩도 있다.
     말없이 버리면 다시 만들어야 하고, 유료 인코딩은 돈이 또 든다 → 먼저 알린다. */
  const attached = [];
  if (R.i2iBlob) attached.push('불러온 이미지(i2i)');
  if (hasMask()) attached.push('칠해 둔 마스크');
  /* 바이브는 모델마다 따로다 — 떼는 것은 이 그림의 모델 목록이다(아래 importFromPng 가 모델을 그 그림 것으로 바꾼다) */
  const srcText = (chunks.find(c => c.key === 'Source') || {}).text || '';
  const reproVibes = (R.vibesBy[vibeKey(modelFromSource(srcText))] || []).length;
  if (reproVibes) attached.push(`바이브 ${reproVibes}개`);
  if ((R.prefs || []).length) attached.push(`레퍼런스 ${R.prefs.length}개`);
  if (attached.length && !confirm(`재현 검증은 원본과 같은 조건으로 만들어야 해서 지금 붙어 있는 것을 뗍니다.\n\n· ${attached.join('\n· ')}\n\n계속할까요? (바이브는 라이브러리에 저장해 두셨다면 다시 넣을 수 있습니다)`)) return;
  await importFromPng(file);      // 설정·시드 복원 (모달 닫힘)
  clearI2I(); R.vibes = []; renderVibes(); R.prefs = []; renderPrefs();
  /* 앱이 "평소대로" 보냈을 payload — 생성하지 않고 계산만 한다.
     아래 표에서 원본과 이걸 비교해야 어디서 갈라지는지가 보인다.
     (예전엔 방금 만든 결과의 메타와 비교해서, 늘 같다고 나오거나 무의미한 차이만 떴다) */
  let normal = null;
  try { normal = buildPayload({ seed: orig.seed }).parameters; } catch (e) { normal = null; }
  // 생성은 원본 메타를 그대로 태워 보낸다 — 청크 치환·퀄리티 태그·UC 프리셋·자동 nsfw 전부 우회
  const cap = o => (o && o.caption && o.caption.base_caption) || '';
  const rprompt = orig.prompt || cap(orig.v4_prompt);
  const ruc = orig.uc != null ? orig.uc : cap(orig.v4_negative_prompt);
  /* 예전엔 S.n 을 1 로 바꿨다가 되돌렸는데, 그 사이 디바운스된 save() 가 돌면
     "장수 1" 이 설정으로 굳어 버렸다. ov.n 으로만 1장을 요청하면 설정을 건드릴 일이 없다. */
  let item = null;
  const raw = reproParams(orig), dropped = [];
  /* NAI 가 안 받는 필드가 또 있으면 이름을 대 주므로, 그것만 빼고 다시 보낸다.
     검증에서 걸린 요청은 Anlas 를 쓰지 않으니 다시 보내도 손해가 없다. */
  for (let tryN = 0; tryN < 8; tryN++) {
    try {
      item = await doGenerate({ prompt: rprompt, uc: ruc, seed: orig.seed, n: 1, noQuality: true,
        w: orig.width || S.w, h: orig.height || S.h, rawParams: raw }, '재현 검증');
      break;
    } catch (e) {
      const m = /([\w.]+)\s+is not allowed/i.exec(e.message || '');
      // "parameters.xxx" 처럼 앞에 경로가 붙어 올 수도 있다 — 마지막 조각으로도 한 번 더 본다
      let key = m ? m[1] : '';
      const has = k => k && Object.prototype.hasOwnProperty.call(raw, k);
      if (!has(key) && key.includes('.')) key = key.split('.').pop();
      if (has(key)) {
        delete raw[key]; dropped.push(key);
        $('#genStatus').textContent = `재현 검증 — NAI 가 안 받는 항목(${key}) 빼고 다시 시도…`;
        continue;
      }
      return;
    }
  }
  if (dropped.length) toast('NAI 가 안 받는 항목은 빼고 보냈습니다: ' + dropped.join(', '));
  if (!item) return;
  const a = await blobToImage(file), b = await blobToImage(item.blob);
  const w = Math.min(a.width, b.width, 512), h = Math.round(w * a.height / a.width);
  const cv = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); return c.getContext('2d').getImageData(0, 0, w, h).data; };
  const da = cv(a), db = cv(b);
  let sum = 0, same = 0; const n = w * h;
  for (let i = 0; i < da.length; i += 4) { const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3; sum += d; if (d < 6) same++; }
  const mean = sum / n, pct = Math.round(same / n * 1000) / 10;
  const sizeSame = a.width === b.width && a.height === b.height;
  const verdict = !sizeSame ? '크기가 다릅니다 — 원본 PNG가 업스케일/편집된 파일일 수 있습니다' :
    mean < 3 ? '✔ 사실상 동일 — 원본 설정을 그대로 보내면 NAI 웹과 같은 그림이 나옵니다' :
    mean < 12 ? '△ 거의 같음 (미세 차이) — 원본이 재저장/리사이즈됐거나 NAI 서버 측 비결정성' :
    '✖ 다름 — 원본 그대로 보냈는데도 다릅니다. NAI 쪽 사양이 바뀌었을 수 있습니다';
  openModal('재현 검증 결과', body => {
    body.innerHTML = `<div class="repro"><div><img src="${URL.createObjectURL(file)}"><div class="cap">NAI 웹 원본 ${a.width}×${a.height}</div></div><div><img src="${item.url}"><div class="cap">이 앱 생성 ${b.width}×${b.height}</div></div></div>
      <div><b>일치 픽셀 ${pct}%</b> · 평균 색차 ${mean.toFixed(1)}/255 · seed ${item.seed}</div><div class="hint">${verdict}</div>
      ${dropped.length ? `<div class="hint">NAI 가 요청으로는 안 받는 항목이라 빼고 보냈습니다 — ${esc(dropped.join(', '))}</div>` : ''}
      <div class="row"><button class="btn sm" id="rpMeta">두 메타데이터 비교 보기</button></div><div id="rpDiff"></div>`;
    body.querySelector('#rpMeta').onclick = async () => {
      const j = orig;
      // 비교 대상은 "방금 보낸 것"(원본 그대로라 당연히 같다)이 아니라
      // "앱이 평소대로 보냈을 것" 이어야 어디서 갈라지는지가 보인다
      const mine = normal || (item.meta && item.meta.parameters) || {};
      const keys = [...new Set([...Object.keys(j), ...Object.keys(mine)])].filter(k => !/^(image|mask|reference_|director_|signed_hash|request_type)/.test(k)).sort();
      const cell = (s, i, isDiff) => { s = String(s); if (!isDiff || i < 0) return esc(s.length > 400 ? s.slice(0, 400) + '…' : s); const a = s.slice(Math.max(0, i - 60), i), b = s.slice(i, i + 160); return (i > 60 ? '…' : '') + esc(a) + '<mark class="dmark">' + esc(b) + (s.length > i + 160 ? '…' : '') + '</mark>'; };
      // 한쪽에만 있는 키는 NAI 가 메타에 안 적는 것/앱이 아직 모르는 것이라 "차이" 로 세지 않는다.
      // 다만 프롬프트·네거티브처럼 그림을 바꾸는 필드는 없어도 눈에 띄게 위로 올린다.
      const KEY_FIELDS = ['prompt', 'uc', 'negative_prompt', 'v4_prompt', 'v4_negative_prompt', 'steps', 'scale',
        'cfg_rescale', 'sampler', 'noise_schedule', 'seed', 'width', 'height', 'skip_cfg_above_sigma', 'characterPrompts'];
      const rank = k => { const i = KEY_FIELDS.indexOf(k); return i < 0 ? 999 : i; };
      keys.sort((a, b) => (rank(a) - rank(b)) || a.localeCompare(b));
      const rows = keys.map(k => {
        const A = JSON.stringify(j[k]), B = JSON.stringify(mine[k]);
        const diff = A !== B && !(A === undefined || B === undefined);
        let i = -1; if (diff) { const a = String(A), b = String(B); i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; }
        return `<tr class="${diff ? 'diff' : ''}"><td>${esc(k)}</td><td>${cell(A, i, diff)}</td><td>${cell(B, i, diff)}</td></tr>`;
      }).join('');
      const nDiff = keys.filter(k => { const A = JSON.stringify(j[k]), B = JSON.stringify(mine[k]); return A !== B && A !== undefined && B !== undefined; }).length;
      body.querySelector('#rpDiff').innerHTML = `<div class="hint">위 그림은 <b>원본 설정을 그대로</b> 보내 만든 것입니다. 아래 표는 <b>평소처럼 ▶생성을 눌렀을 때</b> 무엇이 달라지는지 보여줍니다${nDiff ? ` — 다른 필드 ${nDiff}개` : ' — 다른 필드 없음'}.</div>
        <div style="max-height:44vh;overflow:auto"><table class="metatbl"><tr><th>필드</th><th>NAI 웹 PNG</th><th>앱이 평소 보내는 값</th></tr>${rows}</table></div>
        <div class="hint">빨간 줄 = 값이 다른 필드, 노란 강조 = 처음 갈라지는 지점부터. 한쪽만 undefined 인 건 NAI 가 메타에 안 적거나 앱이 아직 안 쓰는 필드라 차이로 세지 않습니다.</div>`;
    };
  }, true);
}

/* ─────────────── 오류 기록 · 자체 점검 · 보고 ───────────────
   앱이 오류를 만나면 서버가 data/errors.jsonl 에 남긴다(토큰·경로 등은 지운 뒤).
   여기서 그걸 보고, 깃헙으로 보낼 수 있다.
   보내는 방법은 두 가지:
     ① 깃헙 이슈 페이지를 내용이 채워진 채로 연다 — 토큰이 필요 없다. 누구나 쓸 수 있다.
     ② ⚙설정에 깃헙 토큰을 넣어 두면 버튼 하나로 바로 올라간다 — 토큰은 그 PC 에만 남는다.
   배포하는 exe 에는 토큰이 들어 있지 않다(들어가면 누구나 꺼내 쓸 수 있으므로). */
function openHealth() {
  openModal('🩺 점검 · 오류 기록', body => {
    body.innerHTML = `<div class="hint" id="hcHint">불러오는 중…</div>
      <div class="mtitle">자체 점검 <span class="hint">— 앱이 켜져 있는 동안 10분마다 스스로 확인합니다</span></div>
      <div id="hcList"></div>
      <div class="row"><button class="btn sm" id="hcNow">지금 다시 점검</button>
        <button class="btn sm" id="hcRestart" title="서버를 껐다 켭니다. 설정·이미지는 그대로입니다.">↻ 앱 다시 켜기</button>
        <span class="hint" id="hcWhen"></span></div>
      <div class="hint" id="hcRestartWhy" hidden></div>
      <div class="mtitle">오류 기록 <span class="hint" id="hcN"></span></div>
      <div class="errbox" id="hcErrs"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" id="hcReport">🐞 이 내용으로 보고 보내기</button>
        <button class="btn sm" id="hcCopy">복사</button>
        <button class="btn sm danger" id="hcClear">기록 지우기</button>
      </div>
      <label class="ck"><input type="checkbox" id="hcWithPrompt"> 프롬프트 내용도 함께 보내기
        <span class="hint">(끄면 오류 메시지와 설정만 갑니다. 공개 저장소로 가니 기본은 꺼둡니다)</span></label>
      <div class="hint" id="hcSt"></div>`;
    const $$$ = id => body.querySelector(id);
    let snap = null, errs = [];

    /* 앱 파일을 갈아끼웠는데 서버를 안 껐다 켜면, 화면만 새것이고 서버가 하는 일은
       옛것 그대로다 (유튜브 재생 같은 것). 그래서 여기서 바로 다시 켤 수 있게 한다. */
    $$$('#hcRestart').onclick = async () => {
      const b = $$$('#hcRestart');
      if (!confirm('앱을 껐다 켭니다.\n설정·이미지·프롬프트는 그대로 있습니다.\n\n생성 중이면 그 작업은 중단됩니다. 계속할까요?')) return;
      b.disabled = true; b.textContent = '다시 켜는 중…';
      try {
        const r = await apiFetch('/update/restart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || ('HTTP ' + r.status)); }
        b.textContent = '잠시 후 새 창이 열립니다';
        toast('앱을 다시 켜는 중입니다 — 잠시 후 새 창이 열립니다');
      } catch (e) {
        b.disabled = false; b.textContent = '↻ 앱 다시 켜기';
        toast('다시 켜지 못했습니다: ' + e.message + ' — 앱 창(검은 콘솔)을 닫았다가 start.bat 을 다시 실행해 주세요', 'err');
      }
    };

    /* 이 창의 칸들은 기다리는 사이에 창이 닫히거나 바뀌면 없어진다 — 없으면 쓰지 않는다 (12.12 단추 전부 누르기 시험에서 두 번 찾음) */
    const setTxt = (sel, t) => { const e = $$$(sel); if (e) e.textContent = t; };
    const drawChecks = () => {
      const el = $$$('#hcList'); if (!el) return; el.innerHTML = '';
      /* 소스가 바뀐 채로 돌고 있으면 다시 켜는 게 유일한 해결이다 — 버튼을 눈에 띄게. */
      const stale = ((snap && snap.checks) || []).some(c => !c.ok && c.name === '앱 파일');
      const rb = $$$('#hcRestart'), why = $$$('#hcRestartWhy');
      if (rb) rb.className = stale ? 'btn sm primary' : 'btn sm';
      if (why) { why.hidden = !stale; why.textContent = stale ? '앱 파일이 바뀌었습니다. 다시 켜야 새 코드가 돕니다 — 지금은 옛 코드가 돌고 있습니다.' : ''; }
      for (const c of (snap && snap.checks) || []) {
        const d = document.createElement('div'); d.className = 'chk-row';
        const cls = c.ok ? 'chk-ok' : (c.level === 'err' ? 'chk-bad' : 'chk-warn');
        d.innerHTML = `<span class="nm">${esc(c.name)}</span><span class="${cls}">${c.ok ? '정상' : (c.level === 'err' ? '문제' : '확인')}</span><span class="dt">${esc(c.detail || '')}</span>`;
        el.appendChild(d);
      }
      setTxt('#hcWhen', snap && snap.t ? '마지막 점검 ' + new Date(snap.t).toLocaleTimeString() : '');
    };
    const drawErrs = () => {
      const el = $$$('#hcErrs'); if (!el) return; el.innerHTML = '';
      setTxt('#hcN', errs.length ? `— ${errs.length}건` : '— 없음 (좋은 신호입니다)');
      for (const e of errs.slice().reverse()) {
        const d = document.createElement('div'); d.className = 'e';
        d.innerHTML = `<span class="when">${new Date(e.t || 0).toLocaleString()}</span>[${esc(e.kind || '?')}] ${esc(e.msg || '')}${e.where ? ' <span class="when">@' + esc(e.where) + '</span>' : ''}`;
        el.appendChild(d);
      }
    };
    /* 불러오는 사이에 창을 닫으면(또는 다른 창으로 바뀌면) 칸이 없다 — 그때는 그리지 않고 끝낸다.
       예전엔 닫힌 창의 칸에 글을 쓰다 오류가 났다(12.12 단추 전부 누르기 시험에서 찾음). */
    const load = async () => {
      try {
        snap = await (await apiFetch('/selfcheck')).json();
        errs = ((await (await apiFetch('/errors?limit=200')).json()) || {}).items || [];
        if (!$$$('#hcHint')) return;
        $$$('#hcHint').textContent = '';
        drawChecks(); drawErrs();
      } catch (e) { const h = $$$('#hcHint'); if (h) h.textContent = '불러오지 못했습니다: ' + e.message; }
    };
    load();

    $$$('#hcNow').onclick = async () => {
      setTxt('#hcWhen', '점검 중…');
      try { snap = await (await apiFetch('/selfcheck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json(); drawChecks(); }
      catch (e) { setTxt('#hcWhen', '실패: ' + e.message); }
    };
    $$$('#hcClear').onclick = async () => {
      if (!confirm('오류 기록을 모두 지울까요?')) return;
      try { await apiFetch('/errors?clear=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); errs = []; drawErrs(); }
      catch (e) { setTxt('#hcSt', '실패: ' + e.message); }
    };

    const buildReport = () => {
      const info = R.srvInfo || {};
      const L = [];
      L.push('## 무슨 일이 있었나요?', '', '(여기에 적어 주세요 — 무엇을 하다가 났는지 한 줄이면 충분합니다)', '');
      L.push('## 환경', '');
      L.push(`- 버전: ${info.release || '?'} (앱 ${typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'}${info.frozen ? ' · exe' : ' · 소스'})`);
      L.push(`- 브라우저: ${navigator.userAgent}`);
      L.push(`- 모델: ${S.model} · ${S.w}×${S.h} · 스텝 ${S.steps} · 스케일 ${S.scale} · ${S.sampler} / ${S.schedule}`);
      if ($$$('#hcWithPrompt').checked) {
        /* previewFinal() 은 문자열이 아니라 {p, uc} 를 돌려준다. 그대로 .slice 를 걸어서
           보고 버튼이 TypeError 로 죽었다 (오류 보고 기능이 스스로를 못 보내던 셈). */
        let fp = S.prompt || '', fu = S.uc || '';
        try { if (typeof previewFinal === 'function') { const r = previewFinal(); fp = (r && r.p) || fp; fu = (r && r.uc) || fu; } } catch (e) {}
        L.push('', '## 프롬프트', '', '```', String(fp).slice(0, 1500), '```');
        if (fu) L.push('', '## 네거티브', '', '```', String(fu).slice(0, 800), '```');
      }
      const bad = ((snap && snap.checks) || []).filter(c => !c.ok);
      if (bad.length) { L.push('', '## 점검에서 걸린 것', ''); for (const c of bad) L.push(`- **${c.name}** — ${c.detail || ''}`); }
      if (errs.length) {
        L.push('', '## 오류 기록 (최근 20건)', '', '```');
        /* 오류마다 "그때 버전" 을 적는다.
           errors.jsonl 은 업데이트를 해도 지워지지 않아서, 옛 버전에서 난 오류가
           보고서에는 지금 버전과 나란히 찍힌다. 실제로 이미 고친 버그를 두고
           "아직도 난다" 고 읽어 헛다리를 짚은 적이 있다. */
        const nowVer = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '');
        for (const e of errs.slice(-20)) {
          const v = e.ver ? (e.ver === nowVer ? '' : ` (v${e.ver} — 지금은 v${nowVer})`) : '';
          L.push(`${new Date(e.t || 0).toISOString()} [${e.kind || '?'}] ${e.msg || ''}${e.where ? ' @' + e.where : ''}${v}`);
        }
        L.push('```');
      }
      L.push('', '<sub>NAI Studio 앱에서 자동으로 만든 보고입니다. 토큰·키·개인 경로는 보내기 전에 지워집니다.</sub>');
      return L.join('\n');
    };
    const reportTitle = () => {
      const last = errs.length ? errs[errs.length - 1] : null;
      return '[오류] ' + (last ? String(last.msg).slice(0, 80) : '문제 보고');
    };

    $$$('#hcCopy').onclick = () => {
      navigator.clipboard.writeText(buildReport()).then(() => toast('복사했습니다 — 아무 데나 붙여넣어 보내주세요'))
        .catch(() => toast('복사하지 못했습니다', 'err'));
    };

    $$$('#hcReport').onclick = async () => {
      const st = $$$('#hcSt'); const title = reportTitle(), text = buildReport();
      const info = R.srvInfo || {};
      // 토큰이 있으면 바로 올린다 (본인 PC 에만 있는 토큰). 없으면 깃헙 이슈 페이지를 채워서 연다.
      if (info.hasGhToken) {
        st.textContent = '보내는 중…';
        try {
          const r = await apiFetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body: text }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status));
          st.innerHTML = `✔ 올렸습니다 — <a href="${esc(j.url || '#')}" target="_blank" rel="noopener">#${j.number}</a>`;
          return;
        } catch (e) { st.textContent = '자동 보고 실패: ' + e.message + ' — 아래 방법으로 보내주세요'; }
      }
      // 서버의 _upd_repo 와 같은 규칙으로 "사용자명/저장소" 만 뽑는다 (주소를 통째로 붙여넣는 경우가 많다)
      const repo = (info.updateRepo || '').trim()
        .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '').replace(/^\/+|\/+$/g, '')
        .replace(/\.git$/i, '').split('/').filter(Boolean).slice(0, 2).join('/');
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { st.textContent = '보고할 저장소를 알 수 없습니다 — ⚙설정의 "업데이트 저장소" 를 먼저 채워주세요'; return; }
      const url = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(text.slice(0, 6000))}`;
      window.open(url, '_blank', 'noopener');
      st.textContent = '깃헙 이슈 작성 창을 열었습니다 — 내용을 확인하고 초록 버튼을 누르면 접수됩니다';
    };
  }, true);
}

/* ─────────────── 전체 백업 / 복원 (ZIP) ─────────────── */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8, crc) { crc = (crc == null ? 0xFFFFFFFF : crc); for (let i = 0; i < u8.length; i++) crc = CRC_T[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8); return crc; }
/* Blob 을 조각내어 CRC 를 누적한다. 한 번에 한 조각(1MB)만 메모리에 올라온다.
   crc32 는 이미 이어받기(두 번째 인자)를 지원하므로 그대로 쓸 수 있다. */
async function crc32Blob(blob) {
  const CH = 1 << 20;
  let crc = 0xFFFFFFFF;
  for (let o = 0; o < blob.size; o += CH) {
    const part = new Uint8Array(await blob.slice(o, Math.min(o + CH, blob.size)).arrayBuffer());
    crc = crc32(part, crc);
    if (o % (CH * 16) === 0) await new Promise(r => setTimeout(r));   // 메인 스레드를 놓아 준다
  }
  return crc;
}
async function zipBuild(files) { // files: [{name, blob|u8}] → Blob (STORE, ZIP64 미사용 → 4GB 미만)
  /* ZIP64 를 안 쓰므로 오프셋·크기는 4바이트, 파일 수는 2바이트가 한계다.
     넘으면 값이 잘려 나가는데, 그래도 파일은 만들어지고 "완료" 로 보인다 —
     정작 풀 때 깨져서 백업이 통째로 날아간다. 만들기 전에 막는다. */
  if (files.length > 65535) throw new Error(`파일이 너무 많습니다 (${files.length}개 · 65535개까지) — 이미지 없이 설정만 백업하거나 즐겨찾기만 담아 주세요`);
  const parts = [], cds = []; let off = 0; const enc = new TextEncoder();
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const dt = new Date(); const dosT = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1), dosD = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  for (const f of files) {
    /* 예전에는 여기서 이미지마다 `new Uint8Array(await f.blob.arrayBuffer())` 로 전체를 펼쳐
       parts 에 끝까지 붙들고 있었다. 히스토리가 수백 장이면 총량의 두 배가 한 탭에 잡혀
       "백업이 가장 필요한 시점" 에 탭이 죽었다. 4GB·65535장 검사는 ZIP 포맷 한계일 뿐 메모리와 무관하다.
       이제 Blob 조각을 그대로 넘기고(Blob 생성자가 Blob 을 받는다) CRC 만 조각내어 훑는다. */
    const name = enc.encode(f.name);
    const data = f.u8 || f.blob;
    const size = f.u8 ? f.u8.length : f.blob.size;
    const crc = ((f.u8 ? crc32(f.u8) : await crc32Blob(f.blob)) ^ 0xFFFFFFFF) >>> 0;
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x800), ...u16(0), ...u16(dosT), ...u16(dosD), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name]);
    if (off + lh.length + size > 0xFFFFFFFF) throw new Error('백업이 4GB를 넘습니다 — 즐겨찾기만 담거나 이미지를 빼고 만들어 주세요');
    parts.push(lh, data);
    cds.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x800), ...u16(0), ...u16(dosT), ...u16(dosD), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...name]));
    off += lh.length + size;
  }
  const cdSize = cds.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...cds, eocd], { type: 'application/zip' });
}
/* 백업 파일의 스키마 버전. 지금까지 쓰기만 하고 읽는 곳이 없어서,
   더 새로운 앱에서 만든 백업을 옛 앱에 그대로 넣어도 아무 경고가 없었다. */
const BACKUP_VER = 9;
function openBackup() {
  openModal('📦 전체 백업 / 복원', body => {
    const nHist = R.hist.length, favN = R.hist.filter(h => h.fav).length;
    const mb = (R.hist.reduce((a, h) => a + (h.blob ? h.blob.size : 0), 0) / 1048576).toFixed(0);
    body.innerHTML = `
      <div class="mtitle">백업 내보내기 (ZIP 한 파일)</div>
      <label class="ck"><input type="checkbox" id="bkSet" checked disabled> 설정 전부 — 프롬프트 칸·청크·스타일·캐릭터·씬·옵션·프리셋·유튜브 목록 + <b>바이브 라이브러리(인코딩)</b></label>
      <label class="ck"><input type="checkbox" id="bkHist"> 히스토리 이미지 전부 (${nHist}장 · 약 ${mb}MB · 메타·즐겨찾기·씬 포함)</label>
      <label class="ck"><input type="checkbox" id="bkFav"> 즐겨찾기 이미지만 (${favN}장)</label>
      <label class="ck"><input type="checkbox" id="bkTok"> NAI API 토큰 · YouTube 연결 정보 포함 <span class="hint">(내 PC 간 이동용. 남에게 주는 백업엔 끄세요)</span></label>
      <div class="row"><button class="btn primary" id="bkGo">📦 백업 ZIP 다운로드</button><span class="hint" id="bkSt"></span></div>
      <hr>
      <div class="mtitle">백업 불러오기</div>
      <div class="hint">백업 ZIP(또는 예전 설정 JSON)을 드롭하면 내용을 보여주고, <b>합치기</b>(기존 유지 + 추가) 또는 <b>덮어쓰기</b>를 고를 수 있습니다.</div>
      <div class="drop" id="bkDrop" style="width:100%;min-height:70px">백업 ZIP / JSON 드롭 또는 클릭</div>
      <div id="bkPreview"></div>
      <hr>
      <div class="mtitle">서버 자동 백업 <span class="hint">(앱이 설정을 저장할 때마다 서버가 최근 30개를 자동으로 남깁니다)</span></div>
      <div class="row"><button class="btn sm" id="bkSrvList">목록 보기</button><span class="hint" id="bkSrvSt"></span></div>
      <div id="bkSrvBox"></div>`;
    const bkHist = body.querySelector('#bkHist'), bkFav = body.querySelector('#bkFav');
    bkHist.onchange = () => { if (bkHist.checked) bkFav.checked = false; }; bkFav.onchange = () => { if (bkFav.checked) bkHist.checked = false; };
    body.querySelector('#bkGo').onclick = async () => {
      const st = body.querySelector('#bkSt'); st.textContent = '만드는 중…';
      try {
        const files = [];
        const meta = { app: 'NAI Studio', version: BACKUP_VER, at: new Date().toISOString(), state: S };
        const warn = [];   // 조용히 빠뜨리면 "백업 있음" 이라 믿고 지우게 된다 → 빠진 건 반드시 알린다
        try { meta.vibelib = await vibeLibAll(); } catch (e) { warn.push('바이브 라이브러리'); }   // 유료 인코딩이 든 바이브 라이브러리도 함께
        if (body.querySelector('#bkTok').checked) {
          try { const r = await apiFetch('/config?full=1'); if (r.ok) meta.config = await r.json(); else warn.push('토큰·연결정보'); }
          catch (e) { warn.push('토큰·연결정보'); }
        }
        files.push({ name: 'nai-studio-backup.json', u8: new TextEncoder().encode(JSON.stringify(meta, null, 1)) });
        const withHist = bkHist.checked || bkFav.checked;
        if (withHist) {
          const items = R.hist.filter(h => bkHist.checked || h.fav);
          const idx = [];
          let i = 0;
          for (const h of items) {
            const fn = 'history/' + (h.name || ('img_' + (i + 1) + '.png'));
            files.push({ name: fn, blob: h.blob });
            /* 결과 변형(배경 제거의 Masked·Generated·Blend)이 있으면 변형마다 파일을 따로 담는다 — 안 담으면 복원 때 한 장만 남는다 */
            let vars = null;
            if (Array.isArray(h.vars) && h.vars.length) {
              vars = h.vars.map((v, k) => { const vf = fn.replace(/\.png$/i, '') + '_' + (v.tag || k) + '.png'; files.push({ name: vf, blob: v.blob }); return { file: vf, tag: v.tag || String(k), ...(v.loc ? { loc: v.loc } : {}) }; });
            }
            /* 원본과 비교(12.14)의 원본 그림·마스크도 담는다 — 안 담으면 복원 뒤 «✦ 원본» 단추가 사라진다 */
            let orig = null, origMask = null;
            if (h.orig) { orig = fn.replace(/\.png$/i, '') + '_orig.png'; files.push({ name: orig, blob: h.orig }); }
            if (h.origMask) { origMask = fn.replace(/\.png$/i, '') + '_origmask.png'; files.push({ name: origMask, blob: h.origMask }); }
            /* judge 를 함께 담는다. 채점은 한 장에 Gemini 호출 1회 = 요금 1회다.
               여기서 빠뜨리면 복원한 사람은 돈을 다시 내고 채점해야 한다. */
            /* tool(툴 결과 표시, 12.17)·gid(같은 요청 묶음, 12.20)·varOrig(변형 묶음의 원본, 12.21)도 담는다 — 12.20 까지는 빠져서
               복원하면 툴 결과 표시와 캔버스 결과 화면의 묶음이 사라졌다 */
            idx.push({ file: fn, meta: h.meta, seed: h.seed, model: h.model, w: h.w, h: h.h, fav: !!h.fav, t: h.t, label: h.label, sceneId: h.sceneId || null, name: h.name, judge: h.judge || null, vars, orig, origMask,
              ...(h.tool ? { tool: h.tool } : {}), ...(h.gid ? { gid: h.gid } : {}), ...(h.varOrig ? { varOrig: true } : {}) });
            i++; if (i % 20 === 0) st.textContent = `이미지 담는 중… ${i}/${items.length}`;
          }
          files.push({ name: 'history/index.json', u8: new TextEncoder().encode(JSON.stringify(idx)) });
        }
        st.textContent = 'ZIP 생성 중…';
        const zip = await zipBuild(files);
        downloadBlob(zip, `nai-studio-backup_${ts()}.zip`);
        st.textContent = `✔ 완료 (${(zip.size / 1048576).toFixed(1)}MB, 파일 ${files.length}개)`
          + (warn.length ? ` · ⚠ 못 담은 것: ${warn.join(', ')}` : '');
      } catch (e) { st.textContent = '✖ ' + e.message; }
    };
    const drop = body.querySelector('#bkDrop');
    const handle = async f => {
      const pv = body.querySelector('#bkPreview'); pv.innerHTML = '<div class="hint">읽는 중…</div>';
      try {
        let state = null, config = null, histIdx = [], histFiles = {}, vibelib = null;
        let bkVer = null;
        if (/\.json$/i.test(f.name)) { const j = JSON.parse(await f.text()); state = j.state || j; config = j.config || null; vibelib = j.vibelib || null; bkVer = j.version; }
        else {
          const entries = await unzip(await f.arrayBuffer());
          for (const e of entries) {
            if (e.name === 'nai-studio-backup.json') { const j = JSON.parse(new TextDecoder().decode(e.data)); state = j.state; config = j.config || null; vibelib = j.vibelib || null; bkVer = j.version; }
            else if (e.name === 'history/index.json') histIdx = JSON.parse(new TextDecoder().decode(e.data));
            else if (e.name.startsWith('history/')) histFiles[e.name] = e.data;
          }
        }
        if (!state) throw new Error('백업 파일 형식이 아닙니다');
        pv.innerHTML = `<div class="style-card"><b>백업 내용</b>
          <div class="hint">청크 ${(state.chunks||[]).length} · 스타일 ${(state.styles||[]).length} · 캐릭터 ${(state.characters||[]).length} · 씬 ${(state.scenes||[]).length} · 바이브 ${(vibelib||[]).length} · 유튜브 대기열 ${(state.ytQueue||[]).length}/기록 ${(state.ytHistory||[]).length} · 이미지 ${histIdx.length}장${config ? ' · 토큰/연결정보 포함' : ''}${state.savedAt ? ' · ' + new Date(state.savedAt).toLocaleString() : ''}</div>
          ${(typeof bkVer === 'number' && bkVer > BACKUP_VER)
            ? `<div class="hint" style="color:var(--warn,#e0a030)">⚠ 이 백업은 더 새로운 버전의 앱에서 만들어졌습니다 (백업 v${bkVer} · 이 앱 v${BACKUP_VER}).
                 앱을 먼저 업데이트하지 않으면 이 앱이 모르는 설정은 버려집니다.</div>`
            : ''}
          <div class="row"><button class="btn primary sm" id="bkMerge">합치기 (기존 유지 + 추가)</button><button class="btn sm danger" id="bkReplace">덮어쓰기 (설정 전부 교체)</button><span class="hint" id="bkRSt"></span></div></div>`;
        const restore = async replace => {
          const rst = pv.querySelector('#bkRSt'); rst.textContent = '복원 중…';
          // 복원한 항목이 옛 삭제 기록에 걸려 새로고침 때 다시 사라지지 않게 톰스톤을 걷어낸다
          S.deleted = S.deleted || {};
          const untomb = (kind, keys) => (keys || []).forEach(k => { if (k != null) S.deleted[kind + '|' + String(k).toLowerCase()] = 0; });
          untomb('chunk', (state.chunks || []).map(c => c.name));
          untomb('style', (state.styles || []).map(s => s.id));
          untomb('char', (state.characters || []).map(c => c.name));
          untomb('scene', (state.scenes || []).map(s => s.id));
          untomb('cat', state.chunkCats || []);
          if (replace) {
            /* normalizeState 를 반드시 태운다. 예전 백업에 지금은 없는 모델 id 가 들어 있으면
               아래 syncUI 가 던지고, 복원이 이미지 절반만 들어간 상태에서 멎었다.
               부팅 경로에는 이 정규화가 있는데 복원 경로에만 없었다. */
            const del = S.deleted;
            S = normalizeState({ ...DEFAULTS, ...state });
            S.deleted = { ...(state.deleted || {}), ...del };
          }
          else {
            /* 이름 비교는 프롬프트에서 청크를 찾을 때와 같은 기준(normKey)이어야 한다.
               toLowerCase 만 보면 "작가 랜덤" 과 "작가_랜덤" 이 서로 다른 것으로 남아
               둘 다 들어가고, 정작 프롬프트에서는 나중 것 하나만 쓰인다
               (화면에 보이는 칩과 실제로 나가는 내용이 달라진다). */
            const sameKey = (a, b) => (typeof normKey === 'function'
              ? normKey(a) === normKey(b)
              : String(a || '').toLowerCase() === String(b || '').toLowerCase());
            const mergeBy = (a, b, key) => { const out = [...(a || [])]; (b || []).forEach(x => { if (!out.some(y => sameKey(y[key], x[key]))) out.push(x); }); return out; };
            // 키는 서버 _STATE_LISTS 와 같아야 한다 (chunks=name · styles=id · characters=name · scenes=id)
            S.chunks = mergeBy(S.chunks, state.chunks, 'name');
            S.styles = mergeBy(S.styles, state.styles, 'id');
            /* ★ 이 줄은 예전에 윗줄 주석 뒤에 붙어 통째로 주석이 되어 있었다 —
                 백업을 '합치기' 로 복원하면 캐릭터 라이브러리가 말없이 하나도 안 돌아왔다. */
            S.characters = mergeBy(S.characters, state.characters, 'name');
            S.scenes = mergeBy(S.scenes, state.scenes, 'id'); S.chunkCats = [...new Set([...(S.chunkCats || []), ...(state.chunkCats || [])])];
            /* 'id' 만으로 합치면 id 가 없는 재생목록 항목끼리 전부 같은 것으로 판정돼
               백업 속 재생목록이 하나만 돌아온다. 곡 열쇠는 id||list 다. */
            const ytSame = (x, y) => ytKey(x) === ytKey(y);
            S.ytQueue = S.ytQueue.concat((state.ytQueue || []).filter(x => ytKey(x) && !S.ytQueue.some(y => ytSame(y, x))));
            S.ytHistory = S.ytHistory.concat((state.ytHistory || []).filter(x => ytKey(x) && !S.ytHistory.some(y => ytSame(y, x))));
            ytQueueTrim(); if (S.ytHistory.length > 200) S.ytHistory.length = 200;
            /* 쌓기만 하는 기록들도 합친다 (서버 _merge_state 와 같은 규칙).
               채점 한 줄 = Gemini 호출 한 번(=요금 한 번)이라 버리면 돈을 다시 내야 한다.
               뭉갬 평소 기록은 버리면 "평소" 기준이 사라져 상태 판정이 한동안 헛돈다. */
            const mergeLog = (a, b, keyOf, cap) => {
              const out = [...(a || [])]; const seen = new Set(out.map(keyOf));
              (b || []).forEach(x => { const k = keyOf(x); if (x && !seen.has(k)) { seen.add(k); out.push(x); } });
              out.sort((p, q) => (p.t || 0) - (q.t || 0));
              return out.slice(-cap);
            };
            S.judgeLog = mergeLog(S.judgeLog, state.judgeLog, x => (x && x.id != null) ? 'i' + x.id : 't' + (x && x.t) + '_' + (x && x.seed), 300);
            S.mushLog = mergeLog(S.mushLog, state.mushLog, x => 't' + (x && x.t), 120);
            /* '지금 비어 있을 때만' 의 판정은 값을 봐야 한다 — 예전엔 키 개수만 봐서,
               구역 칸이 만들어져 있고 내용이 전부 비어 있으면(흔한 상태) 프롬프트가 영영 안 돌아왔다. */
            const promptEmpty = !String(S.prompt || '').trim() && !Object.values(S.secText || {}).some(v => String(v || '').trim());
            if (promptEmpty) { S.secText = state.secText || {}; S.prompt = state.prompt || ''; S.sections = state.sections || S.sections; }
            // 캐릭터 칸과 네거티브도 같은 규칙으로 — 지금 비어 있을 때만 백업 것을 가져온다.
            // 예전엔 아예 손대지 않아서 "합치기" 로 복원해도 이 둘은 영영 안 돌아왔다.
            if (!(S.chars || []).some(c => (c.prompt || '').trim()) && (state.chars || []).length) S.chars = state.chars;
            if (!(S.uc || '').trim() && (state.uc || '').trim()) S.uc = state.uc;
            for (const k of ['ov', 'model', 'w', 'h', 'steps', 'scale', 'rescale', 'sampler', 'schedule', 'quality', 'ucPreset', 'variety', 'decrisper', 'autoNsfw', 'theme', 'autoMode', 'autoCount', 'autoDelay']) if (state[k] !== undefined && S[k] === DEFAULTS[k]) S[k] = state[k];
          }
          S.savedAt = Date.now(); save();
          /* '덮어쓰기' 는 말 그대로 교체여야 한다. 평소 저장은 서버가 합집합으로 합치므로
             지운 항목이 되살아나고, 개수가 줄면 보호 규칙에 걸려 아예 저장되지 않는다.
             → 이 경우에만 force 로 밀어 넣는다. */
          const rwarn = [];
          if (replace && typeof pushStateToServer === 'function') {
            // 예외만 보면 안 된다 — 서버가 꺼져 있으면 조용히 false 만 돌아온다
            let ok = false;
            try { ok = await pushStateToServer(true); } catch (e) { ok = false; }
            if (!ok) rwarn.push('서버 반영(다른 창·다음 실행에는 반영 안 됨)');
          }
          if (config) {
            // 값이 있는 키만 보낸다 — 빈 문자열을 보내면 서버가 "지우기"로 해석해
            // 백업에 없던 NAI 토큰·유튜브 연결이 날아간다
            const cfgSend = Object.fromEntries(Object.entries(config).filter(([, v]) => v && String(v).trim()));
            if (Object.keys(cfgSend).length) {
              try { const cr = await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfgSend) }); if (!cr.ok) rwarn.push('토큰·연결정보'); }
              catch (e) { rwarn.push('토큰·연결정보'); }
            }
          }
          if (vibelib && vibelib.length) { try { const cur = await vibeLibAll(); const names = new Set(cur.map(x => x.name)); const add = vibelib.filter(x => replace || !names.has(x.name)); await vibeLibSave(replace ? vibelib : cur.concat(add)); } catch (e) { rwarn.push('바이브 라이브러리'); } }
          let n = 0, failed = 0;
          for (const it of histIdx) {
            const data = histFiles[it.file]; if (!data) continue;
            if (!replace && R.hist.some(h => h.seed === it.seed && h.t === it.t)) continue;
            const blob = new Blob([data], { type: 'image/png' });
            const rec = { blob, meta: it.meta || {}, seed: it.seed, model: it.model, w: it.w, h: it.h, fav: !!it.fav, t: it.t || Date.now(), name: it.name || it.file.split('/').pop(), label: it.label || '', sceneId: it.sceneId || null };
            // 옛 백업엔 judge 가 없다 — 있을 때만 붙인다 (없는 채로 두면 그냥 미채점 이미지다)
            if (it.judge && typeof it.judge === 'object') rec.judge = it.judge;
            // 결과 변형(12.12 부터 담음) — 파일이 다 있을 때만 되살린다
            if (Array.isArray(it.vars) && it.vars.length && it.vars.every(v => histFiles[v.file])) {
              rec.vars = it.vars.map(v => ({ blob: new Blob([histFiles[v.file]], { type: 'image/png' }), tag: v.tag, ...(v.loc ? { loc: v.loc } : {}) }));
              rec.blob = rec.vars[0].blob;
            }
            // 원본과 비교(12.14 부터 담음)
            if (it.orig && histFiles[it.orig]) rec.orig = new Blob([histFiles[it.orig]], { type: 'image/png' });
            if (it.origMask && histFiles[it.origMask]) rec.origMask = new Blob([histFiles[it.origMask]], { type: 'image/png' });
            // 툴 결과 표시·같은 요청 묶음·변형 묶음의 원본 (12.21 부터 담음)
            if (typeof it.tool === 'string' && it.tool) rec.tool = it.tool;
            if (typeof it.gid === 'string' && it.gid) rec.gid = it.gid;
            if (it.varOrig === true) rec.varOrig = true;
            try { rec.id = await histPut({ ...rec }); } catch (e) { failed++; }
            rec.url = URL.createObjectURL(rec.blob); R.hist.push(rec); n++;
            if (n % 20 === 0) rst.textContent = `이미지 복원 중… ${n}/${histIdx.length}`;
          }
          R.hist.sort((a, b) => a.t - b.t); renderHist(); if (R.hist.length) showImage(R.hist.length - 1);
          // S.mode 만 바꾸면 화면은 그대로다 — 탭 전환까지 실제로 시켜야 한다
          if (replace && typeof setMode === 'function') { try { setMode(S.mode || 'gen'); } catch (e) {} }
          /* 화면 갱신 중 하나가 던져도 아래 결과 문구·토스트는 떠야 한다.
             예전엔 여기서 던지면 사용자는 '복원 중…' 만 보고 끝났다. */
          try {
            syncUI(); renderChars(); renderChunkBar(); applyTheme();
            if (typeof renderStyleSelects === 'function') renderStyleSelects();
            if (typeof renderYtQueue === 'function') renderYtQueue();
            if (window.onHistChanged) window.onHistChanged();
          } catch (e) { logErr('복원 후 화면 갱신 실패: ' + e.message); rwarn.push('화면 갱신(새로고침 F5 하세요)'); }
          // 저장 실패를 조용히 삼키지 않는다 — 새로고침하면 사라질 이미지이므로 알려야 한다
          rst.textContent = `✔ 복원 완료 (이미지 ${n}장${failed ? `, ${failed}장은 저장 실패 — 새로고침하면 사라집니다` : ''})`
            + (rwarn.length ? ` · ⚠ 복원 못한 것: ${rwarn.join(', ')}` : '');
          toast(failed || rwarn.length ? `백업 복원 완료 — ${[failed ? failed + '장 저장 실패' : '', ...rwarn].filter(Boolean).join(', ')}` : '백업 복원 완료', (failed || rwarn.length) ? 'err' : '');
        };
        pv.querySelector('#bkMerge').onclick = () => restore(false);
        pv.querySelector('#bkReplace').onclick = () => { if (confirm('현재 설정을 전부 백업 내용으로 교체합니다. 계속할까요?')) restore(true); };
      } catch (e) { pv.innerHTML = `<div class="hint">✖ ${esc(e.message)}</div>`; }
    };
    bindDrop(drop, handle); drop.onclick = () => pickFiles(false, handle, '.zip,.json');

    /* 서버 자동 백업 — 지금까지는 파일로만 있고 앱에서 열 길이 없었다.
       (사고가 났을 때 "백업에서 되돌리세요" 라고 안내하면서 정작 그 길이 없었다) */
    body.querySelector('#bkSrvList').onclick = async () => {
      const st = body.querySelector('#bkSrvSt'), box = body.querySelector('#bkSrvBox');
      st.textContent = '불러오는 중…'; box.innerHTML = '';
      try {
        const r = await apiFetch('/state?list=1');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        // 서버는 {backups:[{file,savedAt,chunks,styles,characters,scenes}]} 를 최신순으로 준다
        const files = (j.backups || j.files || []);
        if (!files.length) { st.textContent = '아직 자동 백업이 없습니다'; return; }
        st.textContent = files.length + '개';
        for (const f of files.slice(0, 30)) {
          const name = typeof f === 'string' ? f : (f.name || f.file || '');
          const d = document.createElement('div'); d.className = 'style-card';
          const pre = (typeof f === 'object' && f.savedAt) ? (new Date(f.savedAt).toLocaleString() + ' · 청크 ' + (f.chunks || 0) + ' · 스타일 ' + (f.styles || 0) + ' · 캐릭터 ' + (f.characters || 0) + ' · 씬 ' + (f.scenes || 0)) : '내용 확인 전';
          d.innerHTML = '<b>' + esc(name) + '</b><div class="hint">' + esc(pre) + '</div>' +
            '<div class="row"><button class="btn xs" data-a="peek">내용 보기</button>' +
            '<button class="btn xs primary" data-a="merge" hidden>합치기</button>' +
            '<button class="btn xs danger" data-a="replace" hidden>덮어쓰기</button></div>';
          let snap = null;
          const info = d.querySelector('.hint');
          d.querySelector('[data-a=peek]').onclick = async () => {
            info.textContent = '읽는 중…';
            try {
              const rr = await apiFetch('/state?file=' + encodeURIComponent(name));
              if (!rr.ok) throw new Error('HTTP ' + rr.status);
              snap = await rr.json();
              info.textContent = (snap.savedAt ? new Date(snap.savedAt).toLocaleString() + ' · ' : '')
                + '청크 ' + (snap.chunks || []).length + ' · 스타일 ' + (snap.styles || []).length
                + ' · 캐릭터 ' + (snap.characters || []).length + ' · 씬 ' + (snap.scenes || []).length
                + ' · 채점 ' + (snap.judgeLog || []).length;
              d.querySelector('[data-a=merge]').hidden = false;
              d.querySelector('[data-a=replace]').hidden = false;
            } catch (e) { info.textContent = '✖ ' + e.message; }
          };
          const apply = replace => {
            if (!snap) return;
            if (replace && !confirm('현재 설정(청크·스타일·캐릭터·씬)을 이 백업으로 교체합니다. 계속할까요?')) return;
            const sameKey = (x, y) => (typeof normKey === 'function' ? normKey(x) === normKey(y) : String(x || '').toLowerCase() === String(y || '').toLowerCase());
            const mergeBy = (x, y, k) => { const out = [...(x || [])]; (y || []).forEach(v => { if (!out.some(z => sameKey(z[k], v[k]))) out.push(v); }); return out; };
            // 되살린 항목이 옛 삭제 기록에 다시 걸리지 않게 톰스톤을 걷는다
            S.deleted = S.deleted || {};
            const untombAll = (kind, keys) => (keys || []).forEach(k2 => { if (k2 != null) S.deleted[kind + '|' + String(k2).toLowerCase()] = 0; });
            untombAll('chunk', (snap.chunks || []).map(c => c.name));
            untombAll('style', (snap.styles || []).map(x => x.id));
            untombAll('char', (snap.characters || []).map(c => c.name));
            untombAll('scene', (snap.scenes || []).map(x => x.id));
            untombAll('cat', snap.chunkCats || []);
            if (replace) {
              S.chunks = snap.chunks || []; S.styles = snap.styles || [];
              S.characters = snap.characters || []; S.scenes = snap.scenes || [];
              S.chunkCats = snap.chunkCats || S.chunkCats;
            } else {
              S.chunks = mergeBy(S.chunks, snap.chunks, 'name');
              S.styles = mergeBy(S.styles, snap.styles, 'id');
              S.characters = mergeBy(S.characters, snap.characters, 'name');
              S.scenes = mergeBy(S.scenes, snap.scenes, 'id');
              S.chunkCats = [...new Set([...(S.chunkCats || []), ...(snap.chunkCats || [])])];
            }
            S.savedAt = Date.now(); save();
            if (replace && typeof pushStateToServer === 'function') pushStateToServer(true).catch(() => {});
            try { syncUI(); renderChunkBar(); if (typeof renderStyleSelects === 'function') renderStyleSelects(); } catch (e) {}
            toast(replace ? '서버 백업으로 교체했습니다' : '서버 백업을 합쳤습니다');
          };
          d.querySelector('[data-a=merge]').onclick = () => apply(false);
          d.querySelector('[data-a=replace]').onclick = () => apply(true);
          box.appendChild(d);
        }
      } catch (e) { st.textContent = '✖ ' + e.message; }
    };
  }, true);
}

/* ─────────────── EXIF 도구 ─────────────── */
function openExifTool() {
  openModal('EXIF / 메타데이터 제거 도구', body => {
    body.innerHTML = `<div class="hint">PNG의 텍스트 청크(tEXt·iTXt·zTXt·eXIf·tIME)뿐 아니라 NAI가 <b>알파 채널에 숨겨 넣는 stealth pnginfo</b>까지 제거합니다 (픽셀 재인코딩 — 보이는 이미지는 동일). 제거 후 "메타 보기"로 확인하면 청크 0개 · 숨은 메타 없음이어야 합니다.</div>
      <div class="drop" id="xDrop" style="width:100%;min-height:70px">이미지 드롭 또는 클릭 (여러 장 가능)</div>
      <div id="xList"></div><button class="btn primary" id="xAll" hidden>⬇ 전부 제거해서 저장</button>`;
    const list = body.querySelector('#xList'), files = [];
    const addFile = async f => {
      const u8 = new Uint8Array(await f.arrayBuffer()); const chunks = await pngTextChunks(u8);
      const row = document.createElement('div'); row.className = 'exif-row';
      row.innerHTML = `<img src="${URL.createObjectURL(f)}"><div class="name"></div><button class="btn sm">메타 보기</button><button class="btn sm go">제거 저장</button>`;
      row.querySelector('.name').textContent = `${f.name} — 메타 청크 ${chunks.length}개 · 숨은 메타 확인 중…`;
      blobHasStealth(f).then(st => { row.querySelector('.name').textContent = `${f.name} — 메타 청크 ${chunks.length}개 · 숨은(stealth) 메타 ${st ? '있음 (' + st + ')' : '없음'}`; });
      row.children[2].onclick = () => openMetaViewer(f, f.name);
      row.children[3].onclick = async () => downloadBlob(await stripBlob(f), 'clean_' + f.name);
      list.appendChild(row); files.push({ f, u8 }); body.querySelector('#xAll').hidden = false;
    };
    const drop = body.querySelector('#xDrop'); bindDrop(drop, addFile, true); drop.onclick = () => pickFiles(true, addFile, 'image/png');
    // 스마트 툴에 이미 이미지를 올려둔 채로 이 도구를 열면 그것부터 넣어준다.
    // 예전엔 빈 드롭창만 떠서, 히스토리에서 가져온 이미지는 메타를 지울 방법이 아예 없었다.
    if (typeof ST !== 'undefined' && ST.blob) {
      const f = new File([ST.blob], (ST.meta && ST.meta.name) || 'image.png', { type: ST.blob.type || 'image/png' });
      addFile(f);
    }
    body.querySelector('#xAll').onclick = async () => { for (const { f } of files) downloadBlob(await stripBlob(f), 'clean_' + f.name); };
  });
}

/* ─────────────── init ─────────────── */
/* 국내 사이트 업로드용 검열 태그 — 매번 찾아 치지 않게 "검열" 분류 청크로 한 번만 깔아둔다.
   (사용자가 지우면 톰스톤이 남아 다시 생기지 않는다) */
const CENSOR_CHUNKS = [
  ['검열_검은바', 'bar_censor'], ['검열_모자이크', 'mosaic_censoring'], ['검열_별', 'star_censor'],
  ['검열_하트', 'heart_censor'], ['검열_이모지', 'emoji_censor'], ['검열_소품', 'novelty_censor'],
  ['검열_블러', 'blur_censor'], ['검열_테이프', 'tape_censor'], ['검열_비우기', 'blank_censor'],
  ['검열_낙서', 'scribble_censor'], ['검열_글리치', 'glitch_censor'], ['검열_X표시', 'treasure_mark_censor'],
  ['검열_텍스트', 'censored_by_text'], ['검열_유두만', 'censored_nipples'],
  ['검열_자연스럽게', 'convenient_censoring'], ['검열_머리카락', 'hair_censor'],
  ['검열_수증기', 'steam_censor'], ['검열_빛', 'light_censor'],
  ['검열_옷위로', 'covered_penis, covered_erection'], ['검열_프레임밖', 'out_of_frame'],
];
function seedCensorChunks() {
  if (S.censorSeeded) return;
  S.censorSeeded = true;
  S.chunks = S.chunks || [];
  let n = 0;
  for (const [name, text] of CENSOR_CHUNKS) {
    if (S.chunks.some(c => normKey(c.name) === normKey(name))) continue;
    if (isTombed(S.deleted, 'chunk', name)) continue;    // 지운 것은 되살리지 않음
    // seeded: 앱이 자동으로 심은 것. "사용자가 만든 내용" 개수에서 빼야
    // 빈 브라우저 보호가 제대로 걸린다 (contentCount 참고)
    S.chunks.push({ name, text, cat: '검열', createdAt: Date.now(), seeded: true }); n++;
  }
  if (n) { addChunkCat('검열'); save(); }
}
/* 작가태그 모음 (사용자 정리본) — 조각(<작가랜덤>)·네거·베이스 스타일을 한 번만 깔아둔다.
   지우면 톰스톤이 남아 다시 생기지 않는다. */
const ARTIST_SEED = {
  frag: "artist:dishwasher1910\nartist:mery_(yangmalgage)\nartist:ninahachi\nartist:alp\nartist:pigeon666\nartist:freng\nartist:luicent\nartist:gogalking\nartist:remsrar\nartist:ratatatat74\nartist:sukja\nartist:meion\nartist:ie_(raarami)\nartist:qiandaiyiyu\nartist:quasarcake\nartist:gearous\nartist:honnryou_hanaru\nartist:duckchuni\nartist:kuzuvine\nartist:mx2j\nartist:healthyman\nartist:alzi_xiaomi\nartist:hwan_(mob_hwan)\nartist:chalseu\nartist:eriimyon\nartist:fymrie\nartist:hamelon310\nartist:wanke\nartist:dreaming_oor\nartist:soybean_(hisoybean)\nartist:m_m_pb\nartist:jo_tuesday19\nartist:96yottea\nartist:eichi_turnr\nartist:haze_(ohw8g)\nartist:ierotak\nartist:ppap_(11zhakdpek19)\nartist:yoggi_(stretchmen)\nartist:fujo0t4ku\nartist:sangobob\nartist:haban_(haban35)\nartist:qianben_shan\nartist:sakanaokashi\nartist:ena_(enaa97)\nartist:channel_(caststation)\nartist:oxy_(ho2)\nartist:seeshin_see\nartist:ttnoooo\nartist:patzzi\nartist:etceteraart\nartist:siho_is_alien\nartist:lal!role\nartist:naku_(naku999ziye)\nartist:yalmyu\nartist:legacy_zechs\nartist:4the2ofus\nartist:mgmg_1012\nartist:neilos\nartist:on_(onon2659)\nartist:ton_(ton19130318)\nartist:ru_(famia)\nartist:ebi_(shrimp_eleven)\nartist:tobo_katsuo\nartist:kaohom503\nartist:nong_345\nartist:jnkku\nartist:ndsoda\nartist:geckobara\nartist:urielbeaupre15\nartist:zeka_(skzk_cm)\nartist:dao_(daao_bf)\nartist:inplick\nartist:qiqu\nartist:xian_miao\nartist:tenji_(tenji_89)\nartist:azuma_hatori\nartist:kkamiiz\nartist:0820_lakia\nartist:paguraisu\nartist:suzumi_(ccroquette)\nartist:nishita\nartist:keita_kg85\nartist:songyeerhu\nartist:miying_(ho_ru03_15)\nartist:dandalian\nartist:dlckrpwjd111\nartist:fan_mu_zhang\nartist:honey_dogs\nartist:gugusam0\nartist:azha8\nartist:junjam\nartist:qinnye\nartist:sso_s\nartist:treslech3s\nartist:baegji13\nartist:dal_li_0130\nartist:iba_(kcokaine)\nartist:miyamoyan\nartist:raineemeow\nartist:le_(szs0k)\nartist:chamsut0905\nartist:erming225\nartist:kamonekm\nartist:bloodybeni\nartist:gugong_(90_un)\nartist:en_(e898n)\nartist:ikaooi1\nartist:nidexintu\nartist:teeniika\nartist:muksal\nartist:kikiccree\nartist:ashima_(roro046)\nartist:chanoo_artz\nartist:hechu_237",
  neg: "artist:bkub, artist:milkpanda, artist:kurukurumagical, artist:pageratta, artist:wlop, artist:ame_(uten_cancel), artist:da_mao_banlangen, artist:gaoo_(frpjx283), artist:ishikawa_hideki, artist:nameo_(judgemasterkou)",
  base: "1boy, solo,\nyear 2024, year 2025,\nplain white background, straight-on, portrait,\nbest quality, perfect anatomy, detailed line, detailed hair",
  baseUc: "low quality, bad anatomy, bad hands, bad feet, bad proportions, worst quality, jpeg artifacts, watermark, logo, name, artist:bkub, artist:milkpanda, artist:kurukurumagical, artist:pageratta, artist:wlop, artist:ame_(uten_cancel), artist:da_mao_banlangen, artist:gaoo_(frpjx283), artist:ishikawa_hideki, artist:nameo_(judgemasterkou), 5::makeup::, sepia, shark teeth, beard, mustache, multiple boys, halo, background halo, blurry",
};
function seedArtistPack() {
  if (S.artistSeeded) return;
  S.artistSeeded = true;
  S.chunks = S.chunks || []; S.styles = S.styles || [];
  const add = (name, text, cat) => {
    if (S.chunks.some(c => normKey(c.name) === normKey(name))) return 0;
    if (isTombed(S.deleted, 'chunk', name)) return 0;
    S.chunks.push({ name, text, cat, createdAt: Date.now(), seeded: true }); return 1;
  };
  let n = 0;
  n += add('작가랜덤', ARTIST_SEED.frag, '작가');   // 여러 줄 = 조각 → <작가랜덤> 이 매번 한 명씩 뽑음
  n += add('작가네거', ARTIST_SEED.neg, '작가');
  if (n) addChunkCat('작가');
  if (!S.styles.some(s => s.name === '작태 뽑기') && !isTombed(S.deleted, 'style', 'artist-pack')) {
    S.styles.push({ id: 'artist-pack', name: '작태 뽑기', prefix: ARTIST_SEED.base, suffix: '',
      uc: ARTIST_SEED.baseUc, createdAt: Date.now(), seeded: true });
    n++;
  }
  if (n) save();
}

/* 기본 청크·작가팩은 **서버 상태를 받은 뒤에** 심는다.
   예전엔 부팅 순서가 initTools() → srvLoop() → pullStateFromServer() 라,
   그 브라우저의 (아직 비어 있는) 삭제 기록만 보고 심었다 — 사이트 데이터를 지웠거나
   다른 브라우저로 처음 열면, 지워 뒀던 검열·작가 청크가 통째로 되살아나 서버까지 덮었다. */
function seedDefaults() { try { seedCensorChunks(); seedArtistPack(); } catch (e) {} }
function initTools() {
  if (R.booted) seedDefaults();          // 서버 없이 도는 경우(로컬 전용)엔 바로 심는다
  else { const prev = window.onServerUp; window.onServerUp = () => { seedDefaults(); if (prev) prev(); };
         setTimeout(() => { if (!R.srvOk) seedDefaults(); }, 8000); }   // 서버가 끝내 안 뜨면 그때 심는다
  initSmartTools();
  const ai = $('#btnAiPrompt'); if (ai) ai.onclick = () => openAiPrompt();
  const ub = $('#btnUpdate'); if (ub) ub.onclick = () => openUpdate();
  /* 새 버전 확인. 서버는 매번 GitHub 에 직접 물어보므로 조회 자체는 실시간인데,
     예전엔 앱이 6시간에 한 번만 물어봐서 켜 둔 채로는 반나절 뒤에야 표시가 떴다.
     → 30분마다, 그리고 창으로 돌아올 때(5분 이상 지났으면) 확인한다.
     GitHub 익명 조회 한도는 시간당 60회라 이 빈도로는 여유가 크다. */
  let updLast = 0;   // UPD 는 파일 아래에서 선언되므로 여기서는 지역 변수로 둔다
  const updTick = (force) => {
    const now = Date.now();
    if (!force && now - updLast < 5 * 60 * 1000) return;
    updLast = now;
    updateCheck(true);
  };
  setTimeout(() => updTick(true), 4000);
  setInterval(() => updTick(true), 30 * 60 * 1000);
  addEventListener('focus', () => updTick(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updTick(false); });
  // 4초 초기 확인은 서버가 아직 안 붙었으면 조용히 실패한다. 그때는 30분을 기다리게 되므로
  // 서버가 붙는 순간에도 한 번 확인한다.
  window.onServerUp = (orig => () => { if (orig) orig(); updTick(false); })(window.onServerUp);
  renderChunkBar(); initChunkFloat();
  document.body.classList.toggle('show-chunks', !!S.showChunkBars);
  $('#btnChunks').onclick = () => openChunkManager();
  $('#btnSaveChunkSel').onclick = saveSelectionAsChunk;
  $('#btnExif').onclick = openExifTool;
  $('#btnNaiImport').onclick = openNaiImport;
  { const qb = $('#btnQuickstart'); if (qb) qb.onclick = openQuickstart; }
  qsSync();
  $('#btnBackup').onclick = openBackup;
  { const hb = $('#btnHealth'); if (hb) hb.onclick = openHealth; }
  $('#tEnhance').onclick = () => enhPanelToggle(); $('#tUpscale').onclick = toolUpscale; $('#tVary').onclick = toolVary;   // ✨ = NAI 처럼 인핸스 창 열고 닫기
  $('#tInpaint').onclick = () => toolInpaint().catch(e => { logErr('그림판 열기 실패: ' + e.message); toast('그림판을 열지 못했습니다: ' + e.message, 'err'); });
  $('#tEdit').onclick = () => toolEdit().catch(e => { logErr('그림판 열기 실패: ' + e.message); toast('그림판을 열지 못했습니다: ' + e.message, 'err'); });
  $('#tDirector').onclick = openDirector;
  initYouTube();
}

/* ═══════════════ 스마트 툴 탭 — 이미지 하나에 도구를 모아서 ═══════════════ */
const ST = { blob: null, url: null, w: 0, h: 0, meta: null };
function stSet(blob, meta) {
  if (ST.url) URL.revokeObjectURL(ST.url);
  ST.blob = blob; ST.meta = meta || null;
  /* 크기를 먼저 지운다. 예전엔 새 이미지를 올려도 디코딩이 끝날 때까지 앞 이미지의
     크기가 남아 있었고, 그 사이에 툴을 누르면 엉뚱한 크기로 유료 요청이 나갔다.
     (디코딩이 실패하면 앞 크기가 영원히 남았다 — onerror 도 없었다) */
  ST.w = 0; ST.h = 0;
  ST.url = blob ? URL.createObjectURL(blob) : null;
  const img = $('#stImg'), em = $('#stEmpty');
  if (!img) return;
  /* 그림이 들어 있을 때만 '빼기 · 다른 그림 · 현재 그림으로' 줄을 보인다.
     예전엔 「이미지 열기」·「현재 이미지 가져오기」가 빈 화면 안에만 있어서, 그림을 한 번 넣으면
     그 단추까지 같이 사라져 뺄 방법이 없었다(2026-10, 한 번 넣으면 뺄 방법이 없다는 보고). */
  const bar = $('#stBar'); if (bar) bar.hidden = !blob;
  if (!blob) { img.hidden = true; img.removeAttribute('src'); em.hidden = false; $('#stMeta').textContent = ''; renderSmartTools(); return; }
  img.src = ST.url; img.hidden = false; em.hidden = true;
  $('#stMeta').textContent = '크기 확인 중…'; renderSmartTools();   // 크기를 모르는 동안은 툴을 잠근다
  const probe = new Image();
  probe.onload = () => { ST.w = probe.naturalWidth; ST.h = probe.naturalHeight; $('#stMeta').textContent = `${ST.w}×${ST.h}`; renderSmartTools(); };
  probe.onerror = () => { ST.w = 0; ST.h = 0; $('#stMeta').textContent = '이미지를 읽지 못했습니다'; renderSmartTools(); toast('이미지를 읽지 못했습니다 — 다른 파일로 시도해 주세요', 'err'); };
  probe.src = ST.url;
}
const ST_TOOLS = [
  { k: 'bg-removal', ic: '🪄', n: '배경 제거', d: '인물만 남기고 배경을 투명하게', run: it => runDirector({ req_type: 'bg-removal', width: it.w, height: it.h, image: it.b64 }, '배경 제거', it) },
  { k: 'lineart', ic: '✒', n: '라인아트 추출', d: '선화로 변환', run: it => runDirector({ req_type: 'lineart', width: it.w, height: it.h, image: it.b64 }, '선화 추출', it) },
  { k: 'sketch', ic: '✏', n: '스케치 변환', d: '연필 스케치 스타일', run: it => runDirector({ req_type: 'sketch', width: it.w, height: it.h, image: it.b64 }, '스케치', it) },
  { k: 'declutter', ic: '🧽', n: '이미지 정리', d: '텍스트·잡동사니 제거', run: it => runDirector({ req_type: 'declutter', width: it.w, height: it.h, image: it.b64 }, '정리', it) },
  { k: 'declutter-keep-bubbles', ic: '💬', n: '정리 (말풍선 유지)', d: '잡동사니만 지우고 말풍선은 남김', run: it => runDirector({ req_type: 'declutter-keep-bubbles', width: it.w, height: it.h, image: it.b64 }, '정리(말풍선 유지)', it) },
  { k: 'colorize', ic: '🎨', n: '색칠하기', d: '선화·흑백에 색을 입힙니다', prompt: '색상 힌트 (예: red hair, blue eyes)', defry: true,
    run: (it, o) => runDirector({ req_type: 'colorize', width: it.w, height: it.h, image: it.b64, prompt: o.prompt, defry: o.defry }, '채색', it) },
  { k: 'emotion', ic: '🙂', n: '표정 변경', d: '감정을 골라 표정을 바꿉니다', emo: true, prompt: '추가 프롬프트 (선택)', defry: true,
    run: (it, o) => runDirector({ req_type: 'emotion', width: it.w, height: it.h, image: it.b64, prompt: o.emo + ';;' + (o.prompt || ''), defry: o.defry }, '표정 변경', it) },
  { k: 'upscale', ic: '⤢', n: '업스케일', d: '2배 확대 · V5 로 다시 그림 (1024² 이하만)', run: it => runUpscale(it.item, 'tool') },
  { k: 'pixel-snap', ic: '▦', n: 'Pixel Snap', d: 'AI 가 만든 도트 그림을 깔끔하게 다듬습니다 · 브라우저에서 처리 · 무료', ps: true,
    run: it => runPixelSnap({ blob: it.blob, meta: it.item.meta }, PS.opts) },
  { k: 'i2i', ic: '🖼', n: '이미지 투 이미지', d: '이 이미지를 바탕으로 다시 생성', run: it => { setI2I(it.blob, it.meta, true); setMode('main'); toast('메인 탭의 i2i 로 넣었습니다'); } },
  { k: 'edit', ic: '✏', n: '편집', d: '그림판에서 색칠·지우기·그림 넣기·캔버스 늘리기 뒤 바탕 그림으로', run: async it => { setMode('main'); await cvEditImage(it.blob, it.meta); } },
  { k: 'inpaint', ic: '🖌', n: '인페인팅', d: '칠한 부분만 다시 그리기 (그림판 마스크 모드)', run: async it => { setMode('main'); await cvInpaintItem(it.blob, it.meta); } },
  { k: 'mosaic', ic: '▦', n: '모자이크 / 검열', d: '부위를 골라 모자이크·블러 처리', run: it => openMosaicTool(it.blob) },
  { k: 'meta', ic: '🧹', n: '메타데이터 제거', d: 'EXIF·숨은 정보를 지워 저장', run: () => openExifTool() },
];
function renderSmartTools() {
  const list = $('#stList'); if (!list) return;
  const has = !!ST.blob;
  /* 요금은 툴마다 다르다 — 배경 제거만 3배+5 이고 Opus 무료도 못 받는다.
     예전엔 위에 한 줄(일반 툴 기준 'Opus 무료')만 띄워서, 바로 아래 배경 제거 카드를 누르면
     표시와 달리 65 Anlas 가 나갔다(ST.tool 은 어디서도 정해지지 않는 값이었다). → 카드마다 붙인다. */
  const DT = new Set(DIRECTOR.map(d => d[0]).filter(k => k !== 'pixel-snap'));   // Pixel Snap 은 NAI 처럼 요금이 없다(브라우저에서 처리)
  const costOf = k => (has && ST.w && typeof directorToolCost === 'function') ? directorToolCost(ST.w, ST.h, !!R.isOpus, R.opusUsage, k) : null;
  const fmt = c => c == null ? '' : (c === 0 ? 'Opus 무료' : '◈ ' + c);
  const ce = $('#stCost');
  if (ce) { const g = costOf('lineart'), b = costOf('bg-removal');
    ce.textContent = g == null ? '' : `디렉터 툴 ${fmt(g)} · 배경 제거 ${fmt(b)}`; }
  list.innerHTML = '';
  for (const t of ST_TOOLS) {
    const c = document.createElement('div'); c.className = 'st-card' + (has ? '' : ' off');
    const tc = DT.has(t.k) ? fmt(costOf(t.k)) : (t.k === 'upscale' && has && ST.w ? upscaleCostLabel(ST.w, ST.h, 'tool') : '');
    c.innerHTML = `<div class="st-t"><span class="st-i">${t.ic}</span><b>${t.n}</b></div><div class="hint">${t.d}${tc ? ` · <b>${tc}</b>` : ''}</div><div class="st-opt"></div>
      <button class="btn sm primary st-go"${has ? '' : ' disabled'}>실행</button>`;
    const opt = c.querySelector('.st-opt');
    if (t.emo) opt.innerHTML += `<label class="fld">표정<select class="st-emo">${EMOTIONS.map(e => `<option>${e}</option>`).join('')}</select></label>`;
    if (t.prompt) opt.innerHTML += `<input type="text" class="st-p" placeholder="${t.prompt}">`;
    if (t.defry) opt.innerHTML += `<label class="rng">원본 유지도 <output class="st-dv">0</output><input type="range" class="st-d" min="0" max="5" step="1" value="0"></label>`;
    if (t.ps) {   // NAI 이미지 툴 Pixel Snap 칸 — 지원하지 않는 브라우저면 NAI 처럼 안내만 두고 실행 단추를 막는다
      if (psSupported()) { opt.innerHTML += psOptsHtml(); psBindOpts(opt); }
      else { opt.innerHTML += '<div class="hint" style="color:var(--gold)">이 브라우저에서는 Pixel Snap 을 쓸 수 없습니다</div>'; c.querySelector('.st-go').disabled = true; }
    }
    const dr = c.querySelector('.st-d'); if (dr) dr.oninput = () => c.querySelector('.st-dv').textContent = dr.value;
    c.querySelector('.st-go').onclick = async () => {
      if (!ST.blob) return;
      const o = {
        prompt: (c.querySelector('.st-p') || {}).value || '',
        defry: dr ? +dr.value : 0,
        emo: (c.querySelector('.st-emo') || {}).value || 'neutral',
      };
      const it = { blob: ST.blob, w: ST.w, h: ST.h, b64: await blobToB64(ST.blob), item: { blob: ST.blob, w: ST.w, h: ST.h, meta: ST.meta || { parameters: {} } } };
      try { await t.run(it, o); } catch (e) { toast(e.message, 'err'); }
    };
    list.appendChild(c);
  }
}
function initSmartTools() {
  const drop = $('#stDrop'); if (!drop) return;
  const f = $('#stFile');
  $('#stOpen').onclick = () => f.click();
  f.onchange = () => { if (f.files[0]) stSet(f.files[0]); f.value = ''; };
  const fromCur = () => { const it = curItem(); if (!it) { toast('히스토리에 이미지가 없습니다', 'err'); return; } stSet(it.blob, it.meta); };
  $('#stFromCur').onclick = fromCur;
  // 그림이 들어 있을 때 보이는 줄 (stSet 참고)
  if ($('#stClear')) $('#stClear').onclick = () => { stSet(null); toast('스마트 툴에서 그림을 뺐습니다'); };
  if ($('#stOpen2')) $('#stOpen2').onclick = () => f.click();
  if ($('#stFromCur2')) $('#stFromCur2').onclick = fromCur;
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    const fl = [...(e.dataTransfer.files || [])].filter(x => x.type.startsWith('image/'));
    if (fl.length) stSet(fl[0]);
  });
  $('#stImg').onclick = () => { if (ST.url) window.open(ST.url, '_blank', 'noopener'); };
  window.renderSmartTools = renderSmartTools;
  // 새 이미지가 생성되면 스마트 툴 탭에 있을 때 자동으로 물려준다
  const prev = window.onImageGenerated;
  window.onImageGenerated = it => { if (prev) prev(it); if (S.mode === 'tools' && it && it.blob) stSet(it.blob, it.meta); };
}

/* 모자이크 / 검열 도구 — 칠한 부분을 모자이크·블러·검은 바로 덮어 저장.
   국내 사이트 업로드 시 성기 노출을 가려야 해서 필요. */
function openMosaicTool(blob) {
  if (!blob) { toast('이미지를 먼저 넣으세요', 'err'); return; }
  blobToImage(blob).then(img => {
    openModal('▦ 모자이크 / 검열 — 가릴 부분을 칠하세요', body => {
      const ctl = document.createElement('div'); ctl.className = 'row';
      ctl.innerHTML = `<label class="fld">방식<select id="mzKind"><option value="mosaic">모자이크</option><option value="blur">블러</option><option value="bar">검은 바</option></select></label>
        <label class="rng">세기 <output id="mzSV">14</output><input type="range" id="mzS" min="4" max="48" value="14" style="width:120px"></label>
        <label class="rng">브러시 <output id="mzBV">40</output><input type="range" id="mzB" min="8" max="180" value="40" style="width:120px"></label>
        <button class="btn sm" id="mzUndo">되돌리기</button><button class="btn sm danger" id="mzClear">전체 지우기</button>
        <button class="btn sm go" id="mzSave">✔ 적용해서 저장</button>`;
      body.appendChild(ctl);
      const wrap = document.createElement('div'); wrap.className = 'mzwrap'; body.appendChild(wrap);
      const W = img.naturalWidth, H = img.naturalHeight;
      const view = document.createElement('canvas');            // 화면 표시용
      const maxW = Math.min(880, innerWidth - 120), sc = Math.min(1, maxW / W);
      view.width = Math.round(W * sc); view.height = Math.round(H * sc);
      view.style.cursor = 'crosshair'; wrap.appendChild(view);
      const vx = view.getContext('2d');
      const mask = document.createElement('canvas'); mask.width = W; mask.height = H;   // 원본 해상도 마스크
      const mx = mask.getContext('2d');
      const strokes = [];
      const redraw = () => {
        vx.clearRect(0, 0, view.width, view.height);
        vx.drawImage(img, 0, 0, view.width, view.height);
        vx.save(); vx.globalAlpha = 0.55; vx.fillStyle = '#f0f';
        vx.drawImage(mask, 0, 0, view.width, view.height); vx.restore();
      };
      redraw();
      let drawing = false, last = null;
      const brush = () => +body.querySelector('#mzB').value;
      const pt = e => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / view.width * W, y: (e.clientY - r.top) / view.height * H }; };
      const stroke = (a, b) => {
        mx.strokeStyle = '#fff'; mx.fillStyle = '#fff'; mx.lineCap = 'round';
        mx.lineWidth = brush() * (W / view.width);
        mx.beginPath(); mx.moveTo(a.x, a.y); mx.lineTo(b.x, b.y); mx.stroke();
      };
      view.onpointerdown = e => { drawing = true; view.setPointerCapture(e.pointerId); last = pt(e); strokes.push(mask.toDataURL()); stroke(last, last); redraw(); };
      view.onpointermove = e => { if (!drawing) return; const p = pt(e); stroke(last, p); last = p; redraw(); };
      view.onpointerup = () => { drawing = false; };
      body.querySelector('#mzB').oninput = e => body.querySelector('#mzBV').textContent = e.target.value;
      body.querySelector('#mzS').oninput = e => body.querySelector('#mzSV').textContent = e.target.value;
      body.querySelector('#mzClear').onclick = () => { strokes.push(mask.toDataURL()); mx.clearRect(0, 0, W, H); redraw(); };
      body.querySelector('#mzUndo').onclick = async () => {
        const d = strokes.pop(); if (!d) return;
        const im = new Image(); im.src = d; await im.decode();
        mx.clearRect(0, 0, W, H); mx.drawImage(im, 0, 0); redraw();
      };
      body.querySelector('#mzSave').onclick = async () => {
        const kind = body.querySelector('#mzKind').value, str = +body.querySelector('#mzS').value;
        const out = document.createElement('canvas'); out.width = W; out.height = H;
        const ox = out.getContext('2d');
        ox.drawImage(img, 0, 0);
        // 효과를 입힌 전체 이미지를 따로 만들고, 마스크 모양으로만 덮어씌운다
        const fx = document.createElement('canvas'); fx.width = W; fx.height = H;
        const fc = fx.getContext('2d');
        if (kind === 'bar') { fc.fillStyle = '#000'; fc.fillRect(0, 0, W, H); }
        else if (kind === 'blur') { fc.filter = `blur(${str}px)`; fc.drawImage(img, 0, 0); fc.filter = 'none'; }
        else { // 모자이크: 축소 후 확대
          const sw = Math.max(1, Math.round(W / str)), sh = Math.max(1, Math.round(H / str));
          const tiny = document.createElement('canvas'); tiny.width = sw; tiny.height = sh;
          const tc = tiny.getContext('2d'); tc.imageSmoothingEnabled = true; tc.drawImage(img, 0, 0, sw, sh);
          fc.imageSmoothingEnabled = false; fc.drawImage(tiny, 0, 0, sw, sh, 0, 0, W, H);
        }
        fc.globalCompositeOperation = 'destination-in'; fc.drawImage(mask, 0, 0);
        ox.drawImage(fx, 0, 0);
        /* 가린 부분 말고 나머지 픽셀은 원본 그대로 옮겨진다. NAI 가 알파 채널에 숨겨 넣는
           stealth 메타도 같이 따라와서, 가리려고 만든 이미지에 원본 프롬프트가 남는다.
           → 알파 최하위 비트를 눌러 숨은 정보를 깬다 (완전 투명은 건드리지 않는다). */
        try {
          const sd = ox.getImageData(0, 0, W, H);
          for (let i = 3; i < sd.data.length; i += 4) if (sd.data[i] !== 0) sd.data[i] |= 1;
          ox.putImageData(sd, 0, 0);
        } catch (e) {}
        const nb = await new Promise(r => out.toBlob(r, 'image/png'));
        closeModal();
        const item = await addToHistory(nb, ST.meta || { parameters: {} }, '검열 ' + (kind === 'bar' ? '검은바' : kind === 'blur' ? '블러' : '모자이크'));
        stSet(nb, ST.meta);
        if (S.autoSaveOn) autoSave(item);
        toast('적용했습니다 — 히스토리에 추가됨');
      };
    }, true);
  });
}

/* ═══════════ AI 프롬프트 생성 (Gemini) — 한국어 장면 설명 → 단부루 태그 ═══════════ */
const GEMINI_MODELS = [
  ['gemini-2.5-flash', 'Gemini 2.5 Flash (빠름·권장)'],
  ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite (가장 빠름)'],
  ['gemini-2.5-pro', 'Gemini 2.5 Pro (품질)'],
  ['gemini-3-flash-preview', 'Gemini 3 Flash (프리뷰)'],
  ['gemini-3-pro-preview', 'Gemini 3 Pro (프리뷰)'],
];
function openAiPrompt(targetTA) {
  /* 창을 열기 전에 '지금 쓰던 칸' 을 붙잡아 둔다 — 창이 열리면 포커스가 창 안으로 옮겨가 어디에 넣을지 잃어버린다 */
  if (!targetTA && typeof activeTA === 'function') targetTA = activeTA();
  openModal('✨ AI 프롬프트 생성 — 원하는 장면을 한국어로 쓰면 단부루 태그로 바꿔줍니다', body => {
    body.innerHTML = `
      <label class="fld">모델<select id="aiModel">${GEMINI_MODELS.map(([v, n]) => `<option value="${v}"${v === (S.aiModel || 'gemini-2.5-flash') ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fld">장면 설명<textarea id="aiDesc" class="ta" rows="4" placeholder="예: 카페에서 커피를 마시는 은발 소녀, 창밖은 비, 위에서 내려다보는 구도"></textarea></label>
      <div class="row"><button class="btn primary" id="aiGo">✨ 생성</button><span class="hint">Ctrl+Enter 로도 생성</span></div>
      <div class="hint" id="aiNote" hidden style="white-space:pre-wrap;padding:6px 8px;border-radius:6px"></div>
      <label class="fld">결과 (수정 가능)<textarea id="aiOut" class="ta ac" rows="4" placeholder="여기에 태그가 나옵니다"></textarea></label>
      <div class="row"><button class="btn go" id="aiIns">프롬프트에 넣기</button><button class="btn sm" id="aiApp">뒤에 이어붙이기</button>
        <span class="hint" id="aiMsg"></span></div>
      <label class="fld" id="aiNegWrap" hidden>네거티브 (수정 가능)<textarea id="aiNeg" class="ta ac" rows="3"></textarea></label>
      <div class="row" id="aiNegRow" hidden><button class="btn sm" id="aiNegIns">네거티브 칸에 넣기</button><button class="btn sm" id="aiNegApp">네거티브 뒤에 이어붙이기</button></div>`;
    const desc = body.querySelector('#aiDesc'), out = body.querySelector('#aiOut'), msg = body.querySelector('#aiMsg');
    const note = body.querySelector('#aiNote'), neg = body.querySelector('#aiNeg');
    const negWrap = body.querySelector('#aiNegWrap'), negRow = body.querySelector('#aiNegRow');
    const mdl = body.querySelector('#aiModel');
    mdl.onchange = () => { S.aiModel = mdl.value; save(); };
    const go = async () => {
      const t = desc.value.trim();
      if (!t) { toast('장면을 설명해 주세요', 'err'); return; }
      msg.textContent = '생성 중…'; body.querySelector('#aiGo').disabled = true;
      try {
        const res = await apiFetch('/ai/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, model: mdl.value }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.message || ('HTTP ' + res.status));
        out.value = j.tags || '';
        /* 새 지침은 한국어 분석과 네거티브까지 준다. 받아 놓고 안 쓰면 의미가 없다. */
        note.textContent = j.note || ''; note.hidden = !j.note;
        neg.value = j.negative || '';
        negWrap.hidden = negRow.hidden = !j.negative;
        // 실제로 존재하는 태그인지 표시 (AI가 없는 태그를 만들어 낼 수 있음)
        const parts = out.value.split(',').map(x => x.trim()).filter(Boolean);
        // 사전이 아직 안 읽혔으면 검사를 못 한 것이다 — 그걸 "전부 실존" 이라고 하면 안 된다
        const checked = !!TAGDB.map;
        const bad = checked ? parts.filter(p => !TAGDB.map.get(p.replace(/ /g, '_')) && !TAGDB.map.get(p)) : [];
        msg.textContent = `태그 ${parts.length}개`
          + (!checked ? ' · 사전을 아직 못 읽어 실존 확인 안 됨'
            : bad.length ? ` · 사전에 없는 것 ${bad.length}개: ${bad.slice(0, 4).join(', ')}` : ' · 전부 실존');
        if (!checked && typeof loadTagDb === 'function') loadTagDb();
      } catch (e) { msg.textContent = '✖ ' + e.message; toast(e.message, 'err'); }
      finally { body.querySelector('#aiGo').disabled = false; }
    };
    body.querySelector('#aiGo').onclick = go;
    /* 예전엔 버튼만 disabled 로 잠그고 Ctrl+Enter 는 그대로 go() 를 불렀다.
       꾹 누르거나 연타하면 그 횟수만큼 Gemini 호출이 나갔다(호출당 요금). 키도 같은 잠금을 본다. */
    desc.onkeydown = e => {
      if (e.key === 'Enter' && e.ctrlKey && !e.repeat) {
        e.preventDefault();
        if (body.querySelector('#aiGo').disabled) return;
        go();
      }
    };
    const put = append => {
      const v = out.value.trim(); if (!v) { toast('먼저 생성하세요', 'err'); return; }
      const ta = targetTA && document.contains(targetTA) ? targetTA : activeTA();
      if (!ta) { toast('프롬프트 칸을 먼저 클릭하세요', 'err'); return; }
      ta.value = append && ta.value.trim() ? ta.value.replace(/,\s*$/, '') + ', ' + v : v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (ta._hlSync) ta._hlSync();
      closeModal(); toast('프롬프트에 넣었습니다');
    };
    body.querySelector('#aiIns').onclick = () => put(false);
    body.querySelector('#aiApp').onclick = () => put(true);
    /* 네거티브는 대상 칸을 찾을 필요가 없다 — 언제나 #uc 다.
       (씬 화면에서도 #uc 가 본체이고 씬 칸은 거울이라 input 이벤트로 따라온다) */
    const putNeg = append => {
      const v = neg.value.trim(); if (!v) { toast('네거티브가 비어 있습니다', 'err'); return; }
      const u = $('#uc'); if (!u) { toast('네거티브 칸을 찾지 못했습니다', 'err'); return; }
      u.value = append && u.value.trim() ? u.value.replace(/,\s*$/, '') + ', ' + v : v;
      u.dispatchEvent(new Event('input', { bubbles: true }));
      if (u._hlSync) u._hlSync();
      toast(append ? '네거티브 뒤에 이어붙였습니다' : '네거티브에 넣었습니다');
    };
    body.querySelector('#aiNegIns').onclick = () => putNeg(false);
    body.querySelector('#aiNegApp').onclick = () => putNeg(true);
    setTimeout(() => desc.focus(), 40);
  }, true);
}

/* ── HLS 재생 (480p 이상) ─────────────────────────────────
   유튜브는 360p(itag 18) 말고는 영상+음성 합본을 HLS 로만 준다.
   크롬/파이어폭스는 HLS 를 네이티브로 못 읽어서 hls.js 를 쓰고,
   매니페스트 안의 주소는 서버(/yt/hls)가 전부 우리 프록시로 바꿔준다(CORS 회피). */
let _hlsLib = null;
async function ensureHlsLib() {
  if (_hlsLib !== null) return _hlsLib;
  if (window.Hls) { _hlsLib = window.Hls; return _hlsLib; }
  try {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = R.api + '/vendor/hls.js'; s.onload = res; s.onerror = () => rej(new Error('hls.js 로드 실패'));
      document.head.appendChild(s);
    });
    _hlsLib = window.Hls || null;      // 붙었는데 window.Hls 가 없으면 다음에 다시 시도
  } catch (e) { _hlsLib = null; logErr('hls.js 로드 실패: ' + (e && e.message || e)); return false; }
  /* 실패를 false 로 굳히면 안 된다 — 서버를 다시 켜는 중에 요청 하나만 실패해도
     그 뒤로 영영 고화질을 못 쓰고 360p 로만 재생되면서, 화질을 바꿔도 안 바뀐다. */
  return _hlsLib;
}
function ytDestroyHls() { if (YT._hls) { try { YT._hls.destroy(); } catch (e) {} YT._hls = null; } }
async function ytPlayHls(video, variant, load, item, resumeAt) {
  const url = R.api + '/yt/hls?u=' + encodeURIComponent(variant.u);
  ytDestroyHls();
  if (video.canPlayType('application/vnd.apple.mpegurl')) {    // 사파리는 네이티브
    video.src = url;
    ytSeekTo(video, resumeAt);
    try { await video.play(); } catch (e) {}
    if (load) load.hidden = true;
    YT.qualNow = variant.h; ytFillQualSelect();
    return true;
  }
  const Hls = await ensureHlsLib();
  if (!Hls || !Hls.isSupported()) return false;
  return await new Promise(resolve => {
    // 조각 하나 못 받았다고 곡을 통째로 놓치지 않도록 재시도를 넉넉히 준다.
    /* 이어볼 위치는 startPosition 으로 준다. MANIFEST_PARSED 시점에 currentTime 을 대입하는
       방식은 아직 버퍼도 seekable 구간도 없어서 브라우저가 그냥 무시할 때가 있다(0초부터 재생됨).
       startPosition 은 hls.js 가 그 지점의 조각부터 받아오게 하는 정식 경로다. */
    const h = new Hls({ maxBufferLength: 30, enableWorker: true,
      startPosition: resumeAt > 1 ? resumeAt : -1,
      fragLoadingMaxRetry: 8, fragLoadingRetryDelay: 500, fragLoadingMaxRetryTimeout: 8000,
      manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4 });
    YT._hls = h;
    let done = false, started = false, abandoned = false, netFix = 0, medFix = 0;
    /* 실패로 물러날 때는 반드시 인스턴스를 정리하고 손을 뗀다.
       특히 20초 타임아웃으로 물러난 경우, 예전 방식대로 인스턴스를 살려두면
       (1) 아래 progressive 로 재생이 시작된 뒤에 뒤늦게 치명적 오류가 나서
           ytHlsGiveUp 이 멀쩡히 나오던 재생을 다시 갈아엎고
       (2) YT._hls 가 참으로 남아 progressive 쪽 onerror 복구가 통째로 무시된다. */
    const finish = ok => {
      if (done) return;
      done = true;
      /* 정리는 "그때 만든 그 인스턴스" 만 해야 한다. 전역 ytDestroyHls() 를 부르면,
         그 사이 사용자가 다른 곡을 튼 경우 새로 만든 인스턴스를 죽인다
         (20초 타임아웃이 뒤늦게 도착하는 경우가 실제로 있었다). */
      if (!ok) {
        abandoned = true;
        if (YT._hls === h) ytDestroyHls();
        else { try { h.destroy(); } catch (e) {} }
      }
      resolve(ok);
    };
    const diag = m => (YT._diag = YT._diag || []).push('HLS ' + variant.h + 'p: ' + m);
    video.addEventListener('playing', () => { started = true; }, { once: true });
    h.on(Hls.Events.MANIFEST_PARSED, () => {
      if (load) load.hidden = true;
      YT.qualNow = variant.h; ytFillQualSelect();
      ytSeekTo(video, resumeAt);
      video.play().catch(() => {});
      finish(true);
    });
    h.on(Hls.Events.ERROR, (_e, d) => {
      if (!d.fatal || abandoned) return;
      diag(d.details || d.type);
      /* 여기가 "유튜브가 자꾸 처음으로 돌아가던" 자리다.
         hls.js 인스턴스를 destroy() 하면 detachMedia() 가 <video> 의 소스를 비워서
         재생 위치가 0 으로 리셋되고 그대로 멈춘다. 조각 하나만 못 받아도 그랬다.
         → 재생이 시작된 뒤라면 hls.js 가 제공하는 제자리 복구를 먼저 쓴다.

         조건에 done 을 쓰면 안 된다: done 은 매니페스트를 읽은 순간(=재생 시작 시점)
         이미 true 라서, 정작 재생 중에 나는 오류에서 복구가 한 번도 실행되지 않는다. */
      if (started) {
        const at = video.currentTime;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && netFix++ < 4) {
          if (load) { load.hidden = false; load.textContent = '⏳ 끊긴 연결 복구 중…'; }
          h.startLoad(); ytSeekTo(video, at); return;
        }
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && medFix++ < 3) {
          if (medFix > 1) { try { h.swapAudioCodec(); } catch (e) {} }
          h.recoverMediaError(); ytSeekTo(video, at); return;
        }
      }
      // 제자리 복구로도 안 되면 물러난다. 보던 위치를 넘겨서 이어 붙이게 한다.
      const at = video.currentTime;
      const wasPlaying = done;   // 여기서 done 은 "성공으로 resolve 됐다"(=호출자는 이미 떠났다)는 뜻
      abandoned = true;
      /* 3054행과 같은 규칙 — 전역으로 지우면 그 사이 시작된 '지금 나오는 곡' 의 인스턴스를 죽인다.
         그러면 오류도 안 뜨고 다음 곡도 아닌 채로 화면만 검게 멈춘다. */
      if (YT._hls === h) ytDestroyHls(); else { try { h.destroy(); } catch (e2) {} }
      if (wasPlaying) { ytHlsGiveUp(item, variant, at); return; }  // 재생 중이던 곡 → 다른 방법으로 이어서
      finish(false);                                               // 아직 시작 전 → 아래 progressive 후보로
    });
    h.loadSource(url); h.attachMedia(video);
    setTimeout(() => finish(false), 20000);
  });
}
/* HLS 가 재생 도중 완전히 죽었을 때: 한 단계 낮은 화질로, 그것도 없으면 progressive 로 이어 붙인다. */
function ytHlsGiveUp(item, variant, at) {
  if (!item || YT.cur !== item) return;
  ytSetResume(item, at);
  const lower = (YT.hls || []).filter(x => x.h < variant.h)[0];
  if (lower) {
    YT._qualCap = lower.h;               // 이번 곡에서만 낮춘다 — 설정한 화질은 그대로 둔다
    toast(`${variant.h}p 스트림이 끊겨 ${lower.h}p 로 이어서 재생합니다`);
  } else {
    YT._noHls = item.id;                 // 이 곡은 HLS 를 건너뛰고 progressive 로
    toast('스트림이 끊겨 다른 방식으로 이어서 재생합니다');
  }
  ytPlayDirect(item);
}
function ytFillQualSelect() {
  const sel = $('#ytQual'); if (!sel) return;
  const list = YT.hls || [];
  const cur = S.ytQual || 'auto';
  sel.innerHTML = '<option value="auto">화질 자동</option>'
    + (list.length ? '' : '<option value="360">360p</option>')
    + list.map(x => `<option value="${x.h}">${x.h}p</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === String(cur)) ? String(cur) : 'auto';
  // 끊겨서 임시로 낮춘 경우, 고른 화질과 실제 화질이 다르다 → 둘 다 보여준다
  sel.title = YT.qualNow ? (YT._qualCap ? `현재 ${YT.qualNow}p (스트림이 끊겨 이 곡만 낮춤 · 다음 곡은 설정대로)` : `현재 ${YT.qualNow}p`) : '영상 화질';
}

/* 🎧/🎬 버튼이 "지금 어느 쪽인지"를 글리프로 보여준다 (테두리 색만으로는 알아보기 어려웠음) */
function ytPaintAudioBtn() {
  const b = $('#ytAudioBtn'); if (!b) return;
  const on = !!S.ytAudioOnly, direct = (typeof ytMode === 'function' ? ytMode() : 'embed') === 'direct';
  b.classList.toggle('on', on);
  b.textContent = on ? '🎧' : '🎬';
  b.title = on ? '지금: 오디오만 (화면 없음) — 누르면 영상+오디오' : '지금: 영상+오디오 — 누르면 오디오만 (고음질)';
  b.hidden = !direct;                                   // 직접 재생에서만 의미가 있다
  const q = $('#ytQual'); if (q) q.hidden = !direct || on;
}

/* ═══════════ 이미지 품질 지표 — "그림이 무너졌는지"를 수치로 ═══════════
   비전 모델 없이도 잡히는 것들: 단색/뭉갬(표준편차↓), 흐림(라플라시안 분산↓),
   색 다양성(엔트로피↓), 과노이즈(고주파 에너지↑). 절대값이 아니라
   내 과거 이미지 대비 상대값으로 봐야 의미가 있다. */
/* ═══════════ 이미지 자체만으로 찾는 결함 (API 없음 · 캔버스 계산만) ═══════════
   해부학은 못 본다. "손가락이 여섯 개" 를 알려면 무엇이 손인지 알아야 하는데
   픽셀 숫자에는 그 정보가 없다 — 그건 🔬 채점(Gemini)의 몫이다.

   여기서 보는 건 하나뿐이다: **뭉개진 영역**.
   구조 텐서로 각 자리의 "가장자리 방향이 얼마나 일관된가" 를 재고,
   에너지는 큰데(=선이 많은데) 방향이 뒤죽박죽인 자리를 센다.
   선이 뚜렷한 그림은 방향이 일관되고, 뭉개진 곳은 그렇지 않다.

   실측 (일부러 만든 그림들):
     깨끗 0.053 · 부드러운 화풍 0.051 · 초점 나감 0.02 · 일부 뭉갬 0.346
   부드러운 화풍을 뭉갬으로 오해하지 않는 것이 중요한데, 통과했다.

   복제(팔이 겹쳐 나오는 것) 검출도 만들어 봤지만 뺐다 —
   칸 격자에 딱 맞은 복사만 잡히고(0.38), 한 픽셀만 어긋나도 못 잡았다(0.058).
   게다가 AI 그림의 복제는 픽셀 복사가 아니라 "비슷하게 생긴 팔이 둘" 이라
   알고리즘을 제대로 고쳐도 못 잡는다. 안 되는 검사를 붙여두면 거짓 안심만 준다. */
const MUSH_WARN = 0.15;      // 이 위면 의심 (정상 0.05 · 뭉갬 0.23~0.54 사이를 넉넉히 가른다)
/* 한 장만 따로 볼 때. 계산은 imageStats 안에서 같은 버퍼로 한 번에 한다 —
   따로 부르면 그림을 두 번 그리고 두 번 읽는다. */
async function imageDefects(blob) {
  const st = await imageStats(blob);
  return { mush: st.mush, mushy: st.mushy, busy: st.busy, at: st.mushAt, suspect: st.mush >= mushThr().thr };
}
/* 지표는 한 장에 50~400ms 걸리는 캔버스 계산이다 — 항목에 캐시해 두 번 재지 않는다 (상태 판정이 10분마다 8장을 다시 재고 있었다) */
async function statsOf(it) { if (!it || !it.blob) return null; if (it._stats) return it._stats; it._stats = await imageStats(it.blob); return it._stats; }
const MUSH_LOG_MAX = 120;
/* "평소" 기준: mushLog(최근 생성들의 뭉갬 값) 에서 지금 보는 표본을 뺀 최근 40장의 중앙값 */
function mushThr(exclT, sample) {
  const log = Array.isArray(S.mushLog) ? S.mushLog : [];
  const prior = log.filter(x => x && typeof x.m === 'number' && !(exclT && exclT.has(x.t))).slice(-40).map(x => x.m);
  const base = prior.length >= 8 ? med(prior) : null;
  /* 2배: 사용자 앱 출력 12장(0.08~0.23, 중앙 0.12)에서 오탐 0, 애니 선화(평소 0.05)의 진짜 뭉갬(0.23~0.54)은 그대로 잡힌다 */
  const thr = base != null ? Math.max(MUSH_WARN, base * 2) : Math.max(0.30, (sample && sample.length ? med(sample) : 0) * 2);
  return { base, thr, n: prior.length };
}
/* 생성 직후 한가할 때 지표를 재서 평소 기록에 넣는다 (생성 완료를 기다리게 하지 않는다) */
function noteMushLater(it) {
  const run = async () => {
    try {
      const st = await statsOf(it); if (!st) return;
      S.mushLog = Array.isArray(S.mushLog) ? S.mushLog : [];
      if (S.mushLog.some(x => x && x.t === it.t)) return;
      S.mushLog.push({ t: it.t, m: st.mush });
      if (S.mushLog.length > MUSH_LOG_MAX) S.mushLog = S.mushLog.slice(-MUSH_LOG_MAX);
      save();
    } catch (e) {}
  };
  if (window.requestIdleCallback) requestIdleCallback(() => run(), { timeout: 4000 }); else setTimeout(run, 800);
}
/* 기존 히스토리로 평소 기록을 채운다 (처음 한 번, 한가할 때 한 장씩) — 안 그러면 8장을 새로 뽑을 때까지 기준이 없다 */
function seedMushLog() {
  const log = Array.isArray(S.mushLog) ? S.mushLog : [];
  if (log.length >= 8) return;
  const items = (R.hist || []).filter(h => h.blob && !log.some(x => x && x.t === h.t)).slice(-40);
  let i = 0;
  const step = () => { if (i >= items.length) return; noteMushLater(items[i++]); (window.requestIdleCallback || (f => setTimeout(f, 300)))(step); };
  step();
}
async function imageStats(blob) {
  /* 그림 풀기는 createImageBitmap 이 화면 일과 따로 한다(예전엔 <img> 로 풀어 뽑을 때마다 화면 일을 막았다).
     줄이기는 예전과 같은 drawImage 로 한다 — 줄이는 방식이 바뀌면 선명도 값이 달라져, 쌓아 둔 '평소' 기록과 비교가 어긋난다. */
  const img = (typeof createImageBitmap === 'function') ? await createImageBitmap(blob) : await blobToImage(blob);
  const N = 256;                                   // 256px 로 줄여서 계산 (속도)
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, N, N);
  if (img.close) img.close();
  const d = x.getImageData(0, 0, N, N).data;
  const g = new Float32Array(N * N);
  let sum = 0;
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    g[p] = v; sum += v; hist[Math.min(255, v | 0)]++;
  }
  const mean = sum / (N * N);
  let varSum = 0;
  for (let p = 0; p < g.length; p++) { const t = g[p] - mean; varSum += t * t; }
  const sd = Math.sqrt(varSum / g.length);
  // 라플라시안 분산 = 선명도 (낮으면 흐림/뭉갬)
  let lSum = 0, lSq = 0, ln = 0;
  for (let y = 1; y < N - 1; y++) for (let xx = 1; xx < N - 1; xx++) {
    const i = y * N + xx;
    const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - N] - g[i + N];
    lSum += l; lSq += l * l; ln++;
  }
  const lMean = lSum / ln, lap = lSq / ln - lMean * lMean;
  // 밝기 엔트로피 = 색/톤 다양성
  let ent = 0;
  for (let i = 0; i < 256; i++) { const p = hist[i] / g.length; if (p > 0) ent -= p * Math.log2(p); }
  /* 뭉갬 — 구조 텐서로 "가장자리 방향이 얼마나 일관된가" 를 잰다.
     선이 뚜렷한 그림은 방향이 일관되고, 뭉개진 곳은 에너지는 큰데 방향이 뒤죽박죽이다.
     에너지 중앙값 위(=선이 많은 곳)만 본다 — 평평한 하늘은 방향이 없어도 정상이고,
     전체가 흐린 그림은 에너지 자체가 낮아 "뭉갬" 이 아니라 그냥 부드러운 그림이다.
     실측: 깨끗 0.053 · 부드러운 화풍 0.051 · 초점 나감 0.02 · 일부 뭉갬 0.23~0.54 */
  const W = 8, GW = N / W;
  const en = new Float32Array(GW * GW), coh = new Float32Array(GW * GW);
  for (let wy = 0; wy < GW; wy++) for (let wx = 0; wx < GW; wx++) {
    let Jxx = 0, Jyy = 0, Jxy = 0;
    for (let y = wy * W + 1; y < (wy + 1) * W - 1; y++) for (let xx = wx * W + 1; xx < (wx + 1) * W - 1; xx++) {
      const i = y * N + xx;
      const gx = g[i + 1] - g[i - 1], gy = g[i + N] - g[i - N];
      Jxx += gx * gx; Jyy += gy * gy; Jxy += gx * gy;
    }
    const tr = Jxx + Jyy, k = wy * GW + wx;
    en[k] = tr;
    coh[k] = tr > 1 ? Math.sqrt((Jxx - Jyy) * (Jxx - Jyy) + 4 * Jxy * Jxy) / tr : 1;
  }
  const es = Array.from(en).sort((a, b) => a - b);
  const emed = es[es.length >> 1] || 1;
  let busy = 0, mushy = 0; const mushAt = [];
  for (let k = 0; k < coh.length; k++) {
    if (en[k] < emed) continue;
    busy++;
    if (coh[k] < 0.35) { mushy++; if (mushAt.length < 8) mushAt.push([k % GW, (k / GW) | 0]); }
  }
  const mush = busy ? mushy / busy : 0;
  return { sd: +sd.toFixed(2), lap: +lap.toFixed(1), ent: +ent.toFixed(3), mean: +mean.toFixed(1),
           mush: +mush.toFixed(3), mushy, busy, mushAt };
}
/* 최근 이미지들의 품질을 재고, 내 과거 중앙값과 비교 */
async function qualityHealth(sampleN) {
  const items = (R.hist || []).filter(h => h.blob).slice(-(sampleN || 8));
  if (items.length < 3) return { enough: false, n: items.length };
  const stats = [];
  for (const it of items) { try { const st = await statsOf(it); if (st) stats.push(st); } catch (e) {} }
  if (stats.length < 3) return { enough: false, n: stats.length };
  const m = k => med(stats.map(s => s[k]));
  const cur = { sd: m('sd'), lap: m('lap'), ent: m('ent') };
  /* 뭉갬 — 절대값 0.15 하나로 보던 것을 "내 평소 대비" 로 바꿨다.
     구조 텐서 지표는 화풍을 탄다: 애니 선화는 0.05 언저리지만, 사실적·3D·피부 질감이 많은 화풍은
     멀쩡한 그림도 0.10~0.35 다 (실측: 앱 출력 12장 중앙 0.12 · novelai.net 출력 12장 중앙 0.27).
     절대 기준 0.15 는 그런 화풍에서 12장 중 11장을 "의심" 으로 찍어 늘 빨간불이었다.
     → 최근 표본 앞의 그림들(mushLog, 최대 40장)로 평소 중앙값을 잡고 그 2배(최소 0.15)만 의심한다.
       평소 기록이 아직 없으면 최근 표본 중앙값의 2배·최소 0.30 — 극단만 잡는다. */
  const mushList = stats.map(s => s.mush).filter(v => typeof v === 'number');
  const recentT = new Set(items.map(it => it.t));
  const thrInfo = mushThr(recentT, mushList);
  const mush = { med: med(mushList), worst: Math.max(...mushList, 0),
                 hits: mushList.filter(v => v >= thrInfo.thr).length, n: mushList.length, base: thrInfo.base, thr: thrInfo.thr };
  const base = S.qBase;                              // 기준선 (평소 상태)
  const ratio = base ? { sd: cur.sd / base.sd, lap: cur.lap / base.lap, ent: cur.ent / base.ent } : null;
  return { enough: true, n: stats.length, cur, base, ratio, mush };
}
function setQualityBaseline(cur) { S.qBase = cur; save(); toast('지금 상태를 "평소"로 기준 저장했습니다'); }

/* ═══════════ 자동 업데이트 (GitHub Releases) ═══════════
   서버가 릴리스를 조회하고, 새 exe 를 내려받은 뒤,
   배치 파일이 종료를 기다렸다가 교체·재실행한다 (실행 중인 exe 는 자기 자신을 못 덮어씀). */
const UPD = { info: null, timer: null };
async function updateCheck(silent) {
  try {
    const r = await apiFetch('/update/check');
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status));
    UPD.info = j;
    const b = $('#btnUpdate');
    if (b) {
      b.hidden = !j.available;
      b.textContent = j.available ? `⬆ 업데이트 ${j.latest}` : '';
    }
    if (j.available && !silent) openUpdate();
    else if (j.available && silent && S.updSeen !== j.latest) { S.updSeen = j.latest; save(); toast(`새 버전 ${j.latest} 이 나왔습니다 — 상단 ⬆ 를 누르세요`); }
    return j;
  } catch (e) { if (!silent) toast('업데이트 확인 실패: ' + e.message, 'err'); return null; }
}
function openUpdate() {
  openModal('⬆ 업데이트', body => {
    const j = UPD.info || {};
    if (!j.configured) {
      body.innerHTML = `<div class="hint">업데이트를 받아올 GitHub 저장소를 지정하세요. 예: <b>내아이디/NAI-Studio</b></div>
        <label class="fld">저장소<input type="text" id="updRepo" placeholder="사용자명/저장소" value="${escHtml((R.srvInfo && R.srvInfo.updateRepo) || '')}"></label>
        <div class="row"><button class="btn primary sm" id="updSave">저장하고 확인</button><span class="hint" id="updSt"></span></div>
        <div class="hint">지정한 저장소의 <b>최신 릴리스</b>에서 .exe 자산을 찾습니다. 릴리스 태그는 <b>v11.9</b> 처럼 매기면 됩니다.</div>`;
      body.querySelector('#updSave').onclick = async () => {
        const v = body.querySelector('#updRepo').value.trim();
        body.querySelector('#updSt').textContent = '저장 중…';
        try {
          await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updateRepo: v }) });
          R.srvInfo = { ...(R.srvInfo || {}), updateRepo: v };
          closeModal(); await updateCheck(false);
        } catch (e) { body.querySelector('#updSt').textContent = '실패: ' + e.message; }
      };
      return;
    }
    const notes = (j.notes || '').trim();
    body.innerHTML = `<div class="nai-st">
      <div><b>현재 버전</b><div>v${escHtml(j.current)}</div></div>
      <div><b>최신 버전</b><div>${escHtml(j.latest || '-')} ${j.published ? `<span class="hint">· ${escHtml(j.published)}</span>` : ''}</div></div>
      ${j.available ? '' : '<div><b>상태</b><div>🟢 최신 버전을 쓰고 있습니다</div></div>'}
      ${notes ? `<div><b>변경 내용</b><pre class="upd-notes">${escHtml(notes)}</pre></div>` : ''}
      </div>
      <div class="upd-bar" id="updBar" hidden><div class="upd-fill"></div><span class="upd-txt"></span></div>
      <div class="row" id="updRow"></div>
      <div class="hint" id="updMsg"></div>`;
    const row = body.querySelector('#updRow'), msg = body.querySelector('#updMsg');
    if (j.available && j.asset && j.frozen) {
      const dl = document.createElement('button'); dl.className = 'btn primary'; dl.textContent = `⬇ ${j.latest} 받기 (${(j.asset.size / 1e6).toFixed(0)}MB)`;
      dl.onclick = () => startUpdate(j, body);
      row.appendChild(dl);
    } else if (j.available && !j.frozen) {
      /* 소스로 돌리는 경우(start.bat)에도 버튼 하나로 끝나야 한다.
         예전엔 "저장소에서 직접 받아 덮어쓰세요" 라고 안내만 해서 깃헙에 들어가야 했다.
         → 저장소 압축본을 받아 앱 파일(js/html/css/py)만 갈아끼운다.
         사용자 데이터(data/)와 설치분(vendor/ 등)은 건드리지 않고,
         갈아끼우기 전 지금 파일을 data/backups/src-<시각>/ 에 넣어 되돌릴 수 있게 한다. */
      /* 서버가 zip 주소를 안 주는 경우가 있다(예전 버전으로 떠 있을 때).
         릴리스 페이지 주소가 .../releases/tag/<태그> 라서 압축본 주소는 그걸로 만들 수 있다.
         굳이 "주소를 확인할 수 없습니다" 로 막다른 길을 만들 이유가 없다. */
      const zip = j.zip || (() => {
        const m = /^(https:\/\/github\.com\/[\w.\-]+\/[\w.\-]+)\/releases\/tag\/(.+)$/.exec(j.page || '');
        return m ? `${m[1]}/archive/refs/tags/${m[2]}.zip` : null;
      })();
      if (zip) {
        const dl = document.createElement('button'); dl.className = 'btn primary';
        dl.textContent = `⬇ ${j.latest} 받아서 적용`;
        dl.onclick = () => startSourceUpdate({ ...j, zip }, body);
        row.appendChild(dl);
        msg.innerHTML = '<span class="hint">소스로 실행 중입니다 — 앱 파일만 갈아끼웁니다. '
          + '설정·이미지(data 폴더)는 그대로이고, 바꾸기 전 파일은 백업해 둡니다.</span>';
      } else {
        msg.textContent = '소스로 실행 중입니다 — 저장소 주소를 확인할 수 없습니다.';
      }
    } else if (j.available && !j.asset) {
      msg.textContent = '릴리스에 .exe 파일이 없습니다.';
    }
    if (j.page) { const a = document.createElement('a'); a.className = 'btn sm'; a.href = j.page; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '릴리스 페이지'; row.appendChild(a); }
    const re = document.createElement('button'); re.className = 'btn sm'; re.textContent = '다시 확인';
    re.onclick = async () => { closeModal(); await updateCheck(false); };
    row.appendChild(re);
  });
}
async function startSourceUpdate(j, body) {
  const bar = body.querySelector('#updBar'), fill = bar.querySelector('.upd-fill'), txt = bar.querySelector('.upd-txt');
  const msg = body.querySelector('#updMsg'), row = body.querySelector('#updRow');
  row.innerHTML = ''; bar.hidden = false; txt.textContent = '연결 중…';
  try {
    const r = await apiFetch('/update/source', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: j.zip, ver: j.latest }) });
    // 파일은 새것인데 파이썬 서버가 예전 채로 떠 있으면 이 주소 자체가 없다 →
    // "HTTP 404" 만 보여 주면 뭘 해야 할지 알 수 없으니 할 일을 알려준다
    if (r.status === 404) throw new Error('서버가 예전 버전으로 켜져 있습니다 — 앱을 완전히 껐다가 다시 켠 뒤 시도하세요.');
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'HTTP ' + r.status);
  } catch (e) { msg.textContent = '✖ ' + e.message; bar.hidden = true; return; }
  const poll = setInterval(async () => {
    try {
      const st = await (await apiFetch('/update/status')).json();
      if (st.state === 'downloading') {
        const pct = st.total ? Math.round(st.got / st.total * 100) : 0;
        fill.style.width = (st.total ? pct : 50) + '%';
        txt.textContent = st.total ? `${pct}% · ${(st.got / 1e6).toFixed(1)}/${(st.total / 1e6).toFixed(1)}MB` : '받는 중…';
      } else if (st.state === 'ready') {
        clearInterval(poll);
        fill.style.width = '100%'; txt.textContent = '적용 완료';
        msg.innerHTML = (st.msg ? escHtml(st.msg) + '<br>' : '')
          + '<span class="hint">되돌리려면 data/backups 의 src-… 폴더를 다시 덮으면 됩니다.</span>';
        const go = document.createElement('button'); go.className = 'btn go'; go.textContent = '✔ 지금 재시작';
        go.onclick = async () => {
          go.disabled = true; msg.textContent = '재시작 중… 잠시 후 새 창이 열립니다.';
          // 결과를 안 읽으면 실패해도 "재시작 중…" 인 채로 멈춰 있어, 사용자는 기다리기만 한다
          try {
            const rr = await apiFetch('/update/restart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (!rr.ok) {
              const jj = await rr.json().catch(() => ({}));
              throw new Error(jj.message || ('HTTP ' + rr.status));
            }
          } catch (e) {
            go.disabled = false;
            msg.textContent = '✖ 재시작하지 못했습니다: ' + e.message + ' — 검은 창을 닫고 start.bat 을 다시 실행해 주세요';
          }
        };
        row.innerHTML = ''; row.appendChild(go);
      } else if (st.state === 'error') {
        clearInterval(poll); bar.hidden = true; msg.textContent = '✖ ' + (st.msg || '실패');
      }
    } catch (e) { clearInterval(poll); msg.textContent = '✖ ' + e.message; }
  }, 400);
}
async function startUpdate(j, body) {
  const bar = body.querySelector('#updBar'), fill = bar.querySelector('.upd-fill'), txt = bar.querySelector('.upd-txt');
  const msg = body.querySelector('#updMsg'), row = body.querySelector('#updRow');
  row.innerHTML = ''; bar.hidden = false; txt.textContent = '연결 중…';
  try {
    const r = await apiFetch('/update/start', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: j.asset.url, size: j.asset.size, ver: j.latest }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'HTTP ' + r.status);
  } catch (e) { msg.textContent = '✖ ' + e.message; bar.hidden = true; return; }
  const poll = setInterval(async () => {
    try {
      const st = await (await apiFetch('/update/status')).json();
      if (st.state === 'downloading') {
        const pct = st.total ? Math.round(st.got / st.total * 100) : 0;
        fill.style.width = pct + '%';
        txt.textContent = `${pct}% · ${(st.got / 1e6).toFixed(1)}/${(st.total / 1e6).toFixed(0)}MB`;
      } else if (st.state === 'ready') {
        clearInterval(poll);
        fill.style.width = '100%'; txt.textContent = '받기 완료';
        msg.textContent = '적용하면 앱이 잠시 닫혔다가 새 버전으로 다시 열립니다.';
        const go = document.createElement('button'); go.className = 'btn go'; go.textContent = '✔ 지금 적용하고 재시작';
        go.onclick = async () => {
          go.disabled = true; msg.textContent = '교체 중… 잠시 후 새 창이 열립니다.';
          /* 결과를 안 읽으면 실패해도 이 문구인 채로 멈춰 있다. 실제로 백신이 받아둔 파일을
             격리해 버리는 일이 있어서, 그때 사용자는 영문도 모른 채 기다리게 된다. */
          try {
            const rr = await apiFetch('/update/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const jj = await rr.json().catch(() => ({}));
            if (!rr.ok || jj.ok === false) throw new Error(jj.message || ('HTTP ' + rr.status));
          } catch (e) {
            go.disabled = false;
            msg.textContent = '✖ 교체하지 못했습니다: ' + e.message + ' — 릴리스 페이지에서 직접 받아 덮어써 주세요';
          }
        };
        row.innerHTML = ''; row.appendChild(go);
      } else if (st.state === 'error') {
        clearInterval(poll); bar.hidden = true; msg.textContent = '✖ ' + (st.msg || '실패');
      }
    } catch (e) { clearInterval(poll); msg.textContent = '✖ ' + e.message; }
  }, 400);
}
