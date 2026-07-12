$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$Home\Desktop\HabitFlow.lnk")
$Shortcut.TargetPath = "$PWD\launch.bat"
$Shortcut.WindowStyle = 7 # Minimized window
$Shortcut.IconLocation = "$PWD\node_modules\electron\dist\electron.exe"
$Shortcut.Description = "Launch HabitFlow Widget"
$Shortcut.WorkingDirectory = "$PWD"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully."
