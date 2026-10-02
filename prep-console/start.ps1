# Start the Prep Console: set up if needed, build the UI if needed, then serve UI + API on http://localhost:5000
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$py = "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "Creating Python environment..."
    python -m venv backend\.venv
}
$stamp = "backend\.venv\.requirements-installed"
if (-not (Test-Path $stamp) -or (Get-Item backend\requirements.txt).LastWriteTime -gt (Get-Item $stamp).LastWriteTime) {
    Write-Host "Installing Python packages..."
    & $py -m pip install -q -r backend\requirements.txt
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
    New-Item -ItemType File -Force $stamp | Out-Null
}

if (-not (Test-Path .env)) {
    $key = & $py -c "import secrets; print(secrets.token_hex(32))"
    (Get-Content .env.example) -replace '^SECRET_KEY=$', "SECRET_KEY=$key" | Set-Content .env -Encoding UTF8
    Write-Host "Created .env with a fresh SECRET_KEY. Set ADMIN_EMAILS (and OAuth or DEV_LOGIN) in it, then run this again."
    exit 1
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
