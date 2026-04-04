@echo off
setlocal
chcp 65001 >nul

echo [run] Installing PyInstaller if needed...
python -m pip install --disable-pip-version-check --user pyinstaller
if errorlevel 1 (
  echo [fail] PyInstaller installation failed.
  exit /b 1
)

echo [run] Building CarDiaryAdmin.exe ...
python -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --onefile ^
  --windowed ^
  --name CarDiaryAdmin ^
  --distpath "%~dp0.." ^
  --workpath "%~dp0build" ^
  "%~dp0car_diary_admin.py"

if errorlevel 1 (
  echo [fail] Admin tool build failed.
  exit /b 1
)

echo [done] Built: %~dp0..\CarDiaryAdmin.exe
exit /b 0
