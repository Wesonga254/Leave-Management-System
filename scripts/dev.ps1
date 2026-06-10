$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "Starting Leave Management backend and frontend..." -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000" -ForegroundColor DarkCyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor DarkCyan
Write-Host "Two terminal windows will open. Close them to stop the app." -ForegroundColor DarkGray

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location -LiteralPath '$backend'; npm run dev"
)

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location -LiteralPath '$frontend'; npm start"
)
