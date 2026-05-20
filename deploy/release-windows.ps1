# Полный релиз с ПК: desktop (иконки + exe) → затем инструкция для сервера.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "==> Desktop: icons + installer with production URL"
& "$PSScriptRoot\build-desktop.ps1"

Write-Host ""
Write-Host "==> Дальше на сервере (SSH):"
Write-Host "  cd /path/to/messenger"
Write-Host "  git pull   # или залейте файлы, включая frontend/public/downloads/Signal-Desktop-Setup.exe"
Write-Host "  bash deploy/update.sh"
Write-Host ""
Write-Host "На этом ПК после установки удалите старый ярлык и поставьте заново из нового Setup.exe"
