import React, { useState } from 'react';
import { Button } from '../Button/Button';
import { Transfer } from '../../types/Transfer';
import { formatBytes } from '../../utils/formatters';
import './IncomingTransferModal.css';

export interface IncomingTransferModalProps {
  transfer: Transfer | null;
  onAccept: (transferId: string) => Promise<void>;
  onReject: (transferId: string, reason?: string) => Promise<void>;
}

export const IncomingTransferModal: React.FC<IncomingTransferModalProps> = ({
  transfer,
  onAccept,
  onReject,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!transfer) return null;

  const transferId = transfer.transferId || transfer.id;
  const isBusy = isAccepting || isRejecting;

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorMessage(null);
    try {
      await onAccept(transferId);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setErrorMessage(null);
    try {
      await onReject(transferId, 'User declined incoming transfer');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setIsRejecting(false);
    }
  };

  return (
    <div className="modal-backdrop incoming-transfer-backdrop" role="presentation">
      <div
        className="incoming-transfer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-transfer-title"
      >
        <div className="incoming-transfer-header">
          <div className="incoming-transfer-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="incoming-transfer-header-text">
            <h2 id="incoming-transfer-title">Incoming File Transfer</h2>
            <span className="incoming-transfer-subtitle">
              Peer <strong>{transfer.peerName || 'Remote Peer'}</strong> wants to send you a file
            </span>
          </div>
        </div>

        <div className="incoming-transfer-body">
          {errorMessage && (
            <div className="incoming-transfer-error" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="incoming-file-info-card">
            <div className="incoming-file-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="incoming-file-details">
              <span className="incoming-file-name" title={transfer.fileName}>
                {transfer.fileName}
              </span>
              <div className="incoming-file-meta">
                <span className="incoming-file-size">{formatBytes(transfer.fileSize)}</span>
                <span className="incoming-file-peer">From: {transfer.peerName}</span>
              </div>
              {transfer.sha256 && (
                <div className="incoming-file-sha256" title={`SHA-256: ${transfer.sha256}`}>
                  SHA-256: <code>{transfer.sha256.substring(0, 16)}...</code>
                </div>
              )}
            </div>
          </div>

          <p className="incoming-transfer-notice">
            Accepting will download this file into your local <code>storage/</code> folder. Transfers are verified by SHA-256 upon completion.
          </p>
        </div>

        <div className="incoming-transfer-actions">
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={handleReject}
            disabled={isBusy}
            isLoading={isRejecting}
          >
            Decline
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleAccept}
            disabled={isBusy}
            isLoading={isAccepting}
          >
            Accept &amp; Download
          </Button>
        </div>
      </div>
    </div>
  );
};
