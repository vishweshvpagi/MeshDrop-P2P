import React, { useEffect, useState } from 'react';
import { Transfer, TransferState } from '../../types/Transfer';
import './ToastContainer.css';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
}

export interface ToastContainerProps {
  transfers?: Transfer[];
}

// Global registry to dispatch custom toast events from anywhere
const listeners = new Set<(toast: ToastMessage) => void>();

export function showToast(type: ToastMessage['type'], title: string, message: string) {
  const toast: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    title,
    message,
    timestamp: Date.now(),
  };
  listeners.forEach((l) => l(toast));
}

// Keep track of notified transfer states across the session so we don't spam
const notifiedSet = new Set<string>();

export const ToastContainer: React.FC<ToastContainerProps> = ({ transfers = [] }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleNewToast = (toast: ToastMessage) => {
      setToasts((prev) => [toast, ...prev].slice(0, 5));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5500);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  // Monitor transfers array to trigger notifications according to Part 24
  useEffect(() => {
    transfers.forEach((t) => {
      const id = t.transferId || t.id;
      const state: TransferState = t.state || t.status;
      const key = `${id}:${state}`;

      if (notifiedSet.has(key)) return;
      notifiedSet.add(key);

      const isIncoming = t.direction === 'INCOMING' || t.direction === 'DOWNLOAD';

      switch (state) {
        case 'WAITING_FOR_ACCEPT':
          if (isIncoming) {
            showToast('info', 'Incoming File Transfer', `${t.peerName || 'A peer'} wants to send you ${t.fileName}`);
          }
          break;
        case 'ACCEPTED':
        case 'TRANSFERRING':
          if (isIncoming && !notifiedSet.has(`${id}:started`)) {
            notifiedSet.add(`${id}:started`);
            showToast('info', 'Transfer Accepted', `Receiving ${t.fileName}`);
          }
          break;
        case 'COMPLETED':
          showToast('success', 'Transfer Completed', `${t.fileName} received successfully`);
          break;
        case 'REJECTED':
          showToast('warning', 'Transfer Rejected', isIncoming ? `Declined ${t.fileName}` : `Transfer of ${t.fileName} rejected`);
          break;
        case 'FAILED':
        case 'TIMED_OUT':
          showToast('error', 'Transfer Failed', `Transfer of ${t.fileName} failed${t.errorMessage ? `: ${t.errorMessage}` : ''}`);
          break;
        case 'RESUMABLE':
          showToast('warning', 'Transfer Resumable', `${t.fileName} can be resumed`);
          break;
        default:
          break;
      }
    });
  }, [transfers]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="meshdrop-toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`meshdrop-toast toast-${toast.type}`}
          role="alert"
          onClick={() => dismissToast(toast.id)}
        >
          <div className="toast-icon-col" aria-hidden="true">
            {toast.type === 'success' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            {toast.type === 'warning' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
          </div>
          <div className="toast-content-col">
            <span className="toast-title">{toast.title}</span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              dismissToast(toast.id);
            }}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};
