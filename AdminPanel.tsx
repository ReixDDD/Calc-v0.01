import React, { useMemo, useState } from 'react';
import {
  AuthUser,
  CategoryType,
  CostItem,
  CrmOrder,
  MainCategory,
  MaterialCategory,
  MaterialCategoryKind,
  ProductCategory,
  ProductItem,
  RoleDefinition,
  Settings,
  UserRole,
} from '../types';
import { apiFetch } from '../apiClient';
import {
  DEFAULT_MATERIAL_CATEGORIES,
  DEFAULT_TIERS,
  getMaterialCategoryMeta,
  normalizeRolesList,
} from '../constants';
import {
  computeRollAreaM2,
  computeRollPriceFromSqmCost,
  isWideFormatRollMaterialCategory,
} from '../utils/wideFormatPricing';
import AdminProductsSection from './AdminProductsSection';
import AdminMaterialsSection from './AdminMaterialsSection';
import AdminMarkupsSection from './AdminMarkupsSection';
import { AdminUsersSection, UserEditDraft } from './AdminUsersSection';
import { AdminRolesSection } from './AdminRolesSection';
import AdminDiscountsSection from './AdminDiscountsSection';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { AdminSectionType } from '../routing';

interface AdminPanelProps {
  authToken: string;
  onNavigateToLogin?: () => void;
  isAdminUnlocked: boolean;
  adminSection: AdminSectionType;
  setAdminSection: (sec: AdminSectionType) => void;
  navigateTo: (path: string) => void;
  loadAdminData: (tokenToUse?: string, silent?: boolean) => Promise<void>;
  fetchCatalog: () => Promise<void>;
  showToast: (msg: string) => void;
  setLightboxUrl: (url: string | null) => void;
  setUsableLimits: (limits: { usable_width_mm: number; usable_height_mm: number }) => void;
  adminMainCategories: MainCategory[];
  setAdminMainCategories?: React.Dispatch<React.SetStateAction<MainCategory[]>>;
  adminCategories: ProductCategory[];
  setAdminCategories?: React.Dispatch<React.SetStateAction<ProductCategory[]>>;
  adminMaterialCategories?: MaterialCategory[];
  setAdminMaterialCategories?: React.Dispatch<React.SetStateAction<MaterialCategory[]>>;
  adminItems: CostItem[];
  setAdminItems: React.Dispatch<React.SetStateAction<CostItem[]>>;
  adminProducts: ProductItem[];
  setAdminProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  adminUsers?: AuthUser[];
  setAdminUsers?: React.Dispatch<React.SetStateAction<AuthUser[]>>;
  adminOrders?: CrmOrder[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeAdminProductCategory: string;
  setActiveAdminProductCategory: (catId: string) => void;
  activeMarkupCategory: string;
  setActiveMarkupCategory: (catId: string) => void;
  newMatEnabledCats: string[];
  setNewMatEnabledCats: React.Dispatch<React.SetStateAction<string[]>>;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
  smallInputStyle: React.CSSProperties;
}

export default function AdminPanel({
  authToken,
  onNavigateToLogin,
  isAdminUnlocked,
  adminSection,
  navigateTo,
  loadAdminData,
  fetchCatalog,
  showToast,
  setLightboxUrl,
  setUsableLimits,
  adminMainCategories,
  setAdminMainCategories,
  adminCategories,
  setAdminCategories,
  adminMaterialCategories = DEFAULT_MATERIAL_CATEGORIES,
  setAdminMaterialCategories,
  adminItems,
  setAdminItems,
  adminProducts,
  setAdminProducts,
  adminUsers = [],
  setAdminUsers,
  adminOrders = [],
  settings,
  setSettings,
  activeAdminProductCategory,
  setActiveAdminProductCategory,
  activeMarkupCategory,
  setActiveMarkupCategory,
  newMatEnabledCats,
  setNewMatEnabledCats,
  isDark,
  theme: t,
  inputStyle,
  smallInputStyle,
}: AdminPanelProps) {
  const { requestConfirm, confirmDialogProps } = useConfirmDialog();

  const [userPasswordInputs, setUserPasswordInputs] = useState<Record<number, string>>({});
  const [userEditDrafts, setUserEditDrafts] = useState<Record<number, UserEditDraft>>({});
  const [showAddUserForm, setShowAddUserForm] = useState<boolean>(false);
  const [newUserFirstName, setNewUserFirstName] = useState<string>('');
  const [newUserLastName, setNewUserLastName] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('manager');
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleCode, setNewRoleCode] = useState<string>('');
  const [roleNameDrafts, setRoleNameDrafts] = useState<Record<string, string>>({});

  const [activeMaterialCategory, setActiveMaterialCategory] = useState<CategoryType>('papers');
  const [materialTableSearch, setMaterialTableSearch] = useState<string>('');
  const [materialTableGroupFilter, setMaterialTableGroupFilter] = useState<string>('ALL');
  const [showAddMaterialForm, setShowAddMaterialForm] = useState<boolean>(
    adminSection === 'add_material'
  );

  const [newMatCategory, setNewMatCategory] = useState<CategoryType>('papers');
  const [newName, setNewName] = useState<string>('');
  const [newClientName, setNewClientName] = useState<string>('');
  const [newMatGroup, setNewMatGroup] = useState<string>('');
  const [newMatColorName, setNewMatColorName] = useState<string>('Белый');
  const [newMatColorHex, setNewMatColorHex] = useState<string>('#ffffff');
  const [newMatInStock, setNewMatInStock] = useState<boolean>(true);
  const [newPrice, setNewPrice] = useState<string>('');
  const [newResource, setNewResource] = useState<string>('');
  const [newRollWidth, setNewRollWidth] = useState<string>('');
  const [newRollLength, setNewRollLength] = useState<string>('');
  const [newSqmCost, setNewSqmCost] = useState<string>('');

  const [activeMatMainCategoryId, setActiveMatMainCategoryId] = useState<string>('polygraphy');
  const [activeMarkupMainCategoryId, setActiveMarkupMainCategoryId] = useState<string>('polygraphy');
  const [showAddMatCategoryForm, setShowAddMatCategoryForm] = useState<boolean>(false);
  const [newMatCatMainId, setNewMatCatMainId] = useState<string>('polygraphy');
  const [newMatCatTitle, setNewMatCatTitle] = useState<string>('');
  const [newMatCatKind, setNewMatCatKind] = useState<MaterialCategoryKind>('material');
  const [newMatCatPreset, setNewMatCatPreset] = useState<string>('unit_pcs');
  const [newMatCatResourceLabel, setNewMatCatResourceLabel] =
    useState<string>('Кол-во в упаковке (шт.)');
  const [newMatCatUnitLabel, setNewMatCatUnitLabel] = useState<string>('₽ / шт.');
  const [newMatCatDefaultUnit, setNewMatCatDefaultUnit] = useState<string>('шт.');
  const [newMatCatHasClientName, setNewMatCatHasClientName] = useState<boolean>(true);
  const [editingMatCategory, setEditingMatCategory] = useState<MaterialCategory | null>(null);
  const [isEditingMaterials, setIsEditingMaterials] = useState<boolean>(false);
  const [dirtyMaterialIds, setDirtyMaterialIds] = useState<number[]>([]);
  const [isEditingTechParams, setIsEditingTechParams] = useState<boolean>(false);

  // --- АДМИНКА: КОЭФФИЦИЕНТЫ НАЦЕНКИ И НАСТРОЙКИ ЛИСТА SRA3 ---
  const handleSaveSettings = async () => {
    const res = await apiFetch('/admin/settings', {
      method: 'PUT',
      token: authToken,
      json: settings,
    });
    if (res.ok) {
      const updated = await res.json();
      setSettings(updated);
      setUsableLimits({
        usable_width_mm: Number(updated.usable_width_mm) || 310,
        usable_height_mm: Number(updated.usable_height_mm) || 440,
      });
      showToast('Настройки и коэффициенты сохранены');
    }
  };

  const handleTierChange = (
    catId: string,
    idx: number,
    field: 'min_qty' | 'coefficient' | 'page_coefficient',
    val: number
  ) => {
    const currentTiers = settings.category_markups[catId] || [...DEFAULT_TIERS];
    const updatedTiers = currentTiers.map((tItem, i) =>
      i === idx ? { ...tItem, [field]: val } : tItem
    );
    setSettings({
      ...settings,
      category_markups: {
        ...settings.category_markups,
        [catId]: updatedTiers,
      },
    });
  };

  const handleAddTier = (catId: string) => {
    const currentTiers = settings.category_markups[catId] || [...DEFAULT_TIERS];
    const lastTier = currentTiers[currentTiers.length - 1];
    const nextQty = lastTier ? lastTier.min_qty * 2 : 100;
    const nextCoeff = lastTier
      ? Math.max(1.2, Number((lastTier.coefficient - 0.5).toFixed(2)))
      : 3.0;
    const lastPageCoeff = lastTier ? (lastTier.page_coefficient ?? lastTier.coefficient) : 3.0;
    const nextPageCoeff = lastTier
      ? Math.max(1.2, Number((lastPageCoeff - 0.5).toFixed(2)))
      : 3.0;
    setSettings({
      ...settings,
      category_markups: {
        ...settings.category_markups,
        [catId]: [
          ...currentTiers,
          { min_qty: nextQty, coefficient: nextCoeff, page_coefficient: nextPageCoeff },
        ],
      },
    });
  };

  const handleRemoveTier = (catId: string, idx: number) => {
    const currentTiers = settings.category_markups[catId] || [...DEFAULT_TIERS];
    if (currentTiers.length <= 1) {
      showToast('В категории должен остаться хотя бы один порог тиража');
      return;
    }
    setSettings({
      ...settings,
      category_markups: {
        ...settings.category_markups,
        [catId]: currentTiers.filter((_, i) => i !== idx),
      },
    });
  };

  // --- АДМИНКА: МАТЕРИАЛЫ ---
  const markMaterialDirty = (id: number) => {
    setDirtyMaterialIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleUpdateItem = async (item: CostItem) => {
    const res = await apiFetch(`/admin/items/${item.id}`, {
      method: 'PUT',
      token: authToken,
      json: item,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
      showToast('Материал сохранён');
    }
  };

  const handleSaveAllEditedMaterials = async () => {
    const itemsToSave = adminItems.filter((item) => dirtyMaterialIds.includes(item.id));
    if (itemsToSave.length > 0) {
      const res = await apiFetch('/admin/items/bulk', {
        method: 'PUT',
        token: authToken,
        json: { items: itemsToSave },
      });
      if (res.ok) {
        await loadAdminData(authToken, true);
        showToast('Изменения материалов сохранены');
      }
    }
    setDirtyMaterialIds([]);
    setIsEditingMaterials(false);
  };

  const handleAddItemFromPage = async (e: React.FormEvent) => {
    e.preventDefault();
    const newMatMeta = getMaterialCategoryMeta(newMatCategory, adminMaterialCategories);
    const isWfRoll = isWideFormatRollMaterialCategory(newMatMeta);
    const hasSqmCost =
      isWfRoll && newSqmCost.trim() !== '' && Number.isFinite(Number(newSqmCost));
    const parsedRollW = Number(newRollWidth);
    const parsedRollL = Number(newRollLength);
    const parsedResource = isWfRoll
      ? computeRollAreaM2(parsedRollW, parsedRollL)
      : Number(newResource);

    if (isWfRoll) {
      if (
        !newName.trim() ||
        !(parsedRollW > 0) ||
        !(parsedRollL > 0) ||
        (!newPrice && !hasSqmCost)
      ) {
        showToast('Заполните название, ширину и длину рулона, а также себестоимость за 1 м²');
        return;
      }
    } else if (!newName.trim() || !newPrice || !newResource) {
      showToast('Заполните название, стоимость закупки и количество/ресурс');
      return;
    }

    const computedFromSqm = hasSqmCost
      ? computeRollPriceFromSqmCost(Number(newSqmCost), parsedResource)
      : 0;
    const effectivePrice =
      hasSqmCost && (!newPrice || Math.abs(computedFromSqm - Number(newPrice)) <= 0.05)
        ? computedFromSqm
        : Number(newPrice);

    const payload: Record<string, unknown> = {
      category: newMatCategory,
      name: newName.trim(),
      client_name: newClientName.trim() || newName.trim(),
      group: newMatGroup.trim(),
      in_stock: newMatInStock,
      color_name: newMatCategory === 'papers' ? newMatColorName.trim() || 'Белый' : '',
      color_hex: newMatCategory === 'papers' ? newMatColorHex : '',
      price: effectivePrice,
      resource: parsedResource,
      enable_for_categories: newMatEnabledCats,
    };
    if (isWfRoll) {
      payload.roll_width_m = parsedRollW;
      payload.roll_length_m = parsedRollL;
    }
    if (hasSqmCost && Math.abs(computedFromSqm - effectivePrice) <= 0.05) {
      payload.cost_per_sqm = Number(newSqmCost);
    }

    const res = await apiFetch('/admin/items', {
      method: 'POST',
      token: authToken,
      json: payload,
    });
    if (res.ok) {
      setNewName('');
      setNewClientName('');
      setNewMatGroup('');
      setNewPrice('');
      setNewResource('');
      setNewRollWidth('');
      setNewRollLength('');
      setNewSqmCost('');
      await loadAdminData(authToken, true);
      showToast('Новый материал добавлен в базу');
    }
  };

  const handleDeleteItem = async (id: number) => {
    const confirmed = await requestConfirm({
      title: 'Удаление материала',
      message: 'Удалить этот материал из базы?',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    const res = await apiFetch(`/admin/items/${id}`, {
      method: 'DELETE',
      token: authToken,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
    }
  };

  const handleApplyMatCatPreset = (presetKey: string, kindOverride?: MaterialCategoryKind) => {
    setNewMatCatPreset(presetKey);
    const k = kindOverride || newMatCatKind;
    if (presetKey === 'unit_pcs') {
      setNewMatCatResourceLabel('Кол-во в упаковке (шт.)');
      setNewMatCatUnitLabel('₽ / шт.');
      setNewMatCatDefaultUnit('шт.');
      setNewMatCatHasClientName(k === 'material');
    } else if (presetKey === 'unit_m2') {
      setNewMatCatResourceLabel('Ширина и длина рулона (м)');
      setNewMatCatUnitLabel('₽ / м²');
      setNewMatCatDefaultUnit('м²');
      setNewMatCatHasClientName(k === 'material');
    } else if (presetKey === 'unit_eq') {
      setNewMatCatResourceLabel('Ресурс (шт. / циклов / оттисков)');
      setNewMatCatUnitLabel('₽ / ед.');
      setNewMatCatDefaultUnit('ед.');
      setNewMatCatHasClientName(false);
    } else if (presetKey === 'unit_sheets') {
      setNewMatCatResourceLabel('Листов в пачке (шт.)');
      setNewMatCatUnitLabel('₽ / лист');
      setNewMatCatDefaultUnit('лист.');
      setNewMatCatHasClientName(k === 'material');
    }
  };

  const handleAddMaterialCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatCatTitle.trim()) {
      showToast('Введите название новой категории материалов или оборудования');
      return;
    }
    const targetMainId =
      newMatCatMainId || activeMatMainCategoryId || adminMainCategories[0]?.id || 'polygraphy';
    const res = await apiFetch('/admin/material-categories', {
      method: 'POST',
      token: authToken,
      json: {
        main_category_id: targetMainId,
        title: newMatCatTitle.trim(),
        kind: newMatCatKind,
        resource_label: newMatCatResourceLabel.trim() || 'Количество / ресурс',
        unit_label: newMatCatUnitLabel.trim() || '₽ / ед.',
        default_unit: newMatCatDefaultUnit.trim() || 'шт.',
        has_client_name: newMatCatHasClientName,
      },
    });
    if (res.ok) {
      const created: MaterialCategory = await res.json();
      setNewMatCatTitle('');
      setShowAddMatCategoryForm(false);
      if (setAdminMaterialCategories) {
        setAdminMaterialCategories((prev) => [...prev, created]);
      }
      setActiveMatMainCategoryId(created.main_category_id || targetMainId);
      setActiveMaterialCategory(created.id);
      setNewMatCategory(created.id);
      await loadAdminData(authToken, true);
      showToast(
        `${
          created.kind === 'equipment' ? 'Категория оборудования' : 'Категория материалов'
        } «${created.title}» создана`
      );
    }
  };

  const handleSaveEditedMatCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatCategory || !editingMatCategory.title.trim()) return;
    const res = await apiFetch(`/admin/material-categories/${editingMatCategory.id}`, {
      method: 'PUT',
      token: authToken,
      json: {
        main_category_id:
          editingMatCategory.main_category_id ||
          activeMatMainCategoryId ||
          adminMainCategories[0]?.id ||
          'polygraphy',
        title: editingMatCategory.title.trim(),
        kind: editingMatCategory.kind || 'material',
        resource_label: editingMatCategory.resource_label.trim() || 'Количество / ресурс',
        unit_label: editingMatCategory.unit_label.trim() || '₽ / ед.',
        default_unit: editingMatCategory.default_unit.trim() || 'шт.',
        has_client_name: Boolean(editingMatCategory.has_client_name),
      },
    });
    if (res.ok) {
      const nextMainId = editingMatCategory.main_category_id || activeMatMainCategoryId;
      setEditingMatCategory(null);
      setActiveMatMainCategoryId(nextMainId);
      await loadAdminData(authToken, true);
      showToast('Настройки категории сохранены');
    }
  };

  const handleDeleteMaterialCategory = async (mc: MaterialCategory) => {
    if (mc.is_system) {
      showToast('Базовую системную категорию нельзя удалить (её можно переименовать)');
      return;
    }
    const itemsInCat = adminItems.filter((i) => i.category === mc.id).length;
    const confirmed = await requestConfirm({
      title: 'Удаление категории базы',
      message: `Удалить категорию «${mc.title}»${
        itemsInCat > 0 ? ` и все входящие в неё позиции (${itemsInCat} шт.)` : ''
      }?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    const res = await apiFetch(`/admin/material-categories/${mc.id}`, {
      method: 'DELETE',
      token: authToken,
    });
    if (res.ok) {
      setEditingMatCategory(null);
      const remainingInMain = adminMaterialCategories.filter(
        (c) =>
          c.id !== mc.id &&
          (c.main_category_id || 'polygraphy') === (mc.main_category_id || activeMatMainCategoryId)
      );
      const nextCatId = remainingInMain[0]?.id || 'papers';
      setActiveMaterialCategory(nextCatId);
      setNewMatCategory(nextCatId);
      await loadAdminData(authToken, true);
      showToast(`Категория «${mc.title}» удалена`);
    }
  };

  // --- АДМИНКА: ПОЛЬЗОВАТЕЛИ И РОЛИ ---
  const getUserDraft = (u: AuthUser): UserEditDraft => {
    const existing = userEditDrafts[u.id];
    if (existing) return existing;
    const rawFn = (u.first_name || '').trim();
    const rawLn = (u.last_name || '').trim();
    let fn = rawFn;
    let ln = rawLn;
    if (!fn && !ln && u.name) {
      const parts = u.name.trim().split(/\s+/);
      fn = parts[0] || '';
      ln = parts.slice(1).join(' ');
    }
    return {
      first_name: fn,
      last_name: ln,
      phone: u.phone || '',
      email: u.email || '',
      role: u.role,
      discount_percent: Number(u.discount_percent || 0),
      discount_scope: u.discount_scope === 'selected' ? 'selected' : 'all',
      discount_main_categories: Array.isArray(u.discount_main_categories)
        ? [...u.discount_main_categories]
        : [],
      discount_categories: Array.isArray(u.discount_categories) ? [...u.discount_categories] : [],
      discount_products: Array.isArray(u.discount_products) ? [...u.discount_products] : [],
    };
  };

  const updateUserDraftField = <K extends keyof UserEditDraft>(
    u: AuthUser,
    field: K,
    value: UserEditDraft[K]
  ) => {
    setUserEditDrafts((prev) => {
      const base = prev[u.id] || getUserDraft(u);
      return {
        ...prev,
        [u.id]: {
          ...base,
          [field]: value,
        },
      };
    });
  };

  const handleSaveUserRow = async (u: AuthUser) => {
    const draft = getUserDraft(u);
    const res = await apiFetch(`/admin/users/${u.id}`, {
      method: 'PUT',
      token: authToken,
      json: {
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        role: draft.role,
        discount_percent: draft.discount_percent,
        discount_scope: draft.discount_scope,
        discount_main_categories: draft.discount_main_categories,
        discount_categories: draft.discount_categories,
        discount_products: draft.discount_products,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось сохранить данные сотрудника / пользователя');
      return;
    }
    setUserEditDrafts((prev) => {
      const next = { ...prev };
      delete next[u.id];
      return next;
    });
    if (setAdminUsers) {
      setAdminUsers((prev) => prev.map((item) => (item.id === u.id ? data : item)));
    } else {
      await loadAdminData(authToken, true);
    }
    showToast(`Данные пользователя «${data.name || data.email}» сохранены`);
  };

  const handleCreateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || newUserPassword.length < 8 || newUserPassword.length > 128) {
      showToast('Укажите корректный Email и пароль (от 8 до 128 символов)');
      return;
    }
    const res = await apiFetch('/admin/users', {
      method: 'POST',
      token: authToken,
      json: {
        first_name: newUserFirstName.trim(),
        last_name: newUserLastName.trim(),
        phone: newUserPhone.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось добавить сотрудника / пользователя');
      return;
    }
    setNewUserFirstName('');
    setNewUserLastName('');
    setNewUserPhone('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('manager');
    setShowAddUserForm(false);
    if (setAdminUsers) {
      setAdminUsers((prev) => [...prev, data]);
    } else {
      await loadAdminData(authToken, true);
    }
    showToast(`Сотрудник / пользователь «${data.name || data.email}» добавлен`);
  };

  const handleUpdateUserRole = async (userId: number, newRole: UserRole) => {
    const res = await apiFetch(`/admin/users/${userId}`, {
      method: 'PUT',
      token: authToken,
      json: { role: newRole },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось изменить роль пользователя');
      return;
    }
    setUserEditDrafts((prev) => {
      if (!prev[userId]) return prev;
      return {
        ...prev,
        [userId]: { ...prev[userId], role: data.role },
      };
    });
    if (setAdminUsers) {
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? data : u)));
    } else {
      await loadAdminData(authToken, true);
    }
    showToast(`Роль пользователя «${data.name || data.email}» изменена на «${newRole}»`);
  };

  const handleCreateRole = async (e: React.FormEvent): Promise<RoleDefinition | null> => {
    e.preventDefault();
    const trimmedName = newRoleName.trim();
    if (!trimmedName) {
      showToast('Введите название роли');
      return null;
    }
    const payload: Record<string, unknown> = { name: trimmedName };
    if (newRoleCode.trim()) {
      payload.id = newRoleCode.trim().toLowerCase();
    }
    const res = await apiFetch('/admin/roles', {
      method: 'POST',
      token: authToken,
      json: payload,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось создать роль');
      return null;
    }
    setNewRoleName('');
    setNewRoleCode('');
    await loadAdminData(authToken, true);
    await fetchCatalog();
    showToast(`Роль «${data.name}» (${data.id}) создана`);
    return data as RoleDefinition;
  };

  const handleRenameRole = async (roleObj: RoleDefinition, nextNameRaw: string) => {
    const nextName = nextNameRaw.trim();
    if (!nextName || nextName === roleObj.name) return;
    const res = await apiFetch(`/admin/roles/${roleObj.id}`, {
      method: 'PUT',
      token: authToken,
      json: { name: nextName },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось переименовать роль');
      return;
    }
    await loadAdminData(authToken, true);
    await fetchCatalog();
    showToast(`Название роли обновлено: «${data.name}»`);
  };

  const handleDeleteRole = async (roleObj: RoleDefinition) => {
    if (roleObj.id === 'admin' || roleObj.id === 'client') {
      showToast('Базовые системные роли Администратор и Клиент нельзя удалить');
      return;
    }
    const confirmed = await requestConfirm({
      title: 'Удаление роли',
      message: `Удалить роль «${roleObj.name}» (${roleObj.id})? Все пользователи с этой ролью будут автоматически переведены в роль «Клиент».`,
      confirmLabel: 'Удалить роль',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    const res = await apiFetch(`/admin/roles/${roleObj.id}`, {
      method: 'DELETE',
      token: authToken,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось удалить роль');
      return;
    }
    await loadAdminData(authToken, true);
    await fetchCatalog();
    showToast(`Роль «${roleObj.name}» удалена`);
  };

  const handleToggleUserEmailVerified = async (user: AuthUser) => {
    const res = await apiFetch(`/admin/users/${user.id}`, {
      method: 'PUT',
      token: authToken,
      json: { is_email_verified: !user.is_email_verified },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось обновить статус почты');
      return;
    }
    if (setAdminUsers) {
      setAdminUsers((prev) => prev.map((u) => (u.id === user.id ? data : u)));
    } else {
      await loadAdminData(authToken, true);
    }
    showToast(
      data.is_email_verified
        ? `Email ${data.email} отмечен как подтверждённый`
        : `Статус подтверждения Email ${data.email} снят`
    );
  };

  const handleResetUserPassword = async (userId: number) => {
    const newPassword = userPasswordInputs[userId] || '';
    if (newPassword.length < 8 || newPassword.length > 128) {
      showToast('Новый пароль должен содержать от 8 до 128 символов');
      return;
    }
    const res = await apiFetch(`/admin/users/${userId}`, {
      method: 'PUT',
      token: authToken,
      json: { password: newPassword },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось обновить пароль пользователя');
      return;
    }
    setUserPasswordInputs((prev) => ({ ...prev, [userId]: '' }));
    showToast(`Пароль пользователя «${data.name || data.email}» обновлён`);
  };

  const handleDeleteUser = async (user: AuthUser) => {
    const confirmed = await requestConfirm({
      title: 'Удаление пользователя',
      message: `Удалить пользователя «${user.name}» (${user.email})?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    const res = await apiFetch(`/admin/users/${user.id}`, {
      method: 'DELETE',
      token: authToken,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Не удалось удалить пользователя');
      return;
    }
    if (setAdminUsers) {
      setAdminUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      await loadAdminData(authToken, true);
    }
    showToast(`Пользователь ${user.email} удалён`);
  };

  const materialGroupsInTable = useMemo(() => {
    const s = new Set<string>();
    adminItems
      .filter((i) => i.category === activeMaterialCategory)
      .forEach((i) => {
        if (i.group && i.group.trim()) s.add(i.group.trim());
      });
    return Array.from(s);
  }, [adminItems, activeMaterialCategory]);

  const filteredAdminMaterials = useMemo(() => {
    const q = materialTableSearch.trim().toLowerCase();
    return adminItems.filter((item) => {
      if (item.category !== activeMaterialCategory) return false;
      if (materialTableGroupFilter !== 'ALL' && (item.group || '') !== materialTableGroupFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.name} ${item.client_name || ''} ${item.group || ''}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [adminItems, activeMaterialCategory, materialTableSearch, materialTableGroupFilter]);

  const renderMainCategoryPicker = (
    selectedMainCatId: string,
    onSelectMainCat: (mcId: string) => void,
    mode: 'materials' | 'markups'
  ) => {
    const defaultMainCatId = adminMainCategories[0]?.id || 'polygraphy';
    return (
      <div
        style={{
          padding: '10px 12px',
          background: t.subCardBg,
          borderRadius: 3,
          border: `1px solid ${t.softBorder}`,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 6,
          }}
        >
          {adminMainCategories.map((mc) => {
            const isSelected = mc.id === selectedMainCatId;
            let statText = '';
            if (mode === 'materials') {
              const catsInMain = adminMaterialCategories.filter(
                (c) => (c.main_category_id || defaultMainCatId) === mc.id
              );
              const catIdsInMain = new Set(catsInMain.map((c) => c.id));
              const itemsCountInMain = adminItems.filter((i) =>
                catIdsInMain.has(i.category)
              ).length;
              statText = `${catsInMain.length} разд. · ${itemsCountInMain} поз.`;
            } else {
              const subcatsInMain = adminCategories.filter(
                (c) => (c.parent_id || defaultMainCatId) === mc.id
              );
              const subcatIdsInMain = new Set(subcatsInMain.map((c) => c.id));
              const prodsCountInMain = adminProducts.filter((p) =>
                subcatIdsInMain.has(p.category)
              ).length;
              statText = `${subcatsInMain.length} подкат. · ${prodsCountInMain} тов.`;
            }

            return (
              <button
                key={mc.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectMainCat(mc.id)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  border: isSelected ? `1px solid ${t.selectedBorder}` : `1px solid ${t.border}`,
                  boxShadow: isSelected ? `inset 0 0 0 1px ${t.selectedBorder}` : 'none',
                  background: isSelected ? t.selectedBg : t.cardBg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: isSelected ? t.selectedText : t.text,
                    lineHeight: 1.25,
                  }}
                >
                  {mc.name}
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 11,
                    color: isSelected ? t.selectedText : t.mutedText,
                    fontWeight: 600,
                  }}
                >
                  {statText}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: t.cardBg,
        padding: 24,
        borderRadius: 4,
        boxShadow: t.shadow,
        border: `1px solid ${t.softBorder}`,
      }}
    >
      {!isAdminUnlocked ? (
        <div style={{ maxWidth: 420, margin: '24px auto', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700, color: t.text }}>
            Вход в панель управления
          </h3>
          <p style={{ margin: '0 0 18px 0', color: t.subText, fontSize: 14, lineHeight: 1.5 }}>
            Для доступа к настройкам каталога, материалов, наценок и пользователей войдите в
            аккаунт с правами администратора.
          </p>
          <button
            type="button"
            data-testid="admin-go-login-btn"
            onClick={() => (onNavigateToLogin ? onNavigateToLogin() : navigateTo('/login'))}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#C02721',
              color: '#fff',
              border: 'none',
              borderRadius: 2,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Войти в аккаунт
          </button>
        </div>
      ) : (
        <div>
          {/* ==================== РАЗДЕЛ 1: КАТЕГОРИИ И ПРОДУКТЫ ==================== */}
          {adminSection === 'products' && (
            <AdminProductsSection
              authToken={authToken}
              navigateTo={navigateTo}
              loadAdminData={loadAdminData}
              fetchCatalog={fetchCatalog}
              showToast={showToast}
              setLightboxUrl={setLightboxUrl}
              requestConfirm={requestConfirm}
              adminMainCategories={adminMainCategories}
              setAdminMainCategories={setAdminMainCategories}
              adminCategories={adminCategories}
              setAdminCategories={setAdminCategories}
              adminItems={adminItems}
              adminProducts={adminProducts}
              setAdminProducts={setAdminProducts}
              activeAdminProductCategory={activeAdminProductCategory}
              setActiveAdminProductCategory={setActiveAdminProductCategory}
              isDark={isDark}
              theme={t}
              inputStyle={inputStyle}
              smallInputStyle={smallInputStyle}
            />
          )}

          {/* ==================== РАЗДЕЛ 2: БАЗА МАТЕРИАЛОВ И ЗИП ==================== */}
          {(adminSection === 'materials' || adminSection === 'add_material') && (
            <AdminMaterialsSection
              adminSection={adminSection}
              adminMainCategories={adminMainCategories}
              adminCategories={adminCategories}
              adminMaterialCategories={adminMaterialCategories}
              adminItems={adminItems}
              setAdminItems={setAdminItems}
              activeMatMainCategoryId={activeMatMainCategoryId}
              setActiveMatMainCategoryId={setActiveMatMainCategoryId}
              activeMaterialCategory={activeMaterialCategory}
              setActiveMaterialCategory={setActiveMaterialCategory}
              materialTableSearch={materialTableSearch}
              setMaterialTableSearch={setMaterialTableSearch}
              materialTableGroupFilter={materialTableGroupFilter}
              setMaterialTableGroupFilter={setMaterialTableGroupFilter}
              materialGroupsInTable={materialGroupsInTable}
              filteredAdminMaterials={filteredAdminMaterials}
              showAddMatCategoryForm={showAddMatCategoryForm}
              setShowAddMatCategoryForm={setShowAddMatCategoryForm}
              newMatCatMainId={newMatCatMainId}
              setNewMatCatMainId={setNewMatCatMainId}
              newMatCatTitle={newMatCatTitle}
              setNewMatCatTitle={setNewMatCatTitle}
              newMatCatKind={newMatCatKind}
              setNewMatCatKind={setNewMatCatKind}
              newMatCatPreset={newMatCatPreset}
              handleApplyMatCatPreset={handleApplyMatCatPreset}
              newMatCatResourceLabel={newMatCatResourceLabel}
              setNewMatCatResourceLabel={setNewMatCatResourceLabel}
              newMatCatUnitLabel={newMatCatUnitLabel}
              setNewMatCatUnitLabel={setNewMatCatUnitLabel}
              newMatCatHasClientName={newMatCatHasClientName}
              setNewMatCatHasClientName={setNewMatCatHasClientName}
              handleAddMaterialCategory={handleAddMaterialCategory}
              editingMatCategory={editingMatCategory}
              setEditingMatCategory={setEditingMatCategory}
              handleSaveEditedMatCategory={handleSaveEditedMatCategory}
              handleDeleteMaterialCategory={handleDeleteMaterialCategory}
              showAddMaterialForm={showAddMaterialForm}
              setShowAddMaterialForm={setShowAddMaterialForm}
              newMatCategory={newMatCategory}
              setNewMatCategory={setNewMatCategory}
              newName={newName}
              setNewName={setNewName}
              newClientName={newClientName}
              setNewClientName={setNewClientName}
              newMatGroup={newMatGroup}
              setNewMatGroup={setNewMatGroup}
              newMatColorName={newMatColorName}
              setNewMatColorName={setNewMatColorName}
              newMatColorHex={newMatColorHex}
              setNewMatColorHex={setNewMatColorHex}
              newMatInStock={newMatInStock}
              setNewMatInStock={setNewMatInStock}
              newPrice={newPrice}
              setNewPrice={setNewPrice}
              newResource={newResource}
              setNewResource={setNewResource}
              newRollWidth={newRollWidth}
              setNewRollWidth={setNewRollWidth}
              newRollLength={newRollLength}
              setNewRollLength={setNewRollLength}
              newSqmCost={newSqmCost}
              setNewSqmCost={setNewSqmCost}
              newMatEnabledCats={newMatEnabledCats}
              setNewMatEnabledCats={setNewMatEnabledCats}
              handleAddItemFromPage={handleAddItemFromPage}
              isEditingMaterials={isEditingMaterials}
              setIsEditingMaterials={setIsEditingMaterials}
              setDirtyMaterialIds={setDirtyMaterialIds}
              markMaterialDirty={markMaterialDirty}
              handleSaveAllEditedMaterials={handleSaveAllEditedMaterials}
              handleUpdateItem={handleUpdateItem}
              handleDeleteItem={handleDeleteItem}
              loadAdminData={loadAdminData}
              adminPin={authToken}
              renderMainCategoryPicker={renderMainCategoryPicker}
              theme={t}
              inputStyle={inputStyle}
              smallInputStyle={smallInputStyle}
            />
          )}

          {/* ==================== РАЗДЕЛ 3: КОЭФФИЦИЕНТЫ НАЦЕНКИ И НАСТРОЙКИ ==================== */}
          {adminSection === 'markups' && (
            <AdminMarkupsSection
              adminMainCategories={adminMainCategories}
              adminCategories={adminCategories}
              activeMarkupMainCategoryId={activeMarkupMainCategoryId}
              setActiveMarkupMainCategoryId={setActiveMarkupMainCategoryId}
              activeMarkupCategory={activeMarkupCategory}
              setActiveMarkupCategory={setActiveMarkupCategory}
              settings={settings}
              setSettings={setSettings}
              isEditingTechParams={isEditingTechParams}
              setIsEditingTechParams={setIsEditingTechParams}
              handleSaveSettings={handleSaveSettings}
              handleTierChange={handleTierChange}
              handleAddTier={handleAddTier}
              handleRemoveTier={handleRemoveTier}
              loadAdminData={loadAdminData}
              adminPin={authToken}
              renderMainCategoryPicker={renderMainCategoryPicker}
              isDark={isDark}
              theme={t}
              inputStyle={inputStyle}
              smallInputStyle={smallInputStyle}
            />
          )}

          {/* ==================== РАЗДЕЛ 4: ПОЛЬЗОВАТЕЛИ ==================== */}
          {adminSection === 'users' && (
            <AdminUsersSection
              adminUsers={adminUsers}
              rolesList={normalizeRolesList(settings.roles, settings.role_permissions)}
              adminMainCategories={adminMainCategories}
              adminCategories={adminCategories}
              adminProducts={adminProducts}
              showAddUserForm={showAddUserForm}
              setShowAddUserForm={setShowAddUserForm}
              newUserFirstName={newUserFirstName}
              setNewUserFirstName={setNewUserFirstName}
              newUserLastName={newUserLastName}
              setNewUserLastName={setNewUserLastName}
              newUserPhone={newUserPhone}
              setNewUserPhone={setNewUserPhone}
              newUserEmail={newUserEmail}
              setNewUserEmail={setNewUserEmail}
              newUserPassword={newUserPassword}
              setNewUserPassword={setNewUserPassword}
              newUserRole={newUserRole}
              setNewUserRole={setNewUserRole}
              handleCreateAdminUser={handleCreateAdminUser}
              getUserDraft={getUserDraft}
              updateUserDraftField={updateUserDraftField}
              handleSaveUserRow={handleSaveUserRow}
              handleUpdateUserRole={handleUpdateUserRole}
              handleToggleUserEmailVerified={handleToggleUserEmailVerified}
              userPasswordInputs={userPasswordInputs}
              setUserPasswordInputs={setUserPasswordInputs}
              handleResetUserPassword={handleResetUserPassword}
              handleDeleteUser={handleDeleteUser}
              theme={t}
              smallInputStyle={smallInputStyle}
            />
          )}

          {/* ==================== РАЗДЕЛ 5: РОЛИ И ПРАВА ==================== */}
          {adminSection === 'roles' && (
            <AdminRolesSection
              settings={settings}
              setSettings={setSettings}
              rolesList={normalizeRolesList(settings.roles, settings.role_permissions)}
              newRoleName={newRoleName}
              setNewRoleName={setNewRoleName}
              newRoleCode={newRoleCode}
              setNewRoleCode={setNewRoleCode}
              roleNameDrafts={roleNameDrafts}
              setRoleNameDrafts={setRoleNameDrafts}
              handleCreateRole={handleCreateRole}
              handleRenameRole={handleRenameRole}
              handleDeleteRole={handleDeleteRole}
              handleSaveSettings={handleSaveSettings}
              fetchCatalog={fetchCatalog}
              showToast={showToast}
              theme={t}
              smallInputStyle={smallInputStyle}
            />
          )}

          {/* ==================== РАЗДЕЛ 6: СКИДКИ И КОММЕНТАРИИ ==================== */}
          {adminSection === 'discounts' && (
            <AdminDiscountsSection
              orders={adminOrders}
              isDark={isDark}
              theme={t}
              inputStyle={inputStyle}
            />
          )}
        </div>
      )}
      <ConfirmDialog {...confirmDialogProps} isDark={isDark} theme={t} />
    </div>
  );
}
