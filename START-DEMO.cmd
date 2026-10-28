@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang Node.js 22 atau lebih baru, lalu coba lagi.
  pause
  exit /b 1
)
if not exist node_modules\express (
  call npm.cmd ci
  if errorlevel 1 (
    echo Instalasi gagal. Periksa koneksi internet lalu jalankan kembali.
    pause
    exit /b 1
  )
)
echo Buka http://127.0.0.1:3100 di browser setelah server siap.
echo Tekan Ctrl+C untuk menghentikan demo.
call npm.cmd run demo
pause
