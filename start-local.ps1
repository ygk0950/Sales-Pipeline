$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = "C:\Users\DELL\anaconda3\python.exe"
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path $python)) {
  throw "Python not found at $python"
}

Start-Process -FilePath $python -ArgumentList @("-m", "uvicorn", "app.main:app", "--port", "8001") -WorkingDirectory $backendDir
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "localhost") -WorkingDirectory $frontendDir

Start-Sleep -Seconds 5
Write-Host "Backend: http://localhost:8001"
Write-Host "Frontend: http://localhost:5173"
