@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   NAI Studio - 단일 실행 파일 빌드
echo ==========================================
echo.

if not exist ".build-venv\Scripts\python.exe" (
  echo [1/4] 빌드용 가상환경 만드는 중...
  python -m venv .build-venv
  if errorlevel 1 (
    echo.
    echo   ! 파이썬을 찾지 못했습니다. https://www.python.org 에서 설치한 뒤 다시 실행하세요.
    pause
    exit /b 1
  )
  .build-venv\Scripts\python.exe -m pip install --upgrade pip
  .build-venv\Scripts\python.exe -m pip install pyinstaller yt-dlp
) else (
  echo [1/4] 가상환경 있음 - 건너뜀
)

echo.
echo [2/4] 태그 사전 확인...
rem  주의: 예전에는 여기서 data\tags_kr.json.gz 로 assets\tags_kr.seed.json.gz 를 무조건 덮어썼다.
rem  배포용 사전에는 한글 별칭을 손질해 넣어 뒀다 - 그러면 빌드 한 번에 통째로 날아간다.
rem  배포용이 이미 있으면 그대로 쓰고, 없을 때만 작업용에서 가져온다.
if exist "assets\tags_kr.seed.json.gz" (
  echo       배포용 사전 있음 - 그대로 씁니다
) else (
  if exist "data\tags_kr.json.gz" (
    copy /y "data\tags_kr.json.gz" "assets\tags_kr.seed.json.gz" >nul
    echo       작업용 사전을 배포용으로 복사했습니다
  ) else (
    echo       사전이 없습니다 - 앱을 한 번 실행해 받아두세요
  )
)

echo.
echo [3/4] 실행 파일 빌드 중... (몇 분 걸립니다)
.build-venv\Scripts\pyinstaller.exe nai-studio.spec --noconfirm --distpath dist --workpath build
if errorlevel 1 (
  echo.
  echo   ! 빌드 실패
  pause
  exit /b 1
)

echo.
echo [4/4] 완료!
echo.
for %%F in ("dist\NAI-Studio.exe") do echo   dist\NAI-Studio.exe   (%%~zF 바이트)
echo.
echo   이 exe 파일 하나만 복사해서 배포하면 됩니다.
echo   실행하면 exe 옆에 data\ 폴더가 생기고 설정·이미지가 거기 저장됩니다.
echo.
pause
