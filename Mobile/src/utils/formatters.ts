/**
 * Formats byte counts into human-readable strings (B, KB, MB, GB, TB).
 * Supports large 64-bit numbers safely.
 */
export function formatBytes(bytes: number | string | bigint): string {
  let val: number;
  if (typeof bytes === 'bigint') {
    val = Number(bytes);
  } else if (typeof bytes === 'string') {
    val = parseFloat(bytes);
  } else {
    val = bytes;
  }

  if (isNaN(val) || val <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(val) / Math.log(k));
  const clampedI = Math.min(i, units.length - 1);

  if (clampedI === 0) return `${Math.round(val)} B`;

  const formatted = (val / Math.pow(k, clampedI)).toFixed(clampedI >= 2 ? 2 : 1);
  // Strip trailing zeros after decimal if clean
  return `${parseFloat(formatted)} ${units[clampedI]}`;
}

/**
 * Formats transfer speed into human-readable throughput (e.g. 51.5 MB/s).
 */
export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Formats ETA seconds into human-readable remaining time (e.g. "1m 24s", "12s").
 */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '--';
  if (seconds === 0) return '0s';

  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;

  const m = Math.floor(s / 60);
  const remainingS = s % 60;
  if (m < 60) return `${m}m ${remainingS}s`;

  const h = Math.floor(m / 60);
  const remainingM = m % 60;
  return `${h}h ${remainingM}m`;
}

/**
 * Safely calculates progress percentage between 0 and 100.
 */
export function calculatePercentage(transferred: number, total: number): number {
  if (!total || total <= 0 || !transferred || transferred <= 0) return 0;
  if (transferred >= total) return 100;
  const pct = Math.floor((transferred / total) * 100);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Formats a timestamp into relative or local time string.
 */
export function formatTimestamp(timestamp: number | string | null | undefined): string {
  if (!timestamp) return '--';
  try {
    const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--';
  }
}

/**
 * Friendly label for transfer states.
 */
export function formatTransferState(state: string): string {
  switch (state) {
    case 'OFFERING':
      return 'Offering';
    case 'WAITING_FOR_ACCEPT':
      return 'Waiting for Approval';
    case 'ACCEPTED':
      return 'Accepted';
    case 'TRANSFERRING':
      return 'Transferring';
    case 'VERIFYING':
      return 'Verifying Checksum';
    case 'COMPLETED':
      return 'Completed';
    case 'REJECTED':
      return 'Declined';
    case 'FAILED':
      return 'Failed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'TIMED_OUT':
      return 'Timed Out';
    case 'INTERRUPTED':
      return 'Interrupted';
    case 'RESUMABLE':
      return 'Ready to Resume';
    case 'RESUMING':
      return 'Resuming';
    default:
      return state;
  }
}
