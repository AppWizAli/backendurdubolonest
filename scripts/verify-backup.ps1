$ErrorActionPreference = 'Stop'
$file = $args[0]
if (-not $file -or -not (Test-Path -LiteralPath $file)) { throw 'Provide a PostgreSQL custom-format dump file' }
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $file
$expected = (Get-Content -Raw -LiteralPath "$file.sha256").Split(' ')[0]
if ($hash.Hash -ne $expected) { throw 'Backup checksum verification failed' }
pg_restore --list $file | Out-Null
Write-Output "Backup verified: $file"
