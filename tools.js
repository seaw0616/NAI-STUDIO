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
function catColor(cat) { const cats = chunkCats(); return CHUNK_COLORS[Math.max(0, cats.indexOf(cat || '기본')) % CHUNK_COLORS.length]; }
function renderChunkBar(target) {
  if (!target) { $$('.chunkbar[data-ta]').forEach(b => renderChunkBar(b)); if (typeof refreshHighlights === 'function') refreshHighlights(); }
  const bar = target || $('#chunkBar'); if (!bar) return; bar.innerHTML = '';
  if (!S.chunks.length) return;
  for (const cat of chunkCats()) {
    const cc = document.createElement('span'); cc.className = 'chip cat'; cc.textContent = cat; bar.appendChild(cc);
    for (const c of S.chunks.filter(x => (x.cat || '기본') === cat)) {
      const b = document.createElement('button'); b.className = 'chip';
      b.innerHTML = `<span class="cdot" style="background:${catColor(cat)}"></span>`;
      b.appendChild(document.createTextNode(c.name));
      b.title = c.text + '\n\n클릭: 청크 태그 삽입 (생성 시 내용으로 치환) · Alt+클릭: 내용 그대로 · 우클릭: 편집';
      b.onclick = e => { if (target && target.dataset.ta) R.lastTA = $('#' + target.dataset.ta); insertIntoPrompt(e.altKey ? c.text : c.name); };
      b.oncontextmenu = e => { e.preventDefault(); chunkMenu(e, c); };
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
  const x = Math.min(e.clientX, innerWidth - 200), y = Math.min(e.clientY, innerHeight - m.offsetHeight - 10);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
}
function chunkMenu(e, c) {
  const cats = chunkCats().filter(k => k !== (c.cat || '기본'));
  popMenu(e, [
    ['✎ 편집', () => openChunkManager(c)],
    ['📋 내용 삽입', () => insertIntoPrompt(c.text)],
    ['📝 새 분류로 옮기기…', () => { const v = prompt('분류 이름 (' + chunkCats().join(', ') + ')', c.cat || '기본'); if (v != null) { c.cat = v.trim() || '기본'; addChunkCat(c.cat); save(); renderChunkBar(); } }],
    ...cats.slice(0, 5).map(k => ['   → ' + k, () => { c.cat = k; save(); renderChunkBar(); }]),
    ['-'],
    ['🗑 삭제', () => { tomb('chunk', c.name); S.chunks = S.chunks.filter(x => x !== c); save(); renderChunkBar(); toast('삭제: ' + c.name); }, 'danger'],
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
    if (!S.chunks.length || S.showChunkBars) { fl.hidden = true; return; }
    if (!ta.id) ta.id = 'ta_' + uid();
    curTa = ta; fl.dataset.ta = ta.id; renderChunkBar(fl);
    if (!fl.children.length) { fl.hidden = true; return; }
    const r = ta.getBoundingClientRect();
    fl.style.left = Math.max(8, Math.min(r.left, innerWidth - 420)) + 'px';
    fl.style.top = Math.min(r.bottom + 4, innerHeight - 60) + 'px';
    fl.style.width = Math.max(240, Math.min(r.width, 520)) + 'px';
    fl.hidden = false;
  };
  const hideSoon = () => { clearTimeout(hideT); hideT = setTimeout(() => { if (S.chunkFloatPin) return; const a = document.activeElement; if (fl.matches(':hover') || (a && a === curTa)) return; fl.hidden = true; }, 350); };
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('textarea.ac')) { clearTimeout(hideT); show(e.target); } else if (!fl.contains(e.target)) hideSoon(); });
  document.addEventListener('focusout', e => { if (e.target.matches && e.target.matches('textarea.ac')) hideSoon(); });
  document.addEventListener('mousedown', e => { if (!fl.hidden && !fl.contains(e.target) && !(e.target.matches && e.target.matches('textarea.ac'))) hideSoon(); });
  fl.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); }); // 칩 클릭 시 포커스 유지
  window.addEventListener('scroll', () => { if (!fl.hidden && curTa) show(curTa); }, true);
  window.addEventListener('resize', () => { if (!fl.hidden && curTa) show(curTa); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !S.chunkFloatPin) fl.hidden = true; });
  // 📌 고정: 켜면 포커스가 빠져도 띠가 남음
  const origRender = renderChunkBar;
  window._chunkFloatPin = () => { const p = document.createElement('button'); p.className = 'chip pin' + (S.chunkFloatPin ? ' on' : ''); p.textContent = S.chunkFloatPin ? '📌 고정됨' : '📌'; p.title = '띠를 고정 (포커스가 빠져도 유지)'; p.onclick = () => { S.chunkFloatPin = !S.chunkFloatPin; save(); if (curTa) show(curTa); }; return p; };
  const origShow = show;
  show = ta => { origShow(ta); if (!fl.hidden) fl.prepend(window._chunkFloatPin()); };
}
function saveSelectionAsChunk() {
  const ta = activeTA();
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
    let pickedCat = S.lastChunkCat || '기본'; bindCatSelect(body.querySelector('#ckCat'), v => { pickedCat = v; });
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
      <div class="row"><button class="btn sm" id="ckAdd">＋ 새 청크</button><button class="btn sm" id="ckAddCat">＋ 새 분류</button><button class="btn sm" id="ckExport">내보내기</button><button class="btn sm" id="ckImport">가져오기</button><span class="hint">변경은 즉시 저장</span></div>`;
    const rows = body.querySelector('#ckRows'), filt = body.querySelector('#ckCatFilter');
    let curCat = onlyCat || 'all';
    const draw = () => {
      const cats = chunkCats();
      filt.innerHTML = '<option value="all">전체</option>' + cats.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
      filt.value = cats.includes(curCat) ? curCat : 'all'; curCat = filt.value;
      rows.innerHTML = '';
      const shown = cats.filter(k => curCat === 'all' || k === curCat);
      for (const cat of shown) {
        const head = document.createElement('div'); head.className = 'ck-cat';
        head.innerHTML = `<span class="cdot" style="background:${catColor(cat)}"></span><b></b><span class="hint"></span><span style="flex:1"></span><button class="btn xs" data-a="ren">✎ 이름 변경</button><button class="btn xs ghost danger" data-a="del">🗑 분류 삭제</button>`;
        head.querySelector('b').textContent = cat;
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
          d.innerHTML = `<input type="text" placeholder="이름"><textarea rows="1" placeholder="내용" class="ac"></textarea>${catSelectHtml('ckc_' + i, c.cat)}<button class="ic" title="삭제">✕</button>`;
          const [n, t] = [d.children[0], d.children[1]];
          n.value = c.name; t.value = c.text;
          n.onchange = () => { const nv = n.value.trim().replace(/\s+/g, '_'); const dup = S.chunks.find(x => x !== c && normKey(x.name) === normKey(nv)); if (dup) { toast('같은 이름의 청크가 이미 있습니다: ' + dup.name, 'err'); n.value = c.name; return; } const oldName = c.name; c.name = nv; if (oldName && normKey(oldName) !== normKey(nv)) tomb('chunk', oldName); save(); renderChunkBar(); };
          t.oninput = () => { c.text = t.value; save(); renderChunkBar(); };
          bindCatSelect(d.querySelector('#ckc_' + i), v => { c.cat = v; save(); renderChunkBar(); draw(); });
          d.querySelector('button.ic').onclick = () => { tomb('chunk', c.name); S.chunks.splice(i, 1); save(); renderChunkBar(); draw(); };
          rows.appendChild(d);
          if (focus && focus === c) setTimeout(() => t.focus(), 30);
        });
        if (!anyRow) { const e = document.createElement('div'); e.className = 'hint'; e.style.padding = '2px 8px 6px'; e.textContent = '이 분류에 청크가 없습니다'; rows.appendChild(e); }
      }
      if (!S.chunks.length && !cats.length) rows.innerHTML = '<div class="hint">아직 청크가 없습니다. 프롬프트에서 텍스트를 선택하고 "＋청크로 저장"을 누르세요.</div>';
    };
    filt.onchange = () => { curCat = filt.value; draw(); };
    draw();
    body.querySelector('#ckAdd').onclick = () => { const cat = curCat === 'all' ? '기본' : curCat; let n = 1; while (S.chunks.some(c => c.name === '청크' + n)) n++; S.chunks.push({ name: '청크' + n, text: '', cat, createdAt: Date.now() }); addChunkCat(cat); save(); draw(); renderChunkBar(); };
    body.querySelector('#ckAddCat').onclick = () => { const v = prompt('새 분류 이름'); const n = addChunkCat(v); if (!n) return; curCat = n; draw(); renderChunkBar(); };
    body.querySelector('#ckExport').onclick = () => downloadBlob(new Blob([JSON.stringify(S.chunks, null, 2)], { type: 'application/json' }), 'nai-chunks.json');
    body.querySelector('#ckImport').onclick = () => pickFiles(false, async f => {
      try { const arr = JSON.parse(await f.text()); if (!Array.isArray(arr)) throw 0; for (const c of arr) if (c.name) { const ex = S.chunks.find(x => x.name === c.name); if (ex) Object.assign(ex, c); else S.chunks.push({ name: c.name, text: c.text || '', cat: c.cat || '', createdAt: Date.now() }); } save(); draw(); renderChunkBar(); toast('청크 ' + arr.length + '개 가져옴'); }
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
addEventListener('resize', () => { if (S && S.ytPos && $('#ytFloat') && !$('#ytFloat').hidden) ytApplyPos(); });
function ytPopupUrl(item) {
  if (item.list && !item.id) return `https://www.youtube.com/playlist?list=${item.list}`;
  return `https://www.youtube.com/watch?v=${item.id}${item.list ? '&list=' + item.list : ''}`;
}
function ytStopLocal() { try { ytCmd('pauseVideo'); } catch (e) {} agcDetach(); if (typeof ytDestroyHls === 'function') ytDestroyHls(); const w = $('#ytPlayerWrap'); if (w) w.innerHTML = ''; ytPlayDirect._v = null; YT.direct = false; YT.playing = false; ytSetPlayIcon(false); }
function ytPopup(item) { // 유튜브 창(로그인 계정)으로 재생 — Premium이면 광고 없음. 창은 하나만 재사용, 대기열은 재생목록으로 함께 전달
  ytStopLocal();   // 내장 플레이어 정리 (두 곡 동시 재생 방지)
  let url = ytPopupUrl(item);
  const ids = [item.id, ...S.ytQueue.map(q => q.id)].filter(Boolean);
  if (item.id && ids.length > 1) { url = 'https://www.youtube.com/watch_videos?video_ids=' + ids.slice(0, 50).join(','); toast(`대기열 ${ids.length - 1}곡을 유튜브 재생목록으로 함께 넘겼습니다 (앱 대기열은 그대로 유지)`); }
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
  try {
    const r = await apiFetch('/yt/engine');
    if (r.status === 404) { toast('서버가 예전 버전입니다 — 검은 창을 닫고 start.bat을 다시 실행한 뒤 새로고침하세요', 'err'); return false; }
    const j = await r.json();
    if (j.installed) { if (R.srvInfo) R.srvInfo.ytEngine = true; return true; }
  } catch (e) { return false; }
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
  v.onplaying = () => { load.hidden = true; YT.playing = true; YT._audioRetry = false; if (YT._retry && YT._retry.id !== item.id) YT._retry = null; if (YT._resume && YT._resume.id === item.id && v.currentTime >= YT._resume.t - 3) YT._resume = null; ytSetPlayIcon(true); if (S.ytNormalize && v.crossOrigin === 'anonymous') agcAttach(v); else if (!AGC.el || AGC.el !== v) { const want = (S.ytVol == null ? 60 : S.ytVol) / 100; if (Math.abs(v.volume - want) > 0.005) { v._progVol = true; v.volume = want; setTimeout(() => { v._progVol = false; }, 50); } } };
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
    if (r.status === 503) { load.textContent = '엔진 미설치'; const ok = await ytEngineEnsure(true); if (ok) return ytPlayDirect(item); setYtMode('embed'); return ytPlay(item, true); }
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
        er.innerHTML = `<div>이 영상은 직접 재생이 안 됩니다 (${esc(me)})</div><div class="hint" style="color:#ccc">${esc(diag.join(' · ') || '진단 정보 없음')}</div><div class="row" style="justify-content:center;margin-top:6px">
          <button class="btn sm primary" id="ytDrRetry">↻ 다시 시도</button><button class="btn sm" id="ytDrEmbed">임베드로 재생</button><button class="btn sm" id="ytDrTab">🡕 유튜브 탭</button>${S.ytQueue.length ? '<button class="btn sm" id="ytDrNext">⏭ 다음 곡</button>' : ''}<button class="btn sm" id="ytDrUpd">엔진 업데이트</button></div>`;
        er.querySelector('#ytDrRetry').onclick = () => { YT.directFail[item.id] = false; YT._noHls = null; ytPlayDirect(item); };
        er.querySelector('#ytDrEmbed').onclick = () => { setYtMode('embed'); YT._embedTry = 0; YT._embedList = null; ytPlay(item, true); };
        er.querySelector('#ytDrTab').onclick = () => ytPopup(item);
        const nb = er.querySelector('#ytDrNext'); if (nb) nb.onclick = ytNext;
        er.querySelector('#ytDrUpd').onclick = async () => { toast('엔진 업데이트 중…'); const r = await apiFetch('/yt/engine', { method: 'POST' }); const jj = await r.json(); toast(jj.installed ? '업데이트 완료 ' + jj.version : '실패'); YT.directFail[item.id] = false; ytPlayDirect(item); };
        logErr('직접 재생 실패 ' + item.id + ' ' + me + ' | ' + diag.join(' · '));
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
    load.hidden = true; const er = $('#ytErr'); er.hidden = false;
    er.innerHTML = `<div>${esc('스트림을 가져오지 못했습니다: ' + e.message)}</div><div class="row" style="justify-content:center;margin-top:6px"><button class="btn sm" id="ytDrEmbed">임베드로 재생</button><button class="btn sm" id="ytDrUpd">엔진 업데이트</button></div>`;
    er.querySelector('#ytDrEmbed').onclick = () => { S.ytMode = 'embed'; ytPlay(item, true); S.ytMode = 'direct'; };
    er.querySelector('#ytDrUpd').onclick = async () => { toast('엔진 업데이트 중…'); const r = await apiFetch('/yt/engine', { method: 'POST' }); const j = await r.json(); toast(j.installed ? '업데이트 완료 ' + j.version : '실패'); ytPlayDirect(item); };
  }
}
async function ytPlayList(item) { // 재생목록 → 서버가 항목을 풀어 대기열로
  toast('재생목록을 불러오는 중…');
  try {
    const r = await apiFetch('/yt/playlist?list=' + encodeURIComponent(item.list)); if (!r.ok) throw await apiError(r);
    const j = await r.json(); const items = j.items || [];
    if (!items.length) { toast('재생목록이 비어 있거나 비공개입니다', 'err'); return; }
    S.ytQueue = items.slice(1).concat(S.ytQueue || []); save(); renderYtQueue(); toast(`재생목록 "${(j.title || '').slice(0, 30)}" ${items.length}곡 — 첫 곡부터 재생 (기존 대기열은 뒤에 유지)`);
    ytPlay(items[0], true);
  } catch (e) { toast('재생목록 불러오기 실패: ' + e.message, 'err'); }
}
function ytPlay(item, force) {
  /* 여기로 들어온다는 것은 "이 곡을 새로 튼다"는 뜻이다 — 목록 클릭, 대기열 자동 진행(ytNext),
     전부 재생, 검색창에 주소 입력. 끊김 복구는 ytPlayDirect 를 직접 부르므로 여기를 거치지 않는다.
     남아 있던 이어보기 목표를 안 지우면 대기열에 같은 곡이 두 번 있을 때 두 번째가 중간부터 나온다. */
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
  if (item.list && !item.id && /^RD|^UL|^LL$/.test(item.list)) { toast('유튜브 자동생성 믹스/목록은 임베드가 안 됩니다 — 직접 재생 모드를 쓰세요'); return; }
  const origin = encodeURIComponent(location.origin.startsWith('http') ? location.origin : 'http://127.0.0.1');
  const host = (YT._embedTry === 1) ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com'; // 1차 실패 시 nocookie 도메인으로 재시도
  let src;
  if (YT._embedList) src = `${host}/embed/videoseries?list=${YT._embedList}&autoplay=1&enablejsapi=1&origin=${origin}`;  // 2차: 임시 재생목록 트릭
  else if (item.list && !item.id) src = `${host}/embed/videoseries?list=${item.list}&autoplay=1&enablejsapi=1&origin=${origin}`;
  else src = `${host}/embed/${item.id}?autoplay=1&enablejsapi=1&origin=${origin}${(item.list && !/^RD|^UL|^LL$/.test(item.list)) ? '&list=' + item.list : ''}`;
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
        const r = await apiFetch('/yt/templist?id=' + encodeURIComponent(YT.cur.id)); const j = await r.json();
        if (j.list) { YT._embedList = j.list; toast('임시 재생목록으로 재시도'); const it = YT.cur; setTimeout(() => ytPlay(it, true), 200); return; }
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
  er.querySelector('#ytErrDirect').onclick = async () => { const it = YT.cur; if (await ytEngineEnsure(true)) { setYtMode('direct'); ytPlayDirect(it); } };
  const ab = er.querySelector('#ytErrAlt'); if (ab) ab.onclick = () => ytFindAlternative(YT.cur);
  const nb = er.querySelector('#ytErrNext'); if (nb) nb.onclick = ytNext;
}
async function ytFindAlternative(item) { // 제목으로 다시 검색해 재생 가능한 다른 업로드를 찾음
  if (!item) return;
  YT.altTries = (YT.altTries || 0) + 1; YT.altSeen = YT.altSeen || new Set(); YT.altSeen.add(item.id);
  const q = (item.title || '').replace(/[\[【（(][^\]】）)]*[\]】）)]/g, ' ').replace(/[|｜].*$/, '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (!q) { toast('제목이 없어 대체 영상을 찾을 수 없습니다', 'err'); return; }
  try {
    const res = await apiFetch('/yt/search?q=' + encodeURIComponent(q)); const j = await res.json();
    const cands = (j.items || []).filter(i => i.id && !YT.altSeen.has(i.id));
    if (!cands.length) { toast('대체 영상을 찾지 못했습니다', 'err'); return; }
    const chk = await (await apiFetch('/yt/check?ids=' + cands.slice(0, 15).map(c => c.id).join(','))).json().catch(() => ({ embeddable: {} }));
    const pick = cands.find(c => chk.embeddable && chk.embeddable[c.id] !== false) || cands[0];
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
function ytToggle() { if (!YT.cur) { ytOpen(true); return; } if (YT.pop) { ytPopup(YT.cur); return; } if (YT.playing) { ytCmd('pauseVideo'); YT.playing = false; } else { ytCmd('playVideo'); YT.playing = true; } ytSetPlayIcon(YT.playing); }
async function ytNext() {
  if (!S.ytQueue.length) {
    if (S.ytAutoRelated !== false && YT.cur && YT.cur.id && R.srvInfo && R.srvInfo.ytEngine) { // 알고리즘 이어듣기: 유튜브 믹스에서 연관 곡을 채움
      const ok = await ytFillRelated(YT.cur);
      if (!ok) { toast('연관 곡을 찾지 못했습니다'); return; }
    } else { toast('대기열이 비었습니다'); return; }
  }
  const next = S.ytQueue.shift(); save(); ytPlay(next);
}
async function ytFillRelated(seed, silent) {
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
    pick.forEach(it => { it.related = true; S.ytQueue.push(it); }); save(); renderYtQueue();
    if (!silent) toast(`🎶 알고리즘: "${(seed.title || '').slice(0, 24)}" 연관 곡 ${pick.length}곡을 대기열에 채웠습니다`);
    return true;
  } catch (e) { toast('연관 곡 실패: ' + e.message, 'err'); return false; }
}
function ytPlayRelatedNow(item) { S.ytQueue = []; ytFillRelated(item).then(ok => { if (ok) ytNext(); }); }
/* 대기열에 여러 곡을 넣을 때, 이미 쌓여 있으면 어디에 넣을지 묻는다.
   그냥 뒤에 붙이면 앞선 수백 곡이 다 나온 뒤에야 재생돼서, 방금 넣은 재생목록이
   안 나오고 '엉뚱한 곡이 나온다'고 느끼게 된다. */
function ytAddMany(items, label) {
  if (!items || !items.length) { toast('넣을 곡이 없습니다', 'err'); return; }
  const ahead = S.ytQueue.length;
  const put = front => {
    if (front) S.ytQueue = items.concat(S.ytQueue); else S.ytQueue = S.ytQueue.concat(items);
    save(); renderYtQueue();
    toast(front ? `${items.length}곡을 대기열 맨 앞에 넣었습니다` : `${items.length}곡을 대기열 맨 뒤(${ahead + 1}번째부터)에 넣었습니다`);
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
function ytEnqueue(item) { S.ytQueue.push(item); save(); renderYtQueue(); toast(`대기열 ${S.ytQueue.length}번째에 추가: ` + (item.title || '')); }
function ytRemember(item) { // 최근 재생 기록 (최대 200곡) — 대기열에서 빠져도 여기 남음
  if (!item || !(item.id || item.list)) return;
  S.ytHistory = (S.ytHistory || []).filter(h => !(h.id && h.id === item.id) && !(h.list && !h.id && h.list === item.list));
  S.ytHistory.unshift({ id: item.id, list: item.list, title: item.title, channel: item.channel, len: item.len, thumb: item.thumb, t: Date.now() });
  if (S.ytHistory.length > 200) S.ytHistory.length = 200;
  save();
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
        if (b.dataset.a === 'q') { q.forEach(it => { if (!S.ytQueue.some(x => x.id === it.id)) S.ytQueue.push(it); }); renderYtQueue(); toast('대기열 복구됨'); }
        if (b.dataset.a === 'h') { S.ytHistory = S.ytHistory || []; hist.forEach(it => { if (!S.ytHistory.some(x => x.id === it.id)) S.ytHistory.push(it); }); renderYtHistory(); toast('기록 복구됨'); }
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
  d.onclick = () => { YT._resume = null; YT._qualCap = 0; YT._noHls = null; YT.altTries = 0; YT.altSeen = null; YT._embedTry = 0; YT._embedList = null; if (it.noembed && ytMode() === 'embed') { if (R.srvInfo && R.srvInfo.ytEngine) { toast('임베드가 막힌 영상 → 직접 재생'); ytPlayDirect(it); } else ytPopup(it); return; } ytPlay(it); };
  d.querySelector('.yt-add').onclick = e => { e.stopPropagation(); if (opts.queue) { S.ytQueue.splice(opts.idx, 1); save(); renderYtQueue(); } else ytEnqueue(it); };
  return d;
}
function renderYtResults() { const box = $('#ytResults'); box.innerHTML = ''; ytLastResults.forEach(it => box.appendChild(ytItemEl(it, {}))); }
function renderYtQueue() {
  const box = $('#ytQueue'); box.innerHTML = '';
  const n = S.ytQueue.length;
  if (n) {
    // 재생목록을 통째로 넣으면 수십~수백 곡이 쌓인다 → 한 곡씩 ✕ 말고 통째로 빼는 길도 준다
    const bar = document.createElement('div'); bar.className = 'row'; bar.style.padding = '2px 4px 6px';
    bar.innerHTML = `<span class="hint" style="flex:1">${n}곡 · 각 줄의 ✕ 로 한 곡씩 뺄 수 있습니다</span>
      <button class="btn xs" id="ytQDedup" title="같은 곡이 여러 번 들어간 것을 정리">중복 정리</button>
      <button class="btn xs danger" id="ytQClear" title="대기열을 통째로 비웁니다">🗑 전부 빼기</button>`;
    box.appendChild(bar);
    bar.querySelector('#ytQClear').onclick = () => {
      if (!confirm(`대기열 ${n}곡을 전부 뺍니다. 계속할까요?\n(기록 탭에 남아 있어 되돌릴 수 있습니다)`)) return;
      S.ytQueue = []; save(); renderYtQueue(); toast(`${n}곡을 대기열에서 뺐습니다`);
    };
    bar.querySelector('#ytQDedup').onclick = () => {
      const seen = new Set(); const kept = S.ytQueue.filter(x => { const k = x.id || x.list; if (!k || seen.has(k)) return false; seen.add(k); return true; });
      const gone = n - kept.length;
      if (!gone) { toast('중복이 없습니다'); return; }
      S.ytQueue = kept; save(); renderYtQueue(); toast(`중복 ${gone}곡 제거`);
    };
  }
  S.ytQueue.forEach((it, i) => box.appendChild(ytItemEl(it, { queue: true, idx: i })));
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
  const p = new URLSearchParams({ client_id: cid, redirect_uri: redirect, scope: 'https://www.googleapis.com/auth/youtube.readonly', include_granted_scopes: 'true', state: 'nst' });
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
      head.querySelector('#ytPlAll').onclick = () => { if (!items.length) return; S.ytQueue = items.slice(1); save(); renderYtQueue(); ytPlay(items[0]); };
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
  $('#ytSizeBtn').onclick = () => { S.ytSize = S.ytSize === 'compact' ? 'normal' : 'compact'; save(); ytApplyPos(); };
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
  window.addEventListener('message', e => {
    if (typeof e.data !== 'string' || !e.origin.includes('youtube')) return;
    try {
      const d = JSON.parse(e.data);
      if (d.event === 'onStateChange') {
        if (d.info === 0 && (S.ytQueue.length || S.ytAutoRelated !== false)) ytNext();
        else if (d.info === 1) { YT.playing = true; ytSetPlayIcon(true); YT._embedTry = 0; YT._embedList = null; const er = $('#ytErr'); if (er) er.hidden = true; }
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
  renderYtQueue(); ytApplyPos();
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
function ovFromMeta(meta) {
  const p = (meta && meta.parameters) || {};
  const chars = (p.characterPrompts || []).map(c => ({ prompt: c.prompt, uc: c.uc, x: p.use_coords ? c.center.x : null, y: p.use_coords ? c.center.y : null }));
  const ov = { noQuality: true, chars, model: MODELS[baseModelOf(meta && meta.model)] ? baseModelOf(meta.model) : S.model, n: 1, noVibe: true, style: null };
  if (meta && meta.input != null) ov.prompt = meta.input;
  if (p.negative_prompt != null) ov.uc = p.negative_prompt;
  return ov;
}
async function toolEnhance() { const it = curItem(); if (!it) return; const w = snap64(it.w * S.enhScale), h = snap64(it.h * S.enhScale); await doGenerate({ ...ovFromMeta(it.meta), image: it.blob, strength: S.enhStr, noise: S.enhNoise, w, h }, `인핸스 ${S.enhScale}×`).catch(() => {}); }
async function toolVary() { const it = curItem(); if (!it) return; await doGenerate({ ...ovFromMeta(it.meta), image: it.blob, strength: S.varStr, noise: S.varNoise, w: snap64(it.w), h: snap64(it.h) }, '변형').catch(() => {}); }
function toolUpscale() {   // 배율 선택 후 실행 (NAI 웹과 동일하게 2×/4×)
  const it = curItem(); if (!it) return;
  if (R.gen) { toast('이미 작업 중'); return; }
  if (it.w * it.h > 1024 * 1024 + 1) { toast('업스케일은 1024×1024 이하 이미지만 가능합니다 (NAI 제한)', 'err'); return; }
  openModal('업스케일', body => {
    body.innerHTML = `<div class="hint">원본 ${it.w}×${it.h}</div><div class="tool-grid" id="usRow"></div>`;
    const row = body.querySelector('#usRow');
    for (const sc of [2, 4]) {
      const b = document.createElement('button'); b.className = 'btn primary';
      b.innerHTML = `<b>${sc}×</b><span>${it.w * sc} × ${it.h * sc}</span>`;
      b.onclick = () => { closeModal(); runUpscale(it, sc); };
      row.appendChild(b);
    }
  });
}
/* 진행·완료 표시. 메인 화면의 #genStatus 는 스마트 툴 탭에서는 숨겨져 있어
   툴을 돌려도 화면상 아무 일도 안 일어난 것처럼 보였다 → 스마트 툴 쪽에도 같이 쓴다. */
function setGenStatus(t) {
  const a = $('#genStatus'); if (a) a.textContent = t;
  const b = $('#stCost'); if (b && S.mode === 'tools') b.textContent = t;
}
async function runUpscale(it, scale) {
  // 배율을 고르는 동안 생성이 시작됐을 수 있다 → 실행 시점에 다시 검사 (runDirector 와 동일)
  if (R.gen) { toast('이미 작업 중'); return; }
  if (!it || !it.blob) { toast('업스케일할 이미지가 없습니다', 'err'); return; }
  // 크기 제한은 여기서 봐야 한다. toolUpscale() 안에만 있어서 스마트 툴 경로는 그냥 통과했고,
  // 큰 이미지를 보내면 Anlas 만 쓰고 서버에서 거절당했다.
  if (it.w * it.h > 1024 * 1024 + 1) { toast(`업스케일은 1024×1024 이하만 가능합니다 (지금 ${it.w}×${it.h})`, 'err'); return; }
  R.gen = true; setGenStatus(`업스케일 ${scale}× 중… (Anlas 소모)`); $('#btnGen').disabled = true;
  try {
    // NAI 프론트엔드 기준 업스케일은 api.novelai.net (BackendUrl) 에 남아 있음
    const res = await apiFetch('/api/ai/upscale', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ image: await blobToB64(it.blob), width: it.w, height: it.h, scale }) });
    if (!res.ok) throw await apiError(res);
    for (const b of await respImages(res)) { const item = await addToHistory(b, it.meta, `업스케일 ${scale}×`); if (S.autoSaveOn) autoSave(item); }
    setGenStatus('업스케일 완료'); refreshAnlas().catch(() => {});
  } catch (e) { setGenStatus('오류: ' + e.message); toast(e.message, 'err'); }
  finally { R.gen = false; $('#btnGen').disabled = false; }
}
async function toolInpaint() { const it = curItem(); if (!it) return; setI2I(it.blob); await openMaskEditor(); }
const DIRECTOR = [
  ['bg-removal', '🪄 배경 제거', '인물만 남기고 배경 투명'], ['lineart', '✒ 선화 추출', '이미지를 선화로'], ['sketch', '✏ 스케치', '연필 스케치 스타일'],
  ['colorize', '🎨 채색', '선화/흑백을 채색 (프롬프트·강도)'], ['emotion', '🙂 감정 변경', '표정 변경 (감정 선택)'], ['declutter', '🧽 정리', '텍스트·잡동사니 제거'],
  ['declutter-keep-bubbles', '💬 정리(말풍선 유지)', '잡동사니만 지우고 말풍선은 남김'],
];
// NAI 웹 번들 확정 19종 (여기 없는 감정은 서버가 받지 않는다)
const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'shy', 'disgusted', 'smug', 'bored', 'laughing', 'irritated', 'aroused', 'embarrassed', 'worried', 'love', 'determined', 'hurt', 'playful'];
function dtCostLabel(it) {
  const c = typeof directorToolCost === 'function' ? directorToolCost(it.w, it.h, R.tier === 3) : null;
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
        const needPrompt = key === 'colorize' || key === 'emotion';
        opts.innerHTML = `${key === 'emotion' ? `<label class="fld">감정<select id="dtEmo">${EMOTIONS.map(e => `<option>${e}</option>`).join('')}</select></label>` : ''}
          ${needPrompt ? `<label class="fld">추가 프롬프트 (선택)<input type="text" id="dtPrompt" placeholder="예: blue hair, sunset"></label>
          <label class="rng">강도 (defry 0=강함 … 5=약함) <output id="dtDefryV">0</output><input type="range" id="dtDefry" min="0" max="5" step="1" value="0"></label>` : ''}
          <div class="row"><button class="btn primary" id="dtRun">실행</button><span class="hint">${dtCostLabel(it)}</span></div>`;
        const dr = opts.querySelector('#dtDefry'); if (dr) dr.oninput = () => opts.querySelector('#dtDefryV').textContent = dr.value;
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
    const res = await apiFetch('/img/ai/augment-image', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(req) });
    if (!res.ok) throw await apiError(res);
    /* 결과에 붙일 메타는 '방금 처리한 그 이미지' 것이어야 한다.
       예전엔 curItem() 으로 지금 히스토리에서 선택된 것을 집어와서, 스마트 툴에
       다른 이미지를 올려두면 엉뚱한 이미지의 프롬프트·씬·파일명이 붙었다. */
    const it = srcItem || curItem();
    for (const b of await respImages(res)) { const item = await addToHistory(b, it ? it.meta : { parameters: {} }, label); if (S.autoSaveOn) autoSave(item); }
    setGenStatus(label + ' 완료'); refreshAnlas().catch(() => {});
  } catch (e) { setGenStatus('오류: ' + e.message); toast(e.message, 'err'); }
  finally { R.gen = false; $('#btnGen').disabled = false; }
}

/* ─────────────── 메타 → 설정 적용 (NAI PNG 재현) ─────────────── */
function applyMeta(meta) {
  if (!meta) { toast('설정 정보가 없습니다', 'err'); return; }
  const p = meta.parameters || {};
  const m = baseModelOf(meta.model); if (MODELS[m]) S.model = m;
  const info = MODELS[S.model];
  let prompt = meta.input || (p.v4_prompt && p.v4_prompt.caption.base_caption) || '';
  // 퀄리티 태그를 편집(오버라이드)한 경우까지 잘라내도록 "지금 쓰는 값"과 "내장 기본값" 둘 다 시도.
  // 잘라내지 못하면 프롬프트에 이미 들어있는 것으로 보고 토글은 끈다 (두 벌로 붙는 것 방지)
  const qCands = [getQuality(S.model), MODELS[S.model].quality].filter(Boolean);
  const qHit = qCands.find(c => prompt.endsWith(c));
  if (qHit) { prompt = prompt.slice(0, -qHit.length); S.quality = true; }
  else S.quality = false;
  setPromptText(prompt); S.activeStyle = null;
  let uc = p.negative_prompt != null ? p.negative_prompt : (p.v4_negative_prompt ? p.v4_negative_prompt.caption.base_caption : '');
  // NAI 웹이 자동으로 붙인 "nsfw, " 는 떼어내고(앱이 같은 규칙으로 다시 붙임), 사용자가 직접 쓴 경우(프롬프트에 nsfw 있음)는 유지
  if (/^nsfw(,\s*|$)/i.test(uc) && !(prompt || '').toLowerCase().includes('nsfw')) { uc = uc.replace(/^nsfw(,\s*|$)/i, ''); S.autoNsfw = true; }
  let presetIdx = -1;
  if (p.ucPreset != null) presetIdx = info.ucs.findIndex(u => u.id === p.ucPreset);
  // 텍스트가 일치하는 프리셋 중 가장 긴 것 (Heavy가 Human Focus의 접두어라서).
  // 프리셋을 편집한 경우도 잡도록 "지금 쓰는 값"을 먼저 보고 내장 텍스트로 폴백한다.
  let byText = -1, bestLen = 0;
  info.ucs.forEach((u, i) => {
    for (const t of [getUcText(S.model, i), u.text]) {
      if (t && uc.startsWith(t) && t.length > bestLen) { bestLen = t.length; byText = i; break; }
    }
  });
  if (byText >= 0) presetIdx = byText;
  if (presetIdx >= 0) {
    S.ucPreset = presetIdx;
    for (const t of [getUcText(S.model, presetIdx), info.ucs[presetIdx].text]) {
      if (t && uc.startsWith(t)) { uc = uc.slice(t.length).replace(/^,\s*/, ''); break; }
    }
  }
  else S.ucPreset = info.ucs.length - 1; // 없음
  S.uc = uc;
  if (p.width) S.w = p.width; if (p.height) S.h = p.height;
  if (p.steps) S.steps = p.steps; if (p.scale != null) S.scale = p.scale;
  if (p.cfg_rescale != null) S.rescale = p.cfg_rescale;
  if (p.sampler) S.sampler = p.sampler; if (p.noise_schedule) S.schedule = p.noise_schedule;
  if (p.seed != null) { S.seed = String(p.seed); S.randomSeed = false; }
  S.variety = p.skip_cfg_above_sigma != null && p.skip_cfg_above_sigma !== 0;
  S.decrisper = !!p.dynamic_thresholding;
  S.smea = !!p.sm; S.smeaDyn = !!p.sm_dyn;
  if (p.uncond_scale != null) S.ucStrength = p.uncond_scale;
  S.legacyUc = !!p.legacy_uc;
  S.aiChoice = !p.use_coords;
  if (Array.isArray(p.characterPrompts)) S.chars = p.characterPrompts.map(c => ({ prompt: c.prompt || '', uc: c.uc || '', x: (p.use_coords && c.center) ? c.center.x : null, y: (p.use_coords && c.center) ? c.center.y : null }));
  save(); syncUI(); renderChars();
  toast('프롬프트·설정을 불러왔습니다 (시드 고정됨)');
}
async function importFromPng(blob) {
  const chunks = await pngTextChunks(new Uint8Array(await blob.arrayBuffer()));
  const comment = chunks.find(c => c.key === 'Comment');
  if (!comment) { toast('NAI 메타데이터(Comment)가 없는 파일입니다', 'err'); return; }
  let j; try { j = JSON.parse(comment.text); } catch (e) { toast('메타데이터 파싱 실패', 'err'); return; }
  const src = (chunks.find(c => c.key === 'Source') || {}).text || '';
  let model = S.model;
  if (/4\.5/.test(src)) model = /curated/i.test(src) ? 'nai-diffusion-4-5-curated' : 'nai-diffusion-4-5-full';
  else if (/Diffusion V4/i.test(src)) model = /curated/i.test(src) ? 'nai-diffusion-4-curated-preview' : 'nai-diffusion-4-full';
  else if (/furry/i.test(src)) model = 'nai-diffusion-furry-3';
  else if (/V3/i.test(src)) model = 'nai-diffusion-3';
  applyMeta({ model, input: j.prompt || (j.v4_prompt && j.v4_prompt.caption.base_caption) || '', parameters: { ...j, negative_prompt: j.uc != null ? j.uc : (j.v4_negative_prompt ? j.v4_negative_prompt.caption.base_caption : '') } });
  closeModal();
}
async function openMetaViewer(blob, title) {
  const chunks = await pngTextChunks(new Uint8Array(await blob.arrayBuffer()));
  const st = await blobHasStealth(blob);
  openModal(title || 'PNG 메타데이터', body => {
    const sd = document.createElement('div'); sd.className = 'hint'; sd.innerHTML = st ? '🕵 알파 채널에 숨은 메타(stealth pnginfo) <b>있음</b> — 🧹 제거 저장을 쓰면 함께 지워집니다' : '숨은(stealth) 메타 없음'; body.appendChild(sd);
    if (!chunks.length) { const d = document.createElement('div'); d.className = 'hint'; d.textContent = '텍스트 메타데이터 청크 없음'; body.appendChild(d); return; }
    for (const c of chunks) {
      const h = document.createElement('div'); h.className = 'mtitle'; h.textContent = c.key; body.appendChild(h);
      const pre = document.createElement('pre'); let txt = c.text;
      if (c.key === 'Comment') { try { txt = JSON.stringify(JSON.parse(c.text), null, 2); } catch (e) {} }
      pre.textContent = txt; body.appendChild(pre);
    }
  });
}

function openNaiImport() {
  openModal('NAI 웹 설정 그대로 재현하기', body => {
    body.innerHTML = `<div class="hint">NAI 웹에서 만든 PNG(원본, 메타데이터 있는 파일)를 넣으면 <b>프롬프트·네거티브·시드·스텝·가이던스·리스케일·샘플러·노이즈 스케줄·UC 프리셋·Variety·Decrisper·SMEA·캐릭터·크기·모델</b>이 전부 복원되고 시드가 고정됩니다.</div>
      <div class="grid2">
        <div class="drop" id="niDrop" style="width:100%;min-height:90px;font-size:13px">설정만 복원<br><span class="hint">PNG 드롭 또는 클릭</span></div>
        <div class="drop" id="niRepro" style="width:100%;min-height:90px;font-size:13px;border-color:var(--acc)">🔬 재현 검증<br><span class="hint">PNG 드롭 → 같은 설정·시드로 1장 생성해 픽셀 비교</span></div>
      </div>
      <div class="hint">"느낌 탓인지" 확인하려면 <b>재현 검증</b>을 쓰세요. 같은 시드에서 두 이미지가 (거의) 같으면 앱이 NAI 웹과 동일하게 동작하는 것이고, 평소 차이는 설정(가이던스·스텝·UC 프리셋·Variety·SMEA)이나 랜덤 시드 때문입니다. Opus 무료 조건(≤1024²·≤28스텝)이면 Anlas가 들지 않습니다.</div>`;
    const d = body.querySelector('#niDrop'); bindDrop(d, f => importFromPng(f)); d.onclick = () => pickFiles(false, f => importFromPng(f), 'image/png');
    const r = body.querySelector('#niRepro'); bindDrop(r, f => runRepro(f)); r.onclick = () => pickFiles(false, f => runRepro(f), 'image/png');
  });
}
async function runRepro(file) {
  const chunks = await pngTextChunks(new Uint8Array(await file.arrayBuffer()));
  if (!chunks.find(c => c.key === 'Comment')) { toast('NAI 메타데이터가 없는 파일입니다', 'err'); return; }
  await importFromPng(file);      // 설정·시드 복원 (모달 닫힘)
  R.i2iBlob = null; R.maskCanvas = null; updateI2IUI(); R.vibes = []; renderVibes(); R.prefs = []; renderPrefs();
  const savedN = S.n; S.n = 1;
  let item = null;
  try { item = await doGenerate(undefined, '재현 검증'); } catch (e) { S.n = savedN; return; }
  S.n = savedN;
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
    mean < 3 ? '✔ 사실상 동일 — 앱이 NAI 웹과 같은 결과를 냅니다. 평소 차이는 설정/시드 차이입니다' :
    mean < 12 ? '△ 거의 같음 (미세 차이) — 원본이 재저장/리사이즈됐거나 NAI 서버 측 비결정성. 파라미터는 동일합니다' :
    '✖ 다름 — 파라미터 차이가 있습니다. 아래 두 메타를 비교해서 알려주세요';
  openModal('재현 검증 결과', body => {
    body.innerHTML = `<div class="repro"><div><img src="${URL.createObjectURL(file)}"><div class="cap">NAI 웹 원본 ${a.width}×${a.height}</div></div><div><img src="${item.url}"><div class="cap">이 앱 생성 ${b.width}×${b.height}</div></div></div>
      <div><b>일치 픽셀 ${pct}%</b> · 평균 색차 ${mean.toFixed(1)}/255 · seed ${item.seed}</div><div class="hint">${verdict}</div>
      <div class="row"><button class="btn sm" id="rpMeta">두 메타데이터 비교 보기</button></div><div id="rpDiff"></div>`;
    body.querySelector('#rpMeta').onclick = async () => {
      const cm = chunks.find(c => c.key === 'Comment'); let j = {}; try { j = JSON.parse(cm.text); } catch (e) {}
      const mine = item.meta.parameters || {};
      const keys = [...new Set([...Object.keys(j), ...Object.keys(mine)])].filter(k => !/^(image|mask|reference_|director_|signed_hash|request_type)/.test(k)).sort();
      const cell = (s, i, isDiff) => { s = String(s); if (!isDiff || i < 0) return esc(s.length > 400 ? s.slice(0, 400) + '…' : s); const a = s.slice(Math.max(0, i - 60), i), b = s.slice(i, i + 160); return (i > 60 ? '…' : '') + esc(a) + '<mark class="dmark">' + esc(b) + (s.length > i + 160 ? '…' : '') + '</mark>'; };
      const rows = keys.map(k => {
        const A = JSON.stringify(j[k]), B = JSON.stringify(mine[k]);
        const diff = A !== B && !(A === undefined || B === undefined);
        let i = -1; if (diff) { const a = String(A), b = String(B); i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; }
        return `<tr class="${diff ? 'diff' : ''}"><td>${esc(k)}</td><td>${cell(A, i, diff)}</td><td>${cell(B, i, diff)}</td></tr>`;
      }).join('');
      body.querySelector('#rpDiff').innerHTML = `<div style="max-height:44vh;overflow:auto"><table class="metatbl"><tr><th>필드</th><th>NAI 웹 PNG</th><th>이 앱</th></tr>${rows}</table></div><div class="hint">빨간 줄 = 값이 다른 필드이고, 노란 강조 = 처음으로 달라지는 지점부터. 한쪽이 undefined인 건 NAI 서버가 메타에만 넣는 필드라 정상. 픽셀이 100% 같으면 표기 순서 차이일 뿐입니다.</div>`;
    };
  }, true);
}

/* ─────────────── 전체 백업 / 복원 (ZIP) ─────────────── */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8, crc) { crc = (crc == null ? 0xFFFFFFFF : crc); for (let i = 0; i < u8.length; i++) crc = CRC_T[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8); return crc; }
async function zipBuild(files) { // files: [{name, blob|u8}] → Blob (STORE, ZIP64 미사용 → 4GB 미만)
  const parts = [], cds = []; let off = 0; const enc = new TextEncoder();
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const dt = new Date(); const dosT = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1), dosD = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  for (const f of files) {
    const name = enc.encode(f.name); const data = f.u8 || new Uint8Array(await f.blob.arrayBuffer());
    const crc = (crc32(data) ^ 0xFFFFFFFF) >>> 0, size = data.length;
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x800), ...u16(0), ...u16(dosT), ...u16(dosD), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name]);
    parts.push(lh, data);
    cds.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x800), ...u16(0), ...u16(dosT), ...u16(dosD), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...name]));
    off += lh.length + size;
  }
  const cdSize = cds.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...cds, eocd], { type: 'application/zip' });
}
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
      <div id="bkPreview"></div>`;
    const bkHist = body.querySelector('#bkHist'), bkFav = body.querySelector('#bkFav');
    bkHist.onchange = () => { if (bkHist.checked) bkFav.checked = false; }; bkFav.onchange = () => { if (bkFav.checked) bkHist.checked = false; };
    body.querySelector('#bkGo').onclick = async () => {
      const st = body.querySelector('#bkSt'); st.textContent = '만드는 중…';
      try {
        const files = [];
        const meta = { app: 'NAI Studio', version: 9, at: new Date().toISOString(), state: S };
        try { meta.vibelib = await vibeLibAll(); } catch (e) {}   // 유료 인코딩이 든 바이브 라이브러리도 함께
        if (body.querySelector('#bkTok').checked) {
          try { const r = await apiFetch('/config?full=1'); if (r.ok) meta.config = await r.json(); } catch (e) {}
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
            idx.push({ file: fn, meta: h.meta, seed: h.seed, model: h.model, w: h.w, h: h.h, fav: !!h.fav, t: h.t, label: h.label, sceneId: h.sceneId || null, name: h.name });
            i++; if (i % 20 === 0) st.textContent = `이미지 담는 중… ${i}/${items.length}`;
          }
          files.push({ name: 'history/index.json', u8: new TextEncoder().encode(JSON.stringify(idx)) });
        }
        st.textContent = 'ZIP 생성 중…';
        const zip = await zipBuild(files);
        downloadBlob(zip, `nai-studio-backup_${ts()}.zip`);
        st.textContent = `✔ 완료 (${(zip.size / 1048576).toFixed(1)}MB, 파일 ${files.length}개)`;
      } catch (e) { st.textContent = '✖ ' + e.message; }
    };
    const drop = body.querySelector('#bkDrop');
    const handle = async f => {
      const pv = body.querySelector('#bkPreview'); pv.innerHTML = '<div class="hint">읽는 중…</div>';
      try {
        let state = null, config = null, histIdx = [], histFiles = {}, vibelib = null;
        if (/\.json$/i.test(f.name)) { const j = JSON.parse(await f.text()); state = j.state || j; config = j.config || null; vibelib = j.vibelib || null; }
        else {
          const entries = await unzip(await f.arrayBuffer());
          for (const e of entries) {
            if (e.name === 'nai-studio-backup.json') { const j = JSON.parse(new TextDecoder().decode(e.data)); state = j.state; config = j.config || null; vibelib = j.vibelib || null; }
            else if (e.name === 'history/index.json') histIdx = JSON.parse(new TextDecoder().decode(e.data));
            else if (e.name.startsWith('history/')) histFiles[e.name] = e.data;
          }
        }
        if (!state) throw new Error('백업 파일 형식이 아닙니다');
        pv.innerHTML = `<div class="style-card"><b>백업 내용</b>
          <div class="hint">청크 ${(state.chunks||[]).length} · 스타일 ${(state.styles||[]).length} · 캐릭터 ${(state.characters||[]).length} · 씬 ${(state.scenes||[]).length} · 바이브 ${(vibelib||[]).length} · 유튜브 대기열 ${(state.ytQueue||[]).length}/기록 ${(state.ytHistory||[]).length} · 이미지 ${histIdx.length}장${config ? ' · 토큰/연결정보 포함' : ''}${state.savedAt ? ' · ' + new Date(state.savedAt).toLocaleString() : ''}</div>
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
          if (replace) { const del = S.deleted; S = { ...DEFAULTS, ...state }; S.deleted = { ...(state.deleted || {}), ...del }; }
          else {
            const mergeBy = (a, b, key) => { const out = [...(a || [])]; (b || []).forEach(x => { if (!out.some(y => (y[key] || '').toString().toLowerCase() === (x[key] || '').toString().toLowerCase())) out.push(x); }); return out; };
            S.chunks = mergeBy(S.chunks, state.chunks, 'name'); S.styles = mergeBy(S.styles, state.styles, 'name'); S.characters = mergeBy(S.characters, state.characters, 'name');
            S.scenes = mergeBy(S.scenes, state.scenes, 'id'); S.chunkCats = [...new Set([...(S.chunkCats || []), ...(state.chunkCats || [])])];
            S.ytQueue = mergeBy(S.ytQueue, state.ytQueue, 'id'); S.ytHistory = mergeBy(S.ytHistory, state.ytHistory, 'id');
            if (!S.prompt && !Object.keys(S.secText || {}).length) { S.secText = state.secText || {}; S.prompt = state.prompt || ''; S.sections = state.sections || S.sections; }
            for (const k of ['ov', 'model', 'w', 'h', 'steps', 'scale', 'rescale', 'sampler', 'schedule', 'quality', 'ucPreset', 'variety', 'decrisper', 'autoNsfw', 'theme', 'autoMode', 'autoCount', 'autoDelay']) if (state[k] !== undefined && S[k] === DEFAULTS[k]) S[k] = state[k];
          }
          S.savedAt = Date.now(); save();
          if (config) {
            // 값이 있는 키만 보낸다 — 빈 문자열을 보내면 서버가 "지우기"로 해석해
            // 백업에 없던 NAI 토큰·유튜브 연결이 날아간다
            const cfgSend = Object.fromEntries(Object.entries(config).filter(([, v]) => v && String(v).trim()));
            if (Object.keys(cfgSend).length) { try { await apiFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfgSend) }); } catch (e) {} }
          }
          if (vibelib && vibelib.length) { try { const cur = await vibeLibAll(); const names = new Set(cur.map(x => x.name)); const add = vibelib.filter(x => replace || !names.has(x.name)); await vibeLibSave(replace ? vibelib : cur.concat(add)); } catch (e) {} }
          let n = 0, failed = 0;
          for (const it of histIdx) {
            const data = histFiles[it.file]; if (!data) continue;
            if (!replace && R.hist.some(h => h.seed === it.seed && h.t === it.t)) continue;
            const blob = new Blob([data], { type: 'image/png' });
            const rec = { blob, meta: it.meta || {}, seed: it.seed, model: it.model, w: it.w, h: it.h, fav: !!it.fav, t: it.t || Date.now(), name: it.name || it.file.split('/').pop(), label: it.label || '', sceneId: it.sceneId || null };
            try { rec.id = await histPut({ ...rec }); } catch (e) { failed++; }
            rec.url = URL.createObjectURL(blob); R.hist.push(rec); n++;
            if (n % 20 === 0) rst.textContent = `이미지 복원 중… ${n}/${histIdx.length}`;
          }
          R.hist.sort((a, b) => a.t - b.t); renderHist(); if (R.hist.length) showImage(R.hist.length - 1);
          syncUI(); renderChars(); renderChunkBar(); applyTheme(); if (typeof renderStyleSelects === 'function') renderStyleSelects(); if (typeof renderYtQueue === 'function') renderYtQueue(); if (window.onHistChanged) window.onHistChanged();
          // 저장 실패를 조용히 삼키지 않는다 — 새로고침하면 사라질 이미지이므로 알려야 한다
          rst.textContent = `✔ 복원 완료 (이미지 ${n}장${failed ? `, ${failed}장은 저장 실패 — 새로고침하면 사라집니다` : ''})`;
          toast(failed ? `백업 복원 완료 — ${failed}장 저장 실패(용량 부족 가능)` : '백업 복원 완료', failed ? 'err' : '');
        };
        pv.querySelector('#bkMerge').onclick = () => restore(false);
        pv.querySelector('#bkReplace').onclick = () => { if (confirm('현재 설정을 전부 백업 내용으로 교체합니다. 계속할까요?')) restore(true); };
      } catch (e) { pv.innerHTML = `<div class="hint">✖ ${esc(e.message)}</div>`; }
    };
    bindDrop(drop, handle); drop.onclick = () => pickFiles(false, handle, '.zip,.json');
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
    S.chunks.push({ name, text, cat: '검열', createdAt: Date.now() }); n++;
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
    S.chunks.push({ name, text, cat, createdAt: Date.now() }); return 1;
  };
  let n = 0;
  n += add('작가랜덤', ARTIST_SEED.frag, '작가');   // 여러 줄 = 조각 → <작가랜덤> 이 매번 한 명씩 뽑음
  n += add('작가네거', ARTIST_SEED.neg, '작가');
  if (n) addChunkCat('작가');
  if (!S.styles.some(s => s.name === '작태 뽑기') && !isTombed(S.deleted, 'style', 'artist-pack')) {
    S.styles.push({ id: 'artist-pack', name: '작태 뽑기', prefix: ARTIST_SEED.base, suffix: '',
      uc: ARTIST_SEED.baseUc, createdAt: Date.now() });
    n++;
  }
  if (n) save();
}

function initTools() {
  seedCensorChunks(); seedArtistPack(); initSmartTools();
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
  $('#btnBackup').onclick = openBackup;
  $('#tEnhance').onclick = toolEnhance; $('#tUpscale').onclick = toolUpscale; $('#tVary').onclick = toolVary;
  $('#tInpaint').onclick = toolInpaint; $('#tDirector').onclick = openDirector;
  initYouTube();
}

/* ═══════════════ 스마트 툴 탭 — 이미지 하나에 도구를 모아서 ═══════════════ */
const ST = { blob: null, url: null, w: 0, h: 0, meta: null };
function stSet(blob, meta) {
  if (ST.url) URL.revokeObjectURL(ST.url);
  ST.blob = blob; ST.meta = meta || null;
  ST.url = blob ? URL.createObjectURL(blob) : null;
  const img = $('#stImg'), em = $('#stEmpty');
  if (!img) return;
  if (!blob) { img.hidden = true; em.hidden = false; $('#stMeta').textContent = ''; renderSmartTools(); return; }
  img.src = ST.url; img.hidden = false; em.hidden = true;
  const probe = new Image();
  probe.onload = () => { ST.w = probe.naturalWidth; ST.h = probe.naturalHeight; $('#stMeta').textContent = `${ST.w}×${ST.h}`; renderSmartTools(); };
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
  { k: 'upscale', ic: '⤢', n: '업스케일', d: '2× / 4× 확대 (1024² 이하만)', scale: true, run: (it, o) => runUpscale(it.item, o.scale) },
  { k: 'i2i', ic: '🖼', n: '이미지 투 이미지', d: '이 이미지를 바탕으로 다시 생성', run: it => { setI2I(it.blob); setMode('main'); toast('메인 탭의 i2i 로 넣었습니다'); } },
  { k: 'inpaint', ic: '🖌', n: '인페인팅', d: '칠한 부분만 다시 그리기', run: async it => { setI2I(it.blob); setMode('main'); await openMaskEditor(); } },
  { k: 'mosaic', ic: '▦', n: '모자이크 / 검열', d: '부위를 골라 모자이크·블러 처리', run: it => openMosaicTool(it.blob) },
  { k: 'meta', ic: '🧹', n: '메타데이터 제거', d: 'EXIF·숨은 정보를 지워 저장', run: () => openExifTool() },
];
function renderSmartTools() {
  const list = $('#stList'); if (!list) return;
  const has = !!ST.blob;
  const cost = has && typeof directorToolCost === 'function' ? directorToolCost(ST.w, ST.h, R.tier === 3) : null;
  const ce = $('#stCost'); if (ce) ce.textContent = has && cost != null ? (cost === 0 ? 'Opus 무료' : '디렉터 툴 ◈' + cost) : '';
  list.innerHTML = '';
  for (const t of ST_TOOLS) {
    const c = document.createElement('div'); c.className = 'st-card' + (has ? '' : ' off');
    c.innerHTML = `<div class="st-t"><span class="st-i">${t.ic}</span><b>${t.n}</b></div><div class="hint">${t.d}</div><div class="st-opt"></div>
      <button class="btn sm primary st-go"${has ? '' : ' disabled'}>실행</button>`;
    const opt = c.querySelector('.st-opt');
    if (t.emo) opt.innerHTML += `<label class="fld">표정<select class="st-emo">${EMOTIONS.map(e => `<option>${e}</option>`).join('')}</select></label>`;
    if (t.prompt) opt.innerHTML += `<input type="text" class="st-p" placeholder="${t.prompt}">`;
    if (t.defry) opt.innerHTML += `<label class="rng">원본 유지도 <output class="st-dv">0</output><input type="range" class="st-d" min="0" max="5" step="1" value="0"></label>`;
    if (t.scale) opt.innerHTML += `<div class="row"><label class="ck"><input type="radio" name="stsc" value="2" checked> 2×</label><label class="ck"><input type="radio" name="stsc" value="4"> 4×</label></div>`;
    const dr = c.querySelector('.st-d'); if (dr) dr.oninput = () => c.querySelector('.st-dv').textContent = dr.value;
    c.querySelector('.st-go').onclick = async () => {
      if (!ST.blob) return;
      const o = {
        prompt: (c.querySelector('.st-p') || {}).value || '',
        defry: dr ? +dr.value : 0,
        emo: (c.querySelector('.st-emo') || {}).value || 'neutral',
        scale: +((c.querySelector('input[name=stsc]:checked') || {}).value || 2),
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
  $('#stFromCur').onclick = () => { const it = curItem(); if (!it) { toast('히스토리에 이미지가 없습니다', 'err'); return; } stSet(it.blob, it.meta); };
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
  openModal('✨ AI 프롬프트 생성 — 원하는 장면을 한국어로 쓰면 단부루 태그로 바꿔줍니다', body => {
    body.innerHTML = `
      <label class="fld">모델<select id="aiModel">${GEMINI_MODELS.map(([v, n]) => `<option value="${v}"${v === (S.aiModel || 'gemini-2.5-flash') ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fld">장면 설명<textarea id="aiDesc" class="ta" rows="4" placeholder="예: 카페에서 커피를 마시는 은발 소녀, 창밖은 비, 위에서 내려다보는 구도"></textarea></label>
      <div class="row"><button class="btn primary" id="aiGo">✨ 생성</button><span class="hint">Ctrl+Enter 로도 생성</span></div>
      <label class="fld">결과 (수정 가능)<textarea id="aiOut" class="ta ac" rows="4" placeholder="여기에 태그가 나옵니다"></textarea></label>
      <div class="row"><button class="btn go" id="aiIns">프롬프트에 넣기</button><button class="btn sm" id="aiApp">뒤에 이어붙이기</button>
        <span class="hint" id="aiMsg"></span></div>`;
    const desc = body.querySelector('#aiDesc'), out = body.querySelector('#aiOut'), msg = body.querySelector('#aiMsg');
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
        // 실제로 존재하는 태그인지 표시 (AI가 없는 태그를 만들어 낼 수 있음)
        const parts = out.value.split(',').map(x => x.trim()).filter(Boolean);
        const bad = TAGDB.map ? parts.filter(p => !TAGDB.map.get(p.replace(/ /g, '_')) && !TAGDB.map.get(p)) : [];
        msg.textContent = `태그 ${parts.length}개` + (bad.length ? ` · 사전에 없는 것 ${bad.length}개: ${bad.slice(0, 4).join(', ')}` : ' · 전부 실존');
      } catch (e) { msg.textContent = '✖ ' + e.message; toast(e.message, 'err'); }
      finally { body.querySelector('#aiGo').disabled = false; }
    };
    body.querySelector('#aiGo').onclick = go;
    desc.onkeydown = e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); go(); } };
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
    _hlsLib = window.Hls || false;
  } catch (e) { _hlsLib = false; }
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
      if (!ok) { abandoned = true; ytDestroyHls(); }
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
      ytDestroyHls();
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
async function imageStats(blob) {
  const img = await blobToImage(blob);
  const N = 256;                                   // 256px 로 줄여서 계산 (속도)
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, N, N);
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
  return { sd: +sd.toFixed(2), lap: +lap.toFixed(1), ent: +ent.toFixed(3), mean: +mean.toFixed(1) };
}
/* 최근 이미지들의 품질을 재고, 내 과거 중앙값과 비교 */
async function qualityHealth(sampleN) {
  const items = (R.hist || []).filter(h => h.blob).slice(-(sampleN || 8));
  if (items.length < 3) return { enough: false, n: items.length };
  const stats = [];
  for (const it of items) { try { stats.push(await imageStats(it.blob)); } catch (e) {} }
  if (stats.length < 3) return { enough: false, n: stats.length };
  const m = k => med(stats.map(s => s[k]));
  const cur = { sd: m('sd'), lap: m('lap'), ent: m('ent') };
  const base = S.qBase;                              // 기준선 (평소 상태)
  const ratio = base ? { sd: cur.sd / base.sd, lap: cur.lap / base.lap, ent: cur.ent / base.ent } : null;
  return { enough: true, n: stats.length, cur, base, ratio };
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
      msg.textContent = '소스로 실행 중입니다 — 저장소에서 새 버전을 직접 받아 덮어쓰세요.';
    } else if (j.available && !j.asset) {
      msg.textContent = '릴리스에 .exe 파일이 없습니다.';
    }
    if (j.page) { const a = document.createElement('a'); a.className = 'btn sm'; a.href = j.page; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '릴리스 페이지'; row.appendChild(a); }
    const re = document.createElement('button'); re.className = 'btn sm'; re.textContent = '다시 확인';
    re.onclick = async () => { closeModal(); await updateCheck(false); };
    row.appendChild(re);
  });
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
          try { await apiFetch('/update/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (e) {}
        };
        row.innerHTML = ''; row.appendChild(go);
      } else if (st.state === 'error') {
        clearInterval(poll); bar.hidden = true; msg.textContent = '✖ ' + (st.msg || '실패');
      }
    } catch (e) { clearInterval(poll); msg.textContent = '✖ ' + e.message; }
  }, 400);
}
