import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminPath,
  buildCartPath,
  buildCrmPath,
  buildOrdersPath,
  buildMainCategoryPath,
  buildSubcategoryPath,
  buildProductPath,
  parseRoutePath,
  reorderItemsById,
  reorderSubsetInGlobalList,
  parseCalcQueryParams,
  buildCalcQueryString,
  buildShareableProductUrl,
  buildSharedCartPath,
  buildSharedCartUrl,
  parseSharedCartToken,
} from './routing';
import {
  extractDensity,
  isLoopbackHostname,
  isSecureAssetUrl,
  resolveImageUrl,
} from './constants';

test('build path helpers generate canonical URLs for cart, crm, orders, main category, subcategory, and product', () => {
  assert.equal(buildCartPath(), '/cart');
  assert.equal(buildCrmPath(), '/crm');
  assert.equal(buildOrdersPath(), '/orders');
  assert.equal(buildMainCategoryPath('polygraphy'), '/category/polygraphy');
  assert.equal(buildSubcategoryPath('polygraphy', 'flyers'), '/category/polygraphy/flyers');
  assert.equal(buildProductPath('polygraphy', 'flyers', 101), '/category/polygraphy/flyers/101');
  assert.deepEqual(parseRoutePath('/cart'), { type: 'cart' });
  assert.deepEqual(parseRoutePath('/cart/'), { type: 'cart' });
  assert.deepEqual(parseRoutePath('/crm'), { type: 'crm' });
  assert.deepEqual(parseRoutePath('/crm/'), { type: 'crm' });
  assert.deepEqual(parseRoutePath('/orders'), { type: 'orders' });
  assert.deepEqual(parseRoutePath('/orders/'), { type: 'orders' });
  assert.deepEqual(parseRoutePath('/manager'), { type: 'manager' });
  assert.deepEqual(parseRoutePath('/manager/'), { type: 'manager' });
  assert.deepEqual(parseRoutePath('/login'), { type: 'auth', authMode: 'login' });
  assert.deepEqual(parseRoutePath('/register'), { type: 'auth', authMode: 'register' });
  assert.deepEqual(parseRoutePath('/403'), { type: 'forbidden' });
});

test('parseRoutePath parses main category, subcategory, and product dynamic routes accurately', () => {
  assert.deepEqual(parseRoutePath('/category/wide_format'), {
    type: 'main_category',
    mainCategoryId: 'wide_format',
  });

  assert.deepEqual(parseRoutePath('/category/polygraphy/booklets'), {
    type: 'subcategory',
    mainCategoryId: 'polygraphy',
    subcategoryId: 'booklets',
  });

  assert.deepEqual(parseRoutePath('/category/polygraphy/calendars/402'), {
    type: 'product',
    mainCategoryId: 'polygraphy',
    subcategoryId: 'calendars',
    productId: 402,
  });
});

test('buildAdminPath and parseRoutePath handle all admin sections and dynamic category/product IDs', () => {
  assert.equal(buildAdminPath(), '/admin/products');
  assert.equal(buildAdminPath('products'), '/admin/products');
  assert.equal(buildAdminPath('materials'), '/admin/materials');
  assert.equal(buildAdminPath('add_material'), '/admin/new-material');
  assert.equal(buildAdminPath('markups'), '/admin/markups');
  assert.equal(buildAdminPath('users'), '/admin/users');
  assert.equal(buildAdminPath('roles'), '/admin/roles');
  assert.equal(buildAdminPath('discounts'), '/admin/discounts');

  assert.deepEqual(parseRoutePath('/admin'), {
    type: 'admin',
    adminSection: 'products',
  });
  assert.deepEqual(parseRoutePath('/admin/products'), {
    type: 'admin',
    adminSection: 'products',
  });
  assert.deepEqual(parseRoutePath('/admin/materials'), {
    type: 'admin',
    adminSection: 'materials',
  });
  assert.deepEqual(parseRoutePath('/admin/new-material'), {
    type: 'admin',
    adminSection: 'add_material',
  });
  assert.deepEqual(parseRoutePath('/admin/markups'), {
    type: 'admin',
    adminSection: 'markups',
  });
  assert.deepEqual(parseRoutePath('/admin/users'), {
    type: 'admin',
    adminSection: 'users',
  });
  assert.deepEqual(parseRoutePath('/admin/roles'), {
    type: 'admin',
    adminSection: 'roles',
  });
  assert.deepEqual(parseRoutePath('/admin/discounts'), {
    type: 'admin',
    adminSection: 'discounts',
  });
  assert.deepEqual(parseRoutePath('/admin/unknown'), {
    type: 'not_found',
  });
  assert.deepEqual(parseRoutePath('/category/main_6/cat_6/601'), {
    type: 'product',
    mainCategoryId: 'main_6',
    subcategoryId: 'cat_6',
    productId: 601,
  });
});

test('parseRoutePath returns home for root path and not_found for unknown or malformed paths', () => {
  assert.deepEqual(parseRoutePath('/'), { type: 'home' });
  assert.deepEqual(parseRoutePath('/?utm_source=test'), { type: 'home' });
  assert.deepEqual(parseRoutePath('/unknown-page'), { type: 'not_found' });
  assert.deepEqual(parseRoutePath('/category'), { type: 'not_found' });
  assert.deepEqual(parseRoutePath('/category/polygraphy/flyers/not-a-number'), {
    type: 'not_found',
  });
  assert.deepEqual(parseRoutePath('/category/polygraphy/flyers/101/extra'), {
    type: 'not_found',
  });
  assert.deepEqual(parseRoutePath('/product/invalid'), { type: 'not_found' });
});

test('resolveImageUrl and isSecureAssetUrl enforce HTTPS for external URLs and block XSS/Mixed Content', () => {
  assert.equal(resolveImageUrl('javascript:alert(1)'), '');
  assert.equal(resolveImageUrl('  JAVASCRIPT:alert(document.cookie) '), '');
  assert.equal(resolveImageUrl('vbscript:msgbox(1)'), '');
  assert.equal(resolveImageUrl('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.equal(resolveImageUrl('//evil.example.com/banner.webp'), '');
  assert.equal(resolveImageUrl('http://example.com/banner.webp'), '');
  assert.equal(resolveImageUrl('HTTP://EXAMPLE.COM/banner.webp'), '');
  assert.equal(resolveImageUrl('/uploads/prod_123456.png'), '/uploads/prod_123456.png');
  assert.equal(resolveImageUrl('https://example.com/banner.webp'), 'https://example.com/banner.webp');
  assert.equal(
    resolveImageUrl('http://localhost:5000/uploads/prod_1.png'),
    'http://localhost:5000/uploads/prod_1.png'
  );

  assert.equal(isSecureAssetUrl('/uploads/prod_123456.png'), true);
  assert.equal(isSecureAssetUrl('/assets/logo.svg'), true);
  assert.equal(isSecureAssetUrl('https://cdn.example.com/img.webp'), true);
  assert.equal(isSecureAssetUrl('http://cdn.example.com/img.webp'), false);
  assert.equal(isSecureAssetUrl('//cdn.example.com/img.webp'), false);
  assert.equal(isSecureAssetUrl('javascript:alert(1)'), false);

  assert.equal(isLoopbackHostname('localhost'), true);
  assert.equal(isLoopbackHostname('127.0.0.1'), true);
  assert.equal(isLoopbackHostname('[::1]'), true);
  assert.equal(isLoopbackHostname('example.com'), false);
});

test('extractDensity extracts paper density and lamination thickness accurately', () => {
  assert.equal(extractDensity('Мелованная глянцевая 150 г/м²'), 150);
  assert.equal(extractDensity('Soft-Touch 34 мкр'), 34);
  assert.equal(extractDensity('Без плотности'), null);
});

test('reorderItemsById moves items forward, backward, and handles no-op edge cases', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(
    reorderItemsById(list, 'a', 'c').map((x) => x.id),
    ['b', 'c', 'a', 'd']
  );
  assert.deepEqual(
    reorderItemsById(list, 'd', 'b').map((x) => x.id),
    ['a', 'd', 'b', 'c']
  );
  assert.equal(reorderItemsById(list, 'b', 'b'), list);
  assert.equal(reorderItemsById(list, 'x', 'b'), list);
});

test('reorderSubsetInGlobalList reorders only matching category/product subset while preserving other items', () => {
  const globalProds = [
    { id: 101, category: 'flyers' },
    { id: 201, category: 'booklets' },
    { id: 102, category: 'flyers' },
    { id: 103, category: 'flyers' },
    { id: 202, category: 'booklets' },
  ];
  const updated = reorderSubsetInGlobalList(
    globalProds,
    (p) => p.category === 'flyers',
    103,
    101
  );
  assert.deepEqual(
    updated.map((p) => p.id),
    [103, 201, 101, 102, 202]
  );
});

test('buildCalcQueryString and parseCalcQueryParams serialize and restore full calculation state', () => {
  const input = {
    qty: 500,
    w: 210,
    h: 297,
    pages: 16,
    paper: 3,
    coverPaper: 5,
    sides: 2 as const,
    blockMode: '1+1' as const,
    coverMode: '4+0' as const,
    lamSides: 1 as const,
    lam: 2,
    params: {
      cp_rounding: true,
      cp_eyelets: 8,
      cp_binding: 'staple',
    },
  };

  const qs = buildCalcQueryString(input);
  assert.ok(qs.startsWith('?'));
  const parsed = parseCalcQueryParams(qs);
  assert.deepEqual(parsed, input);

  const fullUrl = buildShareableProductUrl('https://calc.example.ru', 'polygraphy', 'flyers', 1, {
    qty: 250,
    sides: 2,
  });
  assert.equal(fullUrl, 'https://calc.example.ru/category/polygraphy/flyers/1?qty=250&sides=2');
});

test('normalizeRolePermissions merges partial permissions and always keeps admin permissions enabled', async () => {
  const { DEFAULT_ROLE_PERMISSIONS, normalizeRolePermissions, PERMISSION_KEYS } = await import(
    './constants'
  );
  const defaults = normalizeRolePermissions(undefined);
  assert.deepEqual(defaults, DEFAULT_ROLE_PERMISSIONS);

  assert.equal(DEFAULT_ROLE_PERMISSIONS.manager.view_all_orders, false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.production.view_all_orders, true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.admin.view_all_orders, true);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.client.view_all_orders, false);

  const customized = normalizeRolePermissions({
    client: {
      view_crm: true,
      manage_catalog: true,
      manage_users: true,
    },
    production: {
      ...DEFAULT_ROLE_PERMISSIONS.production,
      manage_order_finances: true,
      delete_orders: true,
    },
    manager: {
      ...DEFAULT_ROLE_PERMISSIONS.manager,
      apply_discounts: false,
    },
    admin: {
      manage_kp: false,
      apply_discounts: false,
      view_crm: false,
      view_all_orders: false,
      update_order_status: false,
      manage_order_finances: false,
      view_internal_metrics: false,
      delete_orders: false,
    },
  });

  assert.equal(customized.production.manage_order_finances, true);
  assert.equal(customized.production.delete_orders, true);
  assert.equal(customized.production.view_crm, true);
  assert.equal(customized.production.view_all_orders, true);
  assert.equal(customized.manager.apply_discounts, false);
  assert.equal(customized.manager.view_all_orders, false);
  assert.equal(customized.manager.manage_kp, true);

  for (const key of PERMISSION_KEYS) {
    assert.equal(customized.admin[key], true);
    assert.equal(customized.client[key], false);
  }
});

test('shared cart URL builders and token parsers handle /cart?share=... and /cart/s/...', () => {
  const token = 'a1b2c3d4e5f60718';
  assert.equal(buildSharedCartPath(token), '/cart?share=a1b2c3d4e5f60718');
  assert.equal(
    buildSharedCartUrl('https://calc.example.ru/', token),
    'https://calc.example.ru/cart?share=a1b2c3d4e5f60718'
  );
  assert.equal(parseSharedCartToken('/cart', '?share=a1b2c3d4e5f60718'), token);
  assert.equal(parseSharedCartToken('/cart/s/a1b2c3d4e5f60718', ''), token);
  assert.deepEqual(parseRoutePath('/cart/s/a1b2c3d4e5f60718'), {
    type: 'cart',
    sharedCartToken: token,
  });
  assert.equal(parseSharedCartToken('/cart', '?share=invalid-token!'), null);
  assert.deepEqual(parseRoutePath('/cart/s/invalid-token!'), { type: 'not_found' });
});

test('normalizeRoleOrderStatuses enforces canonical order, keeps admin all statuses and client empty', async () => {
  const { ALL_ORDER_STATUSES, DEFAULT_ROLE_ORDER_STATUSES, normalizeRoleOrderStatuses } =
    await import('./constants');
  const defaults = normalizeRoleOrderStatuses(undefined);
  assert.deepEqual(defaults, DEFAULT_ROLE_ORDER_STATUSES);

  const customized = normalizeRoleOrderStatuses({
    client: ['new', 'completed'],
    production: ['ready', 'in_progress'],
    manager: ['cancelled', 'new'],
    admin: ['new'],
  });
  assert.deepEqual(customized.client, []);
  assert.deepEqual(customized.production, ['in_progress', 'ready']);
  assert.deepEqual(customized.manager, ['new', 'cancelled']);
  assert.deepEqual(customized.admin, ALL_ORDER_STATUSES);
});

test('getExpectedNextOrderStatus and isSequentialOrderStatusTransition validate sequential CRM status pipeline', async () => {
  const { getExpectedNextOrderStatus, isSequentialOrderStatusTransition } = await import(
    './components/CrmOrdersPage'
  );

  // Ожидаемый следующий этап по порядку
  assert.equal(getExpectedNextOrderStatus('new'), 'awaiting_payment');
  assert.equal(getExpectedNextOrderStatus('awaiting_payment'), 'prepress');
  assert.equal(getExpectedNextOrderStatus('prepress'), 'in_progress');
  assert.equal(getExpectedNextOrderStatus('in_progress'), 'ready');
  assert.equal(getExpectedNextOrderStatus('ready'), 'completed');
  assert.equal(getExpectedNextOrderStatus('completed'), null);
  assert.equal(getExpectedNextOrderStatus('cancelled'), null);

  // Переходы по порядку без пропуска этапов возвращают true
  assert.equal(isSequentialOrderStatusTransition('new', 'awaiting_payment'), true);
  assert.equal(isSequentialOrderStatusTransition('awaiting_payment', 'prepress'), true);
  assert.equal(isSequentialOrderStatusTransition('prepress', 'in_progress'), true);
  assert.equal(isSequentialOrderStatusTransition('in_progress', 'ready'), true);
  assert.equal(isSequentialOrderStatusTransition('ready', 'completed'), true);
  assert.equal(isSequentialOrderStatusTransition('new', 'new'), true);

  // Переходы через шаг, возвраты назад и переходы в cancelled возвращают false
  assert.equal(isSequentialOrderStatusTransition('new', 'in_progress'), false);
  assert.equal(isSequentialOrderStatusTransition('prepress', 'ready'), false);
  assert.equal(isSequentialOrderStatusTransition('in_progress', 'prepress'), false);
  assert.equal(isSequentialOrderStatusTransition('completed', 'ready'), false);
  assert.equal(isSequentialOrderStatusTransition('new', 'cancelled'), false);
  assert.equal(isSequentialOrderStatusTransition('completed', 'cancelled'), false);
  assert.equal(isSequentialOrderStatusTransition('cancelled', 'new'), false);
});

test('buildOffsetDeadline and buildDefault24hDeadline clamp +24h to 10:00..18:00 and set +3d/+7d to 16:00', async () => {
  const { buildOffsetDeadline, buildDefault24hDeadline, toDateTimeLocalValue } = await import(
    './components/CrmOrdersPage'
  );

  // Раньше 10:00 -> на следующий день 10:00
  const baseEarly = new Date(2026, 10, 5, 6, 0, 0); // 2026-11-05 06:00 local
  assert.equal(buildDefault24hDeadline(baseEarly), '2026-11-06T10:00');
  assert.equal(buildOffsetDeadline(24, baseEarly), '2026-11-06T10:00');

  const baseMorning = new Date(2026, 10, 5, 9, 7, 0); // 2026-11-05 09:07 local
  assert.equal(buildDefault24hDeadline(baseMorning), '2026-11-06T10:00');

  // В рабочем интервале 10:00..18:00 -> сохраняется точное время
  const baseWorkday = new Date(2026, 10, 5, 14, 25, 0); // 2026-11-05 14:25 local
  assert.equal(buildDefault24hDeadline(baseWorkday), '2026-11-06T14:25');
  assert.equal(buildOffsetDeadline(24, baseWorkday), '2026-11-06T14:25');

  // Позже 18:00 -> на следующий день 18:00
  const baseLate = new Date(2026, 10, 5, 21, 10, 0); // 2026-11-05 21:10 local
  assert.equal(buildDefault24hDeadline(baseLate), '2026-11-06T18:00');
  assert.equal(buildOffsetDeadline(24, baseLate), '2026-11-06T18:00');

  // +3 д. (72 ч) и +7 д. (168 ч) -> фиксированное время 16:00
  assert.equal(buildOffsetDeadline(72, baseWorkday), '2026-11-08T16:00');
  assert.equal(buildOffsetDeadline(168, baseWorkday), '2026-11-12T16:00');

  // toDateTimeLocalValue для даты без времени подставляет T16:00
  assert.equal(toDateTimeLocalValue('2026-11-08'), '2026-11-08T16:00');
  assert.equal(toDateTimeLocalValue('2026-11-08T14:25'), '2026-11-08T14:25');
});
