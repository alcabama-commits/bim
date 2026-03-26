
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

# Regex to find the version string assignment
# v.innerText = '...'
$pattern = "v\.innerText\s*=\s*'[^']+'"
$replacement = "v.innerText = 'v2026-02-09-Fix-v17-EmergencyPatched'"

if ($content -match $pattern) {
    $content = $content -replace $pattern, $replacement
    [System.IO.File]::WriteAllText($absPath, $content)
    Write-Host "Updated version label in main.ts"
} else {
    Write-Host "Could not find version label pattern in main.ts"
    # Fallback: try to find the specific v1.9.9 string if regex failed
    if ($content.Contains("v1.9.9")) {
        $content = $content.Replace("v1.9.9 (Multi-selección Ctrl)", "v2026-02-09-Fix-v17-EmergencyPatched")
        [System.IO.File]::WriteAllText($absPath, $content)
        Write-Host "Updated version label using string replacement"
    }
}
