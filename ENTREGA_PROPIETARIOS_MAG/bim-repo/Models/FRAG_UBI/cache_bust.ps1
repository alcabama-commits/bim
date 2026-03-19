
$path = "..\docs\VSR_IFC\index.html"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

# Regex to find the script src and append ?v=...
# Looking for src="./assets/main-DIT-zuZb.js"
$content = $content -replace 'src="\./assets/main-([^"]+)\.js"', 'src="./assets/main-$1.js?v=20260209-16"'

[System.IO.File]::WriteAllText($absPath, $content)
Write-Host "Applied cache bust to generated index.html"
