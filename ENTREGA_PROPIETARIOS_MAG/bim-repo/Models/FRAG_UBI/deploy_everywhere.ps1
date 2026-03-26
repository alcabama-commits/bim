$source = "c:\Users\camilo.martinez\Documents\GitHub\bim\Models\docs\VSR_IFC"
$dest1 = "c:\Users\camilo.martinez\Documents\GitHub\bim\VSR_IFC"
$dest2 = "c:\Users\camilo.martinez\Documents\GitHub\bim\docs\VSR_IFC"

Write-Host "Starting deployment copy..."

# Ensure destinations exist
if (!(Test-Path $dest1)) { New-Item -ItemType Directory -Force -Path $dest1 | Out-Null }
if (!(Test-Path $dest2)) { New-Item -ItemType Directory -Force -Path $dest2 | Out-Null }

# Copy recursively
Copy-Item -Path "$source\*" -Destination $dest1 -Recurse -Force
Write-Host "Copied content to $dest1"

Copy-Item -Path "$source\*" -Destination $dest2 -Recurse -Force
Write-Host "Copied content to $dest2"

Write-Host "Deployment copy complete."
