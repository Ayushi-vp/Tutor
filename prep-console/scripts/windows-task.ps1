<#
Run the Prep Console in the background on Windows, plus a nightly database backup.

    .\scripts\windows-task.ps1 -Install              # start at sign-in (no admin needed)
    .\scripts\windows-task.ps1 -Install -AtStartup   # start at boot, before anyone signs in (run as admin)
    .\scripts\windows-task.ps1 -Status
    .\scripts\windows-task.ps1 -Restart              # after editing .env or pulling new code
    .\scripts\windows-task.ps1 -Uninstall

Creates two Task Scheduler tasks: "PrepConsole" (the app, restarted if it crashes) and
"PrepConsole Backup" (backend\backup.py every day at 03:00). App output goes to logs\app.log.
#>
param([switch]$Install, [switch]$Uninstall, [switch]$Status, [switch]$Restart, [switch]$AtStartup)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$app = "PrepConsole"
$bak = "PrepConsole Backup"

function Stop-App {
    # Stopping the task ends its PowerShell loop but can leave python running and holding the port.
    Stop-ScheduledTask -TaskName $app -ErrorAction SilentlyContinue
    $loop = [regex]::Escape("$root\start.ps1")
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
        Where-Object { $_.CommandLine -match "while .*$loop" -and $_.ProcessId -ne $PID } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $port = 5000
    if (Test-Path "$root\.env") {
        $m = Select-String -Path "$root\.env" -Pattern '^PORT=(\d+)' | Select-Object -First 1
        if ($m) { $port = [int]$m.Matches[0].Groups[1].Value }
    }
    foreach ($c in Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"
        if ($p.Name -ne "python.exe") { continue }
        # The venv python.exe is a launcher; the real server is its child, so stop both.
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)"
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        if ($parent.Name -eq "python.exe") { Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue }
    }
}

if ($Status) {
    Get-ScheduledTask -TaskName $app, $bak -ErrorAction SilentlyContinue |
        Select-Object TaskName, State, @{ n = "LastRun"; e = { ($_ | Get-ScheduledTaskInfo).LastRunTime } }, @{ n = "LastResult"; e = { ($_ | Get-ScheduledTaskInfo).LastTaskResult } }
    return
}
if ($Restart) {
    if (-not (Get-ScheduledTask -TaskName $app -ErrorAction SilentlyContinue)) { throw "Not installed. Run with -Install first." }
    Stop-App
    Start-ScheduledTask -TaskName $app
    Write-Host "Restarted. It rebuilds the UI first if the code changed (log: logs\app.log)."
    return
}
if ($Uninstall) {
    Stop-App
    foreach ($t in $app, $bak) { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Host "Stopped the app and removed the $app tasks."
    return
}
if (-not $Install) { Get-Help $PSCommandPath; return }

if (-not (Test-Path "$root\.env")) { throw "Run .\start.ps1 once first: it creates .env, which you then fill in." }
New-Item -ItemType Directory -Force "$root\logs" | Out-Null
Stop-App

$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
# Task Scheduler's restart setting only covers a task that fails to launch, not an app that exits later,
# so the loop brings the app back after a crash.
$runApp = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"while (`$true) { & '$root\start.ps1' *>> '$root\logs\app.log'; Add-Content '$root\logs\app.log' ((Get-Date).ToString('s') + ' app exited, restarting in 10s'); Start-Sleep 10 }`""
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
