
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$old = "v2026-02-09-Fix-v15-VectorSafe"
$new = "v2026-02-09-Fix-v16-RulerOnly"

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($absPath, $content)
    Write-Host "Updated version to $new"
} else {
    Write-Host "Could not find version string $old"
    # Fallback
    if ($content -match "v2026-02-09-Fix-v15") {
         $content = $content -replace "v2026-02-09-Fix-v15[^\']*", $new
         [System.IO.File]::WriteAllText($absPath, $content)
         Write-Host "Updated version to $new (regex)"
    }
}
