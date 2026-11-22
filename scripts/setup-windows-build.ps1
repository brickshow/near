$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDirectory = Join-Path $projectRoot '.build-tools'
$configDirectory = Join-Path $projectRoot '.cargo'
$configFile = Join-Path $configDirectory 'config.toml'
$config = @'
# Local Windows build tools, installed by npm run setup:windows.
[env]
LIBCLANG_PATH = { value = ".build-tools/clang/native", relative = true }
CMAKE = { value = ".build-tools/cmake/data/bin/cmake.exe", relative = true }
'@

if ((Test-Path -LiteralPath $configFile) -and ((Get-Content -Raw -LiteralPath $configFile).Trim() -ne $config.Trim())) {
    throw "Existing Cargo configuration at $configFile. Merge the LIBCLANG_PATH and CMAKE settings from this script into it before continuing."
}

# These wheels supply the native tools; Python is needed only during setup.
& python -m pip install --disable-pip-version-check --only-binary=:all: --no-deps --upgrade --target $toolsDirectory libclang==18.1.1 cmake==4.4.4
if ($LASTEXITCODE -ne 0) { throw 'Build-tool installation failed. Ensure Python with pip is installed and internet access is available.' }
foreach ($relativePath in @('clang/native/libclang.dll', 'cmake/data/bin/cmake.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $toolsDirectory $relativePath))) {
        throw "Missing build tool after installation: $relativePath"
    }
}
New-Item -ItemType Directory -Force -Path $configDirectory | Out-Null
[System.IO.File]::WriteAllText($configFile, $config + [Environment]::NewLine)
Write-Host 'Windows Whisper build tools are ready. Run npm run tauri dev.'
