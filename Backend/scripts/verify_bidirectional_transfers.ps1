param(
    [long]$SizeBytes = 5242880 # Default 5 MB
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$outDir = Join-Path $projectRoot "out"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " MeshDrop End-to-End Bidirectional Transfer Test " -ForegroundColor Cyan
Write-Host " Testing payload size: $([math]::Round($SizeBytes / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Create a temporary directory for this test run
$testDir = Join-Path ([System.IO.Path]::GetTempPath()) ("meshdrop_bidi_test_" + [System.Guid]::NewGuid().ToString("N"))
$downloadsDir = Join-Path $testDir "downloads"
$mobileDir = Join-Path $testDir "mobile_storage"
$stagingDir = Join-Path $testDir "staging"
New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null
New-Item -ItemType Directory -Path $mobileDir -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$port = 64990
$apiBase = "http://127.0.0.1:$port"

# Helper for SHA-256
function Get-FileSha256($filePath) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($filePath)
    $hashBytes = $sha.ComputeHash($stream)
    $stream.Close()
    return ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLower()
}

# Helper to generate random binary file
function New-RandomBinaryFile($filePath, $sizeBytes) {
    $buffer = New-Object byte[] (64 * 1024)
    $rnd = New-Object System.Random(42)
    $stream = [System.IO.File]::Create($filePath)
    $remaining = $sizeBytes
    while ($remaining -gt 0) {
        $toWrite = [System.Math]::Min($remaining, $buffer.Length)
        $rnd.NextBytes($buffer)
        $stream.Write($buffer, 0, $toWrite)
        $remaining -= $toWrite
    }
    $stream.Close()
}

Write-Host "Starting MeshDrop backend on port $port..." -ForegroundColor Yellow

$javaArgs = @(
    "-cp", "$outDir",
    "com.meshdrop.Main",
    "--tcp-port", "64991",
    "--api-port", "$port",
    "--no-discovery",
    "--no-cli",
    "--data-dir", "$testDir"
)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "java"
$psi.Arguments = $javaArgs -join " "
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)

try {
    # Wait for API to be ready
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 200
        try {
            $resp = Invoke-RestMethod -Uri "$apiBase/api/status" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($resp.running -eq $true) {
                $ready = $true
                break
            }
        } catch {}
    }

    if (-not $ready) {
        Write-Error "MeshDrop backend failed to become ready on port $port"
        exit 1
    }

    Write-Host "[READY] Backend running with downloadsDir: $downloadsDir" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # TEST 1: Mobile Client Discovery / Presence
    # -------------------------------------------------------------------------
    Write-Host "`n--- TEST 1: Mobile Client Discovery & Peer Injection ---" -ForegroundColor Yellow
    
    # 1. Ping with mobile header
    $statusResp = Invoke-RestMethod -Uri "$apiBase/api/status" -Method Get -Headers @{ "X-MeshDrop-Client" = "mobile" }
    Write-Host "Pinged backend from mobile client (status: $($statusResp.displayName))"

    # 2. Check peers list includes mobile peer
    $peers = Invoke-RestMethod -Uri "$apiBase/api/peers" -Method Get
    $mobilePeer = $peers | Where-Object { $_.id -eq "00000000-0000-0000-0000-000000000001" }
    if (-not $mobilePeer) {
        Write-Error "Mobile peer was not injected into GET /api/peers"
        exit 1
    }
    Write-Host "[PASS] Mobile peer injected into peers list: $($mobilePeer.displayName) ($($mobilePeer.state))" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # TEST 2: Direction 1 (Phone -> PC) Small File Transfer (64 KB)
    # -------------------------------------------------------------------------
    Write-Host "`n--- TEST 2: Direction 1 (Phone -> PC) Small File Transfer (64 KB) ---" -ForegroundColor Yellow
    $smallUploadFile = Join-Path $mobileDir "mobile_small.txt"
    [System.IO.File]::WriteAllText($smallUploadFile, "Hello from MeshDrop Android Expo mobile app!")
    $smallSha = Get-FileSha256 $smallUploadFile
    $smallBytes = [System.IO.File]::ReadAllBytes($smallUploadFile)

    $uploadUri = "$apiBase/api/transfers/upload?peerId=local&fileName=mobile_small.txt"
    $uploadResp = Invoke-RestMethod -Uri $uploadUri -Method Post -Body $smallBytes -ContentType "application/octet-stream" -Headers @{ "X-MeshDrop-Client" = "mobile" }

    $pcSavedSmall = Join-Path $downloadsDir "mobile_small.txt"
    if (-not (Test-Path $pcSavedSmall)) {
        Write-Error "Small file was not saved to PC downloads folder"
        exit 1
    }
    $pcSavedSmallSha = Get-FileSha256 $pcSavedSmall
    if ($smallSha -ne $pcSavedSmallSha) {
        Write-Error "Small file SHA-256 mismatch: Expected $smallSha, got $pcSavedSmallSha"
        exit 1
    }
    Write-Host "[PASS] Phone -> PC small transfer complete & verified (SHA-256: $pcSavedSmallSha)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # TEST 3: Direction 1 (Phone -> PC) Binary File Transfer
    # -------------------------------------------------------------------------
    $sizeMbStr = "$([math]::Round($SizeBytes / 1MB, 1)) MB"
    Write-Host "`n--- TEST 3: Direction 1 (Phone -> PC) $sizeMbStr Binary File Transfer ---" -ForegroundColor Yellow
    $largeUploadFile = Join-Path $mobileDir "phone_video_payload.bin"
    New-RandomBinaryFile $largeUploadFile $SizeBytes
    $largeUploadSha = Get-FileSha256 $largeUploadFile
    Write-Host "Created $sizeMbStr test file on phone. SHA-256: $largeUploadSha"

    $largeUploadBytes = [System.IO.File]::ReadAllBytes($largeUploadFile)
    $uploadUriLarge = "$apiBase/api/transfers/upload?peerId=local&fileName=phone_video_payload.bin"
    $uploadLargeResp = Invoke-RestMethod -Uri $uploadUriLarge -Method Post -Body $largeUploadBytes -ContentType "application/octet-stream" -Headers @{ "X-MeshDrop-Client" = "mobile" }

    $pcSavedLarge = Join-Path $downloadsDir "phone_video_payload.bin"
    if (-not (Test-Path $pcSavedLarge)) {
        Write-Error "$sizeMbStr file was not saved to PC downloads folder"
        exit 1
    }
    $pcSavedLargeSha = Get-FileSha256 $pcSavedLarge
    if ($largeUploadSha -ne $pcSavedLargeSha) {
        Write-Error "$sizeMbStr file SHA-256 mismatch: Expected $largeUploadSha, got $pcSavedLargeSha"
        exit 1
    }
    Write-Host "[PASS] Phone -> PC $sizeMbStr streaming upload complete & verified (SHA-256: $pcSavedLargeSha)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # TEST 4: Direction 2 (PC -> Phone) Small File Transfer (Text file)
    # -------------------------------------------------------------------------
    Write-Host "`n--- TEST 4: Direction 2 (PC -> Phone) Small File Transfer ---" -ForegroundColor Yellow
    $pcSmallFile = Join-Path $testDir "pc_note.txt"
    [System.IO.File]::WriteAllText($pcSmallFile, "Important document sent from PC to Mobile via MeshDrop HTTP Bridge.")
    $pcSmallSha = Get-FileSha256 $pcSmallFile

    # 1. PC creates transfer offer targeting mobile
    $offerBody = @{
        peerId = "mobile"
        filePath = $pcSmallFile
    } | ConvertTo-Json

    $offerResp = Invoke-RestMethod -Uri "$apiBase/api/transfers" -Method Post -Body $offerBody -ContentType "application/json"
    $txId = $offerResp.transferId
    Write-Host "Created PC -> Mobile transfer offer: $txId (State: $($offerResp.state))"

    if ($offerResp.isMobileTarget -ne $true -or $offerResp.recipient -ne "MOBILE") {
        Write-Error "Transfer is not correctly marked as mobile target"
        exit 1
    }

    # 2. Mobile accepts transfer offer
    $acceptResp = Invoke-RestMethod -Uri "$apiBase/api/transfers/$txId/accept" -Method Post -Headers @{ "X-MeshDrop-Client" = "mobile" }
    Write-Host "Mobile accepted transfer: state = $($acceptResp.state)"

    # 3. Mobile downloads file via streaming GET
    $mobileDownloadedSmall = Join-Path $mobileDir "downloaded_pc_note.txt"
    Invoke-WebRequest -Uri "$apiBase/api/transfers/$txId/download" -OutFile $mobileDownloadedSmall -Headers @{ "X-MeshDrop-Client" = "mobile" }
    
    # 4. Mobile signals completion
    $compResp = Invoke-RestMethod -Uri "$apiBase/api/transfers/$txId/complete" -Method Post -Headers @{ "X-MeshDrop-Client" = "mobile" }

    $mobSmallSha = Get-FileSha256 $mobileDownloadedSmall
    if ($pcSmallSha -ne $mobSmallSha) {
        Write-Error "Downloaded small file SHA mismatch: Expected $pcSmallSha, got $mobSmallSha"
        exit 1
    }
    Write-Host "[PASS] PC -> Phone small transfer complete & verified (SHA-256: $mobSmallSha)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # TEST 5: Direction 2 (PC -> Phone) Binary File Transfer
    # -------------------------------------------------------------------------
    Write-Host "`n--- TEST 5: Direction 2 (PC -> Phone) $sizeMbStr Binary File Transfer ---" -ForegroundColor Yellow
    $pcPayloadFile = Join-Path $testDir "pc_movie_payload.bin"
    New-RandomBinaryFile $pcPayloadFile $SizeBytes
    $pcPayloadSha = Get-FileSha256 $pcPayloadFile
    Write-Host "Created $sizeMbStr file on PC. SHA-256: $pcPayloadSha"

    # 1. PC creates transfer offer targeting mobile
    $offerBody = @{
        peerId = "mobile"
        filePath = $pcPayloadFile
    } | ConvertTo-Json

    $offerResp = Invoke-RestMethod -Uri "$apiBase/api/transfers" -Method Post -Body $offerBody -ContentType "application/json"
    $txId = $offerResp.transferId

    # 2. Mobile accepts transfer
    Invoke-RestMethod -Uri "$apiBase/api/transfers/$txId/accept" -Method Post -Headers @{ "X-MeshDrop-Client" = "mobile" } | Out-Null

    # 3. Mobile streams download to local storage
    $mobileDownloadedPayload = Join-Path $mobileDir "downloaded_pc_movie_payload.bin"
    Invoke-WebRequest -Uri "$apiBase/api/transfers/$txId/download" -OutFile $mobileDownloadedPayload -Headers @{ "X-MeshDrop-Client" = "mobile" }

    # 4. Mobile completes transfer
    Invoke-RestMethod -Uri "$apiBase/api/transfers/$txId/complete" -Method Post -Headers @{ "X-MeshDrop-Client" = "mobile" } | Out-Null

    $mobPayloadSha = Get-FileSha256 $mobileDownloadedPayload
    if ($pcPayloadSha -ne $mobPayloadSha) {
        Write-Error "Downloaded $sizeMbStr file SHA mismatch: Expected $pcPayloadSha, got $mobPayloadSha"
        exit 1
    }
    Write-Host "[PASS] PC -> Phone $sizeMbStr transfer complete & verified (SHA-256: $mobPayloadSha)" -ForegroundColor Green

    Write-Host "`n=================================================" -ForegroundColor Green
    Write-Host " ALL BIDIRECTIONAL TRANSFERS PASSED & VERIFIED! " -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Green

} finally {
    if ($proc -and -not $proc.HasExited) {
        Write-Host "Stopping test backend process (PID: $($proc.Id))..."
        $proc.Kill()
        $proc.WaitForExit(3000)
    }
    Remove-Item -Recurse -Force -Path $testDir -ErrorAction SilentlyContinue
}
