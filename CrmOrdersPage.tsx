import React, { useEffect, useMemo, useState } from 'react';
import {
  AuthUser,
  CrmOrder,
  CrmOrderComment,
  OrderStatus,
  PaymentStatus,
  RolePermissions,
  UserRole,
} from '../types';
import { apiFetch } from '../apiClient';
import { DEFAULT_ROLE_PERMISSIONS } from '../constants';
import { getMaterialFieldMeta } from '../calculatorUtils';
import { copyTextToClipboard } from './EstimatePanel';

import CrmOrderModals, {
  PendingCrmDeleteItem,
  PendingCrmStatusChange,
} from './CrmOrderModals';
import {
  buildDefault24hDeadline,
  buildOffsetDeadline,
  formatDeadlineDisplay,
  getOrderStatusMeta,
  isSequentialOrderStatusTransition,
  ORDER_STATUS_LIST,
  PAYMENT_STATUS_LABELS,
  toDateTimeLocalValue,
} from './crmOrderUtils';

export * from './crmOrderUtils';

interface CrmOrdersPageProps {
  role: UserRole;
  permissions?: RolePermissions;
  allowedOrderStatuses?: OrderStatus[];
  currentUser?: AuthUser | null;
  onUpdateUser?: (user: AuthUser, token?: string) => void;
  authToken?: string;
  onNotificationsChanged?: () => void;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
  showToast: (msg: string) => void;
  onBackToCatalog: () => void;
  onNavigateToLogin?: () => void;
  onNavigateToOrders?: () => void;
}

export default function CrmOrdersPage({
  role,
  permissions,
  allowedOrderStatuses,
  currentUser,
  authToken,
  onNotificationsChanged,
  isDark,
  theme: t,
  inputStyle,
  showToast,
  onBackToCatalog,
  onNavigateToLogin,
  onNavigateToOrders,
}: CrmOrdersPageProps) {
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [discountDrafts, setDiscountDrafts] = useState<
    Record<number, { percent: number; comment: string }>
  >({});
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<number, string>>({});
  const [expandedOrderItemsIds, setExpandedOrderItemsIds] = useState<Record<number, boolean>>({});
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingCrmStatusChange | null>(
    null
  );
  const [pendingDeleteItem, setPendingDeleteItem] = useState<PendingCrmDeleteItem | null>(null);

  useEffect(() => {
    if (!pendingStatusChange && !pendingDeleteItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingStatusChange(null);
        setPendingDeleteItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingStatusChange, pendingDeleteItem]);

  const toggleOrderItemsExpanded = (orderId: number) => {
    setExpandedOrderItemsIds((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const isManager = role === 'manager' || currentUser?.role === 'manager';
  const isAdmin = role === 'admin' || currentUser?.role === 'admin';
  const effectivePermissions: RolePermissions =
    role === 'client' || currentUser?.role === 'client'
      ? DEFAULT_ROLE_PERMISSIONS.client
      : isAdmin
      ? DEFAULT_ROLE_PERMISSIONS.admin
      : permissions || DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.client;
  const hasCrmAccess = Boolean(
    authToken &&
      currentUser &&
      role !== 'client' &&
      currentUser.role !== 'client' &&
      (isAdmin || effectivePermissions.view_crm)
  );
  const canUpdateStatus = Boolean(effectivePermissions.update_order_status);
  const effectiveAllowedStatuses: OrderStatus[] = isAdmin
    ? ORDER_STATUS_LIST.map((s) => s.id)
    : allowedOrderStatuses || ORDER_STATUS_LIST.map((s) => s.id);
  const canSeeFinances = Boolean(effectivePermissions.manage_order_finances);
  const canApplyDiscount = Boolean(effectivePermissions.apply_discounts);
  const canSeeInternalMetrics = Boolean(effectivePermissions.view_internal_metrics);
  const canSeeSra3Tech = role === 'production' || isAdmin || canSeeInternalMetrics;
  const canDeleteOrder = Boolean(effectivePermissions.delete_orders);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/crm/orders', {
        token: authToken,
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.error || 'Не удалось загрузить заказы CRM');
        setOrders([]);
        return;
      }
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch {
      setError('Ошибка соединения с сервером при загрузке CRM');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasCrmAccess) {
      setOrders([]);
      setLoading(false);
      return;
    }
    fetchOrders();
  }, [hasCrmAccess, role, authToken]);

  const handleUpdateOrder = async (
    orderId: number,
    patch: Partial<CrmOrder>,
    toastMsg?: string
  ) => {
    try {
      const res = await apiFetch(`/crm/orders/${orderId}`, {
        method: 'PUT',
        token: authToken,
        json: patch,
      });
      const updated = await res.json().catch(() => null);
      if (!res.ok || !updated) {
        showToast(updated?.error || 'Не удалось обновить заказ');
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      onNotificationsChanged?.();
      if (toastMsg) {
        showToast(toastMsg);
      }
    } catch {
      showToast('Ошибка сети при сохранении заказа');
    }
  };

  const handleClaimOrder = async (orderId: number) => {
    try {
      const res = await apiFetch(`/crm/orders/${orderId}/claim`, {
        method: 'POST',
        token: authToken,
      });
      const updated = await res.json().catch(() => null);
      if (!res.ok || !updated) {
        showToast(updated?.error || 'Не удалось взять заказ в работу');
        void fetchOrders(true);
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      onNotificationsChanged?.();
      showToast(`Заказ №${orderId} взят в работу и закреплён за вами`);
    } catch {
      showToast('Ошибка сети при взятии заказа в работу');
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    try {
      const res = await apiFetch(`/crm/orders/${orderId}`, {
        method: 'DELETE',
        token: authToken,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || 'Не удалось удалить заказ');
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showToast(`Заказ №${orderId} удалён`);
    } catch {
      showToast('Ошибка сети при удалении заказа');
    }
  };

  const handleCopyCompanyDetails = async (order: CrmOrder) => {
    const cd = order.company_details || {};
    const lines: string[] = [
      `Реквизиты для счёта (Заказ №${order.id})`,
      `Плательщик: ${cd.company_name || order.client_name || '—'}`,
    ];
    if (cd.inn) lines.push(`ИНН: ${cd.inn}`);
    if (cd.kpp) lines.push(`КПП: ${cd.kpp}`);
    if (cd.legal_address) lines.push(`Адрес: ${cd.legal_address}`);
    if (cd.bank_name) lines.push(`Банк: ${cd.bank_name}`);
    if (cd.bik) lines.push(`БИК: ${cd.bik}`);
    if (cd.checking_account) lines.push(`Р/С: ${cd.checking_account}`);
    if (cd.correspondent_account) lines.push(`К/С: ${cd.correspondent_account}`);
    if (cd.phone || order.client_phone) lines.push(`Телефон: ${cd.phone || order.client_phone}`);
    if (order.client_email) lines.push(`Email: ${order.client_email}`);

    await copyTextToClipboard(lines.join('\n'));
    showToast('Реквизиты плательщика скопированы в буфер обмена');
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) {
        return false;
      }
      if (q) {
        const itemsText = (o.items || [])
          .map((it) => `${it.productName} ${it.categoryName} ${it.paperLabel} ${it.formatLabel}`)
          .join(' ');
        const hay = `#${o.id} ${o.id} ${o.client_name} ${o.client_phone} ${o.client_email} ${o.comment} ${itemsText}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };
    for (const st of ORDER_STATUS_LIST) {
      counts[st.id] = 0;
    }
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  // Метрики верхней сводки по ролям
  const summaryMetrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');

    if (canSeeInternalMetrics) {
      const revenue = activeOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const cost = activeOrders.reduce(
        (s, o) => s + (Number(o.internal_metrics?.total_cost) || 0),
        0
      );
      const profit = activeOrders.reduce(
        (s, o) => s + (Number(o.internal_metrics?.profit) || 0),
        0
      );
      return [
        { label: 'Выручка', value: `${Math.round(revenue).toLocaleString('ru-RU')} ₽`, accent: false },
        { label: 'Себестоимость', value: `${Math.round(cost).toLocaleString('ru-RU')} ₽`, accent: false },
        { label: 'Чистая прибыль', value: `${Math.round(profit).toLocaleString('ru-RU')} ₽`, accent: true },
      ];
    }

    if (canSeeFinances) {
      const revenue = activeOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
      const awaitingPaymentCount = orders.filter((o) => o.status === 'awaiting_payment').length;
      return [
        { label: 'Всего заказов', value: `${orders.length}`, accent: false },
        { label: 'Выручка по заказам', value: `${Math.round(revenue).toLocaleString('ru-RU')} ₽`, accent: true },
        { label: 'Ждут оплаты', value: `${awaitingPaymentCount}`, accent: false },
      ];
    }

    // Production / non-financial role: strictly no financial numbers
    const prepressCount = orders.filter((o) => o.status === 'prepress').length;
    const inProgressCount = orders.filter((o) => o.status === 'in_progress').length;
    const readyCount = orders.filter((o) => o.status === 'ready').length;

    return [
      { label: 'Оплачен', value: `${prepressCount}`, accent: false },
      { label: 'В работе', value: `${inProgressCount}`, accent: true },
      { label: 'Готовы к выдаче', value: `${readyCount}`, accent: false },
    ];
  }, [orders, canSeeInternalMetrics, canSeeFinances]);

  if (!hasCrmAccess) {
    const isUnauthenticated = !currentUser || !authToken;
    return (
      <section
        data-testid="crm-orders-page"
        className="ui-no-print"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          data-testid="crm-access-denied"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 4,
            padding: '32px 24px',
            maxWidth: 520,
            margin: '24px auto',
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>
            {isUnauthenticated ? 'Доступ только для сотрудников' : 'Доступ к CRM закрыт'}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: t.subText, lineHeight: 1.5 }}>
            {isUnauthenticated
              ? 'Раздел внутренней CRM-системы типографии доступен только авторизованным сотрудникам. Войдите в рабочий аккаунт для просмотра и обработки заказов.'
              : 'У вашего аккаунта нет прав доступа к внутренней CRM-системе типографии.'}
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            {isUnauthenticated ? (
              onNavigateToLogin && (
                <button
                  type="button"
                  data-testid="crm-login-btn"
                  onClick={onNavigateToLogin}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 2,
                    border: 'none',
                    background: '#C02721',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  Войти в аккаунт
                </button>
              )
            ) : (
              onNavigateToOrders && (
                <button
                  type="button"
                  data-testid="crm-my-orders-btn"
                  onClick={onNavigateToOrders}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 2,
                    border: 'none',
                    background: '#C02721',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  Мои заказы
                </button>
              )
            )}
            <button
              type="button"
              onClick={onBackToCatalog}
              style={{
                padding: '9px 16px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: t.subCardBg,
                color: t.text,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              ← В каталог
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        data-testid="crm-orders-page"
        className="ui-no-print"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Шапка CRM */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 3,
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>
              CRM Управление заказами
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="crm-refresh-btn"
              onClick={() => fetchOrders()}
              style={{
                padding: '8px 13px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: t.subCardBg,
                color: t.text,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              ↻ Обновить
            </button>
            <button
              type="button"
              onClick={onBackToCatalog}
              style={{
                padding: '8px 13px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: t.subCardBg,
                color: t.text,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              ← В калькулятор
            </button>
          </div>
        </div>

        {/* Верхняя сводка по ролям */}
        <div
          data-testid="crm-summary-bar"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          {summaryMetrics.map((m) => (
            <div
              key={m.label}
              style={{
                background: t.cardBg,
                border: m.accent ? '1px solid #C02721' : `1px solid ${t.border}`,
                borderLeft: m.accent ? '4px solid #C02721' : `1px solid ${t.border}`,
                borderRadius: 3,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
                {m.label}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 21,
                  fontWeight: 800,
                  color: m.accent ? (isDark ? '#F87171' : '#C02721') : t.text,
                }}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Фильтры по статусам и строка поиска */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 3,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            data-testid="crm-status-filters"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <button
              type="button"
              data-testid="crm-filter-ALL"
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '7px 12px',
                borderRadius: 2,
                border:
                  statusFilter === 'ALL'
                    ? '1px solid #C02721'
                    : `1px solid ${t.border}`,
                background: statusFilter === 'ALL' ? '#C02721' : t.subCardBg,
                color: statusFilter === 'ALL' ? '#ffffff' : t.text,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Все ({statusCounts.ALL || 0})
            </button>

            {ORDER_STATUS_LIST.map((st) => {
              const active = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  data-testid={`crm-filter-${st.id}`}
                  onClick={() => setStatusFilter(st.id)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 2,
                    border: active ? '1px solid #C02721' : `1px solid ${t.border}`,
                    background: active ? '#C02721' : t.subCardBg,
                    color: active ? '#ffffff' : t.text,
                    fontWeight: active ? 700 : 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {st.label} ({statusCounts[st.id] || 0})
                </button>
              );
            })}
          </div>

          <div>
            <input
              type="text"
              data-testid="crm-search-input"
              placeholder="Поиск по номеру заказа (например 1001), клиенту, телефону или изделию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...inputStyle,
                width: '100%',
                borderRadius: 2,
              }}
            />
          </div>
        </div>

        {/* Список заказов */}
        {loading ? (
          <div
            style={{
              padding: 36,
              textAlign: 'center',
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderRadius: 3,
              color: t.subText,
            }}
          >
            Загрузка заказов CRM...
          </div>
        ) : error ? (
          <div
            style={{
              padding: 24,
              background: t.cardBg,
              border: '1px solid #EF4444',
              borderRadius: 3,
              color: '#EF4444',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            data-testid="crm-empty-state"
            style={{
              padding: 36,
              textAlign: 'center',
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderRadius: 3,
              color: t.subText,
              fontSize: 14,
            }}
          >
            По выбранным фильтрам заказов не найдено.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredOrders.map((order) => {
              const stMeta = getOrderStatusMeta(order.status);
              const createdDateStr = order.created_at
                ? new Date(order.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
              const subtotalPrice = Number(order.subtotal_price ?? order.total_price) || 0;
              const finalTotalPrice = Number(order.total_price) || 0;
              const discountPct = Number(order.discount_percent) || 0;
              const discountAmountRub =
                subtotalPrice > finalTotalPrice
                  ? Math.round(subtotalPrice - finalTotalPrice)
                  : discountPct > 0
                  ? Math.round((subtotalPrice * discountPct) / 100)
                  : 0;

              return (
                <article
                  key={order.id}
                  data-testid={`crm-order-card-${order.id}`}
                  style={{
                    background: t.cardBg,
                    border: `1px solid ${t.border}`,
                    borderLeft: `4px solid ${stMeta.border}`,
                    borderRadius: 3,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {/* Верхняя строка карточки заказа */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingBottom: 12,
                      borderBottom: `1px solid ${t.softBorder}`,
                    }}
                  >
                    {/* Первый (верхний) ряд: номер заказа слева, сумма и статус справа */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: t.text,
                          }}
                        >
                          Заказ №{order.id}
                        </span>

                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: 2,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: isDark ? stMeta.bgDark : stMeta.bgLight,
                            color: isDark ? stMeta.color : stMeta.border,
                            border: `1px solid ${stMeta.border}`,
                          }}
                        >
                          {stMeta.label}
                        </span>

                        {createdDateStr && (
                          <span style={{ fontSize: 12, color: t.subText }}>
                            от {createdDateStr}
                          </span>
                        )}
                      </div>

                      {/* Управление статусом, суммой заказа и действиями */}
                      <div
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        {canSeeFinances && (
                          <div
                            data-testid={`crm-order-total-${order.id}`}
                            className="tabular-nums"
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: t.text,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Сумма заказа: {Math.round(Number(order.total_price) || 0).toLocaleString('ru-RU')} ₽
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
                            Статус:
                          </label>
                          <select
                            data-testid={`crm-status-select-${order.id}`}
                            disabled={!canUpdateStatus || (!isAdmin && effectiveAllowedStatuses.length === 0)}
                            value={order.status}
                            onChange={(e) => {
                              const nextStatus = e.target.value as OrderStatus;
                              if (nextStatus === order.status) return;
                              if (isSequentialOrderStatusTransition(order.status, nextStatus)) {
                                void handleUpdateOrder(
                                  order.id,
                                  { status: nextStatus },
                                  `Статус заказа №${order.id} изменён`
                                );
                              } else {
                                setPendingStatusChange({
                                  orderId: order.id,
                                  clientName: order.client_name || 'Клиент',
                                  fromStatus: order.status,
                                  toStatus: nextStatus,
                                });
                              }
                            }}
                            style={{
                              ...inputStyle,
                              width: 'auto',
                              minWidth: 175,
                              height: 34,
                              padding: '0 10px',
                              fontSize: 12.5,
                              fontWeight: 700,
                              borderRadius: 2,
                              opacity:
                                canUpdateStatus && (isAdmin || effectiveAllowedStatuses.length > 0)
                                  ? 1
                                  : 0.65,
                              cursor:
                                canUpdateStatus && (isAdmin || effectiveAllowedStatuses.length > 0)
                                  ? 'pointer'
                                  : 'not-allowed',
                            }}
                          >
                            {ORDER_STATUS_LIST.map((st) => {
                              const isTargetAllowed =
                                isAdmin ||
                                st.id === order.status ||
                                effectiveAllowedStatuses.includes(st.id);
                              return (
                                <option key={st.id} value={st.id} disabled={!isTargetAllowed}>
                                  {isTargetAllowed ? st.label : `${st.label} (нет доступа)`}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {canDeleteOrder && (
                          <button
                            type="button"
                            data-testid={`crm-delete-order-${order.id}`}
                            onClick={() => handleDeleteOrder(order.id)}
                            style={{
                              height: 34,
                              padding: '0 10px',
                              borderRadius: 2,
                              border: 'none',
                              background: '#EF4444',
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                            title="Удалить заказ"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Второй ряд шапки: информация о клиенте */}
                    <div
                      style={{
                        fontSize: 13.5,
                        color: t.text,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px 12px',
                      }}
                    >
                      <span>Заказчик: {order.client_name || 'Не указан'}</span>
                      <span
                        data-testid={`crm-client-type-${order.id}`}
                        style={{
                          padding: '2px 7px',
                          borderRadius: 2,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background:
                            order.client_type === 'legal'
                              ? isDark
                                ? 'rgba(16, 185, 129, 0.18)'
                                : '#ECFDF5'
                              : t.subCardBg,
                          color:
                            order.client_type === 'legal'
                              ? isDark
                                ? '#34D399'
                                : '#047857'
                              : t.subText,
                          border: `1px solid ${
                            order.client_type === 'legal'
                              ? isDark
                                ? '#10B981'
                                : '#A7F3D0'
                              : t.border
                          }`,
                        }}
                      >
                        {order.client_type === 'legal' ? 'Юр. лицо' : 'Частное лицо'}
                      </span>
                      <span
                        data-testid={`crm-payment-method-${order.id}`}
                        style={{
                          padding: '2px 7px',
                          borderRadius: 2,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: t.subCardBg,
                          color: t.text,
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        {order.payment_method === 'bank_transfer'
                          ? 'Оплата: Безналичный расчёт'
                          : order.payment_method === 'card_on_delivery'
                          ? 'Оплата: Картой при получении'
                          : 'Оплата: Наличные'}
                      </span>
                      {order.client_phone && (
                        <span style={{ color: t.subText, fontWeight: 500 }}>
                          Тел.: {order.client_phone}
                        </span>
                      )}
                      {order.client_email && (
                        <span style={{ color: t.subText, fontWeight: 500 }}>
                          Email: {order.client_email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Позиции заказа (сворачиваемый блок) */}
                  {(() => {
                    const isItemsExpanded = Boolean(expandedOrderItemsIds[order.id]);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          type="button"
                          data-testid={`crm-toggle-items-${order.id}`}
                          onClick={() => toggleOrderItemsExpanded(order.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 2,
                            border: `1px solid ${t.softBorder || t.border}`,
                            background: t.subCardBg,
                            color: t.text,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                              minWidth: 0,
                            }}
                          >
                            <span style={{ fontSize: 11, color: '#C02721', fontWeight: 800 }}>
                              {isItemsExpanded ? '▼' : '▶'}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: t.text,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {canSeeSra3Tech ? 'Спецификация и техкарта позиций' : 'Позиции заказа'} (
                              {order.items.length})
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: t.subText,
                              flexShrink: 0,
                            }}
                          >
                            {isItemsExpanded ? 'Свернуть' : 'Развернуть'}
                          </span>
                        </button>

                        {isItemsExpanded &&
                          order.items.map((item, idx) => {
                            const title = item.categoryName
                              ? `${item.categoryName} — ${item.productName}`
                              : item.productName;
                            const matMeta = getMaterialFieldMeta(item.mainCategoryId);

                            return (
                              <div
                                key={item.id || idx}
                                data-testid={`crm-order-item-${order.id}-${idx}`}
                                style={{
                                  background: t.subCardBg,
                                  border: `1px solid ${t.softBorder}`,
                                  borderRadius: 2,
                                  padding: '10px 12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px' }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                                    {idx + 1}. {title} —{' '}
                                    <span style={{ color: isDark ? '#F87171' : '#C02721' }}>
                                      {item.quantity.toLocaleString('ru-RU')} шт.
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '4px 12px',
                                      fontSize: 12.5,
                                      color: t.subText,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    <span>
                                      <b>Формат:</b> {item.formatLabel}
                                      {item.pagesLabel ? ` (${item.pagesLabel})` : ''}
                                    </span>
                                    {item.paperLabel && (
                                      <span>
                                        <b>{matMeta.quoteTitle}:</b> {item.paperLabel}
                                      </span>
                                    )}
                                    {item.printLabel && (
                                      <span>
                                        <b>Печать:</b> {item.printLabel}
                                      </span>
                                    )}
                                    {item.laminationLabel && item.laminationLabel !== 'Нет' && (
                                      <span>
                                        <b>Ламинация:</b> {item.laminationLabel}
                                      </span>
                                    )}
                                    {item.extraParamsLabel && item.extraParamsLabel !== 'Нет' && (
                                      <span>
                                        <b>Доп. работы:</b> {item.extraParamsLabel}
                                      </span>
                                    )}
                                  </div>

                                  {item.customNote && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: t.selectedText,
                                        background: t.selectedBg,
                                        padding: '3px 8px',
                                        borderRadius: 2,
                                        alignSelf: 'flex-start',
                                      }}
                                    >
                                      Примечание к позиции: {item.customNote}
                                    </div>
                                  )}
                                </div>

                                {/* Правый блок позиции: цена */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    gap: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  {canSeeFinances && item.totalPrice !== undefined && (
                                    <div
                                      className="tabular-nums"
                                      style={{
                                        fontSize: 13.5,
                                        fontWeight: 800,
                                        color: t.text,
                                      }}
                                    >
                                      {Number(item.totalPrice).toLocaleString('ru-RU')} ₽{' '}
                                      {item.unitPrice !== undefined && (
                                        <span style={{ fontSize: 11.5, fontWeight: 500, color: t.subText }}>
                                          ({Number(item.unitPrice).toLocaleString('ru-RU')} ₽/шт.)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })()}

                  {/* Информация о макете, сроке сдачи и комментарии */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingTop: 8,
                      borderTop: `1px dashed ${t.softBorder}`,
                      fontSize: 12.5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ color: t.subText, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Ссылка на макет:
                        </span>
                        {order.design_link ? (
                          order.design_link.startsWith('https://') ? (
                            <a
                              href={order.design_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: isDark ? '#38BDF8' : '#0284C7',
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 320,
                              }}
                            >
                              {order.design_link}
                            </a>
                          ) : (
                            <span style={{ color: t.text, fontWeight: 600 }}>{order.design_link}</span>
                          )
                        ) : (
                          <span style={{ color: t.subText }}>Не указана</span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'nowrap',
                        }}
                      >
                        <span style={{ color: t.subText, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Срок сдачи:
                        </span>
                        {canSeeFinances ? (
                          (() => {
                            const isOrderPaid =
                              order.status === 'prepress' || order.payment_status === 'paid';
                            const savedLocalVal = toDateTimeLocalValue(order.deadline_date);
                            const currentDeadlineVal =
                              deadlineDrafts[order.id] !== undefined
                                ? deadlineDrafts[order.id]
                                : savedLocalVal
                                ? savedLocalVal
                                : isOrderPaid
                                ? buildDefault24hDeadline()
                                : '';

                            const confirmDeadline = (overrideVal?: string) => {
                              const valueToSave = (
                                overrideVal ||
                                currentDeadlineVal ||
                                buildDefault24hDeadline()
                              ).trim();
                              setDeadlineDrafts((prev) => {
                                const next = { ...prev };
                                delete next[order.id];
                                return next;
                              });
                              void handleUpdateOrder(
                                order.id,
                                { deadline_date: valueToSave },
                                'Срок сдачи заказа подтверждён'
                              );
                            };

                            return (
                              <>
                                <input
                                  type="datetime-local"
                                  data-testid={`crm-deadline-input-${order.id}`}
                                  value={currentDeadlineVal}
                                  onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setDeadlineDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: nextVal,
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      confirmDeadline();
                                    }
                                  }}
                                  style={{
                                    ...inputStyle,
                                    width: 'auto',
                                    height: 30,
                                    padding: '0 8px',
                                    fontSize: 12,
                                    borderRadius: 2,
                                    flexShrink: 0,
                                  }}
                                />
                                <button
                                  type="button"
                                  data-testid={`crm-confirm-deadline-${order.id}`}
                                  onClick={() => confirmDeadline()}
                                  style={{
                                    height: 30,
                                    padding: '0 10px',
                                    borderRadius: 2,
                                    border: `1px solid ${t.border}`,
                                    background: t.subCardBg,
                                    color: t.text,
                                    fontWeight: 600,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Сохранить срок
                                </button>
                                <button
                                  type="button"
                                  data-testid={`crm-set-24h-btn-${order.id}`}
                                  onClick={() => {
                                    const next24h = buildDefault24hDeadline();
                                    setDeadlineDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: next24h,
                                    }));
                                  }}
                                  style={{
                                    height: 30,
                                    padding: '0 9px',
                                    borderRadius: 2,
                                    border: `1px solid ${t.border}`,
                                    background: t.subCardBg,
                                    color: t.text,
                                    fontWeight: 700,
                                    fontSize: 11.5,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                  title="Подставить стандартный срок +24 часа от текущего времени"
                                >
                                  +24 ч
                                </button>
                                <button
                                  type="button"
                                  data-testid={`crm-set-3d-btn-${order.id}`}
                                  onClick={() => {
                                    const next3d = buildOffsetDeadline(72);
                                    setDeadlineDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: next3d,
                                    }));
                                  }}
                                  style={{
                                    height: 30,
                                    padding: '0 9px',
                                    borderRadius: 2,
                                    border: `1px solid ${t.border}`,
                                    background: t.subCardBg,
                                    color: t.text,
                                    fontWeight: 700,
                                    fontSize: 11.5,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                  title="Подставить срок +3 дня (72 часа) от текущего времени"
                                >
                                  +3 д.
                                </button>
                                <button
                                  type="button"
                                  data-testid={`crm-set-7d-btn-${order.id}`}
                                  onClick={() => {
                                    const next7d = buildOffsetDeadline(168);
                                    setDeadlineDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: next7d,
                                    }));
                                  }}
                                  style={{
                                    height: 30,
                                    padding: '0 9px',
                                    borderRadius: 2,
                                    border: `1px solid ${t.border}`,
                                    background: t.subCardBg,
                                    color: t.text,
                                    fontWeight: 700,
                                    fontSize: 11.5,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                  title="Подставить срок +7 дней (168 часов) от текущего времени"
                                >
                                  +7 д.
                                </button>
                                {Boolean(order.deadline_date) && (
                                  <span
                                    data-testid={`crm-deadline-confirmed-${order.id}`}
                                    style={{
                                      height: 30,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '0 8px',
                                      borderRadius: 2,
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      background: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                                      color: isDark ? '#34D399' : '#047857',
                                      border: '1px solid #10B981',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                  >
                                    ✓ Подтверждён
                                  </span>
                                )}
                              </>
                            );
                          })()
                        ) : (
                          <span style={{ fontWeight: 700, color: t.text }}>
                            {formatDeadlineDisplay(order.deadline_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(() => {
                        const orderComments: CrmOrderComment[] =
                          Array.isArray(order.comments) && order.comments.length > 0
                            ? order.comments
                            : order.comment
                            ? [
                                {
                                  id: 'cmt_legacy_1',
                                  text: order.comment,
                                  author_name: order.comment_author_name,
                                },
                              ]
                            : [];
                        const currentCommentDraft = commentDrafts[order.id] ?? '';
                        const saveOrderComment = () => {
                          const trimmedText = currentCommentDraft.trim();
                          if (!trimmedText) return;
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [order.id]: '',
                          }));
                          void handleUpdateOrder(
                            order.id,
                            { add_comment: trimmedText } as any,
                            'Комментарий добавлен'
                          );
                        };
                        return (
                          <>
                            {canUpdateStatus && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
                                  Комментарий:
                                </span>
                                <input
                                  type="text"
                                  data-testid={`crm-comment-input-${order.id}`}
                                  value={currentCommentDraft}
                                  placeholder="Комментарий к заказу..."
                                  onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setCommentDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: nextVal,
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveOrderComment();
                                    }
                                  }}
                                  style={{
                                    ...inputStyle,
                                    width: 260,
                                    height: 30,
                                    padding: '0 8px',
                                    fontSize: 12,
                                    borderRadius: 2,
                                  }}
                                />
                                <button
                                  type="button"
                                  data-testid={`crm-save-comment-${order.id}`}
                                  onClick={saveOrderComment}
                                  style={{
                                    height: 30,
                                    padding: '0 11px',
                                    borderRadius: 2,
                                    border: `1px solid ${t.border}`,
                                    background: t.subCardBg,
                                    color: t.text,
                                    fontWeight: 600,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Сохранить комментарий
                                </button>
                              </div>
                            )}

                            {orderComments.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  gap: 6,
                                }}
                              >
                                {orderComments.map((cmt, idx) => (
                                  <div
                                    key={cmt.id}
                                    data-testid={
                                      idx === 0
                                        ? `crm-comment-badge-${order.id}`
                                        : `crm-comment-badge-${order.id}-${cmt.id}`
                                    }
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: 6,
                                      alignSelf: 'flex-start',
                                      maxWidth: '100%',
                                      padding: '4px 10px',
                                      borderRadius: 2,
                                      fontSize: 12,
                                      background: isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9',
                                      border: `1px solid ${t.border}`,
                                      color: t.text,
                                    }}
                                  >
                                    <span>{cmt.text}</span>
                                    {cmt.author_name && (
                                      <span style={{ color: t.subText, fontSize: 11.5 }}>
                                        ({cmt.author_name})
                                      </span>
                                    )}
                                    {canUpdateStatus && (
                                      <button
                                        type="button"
                                        data-testid={`crm-clear-comment-btn-${order.id}-${cmt.id}`}
                                        onClick={() =>
                                          setPendingDeleteItem({
                                            type: 'comment',
                                            orderId: order.id,
                                            clientName: order.client_name || 'Клиент',
                                            previewText: cmt.text,
                                            commentId: cmt.id,
                                          })
                                        }
                                        style={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: 2,
                                          border: 'none',
                                          background: isDark
                                            ? 'rgba(148, 163, 184, 0.2)'
                                            : '#E2E8F0',
                                          color: t.text,
                                          fontWeight: 700,
                                          fontSize: 13,
                                          lineHeight: 1,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          marginLeft: 4,
                                          padding: 0,
                                        }}
                                        title="Удалить комментарий"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Реквизиты для выставления счёта */}
                  {canSeeFinances &&
                    Boolean(
                      order.need_invoice ||
                        order.company_details?.company_name ||
                        order.company_details?.inn ||
                        order.company_details?.checking_account
                    ) && (
                      <div
                        data-testid={`crm-company-details-${order.id}`}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 2,
                          background: t.subCardBg,
                          border: `1px solid ${t.softBorder}`,
                          borderLeft: '3px solid #C02721',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: t.text,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            Реквизиты для выставления счёта (безналичная оплата)
                          </span>

                          <button
                            type="button"
                            data-testid={`crm-copy-company-details-${order.id}`}
                            onClick={() => handleCopyCompanyDetails(order)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 2,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: t.text,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Скопировать реквизиты
                          </button>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                            gap: '4px 14px',
                            fontSize: 12.5,
                            color: t.subText,
                            lineHeight: 1.45,
                          }}
                        >
                          <div>
                            <b>Организация / ИП:</b>{' '}
                            <span style={{ color: t.text, fontWeight: 600 }}>
                              {order.company_details?.company_name || order.client_name || '—'}
                            </span>
                          </div>
                          {(order.company_details?.inn || order.company_details?.kpp) && (
                            <div>
                              <b>ИНН / КПП:</b>{' '}
                              <span className="tabular-nums" style={{ color: t.text, fontWeight: 600 }}>
                                {order.company_details?.inn || '—'}
                                {order.company_details?.kpp ? ` / ${order.company_details.kpp}` : ''}
                              </span>
                            </div>
                          )}
                          {order.company_details?.legal_address && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <b>Адрес:</b>{' '}
                              <span style={{ color: t.text }}>{order.company_details.legal_address}</span>
                            </div>
                          )}
                          {(order.company_details?.bank_name || order.company_details?.bik) && (
                            <div>
                              <b>Банк / БИК:</b>{' '}
                              <span style={{ color: t.text }}>
                                {order.company_details?.bank_name || '—'}
                                {order.company_details?.bik
                                  ? ` (БИК ${order.company_details.bik})`
                                  : ''}
                              </span>
                            </div>
                          )}
                          {order.company_details?.checking_account && (
                            <div>
                              <b>Р/С:</b>{' '}
                              <span className="tabular-nums" style={{ color: t.text }}>
                                {order.company_details.checking_account}
                              </span>
                            </div>
                          )}
                          {order.company_details?.correspondent_account && (
                            <div>
                              <b>К/С:</b>{' '}
                              <span className="tabular-nums" style={{ color: t.text }}>
                                {order.company_details.correspondent_account}
                              </span>
                            </div>
                          )}
                          {order.company_details?.phone && (
                            <div>
                              <b>Тел. бухгалтерии:</b>{' '}
                              <span style={{ color: t.text }}>{order.company_details.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Нижний подвал карточки: скидка, внутренние метрики и взятие заказа в работу */}
                  <div
                    data-testid={`crm-finance-bar-${order.id}`}
                    style={{
                      paddingTop: 10,
                      borderTop: `1px solid ${t.softBorder}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {canSeeFinances &&
                          (Number(order.discount_percent) || 0) > 0 && (
                            <div
                              data-testid={`crm-discount-badge-${order.id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 6,
                                alignSelf: 'flex-start',
                                padding: '4px 10px',
                                borderRadius: 2,
                                fontSize: 12,
                                background: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                                border: '1px solid #10B981',
                                color: t.text,
                              }}
                            >
                              <span style={{ fontWeight: 700, color: isDark ? '#34D399' : '#047857' }}>
                                Скидка −{order.discount_percent}% (−{discountAmountRub.toLocaleString('ru-RU')} ₽):
                              </span>
                              {order.discount_comment && <span>{order.discount_comment}</span>}
                              {order.discount_author_name && (
                                <span style={{ color: t.subText, fontSize: 11.5 }}>
                                  ({order.discount_author_name})
                                </span>
                              )}
                              {canSeeFinances && canApplyDiscount && (
                                <button
                                  type="button"
                                  data-testid={`crm-clear-discount-btn-${order.id}`}
                                  onClick={() =>
                                    setPendingDeleteItem({
                                      type: 'discount',
                                      orderId: order.id,
                                      clientName: order.client_name || 'Клиент',
                                      previewText: `−${order.discount_percent}%${
                                        order.discount_comment ? ` (${order.discount_comment})` : ''
                                      }`,
                                    })
                                  }
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 2,
                                    border: 'none',
                                    background: isDark ? 'rgba(16, 185, 129, 0.24)' : '#D1FAE5',
                                    color: isDark ? '#34D399' : '#047857',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    lineHeight: 1,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: 4,
                                    padding: 0,
                                  }}
                                  title="Удалить скидку"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}

                        {canSeeFinances &&
                          canApplyDiscount &&
                          (Number(order.discount_percent) || 0) <= 0 &&
                          (() => {
                            const currentDraft = discountDrafts[order.id] ?? {
                              percent: Number(order.discount_percent) || 0,
                              comment: order.discount_comment || '',
                            };
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
                                  Скидка (%):
                                </span>
                                <input
                                  type="number"
                                  data-testid={`crm-discount-input-${order.id}`}
                                  min={0}
                                  max={100}
                                  value={currentDraft.percent}
                                  onChange={(e) => {
                                    const nextDisc = Math.max(
                                      0,
                                      Math.min(100, Number(e.target.value) || 0)
                                    );
                                    setDiscountDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        percent: nextDisc,
                                        comment:
                                          prev[order.id]?.comment !== undefined
                                            ? prev[order.id].comment
                                            : order.discount_comment || '',
                                      },
                                    }));
                                  }}
                                  style={{
                                    ...inputStyle,
                                    width: 68,
                                    height: 30,
                                    padding: '0 8px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textAlign: 'right',
                                    borderRadius: 2,
                                  }}
                                />
                                <input
                                  type="text"
                                  data-testid={`crm-discount-comment-input-${order.id}`}
                                  value={currentDraft.comment}
                                  placeholder="Причина скидки (обязательно)..."
                                  onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setDiscountDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        percent:
                                          prev[order.id]?.percent !== undefined
                                            ? prev[order.id].percent
                                            : Number(order.discount_percent) || 0,
                                        comment: nextVal,
                                      },
                                    }));
                                  }}
                                  style={{
                                    ...inputStyle,
                                    width: 240,
                                    height: 30,
                                    padding: '0 8px',
                                    fontSize: 12,
                                    borderRadius: 2,
                                    border:
                                      currentDraft.percent > 0 && !currentDraft.comment.trim()
                                        ? '1px solid #C02721'
                                        : inputStyle.border,
                                  }}
                                />
                                <button
                                  type="button"
                                  data-testid={`crm-apply-discount-btn-${order.id}`}
                                  onClick={() => {
                                    const nextDisc = Math.max(
                                      0,
                                      Math.min(100, Number(currentDraft.percent) || 0)
                                    );
                                    const nextComment = currentDraft.comment.trim();
                                    if (nextDisc > 0 && !nextComment) {
                                      showToast('Укажите комментарий: почему предоставляется скидка');
                                      return;
                                    }
                                    void handleUpdateOrder(
                                      order.id,
                                      {
                                        discount_percent: nextDisc,
                                        discount_comment: nextDisc > 0 ? nextComment : '',
                                      },
                                      nextDisc > 0
                                        ? `Скидка заказа №${order.id} обновлена (${nextDisc}%)`
                                        : `Скидка заказа №${order.id} сброшена`
                                    );
                                  }}
                                  style={{
                                    height: 30,
                                    padding: '0 11px',
                                    borderRadius: 2,
                                    border: `1px solid ${t.border}`,
                                    background: t.subCardBg,
                                    color: t.text,
                                    fontWeight: 600,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Применить скидку
                                </button>
                              </div>
                            );
                          })()}

                        {canSeeInternalMetrics && order.internal_metrics && (
                          <div
                            data-testid={`crm-internal-metrics-${order.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10,
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 2,
                              background: t.subCardBg,
                              border: `1px dashed ${t.border}`,
                            }}
                          >
                            <span>
                              Себестоимость:{' '}
                              <b>{Math.round(order.internal_metrics.total_cost).toLocaleString('ru-RU')} ₽</b>
                            </span>
                            <span>
                              Налог:{' '}
                              <b>{Math.round(order.internal_metrics.tax_cost).toLocaleString('ru-RU')} ₽</b>
                            </span>
                            <span>
                              Скидка:{' '}
                              <b
                                style={{
                                  color:
                                    discountAmountRub > 0
                                      ? isDark
                                        ? '#34D399'
                                        : '#047857'
                                      : t.text,
                                }}
                              >
                                {discountAmountRub > 0
                                  ? `−${discountAmountRub.toLocaleString('ru-RU')} ₽`
                                  : '0 ₽'}
                              </b>
                            </span>
                            <span style={{ color: isDark ? '#4ADE80' : '#16A34A', fontWeight: 700 }}>
                              Прибыль: +{Math.round(order.internal_metrics.profit).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        )}

                        {!canSeeInternalMetrics && canSeeFinances && (
                          <div
                            data-testid={`crm-manager-discount-metrics-${order.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10,
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 2,
                              background: t.subCardBg,
                              border: `1px dashed ${t.border}`,
                            }}
                          >
                            {discountAmountRub > 0 && (
                              <span>
                                Без скидки: <b>{Math.round(subtotalPrice).toLocaleString('ru-RU')} ₽</b>
                              </span>
                            )}
                            <span>
                              Скидка:{' '}
                              <b
                                style={{
                                  color:
                                    discountAmountRub > 0
                                      ? isDark
                                        ? '#34D399'
                                        : '#047857'
                                      : t.text,
                                }}
                              >
                                {discountAmountRub > 0
                                  ? `−${discountAmountRub.toLocaleString('ru-RU')} ₽`
                                  : '0 ₽'}
                              </b>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Правый нижний угол: Свободный заказ / ✋ Взять в работу / Назначенный менеджер */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 8,
                        marginLeft: 'auto',
                      }}
                    >
                      {!order.manager_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            data-testid={`crm-unassigned-badge-${order.id}`}
                            style={{
                              padding: '4px 9px',
                              borderRadius: 2,
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
                              color: isDark ? '#FBBF24' : '#B45309',
                              border: '1px solid #F59E0B',
                            }}
                          >
                            Свободный заказ
                          </span>
                          {currentUser &&
                            currentUser.id &&
                            (role !== 'production' || canSeeFinances || isManager || isAdmin) && (
                              <button
                                type="button"
                                data-testid={`crm-take-order-btn-${order.id}`}
                                onClick={() => handleClaimOrder(order.id)}
                                style={{
                                  height: 34,
                                  padding: '0 12px',
                                  borderRadius: 2,
                                  border: '1px solid #C02721',
                                  background: '#C02721',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                  cursor: 'pointer',
                                }}
                              >
                                ✋ Взять в работу
                              </button>
                            )}
                        </div>
                      ) : (
                        <span
                          data-testid={`crm-assigned-manager-${order.id}`}
                          style={{
                            padding: '4px 9px',
                            borderRadius: 2,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: t.subCardBg,
                            color: t.text,
                            border: `1px solid ${t.border}`,
                          }}
                        >
                          Менеджер: {order.manager_name || `#${order.manager_id}`}
                          {currentUser?.id === order.manager_id ? ' (Вы)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CrmOrderModals
        pendingStatusChange={pendingStatusChange}
        onCancelStatusChange={() => setPendingStatusChange(null)}
        onConfirmStatusChange={(change) => {
          setPendingStatusChange(null);
          void handleUpdateOrder(
            change.orderId,
            { status: change.toStatus },
            `Статус заказа №${change.orderId} изменён`
          );
        }}
        pendingDeleteItem={pendingDeleteItem}
        onCancelDeleteItem={() => setPendingDeleteItem(null)}
        onConfirmDeleteItem={(target) => {
          setPendingDeleteItem(null);
          if (target.type === 'discount') {
            setDiscountDrafts((prev) => ({
              ...prev,
              [target.orderId]: { percent: 0, comment: '' },
            }));
            void handleUpdateOrder(
              target.orderId,
              { discount_percent: 0, discount_comment: '' },
              `Скидка заказа №${target.orderId} удалена`
            );
          } else {
            void handleUpdateOrder(
              target.orderId,
              target.commentId
                ? ({ delete_comment_id: target.commentId } as Partial<CrmOrder>)
                : { comment: '' },
              'Комментарий удалён'
            );
          }
        }}
        isDark={isDark}
        theme={t}
      />
    </>
  );
}
