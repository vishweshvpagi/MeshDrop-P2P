# MeshDrop

> **A decentralized peer-to-peer (P2P) LAN messaging and high-speed file transfer system with zero external backend dependencies and a modern desktop control panel.**

[![Java 26](https://img.shields.io/badge/Java-26-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Backend%20Dependencies-0-success)](https://github.com/)

---

## Architecture Principle

MeshDrop is designed around a clean separation of concerns:

- **Java Backend (`backend/`)**: The **Networking Engine**. Built strictly using Java standard library (`java.base`) with zero third-party dependencies. Manages UDP multicast discovery, TCP connections, Ed25519 identity, chunk streaming, resume checkpoints, and SHA-256 verification. Exposes a local, decoupled HTTP Control API (`HttpControlServer`) on port 8080.
- **React Frontend (`frontend/`)**: The **Desktop Control Panel**. A modern, responsive React + TypeScript interface built with Vite. Communicates with the local Java backend engine via REST endpoints to provide real-time peer discovery, active connection monitoring, manual and auto-accept transfers, and live progress tracking.

```text
┌─────────────────────────────────────────────────────────────┐
│                    React Desktop Frontend                   │
│                     (Port 3000 / Vite)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON REST
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Java Backend Engine                     │
│                (HTTP Control Server Port 8080)              │
├─────────────────────────────────────────────────────────────┤
│  • P2P TCP Server (Port 5000)                               │
│  • UDP Multicast Peer Discovery (Port 5001)                 │
│  • Ed25519 Cryptographic Security                           │
│  • Sliding-Window Chunk Streaming (1 MiB chunks)            │
│  • Crash-Resilient .meta Checkpoints & Resumable Transfers  │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quickstart: One-Command Startup

Launch the complete application (Java backend + React frontend) with a single command from the project root:

### Windows PowerShell
```powershell
.\start-meshdrop.ps1
```

### Windows Double-Click / Command Prompt
Double-click `start-meshdrop.bat` in File Explorer, or run:
```cmd
start-meshdrop.bat
```

### Optional Launcher Flags
```powershell
.\start-meshdrop.ps1 -Production  # Run against pre-built production assets
.\start-meshdrop.ps1 -NoBrowser   # Start services without automatically opening browser
.\start-meshdrop.ps1 -BackendPort 8080 -FrontendPort 3000 -TcpPort 5000 -UdpPort 5001
```

The launcher automatically:
1. Validates Java (Java 26 or compatible), Node.js (v18+), and npm prerequisites.
2. Compiles Java backend classes if needed (`backend/out/`).
3. Starts the backend daemon on port 8080.
4. Verifies backend HTTP readiness (`http://127.0.0.1:8080/api/status`).
5. Starts the frontend Vite dev server (or preview server in `-Production` mode) on port 3000.
6. Verifies frontend readiness and opens your default browser.
7. Supervises child processes and cleanly terminates all processes upon `Ctrl+C`.

---

## Features

- **Decentralized Peer Discovery**: Automatic peer discovery on local subnets via UDP multicast packets.
- **Persistent TCP Connections**: Dedicated bidirectional TCP connections with custom 28-byte binary wire protocol framing.
- **Mutual Handshake & Identity**: Cryptographic Ed25519 keypair generation with human-verifiable 32-character hexadecimal fingerprints.
- **Reliable Messaging**: End-to-end delivery acknowledgements (ACKs) and sequence tracking.
- **High-Speed File Transfer**: Sliding-window chunked transfer with bounded heap memory usage regardless of file size.
- **Crash-Resilient & Resumable**: Atomic `.meta` checkpoints and `.part` file recovery allow interrupted transfers to resume seamlessly.
- **End-to-End SHA-256 Verification**: Cryptographic checksum validation on every completed transfer.
- **React Control Panel**: Real-time dashboard, peer explorer, connection manager, transfer queue, and dark/light theme toggle.
- **Local & Offline Operation**: Zero cloud dependencies; operates entirely offline on local networks.

---

## Project Structure

```text
meshdropProject/
│
├── Backend/                        # Java 26 Networking Engine (zero dependencies)
│   ├── src/com/meshdrop/           # Core Java source files
│   │   ├── api/                    # HTTP Control Server & JSON utils
│   │   ├── cli/                    # Interactive command line interface
│   │   ├── core/                   # Node lifecycle and configuration
│   │   ├── discovery/              # UDP Multicast peer discovery
│   │   ├── network/                # TCP Server, ConnectionManager, sockets
│   │   ├── peer/                   # Peer models and lifecycle
│   │   ├── protocol/               # 28-byte packet framing and codecs
│   │   ├── security/               # Ed25519 cryptography and trust store
│   │   ├── storage/                # StorageManager and directory isolation
│   │   └── transfer/               # Chunk streaming, checkpoints, and resume
│   ├── scripts/                    # Automation scripts (build, test, run, demo)
│   └── out/                        # Compiled class bytecode
│
├── Frontend/                       # React 18 + Vite Control Panel
│   ├── src/
│   │   ├── components/             # UI components (Transfers, Peers, Dialogs)
│   │   ├── context/                # Global contexts (Toast, Theme)
│   │   ├── hooks/                  # Custom React hooks (usePeers, useTransfers)
│   │   ├── pages/                  # Dashboard, Peers, Transfers pages
│   │   ├── services/               # HTTP API client for backend engine
│   │   └── types/                  # TypeScript interfaces and models
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                           # Architecture, Protocol, and Transfer Specs
│   ├── architecture.md             # Subsystems, concurrency, and component hierarchy
│   ├── protocol.md                 # 28-byte framing, wire types, and UDP discovery
│   ├── file-transfer.md            # Chunking, lifecycle, resume, and SHA-256
│   └── frontend-api.md             # HTTP Control Server REST endpoints
│
├── start-meshdrop.ps1              # Unified single-command launcher
├── start-meshdrop.bat              # Windows batch launcher shortcut
├── README.md                       # Main project documentation
└── .gitignore                      # Git exclusion rules
```

---

## Prerequisites

- **Java**: Java 26 (or compatible modern OpenJDK) on PATH.
- **Node.js**: Node.js v18+ and npm on PATH.
- **OS**: Windows 10/11 with PowerShell 5.1+ or PowerShell 7+.

---

## Developer Instructions

### Backend (Java)

1. **Compile Backend**:
   ```powershell
   cd Backend
   powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
   ```

2. **Run Backend Test Suite**:
   ```powershell
   cd Backend
   powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
   ```

3. **Start Backend Manually (with interactive CLI)**:
   ```powershell
   cd Backend
   java -cp out com.meshdrop.Main --name DevNode --tcp-port 5000 --udp-port 5001 --api-port 8080
   ```

### Frontend (React)

1. **Install Dependencies**:
   ```powershell
   cd Frontend
   npm install
   ```

2. **Run Frontend Tests**:
   ```powershell
   cd Frontend
   npm test
   ```

3. **Build Frontend for Production**:
   ```powershell
   cd Frontend
   npm run build
   ```

4. **Start Vite Dev Server**:
   ```powershell
   cd Frontend
   npm run dev
   ```

---

## Two-Node Local Testing

To verify two distinct nodes discovering each other and exchanging files locally:

1. **Terminal 1 (Alice)**:
   ```powershell
   cd Backend
   java -cp out com.meshdrop.Main --name Alice --tcp-port 5001 --udp-port 5002 --api-port 8081
   ```

2. **Terminal 2 (Bob)**:
   ```powershell
   cd Backend
   java -cp out com.meshdrop.Main --name Bob --tcp-port 5003 --udp-port 5002 --api-port 8082
   ```

3. In either terminal, observe automatic UDP multicast discovery:
   ```text
   [PEER] Discovered new peer: Bob (...) at 127.0.0.1:5003
   ```

4. Send a file from Alice to Bob:
   ```text
   meshdrop> sendfile Bob README.md
   ```

---

## Troubleshooting

- **Port Conflict (8080, 5000, 3000)**: Pass custom ports to the launcher:
  ```powershell
  .\start-meshdrop.ps1 -BackendPort 8085 -FrontendPort 3005 -TcpPort 5010
  ```
- **Java Not Found**: Verify `java -version` returns Java 26 or compatible. Configure `JAVA_HOME` if needed.
- **Node.js Not Found**: Verify `node -v` returns v18+.
- **Logs**: Detailed execution logs are available in `backend/logs/` (`backend.log`, `frontend.log`, `launcher.log`).
