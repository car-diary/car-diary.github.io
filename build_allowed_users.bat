@echo off
setlocal
chcp 65001 >nul

echo [run] Building allowed users from tools\allowed_vehicle_ids.txt
python "%~dp0tools\build_allowed_users.py"
if errorlevel 1 (
  echo [fail] allowed users build failed.
  exit /b 1
)

echo [done] allowed users build completed.
exit /b 0
