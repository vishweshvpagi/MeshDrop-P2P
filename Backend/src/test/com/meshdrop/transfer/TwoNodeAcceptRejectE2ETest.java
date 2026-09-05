package com.meshdrop.transfer;

import com.meshdrop.core.Node;
import com.meshdrop.core.NodeConfig;
import com.meshdrop.core.NodeIdentity;
import com.meshdrop.peer.Peer;
import com.meshdrop.security.HashUtils;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

/**
 * End-to-end integration test verifying the complete FILE_OFFER -> RECEIVER -> ACCEPT/REJECT
 * flow between two live MeshDrop nodes.
 *
 * Tests:
 * 1. FILE_OFFER -> Receiver WAITING_FOR_ACCEPT -> Reject -> FILE_REJECT -> Sender REJECTED.
 * 2. FILE_OFFER -> Receiver WAITING_FOR_ACCEPT -> Accept -> FILE_ACCEPT -> Multi-chunk Streaming -> SHA-256 verified.
 * 3. 5 MB payload end-to-end with bit-for-bit SHA-256 digest match.
 */
public class TwoNodeAcceptRejectE2ETest {

    public void runAll() throws Exception {
        System.out.println("--- Running TwoNodeAcceptRejectE2ETest ---");
        testRejectFlow();
        testAcceptFlow();
        testFiveMegabyteTransferWithSha256();
        System.out.println("--- TwoNodeAcceptRejectE2ETest completed successfully ---");
    }

    private void testRejectFlow() throws Exception {
        Path baseDir = Files.createTempDirectory("two-node-reject-test");
        Path dlA = baseDir.resolve("dlA");
        Path tmpA = baseDir.resolve("tmpA");
        Path dlB = baseDir.resolve("dlB");
        Path tmpB = baseDir.resolve("tmpB");

        NodeIdentity idA = NodeIdentity.createRandom("NodeA-RejectTest");
        NodeIdentity idB = NodeIdentity.createRandom("NodeB-RejectTest");

        NodeConfig configA = NodeConfig.forTesting(0, 0, dlA, tmpA);
        NodeConfig configB = NodeConfig.forTesting(0, 0, dlB, tmpB);

        Node nodeA = new Node(configA, idA);
        Node nodeB = new Node(configB, idB);

        Path sourceFile = baseDir.resolve("reject-me.txt");
        Files.writeString(sourceFile, "This file transfer will be rejected by receiver user.", StandardCharsets.UTF_8);

        try {
            nodeA.start();
            nodeB.start();

            // Disable auto-accept on receiver to simulate user interactive control panel
            nodeB.getFileTransferService().setAutoAccept(false);

            connectNodes(nodeA, nodeB, idA, idB);

            // Node A sends file to Node B
            CompletableFuture<Transfer> sendFuture = nodeA.sendFile(idB.nodeId(), sourceFile);

            // Wait for Node B to receive FILE_OFFER and register it as pending
            UUID pendingTransferId = null;
            long deadline = System.currentTimeMillis() + 5000;
            while (System.currentTimeMillis() < deadline) {
                var pending = nodeB.getFileTransferService().getPendingTransfers();
                if (!pending.isEmpty()) {
                    pendingTransferId = pending.get(0).getTransferId();
                    break;
                }
                Thread.sleep(50);
            }

            assert pendingTransferId != null : "Receiver Node B should have received FILE_OFFER";
            Transfer inboundTransfer = nodeB.getFileTransferService().getTransferManager().getTransfer(pendingTransferId).orElse(null);
            assert inboundTransfer != null : "Receiver inbound transfer must exist";
            assert inboundTransfer.getState() == TransferState.WAITING_FOR_ACCEPT : "Inbound transfer must be in WAITING_FOR_ACCEPT";

            // Receiver user declines transfer
            boolean rejectSuccess = nodeB.rejectTransfer(pendingTransferId, "Declined by user test");
            assert rejectSuccess : "node.rejectTransfer should return true";

            // Verify receiver state transitioned to REJECTED
            assert inboundTransfer.getState() == TransferState.REJECTED : "Receiver transfer should transition to REJECTED";

            // Sender future should complete exceptionally
            try {
                sendFuture.get(5, TimeUnit.SECONDS);
                assert false : "Sender future should have thrown ExecutionException on reject";
            } catch (ExecutionException expected) {
                // Expected
            }

            // Verify sender transfer transitioned to REJECTED
            Transfer senderTransfer = nodeA.getFileTransferService().getTransferManager().getTransfer(pendingTransferId).orElse(null);
            assert senderTransfer != null : "Sender transfer record must exist";
            assert senderTransfer.getState() == TransferState.REJECTED : "Sender transfer should transition to REJECTED";
            assert senderTransfer.getErrorMessage() != null && senderTransfer.getErrorMessage().contains("Rejected") :
                    "Sender transfer error message should indicate rejection: " + senderTransfer.getErrorMessage();

            System.out.println("  [PASS] Reject flow successfully verified");
        } finally {
            nodeA.stop();
            nodeB.stop();
            deleteDir(baseDir);
        }
    }

    private void testAcceptFlow() throws Exception {
        Path baseDir = Files.createTempDirectory("two-node-accept-test");
        Path dlA = baseDir.resolve("dlA");
        Path tmpA = baseDir.resolve("tmpA");
        Path dlB = baseDir.resolve("dlB");
        Path tmpB = baseDir.resolve("tmpB");

        NodeIdentity idA = NodeIdentity.createRandom("NodeA-AcceptTest");
        NodeIdentity idB = NodeIdentity.createRandom("NodeB-AcceptTest");

        NodeConfig configA = NodeConfig.forTesting(0, 0, dlA, tmpA);
        NodeConfig configB = NodeConfig.forTesting(0, 0, dlB, tmpB);

        Node nodeA = new Node(configA, idA);
        Node nodeB = new Node(configB, idB);

        Path sourceFile = baseDir.resolve("accepted-file.txt");
        String content = "Multi-chunk verified content: " + "A".repeat(100_000);
        Files.writeString(sourceFile, content, StandardCharsets.UTF_8);
        String expectedHash = HashUtils.sha256(sourceFile.toFile());

        try {
            nodeA.start();
            nodeB.start();

            // Disable auto-accept on receiver
            nodeB.getFileTransferService().setAutoAccept(false);

            connectNodes(nodeA, nodeB, idA, idB);

            // Node A sends file
            CompletableFuture<Transfer> sendFuture = nodeA.sendFile(idB.nodeId(), sourceFile);

            // Wait for receiver pending offer
            UUID pendingTransferId = null;
            long deadline = System.currentTimeMillis() + 5000;
            while (System.currentTimeMillis() < deadline) {
                var pending = nodeB.getFileTransferService().getPendingTransfers();
                if (!pending.isEmpty()) {
                    pendingTransferId = pending.get(0).getTransferId();
                    break;
                }
                Thread.sleep(50);
            }

            assert pendingTransferId != null : "Receiver Node B should have received FILE_OFFER";
            Transfer inboundTransfer = nodeB.getFileTransferService().getTransferManager().getTransfer(pendingTransferId).orElse(null);
            assert inboundTransfer != null : "Receiver transfer must exist";
            assert inboundTransfer.getState() == TransferState.WAITING_FOR_ACCEPT : "Receiver transfer must be in WAITING_FOR_ACCEPT";

            // Receiver user accepts transfer
            boolean acceptSuccess = nodeB.acceptTransfer(pendingTransferId);
            assert acceptSuccess : "node.acceptTransfer should return true";

            // Sender future should complete successfully
            Transfer completedSenderTransfer = sendFuture.get(10, TimeUnit.SECONDS);
            assert completedSenderTransfer != null : "Completed sender transfer should not be null";
            assert completedSenderTransfer.getState() == TransferState.COMPLETED : "Sender transfer should be COMPLETED";

            // Verify receiver transfer is COMPLETED
            long waitReceiver = System.currentTimeMillis() + 5000;
            while (System.currentTimeMillis() < waitReceiver && inboundTransfer.getState() != TransferState.COMPLETED) {
                Thread.sleep(50);
            }
            assert inboundTransfer.getState() == TransferState.COMPLETED : "Receiver transfer should be COMPLETED";

            // Verify file on disk on Node B
            Path receivedFile = dlB.resolve("accepted-file.txt");
            assert Files.exists(receivedFile) : "Received file must exist on receiver disk: " + receivedFile;
            assert Files.size(receivedFile) == Files.size(sourceFile) : "Received file size mismatch";
            assert HashUtils.sha256(receivedFile.toFile()).equalsIgnoreCase(expectedHash) : "SHA-256 hash mismatch on receiver";

            System.out.println("  [PASS] Accept flow with SHA-256 verification successfully verified");
        } finally {
            nodeA.stop();
            nodeB.stop();
            deleteDir(baseDir);
        }
    }

    private void testFiveMegabyteTransferWithSha256() throws Exception {
        Path baseDir = Files.createTempDirectory("two-node-5mb-test");
        Path dlA = baseDir.resolve("dlA");
        Path tmpA = baseDir.resolve("tmpA");
        Path dlB = baseDir.resolve("dlB");
        Path tmpB = baseDir.resolve("tmpB");

        NodeIdentity idA = NodeIdentity.createRandom("NodeA-5MB");
        NodeIdentity idB = NodeIdentity.createRandom("NodeB-5MB");

        NodeConfig configA = NodeConfig.forTesting(0, 0, dlA, tmpA);
        NodeConfig configB = NodeConfig.forTesting(0, 0, dlB, tmpB);

        Node nodeA = new Node(configA, idA);
        Node nodeB = new Node(configB, idB);

        // Generate 5 MB file
        Path sourceFile = baseDir.resolve("test-payload-5mb.bin");
        int totalBytes = 5 * 1024 * 1024; // 5 MB
        byte[] buffer = new byte[65536];
        Random rnd = new Random(42); // Deterministic seed for reproducible testing
        try (OutputStream out = Files.newOutputStream(sourceFile)) {
            int written = 0;
            while (written < totalBytes) {
                int toWrite = Math.min(buffer.length, totalBytes - written);
                rnd.nextBytes(buffer);
                out.write(buffer, 0, toWrite);
                written += toWrite;
            }
        }
        String expectedHash = HashUtils.sha256(sourceFile.toFile());

        try {
            nodeA.start();
            nodeB.start();

            nodeB.getFileTransferService().setAutoAccept(false);

            connectNodes(nodeA, nodeB, idA, idB);

            // Node A sends file
            CompletableFuture<Transfer> sendFuture = nodeA.sendFile(idB.nodeId(), sourceFile);

            // Wait for receiver pending offer
            UUID pendingTransferId = null;
            long deadline = System.currentTimeMillis() + 8000;
            while (System.currentTimeMillis() < deadline) {
                var pending = nodeB.getFileTransferService().getPendingTransfers();
                if (!pending.isEmpty()) {
                    pendingTransferId = pending.get(0).getTransferId();
                    break;
                }
                Thread.sleep(50);
            }

            assert pendingTransferId != null : "Receiver Node B should have received FILE_OFFER for 5 MB file";
            Transfer inboundTransfer = nodeB.getFileTransferService().getTransferManager().getTransfer(pendingTransferId).orElse(null);
            assert inboundTransfer != null;
            assert inboundTransfer.getTotalBytes() == totalBytes : "Inbound total bytes mismatch";

            // Accept
            boolean acceptSuccess = nodeB.acceptTransfer(pendingTransferId);
            assert acceptSuccess : "node.acceptTransfer should return true";

            // Sender should finish streaming 5 MB
            Transfer completedSenderTransfer = sendFuture.get(20, TimeUnit.SECONDS);
            assert completedSenderTransfer != null;
            assert completedSenderTransfer.getState() == TransferState.COMPLETED : "Sender transfer should be COMPLETED";

            // Receiver should reach COMPLETED after SHA-256 verification
            long waitReceiver = System.currentTimeMillis() + 10000;
            while (System.currentTimeMillis() < waitReceiver && inboundTransfer.getState() != TransferState.COMPLETED) {
                Thread.sleep(50);
            }
            assert inboundTransfer.getState() == TransferState.COMPLETED : "Receiver transfer state should be COMPLETED, was: " + inboundTransfer.getState();

            // Verify file on receiver disk
            Path receivedFile = dlB.resolve("test-payload-5mb.bin");
            assert Files.exists(receivedFile) : "Received 5 MB file must exist on disk";
            assert Files.size(receivedFile) == totalBytes : "Received 5 MB file size mismatch: " + Files.size(receivedFile) + " vs " + totalBytes;
            String actualHash = HashUtils.sha256(receivedFile.toFile());
            assert actualHash.equalsIgnoreCase(expectedHash) : "SHA-256 mismatch! expected=" + expectedHash + " actual=" + actualHash;

            System.out.println("  [PASS] 5 MB multi-chunk file transfer with SHA-256 verification passed: " + actualHash);
        } finally {
            nodeA.stop();
            nodeB.stop();
            deleteDir(baseDir);
        }
    }

    private void connectNodes(Node nodeA, Node nodeB, NodeIdentity idA, NodeIdentity idB) throws Exception {
        int portA = nodeA.getDiscoveryService().getUdpDiscoveryPort();
        int portB = nodeB.getDiscoveryService().getUdpDiscoveryPort();

        nodeA.getDiscoveryService().sendUnicastBeacon("127.0.0.1", portB);
        nodeB.getDiscoveryService().sendUnicastBeacon("127.0.0.1", portA);

        long deadline = System.currentTimeMillis() + 10_000;
        Peer peerBFromA = null;
        while (System.currentTimeMillis() < deadline) {
            var match = nodeA.getPeerManager().findPeer(idB.nodeId());
            if (match.isPresent() && match.get().isConnected()) {
                peerBFromA = match.get();
                break;
            }
            Thread.sleep(50);
        }
        assert peerBFromA != null : "Node A failed to connect to Node B within timeout";
    }

    private void deleteDir(Path dir) {
        try {
            try (var stream = Files.walk(dir)) {
                stream.sorted((a, b) -> b.compareTo(a)).forEach(p -> {
                    try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }
}
