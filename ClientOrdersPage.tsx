import React, { useEffect, useState } from 'react';
import { AuthUser, CompanyDetails, CrmOrder } from '../types';
import { apiFetch } from '../apiClient';
import { formatDeadlineDisplay, getOrderStatusMeta, ORDER_STATUS_LIST } from './crmOrderUtils';
import { getMaterialFieldMeta } from '../calculatorUtils';

interface ClientOrdersPageProps {
  currentUser: AuthUser | null;
  authToken: string;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle?: React.CSSProperties;
  onUpdateUser?: (user: AuthUser, token?: string) => void;
  showToast?: (msg: string) => void;
  onNavigateToLogin: () => void;
  onBackToCatalog: () => void;
}

const EMPTY_COMPANY_DETAILS: Required<CompanyDetails> = {
  company_name: '',
  inn: '',
  kpp: '',
  legal_address: '',
  bank_name: '',
  bik: '',
  checking_account: '',
  correspondent_account: '',
  phone: '',
};

export function isCompleteCompanyDetails(cd?: CompanyDetails | null): boolean {
  if (!cd) return false;
  return Boolean(
    cd.company_name?.trim() &&
      cd.inn?.trim() &&
      cd.kpp?.trim() &&
      cd.legal_address?.trim() &&
      cd.bank_name?.trim() &&
      cd.bik?.trim() &&
      cd.checking_account?.trim() &&
      cd.correspondent_account?.trim() &&
      cd.phone?.trim()
  );
}

type CabinetTab = 'profile' | 'orders' | 'company';

function resolveCabinetTabFromSearch(search: string, role?: string): CabinetTab {
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab');
  if (tabParam === 'profile') return 'profile';
  if (tabParam === 'company' || tabParam === 'requisites') return 'company';
  if (tabParam === 'orders') return 'orders';
  return role && role !== 'client' ? 'profile' : 'orders';
}

export default function ClientOrdersPage({
  currentUser,
  authToken,
  isDark,
  theme: t,
  inputStyle,
  onUpdateUser,
  showToast,
  onNavigateToLogin,
  onBackToCatalog,
}: ClientOrdersPageProps) {
  const [activeTab, setActiveTab] = useState<CabinetTab>(() =>
    resolveCabinetTabFromSearch(window.location.search, currentUser?.role)
  );
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState<string>(
    () => currentUser?.first_name || (currentUser?.name || '').trim().split(/\s+/)[0] || ''
  );
  const [lastName, setLastName] = useState<string>(
    () =>
      currentUser?.last_name ||
      (currentUser?.name || '').trim().split(/\s+/).slice(1).join(' ') ||
      ''
  );
  const [personalPhone, setPersonalPhone] = useState<string>(() => currentUser?.phone || '');
  const [personalEmail, setPersonalEmail] = useState<string>(() => currentUser?.email || '');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState<string>('');
  const [isSavingPersonal, setIsSavingPersonal] = useState<boolean>(false);
  const [personalSaveMessage, setPersonalSaveMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [companyForm, setCompanyForm] = useState<Required<CompanyDetails>>(() => ({
    company_name: currentUser?.company_details?.company_name || '',
    inn: currentUser?.company_details?.inn || '',
    kpp: currentUser?.company_details?.kpp || '',
    legal_address: currentUser?.company_details?.legal_address || '',
    bank_name: currentUser?.company_details?.bank_name || '',
    bik: currentUser?.company_details?.bik || '',
    checking_account: currentUser?.company_details?.checking_account || '',
    correspondent_account: currentUser?.company_details?.correspondent_account || '',
    phone: currentUser?.company_details?.phone || currentUser?.phone || '',
  }));
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(resolveCabinetTabFromSearch(window.location.search, currentUser?.role));
    const handlePopState = () => {
      setActiveTab(resolveCabinetTabFromSearch(window.location.search, currentUser?.role));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser?.role, window.location.search]);

  useEffect(() => {
    if (!currentUser) return;
    const fn =
      currentUser.first_name || (currentUser.name || '').trim().split(/\s+/)[0] || '';
    const ln =
      currentUser.last_name ||
      (currentUser.name || '').trim().split(/\s+/).slice(1).join(' ') ||
      '';
    setFirstName(fn);
    setLastName(ln);
    setPersonalPhone(currentUser.phone || '');
    setPersonalEmail(currentUser.email || '');
    setEmailCurrentPassword('');

    const cd = currentUser.company_details || EMPTY_COMPANY_DETAILS;
    setCompanyForm({
      company_name: cd.company_name || '',
      inn: cd.inn || '',
      kpp: cd.kpp || '',
      legal_address: cd.legal_address || '',
      bank_name: cd.bank_name || '',
      bik: cd.bik || '',
      checking_account: cd.checking_account || '',
      correspondent_account: cd.correspondent_account || '',
      phone: cd.phone || currentUser.phone || '',
    });
  }, [currentUser]);

  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch('/orders/my', {
      token: authToken,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          setError(data?.error || 'Не удалось загрузить историю заказов');
          setOrders([]);
          return;
        }
        if (Array.isArray(data)) {
          setOrders(data);
        }
      })
      .catch(() => {
        setError('Ошибка соединения с сервером');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [authToken]);

  const handleSavePersonalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    const trimmedEmail = personalEmail.trim();
    const isEmailChanged = Boolean(
      currentUser &&
        trimmedEmail.toLowerCase() !== (currentUser.email || '').trim().toLowerCase()
    );
    if (isEmailChanged && !emailCurrentPassword) {
      showToast?.('Для смены Email введите текущий пароль');
      return;
    }
    setIsSavingPersonal(true);
    setPersonalSaveMessage(null);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: personalPhone.trim(),
        email: trimmedEmail,
      };
      if (isEmailChanged) {
        payload.current_password = emailCurrentPassword;
      }
      const res = await apiFetch('/auth/profile', {
        method: 'PUT',
        token: authToken,
        json: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast?.(data?.error || 'Не удалось сохранить личные данные');
        return;
      }
      const updatedUser: AuthUser = data?.user || data;
      if (updatedUser && updatedUser.id && onUpdateUser) {
        onUpdateUser(updatedUser, typeof data?.token === 'string' ? data.token : undefined);
      }
      setEmailCurrentPassword('');
      setPersonalSaveMessage('Личные данные сохранены');
      showToast?.('Личные данные сохранены');
    } catch {
      showToast?.('Ошибка соединения при сохранении личных данных');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setPasswordMessage(null);

    if (!currentPassword) {
      const msg = 'Введите текущий пароль';
      setPasswordMessage({ type: 'error', text: msg });
      showToast?.(msg);
      return;
    }
    if (newPassword.length < 8) {
      const msg = 'Новый пароль должен содержать минимум 8 символов';
      setPasswordMessage({ type: 'error', text: msg });
      showToast?.(msg);
      return;
    }
    if (newPassword.length > 128) {
      const msg = 'Новый пароль не должен превышать 128 символов';
      setPasswordMessage({ type: 'error', text: msg });
      showToast?.(msg);
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = 'Новый пароль и подтверждение не совпадают';
      setPasswordMessage({ type: 'error', text: msg });
      showToast?.(msg);
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await apiFetch('/auth/profile', {
        method: 'PUT',
        token: authToken,
        json: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error || 'Не удалось изменить пароль';
        setPasswordMessage({ type: 'error', text: errMsg });
        showToast?.(errMsg);
        return;
      }
      const updatedUser: AuthUser = data?.user || data;
      if (updatedUser && updatedUser.id && onUpdateUser) {
        onUpdateUser(updatedUser, typeof data?.token === 'string' ? data.token : undefined);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Пароль успешно изменён' });
      showToast?.('Пароль успешно изменён');
    } catch {
      const errMsg = 'Ошибка соединения при смене пароля';
      setPasswordMessage({ type: 'error', text: errMsg });
      showToast?.(errMsg);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveCompanyDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    const cleanedDetails: CompanyDetails = {
      company_name: companyForm.company_name.trim(),
      inn: companyForm.inn.trim(),
      kpp: companyForm.kpp.trim(),
      legal_address: companyForm.legal_address.trim(),
      bank_name: companyForm.bank_name.trim(),
      bik: companyForm.bik.trim(),
      checking_account: companyForm.checking_account.trim(),
      correspondent_account: companyForm.correspondent_account.trim(),
      phone: companyForm.phone.trim(),
    };
    if (!isCompleteCompanyDetails(cleanedDetails)) {
      showToast?.('Заполните все поля реквизитов компании для получения статуса юридического лица');
      return;
    }
    setIsSavingProfile(true);
    setSaveSuccessMessage(null);
    try {

      const res = await apiFetch('/auth/profile', {
        method: 'PUT',
        token: authToken,
        json: {
          phone: cleanedDetails.phone,
          company_details: cleanedDetails,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (showToast) {
          showToast(data?.error || 'Не удалось сохранить реквизиты компании');
        }
        return;
      }
      const updatedUser: AuthUser = data?.user || data;
      if (updatedUser && updatedUser.id && onUpdateUser) {
        onUpdateUser(updatedUser, typeof data?.token === 'string' ? data.token : undefined);
      }
      setSaveSuccessMessage('Реквизиты компании сохранены');
      if (showToast) {
        showToast('Реквизиты компании сохранены');
      }
    } catch {
      if (showToast) {
        showToast('Ошибка соединения при сохранении реквизитов');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!currentUser || !authToken) {
    return (
      <section
        data-testid="client-orders-unauth"
        style={{
          background: t.cardBg,
          border: `1px solid ${t.border}`,
          borderRadius: 3,
          padding: '36px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: t.text }}>
          Личный кабинет и заказы
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: t.subText, maxWidth: 420 }}>
          Войдите в свой аккаунт, чтобы отслеживать статус выполнения заказов и сохранить реквизиты компании для выставления счёта.
        </p>
        <button
          type="button"
          onClick={onNavigateToLogin}
          style={{
            padding: '10px 18px',
            borderRadius: 2,
            border: 'none',
            background: '#C02721',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          Войти в аккаунт
        </button>
      </section>
    );
  }

  const pipelineSteps = ORDER_STATUS_LIST.filter((s) => s.id !== 'cancelled');
  const baseFieldStyle: React.CSSProperties = inputStyle || {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 2,
    border: `1px solid ${t.border}`,
    background: t.inputBg,
    color: t.text,
    fontSize: 13,
    boxSizing: 'border-box',
  };
  const isLegalClient =
    isCompleteCompanyDetails(currentUser.company_details) ||
    currentUser.client_type === 'legal';
  const hasSavedCompany = isLegalClient;
  const isStaff = currentUser.role !== 'client';

  return (
    <section
      data-testid="client-orders-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          background: t.cardBg,
          border: `1px solid ${t.border}`,
          borderRadius: 3,
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>
                {isStaff
                  ? `Личный кабинет сотрудника (${currentUser.role_name || currentUser.role})`
                  : 'Личный кабинет клиента'}
              </h1>
              <span
                data-testid="client-type-badge"
                style={{
                  padding: '3px 9px',
                  borderRadius: 2,
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: isLegalClient
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.2)'
                      : '#ECFDF5'
                    : t.subCardBg,
                  color: isLegalClient
                    ? isDark
                      ? '#34D399'
                      : '#047857'
                    : t.subText,
                  border: `1px solid ${
                    isLegalClient ? (isDark ? '#10B981' : '#A7F3D0') : t.border
                  }`,
                }}
              >
                {isLegalClient ? 'Юридическое лицо' : 'Частное лицо'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: t.subText }}>
              {isStaff ? 'Сотрудник' : 'Клиент'}: <b>{currentUser.name}</b> ({currentUser.email})
              {currentUser.company_details?.company_name
                ? ` • ${currentUser.company_details.company_name}`
                : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToCatalog}
            style={{
              padding: '8px 14px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: t.subCardBg,
              color: t.text,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            ← В каталог продукции
          </button>
        </div>

        {/* Переключатель вкладок личного кабинета */}
        <div
          data-testid="client-cabinet-tabs"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 12,
            borderTop: `1px solid ${t.softBorder}`,
          }}
        >
          <button
            type="button"
            data-testid="client-tab-profile"
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '8px 16px',
              borderRadius: 2,
              border:
                activeTab === 'profile' ? '1px solid #C02721' : `1px solid ${t.border}`,
              background: activeTab === 'profile' ? '#C02721' : t.subCardBg,
              color: activeTab === 'profile' ? '#ffffff' : t.text,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Мои данные и пароль
          </button>

          <button
            type="button"
            data-testid="client-tab-orders"
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '8px 16px',
              borderRadius: 2,
              border:
                activeTab === 'orders' ? '1px solid #C02721' : `1px solid ${t.border}`,
              background: activeTab === 'orders' ? '#C02721' : t.subCardBg,
              color: activeTab === 'orders' ? '#ffffff' : t.text,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Мои заказы ({orders.length})
          </button>

          <button
            type="button"
            data-testid="client-tab-company"
            onClick={() => setActiveTab('company')}
            style={{
              padding: '8px 16px',
              borderRadius: 2,
              border:
                activeTab === 'company' ? '1px solid #C02721' : `1px solid ${t.border}`,
              background: activeTab === 'company' ? '#C02721' : t.subCardBg,
              color: activeTab === 'company' ? '#ffffff' : t.text,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>Реквизиты компании (для счёта)</span>
            {hasSavedCompany && (
              <span
                style={{
                  fontSize: 10.5,
                  padding: '1px 6px',
                  borderRadius: 2,
                  background:
                    activeTab === 'company'
                      ? 'rgba(255,255,255,0.22)'
                      : isDark
                      ? 'rgba(16, 185, 129, 0.2)'
                      : '#D1FAE5',
                  color:
                    activeTab === 'company'
                      ? '#ffffff'
                      : isDark
                      ? '#34D399'
                      : '#047857',
                  fontWeight: 700,
                }}
              >
                Заполнены
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Блок А: Личные и контактные данные */}
          <form
            onSubmit={handleSavePersonalProfile}
            data-testid="personal-profile-form"
            style={{
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderLeft: '4px solid #C02721',
              borderRadius: 3,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 800, color: t.text }}>
                Личные и контактные данные
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: t.subText, lineHeight: 1.45 }}>
                {isStaff
                  ? 'Эти контактные данные автоматически подставляются в коммерческие предложения (КП) и карточки заказов CRM.'
                  : 'Контактные данные автоматически подставляются при оформлении заказов.'}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Имя
                </label>
                <input
                  type="text"
                  data-testid="profile-first-name-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Алексей"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Фамилия
                </label>
                <input
                  type="text"
                  data-testid="profile-last-name-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Смирнов"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Номер телефона
                </label>
                <input
                  type="tel"
                  data-testid="profile-phone-input"
                  value={personalPhone}
                  onChange={(e) => setPersonalPhone(e.target.value)}
                  placeholder="+7 (900) 000-00-01"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  htmlFor="profile-email-input"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Email / Почта
                </label>
                <input
                  id="profile-email-input"
                  type="email"
                  required
                  data-testid="profile-email-input"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="user@print.local"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              {personalEmail.trim().toLowerCase() !==
                (currentUser.email || '').trim().toLowerCase() && (
                <div>
                  <label
                    htmlFor="profile-email-current-password-input"
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.subText,
                      marginBottom: 4,
                    }}
                  >
                    Текущий пароль (для смены Email) *
                  </label>
                  <input
                    id="profile-email-current-password-input"
                    type="password"
                    required
                    maxLength={128}
                    data-testid="profile-email-current-password-input"
                    value={emailCurrentPassword}
                    onChange={(e) => setEmailCurrentPassword(e.target.value)}
                    placeholder="Подтвердите текущим паролем"
                    style={{ ...baseFieldStyle, width: '100%' }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="submit"
                data-testid="save-personal-profile-btn"
                disabled={isSavingPersonal}
                style={{
                  padding: '10px 20px',
                  borderRadius: 2,
                  border: 'none',
                  background: '#C02721',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: isSavingPersonal ? 'wait' : 'pointer',
                }}
              >
                {isSavingPersonal ? 'Сохранение...' : 'Сохранить данные'}
              </button>

              {personalSaveMessage && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isDark ? '#34D399' : '#047857',
                  }}
                >
                  ✓ {personalSaveMessage}
                </span>
              )}
            </div>
          </form>

          {/* Блок Б: Смена пароля */}
          <form
            onSubmit={handleChangePassword}
            data-testid="change-password-form"
            style={{
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderLeft: '4px solid #C02721',
              borderRadius: 3,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 800, color: t.text }}>
                Смена пароля
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: t.subText, lineHeight: 1.45 }}>
                Для смены пароля введите ваш текущий пароль и укажите новый пароль длиной от 8 до 128 символов.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Текущий пароль
                </label>
                <input
                  type="password"
                  required
                  maxLength={128}
                  data-testid="profile-current-password-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Введите текущий пароль"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Новый пароль (мин. 8 символов)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  data-testid="profile-new-password-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Повторите новый пароль
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  data-testid="profile-confirm-password-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="submit"
                data-testid="save-password-btn"
                disabled={isSavingPassword}
                style={{
                  padding: '10px 20px',
                  borderRadius: 2,
                  border: 'none',
                  background: '#C02721',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: isSavingPassword ? 'wait' : 'pointer',
                }}
              >
                {isSavingPassword ? 'Сохранение...' : 'Изменить пароль'}
              </button>

              {passwordMessage && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color:
                      passwordMessage.type === 'success'
                        ? isDark
                          ? '#34D399'
                          : '#047857'
                        : '#EF4444',
                  }}
                >
                  {passwordMessage.type === 'success' ? '✓ ' : ''}
                  {passwordMessage.text}
                </span>
              )}
            </div>
          </form>
        </div>
      ) : activeTab === 'company' ? (
        <form
          onSubmit={handleSaveCompanyDetails}
          data-testid="company-details-form"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderLeft: '4px solid #C02721',
            borderRadius: 3,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 800, color: t.text }}>
              Реквизиты компании (для счёта)
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: t.subText, lineHeight: 1.45 }}>
              Для получения статуса «Юридическое лицо» необходимо заполнить все 9 полей реквизитов вашей организации или ИП.
            </p>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 2,
              background: isLegalClient
                ? isDark
                  ? 'rgba(16, 185, 129, 0.14)'
                  : '#ECFDF5'
                : t.subCardBg,
              border: `1px solid ${
                isLegalClient ? (isDark ? '#10B981' : '#A7F3D0') : t.border
              }`,
              fontSize: 13,
              fontWeight: 600,
              color: t.text,
            }}
          >
            {isLegalClient
              ? 'Ваш текущий статус: Юридическое лицо'
              : 'Ваш текущий статус: Частное лицо'}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Наименование компании / ИП *
              </label>
              <input
                type="text"
                required
                data-testid="company-name-input"
                value={companyForm.company_name}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, company_name: e.target.value }))
                }
                placeholder="Например: ООО «Полиграф Плюс» или ИП Иванов И.И."
                style={{ ...baseFieldStyle, width: '100%' }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                ИНН *
              </label>
              <input
                type="text"
                required
                data-testid="company-inn-input"
                value={companyForm.inn}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, inn: e.target.value }))
                }
                placeholder="10 или 12 цифр (например: 7701234567)"
                style={{ ...baseFieldStyle, width: '100%' }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                КПП (для ООО) *
              </label>
              <input
                type="text"
                required
                data-testid="company-kpp-input"
                value={companyForm.kpp}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, kpp: e.target.value }))
                }
                placeholder="9 цифр (например: 770101001)"
                style={{ ...baseFieldStyle, width: '100%' }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Контактный телефон *
              </label>
              <input
                type="tel"
                required
                data-testid="company-phone-input"
                value={companyForm.phone}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+7 (999) 000-00-00"
                style={{ ...baseFieldStyle, width: '100%' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Юридический / фактический адрес *
              </label>
              <input
                type="text"
                required
                data-testid="company-address-input"
                value={companyForm.legal_address}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, legal_address: e.target.value }))
                }
                placeholder="г. Москва, ул. Промышленная, д. 10, оф. 205"
                style={{ ...baseFieldStyle, width: '100%' }}
              />
            </div>
          </div>

          <div
            style={{
              paddingTop: 12,
              borderTop: `1px dashed ${t.softBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              Банковские реквизиты
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Наименование банка *
                </label>
                <input
                  type="text"
                  required
                  data-testid="company-bank-input"
                  value={companyForm.bank_name}
                  onChange={(e) =>
                    setCompanyForm((prev) => ({ ...prev, bank_name: e.target.value }))
                  }
                  placeholder="ПАО Сбербанк / АО «ТБанк» / АО «Альфа-Банк»"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  БИК *
                </label>
                <input
                  type="text"
                  required
                  data-testid="company-bik-input"
                  value={companyForm.bik}
                  onChange={(e) =>
                    setCompanyForm((prev) => ({ ...prev, bik: e.target.value }))
                  }
                  placeholder="9 цифр (например: 044525225)"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Расчётный счёт (Р/С) *
                </label>
                <input
                  type="text"
                  required
                  data-testid="company-checking-input"
                  value={companyForm.checking_account}
                  onChange={(e) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      checking_account: e.target.value,
                    }))
                  }
                  placeholder="20 цифр (например: 40702810...)"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.subText,
                    marginBottom: 4,
                  }}
                >
                  Корреспондентский счёт (К/С) *
                </label>
                <input
                  type="text"
                  required
                  data-testid="company-correspondent-input"
                  value={companyForm.correspondent_account}
                  onChange={(e) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      correspondent_account: e.target.value,
                    }))
                  }
                  placeholder="20 цифр (например: 30101810...)"
                  style={{ ...baseFieldStyle, width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              paddingTop: 4,
            }}
          >
            <button
              type="submit"
              data-testid="save-company-details-btn"
              disabled={isSavingProfile}
              style={{
                padding: '10px 20px',
                borderRadius: 2,
                border: 'none',
                background: '#C02721',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: isSavingProfile ? 'wait' : 'pointer',
              }}
            >
              {isSavingProfile ? 'Сохранение...' : 'Сохранить реквизиты'}
            </button>

            {saveSuccessMessage && (
              <span
                data-testid="company-save-success"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isDark ? '#34D399' : '#047857',
                }}
              >
                ✓ {saveSuccessMessage}
              </span>
            )}
          </div>
        </form>
      ) : loading ? (
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
          Загрузка ваших заказов...
        </div>
      ) : error ? (
        <div
          style={{
            padding: 20,
            background: t.cardBg,
            border: '1px solid #EF4444',
            borderRadius: 3,
            color: '#EF4444',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div
          data-testid="client-orders-empty"
          style={{
            padding: 36,
            textAlign: 'center',
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 3,
            color: t.subText,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>У вас пока нет оформленных заказов.</div>
          <button
            type="button"
            onClick={onBackToCatalog}
            style={{
              padding: '9px 16px',
              borderRadius: 2,
              border: 'none',
              background: '#C02721',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Перейти к расчёту заказа
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map((order) => {
            const stMeta = getOrderStatusMeta(order.status);
            const currentStepIdx = pipelineSteps.findIndex((s) => s.id === order.status);
            const isBeforePayment =
              order.status === 'new' || order.status === 'awaiting_payment';
            const hasConfirmedDeadline =
              !isBeforePayment && Boolean(order.deadline_date && order.deadline_date.trim());

            return (
              <article
                key={order.id}
                data-testid={`client-order-card-${order.id}`}
                style={{
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  borderLeft: `4px solid ${stMeta.border}`,
                  borderRadius: 3,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    paddingBottom: 10,
                    borderBottom: `1px solid ${t.softBorder}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>
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
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 2,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: t.subCardBg,
                        color: t.text,
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      {order.client_type === 'legal' ? 'Юр. лицо' : 'Частное лицо'}
                    </span>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 2,
                        fontSize: 11.5,
                        fontWeight: 600,
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
                    {(order.need_invoice || order.company_details?.company_name || order.company_details?.inn) && (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 2,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: t.subCardBg,
                          color: t.text,
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        Счёт: {order.company_details?.company_name || 'Юр. лицо / ИП'}
                        {order.company_details?.inn ? ` (ИНН ${order.company_details.inn})` : ''}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: 12, color: t.subText }}>
                    от{' '}
                    {new Date(order.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Шкала этапов выполнения заказа */}
                {order.status !== 'cancelled' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
                      gap: 6,
                    }}
                  >
                    {pipelineSteps.map((step, idx) => {
                      const isDone = currentStepIdx >= idx;
                      const isCurrent = currentStepIdx === idx;
                      return (
                        <div
                          key={step.id}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 2,
                            border: isCurrent
                              ? '1px solid #C02721'
                              : `1px solid ${isDone ? '#10B981' : t.softBorder}`,
                            background: isCurrent
                              ? isDark
                                ? 'rgba(192, 39, 33, 0.22)'
                                : '#FEE2E2'
                              : isDone
                              ? isDark
                                ? 'rgba(16, 185, 129, 0.12)'
                                : '#ECFDF5'
                              : t.subCardBg,
                            fontSize: 11,
                            fontWeight: isCurrent ? 700 : 600,
                            color: isCurrent
                              ? isDark
                                ? '#FCA5A5'
                                : '#C02721'
                              : isDone
                              ? isDark
                                ? '#34D399'
                                : '#047857'
                              : t.subText,
                            textAlign: 'center',
                          }}
                        >
                          {idx + 1}. {step.shortLabel}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {order.items.map((item, idx) => {
                    const title = item.categoryName
                      ? `${item.categoryName} — ${item.productName}`
                      : item.productName;
                    const matMeta = getMaterialFieldMeta(item.mainCategoryId);
                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          padding: '8px 12px',
                          background: t.subCardBg,
                          borderRadius: 2,
                          border: `1px solid ${t.softBorder}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 12.5, color: t.text }}>
                          <b>
                            {idx + 1}. {title}
                          </b>{' '}
                          ({item.quantity.toLocaleString('ru-RU')} шт.) — {item.formatLabel}
                          {item.paperLabel ? ` • ${matMeta.quoteTitle}: ${item.paperLabel}` : ''}
                          {item.printLabel ? ` • Печать: ${item.printLabel}` : ''}
                        </div>
                        {item.totalPrice !== undefined && (
                          <div className="tabular-nums" style={{ fontSize: 13.5, fontWeight: 700 }}>
                            {Number(item.totalPrice).toLocaleString('ru-RU')} ₽
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    paddingTop: 8,
                    borderTop: `1px dashed ${t.softBorder}`,
                  }}
                >
                  <div style={{ fontSize: 12.5, color: t.subText }}>
                    <span data-testid={`client-order-deadline-${order.id}`} style={{ marginRight: 14 }}>
                      Срок готовности:{' '}
                      <b style={{ color: t.text }}>
                        {hasConfirmedDeadline
                          ? formatDeadlineDisplay(order.deadline_date)
                          : 'сообщим после оплаты'}
                      </b>
                    </span>
                    {order.comment && <span>Комментарий: {order.comment}</span>}
                  </div>

                  {order.total_price !== undefined && (
                    <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
                      Итого: {Math.round(Number(order.total_price)).toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
