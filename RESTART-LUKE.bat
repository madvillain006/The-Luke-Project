@echo off
cd /d C:\Users\conor\luke
pm2 restart luke-server
echo Restarted. Opening Luke...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
echo Done.
