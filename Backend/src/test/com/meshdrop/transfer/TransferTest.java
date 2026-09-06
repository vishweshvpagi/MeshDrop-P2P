package com.meshdrop.transfer;

import java.util.UUID;

/**
 * Unit tests for Transfer model and progress tracking.
 */
public class TransferTest {

    public void runAll() throws Exception {
        testTransferProgress();
    }

    private void testTransferProgress() {
        FileMetadata metadata = new FileMetadata(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "test.iso",
                1000L,
                System.currentTimeMillis(),
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        );

        Transfer transfer = new Transfer(metadata, TransferDirection.UPLOAD, null);
        assert transfer.getState() == TransferState.OFFERING : "Initial state should be OFFERING";
        assert transfer.getBytesTransferred() == 0 : "Initial bytes should be 0";

        transfer.addBytesTransferred(500L);
        assert Math.abs(transfer.getProgressPercentage() - 50.0) < 0.001 : "Progress should be 50%";
    }
}
