import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, normalizeBearerToken, subscribeUnauthorized } from '../../apiClient';
import { normalizeRoleOrderStatuses, normalizeRolePermissions } from '../../constants';
import {
  AuthUser,
  OrderStatus,
  RoleOrderStatusesMap,
  RolePermissions,
  RolePermissionsMap,
  UserRole,
} from '../../types';

type Toast = (message: string) => void;
type Navigate = (path: string, replace?: boolean) => void;

type AuthOptions = {
  showToast: Toast;
  navigateTo: Navigate;
  onAdminSession?: (token: string) => void;
  rolePermissions?: Partial<RolePermissionsMap>;
  roleOrderStatuses?: Partial<RoleOrderStatusesMap>;
};

export function useAuth({
  showToast,
  navigateTo,
  onAdminSession,
  rolePermissions,
  roleOrderStatuses,
}: AuthOptions) {
  const [authToken, setAuthToken] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(
    () => Boolean(sessionStorage.getItem('auth_token'))
  );

  const effectiveCrmRole: UserRole =
    authToken && currentUser ? currentUser.role || 'client' : 'client';
  const normalizedRolePermissions = normalizeRolePermissions(rolePermissions);
  const normalizedRoleOrderStatuses = normalizeRoleOrderStatuses(roleOrderStatuses);
  const explicitRolePerm = rolePermissions?.[effectiveCrmRole];
  const currentRolePermissions: RolePermissions =
    !authToken || !currentUser || currentUser.role === 'client'
      ? normalizedRolePermissions.client
      : explicitRolePerm
      ? { ...normalizedRolePermissions.client, ...explicitRolePerm }
      : currentUser.permissions
      ? { ...normalizedRolePermissions.client, ...currentUser.permissions }
      : normalizedRolePermissions[effectiveCrmRole] || normalizedRolePermissions.client;
  const currentAllowedOrderStatuses: OrderStatus[] = currentRolePermissions.update_order_status
    ? roleOrderStatuses?.[effectiveCrmRole] ||
      currentUser?.allowed_order_statuses ||
      normalizedRoleOrderStatuses[effectiveCrmRole] ||
      []
    : [];
  const isAdminUnlocked = Boolean(
    authToken &&
      currentUser &&
      (currentUser.role === 'admin' ||
        currentRolePermissions.manage_catalog ||
        currentRolePermissions.manage_users)
  );
  const isManagerUnlocked = Boolean(
    authToken &&
      currentUser &&
      (currentUser.role === 'manager' ||
        currentUser.role === 'admin' ||
        currentRolePermissions.manage_kp ||
        currentRolePermissions.apply_discounts)
  );
  const canManageKp = Boolean(
    authToken &&
      currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.role === 'manager' ||
        currentRolePermissions.manage_kp ||
        currentRolePermissions.apply_discounts)
  );
  const canAccessCrm = Boolean(
    authToken &&
      currentUser &&
      currentUser.role !== 'client' &&
      (currentUser.role === 'admin' || currentRolePermissions.view_crm)
  );

  const handleAuthSuccess = useCallback((token: string, user: AuthUser) => {
    sessionStorage.setItem('auth_token', token);
    setAuthToken(token);
    setCurrentUser(user);
    setIsAuthChecking(false);
    showToast(`Добро пожаловать, ${user.name}!`);
    if (
      user.role === 'admin' ||
      user.permissions?.manage_catalog ||
      user.permissions?.manage_users
    ) {
      onAdminSession?.(token);
    }
    navigateTo('/');
  }, [navigateTo, onAdminSession, showToast]);

  const logoutAll = useCallback(() => {
    sessionStorage.removeItem('auth_token');
    setAuthToken('');
    setCurrentUser(null);
    setIsAuthChecking(false);
  }, []);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    return subscribeUnauthorized((invalidToken) => {
      const currentStored = normalizeBearerToken(sessionStorage.getItem('auth_token'));
      if (currentStored && currentStored === invalidToken) {
        logoutAll();
        showToastRef.current('Сессия истекла. Пожалуйста, войдите снова');
      }
    });
  }, [logoutAll]);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('auth_token');
    if (!savedToken) {
      setIsAuthChecking(false);
      return;
    }
    setAuthToken(savedToken);
    setIsAuthChecking(true);
    apiFetch('/auth/me', { token: savedToken, skipAuthRedirect: true })
      .then(async (response) => {
        if (!response.ok) {
          logoutAll();
          return;
        }
        const data = await response.json();
        if (data?.user) {
          setCurrentUser(data.user);
          if (
            data.user.role === 'admin' ||
            data.user.permissions?.manage_catalog ||
            data.user.permissions?.manage_users
          ) {
            onAdminSession?.(savedToken);
          }
        }
      })
      .catch(() => {
        // Keep the token for the next retry; transient startup failures are harmless.
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, [logoutAll, onAdminSession]);

  return {
    authToken,
    setAuthToken,
    currentUser,
    setCurrentUser,
    isAuthChecking,
    isAdminUnlocked,
    isManagerUnlocked,
    canManageKp,
    canAccessCrm,
    currentRolePermissions,
    currentAllowedOrderStatuses,
    effectiveCrmRole,
    handleAuthSuccess,
    logoutAll,
  };
}
