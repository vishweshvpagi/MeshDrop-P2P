export type TransferDirection = 'OUTGOING' | 'INCOMING';

export type TransferState =
  | 'OFFERING'
  | 'WAITING_FOR_ACCEPT'
  | 'ACCEPTED'
  | 'TRANSFERRING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'INTERRUPTED'
  | 'RESUMABLE'
  | 'RESUMING';

export interface Transfer {
  transferId: string;
  id: string;
  fileName: string;
  fileSize: number;
  transferredBytes: number;
  remainingBytes: number;
  direction: TransferDirection;
  peerId: string;
  peerName: string;
  state: TransferState | string;
  status: TransferState | string;
  speedBytesPerSecond: number;
  speed: number;
  etaSeconds: number;
  eta: number;
  progressPercentage: number;
  errorMessage: string | null;
  startTime: number | null;
  completedTime: number | null;
  sha256: string | null;
  canResume?: boolean;
  canCancel?: boolean;
  canRetry?: boolean;
  canRemove?: boolean;
  hasCheckpoint?: boolean;
}
