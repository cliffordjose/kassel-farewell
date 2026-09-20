@echo off
cd /d "%~dp0"
start "Kassel Wishes Server" /min node local-server.js
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
