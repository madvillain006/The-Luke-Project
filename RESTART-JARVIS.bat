@echo off
cd /d C:\Users\conor\jarvis
pm2 restart jarvis-server
echo Restarted. Opening Jarvis...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
echo Done.
