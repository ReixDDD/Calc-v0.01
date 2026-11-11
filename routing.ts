export type AdminSectionType =
  | 'products'
  | 'add_material'
  | 'materials'
  | 'markups'
  | 'users'
  | 'roles'
  | 'discounts';

export interface ParsedRoute {
  type:
    | 'home'
    | 'auth'
    | 'admin'
    | 'manager'
    | 'crm'
    | 'orders'
    | 'cart'
    | 'main_category'
    | 'subcategory'
    | 'product'
    | 'forbidden'
    | 'not_found';
  authMode?: 'login' | 'register';
  mainCategoryId?: string;
  subcategoryId?: string;
  productId?: number;
  adminSection?: AdminSectionType;
  sharedCartToken?: string;
}

const SHARE_TOKEN_RE = /^[a-f0-9]{16,64}$/i;

export function buildAdminPath(section: AdminSectionType = 'products'): string {
  switch (section) {
    case 'products':
      return '/admin/products';
    case 'materials':
      return '/admin/materials';
    case 'add_material':
      return '/admin/new-material';
    case 'markups':
      return '/admin/markups';
    case 'users':
      return '/admin/users';
    case 'roles':
      return '/admin/roles';
    case 'discounts':
      return '/admin/discounts';
    default:
      return '/admin/products';
  }
}

export function buildCartPath(): string {
  return '/cart';
}

export function buildSharedCartPath(token: string): string {
  return `/cart?share=${encodeURIComponent(token.trim().toLowerCase())}`;
}

export function buildSharedCartUrl(origin: string, token: string): string {
  const cleanOrigin = (origin || '').replace(/\/+$/, '');
  return `${cleanOrigin}/cart?share=${encodeURIComponent(token.trim().toLowerCase())}`;
}

export function parseSharedCartToken(pathname: string, search: string): string | null {
  const cleanPath = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 3 && segments[0] === 'cart' && segments[1] === 's') {
    const candidate = decodeURIComponent(segments[2]).trim().toLowerCase();
    if (SHARE_TOKEN_RE.test(candidate)) {
      return candidate;
    }
  }
  const rawSearch = (search || '').startsWith('?') ? search.slice(1) : search || '';
  if (rawSearch.trim()) {
    const sp = new URLSearchParams(rawSearch);
    const shareParam = (sp.get('share') || '').trim().toLowerCase();
    if (SHARE_TOKEN_RE.test(shareParam)) {
      return shareParam;
    }
  }
  return null;
}

export function buildCrmPath(): string {
  return '/crm';
}

export function buildOrdersPath(): string {
  return '/orders';
}

export function buildMainCategoryPath(mainCategoryId: string): string {
  return `/category/${encodeURIComponent(mainCategoryId)}`;
}

export function buildSubcategoryPath(mainCategoryId: string, subcategoryId: string): string {
  return `/category/${encodeURIComponent(mainCategoryId)}/${encodeURIComponent(subcategoryId)}`;
}

export function buildProductPath(mainCategoryId: string, subcategoryId: string, productId: number): string {
  return `/category/${encodeURIComponent(mainCategoryId)}/${encodeURIComponent(subcategoryId)}/${productId}`;
}

export function parseRoutePath(pathname: string): ParsedRoute {
  const clean = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';

  if (clean === '/') {
    return { type: 'home' };
  }

  if (clean === '/login') {
    return { type: 'auth', authMode: 'login' };
  }

  if (clean === '/register') {
    return { type: 'auth', authMode: 'register' };
  }

  if (clean === '/cart') {
    return { type: 'cart' };
  }

  if (clean === '/crm') {
    return { type: 'crm' };
  }

  if (clean === '/orders') {
    return { type: 'orders' };
  }

  if (clean === '/manager') {
    return { type: 'manager' };
  }

  if (clean === '/403') {
    return { type: 'forbidden' };
  }

  if (
    clean === '/admin' ||
    clean === '/admin/products' ||
    clean === '/admin/new-material' ||
    clean === '/admin/materials' ||
    clean === '/admin/markups' ||
    clean === '/admin/users' ||
    clean === '/admin/roles' ||
    clean === '/admin/discounts'
  ) {
    let adminSection: AdminSectionType = 'products';
    if (clean === '/admin/new-material') {
      adminSection = 'add_material';
    } else if (clean === '/admin/materials') {
      adminSection = 'materials';
    } else if (clean === '/admin/markups') {
      adminSection = 'markups';
    } else if (clean === '/admin/users') {
      adminSection = 'users';
    } else if (clean === '/admin/roles') {
      adminSection = 'roles';
    } else if (clean === '/admin/discounts') {
      adminSection = 'discounts';
    }
    return { type: 'admin', adminSection };
  }

  const segments = clean.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });

  if (segments.length === 3 && segments[0] === 'cart' && segments[1] === 's') {
    const token = segments[2].trim().toLowerCase();
    if (SHARE_TOKEN_RE.test(token)) {
      return { type: 'cart', sharedCartToken: token };
    }
    return { type: 'not_found' };
  }

  // /category/:mainCatId/:subCatId/:prodId
  if (segments[0] === 'category') {
    if (segments.length === 4) {
      const prodId = Number(segments[3]);
      if (Number.isInteger(prodId) && prodId > 0) {
        return {
          type: 'product',
          mainCategoryId: segments[1],
          subcategoryId: segments[2],
          productId: prodId,
        };
      }
      return { type: 'not_found' };
    }
    if (segments.length === 3) {
      return {
        type: 'subcategory',
        mainCategoryId: segments[1],
        subcategoryId: segments[2],
      };
    }
    if (segments.length === 2) {
      return {
        type: 'main_category',
        mainCategoryId: segments[1],
      };
    }
    return { type: 'not_found' };
  }

  // Also support shorthand /subcategory/:subCatId or /product/:prodId
  if (segments[0] === 'subcategory' && segments.length === 2 && segments[1]) {
    return {
      type: 'subcategory',
      subcategoryId: segments[1],
    };
  }

  if (segments[0] === 'product' && segments.length === 2 && segments[1]) {
    const prodId = Number(segments[1]);
    if (Number.isInteger(prodId) && prodId > 0) {
      return {
        type: 'product',
        productId: prodId,
      };
    }
    return { type: 'not_found' };
  }

  return { type: 'not_found' };
}

export function reorderItemsById<T extends { id: string | number }>(
  items: T[],
  sourceId: T['id'],
  targetId: T['id']
): T[] {
  if (sourceId === targetId) return items;
  const fromIdx = items.findIndex((item) => item.id === sourceId);
  const toIdx = items.findIndex((item) => item.id === targetId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return items;
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export function reorderSubsetInGlobalList<T extends { id: string | number }>(
  globalList: T[],
  subsetPredicate: (item: T) => boolean,
  sourceId: T['id'],
  targetId: T['id']
): T[] {
  if (sourceId === targetId) return globalList;
  const subset = globalList.filter(subsetPredicate);
  const reorderedSubset = reorderItemsById(subset, sourceId, targetId);
  if (reorderedSubset === subset) return globalList;
  let subsetIdx = 0;
  return globalList.map((item) => {
    if (subsetPredicate(item)) {
      return reorderedSubset[subsetIdx++];
    }
    return item;
  });
}

export interface CalcQueryParams {
  qty?: number;
  w?: number;
  h?: number;
  pages?: number;
  paper?: number;
  coverPaper?: number;
  sides?: 1 | 2;
  blockMode?: '4+4' | '1+1' | '0+0';
  coverMode?: '4+4' | '4+0';
  lamSides?: 0 | 1 | 2;
  lam?: number;
  params?: Record<string, string | number | boolean>;
}

export function parseCalcQueryParams(search: string): CalcQueryParams {
  const raw = (search || '').startsWith('?') ? search.slice(1) : search || '';
  if (!raw.trim()) return {};
  const sp = new URLSearchParams(raw);
  const result: CalcQueryParams = {};

  const parsePositiveInt = (key: string): number | undefined => {
    const val = sp.get(key);
    if (val === null || val.trim() === '') return undefined;
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };

  const qty = parsePositiveInt('qty');
  if (qty !== undefined) result.qty = qty;

  const w = parsePositiveInt('w');
  if (w !== undefined) result.w = w;

  const h = parsePositiveInt('h');
  if (h !== undefined) result.h = h;

  const pages = parsePositiveInt('pages');
  if (pages !== undefined) result.pages = pages;

  const paper = parsePositiveInt('paper');
  if (paper !== undefined) result.paper = paper;

  const coverPaper = parsePositiveInt('coverPaper');
  if (coverPaper !== undefined) result.coverPaper = coverPaper;

  const sidesRaw = sp.get('sides');
  if (sidesRaw === '1' || sidesRaw === '2') {
    result.sides = Number(sidesRaw) as 1 | 2;
  }

  const blockModeRaw = sp.get('blockMode');
  if (blockModeRaw === '4+4' || blockModeRaw === '1+1' || blockModeRaw === '0+0') {
    result.blockMode = blockModeRaw;
  }

  const coverModeRaw = sp.get('coverMode');
  if (coverModeRaw === '4+4' || coverModeRaw === '4+0') {
    result.coverMode = coverModeRaw;
  }

  const lamSidesRaw = sp.get('lamSides');
  if (lamSidesRaw === '0' || lamSidesRaw === '1' || lamSidesRaw === '2') {
    result.lamSides = Number(lamSidesRaw) as 0 | 1 | 2;
  }

  const lamRaw = sp.get('lam');
  if (lamRaw !== null && lamRaw.trim() !== '') {
    const lamNum = Number(lamRaw);
    if (Number.isFinite(lamNum) && lamNum >= 0) {
      result.lam = Math.round(lamNum);
    }
  }

  const paramsRaw = sp.get('params');
  if (paramsRaw) {
    try {
      const parsed = JSON.parse(paramsRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleanParams: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            cleanParams[k] = v;
          }
        }
        if (Object.keys(cleanParams).length > 0) {
          result.params = cleanParams;
        }
      }
    } catch {
      // ignore invalid JSON in params query
    }
  }

  return result;
}

export function buildCalcQueryString(params: CalcQueryParams): string {
  const sp = new URLSearchParams();

  if (params.qty !== undefined && Number.isFinite(params.qty) && params.qty > 0) {
    sp.set('qty', String(Math.round(params.qty)));
  }
  if (params.w !== undefined && Number.isFinite(params.w) && params.w > 0) {
    sp.set('w', String(Math.round(params.w)));
  }
  if (params.h !== undefined && Number.isFinite(params.h) && params.h > 0) {
    sp.set('h', String(Math.round(params.h)));
  }
  if (params.pages !== undefined && Number.isFinite(params.pages) && params.pages > 0) {
    sp.set('pages', String(Math.round(params.pages)));
  }
  if (params.paper !== undefined && Number.isFinite(params.paper) && params.paper > 0) {
    sp.set('paper', String(Math.round(params.paper)));
  }
  if (params.coverPaper !== undefined && Number.isFinite(params.coverPaper) && params.coverPaper > 0) {
    sp.set('coverPaper', String(Math.round(params.coverPaper)));
  }
  if (params.sides === 1 || params.sides === 2) {
    sp.set('sides', String(params.sides));
  }
  if (params.blockMode === '4+4' || params.blockMode === '1+1' || params.blockMode === '0+0') {
    sp.set('blockMode', params.blockMode);
  }
  if (params.coverMode === '4+4' || params.coverMode === '4+0') {
    sp.set('coverMode', params.coverMode);
  }
  if (params.lamSides === 0 || params.lamSides === 1 || params.lamSides === 2) {
    sp.set('lamSides', String(params.lamSides));
  }
  if (params.lam !== undefined && Number.isFinite(params.lam) && params.lam > 0) {
    sp.set('lam', String(Math.round(params.lam)));
  }
  if (params.params && Object.keys(params.params).length > 0) {
    sp.set('params', JSON.stringify(params.params));
  }

  const str = sp.toString();
  return str ? `?${str}` : '';
}

export function buildShareableProductUrl(
  origin: string,
  mainCategoryId: string,
  subcategoryId: string,
  productId: number,
  params: CalcQueryParams
): string {
  const cleanOrigin = (origin || '').replace(/\/+$/, '');
  const path = buildProductPath(mainCategoryId, subcategoryId, productId);
  const query = buildCalcQueryString(params);
  return `${cleanOrigin}${path}${query}`;
}



