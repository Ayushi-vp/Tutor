# Start the Prep Console: build the UI if needed, then serve UI + API on http://localhost:5000
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$py = "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "Creating Python environment..."
    python -m venv backend\.venv
    & $py -m pip install -q -r backend\requirements.txt
}

$dist = "frontend\dist\index.html"
$newest = Get-ChildItem frontend\src, content -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not (Test-Path $dist) -or $newest.LastWriteTime -gt (Get-Item $dist).LastWriteTime) {
    Write-Host "Building the frontend..."
    Push-Location frontend
    if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund }
    npm run build
    Pop-Location
}

& $py backend\app.py
