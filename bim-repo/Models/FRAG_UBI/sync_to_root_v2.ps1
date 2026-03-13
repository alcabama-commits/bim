
$srcDir = "..\LocalViewer" # Relative to Models/FRAG_UBI -> Models/LocalViewer (Wait, FRAG_UBI and LocalViewer are siblings in Models)
# FRAG_UBI is in Models/FRAG_UBI. LocalViewer is in Models/LocalViewer.
# So ..\LocalViewer works.

$destDir = "..\..\VSR_IFC" # Relative to Models/FRAG_UBI -> Models -> Root -> VSR_IFC

# Ensure destination exists
if (!(Test-Path $destDir)) {
    Write-Host "Destination VSR_IFC does not exist at $destDir"
    # Try absolute path just in case
    $absDest = "C:\Users\camilo.martinez\Documents\GitHub\bim\VSR_IFC"
    if (Test-Path $absDest) {
        $destDir = $absDest
        Write-Host "Found at absolute path: $destDir"
    } else {
        Write-Host "Destination still not found!"
        exit 1
    }
}

# Copy main.ts
Copy-Item "$srcDir\src\main.ts" "$destDir\src\main.ts" -Force
Write-Host "Copied main.ts"

# Copy index.html
Copy-Item "$srcDir\index.html" "$destDir\index.html" -Force
Write-Host "Copied index.html"

# Copy style.css (just in case)
Copy-Item "$srcDir\src\style.css" "$destDir\src\style.css" -Force
Write-Host "Copied style.css"

# Copy vite.config.js (to ensure build config matches)
Copy-Item "$srcDir\vite.config.js" "$destDir\vite.config.js" -Force
Write-Host "Copied vite.config.js"

# Read index.html to confirm version
$html = Get-Content "$destDir\index.html" -Raw
if ($html -match "v17-EmergencyPatched") {
    Write-Host "Verification: index.html contains v17 tag"
} else {
    Write-Host "WARNING: index.html does NOT contain v17 tag"
}
