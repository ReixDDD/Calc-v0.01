import React, { useState } from 'react';
import {
  AuthUser,
  MainCategory,
  ProductCategory,
  ProductItem,
  RoleDefinition,
  UserRole,
} from '../types';

export interface UserEditDraft {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: UserRole;
  discount_percent: number;
  discount_scope: 'all' | 'selected';
  discount_main_categories: string[];
  discount_categories: string[];
  discount_products: number[];
}

export interface AdminUsersSectionProps {
  adminUsers: AuthUser[];
  rolesList: RoleDefinition[];
  adminMainCategories: MainCategory[];
  adminCategories: ProductCategory[];
  adminProducts: ProductItem[];
  showAddUserForm: boolean;
  setShowAddUserForm: React.Dispatch<React.SetStateAction<boolean>>;
  newUserFirstName: string;
  setNewUserFirstName: React.Dispatch<React.SetStateAction<string>>;
  newUserLastName: string;
  setNewUserLastName: React.Dispatch<React.SetStateAction<string>>;
  newUserPhone: string;
  setNewUserPhone: React.Dispatch<React.SetStateAction<string>>;
  newUserEmail: string;
  setNewUserEmail: React.Dispatch<React.SetStateAction<string>>;
  newUserPassword: string;
  setNewUserPassword: React.Dispatch<React.SetStateAction<string>>;
  newUserRole: UserRole;
  setNewUserRole: React.Dispatch<React.SetStateAction<UserRole>>;
  handleCreateAdminUser: (e: React.FormEvent) => Promise<void>;
  getUserDraft: (u: AuthUser) => UserEditDraft;
  updateUserDraftField: <K extends keyof UserEditDraft>(
    u: AuthUser,
    field: K,
    value: UserEditDraft[K]
  ) => void;
  handleSaveUserRow: (u: AuthUser) => Promise<void>;
  handleUpdateUserRole: (userId: number, newRole: UserRole) => Promise<void>;
  handleToggleUserEmailVerified: (user: AuthUser) => Promise<void>;
  userPasswordInputs: Record<number, string>;
  setUserPasswordInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  handleResetUserPassword: (userId: number) => Promise<void>;
  handleDeleteUser: (user: AuthUser) => Promise<void>;
  theme: Record<string, string>;
  smallInputStyle: React.CSSProperties;
}

export function AdminUsersSection({
  adminUsers,
  rolesList,
  adminMainCategories,
  adminCategories,
  adminProducts,
  showAddUserForm,
  setShowAddUserForm,
  newUserFirstName,
  setNewUserFirstName,
  newUserLastName,
  setNewUserLastName,
  newUserPhone,
  setNewUserPhone,
  newUserEmail,
  setNewUserEmail,
  newUserPassword,
  setNewUserPassword,
  newUserRole,
  setNewUserRole,
  handleCreateAdminUser,
  getUserDraft,
  updateUserDraftField,
  handleSaveUserRow,
  handleUpdateUserRole,
  handleToggleUserEmailVerified,
  userPasswordInputs,
  setUserPasswordInputs,
  handleResetUserPassword,
  handleDeleteUser,
  theme: t,
  smallInputStyle,
}: AdminUsersSectionProps) {
  const [expandedDiscountUserId, setExpandedDiscountUserId] = useState<number | null>(null);
  const [productDiscountSearch, setProductDiscountSearch] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  const toggleMainCatDiscount = (u: AuthUser, mainCatId: string) => {
    const draft = getUserDraft(u);
    const list = draft.discount_main_categories || [];
    const next = list.includes(mainCatId)
      ? list.filter((x) => x !== mainCatId)
      : [...list, mainCatId];
    updateUserDraftField(u, 'discount_main_categories', next);
  };

  const toggleCategoryDiscount = (u: AuthUser, catId: string) => {
    const draft = getUserDraft(u);
    const list = draft.discount_categories || [];
    const next = list.includes(catId) ? list.filter((x) => x !== catId) : [...list, catId];
    updateUserDraftField(u, 'discount_categories', next);
  };

  const toggleProductDiscount = (u: AuthUser, prodId: number) => {
    const draft = getUserDraft(u);
    const list = draft.discount_products || [];
    const next = list.includes(prodId) ? list.filter((x) => x !== prodId) : [...list, prodId];
    updateUserDraftField(u, 'discount_products', next);
  };

  const searchLower = productDiscountSearch.trim().toLowerCase();
  const filteredProductsForDiscount = searchLower
    ? adminProducts.filter((p) => {
        const catName = adminCategories.find((c) => c.id === p.category)?.name || '';
        return `${p.name} ${catName} #${p.id}`.toLowerCase().includes(searchLower);
      })
    : adminProducts;

  const trimmedUserSearch = userSearchQuery.trim().toLowerCase();
  const staffCount = adminUsers.filter((u) => u.role !== 'client').length;
  const clientsCount = adminUsers.filter((u) => u.role === 'client').length;

  const visibleUsers = trimmedUserSearch
    ? adminUsers.filter((u) => {
        const haystack = [
          `#${u.id}`,
          String(u.id),
          u.first_name || '',
          u.last_name || '',
          u.name || '',
          u.email || '',
          u.phone || '',
          u.company_details?.company_name || '',
          u.company_details?.inn || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(trimmedUserSearch);
      })
    : adminUsers.filter((u) => u.role !== 'client' || expandedDiscountUserId === u.id);

  return (
    <div data-testid="admin-users-section">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700, color: t.text }}>
            Сотрудники и пользователи
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: t.subText }}>
            Управляйте данными сотрудников и клиентов (Имя, Фамилия, Телефон, Email), назначайте им роли, персональные скидки и меняйте пароли.
          </p>
        </div>

        <button
          type="button"
          data-testid="admin-toggle-add-user-btn"
          onClick={() => setShowAddUserForm((prev) => !prev)}
          style={{
            padding: '8px 14px',
            borderRadius: 2,
            border: 'none',
            background: '#C02721',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {showAddUserForm
            ? 'Скрыть форму добавления'
            : '+ Добавить сотрудника / пользователя'}
        </button>
      </div>

      {showAddUserForm && (
        <form
          onSubmit={handleCreateAdminUser}
          data-testid="admin-add-user-form"
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 3,
            background: t.subCardBg,
            border: `1px solid ${t.border}`,
            borderLeft: '4px solid #C02721',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
            Новый сотрудник / пользователь
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
              gap: 10,
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Имя
              </label>
              <input
                type="text"
                data-testid="new-user-first-name-input"
                placeholder="Алексей"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
                style={smallInputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Фамилия
              </label>
              <input
                type="text"
                data-testid="new-user-last-name-input"
                placeholder="Смирнов"
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
                style={smallInputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Телефон
              </label>
              <input
                type="tel"
                data-testid="new-user-phone-input"
                placeholder="+7 (900) 000-00-01"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
                style={smallInputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Email (логин) *
              </label>
              <input
                type="email"
                required
                data-testid="new-user-email-input"
                placeholder="staff@print.local"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                style={smallInputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Пароль (мин. 8 симв.) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                data-testid="new-user-password-input"
                placeholder="Минимум 8 символов"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                style={smallInputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: t.subText,
                  marginBottom: 4,
                }}
              >
                Роль
              </label>
              <select
                data-testid="new-user-role-select"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                style={{ ...smallInputStyle, fontWeight: 600 }}
              >
                {rolesList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAddUserForm(false)}
              style={{
                padding: '7px 14px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.subText,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              data-testid="create-user-submit-btn"
              style={{
                padding: '7px 16px',
                borderRadius: 2,
                border: 'none',
                background: '#C02721',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Создать пользователя
            </button>
          </div>
        </form>
      )}

      {/* Поиск сотрудников и клиентов */}
      <div
        style={{
          marginBottom: 14,
          padding: '10px 12px',
          borderRadius: 3,
          background: t.subCardBg,
          border: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            data-testid="admin-users-search-input"
            placeholder="🔍 Поиск пользователя или клиента по имени, фамилии, телефону, Email, ИНН или #ID..."
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            style={{
              ...smallInputStyle,
              flex: '1 1 280px',
              width: '100%',
              fontSize: 13,
            }}
          />
          {trimmedUserSearch !== '' && (
            <button
              type="button"
              onClick={() => setUserSearchQuery('')}
              style={{
                padding: '6px 12px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                color: t.subText,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ✕ Сбросить
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: t.subText }}>
          {trimmedUserSearch === ''
            ? `Отображаются сотрудники (${staffCount}). Клиентов со стандартными правами (${clientsCount}) можно найти через поиск выше.`
            : `Найдено пользователей: ${visibleUsers.length}`}
        </div>
      </div>

      {/* Компактный список карточек пользователей (без горизонтальной прокрутки) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibleUsers.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 3,
              border: `1px solid ${t.border}`,
              background: t.subCardBg,
              color: t.subText,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            Пользователи не найдены.
          </div>
        ) : (
          visibleUsers.map((u) => {
            const draft = getUserDraft(u);
            const isDiscountOpen = expandedDiscountUserId === u.id;
            return (
              <div
                key={u.id}
                data-testid={`admin-user-row-${u.id}`}
                style={{
                  border: `1px solid ${t.border}`,
                  borderRadius: 3,
                  background: t.cardBg,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Строка 1: ID, Имя, Фамилия, Телефон, Email, Роль */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '48px minmax(110px, 1fr) minmax(110px, 1fr) minmax(130px, 1.1fr) minmax(160px, 1.3fr) minmax(150px, 1.1fr)',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ color: t.subText, fontWeight: 700, fontSize: 13 }}>#{u.id}</div>

                  <input
                    type="text"
                    data-testid={`user-first-name-input-${u.id}`}
                    placeholder="Имя"
                    value={draft.first_name}
                    onChange={(e) => updateUserDraftField(u, 'first_name', e.target.value)}
                    style={{ ...smallInputStyle, width: '100%' }}
                  />

                  <input
                    type="text"
                    data-testid={`user-last-name-input-${u.id}`}
                    placeholder="Фамилия"
                    value={draft.last_name}
                    onChange={(e) => updateUserDraftField(u, 'last_name', e.target.value)}
                    style={{ ...smallInputStyle, width: '100%' }}
                  />

                  <input
                    type="tel"
                    data-testid={`user-phone-input-${u.id}`}
                    placeholder="+7 (900) 000-00-00"
                    value={draft.phone}
                    onChange={(e) => updateUserDraftField(u, 'phone', e.target.value)}
                    style={{ ...smallInputStyle, width: '100%' }}
                  />

                  <input
                    type="email"
                    data-testid={`user-email-input-${u.id}`}
                    placeholder="email@example.com"
                    value={draft.email}
                    onChange={(e) => updateUserDraftField(u, 'email', e.target.value)}
                    style={{ ...smallInputStyle, width: '100%' }}
                  />

                  <select
                    data-testid={`user-role-select-${u.id}`}
                    value={draft.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      updateUserDraftField(u, 'role', nextRole);
                      handleUpdateUserRole(u.id, nextRole);
                    }}
                    style={{
                      ...smallInputStyle,
                      width: '100%',
                      fontWeight: 600,
                    }}
                  >
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Строка 2: Подтверждение почты, персональная скидка, смена пароля, сохранение и удаление */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    paddingTop: 8,
                    borderTop: `1px solid ${t.softBorder}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleUserEmailVerified(u)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 2,
                        border: `1px solid ${u.is_email_verified ? '#10B981' : t.border}`,
                        background: u.is_email_verified
                          ? 'rgba(16, 185, 129, 0.12)'
                          : t.subCardBg,
                        color: u.is_email_verified ? '#10B981' : t.subText,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      title="Нажмите, чтобы переключить статус подтверждения Email"
                    >
                      {u.is_email_verified ? '✓ Почта подтв.' : 'Почта не подтв.'}
                    </button>

                    <button
                      type="button"
                      data-testid={`user-discount-toggle-btn-${u.id}`}
                      onClick={() =>
                        setExpandedDiscountUserId((prev) => (prev === u.id ? null : u.id))
                      }
                      style={{
                        padding: '5px 9px',
                        borderRadius: 2,
                        border: `1px solid ${
                          draft.discount_percent > 0
                            ? '#10B981'
                            : isDiscountOpen
                            ? '#C02721'
                            : t.border
                        }`,
                        background:
                          draft.discount_percent > 0
                            ? 'rgba(16, 185, 129, 0.12)'
                            : isDiscountOpen
                            ? 'rgba(192, 39, 33, 0.12)'
                            : t.subCardBg,
                        color:
                          draft.discount_percent > 0
                            ? '#10B981'
                            : isDiscountOpen
                            ? '#C02721'
                            : t.text,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {draft.discount_percent > 0
                        ? `Скидка: −${draft.discount_percent}% (${
                            draft.discount_scope === 'selected' ? 'Выбранная' : 'На всё'
                          })`
                        : 'Скидка: 0% (Настроить)'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      minLength={8}
                      maxLength={128}
                      placeholder="Новый пароль (от 8 симв.)..."
                      value={userPasswordInputs[u.id] || ''}
                      onChange={(e) =>
                        setUserPasswordInputs((prev) => ({
                          ...prev,
                          [u.id]: e.target.value,
                        }))
                      }
                      style={{
                        ...smallInputStyle,
                        width: 140,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleResetUserPassword(u.id)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.subCardBg,
                        color: t.text,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Сменить пароль
                    </button>
                    <button
                      type="button"
                      data-testid={`save-user-btn-${u.id}`}
                      onClick={() => handleSaveUserRow(u)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 2,
                        border: 'none',
                        background: '#C02721',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-user-btn-${u.id}`}
                      onClick={() => handleDeleteUser(u)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 2,
                        border: 'none',
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {/* Раскрывающаяся панель персональной скидки */}
                {isDiscountOpen && (
                  <div
                    data-testid={`user-discount-panel-${u.id}`}
                    style={{
                      marginTop: 4,
                      padding: '12px 14px',
                      borderRadius: 2,
                      background: t.subCardBg,
                      border: `1px solid ${t.softBorder}`,
                      borderLeft: '3px solid #10B981',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 14,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: t.text,
                            marginBottom: 4,
                          }}
                        >
                          Скидка аккаунта (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          data-testid={`user-discount-percent-input-${u.id}`}
                          value={draft.discount_percent}
                          onChange={(e) =>
                            updateUserDraftField(
                              u,
                              'discount_percent',
                              Math.max(0, Math.min(100, Number(e.target.value) || 0))
                            )
                          }
                          style={{ ...smallInputStyle, width: 120, fontWeight: 700 }}
                        />
                      </div>

                      <div style={{ minWidth: 280, flex: '1 1 280px', maxWidth: 460 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: t.text,
                            marginBottom: 4,
                          }}
                        >
                          На какую продукцию действует скидка
                        </label>
                        <select
                          data-testid={`user-discount-scope-select-${u.id}`}
                          value={draft.discount_scope}
                          onChange={(e) =>
                            updateUserDraftField(
                              u,
                              'discount_scope',
                              e.target.value === 'selected' ? 'selected' : 'all'
                            )
                          }
                          style={{ ...smallInputStyle, width: '100%', fontWeight: 600 }}
                        >
                          <option value="all">На всю продукцию каталога</option>
                          <option value="selected">
                            Только на выбранную продукцию (разделы / подкатегории / товары)
                          </option>
                        </select>
                      </div>

                      <button
                        type="button"
                        data-testid={`save-user-discount-btn-${u.id}`}
                        onClick={() => handleSaveUserRow(u)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 2,
                          border: 'none',
                          background: '#10B981',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          height: 32,
                        }}
                      >
                        Сохранить скидку
                      </button>
                    </div>

                    {draft.discount_scope === 'selected' && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                          gap: 12,
                          marginTop: 4,
                        }}
                      >
                        {/* 1. Главные разделы */}
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 2,
                            background: t.cardBg,
                            border: `1px solid ${t.border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                            Главные разделы ({draft.discount_main_categories.length})
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 5,
                              maxHeight: 170,
                              overflowY: 'auto',
                            }}
                          >
                            {adminMainCategories.map((mc) => {
                              const checked = draft.discount_main_categories.includes(mc.id);
                              return (
                                <label
                                  key={mc.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    fontSize: 12,
                                    color: t.text,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    data-testid={`user-discount-maincat-${u.id}-${mc.id}`}
                                    checked={checked}
                                    onChange={() => toggleMainCatDiscount(u, mc.id)}
                                  />
                                  <span>{mc.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Подкатегории */}
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 2,
                            background: t.cardBg,
                            border: `1px solid ${t.border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                            Подкатегории ({draft.discount_categories.length})
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 5,
                              maxHeight: 170,
                              overflowY: 'auto',
                            }}
                          >
                            {adminCategories.map((cat) => {
                              const checked = draft.discount_categories.includes(cat.id);
                              return (
                                <label
                                  key={cat.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    fontSize: 12,
                                    color: t.text,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    data-testid={`user-discount-cat-${u.id}-${cat.id}`}
                                    checked={checked}
                                    onChange={() => toggleCategoryDiscount(u, cat.id)}
                                  />
                                  <span>{cat.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Конкретные товары */}
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 2,
                            background: t.cardBg,
                            border: `1px solid ${t.border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                            Конкретные товары ({draft.discount_products.length})
                          </div>
                          <input
                            type="text"
                            placeholder="Поиск товара..."
                            value={productDiscountSearch}
                            onChange={(e) => setProductDiscountSearch(e.target.value)}
                            style={{ ...smallInputStyle, width: '100%', height: 28, fontSize: 11.5 }}
                          />
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 5,
                              maxHeight: 136,
                              overflowY: 'auto',
                            }}
                          >
                            {filteredProductsForDiscount.map((prod) => {
                              const checked = draft.discount_products.includes(prod.id);
                              return (
                                <label
                                  key={prod.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    fontSize: 12,
                                    color: t.text,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    data-testid={`user-discount-prod-${u.id}-${prod.id}`}
                                    checked={checked}
                                    onChange={() => toggleProductDiscount(u, prod.id)}
                                  />
                                  <span>
                                    {prod.name}{' '}
                                    <span style={{ color: t.subText, fontSize: 11 }}>
                                      (#{prod.id})
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

