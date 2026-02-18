#!/usr/bin/env python3
"""
OnePlus Multi-Device Auto-Flasher
Cross-platform script for Windows, Mac, and Linux
"""

import subprocess
import time
import os
import sys
import threading
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Set
import urllib.request
import urllib.error

# ============================================================================
# CONFIGURATION
# ============================================================================
BASE_DIR = Path(__file__).parent.absolute()
IMAGES_DIR = BASE_DIR / "images"
FULL_DIR = BASE_DIR / "full"
SERIAL_MAP_FILE = BASE_DIR / "serial_map.txt"
DEVICE_MAP_FILE = BASE_DIR / "device_map.txt"
S3_BASE_URL = "https://lomdaat-roms2.ams3.cdn.digitaloceanspaces.com/op"

# Thread-safe locks
device_locks: Dict[str, threading.Lock] = {}
locks_mutex = threading.Lock()
map_file_lock = threading.RLock()

# Track processed devices to avoid log spam
processed_devices: Set[str] = set()

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def log(serial: str, message: str):
    """Thread-safe logging with timestamp and serial prefix"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{serial}] {message}", flush=True)


def run_command(cmd: List[str], timeout: int = 10) -> tuple:
    """
    Run command and return (stdout, stderr, returncode)
    Cross-platform subprocess execution
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "Timeout", -1
    except FileNotFoundError:
        return "", f"Command not found: {cmd[0]}", -1
    except Exception as e:
        return "", str(e), -1


def acquire_device_lock(serial: str) -> Optional[threading.Lock]:
    """
    Acquire lock for a specific device serial
    Returns Lock object if acquired, None if already locked
    """
    with locks_mutex:
        if serial not in device_locks:
            device_locks[serial] = threading.Lock()
        
        lock = device_locks[serial]
        acquired = lock.acquire(blocking=False)
        
        if acquired:
            return lock
        else:
            return None


def release_device_lock(serial: str, lock: threading.Lock):
    """Release device lock"""
    try:
        lock.release()
    except:
        pass


def read_serial_map() -> Dict[str, str]:
    """Read serial -> model mapping from file"""
    mapping = {}
    if SERIAL_MAP_FILE.exists():
        with map_file_lock:
            try:
                with open(SERIAL_MAP_FILE, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if '=' in line:
                            serial, model = line.split('=', 1)
                            mapping[serial] = model
            except:
                pass
    return mapping


def save_serial_mapping(serial: str, model: str):
    """Save serial -> model mapping to file"""
    with map_file_lock:
        # Read existing mappings
        mappings = read_serial_map()
        # Update
        mappings[serial] = model
        # Write back
        try:
            with open(SERIAL_MAP_FILE, 'w') as f:
                for s, m in mappings.items():
                    f.write(f"{s}={m}\n")
        except Exception as e:
            log(serial, f"Failed to save mapping: {e}")


def read_device_map() -> Dict[str, List[str]]:
    """Read product -> models mapping from device_map.txt"""
    mapping = {}
    if DEVICE_MAP_FILE.exists():
        try:
            with open(DEVICE_MAP_FILE, 'r') as f:
                for line in f:
                    line = line.strip()
                    if '=' in line:
                        product, model = line.split('=', 1)
                        if product not in mapping:
                            mapping[product] = []
                        mapping[product].append(model)
        except:
            pass
    return mapping


# ============================================================================
# ADB/FASTBOOT FUNCTIONS
# ============================================================================

def get_adb_devices() -> List[str]:
    """Get list of device serials connected via ADB"""
    stdout, _, _ = run_command(['adb', 'devices'])
    devices = []
    for line in stdout.split('\n'):
        if '\tdevice' in line:  # Authorized devices
            serial = line.split('\t')[0].strip()
            if serial:
                devices.append(serial)
    return devices


def get_fastboot_devices() -> List[str]:
    """Get list of device serials in Fastboot mode"""
    stdout, _, _ = run_command(['fastboot', 'devices'])
    devices = []
    for line in stdout.split('\n'):
        if 'fastboot' in line:
            parts = line.split()
            if parts:
                devices.append(parts[0].strip())
    return devices


def adb_get_prop(serial: str, prop: str) -> str:
    """Get device property via ADB"""
    stdout, _, returncode = run_command(['adb', '-s', serial, 'shell', 'getprop', prop], timeout=5)
    if returncode == 0:
        return stdout.strip()
    return ""


def fastboot_getvar(serial: str, var: str) -> str:
    """Get fastboot variable"""
    stdout, stderr, _ = run_command(['fastboot', '-s', serial, 'getvar', var], timeout=5)
    # Fastboot outputs to stderr
    combined = stdout + stderr
    for line in combined.split('\n'):
        if f"{var}:" in line:
            return line.split(':', 1)[1].strip()
    return ""


# ============================================================================
# DEVICE PROCESSING WORKERS
# ============================================================================

def process_adb_device(serial: str):
    """Process device in ADB mode"""
    lock = acquire_device_lock(serial)
    if not lock:
        return  # Already being processed
    
    try:
        log(serial, "Processing in ADB mode...")
        
        # Get model
        model = adb_get_prop(serial, 'ro.product.model')
        if not model:
            log(serial, "Could not read model (unauthorized?)")
            return
        
        log(serial, f"Identified Model: {model}")
        
        # Save mapping
        save_serial_mapping(serial, model)
        
        # Get version
        version_display = adb_get_prop(serial, 'persist.sys.oplus.ota_ver_display')
        version_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', version_display)
        
        if not version_match:
            log(serial, "Could not determine version")
            return
        
        version = version_match.group(1)
        clean_version = version.replace('.', '')
        
        log(serial, f"Version: {version} ({clean_version})")
        
        # Search for matching image
        matching_image = None
        if IMAGES_DIR.exists():
            for img_file in IMAGES_DIR.glob('*.img'):
                if model.upper() in img_file.name.upper() and clean_version in img_file.name:
                    matching_image = img_file
                    break
        
        if matching_image:
            log(serial, f"Found matching image: {matching_image.name}")
            log(serial, "Rebooting to bootloader...")
            run_command(['adb', '-s', serial, 'reboot', 'bootloader'])
            # Release lock immediately so Fastboot can pick it up
            release_device_lock(serial, lock)
            return
        
        # No local image, try cloud
        log(serial, "No matching local image. Searching cloud...")
        lower_model = model.lower()
        ver_head = clean_version[:2]
        ver_tail = clean_version[2:]
        
        candidates = [
            f"{lower_model}_{ver_head}_{ver_tail}.zip",
            f"{lower_model}_{clean_version}.zip",
            f"{lower_model}_{ver_tail}.zip"
        ]
        
        found_url = None
        found_name = None
        
        for candidate in candidates:
            url = f"{S3_BASE_URL}/{candidate}"
            try:
                req = urllib.request.Request(url, method='HEAD')
                response = urllib.request.urlopen(req, timeout=10)
                if response.status == 200:
                    found_url = url
                    found_name = candidate
                    break
            except:
                continue
        
        if found_url:
            log(serial, f"Found update on cloud: {found_name}")
            log(serial, "Downloading...")
            
            FULL_DIR.mkdir(exist_ok=True)
            local_file = FULL_DIR / found_name
            
            try:
                urllib.request.urlretrieve(found_url, local_file)
                log(serial, "Download complete. Pushing to /sdcard/...")
                
                stdout, stderr, returncode = run_command([
                    'adb', '-s', serial, 'push', str(local_file), '/sdcard/'
                ], timeout=600)  # 10 min timeout for large files
                
                if returncode == 0:
                    log(serial, "Push complete! Install via Settings -> Local Install")
                else:
                    log(serial, f"Push failed: {stderr}")
            except Exception as e:
                log(serial, f"Download/Push failed: {e}")
        else:
            log(serial, "No update found on server")
    
    finally:
        release_device_lock(serial, lock)


def process_fastboot_device(serial: str):
    """Process device in Fastboot mode"""
    lock = acquire_device_lock(serial)
    if not lock:
        return  # Already being processed
    
    try:
        log(serial, "Processing in Fastboot mode...")
        
        # Try to identify model
        detected_model = None
        
        # 1. Check serial map
        serial_map = read_serial_map()
        if serial in serial_map:
            detected_model = serial_map[serial]
            log(serial, f"Recognized from serial map: {detected_model}")
        
        # 2. Check product codename
        if not detected_model:
            product = fastboot_getvar(serial, 'product')
            if product:
                device_map = read_device_map()
                if product in device_map:
                    models = device_map[product]
                    if len(models) == 1:
                        detected_model = models[0]
                        # Auto-save
                        save_serial_mapping(serial, detected_model)
                    elif len(models) > 1:
                        log(serial, f"AMBIGUOUS ({product}). Multiple models possible: {', '.join(models)}")
                        log(serial, "Please identify via ADB first or update mapping manually")
                        return
        
        if not detected_model:
            log(serial, "Unknown model. Please connect via ADB first")
            return
        
        log(serial, f"Model: {detected_model}")
        
        # Check unlock status
        unlocked = fastboot_getvar(serial, 'unlocked')
        
        if unlocked == 'no':
            log(serial, "Bootloader LOCKED. Requesting unlock...")
            run_command(['fastboot', '-s', serial, 'flashing', 'unlock'])
            log(serial, "PLEASE CONFIRM UNLOCK ON DEVICE SCREEN!")
            time.sleep(10)
            return
        
        if unlocked == 'yes':
            # Find image
            image_file = None
            if IMAGES_DIR.exists():
                for img in IMAGES_DIR.glob('*.img'):
                    if detected_model.upper() in img.name.upper():
                        image_file = img
                        break
            
            if image_file:
                log(serial, f"Flashing {image_file.name}...")
                stdout, stderr, returncode = run_command([
                    'fastboot', '-s', serial, 'flash', 'init_boot', str(image_file)
                ])
                
                if returncode == 0:
                    log(serial, "Flash SUCCESS! Rebooting...")
                    run_command(['fastboot', '-s', serial, 'reboot'])
                    time.sleep(10)
                else:
                    log(serial, f"Flash FAILED: {stderr}")
            else:
                log(serial, f"No image found for {detected_model}")
    
    finally:
        release_device_lock(serial, lock)


# ============================================================================
# MAIN DISPATCHER LOOP
# ============================================================================

def main():
    """Main loop - scan for devices and spawn workers"""
    print("="*60)
    print("OnePlus Multi-Device Auto-Flasher (Cross-Platform)")
    print("="*60)
    print("Logs will appear below with [SERIAL] prefix.")
    print("-"*60)
    
    # Start ADB server
    run_command(['adb', 'start-server'])
    
    # Ensure directories exist
    IMAGES_DIR.mkdir(exist_ok=True)
    FULL_DIR.mkdir(exist_ok=True)
    
    while True:
        try:
            # Get ADB devices
            adb_devices = get_adb_devices()
            for serial in adb_devices:
                # Spawn worker thread
                thread = threading.Thread(target=process_adb_device, args=(serial,), daemon=True)
                thread.start()
            
            # Get Fastboot devices
            fastboot_devices = get_fastboot_devices()
            for serial in fastboot_devices:
                # Spawn worker thread
                thread = threading.Thread(target=process_fastboot_device, args=(serial,), daemon=True)
                thread.start()
            
            # Wait before next scan
            time.sleep(2)
        
        except KeyboardInterrupt:
            print("\n\nShutting down...")
            sys.exit(0)
        except Exception as e:
            print(f"Error in main loop: {e}")
            time.sleep(2)


if __name__ == "__main__":
    main()
