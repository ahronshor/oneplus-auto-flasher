# OnePlus Auto-Flasher - Cross-Platform

## Overview
Automated script for flashing `init_boot.img` files to multiple OnePlus devices simultaneously.
Works on **Windows**, **Mac**, and **Linux**.

## Features
- ✅ Auto-detects devices via ADB and Fastboot
- ✅ Handles multiple devices in parallel
- ✅ Persistent device mapping (Serial → Model)
- ✅ Auto-downloads missing firmware from cloud
- ✅ Unlocks bootloader if needed
- ✅ Cross-platform (Python 3.7+)

## Requirements

### All Platforms
1. **Python 3.7 or higher**
   - Check: `python3 --version` or `python --version`
   - Download: https://www.python.org/downloads/

2. **ADB and Fastboot**
   - Windows: Download [Platform Tools](https://developer.android.com/studio/releases/platform-tools)
   - Mac: `brew install android-platform-tools`
   - Linux: `sudo apt install adb fastboot` (Ubuntu/Debian)

3. **USB Drivers** (Windows only)
   - Install OnePlus USB drivers from [OnePlus Support](https://www.oneplus.com/support)

## Installation

1. **Clone or download this repository**
   ```bash
   cd oneplus_flasher
   ```

2. **Verify ADB/Fastboot are in PATH**
   ```bash
   adb version
   fastboot --version
   ```

3. **Prepare your files**
   - Place `init_boot.img` files in `images/` folder
   - (Optional) Place full update ZIPs in `full/` folder

## Usage

### Windows (with Python)
```cmd
python auto_flash.py
```
Or double-click `auto_flash.py` if Python is associated.

### Windows (without Python - BAT version)
Simply **double-click** `auto_flash.bat`

Or from Command Prompt:
```cmd
auto_flash.bat
```

**Note**: BAT version requires Windows 10+ (for built-in `curl` and PowerShell).

### Mac / Linux
```bash
python3 auto_flash.py
```
Or make it executable:
```bash
chmod +x auto_flash.py
./auto_flash.py
```

## How It Works

1. **Connect Device(s)** via USB
2. **Script detects** device in ADB mode
3. **Identifies** model and version
4. **Searches** for matching `init_boot.img`
   - If found: Reboots to bootloader → Flashes → Reboots
   - If not found: Downloads from cloud → Pushes to device
5. **In Fastboot mode**: Unlocks bootloader (if needed) → Flashes image → Reboots

## File Structure
```
oneplus_flasher/
├── auto_flash.py          # Main script (Python - cross-platform)
├── auto_flash.bat         # Windows BAT version (no Python needed)
├── auto_flash.sh          # Legacy Unix/Mac script
├── images/                # Place init_boot.img files here
│   └── op_cph2719-EX01_1601300-0.0.4-93_init_boot.img
├── full/                  # Full update ZIPs (optional)
│   └── cph2719_16_01300.zip
├── serial_map.txt         # Auto-generated device mappings
├── device_map.txt         # Product codename → Model mapping
└── README.md              # This file
```

## Configuration Files

### `serial_map.txt`
Auto-generated. Maps device serial numbers to models:
```
TKOJONJJH6LB6PDE=CPH2719
ABC123XYZ=CPH2663
```

### `device_map.txt`
Manual mapping of product codenames to models (for ambiguous cases):
```
k6897v1_64=CPH2719
pineapple=CPH2663
pineapple=CPH2609
```

## Troubleshooting

### Windows: "python not found"
- Install Python from https://www.python.org/
- During installation, check "Add Python to PATH"

### Windows: "adb not found"
- Download Platform Tools
- Add to PATH: `set PATH=%PATH%;C:\path\to\platform-tools`

### Device not detected
- Enable USB Debugging in Developer Options
- Check "Authorize computer" prompt on device
- Try different USB cable/port

### Bootloader locked
- Script will prompt to unlock
- **WARNING**: Unlocking erases all data!
- Confirm on device screen

## Multi-Device Usage

Simply connect multiple devices. The script will:
1. Detect all connected devices
2. Process each one independently in parallel
3. Show logs with `[SERIAL]` prefix for each device

Example output:
```
[14:30:15] [ABC123] Processing in ADB mode...
[14:30:15] [XYZ789] Processing in Fastboot mode...
[14:30:16] [ABC123] Found matching image: op_cph2719.img
[14:30:16] [XYZ789] Flashing op_cph2663.img...
[14:30:17] [XYZ789] Flash SUCCESS! Rebooting...
```

## Advanced

### Cloud Repository
The script can auto-download from:
```
https://lomdaat-roms2.ams3.cdn.digitaloceanspaces.com/op/
```

To change the URL, edit `S3_BASE_URL` in `auto_flash.py`.

### Custom Timeout
For slow connections, increase download timeout:
```python
# Line ~265
timeout=600  # 10 minutes (default)
```

## Support

For issues:
1. Check device is authorized (`adb devices`)
2. Verify bootloader is unlocked (`fastboot getvar unlocked`)
3. Run with elevated permissions if needed (Windows: Run as Administrator)

## License
MIT
