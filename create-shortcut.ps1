$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Luke.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-NoExit -Command `"cd C:\Users\conor\luke; node index.js`""
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,23"
$Shortcut.Description = "Start Luke"
$Shortcut.Save()

Write-Host "Shortcut created on Desktop. Right-click it and pin to taskbar."
