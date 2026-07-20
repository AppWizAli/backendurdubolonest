$ErrorActionPreference = 'Stop'

$backendRoot = 'E:\Company projects Work\urdubolo-secure-backend nest js'
$panelRoot = 'E:\Company projects Work\urdubolo-secure-backend nest js\Urrrdu Bolo Panle'
$redisExe = 'C:\Users\SamTech\AppData\Local\Temp\urdubolo-redis\bin\redis-server.exe'

function Test-Port($port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-Port 6379)) {
  if (-not (Test-Path -LiteralPath $redisExe)) {
    throw "Redis is not installed at $redisExe"
  }
  Start-Process -FilePath $redisExe -ArgumentList '--port 6379 --bind 127.0.0.1 --save "" --appendonly no' -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

if (-not (Test-Port 3200)) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start' -WorkingDirectory $backendRoot -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

if (-not (Test-Port 3100)) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev', '--', '--port', '3100' -WorkingDirectory $panelRoot -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

Start-Process 'http://localhost:3100/login'
Write-Host 'Urdu Bolo is running at http://localhost:3100/login'
