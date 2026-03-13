
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$old = "v2026-02-03-Fix-v12-FragMeasurement"
$new = "v2026-02-09-Fix-v13-BufferSafe"

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($absPath, $content)
    Write-Host "Updated version to $new"
} else {
    Write-Host "Could not find version string"
}
