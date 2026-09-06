# MeshDrop Application Protocol Specification

## 1. Overview

MeshDrop communicates across two transport layers:
1. **UDP Multicast (Port 5001)**: Local peer discovery beacon broadcasting.
2. **TCP Unicast (Port 5000)**: Bidirectional peer sessions, mutual authentication, messaging, and high-speed streaming file transfers.

Because TCP is a byte-stream protocol without intrinsic message boundaries, MeshDrop defines a deterministic, fixed-size **28-byte binary header** preceding every packet to provide frame delineation.

---

## 2. TCP Wire Framing (28-Byte Fixed Header)

Every packet sent across a TCP connection adheres strictly to the following 28-byte framing structure followed by $N$ bytes of payload:

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       MAGIC (4 bytes)                         |  0x4D 0x44 0x52 0x50 ("MDRP")
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    VERSION    |     TYPE      |             FLAGS             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        PAYLOAD LENGTH                         |  (Big-Endian uint32)
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                       REQUEST ID (16 bytes)                   +  (UUID: 8 bytes MSB, 8 bytes LSB)
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        PAYLOAD DATA ...                       |  (Variable length, N bytes)
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### Header Fields:
| Field | Size | Data Type | Value / Description |
|---|---|---|---|
| **MAGIC** | 4 bytes | `int` (Big-Endian) | Protocol identifier: `0x4D445250` (ASCII `"MDRP"`). Alien traffic is rejected immediately. |
| **VERSION** | 1 byte | `byte` | Current protocol version: `0x01`. |
| **TYPE** | 1 byte | `byte` | Wire code identifying the `PacketType` (see Table below). |
| **FLAGS** | 2 bytes | `short` (Big-Endian) | Bitmask reserved for transmission flags (`0x0001` Compressed, `0x0002` Urgent, `0x0004` Ack). |
| **PAYLOAD LENGTH** | 4 bytes | `int` (Big-Endian) | Length $N$ of following payload in bytes ($0 \le N \le 16\text{ MiB}$). |
| **REQUEST ID** | 16 bytes | `UUID` (2 x `long`) | 128-bit unique identifier for request/response correlation. |

---

## 3. Packet Types

| Wire Code | Name | Direction | Description |
|---|---|---|---|
| `0x01` | `HELLO` | Outbound | Initiator sends node UUID and display name to remote peer. |
| `0x02` | `HELLO_RESPONSE` | Inbound | Receiver echoes request ID and returns its own identity. |
| `0x03` | `PING` | Bidirectional | Latency probe heartbeat carrying millisecond timestamp. |
| `0x04` | `PONG` | Bidirectional | Latency response echoing probe timestamp and request ID. |
| `0x05` | `BYE` | Bidirectional | Orderly session termination signal with reason code. |
| `0x07` | `MESSAGE` | Bidirectional | End-to-end UTF-8 application text message payload. |
| `0x08` | `MESSAGE_ACK` | Bidirectional | Acknowledgement confirming receipt and display of text message. |
| `0x10` | `FILE_OFFER` | Sender $\rightarrow$ Receiver | Transfers `FileMetadata` (UUID, filename, size, expected SHA-256). |
| `0x11` | `FILE_ACCEPT` | Receiver $\rightarrow$ Sender | Confirms receiver accepted file offer. |
| `0x12` | `FILE_REJECT` | Receiver $\rightarrow$ Sender | Confirms receiver rejected file offer. |
| `0x13` | `FILE_CHUNK` | Sender $\rightarrow$ Receiver | Streamed chunk payload (UUID, chunk index, byte offset, raw bytes). |
| `0x14` | `FILE_CHUNK_ACK`| Receiver $\rightarrow$ Sender | Acknowledgement of chunk receipt and on-disk staging. |
| `0x15` | `FILE_COMPLETE` | Sender $\rightarrow$ Receiver | Signals all chunks transmitted; carries final authorative SHA-256. |
| `0x16` | `FILE_COMPLETE_ACK`| Receiver $\rightarrow$ Sender | Confirms SHA-256 verified and file committed to `downloads/`. |
| `0x17` | `FILE_RESUME_OFFER`| Either $\rightarrow$ Either | Inquires about resuming interrupted transfer with cached progress. |
| `0x18` | `FILE_RESUME_ACCEPT`| Either $\rightarrow$ Either | Confirms resume offset; resumes stream from specified byte offset. |
| `0x1F` | `FILE_ERROR` | Bidirectional | Reports irrecoverable transfer abort (disk full, hash mismatch). |

---

## 4. UDP Multicast Discovery Wire Format

Discovery beacons are broadcast periodically over UDP multicast (`239.255.77.80:5001`) with a 26-byte binary header followed by the UTF-8 node display name:

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       MAGIC (4 bytes)                         |  0x4D 0x44 0x52 0x50 ("MDRP")
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    VERSION    |  MSG TYPE(0x06)|          TCP PORT            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                       NODE ID (16 bytes)                      +  (UUID: 8 bytes MSB, 8 bytes LSB)
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          NAME LENGTH          |       DISPLAY NAME ...        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Header Size**: 26 bytes fixed.
- **Max Packet Size**: 512 bytes (avoids UDP fragmentation).
- **Display Name**: Capped at 128 UTF-8 bytes.
