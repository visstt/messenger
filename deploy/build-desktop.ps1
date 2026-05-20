# Сборка Windows-установщика с URL продакшена (запуск на Windows перед деплоем).
$ErrorActionPreference = "Stop"
$ProductionUrl = "https://chat.5-35-88-205.sslip.io"

$DesktopDir = Join-Path $PSScriptRoot ".." "desktop"
Push-Location $DesktopDir
try {
  $env:MESSENGER_URL = $ProductionUrl
  npm run release
  Write-Host "OK: installer → frontend/public/downloads/Signal-Desktop-Setup.exe"
  Write-Host "Залейте на сервер и выполните: bash deploy/update.sh"
}
finally {
  Pop-Location
}
