@echo off
title Chaoxing Auto-Watch
setlocal enabledelayedexpansion
set "DIR=%~dp0_auto-click"

if not exist "%DIR%\monitor.mjs" (
  echo [ERROR] Cannot find "%DIR%\monitor.mjs"
  echo Keep this .cmd file and the "_auto-click" folder together in the same directory.
  pause
  exit /b 1
)

rem ---------- find Node.js ----------
set "NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE (
  echo [ERROR] Node.js not found. Please install the LTS version from https://nodejs.org
  pause
  exit /b 1
)

rem ---------- find Chrome ----------
set "CHROME="
if not defined CHROME if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
rem ---------- fall back to Microsoft Edge (Chromium, same flags) ----------
if not defined CHROME if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "CHROME=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME (
  echo [ERROR] Neither Google Chrome nor Microsoft Edge was found.
  echo         Please install one of them first.
  pause
  exit /b 1
)

rem ---------- page to open (edit _auto-click\url.txt) ----------
set "URL="
if exist "%DIR%\url.txt" set /p URL=<"%DIR%\url.txt"
if not defined URL set "URL=https://i.chaoxing.com/base"

cd /d "%DIR%"
echo ==========================================================
echo   Chaoxing Auto-Watch
echo   Node   : !NODE!
echo   Chrome : !CHROME!
echo   Open   : !URL!
echo ----------------------------------------------------------
echo   - keeps the video playing (auto resume, auto answer popups)
echo   - auto jumps to the next section in the catalog when a video ends
echo   - do the chapter quiz yourself
echo   - close this window to stop
echo ==========================================================
curl -s -m 2 http://127.0.0.1:9222/json/version >nul 2>&1
if errorlevel 1 (
  echo [1/2] Starting Chrome with remote debugging ^(log in to Chaoxing if asked^) ...
  start "" "!CHROME!" --remote-debugging-port=9222 --user-data-dir="!DIR!\p" --no-first-run --no-default-browser-check --window-size=1280,1500 --window-position=0,0 "!URL!"
  timeout /t 8 /nobreak >nul
) else (
  echo [1/2] Debug window already running - taking over
)
echo [2/2] Watching ... log file: _auto-click\monitor.log
echo.
"!NODE!" monitor.mjs
echo.
echo Stopped. Press any key to exit.
pause >nul
