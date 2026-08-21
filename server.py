# -*- coding: utf-8 -*-
# NAI Studio — NovelAI 로컬 이미지 생성 스튜디오
# Copyright (C) 2026 seaw0616
#
# 이 프로그램은 자유 소프트웨어입니다. 자유 소프트웨어 재단이 발표한
# GNU 일반 공중 사용 허가서 버전 3 또는 (선택에 따라) 그 이후 버전의
# 조건에 따라 재배포하거나 수정할 수 있습니다.
#
# 이 프로그램은 유용하게 쓰이기를 바라며 배포되지만 어떠한 보증도 하지 않습니다.
# 자세한 내용은 GNU 일반 공중 사용 허가서를 보십시오: <https://www.gnu.org/licenses/>
#
# NAIS3 (https://github.com/sunanakgo/NAIS3, GPL-3.0) 의 규격·구현을 참고했습니다.
# 그 밖의 서드파티 고지는 NOTICE.txt 를 참고하십시오.
"""
NAI Studio - local server  (v2)
- serves the app files
- proxies NovelAI API calls (avoids browser CORS)      /img/*  /api/*
- YouTube search without API key                       /yt/search?q=
- Korean danbooru tag DB (auto-download + convert)     /tags/kr.json
Requires only the Python standard library.
"""
import sys
import os
import io
import re
import csv
import time
import base64
import gzip
import json
import socket
import threading
import webbrowser
import mimetypes
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VERSION = 17
RELEASE = "11.21"            # 배포 버전. GitHub 릴리스 태그 "v11.21" 과 짝을 이룬다.
UPDATE_REPO = ""            # "사용자명/저장소" — 비어 있으면 설정에서 넣는다 (config.json 의 updateRepo)
FROZEN = getattr(sys, "frozen", False)          # PyInstaller 로 묶인 단일 exe 인가
if FROZEN:
    # 앱 파일(html/js/css/assets)은 exe 안에 들어있고, 실행 시 임시폴더(_MEIPASS)에 풀린다.
    # 사용자 데이터는 절대 거기 두면 안 된다 — 종료할 때 통째로 지워진다. exe 옆 폴더에 저장.
    ROOT = Path(sys._MEIPASS)
    HOME = Path(sys.executable).resolve().parent
else:
    ROOT = Path(__file__).resolve().parent
    HOME = ROOT
DATA = HOME / "data"
if "--data" in sys.argv:  # 테스트용: 별도 데이터 폴더
    try:
        DATA = Path(sys.argv[sys.argv.index("--data") + 1]).resolve()
    except IndexError:
        pass
CONFIG = DATA / "config.json"


def load_cfg(strict=False):
    """설정(토큰·키)을 읽는다.

    파일이 없는 것과 "있는데 못 읽는 것" 은 전혀 다르다. 예전엔 둘 다 {} 로 돌려줘서,
    바이러스 검사나 잠금으로 한 번 읽기에 실패하면 다음 저장 때 NAI 토큰·Gemini 키·
    유튜브 연결이 통째로 지워졌다. 이제 잠깐 기다렸다 다시 읽어 보고,
    그래도 안 되면 strict 일 때 예외를 낸다(=저장을 하지 않는다)."""
    if not CONFIG.exists():
        return {}
    last = None
    for i in range(3):
        try:
            return json.loads(CONFIG.read_text(encoding="utf-8") or "{}")
        except Exception as e:
            last = e
            time.sleep(0.05 * (i + 1))
    if strict:
        raise IOError("설정 파일을 읽지 못했습니다: %s" % str(last)[:120])
    return {}


def save_cfg(cfg):
    """설정을 원자적으로 쓴다 — 쓰다가 끊겨도 이전 파일이 남는다."""
    DATA.mkdir(exist_ok=True)
    tmp = CONFIG.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    for i in range(5):
        try:
            os.replace(str(tmp), str(CONFIG))
            return
        except PermissionError:
            time.sleep(0.08 * (i + 1))
    os.replace(str(tmp), str(CONFIG))
PORT_CANDIDATES = [8765, 8766, 8767, 8768, 8769]

UPSTREAMS = {
    "/img/": "https://image.novelai.net/",
    "/api/": "https://api.novelai.net/",
    "/g/": "https://www.googleapis.com/",          # YouTube Data API (계정 연결)
    "/gtoken": "https://oauth2.googleapis.com/token",  # OAuth 토큰 교환/갱신
}
NAI_PREFIXES = ("/img/", "/api/")  # 이 경로에만 저장된 NAI 토큰을 주입
FORWARD_HEADERS = ("Authorization", "Content-Type", "Accept")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

TAG_CSV_URL = ("https://raw.githubusercontent.com/localsmile/"
               "danbooru_KR_wiki_tag_search/main/danbooru_tags_classified.csv")
TAG_CSV = DATA / "danbooru_tags_kr.csv"
TAG_JSON_GZ = DATA / "tags_kr.json.gz"
_tag_lock = threading.Lock()
_state_lock = threading.Lock()
_tag_status = {"state": "idle", "msg": ""}

csv.field_size_limit(10_000_000)

# ─────────────────────────── YouTube 직접 재생 엔진 (yt-dlp, 앱 폴더 vendor/ 에 자체 설치) ───────────────────────────
VENDOR = HOME / "vendor"      # 런타임 설치분은 exe 옆에 (번들 안에 넣으면 종료 시 사라짐)
if str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))
_ytdlp = None
_yt_cache = {}   # (vid, mode) -> (expires, info)
_yt_lock = threading.Lock()


def yt_engine():
    global _ytdlp
    if _ytdlp is None:
        try:
            import importlib
            _ytdlp = importlib.import_module("yt_dlp")
        except Exception:
            _ytdlp = False
    return _ytdlp or None


def yt_engine_install():
    """pip install --target vendor -U yt-dlp (사용자 파이썬 환경은 건드리지 않음)"""
    import subprocess
    global _ytdlp
    if FROZEN:
        # 단일 exe 에는 pip 가 없다. 엔진은 이미 번들돼 있으므로 설치할 것이 없다.
        return (bool(yt_engine()), "단일 실행 파일에는 재생 엔진이 이미 포함돼 있습니다")
    VENDOR.mkdir(exist_ok=True)
    cmd = [sys.executable, "-m", "pip", "install", "-U", "--target", str(VENDOR), "yt-dlp"]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode != 0:
        return False, out[-800:]
    _ytdlp = None
    import importlib
    if "yt_dlp" in sys.modules:
        for k in [k for k in sys.modules if k.startswith("yt_dlp")]:
            del sys.modules[k]
    importlib.invalidate_caches()
    return bool(yt_engine()), out[-300:]


def find_node():
    """JS 런타임(node) 찾기 — 유튜브 서명/n-challenge 해제에 필요 (없으면 403 스트림이 나옴)"""
    cands = []
    la = os.environ.get("LOCALAPPDATA", "")
    if la:
        cands.append(os.path.join(la, "hermes", "node", "node.exe"))
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    cands += [os.path.join(pf, "nodejs", "node.exe"), r"C:\Program Files (x86)\nodejs\node.exe"]
    import shutil
    w = shutil.which("node")
    if w:
        cands.insert(0, w)
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None


_NODE = None
# 클라이언트마다 유튜브가 주는 URL의 유효성이 다름(android_vr·mweb 은 403 나는 경우 많음) → 되는 것을 찾을 때까지 순서대로 시도
YT_CLIENTS = [None, "android", "tv_simply", "web_embedded", "web_safari", "android_vr"]


def _ydl_opts(fmt, client):
    global _NODE
    if _NODE is None:
        _NODE = find_node() or False
    o = {"quiet": True, "no_warnings": True, "skip_download": True, "format": fmt, "noplaylist": True,
         "socket_timeout": 20, "cachedir": str(DATA / "ytdlp-cache"), "remote_components": ["ejs:github"]}
    if _NODE:
        o["js_runtimes"] = {"node": {"path": _NODE}}
    if client:
        o["extractor_args"] = {"youtube": {"player_client": [client]}}
    return o


# 합집합으로 지켜야 하는 것은 "만들어 둔 내용"뿐이다 (탭을 두 개 열어도 서로 지우지 않도록).
#
# ytQueue·ytHistory 는 여기 있으면 안 된다. 이 둘은 톰스톤 종류가 없어서(kind=None)
# 합집합이 곧 "절대 지워지지 않음"이 된다 — 사용자가 대기열에서 곡을 빼도 서버가 그대로
# 되살려 보냈다. 대기열은 지금 재생 중인 목록이라 마지막에 바꾼 쪽이 옳다(최신 우선).
_STATE_LISTS = [("chunks", "name", "chunk"), ("styles", "id", "style"), ("characters", "name", "char"),
                ("scenes", "id", "scene")]


def _merge_state(cur, inc):
    """서버 쪽 목록 병합 — app.js 의 mergeByKey 와 같은 규칙(합집합 − 톰스톤, createdAt 예외).
       들어온 쪽(inc)을 기준으로 하되, 서버에만 있는 항목을 살려서 돌려준다."""
    out = dict(inc)
    deleted = dict(cur.get("deleted") or {})
    deleted.update(inc.get("deleted") or {})
    out["deleted"] = deleted

    def dead(kind, key, item):
        if not kind:
            return False
        t = deleted.get("%s|%s" % (kind, str(key or "").lower()))
        if not t:
            return False
        c = (item or {}).get("createdAt")
        return not (isinstance(c, (int, float)) and c > t)

    for name, key, kind in _STATE_LISTS:
        a = inc.get(name)
        b = cur.get(name)
        if not isinstance(a, list) or not isinstance(b, list):
            continue
        res, seen = [], set()
        for x in a:
            if not isinstance(x, dict):
                continue
            k = str(x.get(key) or x.get("list") or "").lower()
            if dead(kind, k, x):
                continue
            res.append(x)
            if k:
                seen.add(k)
        for x in b:
            if not isinstance(x, dict):
                continue
            k = str(x.get(key) or x.get("list") or "").lower()
            if not k or k in seen or dead(kind, k, x):
                continue
            res.append(x)
            seen.add(k)
        out[name] = res

    ac, bc = inc.get("chunkCats"), cur.get("chunkCats")
    if isinstance(ac, list) and isinstance(bc, list):
        cats, s = [], set()
        for c in list(ac) + list(bc):
            if not isinstance(c, str) or c in s or dead("cat", c, None):
                continue
            cats.append(c)
            s.add(c)
        out["chunkCats"] = cats
    return out


# ─────────────────────────── 단부루 (작가 태그 샘플·추천) ───────────────────────────
# ─────────────────────────── 자동 업데이트 (GitHub Releases) ───────────────────────────
_upd = {"state": "idle", "got": 0, "total": 0, "msg": "", "file": "", "ver": ""}
_upd_lock = threading.Lock()


def _ver_tuple(v):
    """'v11.8' / '11.8.1' → (11, 8, 1) 로 바꿔 크기 비교"""
    out = []
    for part in re.findall(r"\d+", str(v or "")):
        out.append(int(part))
    return tuple(out) or (0,)


def _upd_repo():
    """설정에 적힌 업데이트 저장소를 "사용자명/저장소" 형태로 정규화한다.

    사용자는 보통 주소창에서 통째로 복사해 붙여넣는다
    (https://github.com/owner/repo, .../releases, 끝에 .git 등).
    예전엔 그걸 그대로 받아 형식 검사에서 떨어뜨렸고, 화면에는
    "저장소를 먼저 지정하세요" 라고만 떠서 안 넣은 것처럼 보였다.
    """
    v = (load_cfg().get("updateRepo") or UPDATE_REPO or "").strip()
    if not v:
        return ""
    v = re.sub(r"^(https?://)?(www\.)?github\.com/", "", v, flags=re.I)
    v = v.strip().strip("/")
    v = re.sub(r"\.git$", "", v, flags=re.I)
    parts = [p for p in v.split("/") if p]
    return (parts[0] + "/" + parts[1]) if len(parts) >= 2 else v


def _gh(url):
    req = urllib.request.Request(url, headers={"User-Agent": "NAI-Studio", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


_upd_cache = {"t": 0.0, "data": None, "busy": False}


def update_check_cached(max_age=600):
    """/health 에 실어 보내기 위한 캐시본.

    앱은 이미 15초마다 /health 를 물어보므로, 서버가 10분에 한 번만 GitHub 를 보고
    그 결과를 실어 주면 새 버전이 나온 뒤 몇 초 안에 표시가 뜬다.
    GitHub 익명 한도(시간당 60회)도 기기당 6회로 지켜진다.
    /health 는 절대 막히면 안 되므로, 캐시가 낡았으면 백그라운드로 갱신하고
    지금 있는 값을 그대로 돌려준다."""
    now = time.time()
    stale = (now - _upd_cache["t"]) > max_age
    if stale and not _upd_cache["busy"]:
        _upd_cache["busy"] = True

        def refresh():
            try:
                d = update_check()
                _upd_cache["data"] = d
                _upd_cache["t"] = time.time()
            except Exception:
                _upd_cache["t"] = time.time() - max_age + 60   # 실패하면 1분 뒤 재시도
            finally:
                _upd_cache["busy"] = False

        threading.Thread(target=refresh, daemon=True).start()
    d = _upd_cache["data"]
    if not d:
        return None
    return {"latest": d.get("latest"), "available": bool(d.get("available")),
            "current": d.get("current"), "configured": bool(d.get("configured"))}


def update_check():
    """최신 릴리스 조회 → 지금 버전과 비교"""
    repo = _upd_repo()
    if not repo:
        return {"configured": False, "current": RELEASE}
    if not re.fullmatch(r"[\w.\-]+/[\w.\-]+", repo):
        return {"configured": False, "current": RELEASE, "error": "저장소 형식이 올바르지 않습니다 (사용자명/저장소)"}
    j = _gh("https://api.github.com/repos/%s/releases/latest" % repo)
    tag = j.get("tag_name") or ""
    newer = _ver_tuple(tag) > _ver_tuple(RELEASE)
    asset = None
    for a in (j.get("assets") or []):
        n = (a.get("name") or "").lower()
        if n.endswith(".exe"):
            asset = {"name": a.get("name"), "size": a.get("size"),
                     "url": a.get("browser_download_url")}
            break
    return {"configured": True, "current": RELEASE, "latest": tag, "available": bool(newer),
            "notes": (j.get("body") or "")[:4000], "published": (j.get("published_at") or "")[:10],
            "page": j.get("html_url"), "asset": asset, "frozen": FROZEN,
            # 소스로 실행 중일 때 버튼 하나로 받게 하려고 저장소 압축본 주소도 함께 준다
            "zip": j.get("zipball_url") or ("https://github.com/%s/archive/refs/tags/%s.zip" % (repo, tag) if tag else None)}


def _upd_set(**kw):
    with _upd_lock:
        _upd.update(kw)


def update_download(url, expect_size, ver):
    """새 exe 를 exe 옆에 내려받는다 (덮어쓰기는 종료 후에 해야 한다).

    같은 .part 파일에 두 번 이상 동시에 쓰면 바이트가 섞인 채 크기 검사만 통과해
    '받기 완료' 로 표시되고, 그 깨진 exe 가 그대로 적용된다.
    → 이미 받는 중이면 새 요청은 무시한다."""
    with _upd_lock:
        if _upd.get("state") == "downloading":
            return False
        _upd.update(state="downloading", got=0, total=expect_size or 0, msg="", ver=ver)

    def work():
        try:
            dest = HOME / "NAI-Studio.new.exe"
            tmp = HOME / "NAI-Studio.new.part"
            req = urllib.request.Request(url, headers={"User-Agent": "NAI-Studio"})
            with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
                total = int(r.headers.get("Content-Length") or expect_size or 0)
                _upd_set(total=total)
                got = 0
                while True:
                    chunk = r.read(262144)
                    if not chunk:
                        break
                    f.write(chunk)
                    got += len(chunk)
                    _upd_set(got=got)
            # 예전 검사는 두 군데가 헐거웠다.
            #  - Content-Length 가 없으면(total=0) 검사 자체가 꺼져, 5MB 만 받고 끊겨도
            #    "받기 완료" 가 됐다. 릴리스가 알려준 크기(expect_size)로 대신 본다.
            #  - 2% 여유를 뒀는데 30MB 짜리면 600KB 가 빠져도 통과한다. exe 는 1바이트만
            #    달라도 못 쓴다 → 정확히 맞을 때만 통과시킨다.
            # 받은 것이 정말 실행 파일인지도 확인한다(오류 페이지를 받아 두는 경우가 있다).
            want = total or expect_size or 0
            if want and got != want:
                raise IOError("다운로드가 끊겼습니다 (%d/%d 바이트) — 다시 시도해 주세요" % (got, want))
            if not want:
                raise IOError("파일 크기를 알 수 없어 안전하게 멈췄습니다 — 릴리스 페이지에서 직접 받아 주세요")
            with open(tmp, "rb") as _f:
                if _f.read(2) != b"MZ":
                    raise IOError("받은 파일이 실행 파일이 아닙니다 (네트워크가 다른 페이지를 준 것 같습니다)")
            if dest.exists():
                dest.unlink()
            tmp.replace(dest)
            _upd_set(state="ready", file=str(dest), msg="")
        except Exception as e:
            _upd_set(state="error", msg=str(e)[:200])
    threading.Thread(target=work, daemon=True).start()
    return True


def update_source(url, ver):
    """소스로 실행 중일 때의 업데이트.

    exe 가 아니라 앱 파일(js/html/css/py)을 저장소 압축본으로 갈아끼운다.
    깃헙에 들어가 받아 덮어쓰라고 안내만 하던 것을 버튼 하나로 끝내기 위한 것.

    사용자 데이터(data/), 설치분(vendor/, .build-venv/, dist/, build/)은 건드리지 않는다.
    갈아끼우기 전 지금 파일을 data/backups/src-<시각>/ 에 넣어 되돌릴 수 있게 한다.
    """
    import zipfile, shutil, io as _io

    KEEP_EXT = (".js", ".py", ".html", ".css", ".bat", ".txt", ".spec", ".md")
    KEEP_NAME = ("LICENSE",)
    SKIP_TOP = {"data", "vendor", "dist", "build", ".build-venv", ".git", ".github"}

    def work():
        try:
            with _upd_lock:
                _upd.update(state="downloading", got=0, total=0, msg="", ver=ver)
            req = urllib.request.Request(url, headers={"User-Agent": "NAI-Studio"})
            buf = _io.BytesIO()
            with urllib.request.urlopen(req, timeout=180) as r:
                total = int(r.headers.get("Content-Length") or 0)
                _upd_set(total=total)
                while True:
                    chunk = r.read(262144)
                    if not chunk:
                        break
                    buf.write(chunk)
                    _upd_set(got=buf.tell())
            buf.seek(0)
            z = zipfile.ZipFile(buf)
            names = z.namelist()
            root = names[0].split("/")[0] + "/" if names else ""
            # 받은 것이 정말 이 앱인지 확인하고 나서 손댄다
            need = {"server.py", "app.js", "index.html"}
            got_names = {n[len(root):] for n in names if n.startswith(root)}
            if not need.issubset(got_names):
                raise IOError("받은 압축본이 NAI Studio 소스가 아닙니다")

            bdir = DATA / "backups" / ("src-%s" % time.strftime("%Y%m%d-%H%M%S"))
            bdir.mkdir(parents=True, exist_ok=True)
            n = 0
            for name in names:
                if not name.startswith(root) or name.endswith("/"):
                    continue
                rel = name[len(root):]
                if not rel or rel.split("/")[0] in SKIP_TOP:
                    continue
                base = rel.split("/")[-1]
                if not (rel.endswith(KEEP_EXT) or base in KEEP_NAME):
                    continue
                # 압축본 안의 경로를 그대로 믿으면 안 된다. "../" 나 절대경로가 들어 있으면
                # 앱 폴더 밖에 파일을 쓰게 된다(zip slip). 여기서 쓰는 확장자가 .bat/.py 라
                # 시작프로그램 폴더에 하나만 심어도 코드 실행이 된다.
                if "\\" in rel or rel.startswith("/") or ":" in rel.split("/")[0]:
                    continue
                if any(part in ("..", "") for part in rel.split("/")):
                    continue
                dest = (ROOT / rel).resolve()
                try:
                    dest.relative_to(ROOT.resolve())     # 정말 앱 폴더 안인지 최종 확인
                except ValueError:
                    continue
                if dest.exists():                       # 되돌릴 수 있게 먼저 보관
                    b = bdir / rel
                    b.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(dest, b)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(z.read(name))
                n += 1
            _upd_set(state="ready", file=str(bdir), msg="소스 %d개 파일을 갈아끼웠습니다" % n)
        except Exception as e:
            _upd_set(state="error", msg=str(e)[:200])

    threading.Thread(target=work, daemon=True).start()
    return True


def restart_self():
    """소스 실행을 새 프로세스로 다시 띄우고 지금 것은 끝낸다.

    두 가지를 지켜야 한다.
      - 실행 인자(--data, --app, --port …)를 그대로 넘긴다. 예전엔 버려서
        테스트용 데이터 폴더나 앱 모드가 재시작하면 사라졌다.
      - 옛 프로세스가 포트를 놓은 뒤에 새 것을 띄운다. 겹치면 새 프로세스가
        8765 를 못 잡고 8766 으로 뜨는데, 사용자가 보던 탭은 8765 를 가리킨 채
        조용히 서버 저장이 끊긴다.
    """
    import subprocess
    args = [a for a in sys.argv[1:] if a != "--no-browser"]
    cmd = [sys.executable, str(ROOT / "server.py")] + args

    def go():
        try:
            subprocess.Popen(cmd, cwd=str(ROOT),
                             creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
        except Exception:
            pass
        os._exit(0)

    # 먼저 죽고 나서(=포트를 놓고) 새로 띄운다 → 같은 포트로 다시 뜬다
    threading.Timer(0.6, go).start()
    return True, "재시작합니다"


def update_apply():
    """실행 중인 exe 는 자기 자신을 덮어쓸 수 없다.
       → 배치 파일이 종료를 기다렸다가 교체하고 다시 실행하게 한다."""
    if not FROZEN:
        return False, "소스 실행 중에는 자동 교체를 하지 않습니다"
    new = HOME / "NAI-Studio.new.exe"
    if not new.exists():
        return False, "받아둔 새 파일이 없습니다"
    cur = Path(sys.executable).resolve()
    bat = HOME / "_update.bat"
    bat.write_text(
        "@echo off\r\n"
        "chcp 65001 >nul\r\n"
        "echo NAI Studio 업데이트를 적용하는 중입니다...\r\n"
        ":wait\r\n"
        "timeout /t 1 /nobreak >nul\r\n"
        'tasklist /fi "PID eq %d" 2>nul | find "%d" >nul && goto wait\r\n' % (os.getpid(), os.getpid()) +
        'move /y "%s" "%s" >nul\r\n' % (new.name, cur.name) +
        'start "" "%s"\r\n' % cur.name +
        'del "%~f0"\r\n',     # %% 는 배치에서 리터럴 % 가 되어 자기 삭제가 안 됐다
        encoding="utf-8")
    import subprocess
    subprocess.Popen(["cmd", "/c", str(bat)], cwd=str(HOME),
                     creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
    threading.Timer(1.0, lambda: os._exit(0)).start()
    return True, "재시작합니다"


DAN = "https://danbooru.donmai.us"
_dan_cache = {}          # key -> (expires, bytes)
_dan_lock = threading.Lock()
_dan_last = [0.0]        # 마지막 호출 시각 — 초당 1회로 스스로 제한 (익명 rate limit 존중)


SAFEBOORU = "https://safebooru.org"
_BOORU_HOSTS = ("donmai.us", "safebooru.org")


def _dan_host_ok(u):
    try:
        p = urllib.parse.urlparse(u or "")
    except Exception:
        return False
    h = (p.hostname or "").lower()
    return p.scheme == "https" and any(h == d or h.endswith("." + d) for d in _BOORU_HOSTS)


def _safebooru_posts(tag, limit):
    """단부루가 막힌 망(한국 등)에서 쓰는 대체 출처. 태그 체계가 같아 작가 태그가 그대로 통한다."""
    u = ("%s/index.php?page=dapi&s=post&q=index&json=1&limit=%d&tags=%s"
         % (SAFEBOORU, limit, urllib.parse.quote(tag.replace(" ", "_"))))
    req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        j = json.loads(r.read() or b"[]")
    out = []
    for p in (j if isinstance(j, list) else []):
        # 응답이 주는 URL 을 그대로 쓴다 — 해시 길이·확장자가 게시물마다 달라서 직접 조립하면 404 가 난다
        thumb = p.get("preview_url")
        if not thumb:
            d, h = p.get("directory"), p.get("hash")
            if not d or not h:
                continue
            thumb = "%s/thumbnails/%s/thumbnail_%s.jpg" % (SAFEBOORU, d, h)
        if thumb.startswith("//"):
            thumb = "https:" + thumb
        large = p.get("sample_url") or p.get("file_url") or thumb
        if isinstance(large, str) and large.startswith("//"):
            large = "https:" + large
        if not _dan_host_ok(thumb):
            continue
        out.append({"id": p.get("id"), "rating": "g", "score": p.get("score"),
                    "thumb": base64.urlsafe_b64encode(thumb.encode()).decode().rstrip("="),
                    "large": base64.urlsafe_b64encode(str(large).encode()).decode().rstrip("="),
                    "artist": "", "chars": "", "w": p.get("width"), "h": p.get("height")})
    return out


def _dan_get(path_q, ttl=600):
    """단부루 JSON 호출 — 캐시 + 초당 1회 제한. 실패하면 예외."""
    key = path_q
    now = time.time()
    with _dan_lock:
        c = _dan_cache.get(key)
        if c and c[0] > now:
            return c[1]
    url = DAN + path_q
    if not _dan_host_ok(url):
        raise ValueError("bad url")
    # 요청 간 최소 간격(익명 rate limit 존중). 락을 쥔 채로 자면 그 1초 동안
    # 썸네일 프록시 등 다른 요청까지 통째로 멈춘다 → 내 차례만 예약하고 락은 바로 놓는다.
    with _dan_lock:
        now = time.time()
        wait = max(0.0, 1.0 - (now - _dan_last[0]))
        _dan_last[0] = now + wait
    if wait:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read()
    with _dan_lock:
        _dan_cache[key] = (time.time() + ttl, data)
        if len(_dan_cache) > 300:
            for k in sorted(_dan_cache, key=lambda k: _dan_cache[k][0])[:100]:
                _dan_cache.pop(k, None)
    return data


def _dan_img_trim(cap=80 * 1024 * 1024):
    """이미지 캐시 총량을 제한한다 (호출자가 _dan_lock 을 쥔 상태로 부른다)."""
    items = [(k, v) for k, v in _dan_cache.items() if k.startswith("img|")]
    total = 0
    for _, v in items:
        try:
            total += len(v[1][0])
        except Exception:
            pass
    if total <= cap:
        return
    for k, _v in sorted(items, key=lambda kv: kv[1][0]):     # 만료가 이른 것부터
        try:
            total -= len(_dan_cache[k][1][0])
        except Exception:
            pass
        _dan_cache.pop(k, None)
        if total <= cap * 0.7:
            break


def _yt_hls_variants(vid):
    """영상+음성이 함께 든 HLS 변형 목록 (720p·1080p 등). 캐시해서 재추출을 피한다."""
    key = ("hls", vid)
    now = time.time()
    with _yt_lock:
        c = _yt_cache.get(key)
        if c and c[0] > now:
            return c[1]
    y = yt_engine()
    if not y:
        return []
    info = None
    for client in YT_CLIENTS:
        try:
            with y.YoutubeDL(_ydl_opts(None, client)) as ydl:
                info = ydl.extract_info("https://www.youtube.com/watch?v=" + vid, download=False)
            break
        except Exception:
            continue
    if not info:
        return []
    out = []
    for f in info.get("formats") or []:
        if f.get("protocol") != "m3u8_native":
            continue
        if f.get("acodec") in (None, "none") or f.get("vcodec") in (None, "none"):
            continue
        u = f.get("url")
        h = f.get("height")
        if not u or not h or not _yt_host_ok(u):
            continue
        out.append({"h": h, "itag": str(f.get("format_id")),
                    "u": base64.urlsafe_b64encode(u.encode()).decode().rstrip("=")})
    out.sort(key=lambda x: -x["h"])
    with _yt_lock:
        _yt_cache[key] = (now + 1800, out)
    return out


def _yt_host_ok(u):
    """유튜브/구글비디오 호스트인지 (문자열 포함이 아니라 호스트로 판정 — SSRF 방지)"""
    try:
        p = urllib.parse.urlparse(u or "")
    except Exception:
        return False
    h = (p.hostname or "").lower()
    return p.scheme == "https" and (
        h == "youtube.com" or h.endswith(".youtube.com")
        or h == "googlevideo.com" or h.endswith(".googlevideo.com"))


class _CheckRedir(urllib.request.HTTPRedirectHandler):
    """리다이렉트도 매 홉마다 호스트를 재검증 (열린 리다이렉트로 쿠키가 새 나가는 것 방지)"""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not _yt_host_ok(newurl):
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _url_ok(url, headers):
    """스트림 URL이 실제로 열리는지 확인 (403이면 다른 클라이언트로 재시도)"""
    try:
        h = dict(headers or {})
        h.setdefault("User-Agent", UA)
        h["Range"] = "bytes=0-1023"
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status in (200, 206)
    except Exception:
        return False


def yt_stream(vid, mode, fresh=False, itag=None):
    y = yt_engine()
    if not y:
        raise RuntimeError("engine not installed")
    key = (vid, mode)
    now = time.time()
    with _yt_lock:
        c = _yt_cache.get(key)
        if c and c[0] > now and not fresh and not itag:
            return c[1]
    # audio: 브라우저가 바로 읽는 webm/opus 우선 (m4a 140은 DASH 조각 mp4라 Chrome이 Format error)
    # video: protocol=https(progressive) 로 제한해야 한다. 안 그러면 화질이 높은 HLS 를 골라
    #        info["url"] 이 m3u8 매니페스트가 되는데, Chrome/Firefox 의 <video> 는 HLS 를 못 읽는다.
    # 재생 중 403 이 나서 다시 뽑는 경우엔 처음 쓰던 itag 을 그대로 지정한다.
    # 포맷이 바뀌면 앞부분과 이어붙지 않아 재생이 끊긴다.
    if itag:
        fmt = str(itag)
    else:
        fmt = ("bestaudio[ext=webm][acodec=opus]/bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best" if mode == "audio"
               # 영상 모드는 반드시 "음성+영상이 함께 든" 것만 고른다.
               # 예전엔 마지막 후보가 음성 없는 DASH 조각이나 m3u8 까지 골라서,
               # <video> 가 못 읽고 Format error(코드 4)로 죽었다. 하나도 없으면
               # 여기서 깨끗이 실패해야 앱이 오디오 모드로 넘어간다.
               # 마지막 후보는 protocol 을 풀어 준다 — 라이브처럼 progressive 가 없는 영상은
               # HLS 로만 오는데, 이걸 빼면 아예 재생이 안 된다(앱이 hls.js 로 받는다).
               # 다만 "음성+영상이 함께" 라는 조건은 끝까지 지킨다 (그게 Format error 의 원인이었다).
               else "best[protocol=https][ext=mp4][vcodec^=avc1][acodec^=mp4a][height<=720]/"
                    "best[protocol=https][ext=mp4][acodec!=none][vcodec!=none][height<=720]/"
                    "best[protocol=https][acodec!=none][vcodec!=none]/"
                    "best[acodec!=none][vcodec!=none]")
    last_err = None
    info = None
    url = None
    hdrs = {}
    for client in YT_CLIENTS:
        try:
            with y.YoutubeDL(_ydl_opts(fmt, client)) as ydl:
                info = ydl.extract_info("https://www.youtube.com/watch?v=" + vid, download=False)
        except Exception as e:
            last_err = e
            continue
        url = info.get("url")
        if not url and info.get("requested_formats"):
            url = info["requested_formats"][0].get("url")
        if not url:
            continue
        hdrs = dict(info.get("http_headers") or {})
        if _url_ok(url, hdrs):
            break
        url = None
    if not url:
        raise RuntimeError("no playable stream" + (" (%s)" % str(last_err)[-120:] if last_err else " — 403"))
    res = {"id": vid, "url": url, "title": info.get("title"), "duration": info.get("duration"),
           "thumb": info.get("thumbnail"), "ext": info.get("ext"), "height": info.get("height"),
           "itag": str(info.get("format_id") or ""),
           "acodec": info.get("acodec"), "vcodec": info.get("vcodec"), "channel": info.get("uploader"),
           "mode": mode, "headers": {k: v for k, v in hdrs.items() if k.lower() in ("user-agent", "referer", "origin", "cookie")},
           "expires": now + 5 * 3600}
    with _yt_lock:
        _yt_cache[key] = (now + 40 * 60, res)   # 40분 (유튜브 URL은 몇 시간 유효하지만 IP/클라이언트에 따라 일찍 죽기도 함)
    return res


# ─────────────────────── 오류 기록 · 자체 점검 (감시) ───────────────────────
# 앱에서 난 오류를 파일에 쌓아 두고, 서버가 스스로 주기적으로 상태를 확인한다.
# 보고를 보낼 때 개인정보가 딸려 나가면 안 되므로 여기서 한 번 걸러 둔다.
ERRORS = DATA / "errors.jsonl"
HEALTHLOG = DATA / "health.jsonl"
_err_lock = threading.Lock()
_err_seen = {}          # 서명 -> 마지막 시각 (같은 오류 도배 방지)
_err_writes = 0         # 몇 번 썼는지 — 가끔씩만 파일을 정리하려고
ERR_MAX = 400           # 파일에 남기는 최대 줄 수
_health_last = {"t": 0, "problems": [], "checks": []}


def _scrub(text):
    """보고에 딸려 나가면 안 되는 것을 지운다 — 토큰·키·계정·경로.

    지우는 쪽이 과해도 괜찮다. 오류를 알아보는 데 필요한 건 대개 메시지와 위치다.
    """
    s = str(text or "")
    if not s:
        return s
    try:
        cfg = load_cfg()
    except Exception:
        cfg = {}
    # 1) 설정에 든 비밀값은 통째로 치환 (짧은 값은 오탐이 나므로 8자 이상만)
    for k in ("token", "ytClientSecret", "ytRefresh", "geminiKey", "ytClientId"):
        v = str(cfg.get(k) or "")
        if len(v) >= 8:
            s = s.replace(v, "<%s>" % k)
    # 2) 홈 경로·윈도우 사용자명
    try:
        home = str(Path.home())
        if home:
            s = s.replace(home, "<home>")
            user = Path(home).name
            if len(user) >= 3:
                s = re.sub(r"(?i)\b%s\b" % re.escape(user), "<user>", s)
    except Exception:
        pass
    s = s.replace(str(HOME), "<app>")
    # 3) 흔한 비밀 모양 — Bearer, 이메일, 긴 base64/헥스 덩어리
    s = re.sub(r"(?i)bearer\s+[\w.\-]+", "Bearer <token>", s)
    # 설정에 든 값과 대조하는 것만으로는 부족하다 — 예전 토큰이나 남의 토큰은 안 걸린다.
    # 알려진 모양은 값을 몰라도 지운다.
    s = re.sub(r"\bpst-[A-Za-z0-9_.\-]{8,}", "<token>", s)                 # NAI Persistent API Token
    s = re.sub(r"\bAIza[A-Za-z0-9_\-]{20,}", "<key>", s)                   # Google/Gemini API 키
    s = re.sub(r"\bGOCSPX-[A-Za-z0-9_\-]{8,}", "<secret>", s)              # Google OAuth 클라이언트 시크릿
    s = re.sub(r"\b\d+-[a-z0-9]{20,}\.apps\.googleusercontent\.com", "<clientid>", s)
    s = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "<email>", s)
    s = re.sub(r"\b(pers|sk|ghp|gho|github_pat)_[A-Za-z0-9_]{10,}", "<key>", s)
    s = re.sub(r"[A-Za-z0-9+/=_-]{60,}", "<long>", s)      # base64 이미지·토큰 덩어리
    return s[:4000]


def err_add(rec):
    """오류 한 건 기록. 같은 오류가 쏟아지면 개수만 올린다."""
    global _err_writes
    now = time.time()
    rec = dict(rec or {})
    for k in ("msg", "stack", "where", "ua"):
        if k in rec:
            rec[k] = _scrub(rec[k])
    sig = (rec.get("kind") or "") + "|" + (rec.get("msg") or "")[:160] + "|" + (rec.get("where") or "")[:80]
    rec["t"] = int(now * 1000)
    rec["ver"] = rec.get("ver") or RELEASE
    with _err_lock:
        last = _err_seen.get(sig)
        if last and now - last < 60:     # 1분 안에 같은 오류 → 파일에 또 쓰지 않는다
            _err_seen[sig] = now
            return {"ok": True, "deduped": True}
        _err_seen[sig] = now
        if len(_err_seen) > 500:
            for k2 in sorted(_err_seen, key=lambda k2: _err_seen[k2])[:250]:
                _err_seen.pop(k2, None)
        try:
            DATA.mkdir(exist_ok=True)
            with io.open(ERRORS, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            _err_writes += 1
            _err_trim(force=(_err_writes % 100 == 0))
        except Exception as e:
            return {"ok": False, "message": str(e)[:200]}
    return {"ok": True}


def _err_trim(force=False):
    """줄 수가 넘치면 앞쪽을 버린다 (호출자가 잠금을 쥔 상태로 부른다).

    쓸 때마다 파일을 통째로 읽으면 낭비라, 크기가 커졌거나 100번에 한 번만 본다.
    (크기 기준만 두면 짧은 줄이 수천 개 쌓여도 안 잘렸다)"""
    try:
        if not ERRORS.exists():
            return
        if not force and ERRORS.stat().st_size < 200_000:
            return
        lines = io.open(ERRORS, encoding="utf-8", errors="replace").read().splitlines()
        if len(lines) <= ERR_MAX:
            return
        io.open(ERRORS, "w", encoding="utf-8").write("\n".join(lines[-ERR_MAX:]) + "\n")
    except Exception:
        pass


def err_list(limit=200):
    out = []
    try:
        lines = io.open(ERRORS, encoding="utf-8", errors="replace").read().splitlines()
    except Exception:
        return out
    for ln in lines[-max(1, min(limit, ERR_MAX)):]:
        try:
            out.append(json.loads(ln))
        except Exception:
            continue
    return out


def err_clear():
    with _err_lock:
        _err_seen.clear()
        try:
            if ERRORS.exists():
                ERRORS.unlink()
        except Exception as e:
            return {"ok": False, "message": str(e)[:200]}
    return {"ok": True}


def _chk(name, ok, detail="", level="err"):
    return {"name": name, "ok": bool(ok), "detail": str(detail)[:300], "level": level}


def self_check(deep=False):
    """서버가 스스로 도는 점검. 문제가 있으면 problems 에 담아 돌려준다."""
    checks = []
    # 1) 데이터 폴더에 실제로 쓸 수 있는가 (권한·잠금·디스크)
    try:
        DATA.mkdir(exist_ok=True)
        probe = DATA / ".writecheck"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        checks.append(_chk("데이터 폴더 쓰기", True))
    except Exception as e:
        checks.append(_chk("데이터 폴더 쓰기", False, "%s — 설정·이미지가 저장되지 않습니다" % str(e)[:160]))
    # 2) 설정 파일이 온전한가
    for label, p in (("설정(state.json)", DATA / "state.json"), ("토큰(config.json)", CONFIG)):
        if not p.exists():
            checks.append(_chk(label, True, "아직 없음(정상)", "info"))
            continue
        try:
            o = json.loads(io.open(p, encoding="utf-8").read() or "{}")
            n = sum(len(o.get(k) or []) for k in ("chunks", "styles", "characters", "scenes")) if isinstance(o, dict) else 0
            checks.append(_chk(label, True, ("항목 %d개" % n) if n else "", "info"))
        except Exception as e:
            checks.append(_chk(label, False, "읽을 수 없습니다 — %s (백업에서 되돌리세요)" % str(e)[:120]))
    # 3) 백업이 최근 것인가
    try:
        bdir = DATA / "backups"
        bks = sorted(bdir.glob("state-*.json"), key=lambda p: p.stat().st_mtime) if bdir.exists() else []
        if not bks:
            checks.append(_chk("설정 백업", True, "아직 없음", "info"))
        else:
            age_h = (time.time() - bks[-1].stat().st_mtime) / 3600
            checks.append(_chk("설정 백업", True, "%d개 · 최근 %.0f시간 전" % (len(bks), age_h), "info"))
    except Exception as e:
        checks.append(_chk("설정 백업", False, str(e)[:120], "warn"))
    # 4) 디스크 여유
    try:
        import shutil as _sh
        free = _sh.disk_usage(str(DATA)).free
        checks.append(_chk("디스크 여유", free > 300 * 1024 * 1024,
                           "%.1fGB" % (free / 1024 ** 3),
                           "err" if free < 300 * 1024 * 1024 else "info"))
    except Exception:
        pass
    # 5) 태그 DB / 재생 엔진
    # 태그 DB 는 처음 켤 때 받아오므로 준비 중인 건 정상이다. 실패했을 때만 문제로 본다.
    checks.append(_chk("태그 DB", _tag_status.get("state") != "error",
                       _tag_status.get("msg") or _tag_status.get("state", ""),
                       "warn"))
    checks.append(_chk("유튜브 재생 엔진", bool(yt_engine()), "" if yt_engine() else "미설치 — 직접 재생이 안 됩니다", "warn"))
    # 6) 최근 오류
    try:
        now = time.time() * 1000
        es = err_list(ERR_MAX)
        h1 = len([e for e in es if now - (e.get("t") or 0) < 3600_000])
        d1 = len([e for e in es if now - (e.get("t") or 0) < 86400_000])
        checks.append(_chk("최근 오류", h1 == 0, "1시간 %d건 · 24시간 %d건" % (h1, d1), "warn" if h1 else "info"))
    except Exception:
        pass
    # 7) 바깥 연결 (깊은 점검일 때만 — 평소엔 네트워크를 건드리지 않는다)
    if deep:
        for label, host in (("NAI 이미지 서버", "image.novelai.net"), ("깃헙", "api.github.com")):
            try:
                t0 = time.time()
                with socket.create_connection((host, 443), timeout=6):
                    pass
                checks.append(_chk(label, True, "%dms" % int((time.time() - t0) * 1000), "info"))
            except Exception as e:
                checks.append(_chk(label, False, "닿지 않습니다 — %s" % str(e)[:100], "warn"))
    # problems 는 화면에 띄울 것 = 실제로 손을 봐야 하는 것만.
    # 참고(warn/info)까지 올리면 늘 빨간 표시가 떠 있어 아무도 안 보게 된다.
    problems = [c for c in checks if not c["ok"] and c["level"] == "err"]
    notes = [c for c in checks if not c["ok"] and c["level"] != "err"]
    snap = {"t": int(time.time() * 1000), "checks": checks, "problems": problems,
            "notes": notes, "release": RELEASE}
    return snap


def _health_write(snap, changed):
    """문제가 있거나 상태가 바뀐 순간만 남긴다 — 매번 쓰면 로그가 의미를 잃는다."""
    if not snap["problems"] and not snap.get("notes") and not changed:
        return
    try:
        DATA.mkdir(exist_ok=True)
        with io.open(HEALTHLOG, "a", encoding="utf-8") as f:
            f.write(json.dumps({"t": snap["t"],
                                "problems": [(p["name"], p["detail"]) for p in snap["problems"]],
                                "notes": [(p["name"], p["detail"]) for p in snap.get("notes") or []],
                                "release": RELEASE}, ensure_ascii=False) + "\n")
        if HEALTHLOG.stat().st_size > 300_000:
            lines = io.open(HEALTHLOG, encoding="utf-8", errors="replace").read().splitlines()
            io.open(HEALTHLOG, "w", encoding="utf-8").write("\n".join(lines[-300:]) + "\n")
    except Exception:
        pass


def _watchdog():
    """서버가 떠 있는 동안 계속 도는 자체 점검. 앱을 켜 두면 24시간 돈다."""
    global _health_last
    n = 0
    while True:
        try:
            snap = self_check(deep=(n % 6 == 0))    # 1시간에 한 번만 바깥 연결까지
            before = {p["name"] for p in _health_last.get("problems") or []}
            after = {p["name"] for p in snap["problems"]}
            _health_write(snap, before != after)
            _health_last = snap
        except Exception:
            pass
        n += 1
        time.sleep(600)     # 10분


# ─────────────────────────── tag DB ───────────────────────────
def build_tag_db():
    """CSV (name,category,post_count,description) -> compact gzip JSON.
    Each row: [tag, category, count, "대분류>소분류", "키워드1, 키워드2", "설명"]"""
    rows = []
    with open(TAG_CSV, encoding="utf-8", newline="") as f:
        rd = csv.reader(f)
        header = next(rd, None)
        for r in rd:
            if len(r) < 3:
                continue
            tag = r[0].strip()
            try:
                cat = int(r[1])
            except ValueError:
                cat = 0
            try:
                cnt = int(r[2])
            except ValueError:
                cnt = 0
            desc = r[3] if len(r) > 3 else ""
            path, kw, text = "", "", desc
            m = re.match(r"\s*\[([^\]]*)\]\s*(.*)$", desc, re.S)
            if m:
                path = m.group(1).replace(" > ", ">").strip()
                text = m.group(2)
            m2 = re.search(r"키워드\s*[:：]\s*(.*)$", text, re.S)
            if m2:
                kw = m2.group(1).strip().rstrip(".。")
                text = text[:m2.start()].strip()
            rows.append([tag, cat, cnt, path, kw, text.strip()])
    rows.sort(key=lambda r: -r[2])
    DATA.mkdir(exist_ok=True)
    # 목적지에 직접 쓰면, 변환 도중 창을 닫았을 때 잘린 gz 가 남는다.
    # 다음 실행은 "파일이 있으니 ready" 로 보고 영원히 다시 만들지 않았다.
    tmp_gz = TAG_JSON_GZ.with_name(TAG_JSON_GZ.name + ".tmp")
    with gzip.open(tmp_gz, "wt", encoding="utf-8", compresslevel=6) as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(str(tmp_gz), str(TAG_JSON_GZ))
    return len(rows)


def seed_from_bundle():
    """배포본(exe)에 함께 넣어둔 사전을 첫 실행 때 데이터 폴더로 복사 —
       16MB CSV 다운로드·변환을 건너뛰게 한다."""
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        src = ROOT / "assets" / "tags_kr.seed.json.gz"
        if src.exists() and not TAG_JSON_GZ.exists():
            TAG_JSON_GZ.write_bytes(src.read_bytes())
            _tag_status.update(state="ready", msg="")
            print("  태그 사전을 준비했습니다 (%.1fMB)" % (TAG_JSON_GZ.stat().st_size / 1e6))
    except Exception as e:
        print("  태그 사전 준비 실패:", e)


def ensure_tag_db_async():
    def work():
        with _tag_lock:
            if TAG_JSON_GZ.exists():
                _tag_status.update(state="ready", msg="")
                return
            try:
                if not TAG_CSV.exists():
                    _tag_status.update(state="downloading", msg="태그 DB 다운로드 중 (약 16MB)")
                    print("[tags] downloading Korean tag DB ...")
                    DATA.mkdir(exist_ok=True)
                    req = urllib.request.Request(TAG_CSV_URL, headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=120) as r, open(TAG_CSV, "wb") as out:
                        while True:
                            chunk = r.read(1 << 16)
                            if not chunk:
                                break
                            out.write(chunk)
                # 다운로드가 끊겨 잘린 CSV 로 DB 를 만들지 않도록 크기 확인 (원본 약 16MB)
                if TAG_CSV.stat().st_size < 8 * 1024 * 1024:
                    TAG_CSV.unlink(missing_ok=True)
                    raise RuntimeError("download incomplete — 다시 시도합니다")
                _tag_status.update(state="building", msg="태그 DB 변환 중")
                print("[tags] converting ...")
                n = build_tag_db()
                print("[tags] ready: %d tags" % n)
                try:
                    TAG_CSV.unlink()  # keep only the compact version
                except OSError:
                    pass
                _tag_status.update(state="ready", msg="")
            except Exception as e:
                print("[tags] FAILED:", e)
                _tag_status.update(state="error", msg=str(e))
    threading.Thread(target=work, daemon=True).start()


# ─────────────────────────── YouTube ───────────────────────────
def yt_search(q):
    url = ("https://www.youtube.com/results?search_query=" +
           urllib.parse.quote(q) + "&hl=ko&gl=KR")
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Cookie": "CONSENT=YES+1; SOCS=CAI",
    })
    html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        return []
    data = json.loads(m.group(1))
    out = []

    def txt(o):
        if not o:
            return ""
        if "simpleText" in o:
            return o["simpleText"]
        return "".join(r.get("text", "") for r in o.get("runs", []))

    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                v = o["videoRenderer"]
                try:
                    out.append({
                        "id": v["videoId"],
                        "title": txt(v.get("title")),
                        "channel": txt(v.get("ownerText")) or txt(v.get("longBylineText")),
                        "len": txt(v.get("lengthText")),
                        "views": txt(v.get("shortViewCountText")),
                        "thumb": "https://i.ytimg.com/vi/%s/mqdefault.jpg" % v["videoId"],
                    })
                except Exception:
                    pass
            elif "playlistRenderer" in o:
                v = o["playlistRenderer"]
                try:
                    out.append({
                        "list": v["playlistId"],
                        "title": txt(v.get("title")),
                        "channel": txt(v.get("shortBylineText")),
                        "len": (v.get("videoCount", "") + "개 영상") if v.get("videoCount") else "재생목록",
                        "views": "",
                        "thumb": v["thumbnails"][0]["thumbnails"][0]["url"] if v.get("thumbnails") else "",
                    })
                except Exception:
                    pass
            for val in o.values():
                walk(val)
        elif isinstance(o, list):
            for val in o:
                walk(val)
    walk(data)
    seen, uniq = set(), []
    for r in out:
        k = r.get("id") or r.get("list")
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    return uniq[:30]


# ─────────────────────────── HTTP ───────────────────────────
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        try:
            sys.stdout.write("[%s] %s\n" % (self.command, self.path.split("?")[0][:80]))
        except Exception:
            pass

    def _sensitive(self):
        """토큰·설정 원문처럼 file:// (Origin: null) 에도 넘기면 안 되는 응답인지"""
        p = self.path.split("?")[0]
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return p == "/config" and bool((q.get("full") or [""])[0])

    def _origin_ok(self):
        """보안: 로컬 앱(자기 자신) 또는 file:// 로 연 페이지만 허용 — 외부 사이트가 저장된 NAI 토큰을 쓰지 못하게

        Origin: null 은 file:// 로 연 페이지만 보내는 게 아니다. 아무 웹사이트나
        <iframe sandbox> 를 띄우면 같은 값이 된다. 그래서 null 은 "읽기" 까지만 믿는다.
        (쓰기까지 믿으면 남의 페이지가 설정을 부수거나, 저장된 NAI 토큰으로 생성을 돌리거나,
         업데이트 경로로 코드를 심을 수 있다. 실제로 그 길이 열려 있었다.)
        file:// 로 열어 쓰던 분은 start.bat 이 띄우는 http://127.0.0.1:… 주소로 열면 된다."""
        o = self.headers.get("Origin")
        if not o:
            return True
        if o == "null":
            meth = self.command
            if meth == "OPTIONS":     # 프리플라이트 — 실제로 하려는 메서드를 보고 판단
                meth = (self.headers.get("Access-Control-Request-Method") or "GET").upper()
            return meth in ("GET", "HEAD")
        try:
            u = urllib.parse.urlparse(o)
            return u.hostname in ("127.0.0.1", "localhost", "::1", "[::1]")
        except Exception:
            return False

    def _cors(self):
        # 허용되지 않은 출처에는 ACAO 헤더를 아예 보내지 않는다.
        # 예전처럼 "null" 을 돌려주면 아무 웹사이트나 sandbox iframe 으로 Origin: null 을 만들어
        # /config?full=1 응답(=NAI 토큰)을 읽어갈 수 있다.
        o = self.headers.get("Origin")
        if o and o != "null" and self._origin_ok():
            self.send_header("Access-Control-Allow-Origin", o)
        elif o == "null" and not self._sensitive() and self._origin_ok():
            # file:// 로 연 앱의 "읽기" 만 허용 (_origin_ok 가 쓰기를 걸러낸다)
            self.send_header("Access-Control-Allow-Origin", "null")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Range")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send(self, code, body, ctype="application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # 기본은 캐시 금지지만, 호출부가 Cache-Control 을 직접 주면 그것을 따른다.
        # (예전엔 무조건 no-store 를 먼저 보내서, 뒤에 붙는 max-age 가 헤더만 두 줄
        #  나가고 실제로는 무시됐다 → HLS 조각이 절대 캐시되지 않아 되감을 때마다 재요청)
        if not any(k.lower() == "cache-control" for k in (extra or {})):
            self.send_header("Cache-Control", "no-store")
        self._cors()
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                   "application/json; charset=utf-8")

    # ---- NovelAI proxy ----
    def _proxy(self):
        for prefix, base in UPSTREAMS.items():
            if self.path.startswith(prefix):
                url = base + self.path[len(prefix):]
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else None
                req = urllib.request.Request(url, data=body, method=self.command)
                for h in FORWARD_HEADERS:
                    v = self.headers.get(h)
                    if v and not (h == "Authorization" and v.strip() in ("Bearer", "Bearer null", "Bearer undefined")):
                        req.add_header(h, v)
                is_nai = prefix in NAI_PREFIXES
                if is_nai and not req.has_header("Authorization"):
                    tok = load_cfg().get("token", "")
                    if tok:
                        req.add_header("Authorization", "Bearer " + tok)
                req.add_header("User-Agent", UA)
                if is_nai:
                    req.add_header("Origin", "https://novelai.net")
                    req.add_header("Referer", "https://novelai.net/")
                req.add_header("Accept-Encoding", "identity")
                # 생성 스트리밍(generate-image-stream)은 버퍼링하지 않고 그대로 흘려보냄 (실시간 미리보기)
                if "generate-image-stream" in self.path:
                    started = False   # 본문(msgpack 프레임)을 흘리기 시작했는지
                    try:
                        with urllib.request.urlopen(req, timeout=600) as r:
                            self.send_response(r.status)
                            self.send_header("Content-Type", r.headers.get("Content-Type", "application/x-msgpack"))
                            self.send_header("Cache-Control", "no-store")
                            self.send_header("X-Accel-Buffering", "no")
                            self._cors()
                            self.send_header("Connection", "close")
                            self.end_headers()
                            self.close_connection = True
                            started = True
                            while True:
                                chunk = r.read(16384)
                                if not chunk:
                                    break
                                try:
                                    self.wfile.write(chunk)
                                    self.wfile.flush()
                                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                                    break
                    except urllib.error.HTTPError as e:
                        # urlopen 단계라 항상 헤더 전송 전
                        data = e.read() or json.dumps({"message": "HTTP %d" % e.code}).encode()
                        self._send(e.code, data, e.headers.get("Content-Type", "application/json"))
                    except Exception as e:
                        # 본문을 이미 보내기 시작했으면 절대 헤더를 더 쓰면 안 된다.
                        # (쓰면 "HTTP/1.1 502..." ASCII 가 프레임 한가운데 끼어들어 클라이언트가
                        #  그 4바이트를 길이로 읽고 터지면서, 이미 받은 최종 이미지까지 버려진다)
                        if started:
                            self.close_connection = True
                        else:
                            self._json(502, {"message": "stream proxy error: %s" % e})
                    return True
                try:
                    with urllib.request.urlopen(req, timeout=600) as r:
                        data = r.read()
                        ctype = r.headers.get("Content-Type", "application/octet-stream")
                        self._send(r.status, data, ctype)
                except urllib.error.HTTPError as e:
                    data = e.read()
                    ctype = e.headers.get("Content-Type", "application/json")
                    if not data:
                        data = json.dumps({"message": "HTTP %d" % e.code}).encode()
                    self._send(e.code, data, ctype)
                except Exception as e:
                    self._json(502, {"message": "proxy error: %s" % e})
                return True
        return False

    # ---- local endpoints ----
    def _local(self):
        path, _, query = self.path.partition("?")
        qs = urllib.parse.parse_qs(query)
        if path == "/health":
            cfg = load_cfg()
            tok = cfg.get("token", "")
            self._json(200, {"ok": True, "version": VERSION, "tags": _tag_status,
                             "upd": update_check_cached(),
                             "hasToken": bool(tok), "tokenHint": ("…" + tok[-4:]) if tok else "",
                             "ytClientId": cfg.get("ytClientId", ""), "ytHasSecret": bool(cfg.get("ytClientSecret")),
                             "ytLinked": bool(cfg.get("ytRefresh")), "ytEngine": bool(yt_engine()),
                             "hasGemini": bool(cfg.get("geminiKey")),
                             "release": RELEASE, "frozen": FROZEN,
                             # 자체 점검에서 걸린 것 — 앱이 바로 띄운다 (점검 자체는 감시 스레드가 10분마다 돈다)
                             "problems": [{"name": p["name"], "detail": p["detail"]} for p in (_health_last.get("problems") or [])],
                             "hasGhToken": bool(cfg.get("ghToken")),
                             "updateRepo": cfg.get("updateRepo") or UPDATE_REPO or ""})
            return True
        if path == "/errors":     # 오류 기록 — 앱이 오류를 만나면 여기로 보낸다
            if self.command == "POST":
                if "application/json" not in (self.headers.get("Content-Type") or "").lower():
                    self._json(415, {"message": "content-type must be application/json"})
                    return True
                try:
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
                except Exception:
                    body = {}
                if (qs.get("clear") or [""])[0]:
                    self._json(200, err_clear())
                    return True
                self._json(200, err_add(body))
                return True
            items = err_list(int((qs.get("limit") or ["200"])[0] or 200))
            self._json(200, {"items": items, "path": str(ERRORS), "release": RELEASE})
            return True
        if path == "/selfcheck":  # 자체 점검 — 지금 바로 한 번 돌리거나(POST) 최근 결과를 본다(GET)
            if self.command == "POST":
                snap = self_check(deep=True)
                self._json(200, snap)
                return True
            snap = _health_last if _health_last.get("t") else self_check()
            self._json(200, snap)
            return True
        if path == "/report":     # 깃헙 이슈로 보내기 — 토큰이 설정에 있을 때만 (배포본에는 없다)
            if self.command != "POST":
                self._json(405, {"message": "POST only"})
                return True
            if "application/json" not in (self.headers.get("Content-Type") or "").lower():
                self._json(415, {"message": "content-type must be application/json"})
                return True
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            except Exception:
                body = {}
            cfg = load_cfg()
            ghtok = (cfg.get("ghToken") or "").strip()
            repo = _upd_repo()
            if not ghtok:
                self._json(400, {"message": "깃헙 토큰이 없습니다 — ⚙설정에 넣으면 자동으로 보냅니다"})
                return True
            if not re.fullmatch(r"[\w.\-]+/[\w.\-]+", repo or ""):
                self._json(400, {"message": "보고할 저장소를 알 수 없습니다 (업데이트 저장소를 먼저 지정하세요)"})
                return True
            title = _scrub(body.get("title") or "오류 보고")[:200]
            text = _scrub(body.get("body") or "")[:60000]
            try:
                req = urllib.request.Request(
                    "https://api.github.com/repos/%s/issues" % repo,
                    data=json.dumps({"title": title, "body": text, "labels": ["bug", "auto-report"]}).encode(),
                    headers={"Authorization": "Bearer " + ghtok, "Accept": "application/vnd.github+json",
                             "User-Agent": "NAI-Studio", "Content-Type": "application/json",
                             "X-GitHub-Api-Version": "2022-11-28"}, method="POST")
                with urllib.request.urlopen(req, timeout=30) as r:
                    j = json.loads(r.read() or b"{}")
                self._json(200, {"ok": True, "url": j.get("html_url"), "number": j.get("number")})
            except urllib.error.HTTPError as e:
                self._json(e.code, {"message": "깃헙이 거절했습니다 (HTTP %d) — 토큰 권한을 확인하세요" % e.code})
            except Exception as e:
                self._json(502, {"message": str(e)[:200]})
            return True
        if path == "/config":
            if self.command == "POST":
                # 보안: 단순요청(CSRF) 차단 — 브라우저가 프리플라이트를 강제하는 헤더가 있어야 함
                if "application/json" not in (self.headers.get("Content-Type") or "").lower():
                    self._json(415, {"message": "content-type must be application/json"})
                    return True
                length = int(self.headers.get("Content-Length") or 0)
                try:
                    body = json.loads(self.rfile.read(length) or b"{}")
                except Exception:
                    body = {}
                try:
                    cfg = load_cfg(strict=True)     # 못 읽으면 덮어쓰지 않는다 (토큰이 날아간다)
                except Exception as e:
                    self._json(500, {"message": "설정을 읽지 못해 저장을 멈췄습니다 — %s" % str(e)[:140]})
                    return True
                if "token" in body:
                    tok = (body.get("token") or "").strip()
                    if tok:
                        cfg["token"] = tok
                    else:
                        cfg.pop("token", None)
                # ghToken: 오류 보고를 자동으로 올릴 때만 쓴다. 배포하는 exe 에는 절대 안 들어가고,
                # 넣은 사람의 PC(data/config.json)에만 남는다.
                for k in ("ytClientId", "ytClientSecret", "ytRefresh", "geminiKey", "updateRepo", "ghToken"):  # YouTube 계정 연결 (Google OAuth) · Gemini API 키
                    if k in body:
                        v = (body.get(k) or "").strip()
                        if v:
                            cfg[k] = v
                        else:
                            cfg.pop(k, None)
                try:
                    save_cfg(cfg)
                except Exception as e:
                    self._json(500, {"message": "config save failed: %s" % e})
                    return True
            cfg = load_cfg()
            tok = cfg.get("token", "")
            if (qs.get("full") or [""])[0]:  # 백업용: 실제 값 반환 (로컬 전용)
                self._json(200, {k: cfg.get(k, "") for k in ("token", "ytClientId", "ytClientSecret", "ytRefresh", "geminiKey", "updateRepo", "ghToken")})
                return True
            self._json(200, {"hasToken": bool(tok), "tokenHint": ("…" + tok[-4:]) if tok else "",
                             "path": str(CONFIG), "ytClientId": cfg.get("ytClientId", ""),
                             "ytHasSecret": bool(cfg.get("ytClientSecret")), "ytLinked": bool(cfg.get("ytRefresh")),
                             "hasGhToken": bool(cfg.get("ghToken"))})
            return True
        if path == "/yt/oauth" and self.command == "POST":
            # PKCE 코드 교환 / 리프레시 — refresh_token 은 서버 파일에만 보관
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                body = {}
            cfg = load_cfg()
            cid = cfg.get("ytClientId", "")
            if not cid:
                self._json(400, {"message": "Client ID 가 설정되지 않았습니다"})
                return True
            if body.get("code"):
                form = {"client_id": cid, "code": body["code"], "code_verifier": body.get("verifier", ""),
                        "grant_type": "authorization_code", "redirect_uri": body.get("redirect", "")}
            elif cfg.get("ytRefresh"):
                form = {"client_id": cid, "refresh_token": cfg["ytRefresh"], "grant_type": "refresh_token"}
            else:
                self._json(401, {"message": "not linked"})
                return True
            if cfg.get("ytClientSecret"):
                form["client_secret"] = cfg["ytClientSecret"]
            data = urllib.parse.urlencode(form).encode()
            req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST",
                                         headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    j = json.loads(r.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                body = e.read() or b'{"message":"oauth error"}'
                # refresh token 이 폐기됐는데도 계속 들고 있으면 앱은 영원히 "연결됨" 으로
                # 보이고 매번 조용히 실패한다. 되살릴 수 없는 응답이면 연결을 풀어준다.
                if e.code in (400, 401) and form.get("grant_type") == "refresh_token":
                    try:
                        cfg.pop("ytRefresh", None)
                        save_cfg(cfg)
                    except Exception:
                        pass
                    self._json(401, {"message": "YouTube 연결이 만료됐습니다 — 다시 연결해 주세요",
                                     "relink": True})
                    return True
                self._send(e.code, body, "application/json")
                return True
            except Exception as e:
                self._json(502, {"message": "oauth error: %s" % e})
                return True
            if j.get("refresh_token"):
                cfg["ytRefresh"] = j["refresh_token"]
                save_cfg(cfg)
            self._json(200, {"access_token": j.get("access_token"), "expires_in": j.get("expires_in"), "linked": bool(cfg.get("ytRefresh"))})
            return True
        if path == "/state":  # 앱 설정(청크·스타일·씬 등) 서버 저장 — 브라우저/주소가 바뀌어도 유지
            sp = DATA / "state.json"
            if self.command == "POST":
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else b"{}"
                try:
                    incoming = json.loads(body)  # validate
                    DATA.mkdir(exist_ok=True)
                    force = bool((qs.get("force") or [""])[0])
                    def ccount(o):
                        return sum(len(o.get(k) or []) for k in ("chunks", "styles", "characters", "scenes")) if isinstance(o, dict) else 0
                    # 읽기 → 병합 → 쓰기를 통째로 잠근다.
                    # 쓰기만 잠그면, 탭 두 개가 거의 동시에 저장할 때 둘 다 "옛 상태" 를
                    # 읽어 병합하므로 나중에 쓴 쪽이 앞 쪽의 항목을 지워 버린다.
                    with _state_lock:
                        cur = {}
                        if sp.exists():
                            try:
                                cur = json.loads(sp.read_text(encoding="utf-8"))
                            except Exception:
                                cur = {}
                        # 보호: 들어온 설정의 내용(청크·스타일·캐릭터·씬)이 서버 것의 절반 미만이면 덮어쓰지 않음 (빈 브라우저가 덮어쓰는 사고 방지)
                        # 사용자가 실제로 지운 것(톰스톤)은 줄어드는 게 정상이다.
                        # 그것까지 막으면 정당한 대량 삭제가 영영 저장되지 않고 409 만 반복된다.
                        def tombed_count(o, base):
                            d = (o or {}).get("deleted") or {}
                            if not isinstance(d, dict):
                                return 0
                            n = 0
                            for key, kind in (("chunks", "chunk"), ("styles", "style"),
                                              ("characters", "char"), ("scenes", "scene")):
                                for it in (base.get(key) or []):
                                    k = it.get("name") if kind in ("chunk", "char") else it.get("id")
                                    if k and (kind + "|" + str(k).lower()) in d:
                                        n += 1
                            return n
                        gone = ccount(cur) - ccount(incoming)
                        explained = tombed_count(incoming, cur)
                        if (not force and ccount(cur) >= 3 and ccount(incoming) < ccount(cur) * 0.5
                                and gone > explained):
                            self._json(409, {"message": "protected", "serverCount": ccount(cur),
                                             "incomingCount": ccount(incoming), "explained": explained})
                            return True

                        # 프롬프트도 지켜야 한다. 위 검사는 청크·스타일·캐릭터·씬 개수만 보므로,
                        # 빈 프롬프트가 통째로 덮어써도 통과했다. 서버가 아직 안 떴을 때 열린
                        # 빈 화면이 그대로 저장되어 프롬프트가 사라지는 사고가 실제로 났다.
                        def _has_text(o):
                            if not isinstance(o, dict):
                                return False
                            if (o.get("prompt") or "").strip():
                                return True
                            st = o.get("secText")
                            return isinstance(st, dict) and any((v or "").strip() for v in st.values() if isinstance(v, str))
                        if not force and _has_text(cur) and not _has_text(incoming):
                            self._json(409, {"message": "protected-prompt",
                                             "serverCount": ccount(cur), "incomingCount": ccount(incoming)})
                            return True
                        # 목록은 서버에서 합친다 — 탭을 두 개 열어두면 나중에 저장한 탭이 다른 탭에서
                        # 만든 항목을 통째로 지우던 문제(클라이언트끼리는 서로의 변경을 모른다)
                        if not force and isinstance(cur, dict) and isinstance(incoming, dict):
                            incoming = _merge_state(cur, incoming)
                            body = json.dumps(incoming, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                        # 백업: 이전 저장본 + 타임스탬프 백업(최근 30개 보관)
                        #
                        # 예전엔 "내용 개수가 바뀔 때"만 백업해서, 설정(해상도·CFG·시드·샘플러…)만
                        # 바꾼 구간은 기록이 하나도 안 남았다. 실제로 설정이 통째로 덮어써진 사고가
                        # 났을 때 되돌릴 근거가 없었다. → 설정이 바뀌어도 남기되, 슬라이더를 만질
                        # 때마다 쌓이지 않도록 30분에 한 번으로 제한한다.
                        prev = DATA / "state.prev.json"
                        # 매번 바뀌는 값(프롬프트·시드·현재 씬·유튜브 검색어…)은 '설정'으로 치지 않는다.
                        # 이걸 세면 프롬프트만 고쳐도 30분마다 백업이 쌓여, 30개 상한 때문에
                        # 정작 사고 직전의 오래된 스냅샷이 하루도 못 가 밀려난다.
                        _VOLATILE = {"savedAt", "prompt", "uc", "seed", "curScene", "mode",
                                     "ytLastQuery", "ytOpen", "ytPos", "updSeen"}
                        def _scalars(o):
                            if not isinstance(o, dict):
                                return {}
                            return {k: v for k, v in o.items()
                                    if not isinstance(v, (list, dict)) and k not in _VOLATILE}
                        bdir = DATA / "backups"
                        last_bk = 0.0
                        if bdir.exists():
                            try:
                                last_bk = max((f.stat().st_mtime for f in bdir.glob("state-*.json")), default=0.0)
                            except OSError:
                                last_bk = 0.0
                        setting_changed = _scalars(cur) != _scalars(incoming)
                        # 프롬프트·네거티브·캐릭터 칸은 위 계산에서 빠져 있다(매번 바뀌므로).
                        # 그런데 정작 사고는 "그것들이 통째로 비는" 형태로 난다.
                        # 있던 것이 사라지는 순간만큼은 남겨야 되돌릴 근거가 생긴다.
                        def _texts(o):
                            if not isinstance(o, dict):
                                return ""
                            st = o.get("secText") if isinstance(o.get("secText"), dict) else {}
                            ch = o.get("chars") if isinstance(o.get("chars"), list) else []
                            parts = [o.get("prompt") or "", o.get("uc") or ""]
                            parts += [str(v or "") for v in st.values()]
                            parts += [str((c or {}).get("prompt") or "") for c in ch]
                            return "".join(parts).strip()
                        if _texts(cur) and not _texts(incoming):
                            setting_changed = True
                            last_bk = 0.0     # 30분 제한을 건너뛴다
                        try:
                            if sp.exists() and (not prev.exists() or time.time() - prev.stat().st_mtime > 600):
                                prev.write_bytes(sp.read_bytes())
                            if sp.exists() and (ccount(cur) != ccount(incoming)
                                                or (setting_changed and time.time() - last_bk > 1800)):
                                bdir.mkdir(exist_ok=True)
                                # 목적지에 바로 쓰면 디스크가 꽉 찼을 때 0바이트 파일이 남는다
                                _bk = bdir / ("state-%s.json" % time.strftime("%Y%m%d-%H%M%S"))
                                _bt = bdir / ("state-%s.tmp" % time.strftime("%Y%m%d-%H%M%S"))
                                _bt.write_bytes(sp.read_bytes())
                                os.replace(str(_bt), str(_bk))
                                olds = sorted(bdir.glob("state-*.json"))
                                for f in olds[:-30]:
                                    try:
                                        f.unlink()
                                    except OSError:
                                        pass
                        except Exception:
                            pass
                        tmp = DATA / ("state.%d.tmp" % threading.get_ident())
                        tmp.write_bytes(body)
                        # 윈도우에서는 다른 요청이 state.json 을 읽는 중이면 교체가
                        # PermissionError 로 튄다. 그대로 400 으로 버리면 그 저장이 사라지고
                        # state.*.tmp 만 쌓인다 → 잠깐 기다렸다 다시 시도한다.
                        for attempt in range(6):
                            try:
                                tmp.replace(sp)
                                break
                            except PermissionError:
                                if attempt == 5:
                                    raise
                                time.sleep(0.05 * (attempt + 1))
                    self._json(200, {"ok": True})
                except Exception as e:
                    self._json(400, {"message": "bad state: %s" % e})
                return True
            if (qs.get("list") or [""])[0]:  # 백업 목록
                bdir = DATA / "backups"
                out = []
                for f in sorted(bdir.glob("state-*.json"), reverse=True) if bdir.exists() else []:
                    try:
                        j = json.loads(f.read_text(encoding="utf-8"))
                        out.append({"file": f.name, "savedAt": j.get("savedAt"), "chunks": len(j.get("chunks") or []), "styles": len(j.get("styles") or []),
                                    "characters": len(j.get("characters") or []), "scenes": len(j.get("scenes") or [])})
                    except Exception:
                        pass
                self._json(200, {"backups": out})
                return True
            bf = (qs.get("file") or [""])[0]
            if bf and re.fullmatch(r"state-[\d-]+\.json", bf):
                sp = DATA / "backups" / bf
            elif (qs.get("prev") or [""])[0]:
                sp = DATA / "state.prev.json"
            if sp.exists():
                self._send(200, sp.read_bytes(), "application/json; charset=utf-8")
            else:
                self._json(200, {})
            return True
        if path == "/selftest" and self.command == "POST":  # 브라우저 셀프테스트 결과 수신 (진단용)
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            DATA.mkdir(exist_ok=True)
            (DATA / "selftest.json").write_bytes(body)
            print("[selftest] result saved (%d bytes)" % len(body))
            self._json(200, {"ok": True})
            return True
        if path == "/nai/status":  # NAI 서버 상태: 공식 상태페이지(status.novelai.net) + 공지 텍스트 + api/image 응답 시간
            out = {"notice": "", "api_ms": None, "img_ms": None, "api_ok": False, "img_ok": False, "official": None}
            def ping(key, url):
                t0 = time.time()
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
                    with urllib.request.urlopen(req, timeout=8) as r:
                        out[key + "_ok"] = r.status < 500
                except urllib.error.HTTPError as e:
                    out[key + "_ok"] = e.code < 500
                except Exception:
                    out[key + "_ok"] = False
                out[key + "_ms"] = int((time.time() - t0) * 1000)
            def notice():
                try:
                    req = urllib.request.Request("https://static.novelai.net/status", headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=8) as r:
                        out["notice"] = r.read().decode("utf-8", "replace").strip()[:500]
                except Exception:
                    pass
            def official():  # status.io 공개 API (NovelAI 공식 상태 페이지와 동일한 데이터)
                try:
                    req = urllib.request.Request("https://api.status.io/1.0/status/654839612cedb404d4d5f578",
                                                 headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=10) as r:
                        j = json.loads(r.read().decode("utf-8", "replace")).get("result", {})
                    ov = j.get("status_overall", {}) or {}
                    svcs = [{"name": s.get("name"), "status": s.get("status"), "code": s.get("status_code")}
                            for s in (j.get("status") or [])]
                    inc = []
                    for i in (j.get("incidents") or []):
                        msgs = i.get("messages") or []
                        inc.append({"name": i.get("name"), "at": i.get("datetime"),
                                    "detail": (msgs[0].get("details") if msgs else "") or "",
                                    "status": (msgs[0].get("status") if msgs else "") or ""})
                    mt = j.get("maintenance") or {}
                    out["official"] = {"overall": ov.get("status"), "code": ov.get("status_code"),
                                       "updated": ov.get("updated"), "services": svcs, "incidents": inc,
                                       "maintenance_active": len(mt.get("active") or []),
                                       "maintenance_upcoming": len(mt.get("upcoming") or [])}
                except Exception as e:
                    out["official_error"] = str(e)[:120]
            ths = [threading.Thread(target=ping, args=("api", "https://api.novelai.net/"), daemon=True),
                   threading.Thread(target=ping, args=("img", "https://image.novelai.net/"), daemon=True),
                   threading.Thread(target=notice, daemon=True),
                   threading.Thread(target=official, daemon=True)]
            for t in ths: t.start()
            for t in ths: t.join(10)
            self._json(200, out)
            return True
        if path == "/yt/engine":  # 직접 재생 엔진 상태 / 설치·업데이트
            if self.command == "POST":
                try:
                    ok, log = yt_engine_install()
                except Exception as e:
                    ok, log = False, str(e)
                y = yt_engine()
                self._json(200 if ok else 500, {"installed": bool(y), "version": getattr(getattr(y, "version", None), "__version__", "") if y else "", "log": log})
                return True
            y = yt_engine()
            global _NODE
            if _NODE is None:
                _NODE = find_node() or False
            self._json(200, {"installed": bool(y), "version": getattr(getattr(y, "version", None), "__version__", "") if y else "",
                             "python": sys.executable, "node": _NODE or None})
            return True
        if path == "/yt/stream":  # 직접 재생 URL 추출
            vid = (qs.get("id") or [""])[0]
            mode = (qs.get("mode") or ["video"])[0]
            if mode not in ("video", "audio"):
                mode = "video"
            if not re.fullmatch(r"[\w-]{6,20}", vid):
                self._json(400, {"message": "bad id"})
                return True
            try:
                out = yt_stream(vid, mode)
                if mode == "video":
                    # 브라우저가 바로 트는 progressive 는 itag 18(360p) 뿐이다.
                    # 그보다 좋은 화질은 HLS 로만 오므로, 화질 목록을 함께 돌려주고
                    # 클라이언트가 hls.js 로 재생하게 한다.
                    try:
                        out["hls"] = _yt_hls_variants(vid)
                    except Exception:
                        out["hls"] = []
                self._json(200, out)
            except Exception as e:
                msg = str(e)
                code = 503 if "engine not installed" in msg else 502
                self._json(code, {"message": msg[-400:]})
            return True
        if path == "/yt/templist":  # 임시 재생목록 만들기 (임베드 제한 영상의 우회 시도용)
            vid = (qs.get("id") or [""])[0]
            if not re.fullmatch(r"[\w-]{6,20}", vid):
                self._json(400, {"message": "bad id"})
                return True

            class _NoRedir(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, headers, newurl):
                    return None
            try:
                op = urllib.request.build_opener(_NoRedir)
                req = urllib.request.Request("https://www.youtube.com/watch_videos?video_ids=" + vid, headers={"User-Agent": UA})
                lid = None
                try:
                    r = op.open(req, timeout=15)
                    m = re.search(r"list=([\w-]+)", r.geturl() or "")
                    lid = m.group(1) if m else None
                except urllib.error.HTTPError as e:
                    m = re.search(r"list=([\w-]+)", e.headers.get("Location", "") or "")
                    lid = m.group(1) if m else None
                self._json(200, {"list": lid})
            except Exception as e:
                self._json(502, {"message": str(e)[-200:]})
            return True
        if path == "/yt/related":  # 연관 곡 (유튜브 믹스 RD 재생목록 = 유튜브 알고리즘 추천)
            vid = (qs.get("id") or [""])[0]
            y = yt_engine()
            if not re.fullmatch(r"[\w-]{6,20}", vid) or not y:
                self._json(400 if y else 503, {"message": "bad id" if y else "engine not installed"})
                return True
            try:
                # noplaylist=False 필수 — 기본값(True)이면 watch?v=X&list=RDX 에서 믹스 대신
                # 단일 영상으로 리다이렉트돼 entries 가 비고 "이어듣기"가 통째로 죽는다.
                opts = dict(_ydl_opts(None, None), extract_flat="in_playlist", playlistend=40, noplaylist=False)
                opts.pop("format", None)
                with y.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info("https://www.youtube.com/watch?v=%s&list=RD%s" % (vid, vid), download=False)
                items = []
                for e in (info.get("entries") or []):
                    eid = e.get("id")
                    if not eid or eid == vid:
                        continue
                    items.append({"id": eid, "title": e.get("title") or eid, "channel": e.get("uploader") or e.get("channel") or "",
                                  "len": "", "thumb": "https://i.ytimg.com/vi/%s/mqdefault.jpg" % eid})
                self._json(200, {"title": info.get("title"), "items": items})
            except Exception as e:
                self._json(502, {"message": str(e)[-300:]})
            return True
        if path == "/yt/playlist":  # 재생목록 → 항목 목록 (직접 재생용, yt-dlp flat)
            lid = (qs.get("list") or [""])[0]
            y = yt_engine()
            if not re.fullmatch(r"[\w-]{6,80}", lid) or not y:
                self._json(400 if y else 503, {"message": "bad list" if y else "engine not installed"})
                return True
            try:
                opts = dict(_ydl_opts(None, None), extract_flat="in_playlist", playlistend=200)
                opts.pop("format", None)
                with y.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info("https://www.youtube.com/playlist?list=" + lid, download=False)
                items = []
                for e in (info.get("entries") or []):
                    vid = e.get("id")
                    if not vid:
                        continue
                    items.append({"id": vid, "title": e.get("title") or vid, "channel": e.get("uploader") or e.get("channel") or "",
                                  "len": "", "thumb": "https://i.ytimg.com/vi/%s/mqdefault.jpg" % vid})
                self._json(200, {"title": info.get("title"), "items": items})
            except Exception as e:
                self._json(502, {"message": str(e)[-300:]})
            return True
        if path == "/yt/media":  # 미디어 프록시 — 유튜브 스트림 서버는 끝이 열린 Range(bytes=0-)를 403으로 막으므로 4MB 조각으로 나눠 받아 이어붙여 스트리밍
            try:
                url = base64.urlsafe_b64decode((qs.get("u") or [""])[0] + "==").decode("utf-8")
            except Exception:
                url = ""
            # 문자열 포함 검사는 https://evil.com/?x=googlevideo.com 으로 뚫린다 → 호스트로 판정
            if not _yt_host_ok(url):
                self._json(400, {"message": "bad url"})
                return True
            vid = (qs.get("id") or [""])[0]
            mode = (qs.get("mode") or ["video"])[0]
            if mode not in ("video", "audio"):
                mode = "video"
            CH = 4 * 1024 * 1024
            m = re.match(r"bytes=(\d+)-(\d*)", self.headers.get("Range") or "")
            start = int(m.group(1)) if m else 0
            end = int(m.group(2)) if (m and m.group(2)) else None
            has_range = bool(m)

            up_hdr = {"User-Agent": UA}
            pin_itag = None      # 재추출할 때 같은 포맷으로 다시 뽑기 위한 itag
            if re.fullmatch(r"[\w-]{6,20}", vid or ""):   # 추출 시 쓰던 헤더(클라이언트별 UA 등) 재사용
                with _yt_lock:
                    c = _yt_cache.get((vid, mode))
                if c and c[1].get("headers"):
                    up_hdr.update(c[1]["headers"])
                pin_itag = (c[1].get("itag") if c else "") or None

            _yt_opener = urllib.request.build_opener(_CheckRedir)

            def open_chunk(u, s, e):
                if not _yt_host_ok(u):
                    raise RuntimeError("bad upstream host")
                h = dict(up_hdr)
                h["Range"] = "bytes=%d-%d" % (s, e)
                req = urllib.request.Request(u, headers=h)
                return _yt_opener.open(req, timeout=60)

            def splice_ok(r, want_start, want_total):
                """이 응답을 앞 조각 뒤에 그대로 이어붙여도 되는가.

                이어붙이면 안 되는 응답을 그냥 쓰면 브라우저가
                MEDIA_ELEMENT_ERROR: Format error 로 죽는다. 두 경우가 실제로 났다.
                  - 중간에 403 이 나서 새로 추출했는데 다른 포맷(다른 itag)이 돌아온 경우.
                    앞부분은 A 포맷, 뒷부분은 B 포맷이 되어 파일이 깨진다.
                  - 업스트림이 Range 를 무시하고 200 으로 파일 전체를 준 경우.
                    파일 첫 바이트가 스트림 한가운데에 끼어든다.
                전체 크기가 같고 요청한 위치에서 시작할 때만 통과시킨다."""
                if getattr(r, "status", None) != 206:
                    return False
                m2 = re.search(r"bytes\s+(\d+)-\d+/(\d+)", r.headers.get("Content-Range") or "")
                if not m2:
                    return False
                got_start, got_total = int(m2.group(1)), int(m2.group(2))
                if got_start != want_start:
                    return False
                return want_total is None or got_total == want_total

            first_end = end if (end is not None and end - start + 1 <= CH) else start + CH - 1
            started = False
            try:
                try:
                    r = open_chunk(url, start, first_end)
                except urllib.error.HTTPError as e:
                    if e.code in (403, 410) and re.fullmatch(r"[\w-]{6,20}", vid or ""):
                        # URL 만료/차단 → 새로 추출해 재시도.
                        # 클라이언트의 <video src> 에는 만료된 주소가 박혀 있어 갱신되지 않는다.
                        # 그래서 요청마다 fresh=True 로 뽑으면 매번 yt-dlp 전체 추출이 돌고,
                        # 그때그때 다른 포맷이 걸려 앞뒤가 섞인다. 먼저 캐시를 보고,
                        # 캐시가 이미 새 것이면(=다른 요청이 방금 갱신) 그것을 쓴다.
                        # 처음에 쓰던 itag 을 그대로 다시 뽑는다 — 포맷이 바뀌면 앞뒤가 안 이어진다
                        _r = yt_stream(vid, mode)
                        if _r.get("url") == url:
                            _r = yt_stream(vid, mode, fresh=True, itag=pin_itag)
                        pin_itag = _r.get("itag") or pin_itag
                        url = _r["url"]
                        # 재추출은 다른 클라이언트를 고를 수 있다 — URL 과 헤더는 한 쌍이라 함께 갈아야 또 403 이 안 난다
                        up_hdr.clear(); up_hdr["User-Agent"] = UA
                        up_hdr.update(_r.get("headers") or {})
                        r = open_chunk(url, start, first_end)
                    else:
                        raise
                # 재개 요청(start > 0)의 '첫' 조각도 검사해야 한다.
                # 이 검사가 없으면, 중간 조각을 거부하고 커넥션을 끊어봐야 브라우저가
                # 같은 오프셋으로 재요청할 때 그 첫 조각이 무검증으로 통과해
                # 앞(포맷 A) + 뒤(포맷 B) 뒤섞임이 요청 경계로 옮겨갈 뿐이다.
                if has_range and start > 0 and not splice_ok(r, start, None):
                    self._json(502, {"message": "range not honored — reopen"})
                    return True
                cr = r.headers.get("Content-Range") or ""
                mt = re.search(r"/(\d+)$", cr)
                total = int(mt.group(1)) if mt else None
                if r.status == 200 and total is None:  # 서버가 Range를 무시하고 전체를 줌
                    total = int(r.headers.get("Content-Length") or 0) or None
                    start = 0
                if total is None:
                    self._json(502, {"message": "upstream without size"})
                    return True
                resp_end = end if (end is not None and end < total) else total - 1
                ctype = r.headers.get("Content-Type", "application/octet-stream")
                self.send_response(206 if has_range else 200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(resp_end - start + 1))
                if has_range:
                    self.send_header("Content-Range", "bytes %d-%d/%d" % (start, resp_end, total))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Cache-Control", "no-store")
                self._cors()
                self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, Content-Type")
                self.end_headers()
                started = True
                pos = start
                last_pos = start - 1
                cur = r
                while True:
                    try:
                        while True:
                            # 업스트림 오류와 클라이언트 이탈을 구분해야 한다. 예전엔 둘 다 return True 라
                            # 업스트림이 끊겨도 Content-Length 를 못 채운 채 커넥션을 살려둬 재생이 멈췄다.
                            try:
                                chunk = cur.read(256 * 1024)
                            except Exception:
                                self.close_connection = True
                                return True
                            if not chunk:
                                break
                            # 업스트림이 Range 를 무시하고 파일 전체를 주면 선언한 길이보다
                            # 훨씬 많이 쓰게 된다 → keep-alive 프레이밍이 깨져 다음 요청이
                            # 미디어 바이트를 HTTP 요청으로 읽는다. 선언한 만큼만 쓴다.
                            if pos + len(chunk) > resp_end + 1:
                                chunk = chunk[:resp_end + 1 - pos]
                            if not chunk:
                                break
                            try:
                                self.wfile.write(chunk)
                            except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                                return True     # 브라우저가 떠남 — 소켓은 이미 죽었다
                            pos += len(chunk)
                            if pos > resp_end:
                                break
                    finally:
                        try:
                            cur.close()
                        except Exception:
                            pass
                    if pos > resp_end:
                        break
                    if pos == last_pos:       # 한 바이트도 못 받았다 — 무한 재요청 방지
                        self.close_connection = True
                        return True
                    last_pos = pos
                    # 요청했던 끝(cur_end+1)이 아니라 실제로 보낸 위치에서 이어야 한다.
                    # 업스트림이 Content-Length 를 못 채우고 조용히 끊으면(파이썬 read 는
                    # 예외 없이 b"" 를 준다) 그 차이만큼 바이트가 통째로 빠진 채 이어붙는다.
                    s = pos
                    e = min(s + CH - 1, resp_end)
                    try:
                        cur = open_chunk(url, s, e)
                    except urllib.error.HTTPError as ex:
                        if ex.code in (403, 410) and re.fullmatch(r"[\w-]{6,20}", vid or ""):
                            try:
                                # 반드시 같은 itag 으로 — 다른 포맷이 걸리면 이어붙지 않아
                                # 여기서 연결이 끊기고 브라우저엔 "코드 2(네트워크)" 로 보인다
                                _r = yt_stream(vid, mode, fresh=True, itag=pin_itag)
                                url = _r["url"]
                                up_hdr.clear(); up_hdr["User-Agent"] = UA
                                up_hdr.update(_r.get("headers") or {})
                                cur = open_chunk(url, s, e)
                            except Exception:
                                self.close_connection = True
                                return True
                        else:
                            self.close_connection = True   # 남은 바이트를 못 보내면 연결을 끊어 브라우저가 재요청하게
                            return True
                    if not splice_ok(cur, s, total):
                        # 이어붙이면 파일이 깨진다 → 보내다 말고 끊는다.
                        # 브라우저가 같은 범위를 다시 요청하면 처음부터 일관된 스트림으로 받는다.
                        try:
                            cur.close()
                        except Exception:
                            pass
                        self.close_connection = True
                        return True

                if pos <= resp_end:
                    # 선언한 Content-Length 를 못 채웠다 (업스트림이 조용히 FIN) → 커넥션을 끊어야
                    # 브라우저가 멈춘 채로 기다리지 않고 재요청한다
                    self.close_connection = True
            except urllib.error.HTTPError as e:
                if not started:
                    self._send(e.code, b"", "text/plain")
            except Exception as e:
                if not started:
                    try:
                        self._json(502, {"message": "media proxy error: %s" % e})
                    except Exception:
                        pass
                else:
                    self.close_connection = True   # 본문 중간이면 연결만 끊음 (스트림 오염 방지)
            return True
        if path == "/yt/check":  # 임베드 가능 여부 (oEmbed: 200 가능 / 401 소유자가 임베드 금지)
            ids = [i for i in (qs.get("ids") or [""])[0].split(",") if re.fullmatch(r"[\w-]{6,20}", i)][:40]
            result = {}
            def chk(vid):
                u = "https://www.youtube.com/oembed?url=" + urllib.parse.quote("https://www.youtube.com/watch?v=" + vid, safe="") + "&format=json"
                try:
                    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=8) as r:
                        result[vid] = r.status == 200
                except urllib.error.HTTPError as e:
                    result[vid] = None if e.code in (400, 404) else False  # 401/403 = 임베드 불가
                except Exception:
                    result[vid] = None
            ths = [threading.Thread(target=chk, args=(v,), daemon=True) for v in ids]
            for t in ths: t.start()
            for t in ths: t.join(12)
            self._json(200, {"embeddable": result})
            return True
        if path == "/yt/search":
            q = (qs.get("q") or [""])[0].strip()
            if not q:
                self._json(400, {"message": "q required"})
                return True
            try:
                self._json(200, {"items": yt_search(q)})
            except Exception as e:
                self._json(502, {"message": "youtube search failed: %s" % e})
            return True
        if path == "/ai/judge" and self.command == "POST":
            # 이미지 품질 판정 (Gemini 비전): 손가락·해부학·프롬프트 준수도·그림체 붕괴
            cfg = load_cfg()
            key = (cfg.get("geminiKey") or "").strip()
            if not key:
                self._json(400, {"message": "Gemini API 키가 없습니다 — 설정에서 저장하세요"})
                return True
            try:
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                body = {}
            b64 = (body.get("image") or "").split(",")[-1]
            prompt = (body.get("prompt") or "").strip()[:1200]
            model = (body.get("model") or "gemini-2.5-flash").strip()
            if not b64 or not re.fullmatch(r"[\w.\-]{3,60}", model):
                self._json(400, {"message": "bad request"})
                return True
            sysmsg = (
                "You grade AI-generated anime illustrations for defects. Answer ONLY with compact JSON, no markdown. "
                'Schema: {"hands":{"score":0-10,"note":"..."},"anatomy":{"score":0-10,"note":"..."},'
                '"style":{"score":0-10,"note":"..."},"artifacts":{"score":0-10,"note":"..."},'
                '"prompt_follow":{"score":0-10,"note":"..."},"overall":0-10,"summary":"..."} '
                "10 = flawless, 0 = badly broken. hands = finger count/shape correctness (count visible fingers; "
                "5 per hand is correct). anatomy = limbs, joints, proportions. style = is the drawing style coherent "
                "or does it collapse/melt. artifacts = noise, smearing, jpeg-like mush, duplicated parts. "
                "prompt_follow = does the image match the given prompt. Write notes in Korean, one short sentence each."
            )
            parts = [{"inline_data": {"mime_type": "image/png", "data": b64}}]
            parts.append({"text": ("프롬프트: " + prompt) if prompt else "프롬프트 정보 없음 — prompt_follow 는 5 로 두고 나머지만 판정."})
            payload = {
                "systemInstruction": {"parts": [{"text": sysmsg}]},
                "contents": [{"role": "user", "parts": parts}],
                # 2.5 계열은 "생각(thinking)" 토큰이 maxOutputTokens 를 같이 먹는다.
                # 900 으로 두면 생각하다 한도를 다 써서 JSON 이 잘리거나 아예 비어 나온다.
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096, "responseMimeType": "application/json"},
            }
            url = ("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model)
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": key})
            try:
                with urllib.request.urlopen(req, timeout=90) as r:
                    j = json.loads(r.read())
                cands = j.get("candidates") or []
                txt = ""
                for c in cands:
                    for part in ((c.get("content") or {}).get("parts") or []):
                        txt += part.get("text") or ""
                fin = (cands[0].get("finishReason") if cands else "") or ""
                txt = txt.strip().strip("`").strip()
                if txt.lower().startswith("json"):
                    txt = txt[4:].strip()
                # 앞뒤에 설명이 붙어 나와도 첫 { 부터 마지막 } 까지 잘라서 시도
                if txt and not txt.startswith("{"):
                    a, b = txt.find("{"), txt.rfind("}")
                    if a >= 0 and b > a:
                        txt = txt[a:b + 1]
                try:
                    self._json(200, {"judge": json.loads(txt)})
                except Exception:
                    why = ("응답이 비었습니다" if not txt else "JSON 형식이 아닙니다")
                    if fin == "MAX_TOKENS":
                        why = "답이 길이 제한에 걸려 잘렸습니다"
                    elif fin in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"):
                        why = "이미지가 Gemini 안전 필터에 걸려 판정이 거부됐습니다 (%s)" % fin
                    elif fin == "RECITATION":
                        why = "Gemini 가 응답을 거부했습니다 (RECITATION)"
                    self._json(502, {"message": "판정 실패: %s" % why,
                                     "finish": fin, "raw": txt[:400],
                                     "model": model})
            except urllib.error.HTTPError as e:
                detail = ""
                try:
                    detail = json.loads(e.read()).get("error", {}).get("message", "")
                except Exception:
                    pass
                self._json(e.code, {"message": "Gemini %d: %s" % (e.code, detail[:200])})
            except Exception as e:
                self._json(502, {"message": "Gemini 연결 실패: %s" % str(e)[:160]})
            return True
        if path == "/ai/prompt" and self.command == "POST":
            # 한국어 장면 설명 → 단부루 태그 (Gemini). 키는 서버 config 에만 저장하고 브라우저로 내보내지 않는다.
            cfg = load_cfg()
            key = (cfg.get("geminiKey") or "").strip()
            if not key:
                self._json(400, {"message": "Gemini API 키가 없습니다 — 설정에서 저장하세요"})
                return True
            try:
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                body = {}
            desc = (body.get("text") or "").strip()[:2000]
            model = (body.get("model") or "gemini-2.5-flash").strip()
            if not re.fullmatch(r"[\w.\-]{3,60}", model) or not desc:
                self._json(400, {"message": "bad request"})
                return True
            sysmsg = (
                "You convert a scene description into Danbooru tags for NovelAI image generation. "
                "Rules: output ONLY a single line of comma-separated lowercase Danbooru tags with underscores "
                "(e.g. 1girl, long_hair, school_uniform, sitting, cafe, looking_at_viewer). "
                "No explanations, no quotes, no markdown, no numbering. "
                "Include subject count (1girl/1boy/2girls...), appearance, clothing, pose, expression, background, composition. "
                "The input may be Korean; translate concepts to standard Danbooru tags."
            )
            payload = {
                "systemInstruction": {"parts": [{"text": sysmsg}]},
                "contents": [{"role": "user", "parts": [{"text": desc}]}],
                # 2.5/3 계열은 "생각(thinking)" 토큰이 maxOutputTokens 를 같이 먹는다.
                # 800 이면 생각만 하다 끝나 본문이 비어 "빈 응답" 이 된다 (판정 쪽과 같은 사고).
                "generationConfig": {"temperature": 0.8, "maxOutputTokens": 4096},
            }
            url = ("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model)
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": key})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    j = json.loads(r.read())
                txt = ""
                for c in (j.get("candidates") or []):
                    for part in ((c.get("content") or {}).get("parts") or []):
                        txt += part.get("text") or ""
                txt = " ".join(txt.split()).strip().strip("`").strip()
                if not txt:
                    self._json(502, {"message": "빈 응답"})
                    return True
                self._json(200, {"tags": txt})
            except urllib.error.HTTPError as e:
                detail = ""
                try:
                    detail = json.loads(e.read()).get("error", {}).get("message", "")
                except Exception:
                    pass
                self._json(e.code, {"message": "Gemini %d: %s" % (e.code, detail[:200])})
            except Exception as e:
                self._json(502, {"message": "Gemini 연결 실패: %s" % str(e)[:160]})
            return True
        if path.startswith("/update/"):
            try:
                if path == "/update/check":
                    self._json(200, update_check())
                    return True
                if path == "/update/start" and self.command == "POST":
                    length = int(self.headers.get("Content-Length") or 0)
                    b = json.loads(self.rfile.read(length) or b"{}")
                    u, sz, ver = b.get("url") or "", int(b.get("size") or 0), b.get("ver") or ""
                    host = (urllib.parse.urlparse(u).hostname or "").lower()
                    # 릴리스 자산은 github.com 이 objects.githubusercontent.com 으로 리다이렉트한다
                    if not (u.startswith("https://") and (host == "github.com" or host.endswith(".github.com")
                                                          or host.endswith(".githubusercontent.com"))):
                        self._json(400, {"message": "bad url"})
                        return True
                    update_download(u, sz, ver)
                    self._json(200, {"ok": True})
                    return True
                if path == "/update/source" and self.command == "POST":
                    # 소스로 실행 중일 때: 저장소 압축본을 받아 앱 파일을 갈아끼운다
                    if FROZEN:
                        self._json(400, {"message": "exe 실행 중에는 소스 교체를 하지 않습니다"})
                        return True
                    length = int(self.headers.get("Content-Length") or 0)
                    b = json.loads(self.rfile.read(length) or b"{}")
                    u, ver = b.get("url") or "", b.get("ver") or ""
                    host = (urllib.parse.urlparse(u).hostname or "").lower()
                    if not (u.startswith("https://") and (host == "github.com" or host.endswith(".github.com")
                                                          or host.endswith(".githubusercontent.com"))):
                        self._json(400, {"message": "bad url"})
                        return True
                    update_source(u, ver)
                    self._json(200, {"ok": True})
                    return True
                if path == "/update/restart" and self.command == "POST":
                    if FROZEN:
                        self._json(400, {"message": "exe 는 /update/apply 를 씁니다"})
                        return True
                    ok, msg = restart_self()
                    self._json(200, {"ok": ok, "message": msg})
                    return True
                if path == "/update/status":
                    with _upd_lock:
                        self._json(200, dict(_upd))
                    return True
                if path == "/update/apply" and self.command == "POST":
                    ok, msg = update_apply()
                    self._json(200 if ok else 400, {"ok": ok, "message": msg})
                    return True
            except urllib.error.HTTPError as e:
                self._json(e.code, {"message": "GitHub %d" % e.code})
                return True
            except Exception as e:
                self._json(502, {"message": str(e)[:200]})
                return True
            self._json(404, {"message": "not found"})
            return True
        if path.startswith("/dan/"):
            # 단부루 연동: 작가 샘플 그림 / 비슷한 작가 / 태그 자동완성 / 이미지 프록시
            try:
                if path == "/dan/posts":
                    tag = (qs.get("tag") or [""])[0].strip()
                    if not re.fullmatch(r"[\w()!\-.'/ ]{1,80}", tag or ""):
                        self._json(400, {"message": "bad tag"})
                        return True
                    lim = max(1, min(30, int((qs.get("limit") or ["12"])[0] or 12)))
                    safe = (qs.get("safe") or ["1"])[0] != "0"
                    # 익명 검색은 태그 2개까지만 허용된다 → 작가 + rating 하나가 한계
                    q = tag.replace(" ", "_") + (" rating:general" if safe else "")
                    try:
                        raw = _dan_get("/posts.json?tags=%s&limit=%d" % (urllib.parse.quote(q), lim))
                        posts = json.loads(raw)
                    except Exception as e:
                        # 단부루가 막힌 망이면 safebooru 로 자동 전환 (같은 태그 체계)
                        try:
                            self._json(200, {"posts": _safebooru_posts(tag, lim), "source": "safebooru"})
                            return True
                        except Exception:
                            raise e
                    out = []
                    for p in posts if isinstance(posts, list) else []:
                        thumb = p.get("preview_file_url") or p.get("large_file_url") or p.get("file_url")
                        if not thumb or not _dan_host_ok(thumb):
                            continue          # 밴/유료 게시물은 URL 이 없다
                        out.append({
                            "id": p.get("id"), "rating": p.get("rating"), "score": p.get("score"),
                            "thumb": base64.urlsafe_b64encode(thumb.encode()).decode().rstrip("="),
                            "large": base64.urlsafe_b64encode((p.get("large_file_url") or thumb).encode()).decode().rstrip("="),
                            "artist": p.get("tag_string_artist", ""),
                            "chars": p.get("tag_string_character", ""),
                            "w": p.get("image_width"), "h": p.get("image_height"),
                        })
                    self._json(200, {"posts": out, "source": "danbooru"})
                    return True
                if path == "/dan/related":
                    tag = (qs.get("tag") or [""])[0].strip()
                    if not re.fullmatch(r"[\w()!\-.'/ ]{1,80}", tag or ""):
                        self._json(400, {"message": "bad tag"})
                        return True
                    raw = _dan_get("/related_tag.json?query=%s&category=1&limit=20" % urllib.parse.quote(tag.replace(" ", "_")), ttl=3600)
                    j = json.loads(raw)
                    items = []
                    # 응답 형태가 버전마다 달라서 둘 다 받아준다
                    lst = j.get("related_tags") if isinstance(j, dict) else (j if isinstance(j, list) else [])
                    for it in (lst or []):
                        t = it.get("tag") if isinstance(it, dict) else None
                        if isinstance(t, dict):
                            items.append({"name": t.get("name"), "count": t.get("post_count"),
                                          "sim": it.get("cosine_similarity") or it.get("frequency")})
                        elif isinstance(it, list) and it:
                            items.append({"name": it[0], "count": it[1] if len(it) > 1 else None})
                    self._json(200, {"related": [x for x in items if x.get("name")][:20]})
                    return True
                if path == "/dan/ac":
                    q = (qs.get("q") or [""])[0].strip()
                    if len(q) < 2:
                        self._json(200, {"items": []})
                        return True
                    raw = _dan_get("/autocomplete.json?search%%5Bquery%%5D=%s&search%%5Btype%%5D=tag_query&limit=12"
                                   % urllib.parse.quote(q), ttl=1800)
                    j = json.loads(raw)
                    items = [{"name": x.get("value") or x.get("label"), "count": x.get("post_count"),
                              "cat": x.get("category")} for x in (j if isinstance(j, list) else [])]
                    self._json(200, {"items": [x for x in items if x.get("name")]})
                    return True
                if path == "/dan/img":
                    try:
                        u = base64.urlsafe_b64decode((qs.get("u") or [""])[0] + "==").decode("utf-8")
                    except Exception:
                        u = ""
                    if not _dan_host_ok(u):
                        self._json(400, {"message": "bad url"})
                        return True
                    now = time.time()
                    with _dan_lock:
                        c = _dan_cache.get("img|" + u)
                    if c and c[0] > now:
                        body, ctype = c[1]
                    else:
                        req = urllib.request.Request(u, headers={"User-Agent": UA, "Referer": DAN + "/"})
                        with urllib.request.urlopen(req, timeout=25) as r:
                            body = r.read()
                            ctype = r.headers.get("Content-Type", "image/jpeg")
                        with _dan_lock:
                            # 원본 이미지는 한 장에 5~20MB 다. 예전엔 상한도 축출도 없이
                            # 24시간 물고 있어서, 몇십 장만 열어봐도 서버가 수백 MB 를 잡았다.
                            # → 이미지 캐시는 총량을 세고, 넘으면 오래된 것부터 버린다.
                            _dan_cache["img|" + u] = (time.time() + 3600, (body, ctype))
                            _dan_img_trim()
                    self._send(200, body, ctype, {"Cache-Control": "max-age=86400"})
                    return True
            except urllib.error.HTTPError as e:
                self._json(e.code, {"message": "danbooru %d" % e.code})
                return True
            except Exception as e:
                self._json(502, {"message": "danbooru 연결 실패: %s" % str(e)[:160]})
                return True
            self._json(404, {"message": "not found"})
            return True
        if path == "/yt/seg":
            # HLS 세그먼트 통과 프록시. Content-Length 없이 chunked 로 오고 크기가 작아서
            # /yt/media 의 Range 조각내기 로직을 쓰지 않고 그대로 흘려보낸다.
            try:
                u = base64.urlsafe_b64decode((qs.get("u") or [""])[0] + "==").decode("utf-8")
            except Exception:
                u = ""
            if not _yt_host_ok(u):
                self._json(400, {"message": "bad url"})
                return True
            # 조각 하나를 못 받으면 hls.js 가 결국 치명적 오류를 내고 재생이 끊긴다.
            # googlevideo 는 순간적으로 타임아웃/5xx 를 흘리므로 몇 번 다시 물어본다.
            #
            # 다만 두 가지를 지켜야 한다.
            #  (1) 총 소요 시간이 클라이언트(hls.js)가 포기하는 시간을 넘으면 안 된다. 넘으면
            #      브라우저는 이미 재요청을 보냈는데 서버 스레드만 죽은 요청을 붙들고 있게 된다.
            #      → 시도당 10초 · 최대 3회 · 짧은 간격으로 총 21초 안쪽에 끝낸다.
            #  (2) 다시 물어봐야 소용없는 응답은 즉시 포기한다. googlevideo 조각 URL 에는
            #      만료 시각이 박혀 있어서, 오래 틀어두면 이후 모든 조각이 곧바로 403 을 받는다.
            #      이때 재시도를 돌면 조각마다 1초 넘게 헛되이 버린다.
            NO_RETRY = (400, 401, 403, 404, 410)
            data = ctype = None
            last = ""
            for attempt in range(3):
                try:
                    req = urllib.request.Request(u, headers={"User-Agent": UA, "Origin": "https://www.youtube.com",
                                                             "Referer": "https://www.youtube.com/"})
                    with urllib.request.urlopen(req, timeout=10) as r:
                        data = r.read()
                        ctype = r.headers.get("Content-Type") or "video/mp2t"
                    break
                except urllib.error.HTTPError as e:
                    last = "HTTP %d" % e.code
                    if e.code in NO_RETRY:
                        break
                    if attempt < 2:
                        time.sleep(0.3)
                except Exception as e:
                    last = str(e)[:120]
                    if attempt < 2:
                        time.sleep(0.3)
            if data is None:
                self._json(502, {"message": "seg failed: %s" % last})
                return True
            if ctype == "application/octet-stream":
                ctype = "video/mp2t"
            self._send(200, data, ctype, {"Cache-Control": "max-age=3600"})
            return True
        if path == "/yt/hls":
            # HLS 매니페스트 프록시 — 안의 URL 을 전부 우리 서버 경유로 바꿔준다.
            # (googlevideo 는 CORS 를 안 열어줘서 브라우저가 직접 못 읽는다)
            try:
                u = base64.urlsafe_b64decode((qs.get("u") or [""])[0] + "==").decode("utf-8")
            except Exception:
                u = ""
            if not _yt_host_ok(u):
                self._json(400, {"message": "bad url"})
                return True
            try:
                req = urllib.request.Request(u, headers={"User-Agent": UA, "Origin": "https://www.youtube.com",
                                                         "Referer": "https://www.youtube.com/"})
                with urllib.request.urlopen(req, timeout=25) as r:
                    text = r.read().decode("utf-8", "replace")
            except Exception as e:
                self._json(502, {"message": "hls fetch failed: %s" % str(e)[:140]})
                return True

            def wrap(target):
                a = urllib.parse.urljoin(u, target.strip())
                if not _yt_host_ok(a):
                    return target
                b64 = base64.urlsafe_b64encode(a.encode()).decode().rstrip("=")
                # 세그먼트 주소에도 경로 중간에 "/index.m3u8/" 가 들어있다 → 끝나는지로 판정해야 한다
                is_pl = urllib.parse.urlparse(a).path.rstrip("/").endswith(".m3u8")
                return ("/yt/hls?u=" + b64) if is_pl else ("/yt/seg?u=" + b64)

            out = []
            for line in text.splitlines():
                st = line.strip()
                if not st:
                    out.append(line)
                elif st.startswith("#"):
                    # #EXT-X-MAP:URI="..." / #EXT-X-KEY:URI="..." 안의 주소도 바꿔야 한다
                    m = re.search(r'URI="([^"]+)"', st)
                    out.append(st.replace(m.group(1), wrap(m.group(1))) if m else line)
                else:
                    out.append(wrap(st))
            body = (chr(10).join(out) + chr(10)).encode("utf-8")
            self._send(200, body, "application/vnd.apple.mpegurl", {"Cache-Control": "no-store"})
            return True
        if path == "/vendor/hls.js":
            f = ROOT / "assets" / "hls.min.js"
            if f.exists():
                self._send(200, f.read_bytes(), "application/javascript; charset=utf-8", {"Cache-Control": "max-age=86400"})
            else:
                self._send(204, b"", "application/javascript")
            return True
        if path in ("/tags/extra.json", "/tags/groups.json", "/tags/t5.json", "/tags/koalias.json"):
            # 부가 사전: 영문 보강 태그 / 단부루 태그 그룹 / T5 토크나이저 사전 (없으면 204 — 앱은 없어도 동작)
            # 앱과 함께 배포되는 자산이라 ROOT/assets 에 둔다 (--data 로 바뀌는 사용자 폴더가 아님)
            name = {"/tags/extra.json": "tags_extra.json.gz",
                    "/tags/groups.json": "tag_groups.json.gz",
                    "/tags/t5.json": "t5_vocab.json.gz",
                    "/tags/koalias.json": "tags_ko_alias.json.gz"}[path]
            f = ROOT / "assets" / name
            if not f.exists():
                f = DATA / name
            if f.exists():
                self._send(200, f.read_bytes(), "application/json; charset=utf-8", {"Content-Encoding": "gzip"})
            else:
                self._send(204, b"", "application/json; charset=utf-8")
            return True
        if path == "/tags/kr.json":
            if TAG_JSON_GZ.exists():
                data = TAG_JSON_GZ.read_bytes()
                self._send(200, data, "application/json; charset=utf-8",
                           {"Content-Encoding": "gzip"})
            else:
                if _tag_status["state"] in ("idle", "error"):
                    ensure_tag_db_async()
                self._json(503, {"message": "tag db not ready", "tags": _tag_status})
            return True
        return False

    def _static(self):
        path = urllib.parse.unquote(self.path.split("?")[0])
        if path == "/":
            path = "/index.html"
        rel = path.lstrip("/\\")
        # 보안: 앱 폴더 안의 허용된 파일만 (경로 탈출·드라이브 문자·심볼릭 링크·설정/토큰 폴더 차단)
        try:
            f = (ROOT / rel).resolve(strict=False)
            f.relative_to(ROOT.resolve())
        except Exception:
            return False
        if not f.is_file() or f.suffix.lower() not in (".html", ".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".txt", ".woff", ".woff2"):
            return False
        try:
            rel2 = f.relative_to(ROOT.resolve()).as_posix()
        except Exception:
            return False
        if rel2.startswith("data/") or rel2.startswith("vendor/") or rel2.startswith("_") or "/_" in rel2:
            return False
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        self._send(200, f.read_bytes(), ctype)
        return True

    def _drain(self):
        """거부 응답 전에 요청 본문을 비운다 — 안 그러면 keep-alive 커넥션에서
           남은 본문이 다음 요청으로 해석돼(요청 밀어넣기) _guard 를 우회할 수 있다"""
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self.close_connection = True
            return
        while n > 0:
            chunk = self.rfile.read(min(n, 65536))
            if not chunk:
                break
            n -= len(chunk)

    def _guard(self):
        """외부 사이트에서 온 요청(다른 Origin / 다른 사이트의 Referer)은 차단"""
        # Host 검증: 없으면 공격자 도메인이 127.0.0.1 로 리졸브되게 해(DNS 리바인딩) 전부 우회된다
        hh = (self.headers.get("Host") or "").strip()
        if hh.startswith("["):
            hh = hh[1:].split("]", 1)[0]
        elif hh.count(":") == 1:
            hh = hh.rsplit(":", 1)[0]
        if hh not in ("127.0.0.1", "localhost", "::1"):
            self._drain()
            self._json(403, {"message": "forbidden: bad host"})
            self.close_connection = True
            return False
        if not self._origin_ok():
            self._drain()
            self._json(403, {"message": "forbidden: external origin"
                             if (self.headers.get("Origin") or "") != "null"
                             else "file:// 로 연 화면에서는 저장·생성이 안 됩니다 — start.bat 이 띄운 http://127.0.0.1:… 주소로 열어 주세요"})
            self.close_connection = True
            return False
        ref = self.headers.get("Referer")
        if ref:
            try:
                h = urllib.parse.urlparse(ref).hostname
                if h and h not in ("127.0.0.1", "localhost", "::1"):
                    self._drain()
                    self._json(403, {"message": "forbidden: external referer"})
                    self.close_connection = True
                    return False
            except Exception:
                pass
        return True

    def do_GET(self):
        if not self._guard():
            return
        if self._local() or self._proxy() or self._static():
            return
        self._json(404, {"message": "not found"})

    def do_POST(self):
        if not self._guard():
            return
        if self._local() or self._proxy():
            return
        self._json(404, {"message": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        import traceback
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)):
            return
        traceback.print_exc()


def find_browser(name):
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    la = os.environ.get("LOCALAPPDATA", "")
    cands = {
        "edge": [pf86 + r"\Microsoft\Edge\Application\msedge.exe", pf + r"\Microsoft\Edge\Application\msedge.exe", la + r"\Microsoft\Edge\Application\msedge.exe"],
        "chrome": [pf + r"\Google\Chrome\Application\chrome.exe", pf86 + r"\Google\Chrome\Application\chrome.exe", la + r"\Google\Chrome\Application\chrome.exe"],
    }.get(name, [])
    for c in cands:
        if os.path.isfile(c):
            return c
    return None


def pick_port():
    if "--port" in sys.argv:
        try:
            return int(sys.argv[sys.argv.index("--port") + 1])
        except (IndexError, ValueError):
            pass
    for p in PORT_CANDIDATES:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise SystemExit("no free port in %s" % PORT_CANDIDATES)


def main():
    try:
        sys.stdout.reconfigure(errors="replace")
    except Exception:
        pass
    if "--build-tags" in sys.argv:
        print("tags:", build_tag_db())
        return
    port = pick_port()
    url = "http://127.0.0.1:%d/" % port
    server = Server(("127.0.0.1", port), Handler)
    print("=" * 54)
    print("  NAI Studio  v%d%s" % (VERSION, "  (단일 실행 파일)" if FROZEN else ""))
    print("  %s" % url)
    print("  설정·이미지 저장 위치: %s" % DATA)
    print("  이 창을 닫으면 앱이 꺼집니다. 최소화해 두세요.")
    print("=" * 54)
    seed_from_bundle()
    ensure_tag_db_async()
    # 앱이 떠 있는 동안 스스로 상태를 확인한다 (10분마다, 1시간에 한 번은 바깥 연결까지).
    # 문제가 생기면 data/health.jsonl 에 남고 앱 화면에도 뜬다.
    threading.Thread(target=_watchdog, daemon=True).start()
    app_browser = None
    if "--app" in sys.argv:  # --app edge|chrome : 앱 모드(주소창 없는 창)로 열기 — 임베드 유튜브가 로그인 계정으로 재생됨
        try:
            app_browser = sys.argv[sys.argv.index("--app") + 1].lower()
        except IndexError:
            app_browser = "edge"
    if app_browser:
        exe = find_browser(app_browser)
        if exe:
            import subprocess
            threading.Timer(0.8, lambda: subprocess.Popen([exe, "--app=" + url, "--window-size=1500,950"])).start()
            print("  %s 앱 모드로 엽니다: %s" % (app_browser, exe))
        else:
            print("  %s 를 찾지 못해 기본 브라우저로 엽니다" % app_browser)
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    elif "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
