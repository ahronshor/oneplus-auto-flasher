@echo off
REM ============================================================================
REM OnePlus Auto-Flasher for Windows (BAT version)
REM Works without Python - uses native Windows commands
REM ============================================================================

setlocal enabledelayedexpansion

REM Get script directory
set "BASE_DIR=%~dp0"
set "IMAGES_DIR=%BASE_DIR%images"
set "FULL_DIR=%BASE_DIR%full"
set "SERIAL_MAP=%BASE_DIR%serial_map.txt"
set "DEVICE_MAP=%BASE_DIR%device_map.txt"
set "S3_BASE_URL=https://lomdaat-roms2.ams3.cdn.digitaloceanspaces.com/op"

REM Create directories if they don't exist
if not exist "%IMAGES_DIR%" mkdir "%IMAGES_DIR%"
if not exist "%FULL_DIR%" mkdir "%FULL_DIR%"

echo ============================================================
echo OnePlus Auto-Flasher for Windows
echo ============================================================
echo Logs will appear below with [SERIAL] prefix
echo ------------------------------------------------------------
echo.

REM Start ADB server
echo Starting ADB server...
adb start-server >nul 2>&1

:MAIN_LOOP
    REM Check for ADB devices
    for /f "tokens=1" %%s in ('adb devices ^| findstr /r "device$"') do (
        call :PROCESS_ADB_DEVICE %%s
    )
    
    REM Check for Fastboot devices
    for /f "tokens=1" %%s in ('fastboot devices ^| findstr "fastboot"') do (
        call :PROCESS_FASTBOOT_DEVICE %%s
    )
    
    REM Wait before next scan
    timeout /t 2 /nobreak >nul
    goto MAIN_LOOP

REM ============================================================================
REM FUNCTIONS
REM ============================================================================

:LOG
    REM Usage: call :LOG serial message
    for /f "tokens=1-3 delims=:." %%a in ("%time%") do set "timestamp=%%a:%%b:%%c"
    echo [!timestamp!] [%~1] %~2
    exit /b

:PROCESS_ADB_DEVICE
    set "SERIAL=%~1"
    
    call :LOG %SERIAL% "Processing in ADB mode..."
    
    REM Get model
    for /f "delims=" %%m in ('adb -s %SERIAL% shell getprop ro.product.model 2^>nul') do set "MODEL=%%m"
    set "MODEL=!MODEL: =!"
    
    if "!MODEL!"=="" (
        call :LOG %SERIAL% "Could not read model (unauthorized?)"
        exit /b
    )
    
    call :LOG %SERIAL% "Identified Model: !MODEL!"
    
    REM Save mapping
    call :SAVE_SERIAL_MAPPING %SERIAL% !MODEL!
    
    REM Get version
    for /f "delims=" %%v in ('adb -s %SERIAL% shell getprop persist.sys.oplus.ota_ver_display 2^>nul') do set "VERSION_DISPLAY=%%v"
    
    REM Extract version number (e.g., 16.0.1.300)
    for /f "tokens=1 delims= " %%v in ("!VERSION_DISPLAY!") do set "VERSION=%%v"
    
    REM Remove dots for file matching
    set "CLEAN_VERSION=!VERSION:.=!"
    
    call :LOG %SERIAL% "Version: !VERSION! (!CLEAN_VERSION!)"
    
    REM Search for matching image
    set "MATCHING_IMAGE="
    for %%f in ("%IMAGES_DIR%\*.img") do (
        set "filename=%%~nxf"
        echo !filename! | findstr /i "!MODEL!" >nul
        if !errorlevel! equ 0 (
            echo !filename! | findstr "!CLEAN_VERSION!" >nul
            if !errorlevel! equ 0 (
                set "MATCHING_IMAGE=%%f"
                goto :FOUND_IMAGE
            )
        )
    )
    
    :FOUND_IMAGE
    if not "!MATCHING_IMAGE!"=="" (
        for %%f in ("!MATCHING_IMAGE!") do set "IMAGE_NAME=%%~nxf"
        call :LOG %SERIAL% "Found matching image: !IMAGE_NAME!"
        call :LOG %SERIAL% "Rebooting to bootloader..."
        adb -s %SERIAL% reboot bootloader
        exit /b
    )
    
    REM No local image - try cloud
    call :LOG %SERIAL% "No matching local image. Searching cloud..."
    
    REM Convert model to lowercase
    for %%L in (a b c d e f g h i j k l m n o p q r s t u v w x y z) do (
        set "LOWER_MODEL=!MODEL:%%L=%%L!"
    )
    call :LOWERCASE LOWER_MODEL !MODEL!
    
    REM Build version parts
    set "VER_HEAD=!CLEAN_VERSION:~0,2!"
    set "VER_TAIL=!CLEAN_VERSION:~2!"
    
    REM Try different filename patterns
    set "FOUND_URL="
    call :CHECK_CLOUD_FILE "!LOWER_MODEL!_!VER_HEAD!_!VER_TAIL!.zip" FOUND_URL
    if not "!FOUND_URL!"=="" goto :DOWNLOAD_FROM_CLOUD
    
    call :CHECK_CLOUD_FILE "!LOWER_MODEL!_!CLEAN_VERSION!.zip" FOUND_URL
    if not "!FOUND_URL!"=="" goto :DOWNLOAD_FROM_CLOUD
    
    call :CHECK_CLOUD_FILE "!LOWER_MODEL!_!VER_TAIL!.zip" FOUND_URL
    if not "!FOUND_URL!"=="" goto :DOWNLOAD_FROM_CLOUD
    
    call :LOG %SERIAL% "No update found on server"
    exit /b
    
    :DOWNLOAD_FROM_CLOUD
    for %%f in ("!FOUND_URL!") do set "ZIP_NAME=%%~nxf"
    call :LOG %SERIAL% "Found on cloud: !ZIP_NAME!"
    call :LOG %SERIAL% "Downloading..."
    
    set "LOCAL_ZIP=%FULL_DIR%\!ZIP_NAME!"
    
    REM Download using PowerShell (works on all Windows 10+)
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!FOUND_URL!' -OutFile '!LOCAL_ZIP!' }" >nul 2>&1
    
    if exist "!LOCAL_ZIP!" (
        call :LOG %SERIAL% "Download complete. Pushing to /sdcard/..."
        adb -s %SERIAL% push "!LOCAL_ZIP!" /sdcard/ >nul 2>&1
        if !errorlevel! equ 0 (
            call :LOG %SERIAL% "Push complete! Install via Settings -^> Local Install"
        ) else (
            call :LOG %SERIAL% "Push failed"
        )
    ) else (
        call :LOG %SERIAL% "Download failed"
    )
    
    exit /b

:PROCESS_FASTBOOT_DEVICE
    set "SERIAL=%~1"
    
    call :LOG %SERIAL% "Processing in Fastboot mode..."
    
    REM Get model from serial map
    set "DETECTED_MODEL="
    call :READ_SERIAL_MAPPING %SERIAL% DETECTED_MODEL
    
    if "!DETECTED_MODEL!"=="" (
        REM Try to get product codename
        for /f "tokens=2" %%p in ('fastboot -s %SERIAL% getvar product 2^>^&1 ^| findstr "product:"') do set "PRODUCT=%%p"
        
        if not "!PRODUCT!"=="" (
            REM Check device map
            call :READ_DEVICE_MAP !PRODUCT! DETECTED_MODEL
        )
    )
    
    if "!DETECTED_MODEL!"=="" (
        call :LOG %SERIAL% "Unknown model. Please connect via ADB first"
        exit /b
    )
    
    call :LOG %SERIAL% "Model: !DETECTED_MODEL!"
    
    REM Check unlock status
    for /f "tokens=2" %%u in ('fastboot -s %SERIAL% getvar unlocked 2^>^&1 ^| findstr "unlocked:"') do set "UNLOCKED=%%u"
    
    if "!UNLOCKED!"=="no" (
        call :LOG %SERIAL% "Bootloader LOCKED. Requesting unlock..."
        fastboot -s %SERIAL% flashing unlock
        call :LOG %SERIAL% "PLEASE CONFIRM UNLOCK ON DEVICE SCREEN!"
        timeout /t 10 /nobreak >nul
        exit /b
    )
    
    if "!UNLOCKED!"=="yes" (
        REM Find image file
        set "IMAGE_FILE="
        for %%f in ("%IMAGES_DIR%\*.img") do (
            set "filename=%%~nxf"
            echo !filename! | findstr /i "!DETECTED_MODEL!" >nul
            if !errorlevel! equ 0 (
                set "IMAGE_FILE=%%f"
                goto :FOUND_FLASH_IMAGE
            )
        )
        
        :FOUND_FLASH_IMAGE
        if not "!IMAGE_FILE!"=="" (
            for %%f in ("!IMAGE_FILE!") do set "IMAGE_NAME=%%~nxf"
            call :LOG %SERIAL% "Flashing !IMAGE_NAME!..."
            
            fastboot -s %SERIAL% flash init_boot "!IMAGE_FILE!" >nul 2>&1
            if !errorlevel! equ 0 (
                call :LOG %SERIAL% "Flash SUCCESS! Rebooting..."
                fastboot -s %SERIAL% reboot >nul 2>&1
                timeout /t 10 /nobreak >nul
            ) else (
                call :LOG %SERIAL% "Flash FAILED"
            )
        ) else (
            call :LOG %SERIAL% "No image found for !DETECTED_MODEL!"
        )
    )
    
    exit /b

:SAVE_SERIAL_MAPPING
    set "SER=%~1"
    set "MDL=%~2"
    
    REM Remove old mapping if exists
    if exist "%SERIAL_MAP%" (
        findstr /v /b /c:"%SER%=" "%SERIAL_MAP%" > "%SERIAL_MAP%.tmp"
        move /y "%SERIAL_MAP%.tmp" "%SERIAL_MAP%" >nul 2>&1
    )
    
    REM Append new mapping
    echo %SER%=%MDL% >> "%SERIAL_MAP%"
    exit /b

:READ_SERIAL_MAPPING
    set "SER=%~1"
    if exist "%SERIAL_MAP%" (
        for /f "tokens=1,2 delims==" %%a in ('findstr /b /c:"%SER%=" "%SERIAL_MAP%"') do (
            set "%~2=%%b"
        )
    )
    exit /b

:READ_DEVICE_MAP
    set "PROD=%~1"
    if exist "%DEVICE_MAP%" (
        for /f "tokens=1,2 delims==" %%a in ('findstr /b /c:"%PROD%=" "%DEVICE_MAP%"') do (
            set "%~2=%%b"
        )
    )
    exit /b

:CHECK_CLOUD_FILE
    set "filename=%~1"
    set "url=%S3_BASE_URL%/%filename%"
    
    REM Use PowerShell to check if file exists (HEAD request)
    powershell -Command "& {try {$r = Invoke-WebRequest -Uri '%url%' -Method Head -ErrorAction SilentlyContinue; if($r.StatusCode -eq 200){exit 0}}catch{exit 1}}" >nul 2>&1
    
    if !errorlevel! equ 0 (
        set "%~2=%url%"
    )
    exit /b

:LOWERCASE
    set "str=%~2"
    for %%L in (A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z) do (
        set "str=!str:%%L=%%M!"
    )
    set "%~1=!str!"
    exit /b
