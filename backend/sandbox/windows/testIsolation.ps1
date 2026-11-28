$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "AppContainerLauncher.cs"

Add-Type -Path $source

$exe = Join-Path $env:WINDIR "System32\cmd.exe"
$workingDirectory = Join-Path $env:WINDIR "System32"

Write-Host "Starting AppContainer process..."

$result = [AppContainerLauncher]::Run(
    $exe,
    "/d /c exit 0",
    $workingDirectory
)

if ($result -ne 0) {
    throw "Sandbox process failed: $result"
}

Write-Host "PASS: AppContainer process launched" -ForegroundColor Green
Write-Host "Exit code: $result"