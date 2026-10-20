# -*- mode: python ; coding: utf-8 -*-
"""NAI Studio — 단일 실행 파일 빌드 설정 (PyInstaller)

  .build-venv\Scripts\pyinstaller.exe nai-studio.spec --noconfirm

앱 파일(html/js/css/assets)은 exe 안에 들어가고, 실행하면 임시폴더에 풀린다.
사용자 데이터(토큰·설정·이미지)는 exe 옆의 data\ 폴더에 저장된다 — server.py 의 FROZEN 분기 참고.
"""
from PyInstaller.utils.hooks import collect_all

# yt-dlp 는 추출기를 동적으로 불러와서 collect_all 로 통째로 넣어야 한다
ytd_datas, ytd_binaries, ytd_hidden = collect_all('yt_dlp')

APP_FILES = [
    ('index.html', '.'),
    ('app.js', '.'),
    ('tags.js', '.'),
    ('tools.js', '.'),
    ('scenes.js', '.'),
    ('canvas.js', '.'),
    ('layout.js', '.'),
    ('model3d.js', '.'),
    ('style.css', '.'),
    ('assets/hls.min.js', 'assets'),
    ('assets/pica.min.js', 'assets'),
    ('assets/t5_vocab.json.gz', 'assets'),
    ('assets/tag_groups.json.gz', 'assets'),
    ('assets/tags_extra.json.gz', 'assets'),
    ('assets/tags_ko_alias.json.gz', 'assets'),
    ('LICENSE', '.'),
    ('NOTICE.txt', '.'),
]
# 12.26: 그림판 3D 모델 레이어 라이브러리 (server.py THREE_VENDOR_FILES 와 같은 목록 — 점검.py 가 맞대 본다)
THREE_FILES = [
    'build/three.module.min.js', 'build/three.core.min.js',
    'jsm/loaders/GLTFLoader.js', 'jsm/loaders/TGALoader.js', 'jsm/loaders/MMDLoader.js', 'jsm/utils/BufferGeometryUtils.js',
    'jsm/controls/OrbitControls.js', 'jsm/controls/TransformControls.js',
    'jsm/animation/MMDAnimationHelper.js', 'jsm/animation/MMDPhysics.js', 'jsm/animation/CCDIKSolver.js',
    'jsm/libs/mmdparser.module.js', 'jsm/shaders/MMDToonShader.js', 'jsm/libs/ammo.wasm.js', 'jsm/libs/ammo.wasm.wasm',
    'vrm/three-vrm.module.min.js', 'jszip/jszip.min.js',
]
for _p in THREE_FILES:
    APP_FILES.append(('assets/three/' + _p, 'assets/three/' + _p.rsplit('/', 1)[0]))

# 태그 사전 씨앗은 저장소에 넣기엔 크고(5.5MB) 자동으로 받아지는 것이라 선택 사항이다.
# 있으면 넣어서 첫 실행 다운로드를 건너뛰게 하고, 없으면 그냥 빌드한다.
import os
if os.path.exists('assets/tags_kr.seed.json.gz'):
    APP_FILES.append(('assets/tags_kr.seed.json.gz', 'assets'))
else:
    print('  [알림] assets/tags_kr.seed.json.gz 가 없어 태그 사전은 첫 실행 때 자동으로 받습니다.')

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=ytd_binaries,
    datas=APP_FILES + ytd_datas,
    hiddenimports=ytd_hidden,
    hookspath=[],
    runtime_hooks=[],
    # 쓰지 않는 무거운 것들은 빼서 용량을 줄인다
    excludes=['tkinter', 'test', 'unittest', 'pydoc_data', 'lib2to3',
              'numpy', 'PIL', 'setuptools', 'pip'],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name='NAI-Studio',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=True,          # 콘솔 창 = 서버 로그 + 종료 수단 (닫으면 앱이 꺼짐)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
