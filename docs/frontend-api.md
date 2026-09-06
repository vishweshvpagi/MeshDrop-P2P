# MeshDrop Control API Specification

The MeshDrop Control API is a local HTTP service hosted directly by the Java core node (`com.meshdrop.api.HttpControlServer`). It enables the React desktop control panel to monitor mesh status, query peers, initiate transfers, and manage transfer lifecycle states.

---

## 1. Server Configuration

- **Default Port**: `8080` (configurable via `--api-port <port>`)
- **Transport**: HTTP/1.1 with JSON payloads (`application/json; charset=UTF-8`)
- **Threading Model**: Powered by Java Virtual Threads (`Executors.newVirtualThreadPerTaskExecutor()`)
- **CORS Support**: Permitted origins include `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3001`, `http://127.0.0.1:3001` with full preflight `OPTIONS` handling.

---

## 2. API Endpoints

### 2.1 System & Status

#### `GET /api/status`
Retrieves local node identity, state, listening ports, uptime, and peer counts.
```json
{
  "nodeId": "e763a6ab-2f80-4b2e-849e-943a01206e37",
  "displayName": "PC-1",
  "running": true,
  "state": "RUNNING",
  "tcpPort": 5000,
  "discoveryPort": 5001,
  "discoveryRunning": true,
  "fingerprint": "3F8B:C74A:92E1:5D03:7A19:44CE:B820:F194",
  "uptimeMillis": 124500,
  "connectionCount": 1,
  "peerCount": 1
}
```

#### `GET /api/system`
Returns system diagnostics, OS information, and configured directories (`downloads`, `temp`).

#### `GET /api/presets`
Returns a list of local file presets available for test file transfers.

#### `POST /api/dialog/open-file`
Opens the host operating system's native file picker (`java.awt.FileDialog`) on non-headless systems and returns the selected absolute file path.
```json
{
  "filePath": "C:\\Users\\VBP\\Desktop\\payload.bin",
  "cancelled": false
}
```

---

### 2.2 Peer Management

#### `GET /api/peers`
Returns all discovered and connected peers.
```json
[
  {
    "id": "52cc2aa0-b464-4b95-8cde-24524d94c4ce",
    "displayName": "PC-2",
    "address": "192.168.1.20",
    "port": 5000,
    "state": "CONNECTED",
    "connected": true,
    "lastSeen": "2026-09-05T13:20:00Z",
    "connectedAt": "2026-09-05T13:18:30Z",
    "fingerprint": "8A91:3C2F:D410:5B82:61AE:39FF:08CD:A14B",
    "trustDecision": "TRUSTED"
  }
]
```

#### `POST /api/peers/{id}/connect`
Initiates an outbound TCP connection and mutual cryptographic handshake with the specified peer.

#### `POST /api/peers/{id}/disconnect`
Closes the active TCP connection with the specified peer.

#### `POST /api/peers/{id}/trust` / `POST /api/peers/{id}/untrust`
Updates the security trust designation for the peer in the local `TrustStore`.

---

### 2.3 Connections

#### `GET /api/connections`
Returns active TCP transport connections.

#### `POST /api/connect`
Initiates an outbound TCP connection to an arbitrary host and port:
```json
{
  "host": "192.168.1.25",
  "port": 5000
}
```

---

### 2.4 File Transfers

#### `GET /api/transfers`
Returns all active and historical file transfers with authoritative reliability capabilities and progress metrics:
```json
[
  {
    "transferId": "4a15ef82-b36d-4919-9061-68939c4a5c0b",
    "fileName": "test500mb.dat",
    "fileSize": 524288000,
    "transferredBytes": 270729216,
    "remainingBytes": 253558784,
    "direction": "OUTGOING",
    "peerId": "52cc2aa0-b464-4b95-8cde-24524d94c4ce",
    "peerName": "PC-2",
    "state": "TRANSFERRING",
    "status": "TRANSFERRING",
    "speedBytesPerSecond": 48234120.0,
    "etaSeconds": 5,
    "progressPercentage": 51.6,
    "errorMessage": null,
    "startTime": 1788614400000,
    "completedTime": 0,
    "sha256": "a08a92258f621b55d08ad1e84c90c2ea6286fc6b6c9a4dfa7156afb16c190170",
    "canResume": false,
    "canCancel": true,
    "canRetry": false,
    "canRemove": false,
    "hasCheckpoint": false
  }
]
```

#### `GET /api/transfers/{id}`
Returns details for a single transfer by its UUID.

#### `POST /api/transfers`
Initiates an outbound streaming file transfer to a peer. Asynchronously computes SHA-256 and immediately returns the newly registered transfer in `OFFERING` state.
```json
{
  "peerId": "52cc2aa0-b464-4b95-8cde-24524d94c4ce",
  "filePath": "C:\\Users\\VBP\\Desktop\\payload.bin"
}
```

#### `POST /api/transfers/{id}/accept`
Accepts an incoming file transfer offer (`WAITING_FOR_ACCEPT`). Notifies the sender with `FILE_ACCEPT` to commence chunk transmission.

#### `POST /api/transfers/{id}/reject`
Rejects an incoming file transfer offer. Notifies the sender with `FILE_REJECT`.

#### `POST /api/transfers/{id}/resume`
Resumes an interrupted or paused transfer from the last verified byte checkpoint on disk.

#### `POST /api/transfers/{id}/cancel`
Cancels an active transfer and notifies the remote peer.

#### `POST /api/transfers/{id}/retry`
Restarts a failed outbound transfer from byte 0.

#### `POST /api/transfers/{id}/interrupt`
Deterministically pauses/interrupts an active transfer, saving an on-disk `.meta` checkpoint for resumption testing.

#### `DELETE /api/transfers/{id}`
Removes a finished transfer (`COMPLETED`, `CANCELLED`, `FAILED`, `REJECTED`) from active node memory. Downloaded files on disk remain untouched.
