@echo off
cd C:\Users\conor\jarvis
powershell -command "$env:ANTHROPIC_API_KEY = [System.Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User'); pm2 kill; pm2 start ecosystem.config.js; Start-Sleep 2; & '.\node_modules\.bin\electron.cmd' 'electron.js'"