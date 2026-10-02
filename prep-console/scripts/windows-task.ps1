<#
Run the Prep Console in the background on Windows, plus a nightly database backup.

    .\scripts\windows-task.ps1 -Install              # start at sign-in (no admin needed)
    .\scripts\windows-task.ps1 -Install -AtStartup   # start at boot, before anyone signs in (run as admin)
    .\scripts\windows-task.ps1 -Status
    .\scripts\windows-task.ps1 -Uninstall

Creates two Task Scheduler tasks: "PrepConsole" (the app, restarted if it crashes) and
"PrepConsole Backup" (backend\backup.py every day at 03:00). App output goes to logs\app.log.
#>
param([switch]$Install, [switch]$Uninstall, [switch]$Status, [switch]$AtStartup)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$app = "PrepConsole"
$bak = "PrepConsole Backup"

if ($Status) {
    Get-ScheduledTask -TaskName $app, $bak -ErrorAction SilentlyContinue |
        Select-Object TaskName, State, @{ n = "LastRun"; e = { ($_ | Get-ScheduledTaskInfo).LastRunTime } }, @{ n = "LastResult"; e = { ($_ | Get-ScheduledTaskInfo).LastTaskResult } }
    return
}
if ($Uninstall) {
    foreach ($t in $app, $bak) { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Host "Removed the $app tasks. A running server keeps running until you stop it or restart."
    return
}
if (-not $Install) { Get-Help $PSCommandPath; return }

if (-not (Test-Path "$root\.env")) { throw "Run .\start.ps1 once first: it creates .env, which you then fill in." }
New-Item -ItemType Directory -Force "$root\logs" | Out-Null

$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$runApp = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"& '$root\start.ps1' *>> '$root\logs\app.log'`""
$runBak = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"& '$root\backend\.venv\Scripts\python.exe' '$root\backend\backup.py' *>> '$root\logs\backup.log'`""

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
if ($AtStartup) {
    # S4U runs without a stored password and without anyone signed in; it needs an elevated prompt to register.
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
    $trigger = New-ScheduledTaskTrigger -AtStartup
} else {
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
}

Register-ScheduledTask -TaskName $app -Force -Settings $settings -Principal $principal -Trigger $trigger `
    -Action (New-ScheduledTaskAction -Execute $ps -Argument $runApp -WorkingDirectory $root) `
    -Description "Prep Console web app on http://127.0.0.1:5000" | Out-Null
Register-ScheduledTask -TaskName $bak -Force -Principal $principal `
    -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries) `
    -Trigger (New-ScheduledTaskTrigger -Daily -At 3am) `
    -Action (New-ScheduledTaskAction -Execute $ps -Argument $runBak -WorkingDirectory $root) `
    -Description "Nightly copy of the Prep Console database to backups\" | Out-Null

Start-ScheduledTask -TaskName $app
Write-Host "Installed. The app is starting in the background (log: logs\app.log)."
Write-Host "Check it with: .\scripts\windows-task.ps1 -Status   and open http://localhost:5000"
