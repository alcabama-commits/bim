
$path = "..\LocalViewer\index.html"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$content = $content.Replace('<meta name="version" content="1.8.0-pink-selection" />', '<meta name="version" content="v2026-02-09-Fix-v16-RulerOnly" />')
$content = $content.Replace('<title>VSR IFC Viewer v1.9-SnapFix</title>', '<title>VSR IFC Viewer v16-RulerOnly</title>')

[System.IO.File]::WriteAllText($absPath, $content)
Write-Host "Updated index.html source"
