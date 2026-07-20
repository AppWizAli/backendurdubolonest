$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) { throw 'DATABASE_URL is required' }
$file = $args[0]
if (-not $file -or -not (Test-Path -LiteralPath $file)) { throw 'Provide a verified PostgreSQL custom-format dump file' }
if ($env:CONFIRM_RESTORE -ne 'YES') { throw 'Set CONFIRM_RESTORE=YES to restore a database' }
pg_restore --list $file | Out-Null
pg_restore --dbname=$env:DATABASE_URL --clean --if-exists --no-owner --no-privileges $file
Write-Output 'Restore completed. Run prisma migrate deploy and readiness checks before accepting traffic.'
