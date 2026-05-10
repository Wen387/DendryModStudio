param(
  [string]$InstallerPath = "",
  [int]$Iterations = 3,
  [string]$InstallRoot = "",
  [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"

function Resolve-InstallerPath {
  param([string]$PathFromArgs)
  if ($PathFromArgs) {
    return (Resolve-Path $PathFromArgs).Path
  }
  $desktopDir = Resolve-Path (Join-Path $PSScriptRoot "..")
  $candidates = Get-ChildItem -Path (Join-Path $desktopDir "dist-builder") -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if (-not $candidates -or $candidates.Count -eq 0) {
    throw "No Windows installer was found under dist-builder. Pass -InstallerPath explicitly."
  }
  return $candidates[0].FullName
}

function Get-DirectoryStats {
  param([string]$Root)
  if (-not (Test-Path $Root)) {
    return @{ files = 0; directories = 0; bytes = 0 }
  }
  $files = Get-ChildItem -Path $Root -Recurse -File -Force -ErrorAction SilentlyContinue
  $dirs = Get-ChildItem -Path $Root -Recurse -Directory -Force -ErrorAction SilentlyContinue
  $bytes = ($files | Measure-Object -Property Length -Sum).Sum
  if ($null -eq $bytes) {
    $bytes = 0
  }
  return @{
    files = @($files).Count
    directories = @($dirs).Count
    bytes = [Int64]$bytes
  }
}

function Invoke-SilentUninstall {
  param([string]$InstallDir)
  $uninstallers = Get-ChildItem -Path $InstallDir -Filter "*uninstall*.exe" -File -Recurse -ErrorAction SilentlyContinue
  if ($uninstallers -and $uninstallers.Count -gt 0) {
    $process = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList "/S" -PassThru -Wait
    return $process.ExitCode
  }
  return $null
}

$installer = Resolve-InstallerPath $InstallerPath
if (-not $InstallRoot) {
  $InstallRoot = Join-Path $env:TEMP "dms-install-perf"
}
if (-not $OutFile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutFile = Join-Path $InstallRoot "install-perf-$stamp.json"
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

$results = @()
for ($i = 1; $i -le $Iterations; $i += 1) {
  $target = Join-Path $InstallRoot ("run-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $i)
  if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  $elapsed = Measure-Command {
    $args = @("/S", "/D=$target")
    $process = Start-Process -FilePath $installer -ArgumentList $args -PassThru -Wait
    if ($process.ExitCode -ne 0) {
      throw "Installer failed with exit code $($process.ExitCode)"
    }
  }
  $stats = Get-DirectoryStats $target
  $uninstallExitCode = Invoke-SilentUninstall $target

  $results += [PSCustomObject]@{
    iteration = $i
    installDir = $target
    seconds = [Math]::Round($elapsed.TotalSeconds, 3)
    files = $stats.files
    directories = $stats.directories
    bytes = $stats.bytes
    uninstallExitCode = $uninstallExitCode
  }
}

$averageSeconds = ($results | Measure-Object -Property seconds -Average).Average
$payload = [PSCustomObject]@{
  ok = $true
  installer = $installer
  createdAt = (Get-Date).ToString("o")
  iterations = $Iterations
  averageSeconds = [Math]::Round($averageSeconds, 3)
  results = $results
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -Path $OutFile -Encoding UTF8
$payload | ConvertTo-Json -Depth 6
