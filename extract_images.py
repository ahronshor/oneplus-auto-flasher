#!/usr/bin/env python3
import os
import tarfile
import shutil
from pathlib import Path

# Configuration
BASE_DIR = Path(__file__).parent.absolute()
TAR_DIR = BASE_DIR / "tar"
IMAGES_DIR = BASE_DIR / "images"

def extract_and_rename():
    # Ensure directories exist
    if not TAR_DIR.exists():
        print(f"Directory not found: {TAR_DIR}")
        return
    
    IMAGES_DIR.mkdir(exist_ok=True)
    
    print(f"Scanning {TAR_DIR} for tar files...")
    
    count = 0
    for tar_path in TAR_DIR.glob("*.tar"):
        try:
            print(f"Processing: {tar_path.name}")
            
            # Open tar file
            with tarfile.open(tar_path, "r") as tar:
                # Find the .img file inside
                img_member = None
                for member in tar.getmembers():
                    if member.name.endswith(".img"):
                        img_member = member
                        break
                
                if not img_member:
                    print(f"  [SKIPPED] No .img file found inside {tar_path.name}")
                    continue
                
                # Construct new filename based on tar filename
                # e.g., "my_rom.tar" -> "my_rom.img"
                new_filename = tar_path.stem + ".img"
                dest_path = IMAGES_DIR / new_filename
                
                # Check if already exists
                if dest_path.exists():
                    print(f"  [SKIPPED] {new_filename} already exists in images/")
                    continue
                
                # Extract directly to destination if possible (or extract temp then rename)
                # Tarfile extract doesn't support renaming on fly.
                # So we extract to temp, then move.
                print(f"  Extracting {img_member.name} -> {new_filename}...")
                
                tar.extract(img_member, path=BASE_DIR)
                extracted_file = BASE_DIR / img_member.name
                
                # Move to images dir with new name
                shutil.move(str(extracted_file), str(dest_path))
                print(f"  [SUCCESS] Created: {dest_path.name}")
                count += 1
                
        except Exception as e:
            print(f"  [ERROR] Failed to process {tar_path.name}: {e}")

    print("-" * 40)
    print(f"Done. Extracted {count} images.")

if __name__ == "__main__":
    extract_and_rename()
