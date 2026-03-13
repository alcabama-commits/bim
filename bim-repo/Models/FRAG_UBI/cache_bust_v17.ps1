
$path = "..\docs\VSR_IFC\index.html"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

# Update Title
$content = $content.Replace('<title>VSR IFC Viewer v16-RulerOnly</title>', '<title>VSR IFC Viewer v17-EmergencyPatched</title>')

# Update Meta
$content = $content.Replace('<meta name="version" content="v2026-02-09-Fix-v16-RulerOnly" />', '<meta name="version" content="v2026-02-09-Fix-v17-EmergencyPatched" />')

# Add query param to script
# src="./assets/main-DlBr8sxe.js"
$content = $content -replace 'src="\./assets/main-DlBr8sxe\.js"', 'src="./assets/main-DlBr8sxe.js?v=v17"'

[System.IO.File]::WriteAllText($absPath, $content)
Write-Host "Updated index.html to v17"
