# ==============================================================================
# MeshDrop - Android APK Packaging Script
# ==============================================================================
# Guides you through building a standalone installable Android APK (MeshDrop.apk)
# without needing Expo Go or Metro dev server running.
#
# Usage:
#   .\package-android.ps1              # Interactive menu
#   .\package-android.ps1 -Method eas  # Build via Expo EAS Cloud Build
#   .\package-android.ps1 -Method gh   # Trigger GitHub Actions cloud build
# ==============================================================================

[CmdletBinding()]
param(
    [ValidateSet("eas", "gh", "local", "menu")]
    [string]$Method = "menu",
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$ProjectRoot = (Resolve-Path $ScriptDir).Path
$MobileDir = Join-Path $ProjectRoot "Mobile"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         MeshDrop Android APK Release Builder             " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Package: com.meshdrop.mobile" -ForegroundColor DarkGray
Write-Host "  Version: $Version" -ForegroundColor DarkGray
Write-Host "  Output : Standalone installable .apk (No Expo Go needed)" -ForegroundColor DarkGray
Write-Host "==========================================================`n" -ForegroundColor Cyan

if ($Method -eq "menu") {
    Write-Host "Choose how you would like to build the Android APK:" -ForegroundColor Yellow
    Write-Host "  [1] GitHub Actions Cloud Build (Recommended - 0 local setup, 100% free)"
    Write-Host "  [2] Expo EAS Cloud Build (Direct download link + QR code)"
    Write-Host "  [3] Local Android Build (Requires Android SDK & Gradle installed)"
    Write-Host "  [Q] Quit`n"

    $choice = Read-Host "Select option (1-3)"
    switch ($choice) {
        "1" { $Method = "gh" }
        "2" { $Method = "eas" }
        "3" { $Method = "local" }
        default { exit 0 }
    }
}

# ------------------------------------------------------------------------------
# Method 1: GitHub Actions Cloud Build
# ------------------------------------------------------------------------------
if ($Method -eq "gh") {
    Write-Host "`n--- Option 1: GitHub Actions Cloud APK Build ---" -ForegroundColor Yellow
    Write-Host "The GitHub Actions workflow '.github/workflows/build-android-apk.yml' will"
    Write-Host "compile MeshDrop.apk on GitHub's cloud runners and attach it for download." -ForegroundColor Green
    
    $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghCmd) {
        $runGh = Read-Host "`nGitHub CLI detected. Trigger workflow now via 'gh workflow run'? (y/n)"
        if ($runGh -eq 'y') {
            & $ghCmd.Source workflow run build-android-apk.yml
            Write-Host "`n[SUCCESS] Workflow triggered! Track progress at:" -ForegroundColor Green
            Write-Host "  https://github.com/vishweshvpagi/MeshDrop-P2P/actions" -ForegroundColor Cyan
            exit 0
        }
    }

    Write-Host "`nTo generate MeshDrop.apk via GitHub Releases:" -ForegroundColor Cyan
    Write-Host "  1. Push your changes and create a tag:" -ForegroundColor DarkGray
    Write-Host "     git add ." -ForegroundColor White
    Write-Host "     git commit -m `"Release v$Version`"" -ForegroundColor White
    Write-Host "     git tag v$Version" -ForegroundColor White
    Write-Host "     git push origin main --tags" -ForegroundColor White
    Write-Host "  2. Go to: https://github.com/vishweshvpagi/MeshDrop-P2P/actions" -ForegroundColor DarkGray
    Write-Host "  3. Select 'Build Android APK' -> Click 'Run workflow'" -ForegroundColor DarkGray
    Write-Host "  4. Download 'MeshDrop.apk' under Artifacts or Releases!" -ForegroundColor Green
    exit 0
}

# ------------------------------------------------------------------------------
# Method 2: Expo EAS Cloud Build
# ------------------------------------------------------------------------------
if ($Method -eq "eas") {
    Write-Host "`n--- Option 2: Expo EAS Cloud Build ---" -ForegroundColor Yellow
    Write-Host "Running EAS Build for Android APK..." -ForegroundColor Cyan

    Push-Location $MobileDir
    try {
        Write-Host "Executing: npx eas-cli build --platform android --profile preview`n" -ForegroundColor DarkGray
        npx eas-cli build --platform android --profile preview
    } finally {
        Pop-Location
    }
    exit 0
}

# ------------------------------------------------------------------------------
# Method 3: Local Build
# ------------------------------------------------------------------------------
if ($Method -eq "local") {
    Write-Host "`n--- Option 3: Local Android Build ---" -ForegroundColor Yellow
    
    if (-not $env:ANDROID_HOME -and -not (Test-Path "$env:LOCALAPPDATA\Android\Sdk")) {
        Write-Host "[ERROR] Android SDK not detected on this machine." -ForegroundColor Red
        Write-Host "Please use Option 1 (GitHub Actions) or Option 2 (EAS Build) which build in the cloud." -ForegroundColor Yellow
        exit 1
    }

    Push-Location $MobileDir
    try {
        Write-Host "1. Generating native android project (npx expo prebuild)..." -ForegroundColor Yellow
        npx expo prebuild --platform android --clean
        
        Write-Host "2. Building release APK with Gradle..." -ForegroundColor Yellow
        Push-Location (Join-Path $MobileDir "android")
        try {
            cmd.exe /c "gradlew.bat assembleRelease"
            $apkCandidate = Get-ChildItem -Path "app\build\outputs\apk" -Recurse -Filter "*.apk" | Select-Object -First 1
            if ($apkCandidate) {
                $distApk = Join-Path $ProjectRoot "dist\MeshDrop-v$Version.apk"
                Copy-Item -Path $apkCandidate.FullName -Destination $distApk -Force
                Write-Host "`n[SUCCESS] APK built successfully: $distApk" -ForegroundColor Green
            }
        } finally {
            Pop-Location
        }
    } finally {
        Pop-Location
    }
    exit 0
}
