# Starts backend and frontend dev servers in separate PowerShell windows.
# Run from anywhere; paths are resolved relative to this script's own location.
$root = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
