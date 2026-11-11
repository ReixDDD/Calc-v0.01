import {
  CategoryType,
  CostParamModeType,
  MaterialCategory,
  OrderStatus,
  PermissionKey,
  RoleDefinition,
  RoleOrderStatusesMap,
  RolePermissions,
  RolePermissionsMap,
  SchematicType,
  UserRole,
} from './types';

export const BACKEND_ORIGIN =
  typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000'
    : '';
export const API_URL = `${BACKEND_ORIGIN}/api`;

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function isSecureAssetUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || /[\r\n\0]/.test(trimmed) || trimmed.startsWith('//')) {
    return false;
  }
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export const resolveImageUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed || /[\r\n\0]/.test(trimmed)) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/')
  ) {
    return '';
  }
  if (
    (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) &&
    !trimmed.startsWith('//')
  ) {
    return `${BACKEND_ORIGIN}${trimmed}`;
  }
  try {
    if (trimmed.startsWith('//')) return '';
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.protocol === 'https:') return parsed.href;
    if (parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)) {
      return parsed.href;
    }
  } catch {
    // Ignore malformed or unsupported image URLs.
  }
  return '';
};

export const extractDensity = (text: string): number | null => {
  const m = text.match(/(\d{2,3})\s*(?:г|гр|g|мкр)/i);
  if (m) return Number(m[1]);
  return null;
};

export const DEFAULT_MATERIAL_CATEGORIES: MaterialCategory[] = [
  {
    id: 'papers',
    main_category_id: 'polygraphy',
    title: 'Бумага и самоклейка',
    kind: 'material',
    resource_label: 'Листов в пачке (шт.)',
    unit_label: '₽ / лист SRA3',
    default_unit: 'шт.',
    has_client_name: true,
    is_system: true,
  },
  {
    id: 'laminations',
    main_category_id: 'polygraphy',
    title: 'Ламинация',
    kind: 'material',
    resource_label: 'Длина рулона (м.)',
    unit_label: '₽ / п.м.',
    default_unit: 'м.',
    has_client_name: true,
    is_system: true,
  },
  {
    id: 'toners',
    main_category_id: 'polygraphy',
    title: 'Тонеры (ресурс А4)',
    kind: 'equipment',
    resource_label: 'Ресурс страниц А4',
    unit_label: '₽ / стр. А4',
    default_unit: 'стр. А4',
    has_client_name: false,
    is_system: true,
  },
  {
    id: 'components',
    main_category_id: 'polygraphy',
    title: 'Комплектующие и машина (ресурс А4)',
    kind: 'equipment',
    resource_label: 'Ресурс страниц А4',
    unit_label: '₽ / стр. А4',
    default_unit: 'стр. А4',
    has_client_name: false,
    is_system: true,
  },
  {
    id: 'extras',
    main_category_id: 'polygraphy',
    title: 'Доп. оборудование и расходники',
    kind: 'equipment',
    resource_label: 'Ресурс / кол-во',
    unit_label: '₽ / ед.',
    default_unit: 'лист.',
    has_client_name: false,
    is_system: true,
  },
  {
    id: 'wf_banners',
    main_category_id: 'wide_format',
    title: 'Баннеры, плёнка и холсты',
    kind: 'material',
    resource_label: 'Ширина и длина рулона (м)',
    unit_label: '₽ / м²',
    default_unit: 'м²',
    has_client_name: true,
    is_system: false,
  },
  {
    id: 'wf_inks',
    main_category_id: 'wide_format',
    title: 'Краска / чернила',
    kind: 'equipment',
    resource_label: 'Ресурс (м²)',
    unit_label: '₽ / м²',
    default_unit: 'м²',
    has_client_name: false,
    is_system: false,
  },
  {
    id: 'wf_equipment',
    main_category_id: 'wide_format',
    title: 'Оборудование и фурнитура (плоттер, люверсы)',
    kind: 'equipment',
    resource_label: 'Ресурс / кол-во',
    unit_label: '₽ / ед.',
    default_unit: 'ед.',
    has_client_name: false,
    is_system: false,
  },
  {
    id: 'souv_blanks',
    main_category_id: 'souvenirs',
    title: 'Заготовки (кружки, текстиль, ручки)',
    kind: 'material',
    resource_label: 'Кол-во в упаковке (шт.)',
    unit_label: '₽ / шт.',
    default_unit: 'шт.',
    has_client_name: true,
    is_system: false,
  },
  {
    id: 'souv_inks',
    main_category_id: 'souvenirs',
    title: 'Краска и расходники (сублимация, ДТФ, УФ)',
    kind: 'equipment',
    resource_label: 'Ресурс (шт. / отпечатков)',
    unit_label: '₽ / шт.',
    default_unit: 'шт.',
    has_client_name: false,
    is_system: false,
  },
  {
    id: 'souv_equipment',
    main_category_id: 'souvenirs',
    title: 'Оборудование (термопресс, УФ, лазер)',
    kind: 'equipment',
    resource_label: 'Ресурс (циклов / шт.)',
    unit_label: '₽ / ед.',
    default_unit: 'ед.',
    has_client_name: false,
    is_system: false,
  },
  {
    id: 'stamps_mounts',
    main_category_id: 'stamps',
    title: 'Оснастки для печатей и штампов',
    kind: 'material',
    resource_label: 'Кол-во в упаковке (шт.)',
    unit_label: '₽ / шт.',
    default_unit: 'шт.',
    has_client_name: true,
    is_system: false,
  },
  {
    id: 'stamps_consumables',
    main_category_id: 'stamps',
    title: 'Резина, полимер и краска',
    kind: 'equipment',
    resource_label: 'Ресурс (клише / шт.)',
    unit_label: '₽ / шт.',
    default_unit: 'шт.',
    has_client_name: false,
    is_system: false,
  },
  {
    id: 'stamps_equipment',
    main_category_id: 'stamps',
    title: 'Оборудование (лазерный гравер, экспокамера)',
    kind: 'equipment',
    resource_label: 'Ресурс (клише / циклов)',
    unit_label: '₽ / ед.',
    default_unit: 'ед.',
    has_client_name: false,
    is_system: false,
  },
];

export const MATERIAL_CATEGORY_LABELS: Record<
  CategoryType,
  { title: string; resourceLabel: string; unitLabel: string; defaultUnit: string; hasClientName: boolean }
> = {
  papers: {
    title: 'Бумага и самоклейка',
    resourceLabel: 'Листов в пачке (шт.)',
    unitLabel: '₽ / лист SRA3',
    defaultUnit: 'шт.',
    hasClientName: true,
  },
  laminations: {
    title: 'Ламинация',
    resourceLabel: 'Длина рулона (м.)',
    unitLabel: '₽ / п.м.',
    defaultUnit: 'м.',
    hasClientName: true,
  },
  toners: {
    title: 'Тонеры (ресурс А4)',
    resourceLabel: 'Ресурс страниц А4',
    unitLabel: '₽ / стр. А4',
    defaultUnit: 'стр. А4',
    hasClientName: false,
  },
  components: {
    title: 'Комплектующие и машина (ресурс А4)',
    resourceLabel: 'Ресурс страниц А4',
    unitLabel: '₽ / стр. А4',
    defaultUnit: 'стр. А4',
    hasClientName: false,
  },
  extras: {
    title: 'Доп. оборудование и расходники',
    resourceLabel: 'Ресурс / кол-во',
    unitLabel: '₽ / ед.',
    defaultUnit: 'лист.',
    hasClientName: false,
  },
};

export const getMaterialCategoryMeta = (
  catId: string,
  categories?: MaterialCategory[]
): {
  id: string;
  mainCategoryId: string;
  title: string;
  kind: 'material' | 'equipment';
  resourceLabel: string;
  unitLabel: string;
  defaultUnit: string;
  hasClientName: boolean;
  isSystem: boolean;
  pricePerM2: number | null;
  groupPricesPerM2: Record<string, number>;
} => {
  const found = (categories || DEFAULT_MATERIAL_CATEGORIES).find((c) => c.id === catId);
  if (found) {
    return {
      id: found.id,
      mainCategoryId: found.main_category_id || 'polygraphy',
      title: found.title,
      kind: found.kind || 'material',
      resourceLabel: found.resource_label || 'Ресурс / кол-во',
      unitLabel: found.unit_label || '₽ / ед.',
      defaultUnit: found.default_unit || 'шт.',
      hasClientName: Boolean(found.has_client_name),
      isSystem: Boolean(found.is_system),
      pricePerM2: found.price_per_m2 ?? null,
      groupPricesPerM2: found.group_prices_per_m2 || {},
    };
  }
  const fallback = MATERIAL_CATEGORY_LABELS[catId];
  if (fallback) {
    return {
      id: catId,
      mainCategoryId: 'polygraphy',
      title: fallback.title,
      kind: catId === 'papers' || catId === 'laminations' ? 'material' : 'equipment',
      resourceLabel: fallback.resourceLabel,
      unitLabel: fallback.unitLabel,
      defaultUnit: fallback.defaultUnit,
      hasClientName: fallback.hasClientName,
      isSystem: true,
      pricePerM2: null,
      groupPricesPerM2: {},
    };
  }
  return {
    id: catId,
    mainCategoryId: 'polygraphy',
    title: catId,
    kind: 'material',
    resourceLabel: 'Количество / ресурс',
    unitLabel: '₽ / ед.',
    defaultUnit: 'шт.',
    hasClientName: true,
    isSystem: false,
    pricePerM2: null,
    groupPricesPerM2: {},
  };
};

export const COST_PARAM_MODE_LABELS: Record<CostParamModeType, string> = {
  per_unit: 'За 1 шт. готового изделия',
  per_sheet: 'За 1 печатный лист SRA3',
  per_order: 'Фиксированно на весь заказ',
};

export const DEFAULT_TIERS = [
  { min_qty: 1, coefficient: 9.0, page_coefficient: 9.0 },
  { min_qty: 25, coefficient: 7.0, page_coefficient: 7.0 },
  { min_qty: 100, coefficient: 6.0, page_coefficient: 6.0 },
  { min_qty: 250, coefficient: 5.5, page_coefficient: 5.5 },
  { min_qty: 500, coefficient: 5.0, page_coefficient: 5.0 },
  { min_qty: 1000, coefficient: 4.5, page_coefficient: 4.5 },
  { min_qty: 2500, coefficient: 4.0, page_coefficient: 4.0 },
];


export const SCHEMATIC_TYPE_LABELS: Record<SchematicType, string> = {
  auto: 'Автоматически (по типу товара)',
  flat: 'Листовка / Визитка / Плоский лист',
  calendar_house: 'Настольный «Домик» / Тейбл-тент (с основанием)',
  calendar_wall: 'Перекидной календарь на пружине',
  pocket_calendar: 'Карманный календарь (скругленные углы)',
  booklet_1fold: 'Буклет / Открытка с 1 сгибом (пополам)',
  booklet_2fold: 'Евробуклет с 2 сгибами (3 полосы)',
  catalog: 'Многостраничный каталог / Журнал / Брошюра',
  notepad_spiral: 'Блокнот / Планер / Меню на пружине',
  folder: 'Вырубная папка с карманом под А4',
  box: 'Коробка упаковочная (развёртка с клапанами)',
  card_deck: 'Колода карт (комплект со скруглением)',
  sticker_pack: 'Стикер / 3D-стикер (контур резки / линза)',
  certificate: 'Сертификат / Фирменный бланк',
  banner: 'Баннер + люверсы по периметру',
  mug: 'Кружка с областью запечатки',
  tshirt: 'Футболка / Текстиль с зоной принта',
  stamp_round: 'Круглая печать (оттиск)',
  none: 'Без авто-схемы (только загруженные фото)',
};


export const PAPER_COLOR_PRESETS = [
  { name: 'Белый', hex: '#ffffff' },
  { name: 'Слоновая кость', hex: '#f5f0e1' },
  { name: 'Кремовый', hex: '#fffdd0' },
  { name: 'Крафт', hex: '#b58860' },
  { name: 'Чёрный', hex: '#1f2937' },
  { name: 'Тёмно-синий', hex: '#1e3a8a' },
  { name: 'Голубой', hex: '#7dd3fc' },
  { name: 'Красный', hex: '#dc2626' },
  { name: 'Бордовый', hex: '#7f1d1d' },
  { name: 'Зелёный', hex: '#16a34a' },
  { name: 'Изумрудный', hex: '#065f46' },
  { name: 'Жёлтый', hex: '#facc15' },
  { name: 'Оранжевый', hex: '#ea580c' },
  { name: 'Розовый', hex: '#f472b6' },
  { name: 'Фиолетовый', hex: '#7c3aed' },
  { name: 'Серый', hex: '#9ca3af' },
  { name: 'Золотой', hex: '#d4af37' },
  { name: 'Серебряный', hex: '#cbd5e1' },
];

export const PERMISSION_KEYS: PermissionKey[] = [
  'manage_kp',
  'apply_discounts',
  'view_crm',
  'view_all_orders',
  'update_order_status',
  'manage_order_finances',
  'view_internal_metrics',
  'delete_orders',
  'manage_catalog',
  'manage_users',
];

export const ROLE_PERMISSION_DEFINITIONS: Array<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'manage_kp',
    label: 'Формирование КП и печать PDF в корзине',
    description: 'Блок реквизитов КП и кнопка сохранения / печати коммерческого предложения в корзине',
  },
  {
    key: 'apply_discounts',
    label: 'Установка скидки (%) на заказ',
    description: 'Применение персональной скидки в корзине при создании заказа и в карточке заказа CRM',
  },
  {
    key: 'view_crm',
    label: 'Доступ к странице CRM Заказы (/crm)',
    description: 'Просмотр производственной доски и списка заказов типографии',
  },
  {
    key: 'view_all_orders',
    label: 'Просмотр всех заказов в CRM (включая чужие)',
    description: 'Если включено — сотрудник видит все заказы типографии; если выключено — только свои заказы',
  },
  {
    key: 'update_order_status',
    label: 'Изменение статуса и тех. комментария заказа',
    description: 'Перевод заказа по этапам работы и редактирование технического комментария в CRM',
  },
  {
    key: 'manage_order_finances',
    label: 'Цены, оплата, реквизиты счёта и дедлайн в CRM',
    description: 'Просмотр стоимости позиций, реквизитов юрлица, смена статуса оплаты и срока сдачи',
  },
  {
    key: 'view_internal_metrics',
    label: 'Себестоимость, налог, прибыль и техрасчёт SRA3',
    description: 'Отображение внутренней калькуляции себестоимости и чистой прибыли в калькуляторе и CRM',
  },
  {
    key: 'delete_orders',
    label: 'Удаление заказов в CRM',
    description: 'Право безвозвратно удалять заказы из базы данных CRM',
  },
  {
    key: 'manage_catalog',
    label: 'Управление каталогом, материалами и наценками',
    description: 'Доступ в админ-панель для редактирования разделов, товаров, бумаг, цен и коэффициентов',
  },
  {
    key: 'manage_users',
    label: 'Управление пользователями, ролями и базой данных',
    description: 'Создание и редактирование аккаунтов, настройка ролей, экспорт и импорт базы данных',
  },
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  client: {
    manage_kp: false,
    apply_discounts: false,
    view_crm: false,
    view_all_orders: false,
    update_order_status: false,
    manage_order_finances: false,
    view_internal_metrics: false,
    delete_orders: false,
    manage_catalog: false,
    manage_users: false,
  },
  production: {
    manage_kp: false,
    apply_discounts: false,
    view_crm: true,
    view_all_orders: true,
    update_order_status: true,
    manage_order_finances: false,
    view_internal_metrics: false,
    delete_orders: false,
    manage_catalog: false,
    manage_users: false,
  },
  manager: {
    manage_kp: true,
    apply_discounts: true,
    view_crm: true,
    view_all_orders: false,
    update_order_status: true,
    manage_order_finances: true,
    view_internal_metrics: false,
    delete_orders: false,
    manage_catalog: false,
    manage_users: false,
  },
  admin: {
    manage_kp: true,
    apply_discounts: true,
    view_crm: true,
    view_all_orders: true,
    update_order_status: true,
    manage_order_finances: true,
    view_internal_metrics: true,
    delete_orders: true,
    manage_catalog: true,
    manage_users: true,
  },
};

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'new',
  'awaiting_payment',
  'prepress',
  'in_progress',
  'ready',
  'completed',
  'cancelled',
];

export const DEFAULT_ROLE_ORDER_STATUSES: RoleOrderStatusesMap = {
  client: [],
  production: ['prepress', 'in_progress', 'ready', 'completed'],
  manager: [...ALL_ORDER_STATUSES],
  admin: [...ALL_ORDER_STATUSES],
};

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'client',
    name: 'Клиент',
    is_system: true,
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.client },
    allowed_order_statuses: [...DEFAULT_ROLE_ORDER_STATUSES.client],
  },
  {
    id: 'production',
    name: 'Производство / Цех',
    is_system: true,
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.production },
    allowed_order_statuses: [...DEFAULT_ROLE_ORDER_STATUSES.production],
  },
  {
    id: 'manager',
    name: 'Менеджер',
    is_system: true,
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.manager },
    allowed_order_statuses: [...DEFAULT_ROLE_ORDER_STATUSES.manager],
  },
  {
    id: 'admin',
    name: 'Администратор',
    is_system: true,
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.admin },
    allowed_order_statuses: [...DEFAULT_ROLE_ORDER_STATUSES.admin],
  },
];

export function normalizeRoleOrderStatuses(
  raw?: Partial<Record<UserRole, OrderStatus[]>> | null,
  rolesList?: RoleDefinition[] | null
): RoleOrderStatusesMap {
  const roleIds = new Set<string>(['client', 'production', 'manager', 'admin']);
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(raw)) {
      if (k.trim()) roleIds.add(k.trim());
    }
  }
  const rolesById = new Map<string, RoleDefinition>();
  if (Array.isArray(rolesList)) {
    for (const r of rolesList) {
      if (r && typeof r === 'object' && r.id) {
        const rid = String(r.id).trim();
        roleIds.add(rid);
        rolesById.set(rid, r);
      }
    }
  }

  const result: RoleOrderStatusesMap = {};
  for (const role of roleIds) {
    if (role === 'admin') {
      result[role] = [...ALL_ORDER_STATUSES];
      continue;
    }
    if (role === 'client') {
      result[role] = [];
      continue;
    }
    const fromRole = rolesById.get(role)?.allowed_order_statuses;
    const fromMap = raw && typeof raw === 'object' ? raw[role] : undefined;
    const incoming = Array.isArray(fromRole)
      ? fromRole
      : Array.isArray(fromMap)
      ? fromMap
      : DEFAULT_ROLE_ORDER_STATUSES[role] || [...ALL_ORDER_STATUSES];
    const incomingSet = new Set(incoming);
    result[role] = ALL_ORDER_STATUSES.filter((st) => incomingSet.has(st));
  }
  return result;
}

export function normalizeRolePermissions(
  raw?: Partial<Record<UserRole, Partial<RolePermissions>>> | null,
  rolesList?: RoleDefinition[] | null
): RolePermissionsMap {
  const roleIds = new Set<string>(['client', 'production', 'manager', 'admin']);
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(raw)) {
      if (k.trim()) roleIds.add(k.trim());
    }
  }
  if (Array.isArray(rolesList)) {
    for (const r of rolesList) {
      if (r && typeof r === 'object' && r.id) roleIds.add(String(r.id).trim());
    }
  }
  const rolesById = new Map<string, RoleDefinition>();
  if (Array.isArray(rolesList)) {
    for (const r of rolesList) {
      if (r && typeof r === 'object' && r.id) {
        rolesById.set(String(r.id).trim(), r);
      }
    }
  }

  const result: RolePermissionsMap = {};
  for (const role of roleIds) {
    const def = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.client;
    const incomingFromMap = raw && typeof raw === 'object' ? raw[role] : undefined;
    const incomingFromRole = rolesById.get(role)?.permissions;
    const incoming = incomingFromRole || incomingFromMap;
    const rolePerms = {} as RolePermissions;
    for (const key of PERMISSION_KEYS) {
      if (role === 'admin') {
        rolePerms[key] = true;
      } else if (role === 'client') {
        rolePerms[key] = false;
      } else if (incoming && typeof incoming === 'object' && key in incoming) {
        rolePerms[key] = Boolean(incoming[key]);
      } else {
        rolePerms[key] = Boolean(def[key]);
      }
    }
    result[role] = rolePerms;
  }
  return result;
}

export function normalizeRolesList(
  rawRoles?: RoleDefinition[] | null,
  legacyPerms?: Partial<Record<UserRole, Partial<RolePermissions>>> | null,
  legacyStatuses?: Partial<Record<UserRole, OrderStatus[]>> | null
): RoleDefinition[] {
  const defaultById = new Map(DEFAULT_ROLES.map((r) => [r.id, r]));
  const normalizedPerms = normalizeRolePermissions(legacyPerms, rawRoles);
  const normalizedStatuses = normalizeRoleOrderStatuses(legacyStatuses, rawRoles);

  if (!Array.isArray(rawRoles) || rawRoles.length === 0) {
    return DEFAULT_ROLES.map((r) => ({
      ...r,
      permissions: { ...(normalizedPerms[r.id] || r.permissions) },
      allowed_order_statuses: [
        ...(normalizedStatuses[r.id] || r.allowed_order_statuses || []),
      ],
    }));
  }

  const seenIds = new Set<string>();
  const result: RoleDefinition[] = [];

  for (const item of rawRoles) {
    if (!item || typeof item !== 'object') continue;
    const rId = String(item.id || '').trim().toLowerCase();
    if (!rId || seenIds.has(rId)) continue;
    const def = defaultById.get(rId);
    const name = String(item.name || (def ? def.name : rId)).trim() || rId;
    const isSystem = rId === 'admin' || rId === 'client' ? true : Boolean(item.is_system ?? Boolean(def));
    const perms = {} as RolePermissions;
    const rawP = item.permissions || legacyPerms?.[rId] || def?.permissions || DEFAULT_ROLE_PERMISSIONS.client;
    for (const key of PERMISSION_KEYS) {
      if (rId === 'admin') {
        perms[key] = true;
      } else if (rId === 'client') {
        perms[key] = false;
      } else if (rawP && typeof rawP === 'object' && key in rawP) {
        perms[key] = Boolean(rawP[key]);
      } else {
        perms[key] = Boolean(def?.permissions?.[key] ?? false);
      }
    }
    const allowedStatuses: OrderStatus[] =
      rId === 'admin'
        ? [...ALL_ORDER_STATUSES]
        : rId === 'client'
        ? []
        : [
            ...(normalizedStatuses[rId] ||
              def?.allowed_order_statuses ||
              ALL_ORDER_STATUSES),
          ];
    seenIds.add(rId);
    result.push({
      id: rId,
      name,
      is_system: isSystem,
      permissions: perms,
      allowed_order_statuses: allowedStatuses,
    });
  }

  for (const sysId of ['client', 'admin']) {
    if (!seenIds.has(sysId)) {
      const def = defaultById.get(sysId)!;
      const perms = normalizedPerms[sysId] || def.permissions;
      const entry: RoleDefinition = {
        id: sysId,
        name: def.name,
        is_system: true,
        permissions: { ...perms },
        allowed_order_statuses: sysId === 'admin' ? [...ALL_ORDER_STATUSES] : [],
      };
      if (sysId === 'client') {
        result.unshift(entry);
      } else {
        result.push(entry);
      }
    }
  }

  return result;
}

