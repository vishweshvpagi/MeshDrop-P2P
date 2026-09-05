package com.meshdrop.transfer;

import com.meshdrop.core.Node;
import com.meshdrop.core.NodeConfig;
import com.meshdrop.core.NodeIdentity;
import com.meshdrop.peer.Peer;
import com.meshdrop.security.HashUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Random;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Verifies transfer of a 5 MB file (80 chunks) between two independent nodes.
 */
public class TwoNode5MBTransferTest {

    public static void main(String[] args) throws Exception {
        new TwoNode5MBTransferTest().runAll();
    }

    public void runAll() throws Exception {
        test5MBTransfer();
    }

    private void test5MBTransfer() throws Exception {
        Path baseDir = Files.createTempDirectory("two-node-5mb-");
        Path dlA = baseDir.resolve("dlA");
        Path tmpA = baseDir.resolve("tmpA");
        Path dlB = baseDir.resolve("dlB");
        Path tmpB = baseDir.resolve("tmpB");

        NodeIdentity idA = NodeIdentity.createRandom("Sender5M");
        NodeIdentity idB = NodeIdentity.createRandom("Receiver5M");

        NodeConfig configA = NodeConfig.forTesting(0, 0, dlA, tmpA);
        NodeConfig configB = NodeConfig.forTesting(0, 0, dlB, tmpB);

        Node nodeA = new Node(configA, idA);
        Node nodeB = new Node(configB, idB);

        Path sourceFile = baseDir.resolve("test-5mb.dat");
        int fileSize = 5 * 1024 * 1024; // 5 MB = 80 chunks
        byte[] data = new byte[fileSize];
        new Random(42).nextBytes(data);
        Files.write(sourceFile, data);
        String expectedSha256 = HashUtils.sha256(sourceFile.toFile());

        try {
            nodeA.start();
            nodeB.start();

            int portB = nodeB.getTcpServer().getLocalPort();
            nodeA.connectTo("127.0.0.1", portB);

            long deadline = System.currentTimeMillis() + 5000;
            Peer peerB = null;
            while (System.currentTimeMillis() < deadline) {
                var match = nodeA.getPeerManager().findPeer(idB.nodeId());
                if (match.isPresent() && match.get().isConnected()) {
                    peerB = match.get();
                    break;
                }
                Thread.sleep(50);
            }

            assert peerB != null : "Node A failed to connect to Node B";

            System.out.println("[TEST] Initiating 5MB transfer...");
            CompletableFuture<Transfer> future = nodeA.sendFile(idB.nodeId(), sourceFile);
            Transfer completed = future.get(30, TimeUnit.SECONDS);

            assert completed != null : "Completed transfer is null";
            assert completed.getState() == TransferState.COMPLETED : "Transfer state is " + completed.getState();
            assert completed.getBytesTransferred() == fileSize : "Bytes mismatch: " + completed.getBytesTransferred();

            Path receivedFile = dlB.resolve("test-5mb.dat");
            assert Files.exists(receivedFile) : "Received file missing";
            assert Files.size(receivedFile) == fileSize : "Received file size mismatch";
            assert HashUtils.sha256(receivedFile.toFile()).equalsIgnoreCase(expectedSha256) : "SHA-256 hash mismatch";
            System.out.println("[TEST] 5MB transfer passed successfully!");

        } finally {
            nodeA.stop();
            nodeB.stop();
            deleteDir(baseDir);
        }
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
