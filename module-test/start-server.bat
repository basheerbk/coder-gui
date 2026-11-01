@echo off
REM Starts the TinkerBit 3D gallery at http://localhost:8710/ and opens it in your browser.
cd /d "%~dp0"
title TinkerBit 3D server
start "" /b powershell -NoProfile -Command "Start-Sleep 2; Start-Process http://localhost:8710/"
node serve.js
pause
