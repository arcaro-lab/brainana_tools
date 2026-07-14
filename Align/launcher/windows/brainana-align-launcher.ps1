$ErrorActionPreference = 'Stop'
$AppDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Resources = Join-Path $AppDir 'Resources'
$Arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
$RuntimeDir = if ($Arch -eq 'arm64') { 'win32-arm64' } else { 'win32-x64' }
$Node = Join-Path $Resources "runtime\$RuntimeDir\node.exe"
if (-not (Test-Path -LiteralPath $Node)) { throw "Bundled Windows runtime missing: $Node" }
$Root = if ($args.Count -gt 0) { $args[0] } else { (Get-Location).Path }
$CacheRoot = Join-Path $env:LOCALAPPDATA 'Brainana Align\Cache'
$LogRoot = Join-Path $env:LOCALAPPDATA 'Brainana Align\Logs'
New-Item -ItemType Directory -Force -Path $CacheRoot, $LogRoot | Out-Null
Write-Host 'Windows launcher source template. Packaging support will supply version metadata and the shared handshake implementation.'
Write-Host "Data root: $Root"
