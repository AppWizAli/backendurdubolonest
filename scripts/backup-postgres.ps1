$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) { throw 'DATABASE_URL is required' }
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { 'var/backups' }
$retentionDays = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 14 }
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$file = Join-Path $backupDir "urdubolo-$timestamp.dump"
pg_dump --dbname=$env:DATABASE_URL --format=custom --no-owner --no-privileges --file=$file
(Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash + "  $file" | Set-Content -NoNewline "$file.sha256"
Get-ChildItem -LiteralPath $backupDir -Filter 'urdubolo-*.dump' | Where-Object { $_.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-$retentionDays) } | Remove-Item -Force
Get-ChildItem -LiteralPath $backupDir -Filter 'urdubolo-*.dump.sha256' | Where-Object { $_.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-$retentionDays) } | Remove-Item -Force
Write-Output $file
