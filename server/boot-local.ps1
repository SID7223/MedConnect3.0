# Boots the Ktor server locally against Neon.
# Credentials come from ..\.env.local (vercel env pull + local JWT_SECRET).
# Usage:  powershell -ExecutionPolicy Bypass -File server\boot-local.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) { throw "Missing $envFile - run: vercel env pull" }

Get-Content $envFile | Where-Object { $_ -match '^(DATABASE_URL|JWT_SECRET)=' } | ForEach-Object {
    $key, $value = $_.Split('=', 2)
    if ($value -notmatch 'SENSITIVE') {
        Set-Item -Path "env:$key" -Value $value.Trim('"')
    }
}

if (-not $env:DATABASE_URL -or $env:DATABASE_URL -match 'SENSITIVE') { throw 'DATABASE_URL not set in .env.local' }
if (-not $env:JWT_SECRET -or $env:JWT_SECRET -match 'SENSITIVE') { throw 'JWT_SECRET not set in .env.local' }

Set-Location $PSScriptRoot
& cmd /c ".\gradlew.bat run --console=plain > run-out.txt 2>&1"
