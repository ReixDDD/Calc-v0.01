import React, { useEffect, useRef, useState } from 'react';
import {
  OrderStatus,
  PermissionKey,
  RoleDefinition,
  Settings,
  UserRole,
} from '../types';
import {
  ALL_ORDER_STATUSES,
  DEFAULT_ROLE_ORDER_STATUSES,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  normalizeRoleOrderStatuses,
  normalizeRolePermissions,
  normalizeRolesList,
  ROLE_PERMISSION_DEFINITIONS,
} from '../constants';
import { ORDER_STATUS_LIST } from './crmOrderUtils';

export interface AdminRolesSectionProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  rolesList: RoleDefinition[];
  newRoleName: string;
  setNewRoleName: React.Dispatch<React.SetStateAction<string>>;
  newRoleCode: string;
  setNewRoleCode: React.Dispatch<React.SetStateAction<string>>;
  roleNameDrafts: Record<string, string>;
  setRoleNameDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleCreateRole: (e: React.FormEvent) => Promise<RoleDefinition | null | void>;
  handleRenameRole: (roleObj: RoleDefinition, nextNameRaw: string) => Promise<void>;
  handleDeleteRole: (roleObj: RoleDefinition) => Promise<void>;
  handleSaveSettings: (e?: React.FormEvent) => Promise<void>;
  fetchCatalog: () => Promise<void>;
  showToast: (msg: string) => void;
  theme: Record<string, string>;
  smallInputStyle: React.CSSProperties;
}

export function AdminRolesSection({
  settings,
  setSettings,
  rolesList,
  newRoleName,
  setNewRoleName,
  newRoleCode,
  setNewRoleCode,
  roleNameDrafts,
  setRoleNameDrafts,
  handleCreateRole,
  handleRenameRole,
  handleDeleteRole,
  handleSaveSettings,
  fetchCatalog,
  showToast,
  theme: t,
  smallInputStyle,
}: AdminRolesSectionProps) {
  const configurableRolesList = rolesList.filter((r) => r.id !== 'client');
  const rolePerms = normalizeRolePermissions(settings.role_permissions, rolesList);
  const roleStatuses = normalizeRoleOrderStatuses(settings.role_order_statuses, rolesList);

  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => {
    if (configurableRolesList.some((r) => r.id === 'manager')) {
      return 'manager';
    }
    return configurableRolesList[0]?.id || 'admin';
  });

  const prevRoleIdsRef = useRef<string[]>(configurableRolesList.map((r) => r.id));

  useEffect(() => {
    const currentIds = configurableRolesList.map((r) => r.id);
    const addedId = currentIds.find((id) => !prevRoleIdsRef.current.includes(id));
    prevRoleIdsRef.current = currentIds;

    if (addedId) {
      setSelectedRoleId(addedId);
      return;
    }

    if (
      configurableRolesList.length > 0 &&
      !configurableRolesList.some((r) => r.id === selectedRoleId)
    ) {
      setSelectedRoleId(configurableRolesList[0].id);
    }
  }, [configurableRolesList, selectedRoleId]);

  const activeRole =
    configurableRolesList.find((r) => r.id === selectedRoleId) || configurableRolesList[0];

  const handleToggleRolePerm = (targetRole: UserRole, permKey: PermissionKey) => {
    if (targetRole === 'admin' || targetRole === 'client') return;
    const currentRoleMap = rolePerms[targetRole] || DEFAULT_ROLE_PERMISSIONS.client;
    const nextValue = !currentRoleMap[permKey];
    setSettings((prev) => {
      const prevRoles = normalizeRolesList(
        prev.roles,
        prev.role_permissions,
        prev.role_order_statuses
      );
      const nextRoles = prevRoles.map((r) =>
        r.id === targetRole
          ? {
              ...r,
              permissions: {
                ...r.permissions,
                [permKey]: nextValue,
              },
            }
          : r
      );
      const nextPermsMap = normalizeRolePermissions(prev.role_permissions, nextRoles);
      nextPermsMap[targetRole] = {
        ...(nextPermsMap[targetRole] || DEFAULT_ROLE_PERMISSIONS.client),
        [permKey]: nextValue,
      };
      return {
        ...prev,
        roles: nextRoles,
        role_permissions: nextPermsMap,
      };
    });
  };

  const handleSetRoleOrderStatuses = (targetRole: UserRole, nextStatuses: OrderStatus[]) => {
    if (targetRole === 'admin' || targetRole === 'client') return;
    const canonicalStatuses = ALL_ORDER_STATUSES.filter((st) => nextStatuses.includes(st));
    setSettings((prev) => {
      const prevRoles = normalizeRolesList(
        prev.roles,
        prev.role_permissions,
        prev.role_order_statuses
      );
      const nextRoles = prevRoles.map((r) =>
        r.id === targetRole
          ? {
              ...r,
              allowed_order_statuses: canonicalStatuses,
            }
          : r
      );
      const nextStatusesMap = normalizeRoleOrderStatuses(prev.role_order_statuses, nextRoles);
      nextStatusesMap[targetRole] = canonicalStatuses;
      return {
        ...prev,
        roles: nextRoles,
        role_order_statuses: nextStatusesMap,
      };
    });
  };

  const handleToggleRoleOrderStatus = (targetRole: UserRole, statusKey: OrderStatus) => {
    if (targetRole === 'admin' || targetRole === 'client') return;
    const currentList = roleStatuses[targetRole] || [];
    const exists = currentList.includes(statusKey);
    const nextList = exists
      ? currentList.filter((s) => s !== statusKey)
      : [...currentList, statusKey];
    handleSetRoleOrderStatuses(targetRole, nextList);
  };

  const onCreateRoleSubmit = async (e: React.FormEvent) => {
    const created = await handleCreateRole(e);
    if (created && typeof created === 'object' && 'id' in created && created.id) {
      setSelectedRoleId(created.id);
    }
  };

  return (
    <div data-testid="admin-roles-section">
      <div
        data-testid="admin-role-permissions-matrix"
        style={{
          padding: 16,
          borderRadius: 3,
          background: t.subCardBg,
          border: `1px solid ${t.border}`,
        }}
      >
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
              Роли и матрица прав доступа
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: t.subText }}>
              Выберите роль из списка, переименуйте её или отметьте доступные права. У Администратора всегда включены все права.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="reset-role-permissions-btn"
              onClick={() => {
                setSettings((prev) => {
                  const resetRoles = normalizeRolesList(
                    DEFAULT_ROLES,
                    DEFAULT_ROLE_PERMISSIONS,
                    DEFAULT_ROLE_ORDER_STATUSES
                  );
                  return {
                    ...prev,
                    roles: resetRoles,
                    role_permissions: normalizeRolePermissions(DEFAULT_ROLE_PERMISSIONS, resetRoles),
                    role_order_statuses: normalizeRoleOrderStatuses(
                      DEFAULT_ROLE_ORDER_STATUSES,
                      resetRoles
                    ),
                  };
                });
                showToast(
                  'Права ролей сброшены к значениям по умолчанию (нажмите «Сохранить права ролей»)'
                );
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 2,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                color: t.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              По умолчанию
            </button>
            <button
              type="button"
              data-testid="save-role-permissions-btn"
              onClick={async () => {
                await handleSaveSettings();
                await fetchCatalog();
              }}
              style={{
                padding: '7px 14px',
                borderRadius: 2,
                border: 'none',
                background: '#C02721',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Сохранить права ролей
            </button>
          </div>
        </div>

        {/* Форма создания новой роли */}
        <form
          onSubmit={onCreateRoleSubmit}
          data-testid="admin-create-role-form"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 2,
            background: t.cardBg,
            border: `1px solid ${t.softBorder}`,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>Новая роль:</span>
          <input
            type="text"
            data-testid="new-role-name-input"
            placeholder="Название роли (напр. Старший менеджер)"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            style={{ ...smallInputStyle, width: 240 }}
          />
          <input
            type="text"
            data-testid="new-role-id-input"
            placeholder="Код латиницей (необяз., напр. senior_mgr)"
            value={newRoleCode}
            onChange={(e) => setNewRoleCode(e.target.value)}
            style={{ ...smallInputStyle, width: 220 }}
          />
          <button
            type="submit"
            data-testid="create-role-btn"
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
            + Создать роль
          </button>
        </form>

        {/* Панель выбора и редактирования текущей роли */}
        {activeRole && (() => {
          const draftName = roleNameDrafts[activeRole.id] ?? activeRole.name;
          const canDeleteRole = activeRole.id !== 'admin' && activeRole.id !== 'client';
          const enabledCount = ROLE_PERMISSION_DEFINITIONS.filter((def) =>
            Boolean(rolePerms[activeRole.id]?.[def.key])
          ).length;
          const isAdminRole = activeRole.id === 'admin';
          const isUpdateStatusPermEnabled =
            isAdminRole || Boolean(rolePerms[activeRole.id]?.update_order_status);
          const activeAllowedStatuses = isAdminRole
            ? ALL_ORDER_STATUSES
            : roleStatuses[activeRole.id] || [];

          return (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                  padding: '12px 14px',
                  borderRadius: 2,
                  background: t.cardBg,
                  border: `1px solid ${t.softBorder}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label
                      htmlFor="admin-role-select"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: t.text,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Редактируемая роль:
                    </label>
                    <select
                      id="admin-role-select"
                      data-testid="admin-role-select"
                      value={activeRole.id}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      style={{
                        ...smallInputStyle,
                        width: 230,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {configurableRolesList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.subText,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Название:
                    </span>
                    <input
                      type="text"
                      data-testid={`role-name-input-${activeRole.id}`}
                      value={draftName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRoleNameDrafts((prev) => ({ ...prev, [activeRole.id]: val }));
                        setSettings((prev) => {
                          const nextRoles = normalizeRolesList(
                            prev.roles,
                            prev.role_permissions,
                            prev.role_order_statuses
                          ).map((item) =>
                            item.id === activeRole.id ? { ...item, name: val } : item
                          );
                          return { ...prev, roles: nextRoles };
                        });
                      }}
                      onBlur={() => handleRenameRole(activeRole, draftName)}
                      style={{
                        ...smallInputStyle,
                        width: 190,
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      color: t.mutedText,
                      padding: '4px 8px',
                      borderRadius: 2,
                      background: t.subCardBg,
                      border: `1px solid ${t.softBorder}`,
                      fontWeight: 600,
                    }}
                  >
                    Код: <b>{activeRole.id}</b> · Включено прав: {enabledCount} из{' '}
                    {ROLE_PERMISSION_DEFINITIONS.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {activeRole.id === 'admin' && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.selectedText || '#C02721',
                        background: t.selectedBg || '#FEF2F2',
                        border: `1px solid ${t.selectedBorder || '#C02721'}`,
                        padding: '5px 10px',
                        borderRadius: 2,
                      }}
                    >
                      У системной роли «Администратор» всегда включены все права
                    </span>
                  )}

                  {canDeleteRole && (
                    <button
                      type="button"
                      data-testid={`delete-role-btn-${activeRole.id}`}
                      onClick={() => handleDeleteRole(activeRole)}
                      title={`Удалить роль «${activeRole.name}»`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 2,
                        border: 'none',
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Удалить роль
                    </button>
                  )}
                </div>
              </div>

              <div className="ui-table-scroll">
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12.5,
                    background: t.cardBg,
                    border: `1px solid ${t.softBorder}`,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: t.subCardBg,
                        borderBottom: `1px solid ${t.border}`,
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '10px 12px', fontWeight: 700, color: t.subText }}>
                        Право / возможность системы
                      </th>
                      <th
                        style={{
                          padding: '10px 16px',
                          fontWeight: 700,
                          color: t.subText,
                          textAlign: 'center',
                          width: 180,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Доступ ({activeRole.name})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_PERMISSION_DEFINITIONS.map((def) => {
                      const checked = Boolean(rolePerms[activeRole.id]?.[def.key]);
                      return (
                        <tr
                          key={def.key}
                          onClick={() => {
                            if (!isAdminRole) {
                              handleToggleRolePerm(activeRole.id, def.key);
                            }
                          }}
                          style={{
                            borderBottom: `1px solid ${t.softBorder}`,
                            cursor: isAdminRole ? 'default' : 'pointer',
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: t.text }}>{def.label}</div>
                            <div style={{ fontSize: 11.5, color: t.subText, marginTop: 2 }}>
                              {def.description}
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '10px 16px',
                              textAlign: 'center',
                              width: 180,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                fontSize: 12,
                                color: checked ? '#10B981' : t.subText,
                              }}
                            >
                              <input
                                type="checkbox"
                                data-testid={`perm-checkbox-${activeRole.id}-${def.key}`}
                                checked={checked}
                                disabled={isAdminRole}
                                onChange={() => handleToggleRolePerm(activeRole.id, def.key)}
                                style={{
                                  width: 16,
                                  height: 16,
                                  cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                  accentColor: '#C02721',
                                }}
                              />
                              <span>{checked ? 'Включено' : 'Выкл.'}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Разрешённые статусы для перевода заказов в CRM */}
              <div
                data-testid="admin-role-order-statuses"
                style={{
                  marginTop: 14,
                  padding: '14px 16px',
                  borderRadius: 2,
                  background: t.cardBg,
                  border: `1px solid ${t.softBorder}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                      Разрешённые статусы для перевода заказов в CRM
                    </div>
                    <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>
                      Отметьте статусы, в которые пользователи с ролью «{activeRole.name}» могут переводить заказы (доступно при включённом праве «Смена статуса и примечаний заказа»).
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.mutedText,
                        padding: '4px 8px',
                        borderRadius: 2,
                        background: t.subCardBg,
                        border: `1px solid ${t.softBorder}`,
                      }}
                    >
                      Доступно статусов: <b>{activeAllowedStatuses.length}</b> из{' '}
                      {ORDER_STATUS_LIST.length}
                    </span>

                    {!isAdminRole && isUpdateStatusPermEnabled && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleSetRoleOrderStatuses(activeRole.id, [...ALL_ORDER_STATUSES])
                          }
                          style={{
                            padding: '5px 10px',
                            borderRadius: 2,
                            border: `1px solid ${t.border}`,
                            background: t.subCardBg,
                            color: t.text,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Все статусы
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSetRoleOrderStatuses(activeRole.id, [
                              'prepress',
                              'in_progress',
                              'ready',
                              'completed',
                            ])
                          }
                          style={{
                            padding: '5px 10px',
                            borderRadius: 2,
                            border: `1px solid ${t.border}`,
                            background: t.subCardBg,
                            color: t.text,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Только производство
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!isUpdateStatusPermEnabled && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                      padding: '8px 12px',
                      borderRadius: 2,
                      background: t.subCardBg,
                      border: `1px solid ${t.border}`,
                      fontSize: 12,
                      color: t.subText,
                    }}
                  >
                    <span>
                      Для роли «{activeRole.name}» сейчас отключено право «Смена статуса и примечаний заказа». Включите его в таблице выше, чтобы разрешить перевод заказов по статусам.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleRolePerm(activeRole.id, 'update_order_status')}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 2,
                        border: 'none',
                        background: '#C02721',
                        color: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Включить смену статуса
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 8,
                    opacity: isUpdateStatusPermEnabled ? 1 : 0.6,
                  }}
                >
                  {ORDER_STATUS_LIST.map((st) => {
                    const isStatusAllowed = activeAllowedStatuses.includes(st.id);
                    const isCheckboxDisabled = isAdminRole || !isUpdateStatusPermEnabled;
                    return (
                      <label
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 2,
                          border: `1px solid ${isStatusAllowed ? st.color : t.softBorder}`,
                          background: t.subCardBg,
                          cursor: isCheckboxDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: t.text,
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`status-perm-checkbox-${activeRole.id}-${st.id}`}
                            checked={isStatusAllowed}
                            disabled={isCheckboxDisabled}
                            onChange={() => handleToggleRoleOrderStatus(activeRole.id, st.id)}
                            style={{
                              width: 15,
                              height: 15,
                              cursor: isCheckboxDisabled ? 'not-allowed' : 'pointer',
                              accentColor: '#C02721',
                            }}
                          />
                          <span>{st.label}</span>
                        </span>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: st.color,
                            flexShrink: 0,
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
