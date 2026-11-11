import { OrderStatus, PaymentStatus } from '../types';

export interface OrderStatusMeta {
  id: OrderStatus;
  label: string;
  shortLabel: string;
  color: string;
  bgDark: string;
  bgLight: string;
  border: string;
}

export const ORDER_STATUS_LIST: OrderStatusMeta[] = [
  {
    id: 'new',
    label: 'Создан',
    shortLabel: 'Создан',
    color: '#38BDF8',
    bgDark: 'rgba(56, 189, 248, 0.14)',
    bgLight: '#E0F2FE',
    border: '#0284C7',
  },
  {
    id: 'awaiting_payment',
    label: 'Ждёт оплаты',
    shortLabel: 'Ждёт оплаты',
    color: '#F59E0B',
    bgDark: 'rgba(245, 158, 11, 0.16)',
    bgLight: '#FEF3C7',
    border: '#D97706',
  },
  {
    id: 'prepress',
    label: 'Оплачен',
    shortLabel: 'Оплачен',
    color: '#A855F7',
    bgDark: 'rgba(168, 85, 247, 0.16)',
    bgLight: '#F3E8FF',
    border: '#9333EA',
  },
  {
    id: 'in_progress',
    label: 'В работе',
    shortLabel: 'В работе',
    color: '#E54D47',
    bgDark: 'rgba(192, 39, 33, 0.22)',
    bgLight: '#FEE2E2',
    border: '#C02721',
  },
  {
    id: 'ready',
    label: 'Готов к выдаче',
    shortLabel: 'Готов к выдаче',
    color: '#10B981',
    bgDark: 'rgba(16, 185, 129, 0.16)',
    bgLight: '#D1FAE5',
    border: '#059669',
  },
  {
    id: 'completed',
    label: 'Выполнен',
    shortLabel: 'Выполнен',
    color: '#64748B',
    bgDark: 'rgba(100, 116, 139, 0.18)',
    bgLight: '#F1F5F9',
    border: '#64748B',
  },
  {
    id: 'cancelled',
    label: 'Отменён',
    shortLabel: 'Отменён',
    color: '#EF4444',
    bgDark: 'rgba(239, 68, 68, 0.14)',
    bgLight: '#FEF2F2',
    border: '#DC2626',
  },
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Не оплачен',
  partial: 'Частично оплачен',
  paid: 'Оплачен 100%',
};

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return ORDER_STATUS_LIST.find((s) => s.id === status) || ORDER_STATUS_LIST[0];
}

export const ORDER_STATUS_PIPELINE: OrderStatus[] = [
  'new',
  'awaiting_payment',
  'prepress',
  'in_progress',
  'ready',
  'completed',
];

export function getExpectedNextOrderStatus(currentStatus: OrderStatus): OrderStatus | null {
  const idx = ORDER_STATUS_PIPELINE.indexOf(currentStatus);
  if (idx >= 0 && idx < ORDER_STATUS_PIPELINE.length - 1) {
    return ORDER_STATUS_PIPELINE[idx + 1];
  }
  return null;
}

export function isSequentialOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }
  if (nextStatus === 'cancelled' || currentStatus === 'cancelled') {
    return false;
  }
  return getExpectedNextOrderStatus(currentStatus) === nextStatus;
}

export function buildDefault24hDeadline(baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  if (target.getHours() < 10) {
    target.setHours(10, 0, 0, 0);
  } else if (target.getHours() > 18 || (target.getHours() === 18 && target.getMinutes() > 0)) {
    target.setHours(18, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = target.getFullYear();
  const mm = pad(target.getMonth() + 1);
  const dd = pad(target.getDate());
  const hh = pad(target.getHours());
  const min = pad(target.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function buildOffsetDeadline(hours: number, baseDate: Date = new Date()): string {
  if (hours <= 24) {
    return buildDefault24hDeadline(baseDate);
  }
  const target = new Date(baseDate.getTime());
  target.setDate(target.getDate() + Math.round(hours / 24));
  target.setHours(16, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = target.getFullYear();
  const mm = pad(target.getMonth() + 1);
  const dd = pad(target.getDate());
  return `${yyyy}-${mm}-${dd}T16:00`;
}

export function toDateTimeLocalValue(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T16:00`;
  }
  return trimmed.replace(' ', 'T').slice(0, 16);
}

export function formatDeadlineDisplay(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return '24 ч после оплаты (не подтверждён)';
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!match) {
    return trimmed;
  }
  const [, yyyy, mm, dd, timePart] = match;
  if (timePart) {
    return `${dd}.${mm}.${yyyy}, ${timePart}`;
  }
  return `${dd}.${mm}.${yyyy}`;
}
