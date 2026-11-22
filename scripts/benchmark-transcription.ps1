param([string]$AudioPath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildDirectory = Join-Path $projectRoot '.build-tools'
$dependencies = Join-Path $projectRoot 'src-tauri/target/debug/deps'
$modelPath = Join-Path $env:APPDATA 'com.app.near/models/ggml-tiny-q5_1.bin'
$checkFixture = -not $AudioPath
if (-not (Test-Path -LiteralPath $modelPath)) { throw 'Install the speech model in NEAR first.' }
if (-not $AudioPath) {
    $AudioPath = Join-Path $buildDirectory 'transcription-fixture.wav'
    if (-not (Test-Path -LiteralPath $AudioPath)) {
        $voiceRoot = Join-Path $env:APPDATA 'com.app.near/voices'
        $piper = Join-Path $voiceRoot 'piper-2023.11.14-2/piper.exe'
        $voice = Join-Path $voiceRoot 'en_US-bryce-medium/en_US-bryce-medium.onnx'
        if (-not (Test-Path -LiteralPath $piper)) { throw 'Supply -AudioPath with a mono PCM16 WAV, or install Bryce to generate a fixture.' }
        'What is the verse of the day? Please help me find some peace today.' | & $piper --model $voice --output_file $AudioPath --quiet
        if ($LASTEXITCODE -ne 0) { throw 'Could not generate synthetic speech.' }
    }
}
$whisperLibrary = Get-ChildItem $dependencies -Filter 'libwhisper_rs-*.rlib' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$wavLibrary = Get-ChildItem $dependencies -Filter 'libhound-*.rlib' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $whisperLibrary -or -not $wavLibrary) { throw 'Build NEAR in dev mode first to prepare the native dependencies.' }
$executable = Join-Path $buildDirectory 'transcription-benchmark.exe'
& rustc --edition=2024 (Join-Path $PSScriptRoot 'benchmark-transcription.rs') -L "dependency=$dependencies" --extern "whisper_rs=$($whisperLibrary.FullName)" --extern "hound=$($wavLibrary.FullName)" -o $executable
if ($LASTEXITCODE -ne 0) { throw 'Could not compile the transcription benchmark.' }
# Keep native decoder output separate; it contains only the synthetic fixture.
$stderrPath = Join-Path $buildDirectory 'transcription-benchmark.stderr.log'
$ErrorActionPreference = 'Continue'
$benchmarkArguments = @($modelPath, $AudioPath)
if ($checkFixture) { $benchmarkArguments += '--fixture' }
& $executable @benchmarkArguments 2> $stderrPath
exit $LASTEXITCODE
