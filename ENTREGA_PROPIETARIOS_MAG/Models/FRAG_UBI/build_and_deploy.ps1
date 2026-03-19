$localViewerPath = "c:\Users\camilo.martinez\Documents\GitHub\bim\Models\LocalViewer"
$fragUbiPath = "c:\Users\camilo.martinez\Documents\GitHub\bim\Models\FRAG_UBI"

Write-Host "Starting Build..."
Set-Location $localViewerPath
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

Write-Host "Build Complete. Starting Deployment..."
Set-Location $fragUbiPath
./deploy_everywhere.ps1
