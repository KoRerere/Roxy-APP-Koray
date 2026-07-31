# Install delay launcher into Chrome core dir (Windows)
#
# Env:
#   -AppEnv dev|test  -> %APPDATA%\RoxyBrowserDev
#   -AppEnv prod      -> %APPDATA%\RoxyBrowser
#
# Examples:
#   powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Delay 35
#   powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv prod -CoreVersion 150 -Delay 70
#   powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -CoreDir "D:\path\chrome-bin\150" -Delay 35
#   powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Restore
#   powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -List

param(
  [Alias('Env')]
  [ValidateSet('dev', 'test', 'prod')]
  [string]$AppEnv = 'dev',

  [string]$CoreVersion = '',

  [string]$CoreDir = '',

  [ValidateSet(10, 35, 50, 70)]
  [int]$Delay = 35,

  [switch]$Restore,

  [switch]$List
)

$ErrorActionPreference = 'Stop'

function Get-AppRootByEnv([string]$Name) {
  $folder = if ($Name -eq 'prod') { 'RoxyBrowser' } else { 'RoxyBrowserDev' }
  return Join-Path $env:APPDATA $folder
}

function Get-ChromeBinRoot([string]$Name) {
  return Join-Path (Get-AppRootByEnv $Name) 'chrome-bin'
}

function Resolve-CoreDir {
  if ($CoreDir) {
    return (Resolve-Path -LiteralPath $CoreDir).Path
  }

  $chromeBinRoot = Get-ChromeBinRoot $AppEnv
  if (-not $CoreVersion) {
    throw "Missing -CoreVersion (e.g. 150) or -CoreDir. chrome-bin root: $chromeBinRoot"
  }

  return (Join-Path $chromeBinRoot $CoreVersion)
}

$appRoot = Get-AppRootByEnv $AppEnv
$chromeBinRoot = Get-ChromeBinRoot $AppEnv
$envLabel = if ($AppEnv -eq 'prod') { 'prod (RoxyBrowser)' } else { 'dev/test (RoxyBrowserDev)' }

if ($List) {
  Write-Host "[delay-launcher] env=$envLabel"
  Write-Host "[delay-launcher] appRoot=$appRoot"
  Write-Host "[delay-launcher] chromeBinRoot=$chromeBinRoot"
  if (-not (Test-Path -LiteralPath $chromeBinRoot)) {
    Write-Host '[delay-launcher] chrome-bin not found'
    exit 0
  }
  Get-ChildItem -LiteralPath $chromeBinRoot -Directory |
    Where-Object { $_.Name -match '^\d+$' } |
    ForEach-Object {
      $exe = Join-Path $_.FullName 'RoxyChrome.exe'
      $real = Join-Path $_.FullName 'RoxyChrome_real.exe'
      $status = if (Test-Path -LiteralPath $real) {
        'delay-installed'
      }
      elseif (Test-Path -LiteralPath $exe) {
        'ready'
      }
      else {
        'incomplete'
      }
      Write-Host ('  - {0}  [{1}]' -f $_.Name, $status)
    }
  exit 0
}

$resolvedCoreDir = Resolve-CoreDir
$realName = 'RoxyChrome_real.exe'
$fakeName = 'RoxyChrome.exe'
$realPath = Join-Path $resolvedCoreDir $realName
$fakePath = Join-Path $resolvedCoreDir $fakeName

Write-Host "[delay-launcher] env=$envLabel"
Write-Host "[delay-launcher] coreDir=$resolvedCoreDir"

if (-not (Test-Path -LiteralPath $resolvedCoreDir)) {
  throw "CoreDir not found: $resolvedCoreDir. Use -List to see installed cores."
}

if ($Restore) {
  $usedPath = Join-Path $resolvedCoreDir 'RoxyChrome_delay_used.exe'

  if (Test-Path -LiteralPath $realPath) {
    if (Test-Path -LiteralPath $fakePath) {
      Remove-Item -LiteralPath $fakePath -Force
    }
    Rename-Item -LiteralPath $realPath -NewName $fakeName
    Write-Host "[delay-launcher] restored $fakePath from $realName"
  }
  elseif (Test-Path -LiteralPath $fakePath) {
    Write-Host "[delay-launcher] already restored (no $realName); primary kept"
  }
  else {
    throw "Nothing to restore: missing both $realPath and $fakePath"
  }

  if (Test-Path -LiteralPath $usedPath) {
    Remove-Item -LiteralPath $usedPath -Force -ErrorAction SilentlyContinue
    Write-Host "[delay-launcher] removed leftover $usedPath"
  }

  Write-Host "[delay-launcher] restore done"
  exit 0
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $scriptDir "dist\win-x64\RoxyChrome_delay_${Delay}s.exe"
if (-not (Test-Path -LiteralPath $src)) {
  throw "Built launcher not found: $src. Run: pnpm build:delay-launcher"
}

if (-not (Test-Path -LiteralPath $realPath)) {
  if (-not (Test-Path -LiteralPath $fakePath)) {
    throw "Neither $fakeName nor $realName exists in $resolvedCoreDir"
  }
  Rename-Item -LiteralPath $fakePath -NewName $realName
  Write-Host "[delay-launcher] renamed $fakeName -> $realName"
}
elseif (Test-Path -LiteralPath $fakePath) {
  Remove-Item -LiteralPath $fakePath -Force
}

$usedPath = Join-Path $resolvedCoreDir 'RoxyChrome_delay_used.exe'
if (Test-Path -LiteralPath $usedPath) {
  Remove-Item -LiteralPath $usedPath -Force -ErrorAction SilentlyContinue
  Write-Host "[delay-launcher] removed leftover $usedPath"
}

Copy-Item -LiteralPath $src -Destination $fakePath -Force

Write-Host "[delay-launcher] installed one-shot delay=${Delay}s -> $fakePath"
Write-Host "[delay-launcher] real core kept at $realPath"
Write-Host '[delay-launcher] after first delayed launch, real exe is auto-restored (no second delay)'
Write-Host '[delay-launcher] re-test: run install again; manual fix: -Restore'
