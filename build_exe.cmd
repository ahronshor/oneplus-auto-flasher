@echo off
TITLE Build OnePlus Auto-Flasher EXE
echo ============================================================
echo Building auto_flash.exe for Windows...
echo ============================================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed.
    echo Please install Python to build the EXE.
    echo Once built, the EXE can run on any computer without Python.
    pause
    exit /b
)

REM Install PyInstaller
echo Installing PyInstaller...
pip install pyinstaller >nul 2>&1

REM Build the EXE
echo Building executable (this may take a minute)...
pyinstaller --onefile --name "auto_flash" --clean auto_flash.py

if exist "dist\auto_flash.exe" (
    echo.
    echo ============================================================
    echo SUCCESS! 
    echo The executable is ready at: dist\auto_flash.exe
    echo ============================================================
    echo You can now copy dist\auto_flash.exe to any Windows PC
    echo and run it without installing Python.
    echo.
    echo Moving file to main directory...
    copy /y "dist\auto_flash.exe" . >nul
    echo Done.
) else (
    echo [ERROR] Build failed. check the errors above.
)

pause
