# Первичная загрузка справочников и статистики.
# Пароль передаётся через DATABASE_URL и в файл не записывается.
#
#   $env:DATABASE_URL = "postgresql://пользователь:пароль@хост:5432/srp"
#   .\scripts\pg-directory\load-initial.ps1

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
    throw "Set DATABASE_URL. Example: postgresql://user:password@host:5432/srp"
}

$dump = Join-Path $PSScriptRoot "initial-external.sql"
if (-not (Test-Path $dump)) {
    throw "Missing $dump"
}

$psql = $null
$command = Get-Command psql -ErrorAction SilentlyContinue
if ($command) {
    $psql = $command.Source
} else {
    $bundled = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
    if (Test-Path $bundled) {
        $psql = $bundled
    }
}
if ($psql) {
    & $psql --dbname=$env:DATABASE_URL -v ON_ERROR_STOP=1 -f $dump
} else {
    docker run --rm -v "${dump}:/dump.sql:ro" postgres:16 psql --dbname=$env:DATABASE_URL -v ON_ERROR_STOP=1 -f /dump.sql
}
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}