
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$old = @"
const originalGetX = THREE.BufferAttribute.prototype.getX;
THREE.BufferAttribute.prototype.getX = function(index) {
    // Safety check: if array is missing or index is out of bounds
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetX.call(this, index);
    } catch (e) {
        return 0;
    }
};
"@

$new = @"
const originalGetX = THREE.BufferAttribute.prototype.getX;
THREE.BufferAttribute.prototype.getX = function(index) {
    // Safety check: if array is missing or index is out of bounds
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetX.call(this, index);
    } catch (e) {
        return 0;
    }
};

const originalGetY = THREE.BufferAttribute.prototype.getY;
THREE.BufferAttribute.prototype.getY = function(index) {
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetY.call(this, index);
    } catch (e) {
        return 0;
    }
};

const originalGetZ = THREE.BufferAttribute.prototype.getZ;
THREE.BufferAttribute.prototype.getZ = function(index) {
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetZ.call(this, index);
    } catch (e) {
        return 0;
    }
};
"@

# Normalize line endings
$content = $content.Replace("`r`n", "`n")
$old = $old.Replace("`r`n", "`n")
$new = $new.Replace("`r`n", "`n")

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($absPath, $content)
    Write-Host "Patched BufferAttribute Y/Z successfully"
} else {
    Write-Host "Could not find pattern to patch"
}
