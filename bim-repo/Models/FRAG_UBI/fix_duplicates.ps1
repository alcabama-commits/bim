
$path = "..\LocalViewer\src\main.ts"
$absPath = [System.IO.Path]::GetFullPath($path)
$content = [System.IO.File]::ReadAllText($absPath)

$duplicateBlock = @"
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

$normalizedContent = $content.Replace("`r`n", "`n")
$normalizedBlock = $duplicateBlock.Replace("`r`n", "`n")

# Check if the block appears twice
$firstIndex = $normalizedContent.IndexOf($normalizedBlock)
if ($firstIndex -ge 0) {
    $secondIndex = $normalizedContent.IndexOf($normalizedBlock, $firstIndex + $normalizedBlock.Length)
    if ($secondIndex -ge 0) {
        # It appears twice. Remove the second occurrence.
        # Actually, let's just replace the double occurrence with a single one.
        
        $doubleBlock = $normalizedBlock + "`n`n" + $normalizedBlock
        if ($normalizedContent.Contains($doubleBlock)) {
             $normalizedContent = $normalizedContent.Replace($doubleBlock, $normalizedBlock)
             [System.IO.File]::WriteAllText($absPath, $normalizedContent)
             Write-Host "Fixed duplicate block (method 1)"
        } else {
             # Maybe spacing is different
             Write-Host "Duplicate block found but exact double pattern match failed. Trying regex or manual split."
             
             # Let's try replacing the second occurrence manually
             $before = $normalizedContent.Substring(0, $secondIndex)
             $after = $normalizedContent.Substring($secondIndex + $normalizedBlock.Length)
             $newContent = $before + $after
             [System.IO.File]::WriteAllText($absPath, $newContent)
             Write-Host "Fixed duplicate block (method 2)"
        }
    } else {
        Write-Host "Block appears only once. No fix needed."
    }
} else {
    Write-Host "Block not found."
}
