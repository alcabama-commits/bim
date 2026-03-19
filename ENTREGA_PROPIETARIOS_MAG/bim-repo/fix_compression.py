
import os
import gzip
import shutil

models_dir = 'VSR_IFC/public/models'

print(f"Checking models in {models_dir}...")

for filename in os.listdir(models_dir):
    if filename.endswith('.frag'):
        filepath = os.path.join(models_dir, filename)
        
        with open(filepath, 'rb') as f:
            header = f.read(2)
        
        # Check for GZIP magic number (1f 8b)
        if header == b'\x1f\x8b':
            print(f"[OK] {filename} is already gzipped.")
        else:
            print(f"[FIX] {filename} is NOT gzipped. Compressing...")
            
            # Read original content
            with open(filepath, 'rb') as f:
                data = f.read()
            
            # Write compressed content back to the same file
            with gzip.open(filepath, 'wb') as f:
                f.write(data)
            
            print(f"      Compressed {filename}")

print("Done.")
