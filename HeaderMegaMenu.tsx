import React, { useEffect, useRef, useState } from 'react';
import { AuthUser, MainCategory, ProductCategory, ProductItem } from '../types';
import {
  ResilientCatalogImage,
  SubcategoryCardIllustration,
} from './CatalogIllustrations';
import {
  getDesktopNotificationPermission,
  isDesktopNotificationsEnabled,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
  showDesktopNotification,
} from '../desktopNotifications';

export { SubcategoryCardIllustration } from './CatalogIllustrations';

interface HeaderMegaMenuProps {
  mainCategories: MainCategory[];
  subcategories: ProductCategory[];
  products: ProductItem[];
  selectedMainCategoryId: string;
  selectedSubcategoryId: string;
  isMegaMenuOpen: boolean;
  setIsMegaMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectMainCategory: (mainCatId: string, openMenu?: boolean, pushRoute?: boolean) => void;
  onSelectSubcategory: (subCatId: string) => void;
  isDark: boolean;
  setIsDark: (val: boolean) => void;
  isAdminRoute: boolean;
  isAdminUnlocked: boolean;
  isManagerUnlocked?: boolean;
  canViewCrm?: boolean;
  crmUnreadCount?: number;
  currentUser?: AuthUser | null;
  onNavigateToLogin?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToCrm?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToClient: () => void;
  onLogoutAdmin: () => void;
  onLogoutUser?: () => void;
  estimateCount?: number;
  onClickEstimate?: () => void;
  showToast?: (msg: string) => void;
  theme: Record<string, string>;
}

export function DesktopNotificationControl({
  isDark,
  theme: t,
  showToast,
  testId = 'crm-desktop-notifications-btn',
}: {
  isDark: boolean;
  theme: Record<string, string>;
  showToast?: (msg: string) => void;
  testId?: string;
}) {
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getDesktopNotificationPermission()
  );
  const [desktopEnabled, setDesktopEnabled] = useState<boolean>(() =>
    isDesktopNotificationsEnabled()
  );

  const handleRequestDesktopNotifications = async () => {
    const res = await requestDesktopNotificationPermission();
    setDesktopPerm(res);
    setDesktopEnabled(isDesktopNotificationsEnabled());
    if (res === 'granted') {
      showToast?.('Системные уведомления Windows включены');
      showDesktopNotification({
        title: 'CRM Типография',
        body: 'Системные уведомления Windows успешно подключены!',
        tag: 'crm-test-notification',
      });
    } else if (res === 'denied') {
      showToast?.('Уведомления заблокированы в настройках браузера');
    }
  };

  const handleToggleDesktopNotifications = () => {
    const next = !desktopEnabled;
    setDesktopNotificationsEnabled(next);
    setDesktopEnabled(next);
    showToast?.(
      next
        ? 'Системные уведомления Windows включены'
        : 'Системные уведомления Windows выключены'
    );
  };

  if (desktopPerm === 'unsupported') {
    return (
      <span
        data-testid={testId}
        style={{
          padding: '4px 10px',
          borderRadius: 2,
          border: `1px solid ${t.border}`,
          background: t.cardBg,
          color: t.subText,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}
      >
        Системные уведомления не поддерживаются браузером
      </span>
    );
  }

  if (desktopPerm === 'default') {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={() => void handleRequestDesktopNotifications()}
        style={{
          padding: '4px 10px',
          borderRadius: 2,
          border: '1px solid #C02721',
          background: isDark ? 'rgba(192, 39, 33, 0.22)' : '#FEF2F2',
          color: isDark ? '#F87171' : '#C02721',
          fontWeight: 700,
          fontSize: 12,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        🖥️ Включить уведомления Windows
      </button>
    );
  }

  if (desktopPerm === 'granted') {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={handleToggleDesktopNotifications}
        style={{
          padding: '4px 10px',
          borderRadius: 2,
          border: desktopEnabled ? '1px solid #10B981' : `1px solid ${t.border}`,
          background: desktopEnabled
            ? isDark
              ? 'rgba(16, 185, 129, 0.16)'
              : '#ECFDF5'
            : t.cardBg,
          color: desktopEnabled ? (isDark ? '#34D399' : '#047857') : t.subText,
          fontWeight: 700,
          fontSize: 12,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {desktopEnabled ? '🖥️ Уведомления Windows: Вкл' : '🖥️ Уведомления Windows: Выкл'}
      </button>
    );
  }

  return (
    <span
      data-testid={testId}
      style={{
        padding: '4px 10px',
        borderRadius: 2,
        border: '1px solid #F59E0B',
        background: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
        color: isDark ? '#FBBF24' : '#B45309',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      🖥️ Уведомления заблокированы в браузере (разрешите их возле адресной строки)
    </span>
  );
}

export default function HeaderMegaMenu({
  mainCategories,
  subcategories,
  products,
  selectedMainCategoryId,
  selectedSubcategoryId,
  isMegaMenuOpen,
  setIsMegaMenuOpen,
  onSelectMainCategory,
  onSelectSubcategory,
  isDark,
  setIsDark,
  isAdminRoute,
  isAdminUnlocked,
  isManagerUnlocked = false,
  canViewCrm,
  crmUnreadCount = 0,
  currentUser = null,
  onNavigateToLogin,
  onNavigateToAdmin,
  onNavigateToCrm,
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToClient,
  onLogoutAdmin,
  onLogoutUser,
  estimateCount = 0,
  onClickEstimate,
  showToast,
  theme: t,
}: HeaderMegaMenuProps) {
  void isAdminRoute;
  const headerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [hoveredMainCatId, setHoveredMainCatId] = useState<string | null>(null);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getDesktopNotificationPermission()
  );
  const [desktopEnabled, setDesktopEnabled] = useState<boolean>(() =>
    isDesktopNotificationsEnabled()
  );

  const handleRequestDesktopNotifications = async () => {
    const res = await requestDesktopNotificationPermission();
    setDesktopPerm(res);
    setDesktopEnabled(isDesktopNotificationsEnabled());
    if (res === 'granted') {
      showToast?.('Системные уведомления Windows включены');
      showDesktopNotification({
        title: 'CRM Типография',
        body: 'Системные уведомления Windows успешно подключены!',
        tag: 'crm-test-notification',
      });
    } else if (res === 'denied') {
      showToast?.('Уведомления заблокированы в настройках браузера');
    }
  };

  const handleToggleDesktopNotifications = () => {
    const next = !desktopEnabled;
    setDesktopNotificationsEnabled(next);
    setDesktopEnabled(next);
    showToast?.(
      next
        ? 'Системные уведомления Windows включены'
        : 'Системные уведомления Windows выключены'
    );
  };

  const renderDesktopNotificationControl = (testId = 'crm-desktop-notifications-btn') => {
    if (desktopPerm === 'unsupported') {
      return (
        <span
          data-testid={testId}
          style={{
            padding: '4px 10px',
            borderRadius: 2,
            border: `1px solid ${t.border}`,
            background: t.cardBg,
            color: t.subText,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          Системные уведомления не поддерживаются браузером
        </span>
      );
    }

    if (desktopPerm === 'default') {
      return (
        <button
          type="button"
          data-testid={testId}
          onClick={() => void handleRequestDesktopNotifications()}
          style={{
            padding: '4px 10px',
            borderRadius: 2,
            border: '1px solid #C02721',
            background: isDark ? 'rgba(192, 39, 33, 0.22)' : '#FEF2F2',
            color: isDark ? '#F87171' : '#C02721',
            fontWeight: 700,
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          🖥️ Включить уведомления Windows
        </button>
      );
    }

    if (desktopPerm === 'granted') {
      return (
        <button
          type="button"
          data-testid={testId}
          onClick={handleToggleDesktopNotifications}
          style={{
            padding: '4px 10px',
            borderRadius: 2,
            border: desktopEnabled ? '1px solid #10B981' : `1px solid ${t.border}`,
            background: desktopEnabled
              ? isDark
                ? 'rgba(16, 185, 129, 0.16)'
                : '#ECFDF5'
              : t.cardBg,
            color: desktopEnabled ? (isDark ? '#34D399' : '#047857') : t.subText,
            fontWeight: 700,
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          {desktopEnabled ? '🖥️ Уведомления Windows: Вкл' : '🖥️ Уведомления Windows: Выкл'}
        </button>
      );
    }

    return (
      <span
        data-testid={testId}
        style={{
          padding: '4px 10px',
          borderRadius: 2,
          border: '1px solid #F59E0B',
          background: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
          color: isDark ? '#FBBF24' : '#B45309',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}
      >
        🖥️ Уведомления заблокированы в браузере (разрешите их возле адресной строки)
      </span>
    );
  };

  const clearCloseTimer = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleOpenCategoryMenu = (catId: string) => {
    clearCloseTimer();
    setHoveredMainCatId(catId);
    setIsMegaMenuOpen(true);
  };

  const handleScheduleCloseMenu = () => {
    clearCloseTimer();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMegaMenuOpen(false);
    }, 150);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMegaMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMegaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearCloseTimer();
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsMegaMenuOpen]);

  const activeMenuCatId = hoveredMainCatId || selectedMainCategoryId || mainCategories[0]?.id;
  const activeMainCat =
    mainCategories.find((mc) => mc.id === activeMenuCatId) || mainCategories[0];

  const subcatsInMain = activeMainCat
    ? subcategories.filter(
        (sc) => (sc.parent_id || mainCategories[0]?.id) === activeMainCat.id
      )
    : [];

  const featuredSubcats = subcatsInMain.filter((sc) => Boolean(sc.is_featured));
  const textSubcats = subcatsInMain.filter((sc) => !sc.is_featured);

  const brandBlue = isDark ? '#E54D47' : '#C02721';
  const accentBlueBg = '#C02721';

  return (
    <div
      ref={headerRef}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={handleScheduleCloseMenu}
      style={{ position: 'relative', width: '100%', zIndex: 900 }}
    >
      {/* Верхний ряд — сервисная полоса (тема, профиль, админ/менеджер, вход/выход) */}
      <div
        className="ui-header-top-bar"
        onMouseEnter={handleScheduleCloseMenu}
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
            {Boolean(canViewCrm) && renderDesktopNotificationControl('crm-desktop-notifications-btn')}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ui-hover-btn"
              onMouseEnter={handleScheduleCloseMenu}
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

            {!currentUser && !isAdminUnlocked && !isManagerUnlocked && onNavigateToLogin && (
              <button
                type="button"
                data-testid="header-login-btn"
                onMouseEnter={handleScheduleCloseMenu}
                onClick={() => {
                  clearCloseTimer();
                  setIsMegaMenuOpen(false);
                  onNavigateToLogin();
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 2,
                  border: `1px solid ${t.selectedBorder || '#C02721'}`,
                  background: t.selectedBg || '#FEF2F2',
                  color: t.selectedText || '#C02721',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
                title="Войти в аккаунт или зарегистрироваться"
              >
                Войти
              </button>
            )}

            {Boolean(canViewCrm) && onNavigateToCrm && (
              <button
                type="button"
                data-testid="header-crm-btn"
                onMouseEnter={handleScheduleCloseMenu}
                onClick={() => {
                  clearCloseTimer();
                  setIsMegaMenuOpen(false);
                  onNavigateToCrm();
                }}
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
                {Boolean(crmUnreadCount && crmUnreadCount > 0) && (
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

            {currentUser &&
              currentUser.role === 'client' &&
              !isAdminUnlocked &&
              !isManagerUnlocked &&
              onNavigateToOrders && (
                <button
                  type="button"
                  data-testid="header-my-orders-btn"
                  onMouseEnter={handleScheduleCloseMenu}
                  onClick={() => {
                    clearCloseTimer();
                    setIsMegaMenuOpen(false);
                    onNavigateToOrders();
                  }}
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
                  title="История и статусы ваших заказов (/orders)"
                >
                  <span>Мои заказы</span>
                </button>
              )}

            {(currentUser?.role === 'admin' || isAdminUnlocked) && (
              <button
                type="button"
                data-testid="header-admin-btn"
                onMouseEnter={handleScheduleCloseMenu}
                onClick={() => {
                  clearCloseTimer();
                  setIsMegaMenuOpen(false);
                  onNavigateToAdmin();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 2,
                  border: '1px solid #C02721',
                  background: '#C02721',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
                title={
                  currentUser
                    ? `${currentUser.name} (${currentUser.email}) — Открыть панель администратора (/admin)`
                    : 'Открыть панель администратора (/admin)'
                }
              >
                <span>Админ-панель</span>
              </button>
            )}

            {currentUser && (
              <button
                type="button"
                data-testid="header-user-badge"
                onMouseEnter={handleScheduleCloseMenu}
                onClick={() => {
                  clearCloseTimer();
                  setIsMegaMenuOpen(false);
                  if (onNavigateToProfile) {
                    onNavigateToProfile();
                  } else if (onNavigateToOrders) {
                    onNavigateToOrders();
                  }
                }}
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

            {(currentUser || isAdminUnlocked) && (
              <button
                type="button"
                data-testid={currentUser ? 'header-logout-btn' : 'header-admin-logout-btn'}
                onMouseEnter={handleScheduleCloseMenu}
                onClick={currentUser ? onLogoutUser : onLogoutAdmin}
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

      {/* Нижний ряд — основная навигация по каталогу + акцентные разделы и Корзина */}
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
            <button
              type="button"
              className="ui-nav-link"
              onMouseEnter={handleScheduleCloseMenu}
              onClick={() => {
                clearCloseTimer();
                setIsMegaMenuOpen(false);
                onNavigateToClient();
              }}
              style={{
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom:
                  !isMegaMenuOpen && !selectedMainCategoryId
                    ? `3px solid ${brandBlue}`
                    : '3px solid transparent',
                padding: '8px 6px 5px',
                cursor: 'pointer',
                textAlign: 'left',
                color:
                  !isMegaMenuOpen && !selectedMainCategoryId
                    ? brandBlue
                    : t.text,
                fontWeight: 500,
                fontSize: 13.5,
                lineHeight: 1.25,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              title="Главная страница — все категории"
            >
              <span>Все</span>
              <span>категории</span>
            </button>

            {mainCategories
              .filter((mc) => !mc.is_accent)
              .map((mc) => {
                const isCurrentMain = isMegaMenuOpen
                  ? activeMainCat?.id === mc.id
                  : selectedMainCategoryId === mc.id;
                const words = mc.name.trim().split(/\s+/);
                const line1 = words.length > 1 ? words[0] : mc.name;
                const line2 = words.length > 1 ? words.slice(1).join(' ') : '';

                return (
                  <button
                    key={mc.id}
                    type="button"
                    className="ui-nav-link"
                    onMouseEnter={() => handleOpenCategoryMenu(mc.id)}
                    onFocus={() => handleOpenCategoryMenu(mc.id)}
                    onClick={() => {
                      clearCloseTimer();
                      onSelectMainCategory(mc.id, false, true);
                    }}
                    style={{
                      background: 'transparent',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderBottom: isCurrentMain
                        ? `3px solid ${brandBlue}`
                        : '3px solid transparent',
                      padding: '8px 6px 5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: isCurrentMain ? brandBlue : t.text,
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
                    <span>{line1}</span>
                    {line2 && <span>{line2}</span>}
                  </button>
                );
              })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            {mainCategories
              .filter((mc) => mc.is_accent)
              .map((mc) => (
                <button
                  key={mc.id}
                  type="button"
                  onMouseEnter={() => handleOpenCategoryMenu(mc.id)}
                  onClick={() => {
                    clearCloseTimer();
                    onSelectMainCategory(mc.id, false, true);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 2,
                    border: 'none',
                    background: accentBlueBg,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {mc.name}
                </button>
              ))}

            {onClickEstimate && (
              <button
                type="button"
                data-testid="header-estimate-btn"
                onMouseEnter={handleScheduleCloseMenu}
                onClick={() => {
                  clearCloseTimer();
                  setIsMegaMenuOpen(false);
                  onClickEstimate();
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 2,
                  border:
                    estimateCount > 0
                      ? `1px solid ${t.selectedBorder || '#C02721'}`
                      : `1px solid ${t.border}`,
                  background: estimateCount > 0 ? t.selectedBg || '#FEF2F2' : t.subCardBg,
                  color: estimateCount > 0 ? t.selectedText || '#C02721' : t.text,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
                title="Перейти в корзину"
              >
                <span>{estimateCount > 0 ? `Корзина (${estimateCount})` : 'Корзина'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {activeMainCat && (
        <div
          aria-hidden={!isMegaMenuOpen}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxWidth: 1120,
            margin: '0 auto',
            boxSizing: 'border-box',
            background: t.cardBg,
            borderRadius: '0 0 4px 4px',
            borderTop: 'none',
            borderLeft: `1px solid ${t.border}`,
            borderRight: `1px solid ${t.border}`,
            borderBottom: `1px solid ${t.border}`,
            boxShadow: 'none',
            padding: '22px 24px 26px',
            zIndex: 950,
            opacity: isMegaMenuOpen ? 1 : 0,
            transform: isMegaMenuOpen ? 'none' : 'translateY(-6px)',
            transformOrigin: 'top center',
            visibility: isMegaMenuOpen ? 'visible' : 'hidden',
            pointerEvents: isMegaMenuOpen ? 'auto' : 'none',
            transition:
              'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.2s',
          }}
        >
          {subcatsInMain.length === 0 ? (
            <div style={{ padding: '18px 8px', color: t.subText, fontSize: 14 }}>
              В разделе «<b>{activeMainCat.name}</b>» пока нет подкатегорий. Вы можете добавить их или перенести в админ-панели (`/admin`).
            </div>
          ) : (
            <div
              style={{
                maxHeight: '72vh',
                overflowY: 'auto',
                padding: '6px',
                margin: '-6px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {featuredSubcats.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(225px, 1fr))',
                    gap: 12,
                  }}
                >
                  {featuredSubcats.map((subcat) => {
                    const isSelected = subcat.id === selectedSubcategoryId;
                    const firstProdWithImg = products.find(
                      (p) => p.category === subcat.id && p.images && p.images.length > 0
                    );
                    const cardImgUrl =
                      subcat.image_url || (firstProdWithImg?.images?.[0] ?? '');

                    return (
                      <button
                        key={subcat.id}
                        type="button"
                        className="ui-hover-card-compact ui-header-megamenu-card"
                        data-flat-card="true"
                        data-selected={isSelected ? 'true' : undefined}
                        onClick={() => {
                          onSelectSubcategory(subcat.id);
                          setIsMegaMenuOpen(false);
                        }}
                        style={{
                          appearance: 'none',
                          width: '100%',
                          minHeight: 88,
                          borderRadius: 3,
                          border: isSelected
                            ? `2px solid ${brandBlue}`
                            : `1px solid ${isDark ? '#32363E' : '#E2E8F0'}`,
                          padding: '9px 10px 9px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left',
                          cursor: 'pointer',
                          overflow: 'visible',
                          gap: 10,
                        }}
                      >
                        <div
                          className="ui-subcat-title"
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: isSelected ? brandBlue : t.text,
                            lineHeight: 1.28,
                            letterSpacing: isDark ? '0.01em' : 'normal',
                          }}
                        >
                          {subcat.name}
                        </div>

                        <div
                          className="ui-subcat-visual ui-studio-stage"
                          style={{
                            flexShrink: 0,
                            width: 92,
                            height: 68,
                            borderRadius: 2.5,
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'visible',
                          }}
                        >
                          <ResilientCatalogImage
                            imageUrl={cardImgUrl}
                            alt={subcat.name}
                            fallback={
                              <SubcategoryCardIllustration
                                cat={subcat}
                                isDark={isDark}
                                compact
                              />
                            }
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block',
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {textSubcats.length > 0 && (
                <div
                  style={{
                    borderTop:
                      featuredSubcats.length > 0 ? `1px solid ${t.softBorder}` : 'none',
                    paddingTop: featuredSubcats.length > 0 ? 14 : 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(225px, 1fr))',
                    gap: '6px 16px',
                  }}
                >
                  {textSubcats.map((subcat) => {
                    const isSelected = subcat.id === selectedSubcategoryId;
                    return (
                      <button
                        key={subcat.id}
                        type="button"
                        className="ui-megamenu-link"
                        onClick={() => {
                          onSelectSubcategory(subcat.id);
                          setIsMegaMenuOpen(false);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '6px 4px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: isSelected ? brandBlue : t.text,
                          lineHeight: 1.35,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{subcat.name}</span>
                        {subcat.badge === 'hit' && (
                          <span
                            style={{
                              background: '#C02721',
                              color: '#ffffff',
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 2,
                              flexShrink: 0,
                            }}
                          >
                            ХИТ
                          </span>
                        )}
                        {subcat.badge === 'new' && (
                          <span
                            style={{
                              background: '#1E2024',
                              color: '#ffffff',
                              border: '1px solid #454A54',
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 2,
                              flexShrink: 0,
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
