import React from 'react';
import { AuthUser, Settings } from '../types';
import { normalizeRolesList } from '../constants';
import { AdminSectionType, buildAdminPath, buildCrmPath } from '../routing';
import { DesktopNotificationControl } from './HeaderMegaMenu';

interface AdminHeaderNavProps {
  adminSection: AdminSectionType;
  setAdminSection: (section: AdminSectionType) => void;
  navigateTo: (path: string) => void;
  settings: Settings;
  adminUsersCount: number;
  canViewCrmNotifications: boolean;
  canAccessCrm: boolean;
  crmUnreadCount: number;
  currentUser: AuthUser | null;
  isAdminUnlocked: boolean;
  onReturnToCalculator: () => void;
  onLogoutAdmin: () => void;
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
  showToast: (msg: string) => void;
  theme: Record<string, string>;
}

export default function AdminHeaderNav({
  adminSection,
  setAdminSection,
  navigateTo,
  settings,
  adminUsersCount,
  canViewCrmNotifications,
  canAccessCrm,
  crmUnreadCount,
  currentUser,
  isAdminUnlocked,
  onReturnToCalculator,
  onLogoutAdmin,
  isDark,
  setIsDark,
  showToast,
  theme: t,
}: AdminHeaderNavProps) {
  const brandBlue = isDark ? '#E54D47' : '#C02721';
  const rolesCount = normalizeRolesList(settings.roles, settings.role_permissions).length;

  const navItems: Array<{
    section: AdminSectionType;
    testId: string;
    isActive: boolean;
    line1: string;
    line2: string;
  }> = [
    {
      section: 'products',
      testId: 'admin-tab-products',
      isActive: adminSection === 'products',
      line1: 'Категории',
      line2: 'и продукты',
    },
    {
      section: 'materials',
      testId: 'admin-tab-materials',
      isActive: adminSection === 'materials' || adminSection === 'add_material',
      line1: 'База материалов',
      line2: 'и ЗИП',
    },
    {
      section: 'markups',
      testId: 'admin-tab-markups',
      isActive: adminSection === 'markups',
      line1: 'Коэффициенты',
      line2: 'наценки',
    },
    {
      section: 'users',
      testId: 'admin-tab-users',
      isActive: adminSection === 'users',
      line1: 'Пользователи',
      line2: `(${adminUsersCount})`,
    },
    {
      section: 'roles',
      testId: 'admin-tab-roles',
      isActive: adminSection === 'roles',
      line1: 'Роли и права',
      line2: `(${rolesCount})`,
    },
    {
      section: 'discounts',
      testId: 'admin-tab-discounts',
      isActive: adminSection === 'discounts',
      line1: 'Скидки',
      line2: 'и комментарии',
    },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', zIndex: 900 }}>
      {/* Верхний ряд — сервисная полоса */}
      <div
        className="ui-header-top-bar"
        style={{
          width: '100%',
          minHeight: 38,
          background: t.subCardBg || t.cardBg,
          borderBottom: `1px solid ${t.softBorder}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          className="ui-header-system-actions"
          style={{
            width: '100%',
            padding: '0 24px',
            minHeight: 38,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canViewCrmNotifications && (
              <DesktopNotificationControl
                isDark={isDark}
                theme={t}
                showToast={showToast}
                testId="crm-desktop-notifications-btn"
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ui-hover-btn"
              onClick={() => setIsDark(!isDark)}
              style={{
                padding: '5px 10px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                color: t.text,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
              title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              <span>{isDark ? 'Светлая' : 'Тёмная'}</span>
            </button>

            {canAccessCrm && (
              <button
                type="button"
                data-testid="header-crm-btn"
                onClick={() => navigateTo(buildCrmPath())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 2,
                  border: `1px solid ${t.selectedBorder || '#C02721'}`,
                  background: t.selectedBg || '#FEF2F2',
                  color: t.selectedText || '#C02721',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
                title="Открыть доску заказов типографии (/crm)"
              >
                <span>CRM Заказы</span>
                {crmUnreadCount > 0 && (
                  <span
                    data-testid="crm-unread-badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 18,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 999,
                      background: '#C02721',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {crmUnreadCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onReturnToCalculator}
              style={{
                padding: '5px 10px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
                background: t.cardBg,
                color: t.text,
                whiteSpace: 'nowrap',
              }}
            >
              ← В калькулятор
            </button>

            {currentUser && (
              <button
                type="button"
                data-testid="header-user-badge"
                onClick={() => navigateTo('/orders?tab=profile')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  color: t.text,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
                title={`${currentUser.name} (${currentUser.email}) — Открыть личный кабинет`}
              >
                <span>👤 {currentUser.name}</span>
              </button>
            )}

            {(isAdminUnlocked || currentUser) && (
              <button
                type="button"
                data-testid={currentUser ? 'header-logout-btn' : 'header-admin-logout-btn'}
                onClick={onLogoutAdmin}
                style={{
                  padding: '5px 10px',
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  background: t.cardBg,
                  color: t.subText,
                  whiteSpace: 'nowrap',
                }}
                title="Выйти из аккаунта"
              >
                Выйти
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Нижний ряд — навигация по разделам админки */}
      <div
        className="ui-header-bar"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 56,
          background: t.cardBg,
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: `1px solid ${t.softBorder}`,
          boxShadow: 'none',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            width: '100%',
            margin: '0 auto',
            padding: '0 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            minHeight: 56,
            gap: 12,
            flexWrap: 'wrap',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 22,
              overflowX: 'auto',
              flex: 1,
            }}
          >
            {navItems.map((item) => (
              <button
                key={item.section}
                type="button"
                data-testid={item.testId}
                className="ui-nav-link"
                onClick={() => {
                  setAdminSection(item.section);
                  navigateTo(buildAdminPath(item.section));
                }}
                style={{
                  background: 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: item.isActive ? `3px solid ${brandBlue}` : '3px solid transparent',
                  padding: '8px 6px 5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: item.isActive ? brandBlue : t.text,
                  fontWeight: 500,
                  fontSize: 13.5,
                  lineHeight: 1.25,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                }}
              >
                <span>{item.line1}</span>
                <span>{item.line2}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
