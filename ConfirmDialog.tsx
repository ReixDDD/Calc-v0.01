import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface ConfirmRequestOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
  theme: Record<string, string>;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = true,
  onConfirm,
  onCancel,
  isDark,
  theme: t,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmBg = danger ? '#DC2626' : '#C02721';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: t.cardBg,
          color: t.text,
          border: `1px solid ${t.border}`,
          borderTop: `4px solid ${confirmBg}`,
          borderRadius: 4,
          boxShadow: 'none',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxSizing: 'border-box',
        }}
      >
        <h3
          id={titleId}
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            color: t.text,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>

        <p
          id={messageId}
          style={{
            margin: 0,
            fontSize: 13.5,
            color: t.subText,
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 4,
            flexWrap: 'wrap',
          }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            data-testid="confirm-dialog-cancel-btn"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: t.subCardBg,
              color: t.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-dialog-confirm-btn"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 2,
              border: 'none',
              background: confirmBg,
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PendingConfirmState extends ConfirmRequestOptions {
  resolve: (confirmed: boolean) => void;
}

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirmState | null>(null);
  const pendingRef = useRef<PendingConfirmState | null>(null);
  pendingRef.current = pending;

  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false);
        pendingRef.current = null;
      }
    };
  }, []);

  const requestConfirm = useCallback((options: ConfirmRequestOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        if (prev) {
          prev.resolve(false);
        }
        return { ...options, resolve };
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setPending((prev) => {
      if (prev) prev.resolve(true);
      return null;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setPending((prev) => {
      if (prev) prev.resolve(false);
      return null;
    });
  }, []);

  const confirmDialogProps = {
    open: Boolean(pending),
    title: pending?.title || '',
    message: pending?.message || '',
    confirmLabel: pending?.confirmLabel,
    cancelLabel: pending?.cancelLabel,
    danger: pending?.danger ?? true,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return {
    requestConfirm,
    confirmDialogProps,
  };
}
