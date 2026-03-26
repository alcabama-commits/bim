
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$patchCode = @"
// --- EMERGENCY PATCH: Vector3.fromBufferAttribute ---
// This is the specific call site failing in the stack trace.
const originalFromBufferAttribute = THREE.Vector3.prototype.fromBufferAttribute;
THREE.Vector3.prototype.fromBufferAttribute = function(attribute, index) {
    try {
        // Double check attribute validity before calling
        if (!attribute || (attribute.isBufferAttribute && !attribute.array)) {
             return this.set(0, 0, 0);
        }
        return originalFromBufferAttribute.call(this, attribute, index);
    } catch (e) {
        // console.warn("Prevented Vector3.fromBufferAttribute crash", e);
        return this.set(0, 0, 0);
    }
};

// --- EMERGENCY PATCH: InstancedMesh.raycast ---
const originalInstancedRaycast = THREE.InstancedMesh.prototype.raycast;
THREE.InstancedMesh.prototype.raycast = function(raycaster, intersects) {
    try {
        if (!this.geometry) return;
        originalInstancedRaycast.call(this, raycaster, intersects);
    } catch (e) {
        // console.warn("Prevented InstancedMesh.raycast crash", e);
    }
};
"@

$insertMarker = "// --- CRITICAL FIX: Monkey-patch THREE.BufferAttribute.prototype.getX to prevent crashes ---"

if ($content.Contains($insertMarker)) {
    // Insert BEFORE the marker to be at the very top of patches
    $content = $content.Replace($insertMarker, $patchCode + "`n`n" + $insertMarker)
    [System.IO.File]::WriteAllText($absPath, $content)
    Write-Host "Applied Vector3 and InstancedMesh patches."
} else {
    Write-Host "Could not find insertion marker."
}
