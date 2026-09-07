# ==============================================================================
# MeshDrop - Single-Command Local Application Launcher
# ==============================================================================
# Starts the Java backend and React frontend, verifies readiness, opens the
# browser, monitors processes, and cleanly terminates child processes on Ctrl+C.
#
# Usage:
#   .\start-meshdrop.ps1             # Launch in Development mode (Vite HMR)
#   .\start-meshdrop.ps1 -Production # Launch in Production mode (Pre-built assets)
#   .\start-meshdrop.ps1 -NoBrowser  # Do not open browser automatically
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Production,
    [switch]$NoBrowser,
    [switch]$NoMobile,
    [switch]$NoMobileWindow,
    [string]$NodeName = "",
    [int]$BackendPort = 8080,
    [int]$TcpPort = 5000,
    [int]$UdpPort = 5001,
    [int]$FrontendPort = 3000,
    [int]$MobilePort = 8081
)

$ErrorActionPreference = "Continue"

# ------------------------------------------------------------------------------
# 1. Resolve Paths & Setup Logs
# ------------------------------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$ScriptDir = (Resolve-Path $ScriptDir).Path

# Dynamically locate the backend directory containing src\com\meshdrop\Main.java
$BackendRoot = $null
$PossibleBackendDirs = @(
    (Join-Path $ScriptDir "backend"),
    (Join-Path $ScriptDir "Backend"),
    $ScriptDir,
    (Join-Path $ScriptDir "..\backend"),
    (Join-Path $ScriptDir "..\Backend")
)
foreach ($candidate in $PossibleBackendDirs) {
    if ($candidate -and (Test-Path (Join-Path $candidate "src\com\meshdrop\Main.java"))) {
        $BackendRoot = (Resolve-Path $candidate).Path
        break
    }
}

if (-not $BackendRoot) {
    Write-Host "[ERROR] Could not find the backend directory containing src\com\meshdrop\Main.java." -ForegroundColor Red
    exit 1
}

# Dynamically locate the frontend directory containing package.json
$FrontendRoot = $null
$PossibleFrontendDirs = @(
    (Join-Path $ScriptDir "frontend"),
    (Join-Path $ScriptDir "Frontend"),
    (Join-Path $ScriptDir "..\frontend"),
    (Join-Path $ScriptDir "..\Frontend"),
    (Join-Path $BackendRoot "..\frontend"),
    (Join-Path $BackendRoot "..\Frontend"),
    (Join-Path $BackendRoot "frontend"),
    (Join-Path $BackendRoot "Frontend")
)
foreach ($candidate in $PossibleFrontendDirs) {
    if ($candidate -and (Test-Path (Join-Path $candidate "package.json"))) {
        $FrontendRoot = (Resolve-Path $candidate).Path
        break
    }
}

# Dynamically locate the mobile directory containing package.json
$MobileRoot = $null
$PossibleMobileDirs = @(
    (Join-Path $ScriptDir "mobile"),
    (Join-Path $ScriptDir "Mobile"),
    (Join-Path $ScriptDir "..\mobile"),
    (Join-Path $ScriptDir "..\Mobile"),
    (Join-Path $BackendRoot "..\mobile"),
    (Join-Path $BackendRoot "..\Mobile")
)
foreach ($candidate in $PossibleMobileDirs) {
    if ($candidate -and (Test-Path (Join-Path $candidate "package.json"))) {
        $MobileRoot = (Resolve-Path $candidate).Path
        break
    }
}

$LogsDir = Join-Path $BackendRoot "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$BackendLog = Join-Path $LogsDir "backend.log"
$BackendErrLog = Join-Path $LogsDir "backend.err.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"
$FrontendErrLog = Join-Path $LogsDir "frontend.err.log"
$MobileLog = Join-Path $LogsDir "mobile.log"
$MobileErrLog = Join-Path $LogsDir "mobile.err.log"
$LauncherLog = Join-Path $LogsDir "launcher.log"

function Log-Launcher([string]$message) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$timestamp] $message"
    Add-Content -Path $LauncherLog -Value $entry -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------------------
# 2. Display Banner
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "             MESHDROP                   " -ForegroundColor Cyan
Write-Host "      Local P2P File Transfer           " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Log-Launcher "Starting MeshDrop launcher (Mode: $(if ($Production) { 'Production' } else { 'Development' }))"

# ------------------------------------------------------------------------------
# 3. Check Environment & Prerequisites
# ------------------------------------------------------------------------------
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow

# Check Java
$javaCmd = Get-Command "java" -ErrorAction SilentlyContinue
if (-not $javaCmd) {
    Write-Host "[ERROR] Java was not found on PATH." -ForegroundColor Red
    Write-Host "Please install Java (Java 26 or compatible) or configure JAVA_HOME." -ForegroundColor Yellow
    Log-Launcher "ERROR: Java not found"
    exit 1
}

$javaVerLine = try {
    $tmpFile = Join-Path $LogsDir "java_ver.tmp"
    $p = Start-Process -FilePath "java" -ArgumentList "-version" -NoNewWindow -PassThru -RedirectStandardError $tmpFile
    $p.WaitForExit(3000) | Out-Null
    if (Test-Path $tmpFile) {
        $firstLine = (Get-Content $tmpFile -TotalCount 1).Trim()
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
        $firstLine
    } else { "Java detected" }
} catch { "Java detected" }

Write-Host "  [OK] Java ($javaVerLine)" -ForegroundColor Green
Log-Launcher "Found Java: $javaVerLine"

# Check Node.js
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[ERROR] Node.js was not found on PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+) and ensure it is available on your PATH." -ForegroundColor Yellow
    Log-Launcher "ERROR: Node.js not found"
    exit 1
}
$nodeVer = try {
    $tmpNode = Join-Path $LogsDir "node_ver.tmp"
    $np = Start-Process -FilePath "node" -ArgumentList "-v" -NoNewWindow -PassThru -RedirectStandardOutput $tmpNode
    $np.WaitForExit(3000) | Out-Null
    if (Test-Path $tmpNode) {
        $v = (Get-Content $tmpNode -TotalCount 1).Trim()
        Remove-Item $tmpNode -Force -ErrorAction SilentlyContinue
        $v
    } else { "Node.js detected" }
} catch { "Node.js detected" }

Write-Host "  [OK] Node ($nodeVer)" -ForegroundColor Green
Log-Launcher "Found Node.js: $nodeVer"

# Check npm
$npmCmdName = if ($IsWindows -or $env:OS -like "*Windows*") { "npm.cmd" } else { "npm" }
$npmCmd = Get-Command $npmCmdName -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    $npmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
}
if (-not $npmCmd) {
    Write-Host "[ERROR] npm was not found on PATH." -ForegroundColor Red
    Write-Host "Please ensure npm is installed and accessible on your PATH." -ForegroundColor Yellow
    Log-Launcher "ERROR: npm not found"
    exit 1
}

$npmVer = try {
    $tmpNpm = Join-Path $LogsDir "npm_ver.tmp"
    $npmp = Start-Process -FilePath $npmCmd.Source -ArgumentList "-v" -NoNewWindow -PassThru -RedirectStandardOutput $tmpNpm
    $npmp.WaitForExit(3000) | Out-Null
    if (Test-Path $tmpNpm) {
        $v = (Get-Content $tmpNpm -TotalCount 1).Trim()
        Remove-Item $tmpNpm -Force -ErrorAction SilentlyContinue
        $v
    } else { "npm detected" }
} catch { "npm detected" }

Write-Host "  [OK] npm ($npmVer)" -ForegroundColor Green
Log-Launcher "Found npm: $npmVer"

# Verify Frontend Directory
if (-not $FrontendRoot) {
    Write-Host "[ERROR] Could not find the frontend directory containing package.json." -ForegroundColor Red
    Write-Host "Expected at: $(Join-Path $BackendRoot '..\frontend') or $(Join-Path $BackendRoot 'frontend')" -ForegroundColor Yellow
    Log-Launcher "ERROR: Frontend directory not located"
    exit 1
}
Write-Host "  [OK] Frontend directory ($FrontendRoot)" -ForegroundColor Green

# Verify Mobile Directory
if (-not $NoMobile) {
    if ($MobileRoot) {
        Write-Host "  [OK] Mobile directory ($MobileRoot)" -ForegroundColor Green
        $mobileModules = Join-Path $MobileRoot "node_modules"
        if (-not (Test-Path $mobileModules)) {
            Write-Host "  [NOTE] Installing mobile dependencies..." -ForegroundColor Yellow
            Push-Location $MobileRoot
            try {
                & $npmCmd.Source install
            } finally {
                Pop-Location
            }
        }
    } else {
        Write-Host "  [NOTE] Mobile directory not located. Skipping mobile startup." -ForegroundColor DarkGray
    }
}

# ------------------------------------------------------------------------------
# 4. Port Conflict Inspection
# ------------------------------------------------------------------------------
function Test-PortOpen([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    return [bool]$conn
}

$backendAlreadyRunning = $false
if (Test-PortOpen $BackendPort) {
    try {
        $statusResp = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/status" -TimeoutSec 1 -ErrorAction Stop
        if ($statusResp -and $statusResp.running -eq $true) {
            $backendAlreadyRunning = $true
            Write-Host "  [NOTE] An existing healthy MeshDrop backend is already active on port $BackendPort. Reusing instance." -ForegroundColor Cyan
            Log-Launcher "Reusing active MeshDrop backend on port $BackendPort"
        }
    } catch {
        Write-Host "[ERROR] Port $BackendPort is already in use by another application." -ForegroundColor Red
        Write-Host "Please free port $BackendPort or configure a different port using -BackendPort." -ForegroundColor Yellow
        Log-Launcher "ERROR: Port $BackendPort in use by non-MeshDrop process"
        exit 1
    }
}

if (-not $backendAlreadyRunning -and (Test-PortOpen $TcpPort)) {
    Write-Host "[ERROR] TCP port $TcpPort is already in use by another process." -ForegroundColor Red
    Write-Host "Please free port $TcpPort or specify another port using -TcpPort." -ForegroundColor Yellow
    Log-Launcher "ERROR: TCP port $TcpPort in use"
    exit 1
}

if (Test-PortOpen $FrontendPort) {
    Write-Host "[ERROR] Frontend port $FrontendPort is already in use by another application." -ForegroundColor Red
    Write-Host "Please free port $FrontendPort or specify another port using -FrontendPort." -ForegroundColor Yellow
    Log-Launcher "ERROR: Frontend port $FrontendPort in use"
    exit 1
}

$mobileAlreadyRunning = $false
if (-not $NoMobile -and $MobileRoot -and (Test-PortOpen $MobilePort)) {
    try {
        $metroResp = Invoke-WebRequest -Uri "http://127.0.0.1:$MobilePort/status" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($metroResp.Content -like "*packager-status:running*") {
            $mobileAlreadyRunning = $true
            Write-Host "  [NOTE] An existing healthy Expo Metro server is already active on port $MobilePort. Reusing instance." -ForegroundColor Cyan
            Log-Launcher "Reusing active Expo Metro server on port $MobilePort"
        }
    } catch {
        Write-Host "[ERROR] Port $MobilePort is already in use by another application." -ForegroundColor Red
        Write-Host "Please free port $MobilePort, specify another port using -MobilePort, or skip with -NoMobile." -ForegroundColor Yellow
        Log-Launcher "ERROR: Mobile port $MobilePort in use"
        exit 1
    }
}

# ------------------------------------------------------------------------------
# 5. Build Verification (Backend & Frontend)
# ------------------------------------------------------------------------------
$mainClassFile = Join-Path $BackendRoot "out\com\meshdrop\Main.class"
if (-not (Test-Path $mainClassFile)) {
    Write-Host "`n[BACKEND] Compiled classes not found. Building Java backend..." -ForegroundColor Yellow
    $buildScript = Join-Path $BackendRoot "scripts\build.ps1"
    & powershell -ExecutionPolicy Bypass -File $buildScript
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $mainClassFile)) {
        Write-Host "[ERROR] Failed to compile Java backend. See error output above." -ForegroundColor Red
        Log-Launcher "ERROR: Java compilation failed"
        exit 1
    }
}

if ($Production) {
    $distIndex = Join-Path $FrontendRoot "dist\index.html"
    if (-not (Test-Path $distIndex)) {
        Write-Host "`n[FRONTEND] Production build not found. Building frontend assets..." -ForegroundColor Yellow
        Push-Location $FrontendRoot
        try {
            & $npmCmd.Source run build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Frontend production build failed." -ForegroundColor Red
                exit 1
            }
        } finally {
            Pop-Location
        }
    }
}

# ------------------------------------------------------------------------------
# 6. Child Process State Tracking & Cleanup
# ------------------------------------------------------------------------------
$script:BackendProcess = $null
$script:FrontendProcess = $null
$script:MobileProcess = $null

function Stop-LauncherChildren {
    Write-Host "`n[MESHDROP] Shutting down..." -ForegroundColor Yellow
    Log-Launcher "Initiating graceful shutdown"

    if ($script:MobileProcess -and -not $script:MobileProcess.HasExited) {
        Write-Host "[MOBILE] Stopping mobile Expo server (PID: $($script:MobileProcess.Id))..." -ForegroundColor Yellow
        try {
            taskkill /PID $script:MobileProcess.Id /T /F *>$null
            $script:MobileProcess.WaitForExit(3000) | Out-Null
        } catch {}
        Log-Launcher "Stopped mobile process PID $($script:MobileProcess.Id)"
    }

    if ($script:FrontendProcess -and -not $script:FrontendProcess.HasExited) {
        Write-Host "[FRONTEND] Stopping frontend (PID: $($script:FrontendProcess.Id))..." -ForegroundColor Yellow
        try {
            taskkill /PID $script:FrontendProcess.Id /T /F *>$null
            $script:FrontendProcess.WaitForExit(3000) | Out-Null
        } catch {}
        Log-Launcher "Stopped frontend process PID $($script:FrontendProcess.Id)"
    }

    if ($script:BackendProcess -and -not $script:BackendProcess.HasExited) {
        Write-Host "[BACKEND] Stopping backend (PID: $($script:BackendProcess.Id))..." -ForegroundColor Yellow
        try {
            taskkill /PID $script:BackendProcess.Id /T /F *>$null
            $script:BackendProcess.WaitForExit(3000) | Out-Null
        } catch {}
        Log-Launcher "Stopped backend process PID $($script:BackendProcess.Id)"
    }

    Write-Host "[MESHDROP] Shutdown complete." -ForegroundColor Green
    Log-Launcher "Shutdown complete"
}

# ------------------------------------------------------------------------------
# 7. Start Java Backend
# ------------------------------------------------------------------------------
Write-Host "`n[2/5] Starting MeshDrop backend..." -ForegroundColor Yellow

if (-not $backendAlreadyRunning) {
    $effectiveName = if ($NodeName) { $NodeName } else { "$($env:COMPUTERNAME)-$BackendPort" }
    $javaArgs = @(
        "-cp", "out",
        "com.meshdrop.Main",
        "--name", "$effectiveName",
        "--tcp-port", "$TcpPort",
        "--udp-port", "$UdpPort",
        "--api-port", "$BackendPort",
        "--no-cli"
    )

    $script:BackendProcess = Start-Process -FilePath "java" -ArgumentList $javaArgs `
        -WorkingDirectory $BackendRoot `
        -RedirectStandardOutput $BackendLog `
        -RedirectStandardError $BackendErrLog `
        -PassThru -NoNewWindow

    if (-not $script:BackendProcess) {
        Write-Host "[ERROR] Could not launch Java process." -ForegroundColor Red
        exit 1
    }

    Write-Host "  [OK] Backend started (PID: $($script:BackendProcess.Id))" -ForegroundColor Green
    Log-Launcher "Backend process launched (PID: $($script:BackendProcess.Id))"
}

# Wait for backend readiness via HTTP status endpoint
$backendReady = $false
$backendStatusUrl = "http://127.0.0.1:$BackendPort/api/status"
$backendTimeout = (Get-Date).AddSeconds(20)

while ((Get-Date) -lt $backendTimeout) {
    if ($script:BackendProcess -and $script:BackendProcess.HasExited) {
        break
    }
    try {
        $statusJson = Invoke-RestMethod -Uri $backendStatusUrl -TimeoutSec 1 -ErrorAction Stop
        if ($statusJson -and $statusJson.running -eq $true) {
            $backendReady = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 250
    }
}

if (-not $backendReady) {
    Write-Host "[BACKEND] Failed to start. Process exited or failed readiness checks." -ForegroundColor Red
    if (Test-Path $BackendErrLog) {
        Write-Host "`nRecent backend stderr output ($BackendErrLog):" -ForegroundColor Yellow
        Get-Content $BackendErrLog -Tail 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } elseif (Test-Path $BackendLog) {
        Write-Host "`nRecent backend stdout output ($BackendLog):" -ForegroundColor Yellow
        Get-Content $BackendLog -Tail 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    }
    Stop-LauncherChildren
    exit 1
}
Write-Host "  [OK] Backend ready (http://localhost:$BackendPort)" -ForegroundColor Green
Log-Launcher "Backend readiness verified"

# ------------------------------------------------------------------------------
# 8. Start Frontend UI Server
# ------------------------------------------------------------------------------
Write-Host "`n[3/5] Starting MeshDrop web frontend..." -ForegroundColor Yellow

$frontendArgs = if ($Production) {
    @("run", "preview", "--", "--port", "$FrontendPort", "--host")
} else {
    @("run", "dev", "--", "--port", "$FrontendPort", "--host")
}

$script:FrontendProcess = Start-Process -FilePath $npmCmd.Source -ArgumentList $frontendArgs `
    -WorkingDirectory $FrontendRoot `
    -RedirectStandardOutput $FrontendLog `
    -RedirectStandardError $FrontendErrLog `
    -PassThru -NoNewWindow

if (-not $script:FrontendProcess) {
    Write-Host "[ERROR] Could not start frontend server." -ForegroundColor Red
    Stop-LauncherChildren
    exit 1
}

Write-Host "  [OK] Frontend started (PID: $($script:FrontendProcess.Id))" -ForegroundColor Green
Log-Launcher "Frontend process launched (PID: $($script:FrontendProcess.Id))"

# Wait for frontend readiness
$frontendReady = $false
$frontendUrl = "http://localhost:$FrontendPort"
$frontendTimeout = (Get-Date).AddSeconds(25)

while ((Get-Date) -lt $frontendTimeout) {
    if ($script:FrontendProcess.HasExited) {
        break
    }
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            $frontendReady = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 300
    }
}

if (-not $frontendReady) {
    Write-Host "[FRONTEND] Failed to start. Process exited or did not respond on port $FrontendPort." -ForegroundColor Red
    if (Test-Path $FrontendErrLog) {
        Write-Host "`nRecent frontend stderr output ($FrontendErrLog):" -ForegroundColor Yellow
        Get-Content $FrontendErrLog -Tail 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    }
    Stop-LauncherChildren
    exit 1
}
Write-Host "  [OK] Frontend ready ($frontendUrl)" -ForegroundColor Green
Log-Launcher "Frontend readiness verified"

# ------------------------------------------------------------------------------
# 9. Start Mobile Client (Expo)
# ------------------------------------------------------------------------------
if (-not $NoMobile -and $MobileRoot) {
    Write-Host "`n[4/5] Starting MeshDrop mobile client (Expo)..." -ForegroundColor Yellow

    if (-not $mobileAlreadyRunning) {
        if ($NoMobileWindow) {
            $script:MobileProcess = Start-Process -FilePath $npmCmd.Source -ArgumentList @("start", "--", "--port", "$MobilePort") `
                -WorkingDirectory $MobileRoot `
                -RedirectStandardOutput $MobileLog `
                -RedirectStandardError $MobileErrLog `
                -PassThru -NoNewWindow
        } else {
            $script:MobileProcess = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "title MeshDrop Mobile (Expo) && npx expo start --port $MobilePort") `
                -WorkingDirectory $MobileRoot `
                -PassThru
        }

        if (-not $script:MobileProcess) {
            Write-Host "[WARNING] Could not start mobile Expo server." -ForegroundColor Yellow
        } else {
            Write-Host "  [OK] Mobile server launched (PID: $($script:MobileProcess.Id))" -ForegroundColor Green
            Log-Launcher "Mobile process launched (PID: $($script:MobileProcess.Id))"
        }
    }

    # Wait for Metro bundler readiness
    $mobileReady = $false
    $mobileTimeout = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $mobileTimeout) {
        if ($script:MobileProcess -and $script:MobileProcess.HasExited) {
            break
        }
        if (Test-PortOpen $MobilePort) {
            $mobileReady = $true
            break
        }
        Start-Sleep -Milliseconds 300
    }

    if ($mobileReady) {
        Write-Host "  [OK] Mobile Metro bundler ready (http://localhost:$MobilePort)" -ForegroundColor Green
        Log-Launcher "Mobile Metro readiness verified"
    } else {
        Write-Host "  [NOTE] Mobile server is starting up in the background." -ForegroundColor DarkGray
    }
}

# ------------------------------------------------------------------------------
# 10. Open Browser
# ------------------------------------------------------------------------------
Write-Host "`n[5/5] Opening MeshDrop..." -ForegroundColor Yellow
if (-not $NoBrowser) {
    try {
        $browserTargetUrl = "$frontendUrl/?apiPort=$BackendPort"
        Start-Process $browserTargetUrl
        Write-Host "  [OK] Browser opened ($browserTargetUrl)" -ForegroundColor Green
        Log-Launcher "Browser opened to $browserTargetUrl"
    } catch {
        Write-Host "  [NOTE] Could not open browser automatically: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [NOTE] Browser auto-open skipped (-NoBrowser)." -ForegroundColor DarkGray
}

$lanIp = try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" -ErrorAction SilentlyContinue | 
        Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } | 
        Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) { $ip } else { "127.0.0.1" }
} catch { "127.0.0.1" }

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host " MeshDrop is ready." -ForegroundColor Green
Write-Host " Backend : http://localhost:$BackendPort" -ForegroundColor White
Write-Host " Frontend: $frontendUrl/?apiPort=$BackendPort" -ForegroundColor White
if (-not $NoMobile -and $MobileRoot) {
Write-Host " Mobile  : http://localhost:$MobilePort (or scan QR in Expo window)" -ForegroundColor White
Write-Host " Phone IP: http://${lanIp}:$BackendPort (for Android device)" -ForegroundColor White
}
Write-Host " Mode    : $(if ($Production) { 'Production (Built assets)' } else { 'Development (Vite HMR)' })" -ForegroundColor Gray
Write-Host " Logs    : $LogsDir" -ForegroundColor DarkGray
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all MeshDrop services.`n" -ForegroundColor Yellow

# ------------------------------------------------------------------------------
# 11. Process Supervision Loop & Clean Exit
# ------------------------------------------------------------------------------
try {
    while ($true) {
        Start-Sleep -Seconds 1

        if ($script:BackendProcess -and $script:BackendProcess.HasExited) {
            Write-Host "`n[ERROR] MeshDrop backend exited unexpectedly (Exit code: $($script:BackendProcess.ExitCode))." -ForegroundColor Red
            Write-Host "Check logs at: $BackendLog" -ForegroundColor Yellow
            Log-Launcher "Backend died unexpectedly with exit code $($script:BackendProcess.ExitCode)"
            break
        }

        if ($script:FrontendProcess -and $script:FrontendProcess.HasExited) {
            Write-Host "`n[ERROR] MeshDrop frontend exited unexpectedly (Exit code: $($script:FrontendProcess.ExitCode))." -ForegroundColor Red
            Write-Host "Check logs at: $FrontendLog" -ForegroundColor Yellow
            Log-Launcher "Frontend died unexpectedly with exit code $($script:FrontendProcess.ExitCode)"
            break
        }

        if ($script:MobileProcess -and $script:MobileProcess.HasExited) {
            Write-Host "`n[NOTE] Mobile Expo process exited (PID: $($script:MobileProcess.Id))." -ForegroundColor DarkGray
            Log-Launcher "Mobile process exited"
            $script:MobileProcess = $null
        }
    }
} finally {
    Stop-LauncherChildren
}
