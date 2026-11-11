import React from 'react';
import { OrderStatus } from '../types';
import {
  getExpectedNextOrderStatus,
  getOrderStatusMeta,
  ORDER_STATUS_PIPELINE,
} from './crmOrderUtils';

export interface PendingCrmStatusChange {
  orderId: number;
  clientName: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
}

export interface PendingCrmDeleteItem {
  type: 'discount' | 'comment';
  orderId: number;
  clientName: string;
  previewText: string;
  commentId?: string;
}

interface CrmOrderModalsProps {
  pendingStatusChange: PendingCrmStatusChange | null;
  onCancelStatusChange: () => void;
  onConfirmStatusChange: (change: PendingCrmStatusChange) => void;
  pendingDeleteItem: PendingCrmDeleteItem | null;
  onCancelDeleteItem: () => void;
  onConfirmDeleteItem: (target: PendingCrmDeleteItem) => void;
  isDark: boolean;
  theme: Record<string, string>;
}

export default function CrmOrderModals({
  pendingStatusChange,
  onCancelStatusChange,
  onConfirmStatusChange,
  pendingDeleteItem,
  onCancelDeleteItem,
  onConfirmDeleteItem,
  isDark,
  theme: t,
}: CrmOrderModalsProps) {
  return (
    <>
      {pendingStatusChange &&
        (() => {
          const fromMeta = getOrderStatusMeta(pendingStatusChange.fromStatus);
          const toMeta = getOrderStatusMeta(pendingStatusChange.toStatus);
          const expectedNext = getExpectedNextOrderStatus(pendingStatusChange.fromStatus);
          const fromIdx = ORDER_STATUS_PIPELINE.indexOf(pendingStatusChange.fromStatus);
          const toIdx = ORDER_STATUS_PIPELINE.indexOf(pendingStatusChange.toStatus);
          const isSkippedForward = fromIdx >= 0 && toIdx > fromIdx + 1 && expectedNext !== null;

          const reasonMessage =
            pendingStatusChange.toStatus === 'cancelled'
              ? 'Вы переводите заказ в статус «Отменён». Подтвердите действие.'
              : isSkippedForward && expectedNext
              ? `Выбран статус не по порядку (следующий этап — «${getOrderStatusMeta(expectedNext).label}»). Вы уверены, что хотите пропустить промежуточный этап?`
              : `Вы возвращаете заказ на предыдущий этап («${toMeta.label}»). Подтвердите действие.`;

          return (
            <div
              data-testid="crm-status-confirm-modal"
              onClick={onCancelStatusChange}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9500,
                background: 'rgba(0, 0, 0, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Подтверждение смены статуса"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  borderTop: '4px solid #F59E0B',
                  borderRadius: 4,
                  maxWidth: 460,
                  width: '100%',
                  padding: '20px 22px',
                  boxShadow: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.text }}>
                    Подтверждение смены статуса
                  </h3>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.subText }}>
                    Заказ №{pendingStatusChange.orderId} ({pendingStatusChange.clientName})
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 3,
                    background: t.subCardBg,
                    border: `1px solid ${t.softBorder || t.border}`,
                  }}
                >
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 2,
                      fontSize: 12,
                      fontWeight: 700,
                      background: isDark ? fromMeta.bgDark : fromMeta.bgLight,
                      color: isDark ? fromMeta.color : fromMeta.border,
                      border: `1px solid ${fromMeta.border}`,
                    }}
                  >
                    {fromMeta.label}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: t.subText }}>→</span>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 2,
                      fontSize: 12,
                      fontWeight: 700,
                      background: isDark ? toMeta.bgDark : toMeta.bgLight,
                      color: isDark ? toMeta.color : toMeta.border,
                      border: `1px solid ${toMeta.border}`,
                    }}
                  >
                    {toMeta.label}
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    color: t.text,
                    lineHeight: 1.5,
                  }}
                >
                  {reasonMessage}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <button
                    type="button"
                    data-testid="crm-status-confirm-cancel"
                    onClick={onCancelStatusChange}
                    style={{
                      height: 36,
                      padding: '0 14px',
                      borderRadius: 2,
                      border: `1px solid ${t.border}`,
                      background: t.subCardBg,
                      color: t.text,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    data-testid="crm-status-confirm-submit"
                    onClick={() => onConfirmStatusChange(pendingStatusChange)}
                    style={{
                      height: 36,
                      padding: '0 16px',
                      borderRadius: 2,
                      border: 'none',
                      background: '#C02721',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Подтвердить смену статуса
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {pendingDeleteItem && (
        <div
          data-testid="crm-delete-item-confirm-modal"
          onClick={onCancelDeleteItem}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              pendingDeleteItem.type === 'discount'
                ? 'Подтверждение удаления скидки'
                : 'Подтверждение удаления комментария'
            }
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderTop: '4px solid #F59E0B',
              borderRadius: 4,
              maxWidth: 460,
              width: '100%',
              padding: '20px 22px',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.text }}>
                {pendingDeleteItem.type === 'discount'
                  ? 'Подтверждение удаления скидки'
                  : 'Подтверждение удаления комментария'}
              </h3>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.subText }}>
                Заказ №{pendingDeleteItem.orderId} ({pendingDeleteItem.clientName})
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: '10px 12px',
                borderRadius: 3,
                background: t.subCardBg,
                border: `1px solid ${t.softBorder || t.border}`,
                fontSize: 12.5,
                color: t.text,
              }}
            >
              <span style={{ fontWeight: 700, color: isDark ? '#F87171' : '#C02721' }}>
                {pendingDeleteItem.type === 'discount'
                  ? `Скидка ${pendingDeleteItem.previewText}`
                  : `Комментарий: «${pendingDeleteItem.previewText}»`}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: t.text,
                lineHeight: 1.5,
              }}
            >
              {pendingDeleteItem.type === 'discount'
                ? 'Скидка будет сброшена до 0%, а итоговая сумма заказа пересчитана по базовой стоимости. Вы уверены, что хотите удалить скидку?'
                : 'Вы уверены, что хотите удалить этот комментарий к заказу?'}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                data-testid="crm-delete-item-confirm-cancel"
                onClick={onCancelDeleteItem}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  background: t.subCardBg,
                  color: t.text,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                data-testid="crm-delete-item-confirm-submit"
                onClick={() => onConfirmDeleteItem(pendingDeleteItem)}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 2,
                  border: 'none',
                  background: '#C02721',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {pendingDeleteItem.type === 'discount' ? 'Удалить скидку' : 'Удалить комментарий'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
