# ==============================================================================
# MeshDrop - Laptop / Desktop Packaging Script (Windows / Mac / Linux)
# ==============================================================================
# Builds the production React frontend, compiles the Java backend, embeds the
# web assets directly into an executable Fat JAR (MeshDrop.jar), and generates
# a native self-contained Windows application bundle (MeshDrop.exe) using jpackage.
#
# Usage:
#   .\package-laptop.ps1               # Build Fat JAR & Windows Portable Bundle
#   .\package-laptop.ps1 -BuildNative  # Also invoke jpackage for native .exe / bundled JRE
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$BuildNative,
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$ProjectRoot = (Resolve-Path $ScriptDir).Path

$BackendDir = Join-Path $ProjectRoot "Backend"
$FrontendDir = Join-Path $ProjectRoot "Frontend"
$DistDir = Join-Path $ProjectRoot "dist"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       MeshDrop Laptop Packaging Pipeline v$Version        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Locate Java Tools (javac, jar, jpackage)
# ------------------------------------------------------------------------------
Write-Host "`n[1/5] Checking build tools..." -ForegroundColor Yellow

$jdkBin = $null
$possibleJdkPaths = @(
    "C:\Program Files\Java\jdk-26.0.2\bin",
    "C:\Program Files\Java\jdk-21\bin",
    "C:\Program Files\Java\latest\bin"
)
if ($env:JAVA_HOME) {
    $possibleJdkPaths += (Join-Path $env:JAVA_HOME "bin")
}
foreach ($cand in $possibleJdkPaths) {
    if ($cand -and (Test-Path (Join-Path $cand "javac.exe")) -and (Test-Path (Join-Path $cand "jar.exe"))) {
        $jdkBin = $cand
        break
    }
}

if (-not $jdkBin) {
    $javacCmd = Get-Command javac -ErrorAction SilentlyContinue
    if ($javacCmd) {
        $jdkBin = Split-Path -Parent $javacCmd.Source
    }
}

if (-not $jdkBin) {
    Write-Host "[ERROR] Could not find JDK tools (javac, jar)." -ForegroundColor Red
    exit 1
}

$javacExe = Join-Path $jdkBin "javac.exe"
$jarExe = Join-Path $jdkBin "jar.exe"
$jpackageExe = Join-Path $jdkBin "jpackage.exe"

Write-Host "  JDK Tools  : $jdkBin" -ForegroundColor Green

# Check Node.js / npm
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) { $npmCmd = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npmCmd) {
    Write-Host "[ERROR] Node.js / npm is required to build the frontend." -ForegroundColor Red
    exit 1
}
Write-Host "  npm Tool   : $($npmCmd.Source)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. Build Production Frontend (Vite)
# ------------------------------------------------------------------------------
Write-Host "`n[2/5] Building production React web frontend..." -ForegroundColor Yellow
Push-Location $FrontendDir
try {
    & $npmCmd.Source run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Frontend build failed." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

$frontendDist = Join-Path $FrontendDir "dist"
if (-not (Test-Path (Join-Path $frontendDist "index.html"))) {
    Write-Host "[ERROR] Frontend dist/index.html was not generated." -ForegroundColor Red
    exit 1
}
Write-Host "  Frontend built successfully in $frontendDist" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. Compile Java Backend
# ------------------------------------------------------------------------------
Write-Host "`n[3/5] Compiling Java backend..." -ForegroundColor Yellow
$backendOut = Join-Path $BackendDir "out"
if (-not (Test-Path $backendOut)) {
    New-Item -ItemType Directory -Path $backendOut -Force | Out-Null
}

$backendSources = Get-ChildItem -Path (Join-Path $BackendDir "src\com") -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
$sourcesFile = Join-Path $backendOut "sources.txt"
[System.IO.File]::WriteAllLines($sourcesFile, $backendSources, (New-Object System.Text.UTF8Encoding($false)))

try {
    & $javacExe -encoding UTF-8 -d "$backendOut" "@$sourcesFile"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Backend compilation failed." -ForegroundColor Red
        exit 1
    }
} finally {
    if (Test-Path $sourcesFile) { Remove-Item -Force $sourcesFile }
}
Write-Host "  Backend compiled successfully ($($backendSources.Count) classes)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Assemble Executable Fat JAR (MeshDrop.jar) with Embedded Web UI
# ------------------------------------------------------------------------------
Write-Host "`n[4/5] Packaging standalone executable Fat JAR..." -ForegroundColor Yellow
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

$stagingDir = Join-Path $DistDir "staging_jar"
if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

# Copy compiled backend classes
Copy-Item -Path "$backendOut\*" -Destination $stagingDir -Recurse

# Embed frontend production dist under /web inside the JAR
$stagingWeb = Join-Path $stagingDir "web"
New-Item -ItemType Directory -Path $stagingWeb -Force | Out-Null
Copy-Item -Path "$frontendDist\*" -Destination $stagingWeb -Recurse

# Generate Manifest
$manifestPath = Join-Path $DistDir "MANIFEST.MF"
$manifestContent = "Manifest-Version: 1.0`r`nMain-Class: com.meshdrop.Main`r`nImplementation-Title: MeshDrop`r`nImplementation-Version: $Version`r`n"
[System.IO.File]::WriteAllText($manifestPath, $manifestContent, (New-Object System.Text.UTF8Encoding($false)))

$outputJar = Join-Path $DistDir "MeshDrop.jar"
& $jarExe -cfm "$outputJar" "$manifestPath" -C "$stagingDir" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] jar packaging failed." -ForegroundColor Red
    exit 1
}

# Cleanup staging
Remove-Item -Recurse -Force $stagingDir
Remove-Item -Force $manifestPath

$jarSizeMB = [math]::Round((Get-Item $outputJar).Length / 1MB, 2)
Write-Host "  Generated Fat JAR: $outputJar ($jarSizeMB MB)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 5. Create Standalone Windows Portable Distribution Bundle
# ------------------------------------------------------------------------------
Write-Host "`n[5/5] Creating Windows Portable distribution..." -ForegroundColor Yellow
$portableDir = Join-Path $DistDir "MeshDrop-Windows-v$Version"
if (Test-Path $portableDir) { Remove-Item -Recurse -Force $portableDir }
New-Item -ItemType Directory -Path $portableDir -Force | Out-Null

# Copy Jar
Copy-Item -Path $outputJar -Destination (Join-Path $portableDir "MeshDrop.jar")

# Create 1-click Windows Batch Launcher
$batContent = @"
@echo off
setlocal
cd /d "%~dp0"
title MeshDrop P2P File Transfer
echo ========================================================
echo                 MeshDrop Local Node
echo ========================================================
echo Starting MeshDrop service and opening web control panel...
echo Press Ctrl+C in this terminal window to stop MeshDrop.
echo ========================================================
start "" "http://localhost:8080"
java -jar "%~dp0MeshDrop.jar" --open-browser %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start MeshDrop. Please ensure Java 21+ is installed.
    pause
)
"@
[System.IO.File]::WriteAllText((Join-Path $portableDir "MeshDrop.bat"), $batContent, (New-Object System.Text.ASCIIEncoding))

# Create macOS / Linux Shell Launcher
$shContent = @"
#!/usr/bin/env bash
cd "`$(dirname "`$0")"
echo "Starting MeshDrop..."
which xdg-open > /dev/null 2>&1 && xdg-open "http://localhost:8080"
which open > /dev/null 2>&1 && open "http://localhost:8080"
java -jar MeshDrop.jar --open-browser "`$@"
"@
[System.IO.File]::WriteAllText((Join-Path $portableDir "MeshDrop.sh"), $shContent, (New-Object System.Text.UTF8Encoding($false)))

# Create README.txt
$readmeContent = @"
MeshDrop v$Version - Peer-to-Peer File Transfer
==================================================

Quick Start:
  - Windows: Double-click 'MeshDrop.bat'
  - Mac / Linux: Run 'chmod +x MeshDrop.sh && ./MeshDrop.sh'
  - Or manually: java -jar MeshDrop.jar --open-browser

Once started:
  1. MeshDrop opens automatically in your web browser at:
     http://localhost:8080
  2. Peer discovery runs automatically over your local Wi-Fi.
  3. Transfer files seamlessly between laptops and phones!

Zero dependencies required beyond Java 21+.
"@
[System.IO.File]::WriteAllText((Join-Path $portableDir "README.txt"), $readmeContent, (New-Object System.Text.UTF8Encoding($false)))

# Zip the portable package
$zipPath = Join-Path $DistDir "MeshDrop-Laptop-v$Version.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path "$portableDir\*" -DestinationPath $zipPath -Force
Write-Host "  Generated Portable Zip: $zipPath" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 6. Optional: Native Executable Bundle via jpackage (Bundles JRE)
# ------------------------------------------------------------------------------
if ($BuildNative -and (Test-Path $jpackageExe)) {
    Write-Host "`n[OPTIONAL] Building native self-contained Windows application (jpackage)..." -ForegroundColor Yellow
    $appImageDir = Join-Path $DistDir "native-app-image"
    if (Test-Path $appImageDir) { Remove-Item -Recurse -Force $appImageDir }
    
    $jpackageInput = Join-Path $DistDir "jpackage_input"
    if (Test-Path $jpackageInput) { Remove-Item -Recurse -Force $jpackageInput }
    New-Item -ItemType Directory -Path $jpackageInput -Force | Out-Null
    Copy-Item -Path $outputJar -Destination (Join-Path $jpackageInput "MeshDrop.jar")

    try {
        & $jpackageExe `
            --type app-image `
            --name "MeshDrop" `
            --app-version "$Version" `
            --input "$jpackageInput" `
            --main-jar "MeshDrop.jar" `
            --main-class "com.meshdrop.Main" `
            --dest "$DistDir" `
            --java-options "--enable-preview" `
            --arguments "--open-browser"

        if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $DistDir "MeshDrop\MeshDrop.exe"))) {
            $nativeZip = Join-Path $DistDir "MeshDrop-Windows-x64-Setup-v$Version.zip"
            if (Test-Path $nativeZip) { Remove-Item -Force $nativeZip }
            Compress-Archive -Path (Join-Path $DistDir "MeshDrop\*") -DestinationPath $nativeZip -Force
            Write-Host "  Native Windows bundle created with embedded JRE: $nativeZip" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [WARN] Native jpackage packaging skipped or failed: $_" -ForegroundColor Yellow
    } finally {
        if (Test-Path $jpackageInput) { Remove-Item -Recurse -Force $jpackageInput }
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "              Laptop Packaging Completed!                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Artifacts available in '$DistDir':" -ForegroundColor DarkGray
Get-ChildItem -Path $DistDir -File | Where-Object { $_.Extension -in '.zip', '.jar', '.exe', '.msi' } | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor Green
}
