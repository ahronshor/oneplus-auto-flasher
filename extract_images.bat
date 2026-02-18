@echo off
TITLE OnePlus Image Extractor
echo ============================================================
echo Extracting boot images from TAR files...
echo ============================================================

python "%~dp0extract_images.py"

if %errorlevel% neq 0 (
    echo [ERROR] Python script failed.
    pause
) else (
    echo.
    echo Done! Check the 'images' folder.
    timeout /t 5
)
