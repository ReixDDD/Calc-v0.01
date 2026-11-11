import { useCallback, useState } from 'react';
import { apiFetch } from '../../apiClient';
import {
  DEFAULT_ROLES,
  normalizeRoleOrderStatuses,
  normalizeRolePermissions,
  normalizeRolesList,
} from '../../constants';
import {
  CatalogItemPublic,
  CatalogLimits,
  MainCategory,
  ProductCategory,
  ProductItem,
  RoleDefinition,
  RoleOrderStatusesMap,
  RolePermissionsMap,
} from '../../types';

type CatalogPayload = {
  main_categories?: MainCategory[];
  categories?: ProductCategory[];
  papers?: CatalogItemPublic[];
  laminations?: CatalogItemPublic[];
  products?: ProductItem[];
  category_qty_tiers?: Record<string, number[]>;
  limits?: Partial<CatalogLimits>;
  roles?: RoleDefinition[];
  role_permissions?: Partial<RolePermissionsMap>;
  role_order_statuses?: Partial<RoleOrderStatusesMap>;
};

const initialLimits: CatalogLimits = {
  usable_width_mm: 310,
  usable_height_mm: 440,
  sra3_width_mm: 320,
  sra3_height_mm: 450,
  bleed_mm: 4,
};

export function useCatalog(onCatalogChanged?: () => void) {
  const [publicMainCategories, setPublicMainCategories] = useState<MainCategory[]>([]);
  const [publicCategories, setPublicCategories] = useState<ProductCategory[]>([]);
  const [papers, setPapers] = useState<CatalogItemPublic[]>([]);
  const [laminations, setLaminations] = useState<CatalogItemPublic[]>([]);
  const [publicProducts, setPublicProducts] = useState<ProductItem[]>([]);
  const [publicCategoryQtyTiers, setPublicCategoryQtyTiers] = useState<Record<string, number[]>>({});
  const [usableLimits, setUsableLimits] = useState<CatalogLimits>(initialLimits);
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);
  const [rolePermissions, setRolePermissions] = useState<Partial<RolePermissionsMap>>({});
  const [roleOrderStatuses, setRoleOrderStatuses] = useState<Partial<RoleOrderStatusesMap>>({});

  const applyCatalogPayload = useCallback((data: CatalogPayload) => {
    if (!data) return;
    setPublicMainCategories(data.main_categories || []);
    setPublicCategories(data.categories || []);
    setPapers(data.papers || []);
    setLaminations(data.laminations || []);
    setPublicProducts(data.products || []);
    if (data.category_qty_tiers && typeof data.category_qty_tiers === 'object') {
      setPublicCategoryQtyTiers(data.category_qty_tiers);
    }
    if (data.limits) {
      setUsableLimits({
        usable_width_mm: Number(data.limits.usable_width_mm) || 310,
        usable_height_mm: Number(data.limits.usable_height_mm) || 440,
        sra3_width_mm: Number(data.limits.sra3_width_mm) || 320,
        sra3_height_mm: Number(data.limits.sra3_height_mm) || 450,
        bleed_mm: data.limits.bleed_mm !== undefined ? Number(data.limits.bleed_mm) : 4,
        by_main_category: data.limits.by_main_category,
      });
    }
    if (
      Array.isArray(data.roles) ||
      (data.role_permissions && typeof data.role_permissions === 'object') ||
      (data.role_order_statuses && typeof data.role_order_statuses === 'object')
    ) {
      const normalizedRoles = normalizeRolesList(
        data.roles,
        data.role_permissions,
        data.role_order_statuses
      );
      setRoles(normalizedRoles);
      setRolePermissions(normalizeRolePermissions(data.role_permissions, normalizedRoles));
      setRoleOrderStatuses(normalizeRoleOrderStatuses(data.role_order_statuses, normalizedRoles));
    }
    onCatalogChanged?.();
  }, [onCatalogChanged]);

  const fetchCatalog = useCallback(async () => {
    const response = await apiFetch('/catalog');
    if (!response.ok) return false;
    applyCatalogPayload(await response.json());
    return true;
  }, [applyCatalogPayload]);

  return {
    publicMainCategories,
    setPublicMainCategories,
    publicCategories,
    setPublicCategories,
    papers,
    setPapers,
    laminations,
    setLaminations,
    publicProducts,
    setPublicProducts,
    publicCategoryQtyTiers,
    setPublicCategoryQtyTiers,
    usableLimits,
    setUsableLimits,
    roles,
    setRoles,
    rolePermissions,
    setRolePermissions,
    roleOrderStatuses,
    setRoleOrderStatuses,
    applyCatalogPayload,
    fetchCatalog,
  };
}

