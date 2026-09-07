# MeshDrop Mobile Client

MeshDrop Mobile is an Android-first mobile client for MeshDrop built with **React Native** and **Expo**. It serves as a mobile control panel and streaming file sender for the existing Java MeshDrop transfer engine.

---

## 🏛 Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Android Phone (MeshDrop Mobile)           │
│                                                         │
│  [Peers]      [Send File]      [Transfers]   [Settings] │
│     │              │                │            │      │
│     │              ▼                │            │      │
│     │     expo-document-picker      │            │      │
│     │              │                │            │      │
│     │              ▼                │            │      │
│     │    expo-file-system (stream)  │            │      │
└─────┼──────────────┼────────────────┼────────────┼──────┘
      │              │                │            │
      │ HTTP GET/POST│ HTTP POST      │ HTTP GET   │ HTTP GET
      │ /api/peers   │ /transfers/    │ /transfers │ /status
      │              │ upload         │            │
      ▼              ▼                ▼            ▼
┌─────────────────────────────────────────────────────────┐
│           Existing Java MeshDrop Backend (PC)           │
│           (HttpControlServer on Port 8080/5000)         │
│                                                         │
│     - Stores streamed uploads in temp/uploads/ (O(1))   │
│     - Runs TCP P2P transfer engine                      │
│     - SHA-256 verification & chunk ACKs                 │
└────────────────────────────┬────────────────────────────┘
                             │ TCP (Wire Protocol)
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     Remote Peer (PC)                    │
└─────────────────────────────────────────────────────────┘
```

The Android phone does **not** run the TCP P2P framing protocol itself. Instead:
1. The phone connects to your local PC running the Java backend over HTTP.
2. When you pick a file to send, `expo-file-system` (`FileSystem.uploadAsync`) streams the binary contents directly from Android storage to the PC backend's `POST /api/transfers/upload` endpoint using 64 KiB chunks ($O(1)$ RAM).
3. The Java backend on the PC handles P2P handshake, chunked TCP transfer, ACKs, resumption, and SHA-256 integrity verification with the recipient peer.

---

## 📱 Screens & Features

1. **Peers Screen**:
   - Lists discovered and connected peers on the LAN from `GET /api/peers`.
   - Displays computer name, address:port, fingerprint, and online/offline badge.
   - Tap any peer to select it as the target for file transfer.
   - Includes "Connect" / "Disconnect" actions and pull-to-refresh.

2. **Send File Screen**:
   - Uses `expo-document-picker` to select any file from Android storage.
   - Displays file name, formatted size, and MIME type.
   - Select destination peer and tap "Send File" to initiate streaming upload.
   - Zero memory buffering: handles multi-gigabyte files without mobile OOM crashes.

3. **Transfers Screen**:
   - Lists active, completed, and failed transfers from `GET /api/transfers`.
   - Real-time animated progress bars, speed in MB/s, and ETA.
   - Filter tabs: `ALL`, `ACTIVE`, `COMPLETED`, `FAILED`.
   - Supports backend actions: Cancel (`/cancel`), Resume (`/resume`), and Remove (`DELETE`).
   - Adaptive polling: polls every 1.5s when active transfers exist, slower when idle.

4. **Incoming Approvals**:
   - Automatically detects incoming transfer offers in `WAITING_FOR_ACCEPT`.
   - Displays prominent alert card and dialog with file details and sender name.
   - Action buttons: `[ Accept & Download ]` and `[ Decline ]`.

5. **Settings Screen**:
   - Configurable Backend Base URL (e.g. `http://192.168.1.50:8080`).
   - Quick presets for Android Emulator (`10.0.2.2:8080`) and Local PC (`127.0.0.1:8080`).
   - "Test Connection" button with latency measurement and live node info display.
   - Persisted via `@react-native-async-storage/async-storage`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Android phone with Expo Go or Android Emulator

### Installation
```bash
cd Mobile
npm install
```

### Running the App
```bash
# Start the Expo development server
npm start

# Run on Android emulator / device
npm run android

# Run in web browser (for UI testing)
npm run web
```

### Connecting to Your PC Backend
1. Start your MeshDrop Java backend on your PC (default port 8080):
   ```powershell
   .\start-meshdrop.ps1 -HttpPort 8080
   ```
2. Find your PC's local Wi-Fi IP address (e.g. `192.168.1.50` using `ipconfig`).
3. Open MeshDrop Mobile $\rightarrow$ **Settings** $\rightarrow$ enter `http://192.168.1.50:8080` (or `http://10.0.2.2:8080` if using the Android Studio emulator).
4. Tap **"Test Connection"** and **"Save & Connect"**. The status indicator in the top navbar will turn green.
