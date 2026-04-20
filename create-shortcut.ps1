$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Jarvis.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-NoExit -Command `"cd C:\Users\conor\jarvis; node index.js`""
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,23"
$Shortcut.Description = "Start Jarvis"
$Shortcut.Save()

Write-Host "Shortcut created on Desktop. Right-click it and pin to taskbar."
