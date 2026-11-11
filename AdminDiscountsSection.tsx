import React, { useMemo, useState } from 'react';
import { CrmOrder } from '../types';
import { getOrderStatusMeta } from './crmOrderUtils';

interface AdminDiscountsSectionProps {
  orders: CrmOrder[];
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
}

export function AdminDiscountsSection({
  orders,
  isDark,
  theme: t,
  inputStyle,
}: AdminDiscountsSectionProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const discountedOrders = useMemo(() => {
    return (orders || []).filter(
      (o) =>
        (Number(o.discount_percent) || 0) > 0 ||
        Boolean((o.discount_comment || '').trim())
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return discountedOrders;
    return discountedOrders.filter((o) => {
      const hay = [
        `#${o.id}`,
        String(o.id),
        o.client_name || '',
        o.client_phone || '',
        o.client_email || '',
        o.discount_author_name || '',
        o.manager_name || '',
        o.discount_comment || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [discountedOrders, searchQuery]);

  const summary = useMemo(() => {
    let totalDiscountRub = 0;
    let totalRevenueRub = 0;
    for (const o of discountedOrders) {
      const sub = Number(o.subtotal_price ?? o.total_price ?? 0) || 0;
      const tot = Number(o.total_price ?? 0) || 0;
      const diff = Math.max(0, sub - tot);
      totalDiscountRub += diff;
      totalRevenueRub += tot;
    }
    return {
      count: discountedOrders.length,
      totalDiscountRub: Math.round(totalDiscountRub),
      totalRevenueRub: Math.round(totalRevenueRub),
    };
  }, [discountedOrders]);

  return (
    <div
      data-testid="admin-discounts-section"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Шапка раздела */}
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
          <h2 style={{ margin: '0 0 4px 0', fontSize: 19, fontWeight: 800, color: t.text }}>
            Скидки и комментарии менеджеров
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: t.subText }}>
            Журнал всех заказов с предоставленными скидками, авторами скидок и обязательными причинами.
          </p>
        </div>
      </div>

      {/* Верхние карточки сводки */}
      <div
        data-testid="admin-discounts-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 3,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
            Заказов со скидкой
          </span>
          <span
            className="tabular-nums"
            style={{ fontSize: 21, fontWeight: 800, color: t.text }}
          >
            {summary.count} шт.
          </span>
        </div>

        <div
          style={{
            background: t.cardBg,
            border: '1px solid #C02721',
            borderLeft: '4px solid #C02721',
            borderRadius: 3,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
            Суммарный объём скидок
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: 21,
              fontWeight: 800,
              color: isDark ? '#F87171' : '#C02721',
            }}
          >
            −{summary.totalDiscountRub.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 3,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: t.subText }}>
            Итоговая выручка по заказам со скидкой
          </span>
          <span
            className="tabular-nums"
            style={{ fontSize: 21, fontWeight: 800, color: t.text }}
          >
            {summary.totalRevenueRub.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      {/* Строка поиска */}
      <div
        style={{
          background: t.cardBg,
          border: `1px solid ${t.border}`,
          borderRadius: 3,
          padding: '12px 16px',
        }}
      >
        <input
          type="text"
          data-testid="admin-discounts-search-input"
          placeholder="Поиск по № заказа, клиенту, менеджеру или тексту причины скидки..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            ...inputStyle,
            width: '100%',
            borderRadius: 2,
          }}
        />
      </div>

      {/* Список / таблица заказов со скидками */}
      <div
        data-testid="admin-discounts-list"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {filteredOrders.length === 0 ? (
          <div
            data-testid="admin-discounts-empty"
            style={{
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderRadius: 3,
              padding: 32,
              textAlign: 'center',
              color: t.subText,
              fontSize: 14,
            }}
          >
            Заказов с назначенными скидками пока нет.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const stMeta = getOrderStatusMeta(order.status);
            const subtotal = Number(order.subtotal_price ?? order.total_price ?? 0) || 0;
            const total = Number(order.total_price ?? 0) || 0;
            const discountRub = Math.max(0, Math.round(subtotal - total));
            const discountPct = Number(order.discount_percent) || 0;
            const authorName = order.discount_author_name || order.manager_name || '—';
            const createdDateStr = order.created_at
              ? new Date(order.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';
            const updatedDateStr = order.discount_updated_at
              ? new Date(order.discount_updated_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={order.id}
                data-testid={`admin-discount-row-${order.id}`}
                style={{
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  borderLeft: '4px solid #C02721',
                  borderRadius: 3,
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  alignItems: 'start',
                }}
              >
                {/* 1. Заказ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
                      Заказ №{order.id}
                    </span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 2,
                        fontSize: 11,
                        fontWeight: 700,
                        background: isDark ? stMeta.bgDark : stMeta.bgLight,
                        color: isDark ? stMeta.color : stMeta.border,
                        border: `1px solid ${stMeta.border}`,
                      }}
                    >
                      {stMeta.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: t.subText }}>
                    Создан: {createdDateStr}
                  </span>
                </div>

                {/* 2. Клиент */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: t.subText }}>
                    Клиент
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                    {order.client_name || 'Не указан'}
                  </span>
                  {(order.client_phone || order.client_email) && (
                    <span style={{ fontSize: 12, color: t.subText }}>
                      {[order.client_phone, order.client_email].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>

                {/* 3. Кто назначил скидку */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: t.subText }}>
                    Кто назначил скидку
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                    {authorName}
                  </span>
                  {updatedDateStr && (
                    <span style={{ fontSize: 11.5, color: t.subText }}>
                      Назначена: {updatedDateStr}
                    </span>
                  )}
                </div>

                {/* 4. Сумма / Скидка */}
                <div
                  className="tabular-nums"
                  style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: t.subText }}>
                    Сумма / Скидка
                  </span>
                  <div style={{ fontSize: 12.5, color: t.subText }}>
                    Без скидки: <b>{Math.round(subtotal).toLocaleString('ru-RU')} ₽</b>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: isDark ? '#F87171' : '#C02721',
                    }}
                  >
                    Скидка: −{discountPct}% (−{discountRub.toLocaleString('ru-RU')} ₽)
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>
                    Итого: {Math.round(total).toLocaleString('ru-RU')} ₽
                  </div>
                </div>

                {/* 5. Комментарий (причина скидки) */}
                <div
                  style={{
                    gridColumn: '1 / -1',
                    background: isDark ? 'rgba(192, 39, 33, 0.14)' : '#FEF2F2',
                    border: '1px solid #C02721',
                    borderRadius: 2,
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      color: isDark ? '#F87171' : '#C02721',
                    }}
                  >
                    Комментарий (причина скидки)
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>
                    {order.discount_comment || '—'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
export default AdminDiscountsSection;
