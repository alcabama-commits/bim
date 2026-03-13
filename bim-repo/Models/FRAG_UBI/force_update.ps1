
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$old = "v2026-02-09-Fix-v13-BufferSafe"
$new = "v2026-02-09-Fix-v14-BufferSafe-Force"

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($absPath, $content)
    Write-Host "Updated version to $new"
} else {
    Write-Host "Could not find version string $old"
    # Fallback search if exact string mismatch
    if ($content -match "v2026-02-09-Fix-v13") {
         $content = $content -replace "v2026-02-09-Fix-v13[^\']*", $new
         [System.IO.File]::WriteAllText($absPath, $content)
         Write-Host "Updated version to $new (regex match)"
    }
}
