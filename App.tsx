import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  AuthUser,
  BlockPrintModeType,
  CatalogItemPublic,
  CatalogLimits,
  CostItem,
  CoverPrintModeType,
  Settings,
  CalculationResult,
  EstimateItem,
  MainCategory,
  MaterialCategory,
  ProductCategory,
  ProductItem,
  CrmNotification,
  CrmOrder,
} from './types';
import { apiFetch } from './apiClient';
import {
  DEFAULT_MATERIAL_CATEGORIES,
  DEFAULT_ROLE_ORDER_STATUSES,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRoleOrderStatuses,
  normalizeRolePermissions,
  normalizeRolesList,
  resolveImageUrl,
} from './constants';
import { resolveBindingType } from './components/ProductSchematicSVG';
import HeaderMegaMenu from './components/HeaderMegaMenu';
import AdminHeaderNav from './components/AdminHeaderNav';
import ProductLightboxModal from './components/ProductLightboxModal';
import ProductKindsSidebar from './components/ProductKindsSidebar';
import CatalogGrid from './components/CatalogGrid';
import ProductCalculatorView from './components/ProductCalculatorView';
import EstimatePanel from './components/EstimatePanel';
import NotFoundPage from './components/NotFoundPage';
import ForbiddenPage from './components/ForbiddenPage';
import { useTheme } from './theme';
import { useEstimateCart } from './features/cart/useEstimateCart';
import { useAuth } from './features/auth/useAuth';
import { useCatalog } from './features/catalog/useCatalog';
import { useCalculator } from './features/calculator/useCalculator';
import AppShell from './app/AppShell';
import {
  DEFAULT_EYELET_SPACING,
  formatDimensionsTextInCm,
  getDefaultBannerMarginCm,
  isBannerProduct,
  isEyeletCostParam,
  isWideFormatSectionOrCategory,
  normalizePagesForBinding,
} from './calculatorUtils';
import {
  AdminSectionType,
  buildAdminPath,
  buildCartPath,
  buildCrmPath,
  buildOrdersPath,
  buildMainCategoryPath,
  buildSubcategoryPath,
  buildProductPath,
  parseCalcQueryParams,
  parseRoutePath,
  parseSharedCartToken,
} from './routing';
import { showDesktopNotification } from './desktopNotifications';
import { useAdaptiveCardTilt } from './utils/adaptiveCardTilt';
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const CrmOrdersPage = lazy(() => import('./components/CrmOrdersPage'));
const ClientOrdersPage = lazy(() => import('./components/ClientOrdersPage'));

function RouteLoading({ theme }: { theme: Record<string, string> }) {
  return <div style={{ padding: 40, textAlign: 'center', color: theme.subText }}>Загрузка...</div>;
}

export default function App() {
  const { isDark, setIsDark, t, inputStyle, smallInputStyle } = useTheme();
  useAdaptiveCardTilt();

  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [sharedCartToken, setSharedCartToken] = useState<string | null>(() =>
    parseSharedCartToken(window.location.pathname, window.location.search)
  );
  const [sharedCartItems, setSharedCartItems] = useState<EstimateItem[]>([]);
  const [isLoadingSharedCart, setIsLoadingSharedCart] = useState<boolean>(() =>
    Boolean(parseSharedCartToken(window.location.pathname, window.location.search))
  );

  const navigateTo = (path: string, replace = false) => {
    const currentFull = window.location.pathname + window.location.search;
    if (currentFull !== path) {
      if (replace) {
        window.history.replaceState({}, '', path);
      } else {
        window.history.pushState({}, '', path);
      }
    }
    const cleanPathname = path.split('?')[0] || '/';
    setCurrentPath(cleanPathname);
    setSharedCartToken(parseSharedCartToken(window.location.pathname, window.location.search));
    const parsed = parseRoutePath(cleanPathname);
    if (parsed.type === 'admin' && parsed.adminSection) {
      setAdminSection(parsed.adminSection);
    }
  };

  const isAdminRoute = currentPath.startsWith('/admin');

  const [adminSection, setAdminSection] = useState<AdminSectionType>(() => {
    const parsed = parseRoutePath(window.location.pathname);
    if (parsed.type === 'admin' && parsed.adminSection) {
      return parsed.adminSection;
    }
    return 'products';
  });

  const clearCalculationCacheRef = useRef<(() => void) | null>(null);
  const handleCatalogChanged = React.useCallback(() => {
    clearCalculationCacheRef.current?.();
  }, []);

  const {
    publicMainCategories,
    publicCategories,
    papers,
    laminations,
    publicProducts,
    publicCategoryQtyTiers,
    usableLimits,
    setUsableLimits,
    rolePermissions,
    setRolePermissions,
    roleOrderStatuses,
    setRoleOrderStatuses,
    applyCatalogPayload,
    fetchCatalog: fetchCatalogFromHook,
  } = useCatalog(handleCatalogChanged);

  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('polygraphy');
  const [selectedCategory, setSelectedCategory] = useState<string>('flyers');
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState<boolean>(false);

  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [isRouteNotFound, setIsRouteNotFound] = useState<boolean>(() => {
    return parseRoutePath(window.location.pathname).type === 'not_found';
  });
  const [isEstimateHighlighted, setIsEstimateHighlighted] = useState<boolean>(false);
  const estimateHighlightTimerRef = useRef<number | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  const {
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
  } = useAuth({ showToast, navigateTo, rolePermissions, roleOrderStatuses });

  const [crmUnreadCount, setCrmUnreadCount] = useState<number>(0);
  const seenNotifIdsRef = useRef<Set<string> | null>(null);
  const crmPollInFlightRef = useRef<boolean>(false);
  const crmPollAbortRef = useRef<AbortController | null>(null);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const navigateToRef = useRef(navigateTo);
  navigateToRef.current = navigateTo;

  const fetchCrmNotificationsSummary = React.useCallback(async () => {
    if (!authToken || !canAccessCrm) {
      crmPollAbortRef.current?.abort();
      crmPollAbortRef.current = null;
      crmPollInFlightRef.current = false;
      setCrmUnreadCount(0);
      seenNotifIdsRef.current = null;
      return;
    }
    if (crmPollInFlightRef.current) {
      return;
    }
    const controller = new AbortController();
    crmPollAbortRef.current = controller;
    crmPollInFlightRef.current = true;
    try {
      const res = await apiFetch('/crm/notifications', {
        token: authToken,
        signal: controller.signal,
      });
      if (!res.ok || controller.signal.aborted) return;
      const data = await res.json().catch(() => null);
      if (!data || controller.signal.aborted) return;
      const unreadCount = Number(data.unread_count) || 0;
      const list: CrmNotification[] = Array.isArray(data.notifications) ? data.notifications : [];
      setCrmUnreadCount(unreadCount);

      if (seenNotifIdsRef.current === null) {
        seenNotifIdsRef.current = new Set(list.map((n) => n.id));
      } else {
        const prevSeen = seenNotifIdsRef.current;
        const newUnread = list.filter((n) => !n.is_read && !prevSeen.has(n.id));
        list.forEach((n) => prevSeen.add(n.id));
        if (newUnread.length > 0) {
          showToastRef.current(`🔔 ${newUnread[0].message}`);
          newUnread.forEach((notif) => {
            showDesktopNotification({
              title: `CRM Типография — Заказ №${notif.order_id}`,
              body: notif.message + (notif.client_name ? ` (${notif.client_name})` : ''),
              tag: `crm-notif-${notif.id}`,
              onClick: () => {
                navigateToRef.current(buildCrmPath());
              },
            });
          });
        }
      }
    } catch {
      // ignore aborted or transient background polling error
    } finally {
      if (crmPollAbortRef.current === controller) {
        crmPollAbortRef.current = null;
      }
      crmPollInFlightRef.current = false;
    }
  }, [authToken, canAccessCrm]);

  useEffect(() => {
    if (!authToken || !canAccessCrm) {
      setCrmUnreadCount(0);
      seenNotifIdsRef.current = null;
      return;
    }
    if (document.visibilityState !== 'hidden') {
      void fetchCrmNotificationsSummary();
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void fetchCrmNotificationsSummary();
    }, 15000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchCrmNotificationsSummary();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      crmPollAbortRef.current?.abort();
      crmPollAbortRef.current = null;
      crmPollInFlightRef.current = false;
    };
  }, [authToken, canAccessCrm, fetchCrmNotificationsSummary]);

  const isCrmRoute = currentPath === '/crm';
  const prevIsCrmRouteRef = useRef<boolean>(isCrmRoute);
  useEffect(() => {
    if (prevIsCrmRouteRef.current !== isCrmRoute) {
      prevIsCrmRouteRef.current = isCrmRoute;
      if (authToken && canAccessCrm && document.visibilityState !== 'hidden') {
        void fetchCrmNotificationsSummary();
      }
    }
  }, [isCrmRoute, authToken, canAccessCrm, fetchCrmNotificationsSummary]);
  const [customWidth, setCustomWidth] = useState<number>(105);
  const [customHeight, setCustomHeight] = useState<number>(148);
  const [pagesCount, setPagesCount] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(100);

  const [selectedPaperId, setSelectedPaperId] = useState<number>(0);
  const [selectedCoverPaperId, setSelectedCoverPaperId] = useState<number>(0);
  const [printSides, setPrintSides] = useState<number>(1);
  const [blockPrintMode, setBlockPrintMode] = useState<BlockPrintModeType>('4+4');
  const [coverPrintMode, setCoverPrintMode] = useState<CoverPrintModeType>('4+0');
  const [selectedLaminationId, setSelectedLaminationId] = useState<number | null>(null);
  const [laminationSides, setLaminationSides] = useState<number>(0);
  const [selectedClientParams, setSelectedClientParams] = useState<
    Record<string, string | number | boolean>
  >({});
  const [disabledInternalParamIds, setDisabledInternalParamIds] = useState<string[]>([]);

  const {
    estimateItems,
    addEstimateItem: handleAddEstimateItem,
    addMultipleEstimateItems: handleAddMultipleEstimateItems,
    removeEstimateItem: handleRemoveEstimateItem,
    duplicateEstimateItem: handleDuplicateEstimateItem,
    updateEstimateItemNote: handleUpdateEstimateItemNote,
    clearEstimate: handleClearEstimate,
    clearEstimateSilently,
  } = useEstimateCart(showToast);

  useEffect(() => {
    if (!sharedCartToken) {
      setSharedCartItems([]);
      setIsLoadingSharedCart(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSharedCart(true);

    (async () => {
      try {
        const res = await apiFetch(`/shared-carts/${encodeURIComponent(sharedCartToken)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setSharedCartItems([]);
          setIsLoadingSharedCart(false);
          navigateTo(buildCartPath(), true);
          showToast('Ссылка на корзину не найдена или устарела');
          return;
        }
        if (!res.ok) {
          setSharedCartItems([]);
          setIsLoadingSharedCart(false);
          navigateTo(buildCartPath(), true);
          showToast('Не удалось загрузить общую корзину');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const nowIso = new Date().toISOString();
        const rawItems: EstimateItem[] = Array.isArray(data?.items) ? data.items : [];
        const normalizedItems: EstimateItem[] = rawItems.map((item, idx) => ({
          ...item,
          id: item.id || `shared_${sharedCartToken}_${idx}`,
          createdAt: item.createdAt || nowIso,
        }));
        setSharedCartItems(normalizedItems);
        setIsLoadingSharedCart(false);
      } catch {
        if (!cancelled) {
          setSharedCartItems([]);
          setIsLoadingSharedCart(false);
          navigateTo(buildCartPath(), true);
          showToast('Ошибка при загрузке общей корзины');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sharedCartToken]);

  const [adminMainCategories, setAdminMainCategories] = useState<MainCategory[]>([]);
  const [adminCategories, setAdminCategories] = useState<ProductCategory[]>([]);
  const [adminMaterialCategories, setAdminMaterialCategories] = useState<MaterialCategory[]>(
    DEFAULT_MATERIAL_CATEGORIES
  );
  const [adminItems, setAdminItems] = useState<CostItem[]>([]);
  const [adminProducts, setAdminProducts] = useState<ProductItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AuthUser[]>([]);
  const [adminOrders, setAdminOrders] = useState<CrmOrder[]>([]);
  const [settings, setSettings] = useState<Settings>({
    sheet_length_m: 0.5,
    usable_width_mm: 310,
    usable_height_mm: 440,
    bleed_mm: 4.0,
    defect_percent: 3.0,
    tax_percent: 6.0,
    main_category_params: {},
    category_markups: {},
    role_permissions: DEFAULT_ROLE_PERMISSIONS,
    role_order_statuses: DEFAULT_ROLE_ORDER_STATUSES,
  });

  useEffect(() => {
    if (settings.role_permissions || settings.roles) {
      setRolePermissions(normalizeRolePermissions(settings.role_permissions, settings.roles));
    }
    if (settings.role_order_statuses || settings.roles) {
      setRoleOrderStatuses(
        normalizeRoleOrderStatuses(settings.role_order_statuses, settings.roles)
      );
    }
  }, [
    settings.role_permissions,
    settings.role_order_statuses,
    settings.roles,
    setRolePermissions,
    setRoleOrderStatuses,
  ]);

  const [activeAdminProductCategory, setActiveAdminProductCategory] = useState<string>('flyers');
  const [activeMarkupCategory, setActiveMarkupCategory] = useState<string>('flyers');
  const [newMatEnabledCats, setNewMatEnabledCats] = useState<string[]>([]);

  const applyRouteFromPath = (
    pathname: string,
    loadedMainCats: MainCategory[],
    loadedCats: ProductCategory[],
    loadedProds: ProductItem[],
    loadedPapers: CatalogItemPublic[],
    loadedLams: CatalogItemPublic[]
  ) => {
    const parsed = parseRoutePath(pathname);

    if (parsed.type === 'admin') {
      setIsRouteNotFound(false);
      if (parsed.adminSection) {
        setAdminSection(parsed.adminSection);
      }
      return;
    }

    if (parsed.type === 'not_found') {
      setIsRouteNotFound(true);
      setSelectedMainCategory('');
      setSelectedCategory('');
      setSelectedProductId(0);
      setCalcResult(null);
      return;
    }

    if (parsed.type === 'home') {
      setIsRouteNotFound(false);
      setSelectedMainCategory('');
      setSelectedCategory('');
      setSelectedProductId(0);
      setCalcResult(null);
      return;
    }

    if (
      parsed.type === 'cart' ||
      parsed.type === 'manager' ||
      parsed.type === 'crm' ||
      parsed.type === 'orders' ||
      parsed.type === 'auth' ||
      parsed.type === 'forbidden'
    ) {
      setIsRouteNotFound(false);
      return;
    }

    const defaultMain = loadedMainCats[0]?.id || 'polygraphy';

    if (parsed.type === 'product' && parsed.productId) {
      const targetProd = loadedProds.find((p) => p.id === parsed.productId);
      if (targetProd) {
        const subCat = loadedCats.find((c) => c.id === targetProd.category);
        const resolvedMainId = subCat?.parent_id || defaultMain;
        const subMatches = !parsed.subcategoryId || targetProd.category === parsed.subcategoryId;
        const mainMatches =
          !parsed.mainCategoryId ||
          (resolvedMainId === parsed.mainCategoryId &&
            loadedMainCats.some((mc) => mc.id === parsed.mainCategoryId));

        if (subMatches && mainMatches) {
          setIsRouteNotFound(false);
          setSelectedMainCategory(resolvedMainId);
          setSelectedCategory(targetProd.category);
          applyProductSelection(targetProd, loadedPapers, loadedLams, window.location.search);
          return;
        }
      }
      setIsRouteNotFound(true);
      setSelectedMainCategory('');
      setSelectedCategory('');
      setSelectedProductId(0);
      setCalcResult(null);
      return;
    }

    if (parsed.type === 'subcategory' && parsed.subcategoryId) {
      const targetSub = loadedCats.find((c) => c.id === parsed.subcategoryId);
      if (targetSub) {
        const resolvedMainId = targetSub.parent_id || defaultMain;
        const mainMatches =
          !parsed.mainCategoryId ||
          (resolvedMainId === parsed.mainCategoryId &&
            loadedMainCats.some((mc) => mc.id === parsed.mainCategoryId));

        if (mainMatches) {
          setIsRouteNotFound(false);
          setSelectedMainCategory(resolvedMainId);
          setSelectedCategory(targetSub.id);
          const prodsInSub = loadedProds.filter((p) => p.category === targetSub.id);
          if (prodsInSub.length > 0) {
            const keepCurrent =
              prodsInSub.find((p) => p.id === selectedProductId) || prodsInSub[0];
            applyProductSelection(keepCurrent, loadedPapers, loadedLams);
          } else {
            setSelectedProductId(0);
            setCalcResult(null);
          }
          return;
        }
      }
      setIsRouteNotFound(true);
      setSelectedMainCategory('');
      setSelectedCategory('');
      setSelectedProductId(0);
      setCalcResult(null);
      return;
    }

    if (parsed.type === 'main_category' && parsed.mainCategoryId) {
      const targetMain = loadedMainCats.find((mc) => mc.id === parsed.mainCategoryId);
      if (targetMain) {
        setIsRouteNotFound(false);
        setSelectedMainCategory(targetMain.id);
        setSelectedCategory('');
        setSelectedProductId(0);
        setCalcResult(null);
        return;
      }
      setIsRouteNotFound(true);
      setSelectedMainCategory('');
      setSelectedCategory('');
      setSelectedProductId(0);
      setCalcResult(null);
      return;
    }

    setIsRouteNotFound(true);
    setSelectedMainCategory('');
    setSelectedCategory('');
    setSelectedProductId(0);
    setCalcResult(null);
  };

  const popStateSyncRef = useRef<() => void>(() => {});
  popStateSyncRef.current = () => {
    const nextPath = window.location.pathname;
    setCurrentPath(nextPath);
    setSharedCartToken(parseSharedCartToken(window.location.pathname, window.location.search));
    const parsed = parseRoutePath(nextPath);
    if (parsed.type === 'admin' && parsed.adminSection) {
      setIsRouteNotFound(false);
      setAdminSection(parsed.adminSection);
    }
    if (publicMainCategories.length > 0 || publicCategories.length > 0) {
      applyRouteFromPath(
        nextPath,
        publicMainCategories,
        publicCategories,
        publicProducts,
        papers,
        laminations
      );
    }
  };

  useEffect(() => {
    const onPopState = () => {
      popStateSyncRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const fetchCatalog = async (): Promise<void> => {
    await fetchCatalogFromHook();
  };

  // Load the public catalog for every visitor, including direct deep links.
  useEffect(() => {
    void fetchCatalogFromHook();
  }, [fetchCatalogFromHook]);

  // Reconcile the current URL after the asynchronous catalog becomes available.
  useEffect(() => {
    if (publicMainCategories.length === 0 && publicCategories.length === 0) return;
    applyRouteFromPath(
      window.location.pathname,
      publicMainCategories,
      publicCategories,
      publicProducts,
      papers,
      laminations
    );
  }, [publicMainCategories, publicCategories, publicProducts, papers, laminations]);
  const applyProductSelection = (
    prod: ProductItem,
    availablePapersList: CatalogItemPublic[] = papers,
    availableLamsList: CatalogItemPublic[] = laminations,
    querySearch?: string
  ) => {
    const queryOverrides = querySearch ? parseCalcQueryParams(querySearch) : {};

    setSelectedProductId(prod.id);
    setActiveImageIndex(0);
    const initW =
      prod.allow_custom_size && queryOverrides.w ? queryOverrides.w : prod.width_mm;
    const initH =
      prod.allow_custom_size && queryOverrides.h ? queryOverrides.h : prod.height_mm;
    setCustomWidth(initW);
    setCustomHeight(initH);
    if (queryOverrides.qty) {
      setQuantity(queryOverrides.qty);
    }

    const initClientParams: Record<string, string | number | boolean> = {};
    if (isBannerProduct(prod)) {
      initClientParams.banner_margin_cm = getDefaultBannerMarginCm(initW, initH);
    }
    (prod.cost_params || []).forEach((cp) => {
      if (cp.is_client_facing) {
        if (cp.input_type === 'select') {
          initClientParams[cp.id] =
            cp.default_value !== undefined && cp.default_value !== false
              ? String(cp.default_value)
              : cp.options?.[0]?.id || '';
        } else if (cp.input_type === 'number') {
          initClientParams[cp.id] = Number(cp.default_value || 0);
        } else {
          initClientParams[cp.id] = Boolean(cp.default_value);
          if (isEyeletCostParam(cp, undefined, prod.category)) {
            initClientParams.eyelets_step = DEFAULT_EYELET_SPACING;
          }
        }
      }
    });
    if (queryOverrides.params) {
      for (const [k, v] of Object.entries(queryOverrides.params)) {
        if (
          k in initClientParams ||
          k === 'eyelets_step' ||
          k === 'banner_margin_cm' ||
          k === 'banner_margin_manual'
        ) {
          initClientParams[k] = v;
        }
      }
      if (
        isBannerProduct(prod) &&
        queryOverrides.params.banner_margin_cm !== undefined &&
        String(queryOverrides.params.banner_margin_cm) !== getDefaultBannerMarginCm(initW, initH)
      ) {
        initClientParams.banner_margin_manual = true;
      }
    }

    const initBinding = resolveBindingType(prod, initClientParams);
    const { normalized: initPages } = normalizePagesForBinding(
      queryOverrides.pages || prod.default_pages || 1,
      prod.multi_page_mode,
      initBinding
    );
    setPagesCount(initPages);
    setSelectedClientParams(initClientParams);
    setDisabledInternalParamIds([]);

    if (prod.allowed_sides === 'single_only') {
      setPrintSides(1);
    } else if (prod.allowed_sides === 'duplex_only' || prod.multi_page_mode === 'pages') {
      setPrintSides(2);
    } else if (queryOverrides.sides === 1 || queryOverrides.sides === 2) {
      setPrintSides(queryOverrides.sides);
    }

    if (prod.allowed_block_print_modes === '1+1') {
      setBlockPrintMode('1+1');
    } else if (prod.allowed_block_print_modes === '4+4') {
      setBlockPrintMode('4+4');
    } else if (queryOverrides.blockMode) {
      setBlockPrintMode(queryOverrides.blockMode);
    } else {
      setBlockPrintMode('4+4');
    }

    if (prod.allowed_cover_print_modes === '4+4') {
      setCoverPrintMode('4+4');
    } else if (prod.allowed_cover_print_modes === '4+0') {
      setCoverPrintMode('4+0');
    } else if (queryOverrides.coverMode) {
      setCoverPrintMode(queryOverrides.coverMode);
    } else {
      setCoverPrintMode('4+0');
    }

    const allowedPapers = availablePapersList
      .filter((p) => prod.allowed_paper_ids.includes(p.id))
      .sort((a, b) => prod.allowed_paper_ids.indexOf(a.id) - prod.allowed_paper_ids.indexOf(b.id));
    const inStockPapers = allowedPapers.filter((p) => p.in_stock !== false);
    const pool = inStockPapers.length > 0 ? inStockPapers : allowedPapers;
    if (queryOverrides.paper && allowedPapers.some((p) => p.id === queryOverrides.paper)) {
      setSelectedPaperId(queryOverrides.paper);
    } else if (pool.length > 0) {
      setSelectedPaperId(pool[0].id);
    } else if (availablePapersList.length > 0) {
      setSelectedPaperId(availablePapersList[0].id);
    }

    const coverAllowedIds =
      Array.isArray(prod.allowed_cover_paper_ids) && prod.allowed_cover_paper_ids.length > 0
        ? prod.allowed_cover_paper_ids
        : prod.allowed_paper_ids;
    const allowedCoverPapers = availablePapersList.filter((p) => coverAllowedIds.includes(p.id));
    const inStockCoverPapers = allowedCoverPapers.filter((p) => p.in_stock !== false);
    const coverPool = inStockCoverPapers.length > 0 ? inStockCoverPapers : allowedCoverPapers;
    if (
      queryOverrides.coverPaper &&
      allowedCoverPapers.some((p) => p.id === queryOverrides.coverPaper)
    ) {
      setSelectedCoverPaperId(queryOverrides.coverPaper);
    } else if (coverPool.length > 0) {
      if (!coverPool.some((p) => p.id === selectedCoverPaperId)) {
        const densePaper =
          coverPool.find((p) => p.name.includes('300') || p.name.includes('170')) || coverPool[0];
        setSelectedCoverPaperId(densePaper.id);
      }
    } else if (availablePapersList.length > 0) {
      setSelectedCoverPaperId(availablePapersList[0].id);
    }

    const allowedLams = availableLamsList.filter((l) => prod.allowed_lamination_ids.includes(l.id));
    if (allowedLams.length === 0) {
      setLaminationSides(0);
      setSelectedLaminationId(null);
    } else {
      if (
        queryOverrides.lamSides === 0 ||
        queryOverrides.lamSides === 1 ||
        queryOverrides.lamSides === 2
      ) {
        setLaminationSides(queryOverrides.lamSides);
      }
      if (queryOverrides.lam && allowedLams.some((l) => l.id === queryOverrides.lam)) {
        setSelectedLaminationId(queryOverrides.lam);
      } else if (!selectedLaminationId || !allowedLams.some((l) => l.id === selectedLaminationId)) {
        setSelectedLaminationId(allowedLams[0].id);
      }
    }
  };

  const loadAdminData = async (tokenToUse = authToken, silent = false) => {
    const rawToken = (tokenToUse || authToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!rawToken) return;

    const res = await apiFetch('/admin/data', {
      token: rawToken,
    });
    if (!res.ok) {
      if (!silent) {
        showToast('Недостаточно прав доступа администратора');
      }
      return;
    }
    const data = await res.json();
    const mainCats: MainCategory[] = data.main_categories || [];
    const cats: ProductCategory[] = data.categories || [];
    setAdminMainCategories(mainCats);
    setAdminCategories(cats);
    if (Array.isArray(data.material_categories) && data.material_categories.length > 0) {
      setAdminMaterialCategories(data.material_categories);
    }
    setAdminItems(data.items || []);
    setAdminProducts(data.products || []);
    if (Array.isArray(data.users)) {
      setAdminUsers(data.users);
    }
    if (Array.isArray(data.orders)) {
      setAdminOrders(data.orders);
    }
    if (data.settings) {
      setSettings(data.settings);
      if (
        Array.isArray(data.settings.roles) ||
        data.settings.role_permissions ||
        data.settings.role_order_statuses
      ) {
        const normalizedRoles = normalizeRolesList(
          data.settings.roles,
          data.settings.role_permissions,
          data.settings.role_order_statuses
        );
        setRolePermissions(
          normalizeRolePermissions(data.settings.role_permissions, normalizedRoles)
        );
        setRoleOrderStatuses(
          normalizeRoleOrderStatuses(data.settings.role_order_statuses, normalizedRoles)
        );
      }
    }
    if (data.catalog) {
      applyCatalogPayload(data.catalog);
    } else {
      clearCalculationCache();
    }
    if (cats.length > 0) {
      if (!cats.some((c) => c.id === activeAdminProductCategory)) {
        setActiveAdminProductCategory(cats[0].id);
      }
      if (!cats.some((c) => c.id === activeMarkupCategory)) {
        setActiveMarkupCategory(cats[0].id);
      }
      setNewMatEnabledCats(cats.map((c) => c.id));
    }
  };

  useEffect(() => {
    if (isAdminUnlocked && authToken) {
      loadAdminData(authToken, true);
    }
  }, [isAdminUnlocked, authToken]);

  const parsedCurrentRoute = useMemo(() => parseRoutePath(currentPath), [currentPath]);
  const currentSubcategoryObj = useMemo(
    () => (selectedCategory ? publicCategories.find((c) => c.id === selectedCategory) : undefined),
    [selectedCategory, publicCategories]
  );
  const currentMainCategoryObj = useMemo(
    () =>
      selectedMainCategory
        ? publicMainCategories.find((mc) => mc.id === selectedMainCategory)
        : currentSubcategoryObj?.parent_id
        ? publicMainCategories.find((mc) => mc.id === currentSubcategoryObj.parent_id)
        : undefined,
    [selectedMainCategory, publicMainCategories, currentSubcategoryObj]
  );

  const categoryProducts = useMemo(
    () => (selectedCategory ? publicProducts.filter((p) => p.category === selectedCategory) : []),
    [selectedCategory, publicProducts]
  );
  const currentProduct = useMemo(
    () =>
      selectedCategory
        ? categoryProducts.find((p) => p.id === selectedProductId) || categoryProducts[0]
        : undefined,
    [selectedCategory, categoryProducts, selectedProductId]
  );

  useEffect(() => {
    const isForbiddenRoute =
      parsedCurrentRoute.type === 'forbidden' ||
      (isAdminRoute && !isAdminUnlocked) ||
      (parsedCurrentRoute.type === 'crm' && !canAccessCrm) ||
      (parsedCurrentRoute.type === 'manager' && !isManagerUnlocked && !isAdminUnlocked);
    if (isForbiddenRoute) {
      document.title = 'Доступ запрещён (403) — Калькулятор полиграфии';
      return;
    }
    if (isAdminRoute) {
      document.title = 'Админ-панель — Калькулятор полиграфии';
      return;
    }
    if (isRouteNotFound || parsedCurrentRoute.type === 'not_found') {
      document.title = 'Страница не найдена (404) — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'home') {
      document.title = 'Все категории — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'cart') {
      document.title = 'Корзина — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'manager') {
      document.title = 'Панель менеджера — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'crm') {
      document.title = 'CRM Заказы — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'orders') {
      document.title = 'Мои заказы — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'auth') {
      document.title =
        parsedCurrentRoute.authMode === 'register'
          ? 'Регистрация — Калькулятор полиграфии'
          : 'Вход в аккаунт — Калькулятор полиграфии';
      return;
    }
    if (parsedCurrentRoute.type === 'main_category' && currentMainCategoryObj) {
      document.title = `${currentMainCategoryObj.name} — Калькулятор полиграфии`;
      return;
    }
    const parts: string[] = [];
    if (currentProduct) {
      const isWfTitle = isWideFormatSectionOrCategory(
        currentMainCategoryObj?.id || currentSubcategoryObj?.parent_id || selectedMainCategory,
        currentProduct.category
      );
      parts.push(
        isWfTitle ? formatDimensionsTextInCm(currentProduct.name) : currentProduct.name
      );
    }
    if (currentSubcategoryObj) parts.push(currentSubcategoryObj.name);
    if (currentMainCategoryObj) parts.push(currentMainCategoryObj.name);
    parts.push('Калькулятор полиграфии');
    document.title = parts.join(' — ');
  }, [
    isAdminRoute,
    isAdminUnlocked,
    canAccessCrm,
    isManagerUnlocked,
    isRouteNotFound,
    parsedCurrentRoute.type,
    parsedCurrentRoute.authMode,
    currentProduct?.id,
    currentSubcategoryObj?.id,
    currentMainCategoryObj?.id,
  ]);

  const allowedPapersForCurrentProduct = useMemo(
    () =>
      currentProduct
        ? papers.filter((p) => currentProduct.allowed_paper_ids.includes(p.id))
        : papers,
    [currentProduct, papers]
  );

  const allowedCoverPapersForCurrentProduct = useMemo(
    () =>
      currentProduct
        ? (() => {
            const coverIds =
              Array.isArray(currentProduct.allowed_cover_paper_ids) &&
              currentProduct.allowed_cover_paper_ids.length > 0
                ? currentProduct.allowed_cover_paper_ids
                : currentProduct.allowed_paper_ids;
            const filtered = papers.filter((p) => coverIds.includes(p.id));
            return filtered.length > 0 ? filtered : allowedPapersForCurrentProduct;
          })()
        : papers,
    [currentProduct, papers, allowedPapersForCurrentProduct]
  );

  const allowedLaminationsForCurrentProduct = useMemo(
    () =>
      currentProduct
        ? laminations.filter((l) => currentProduct.allowed_lamination_ids.includes(l.id))
        : laminations,
    [currentProduct, laminations]
  );

  const handleMainCategorySelect = (mainCatId: string, openMenu = false, pushRoute = true) => {
    setIsRouteNotFound(false);
    setSelectedMainCategory(mainCatId);
    setIsMegaMenuOpen(openMenu);
    if (pushRoute) {
      setSelectedCategory('');
      setSelectedProductId(0);
      setCalcResult(null);
      navigateTo(buildMainCategoryPath(mainCatId));
    }
  };

  const handleCategoryChange = (catId: string) => {
    setIsRouteNotFound(false);
    if (catId !== selectedCategory) {
      setCalcResult(null);
    }
    setSelectedCategory(catId);
    const catObj = publicCategories.find((c) => c.id === catId);
    const parentId =
      catObj?.parent_id || selectedMainCategory || publicMainCategories[0]?.id || 'polygraphy';
    if (catObj && catObj.parent_id) {
      setSelectedMainCategory(catObj.parent_id);
    }
    const prodsInCat = publicProducts.filter((p) => p.category === catId);
    if (prodsInCat.length > 0) {
      applyProductSelection(prodsInCat[0]);
    } else {
      setSelectedProductId(0);
      setCalcResult(null);
    }
    navigateTo(buildSubcategoryPath(parentId, catId));
  };

  const handleProductChange = (prodId: number) => {
    const prod = publicProducts.find((p) => p.id === prodId);
    if (prod) {
      setIsRouteNotFound(false);
      applyProductSelection(prod);
      const subObj = publicCategories.find((c) => c.id === prod.category);
      const mainId =
        subObj?.parent_id || selectedMainCategory || publicMainCategories[0]?.id || 'polygraphy';
      navigateTo(buildProductPath(mainId, prod.category, prod.id));
    }
  };

  const activeAdminOrPublicProduct =
    isAdminUnlocked && currentProduct
      ? adminProducts.find((ap) => ap.id === currentProduct.id) || currentProduct
      : currentProduct;

  const { calcResult, setCalcResult, isCalculating, clearCalculationCache } = useCalculator({
    currentProduct,
    activeProduct: activeAdminOrPublicProduct,
    selectedPaperId,
    selectedCoverPaperId,
    printSides,
    blockPrintMode,
    coverPrintMode,
    laminationSides,
    selectedLaminationId,
    customWidth,
    customHeight,
    quantity,
    pagesCount,
    selectedClientParams,
    disabledInternalParamIds,
    allowedLaminations: allowedLaminationsForCurrentProduct,
    isAdminUnlocked,
    canViewInternalMetrics: currentRolePermissions.view_internal_metrics,
    authToken,
  });
  clearCalculationCacheRef.current = clearCalculationCache;

  const handleLogoutAdmin = () => {
    logoutAll();
  };

  const handleLogoutUser = () => {
    logoutAll();
    showToast('Вы вышли из аккаунта');
    if (
      currentPath.startsWith('/admin') ||
      currentPath.startsWith('/manager') ||
      currentPath.startsWith('/crm') ||
      currentPath.startsWith('/orders')
    ) {
      navigateTo('/');
    }
  };

  const categoryKindsList: string[] = [];
  for (const p of categoryProducts) {
    const k = (p.product_kind || '').trim();
    if (k && !categoryKindsList.includes(k)) {
      categoryKindsList.push(k);
    }
  }
  if (
    categoryKindsList.length > 0 &&
    categoryProducts.some((p) => !(p.product_kind || '').trim())
  ) {
    categoryKindsList.push('Прочие форматы');
  }
  const hasKindGroups = categoryKindsList.length > 0;
  const isNotFoundView = !isAdminRoute && (isRouteNotFound || parsedCurrentRoute.type === 'not_found');
  const isProductViewWithKinds =
    !isAdminRoute &&
    !isNotFoundView &&
    parsedCurrentRoute.type !== 'home' &&
    parsedCurrentRoute.type !== 'cart' &&
    parsedCurrentRoute.type !== 'manager' &&
    parsedCurrentRoute.type !== 'crm' &&
    parsedCurrentRoute.type !== 'orders' &&
    parsedCurrentRoute.type !== 'auth' &&
    parsedCurrentRoute.type !== 'forbidden' &&
    !(parsedCurrentRoute.type === 'main_category' && !selectedCategory) &&
    Boolean(currentProduct) &&
    hasKindGroups;

  const activeKind =
    hasKindGroups && currentProduct
      ? (currentProduct.product_kind || '').trim() ||
        (categoryKindsList.includes('Прочие форматы') ? 'Прочие форматы' : categoryKindsList[0])
      : '';

  const filteredFormatProducts = hasKindGroups
    ? categoryProducts.filter(
        (p) => ((p.product_kind || '').trim() || 'Прочие форматы') === activeKind
      )
    : categoryProducts;

  const resetToHome = () => {
    setIsRouteNotFound(false);
    setSelectedMainCategory('');
    setSelectedCategory('');
    setSelectedProductId(0);
    setCalcResult(null);
    navigateTo('/');
  };

  return (
    <AppShell isDark={isDark} textColor={t.text}>
      <ProductLightboxModal
        lightboxUrl={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        currentProduct={currentProduct}
        mainCategoryId={
          currentMainCategoryObj?.id ||
          currentSubcategoryObj?.parent_id ||
          selectedMainCategory ||
          'polygraphy'
        }
        customWidth={customWidth}
        customHeight={customHeight}
        pagesCount={pagesCount}
        selectedClientParams={selectedClientParams}
        isDark={isDark}
        theme={t}
      />

      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 10000,
            background: isDark ? '#1E2024' : '#0F172A',
            color: '#ffffff',
            border: `1px solid ${isDark ? '#34D399' : '#334155'}`,
            padding: '12px 18px',
            borderRadius: 4,
            boxShadow: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#34D399' }}>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {!(isAdminRoute && isAdminUnlocked) ? (
        <div className="ui-header-shell ui-no-print">
          <HeaderMegaMenu
            mainCategories={publicMainCategories}
            subcategories={publicCategories}
            products={publicProducts}
            selectedMainCategoryId={selectedMainCategory}
            selectedSubcategoryId={selectedCategory}
            isMegaMenuOpen={isMegaMenuOpen}
            setIsMegaMenuOpen={setIsMegaMenuOpen}
            onSelectMainCategory={handleMainCategorySelect}
            onSelectSubcategory={handleCategoryChange}
            isDark={isDark}
            setIsDark={setIsDark}
            isAdminRoute={isAdminRoute}
            isAdminUnlocked={isAdminUnlocked}
            isManagerUnlocked={isManagerUnlocked}
            canViewCrm={canAccessCrm}
            crmUnreadCount={crmUnreadCount}
            currentUser={currentUser}
            onNavigateToLogin={() => navigateTo('/login')}
            onNavigateToAdmin={() => {
              setAdminSection('products');
              navigateTo(buildAdminPath('products'));
            }}
            onNavigateToCrm={() => {
              navigateTo(buildCrmPath());
            }}
            onNavigateToOrders={() => {
              navigateTo(buildOrdersPath());
            }}
            onNavigateToProfile={() => {
              navigateTo('/orders?tab=profile');
            }}
            onNavigateToClient={resetToHome}
            onLogoutAdmin={handleLogoutAdmin}
            onLogoutUser={handleLogoutUser}
            estimateCount={estimateItems.length}
            onClickEstimate={() => {
              navigateTo(buildCartPath());
            }}
            showToast={showToast}
            theme={t}
          />
        </div>
      ) : (
        <div className="ui-header-shell ui-no-print">
          <AdminHeaderNav
            adminSection={adminSection}
            setAdminSection={setAdminSection}
            navigateTo={navigateTo}
            settings={settings}
            adminUsersCount={adminUsers.length}
            canViewCrmNotifications={Boolean(currentRolePermissions.view_crm)}
            canAccessCrm={canAccessCrm}
            crmUnreadCount={crmUnreadCount}
            currentUser={currentUser}
            isAdminUnlocked={isAdminUnlocked}
            onReturnToCalculator={() => {
              setSelectedMainCategory('');
              setSelectedCategory('');
              setSelectedProductId(0);
              setCalcResult(null);
              navigateTo('/');
            }}
            onLogoutAdmin={handleLogoutAdmin}
            isDark={isDark}
            setIsDark={setIsDark}
            showToast={showToast}
            theme={t}
          />
        </div>
      )}

      <div
        className="ui-app-shell"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '18px 16px 32px',
          color: t.text,
        }}
      >
      {!isAdminRoute && (
        <div className="ui-calc-page-layout">
          {isProductViewWithKinds && currentProduct && (
            <ProductKindsSidebar
              currentProduct={currentProduct}
              categoryProducts={categoryProducts}
              categoryKindsList={categoryKindsList}
              activeKind={activeKind}
              onSelectProduct={handleProductChange}
              isDark={isDark}
              theme={t}
              customWidth={customWidth}
              customHeight={customHeight}
              pagesCount={pagesCount}
              selectedClientParams={selectedClientParams}
            />
          )}

          <div
            className="ui-central-calc-card"
            style={{
              background: 'transparent',
              padding: 0,
              borderRadius: 0,
              boxShadow: 'none',
              border: 'none',
              minWidth: 0,
            }}
          >
          {isNotFoundView ? (
            <NotFoundPage
              mainCategories={publicMainCategories}
              isDark={isDark}
              theme={t}
              onResetToHome={resetToHome}
              onSelectMainCategory={(mainCatId) =>
                handleMainCategorySelect(mainCatId, false, true)
              }
            />
          ) : parsedCurrentRoute.type === 'forbidden' ? (
            <ForbiddenPage
              mainCategories={publicMainCategories}
              currentUser={currentUser}
              isDark={isDark}
              theme={t}
              onResetToHome={resetToHome}
              onSelectMainCategory={(mainCatId) =>
                handleMainCategorySelect(mainCatId, false, true)
              }
              onNavigateToLogin={() => navigateTo('/login')}
              onNavigateToProfile={() => navigateTo('/orders?tab=profile')}
            />
          ) : parsedCurrentRoute.type === 'auth' ? (
            <Suspense fallback={<RouteLoading theme={t} />}>
              <AuthPage
                mode={parsedCurrentRoute.authMode || 'login'}
                onSwitchMode={(nextMode) =>
                  navigateTo(nextMode === 'register' ? '/register' : '/login')
                }
                onAuthSuccess={handleAuthSuccess}
                onCancel={resetToHome}
                isDark={isDark}
                theme={t}
                inputStyle={inputStyle}
              />
            </Suspense>
          ) : parsedCurrentRoute.type === 'manager' ? (
            !isManagerUnlocked && !isAdminUnlocked ? (
              isAuthChecking ? (
                <RouteLoading theme={t} />
              ) : (
                <ForbiddenPage
                  mainCategories={publicMainCategories}
                  currentUser={currentUser}
                  isDark={isDark}
                  theme={t}
                  onResetToHome={resetToHome}
                  onSelectMainCategory={(mainCatId) =>
                    handleMainCategorySelect(mainCatId, false, true)
                  }
                  onNavigateToLogin={() => navigateTo('/login')}
                  onNavigateToProfile={() => navigateTo('/orders?tab=profile')}
                />
              )
            ) : (
              <div
                data-testid="manager-panel"
                style={{
                  background: t.cardBg,
                  padding: 28,
                  borderRadius: 4,
                  border: `1px solid ${t.border}`,
                  maxWidth: 480,
                  margin: '16px auto',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 700, color: t.text }}>
                      Режим менеджера активен
                    </h2>
                    <p style={{ margin: 0, fontSize: 13.5, color: t.subText, lineHeight: 1.45 }}>
                      Вам доступны реквизиты заказчика, установка скидки (%) и сохранение коммерческого предложения (КП) в PDF / Печать на странице корзины.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      type="button"
                      data-testid="manager-go-cart-btn"
                      onClick={() => navigateTo(buildCartPath())}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 2,
                        border: 'none',
                        background: '#C02721',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: 'pointer',
                      }}
                    >
                      Перейти в корзину / КП ({estimateItems.length} поз.) →
                    </button>

                    <button
                      type="button"
                      data-testid="manager-go-catalog-btn"
                      onClick={resetToHome}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.subCardBg,
                        color: t.text,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      ← В каталог продукции
                    </button>

                    {isManagerUnlocked && (
                      <button
                        type="button"
                        data-testid="manager-logout-btn"
                        onClick={handleLogoutUser}
                        style={{
                          width: '100%',
                          padding: '8px 14px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: 'transparent',
                          color: t.subText,
                          fontWeight: 500,
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                      >
                        Выйти из аккаунта
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : parsedCurrentRoute.type === 'crm' ? (
            isAuthChecking ? (
              <RouteLoading theme={t} />
            ) : !canAccessCrm ? (
              <ForbiddenPage
                mainCategories={publicMainCategories}
                currentUser={currentUser}
                isDark={isDark}
                theme={t}
                onResetToHome={resetToHome}
                onSelectMainCategory={(mainCatId) =>
                  handleMainCategorySelect(mainCatId, false, true)
                }
                onNavigateToLogin={() => navigateTo('/login')}
                onNavigateToProfile={() => navigateTo('/orders?tab=profile')}
              />
            ) : (
              <Suspense fallback={<RouteLoading theme={t} />}>
                <CrmOrdersPage
                  role={effectiveCrmRole}
                  permissions={currentRolePermissions}
                  allowedOrderStatuses={currentAllowedOrderStatuses}
                  currentUser={currentUser}
                  onUpdateUser={(updatedUser, nextToken) => {
                    setCurrentUser(updatedUser);
                    if (nextToken) {
                      sessionStorage.setItem('auth_token', nextToken);
                      setAuthToken(nextToken);
                    }
                  }}
                  authToken={authToken}
                  onNotificationsChanged={fetchCrmNotificationsSummary}
                  isDark={isDark}
                  theme={t}
                  inputStyle={inputStyle}
                  showToast={showToast}
                  onBackToCatalog={resetToHome}
                  onNavigateToLogin={() => navigateTo('/login')}
                  onNavigateToOrders={() => navigateTo(buildOrdersPath())}
                />
              </Suspense>
            )
          ) : parsedCurrentRoute.type === 'orders' ? (
            <Suspense fallback={<RouteLoading theme={t} />}>
              <ClientOrdersPage
                currentUser={currentUser}
                authToken={authToken}
                isDark={isDark}
                theme={t}
                inputStyle={inputStyle}
                onUpdateUser={(updatedUser, nextToken) => {
                  setCurrentUser(updatedUser);
                  if (nextToken) {
                    sessionStorage.setItem('auth_token', nextToken);
                    setAuthToken(nextToken);
                  }
                }}
                showToast={showToast}
                onNavigateToLogin={() => navigateTo('/login')}
                onBackToCatalog={resetToHome}
              />
            </Suspense>
          ) : parsedCurrentRoute.type === 'cart' ? (
            sharedCartToken ? (
              isLoadingSharedCart ? (
                <div
                  data-testid="shared-cart-loading"
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    background: t.cardBg,
                    borderRadius: 4,
                    border: `1px solid ${t.border}`,
                    color: t.subText,
                  }}
                >
                  Загрузка общей корзины...
                </div>
              ) : (
                <EstimatePanel
                  mode="page"
                  isSharedView={true}
                  items={sharedCartItems}
                  ownCartCount={estimateItems.length}
                  onAddSharedItemToMyCart={(item) => {
                    handleAddEstimateItem(item);
                  }}
                  onAddAllSharedToMyCart={() => {
                    handleAddMultipleEstimateItems(sharedCartItems);
                    navigateTo(buildCartPath());
                  }}
                  onOpenOwnCart={() => navigateTo(buildCartPath())}
                  onRemoveItem={() => {}}
                  onClearAll={() => {}}
                  onCopySuccess={showToast}
                  isDark={isDark}
                  theme={t}
                  onContinueShopping={resetToHome}
                />
              )
            ) : (
              <EstimatePanel
                mode="page"
                isSharedView={false}
                isAdminUnlocked={canManageKp}
                canManageKp={canManageKp}
                currentUser={currentUser}
                authToken={authToken}
                onNavigateToOrdersCompanyTab={() => navigateTo(`${buildOrdersPath()}?tab=company`)}
                onOrderCreated={(order) => {
                  clearEstimateSilently();
                  if (
                    currentUser &&
                    order.company_details &&
                    (order.company_details.company_name || order.company_details.inn) &&
                    !(currentUser.company_details?.company_name || currentUser.company_details?.inn)
                  ) {
                    setCurrentUser({
                      ...currentUser,
                      company_details: order.company_details,
                    });
                  }
                  showToast(`Заказ №${order.id} успешно отправлен в работу!`);
                  if (canAccessCrm) {
                    navigateTo(buildCrmPath());
                  } else if (currentUser) {
                    navigateTo(buildOrdersPath());
                  } else {
                    resetToHome();
                  }
                }}
                items={estimateItems}
                onRemoveItem={handleRemoveEstimateItem}
                onDuplicateItem={handleDuplicateEstimateItem}
                onUpdateItemNote={handleUpdateEstimateItemNote}
                onClearAll={handleClearEstimate}
                onCopySuccess={showToast}
                isDark={isDark}
                theme={t}
                onContinueShopping={resetToHome}
                onNavigateToLogin={() => navigateTo('/login')}
                onNavigateToRegister={() => navigateTo('/register')}
              />
            )
          ) : parsedCurrentRoute.type === 'home' ? (
            <CatalogGrid
              mode="home"
              publicMainCategories={publicMainCategories}
              publicCategories={publicCategories}
              publicProducts={publicProducts}
              currentMainCategoryObj={currentMainCategoryObj}
              selectedMainCategory={selectedMainCategory}
              isDark={isDark}
              theme={t}
              onSelectMainCategory={handleMainCategorySelect}
              onSelectSubcategory={handleCategoryChange}
              onResetToHome={resetToHome}
            />
          ) : parsedCurrentRoute.type === 'main_category' && !selectedCategory ? (
            <CatalogGrid
              mode="main_category"
              publicMainCategories={publicMainCategories}
              publicCategories={publicCategories}
              publicProducts={publicProducts}
              currentMainCategoryObj={currentMainCategoryObj}
              selectedMainCategory={selectedMainCategory}
              isDark={isDark}
              theme={t}
              onSelectMainCategory={handleMainCategorySelect}
              onSelectSubcategory={handleCategoryChange}
              onResetToHome={resetToHome}
            />
          ) : (
            <>
              <div className="ui-column-header-box ui-no-print">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: t.subText,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className="ui-breadcrumb-link"
                    onClick={resetToHome}
                    style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    title="Все категории"
                  >
                    Все категории
                  </span>
                  <span>—</span>
                  <span
                    className="ui-breadcrumb-link"
                    onClick={() => {
                      if (currentMainCategoryObj) {
                        handleMainCategorySelect(currentMainCategoryObj.id, false, true);
                      }
                    }}
                    style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    title="Перейти на страницу категории"
                  >
                    {currentMainCategoryObj?.name || 'Полиграфическая продукция'}
                  </span>
                  {currentSubcategoryObj && (
                    <>
                      <span>—</span>
                      <span
                        className="ui-breadcrumb-link"
                        onClick={() => {
                          const mainId =
                            currentMainCategoryObj?.id ||
                            currentSubcategoryObj.parent_id ||
                            'polygraphy';
                          navigateTo(buildSubcategoryPath(mainId, currentSubcategoryObj.id));
                        }}
                        style={{ color: t.text, fontWeight: 600, cursor: 'pointer' }}
                        title="Страница подкатегории"
                      >
                        {currentSubcategoryObj.name}
                      </span>
                    </>
                  )}
                </div>

                <h1 style={{ margin: 0, fontSize: 24, color: t.text }}>
                  {currentSubcategoryObj
                    ? currentSubcategoryObj.name
                    : currentMainCategoryObj
                    ? currentMainCategoryObj.name
                    : 'Калькулятор печати'}
                </h1>
              </div>

              {currentProduct && activeAdminOrPublicProduct ? (
                <ProductCalculatorView
                  currentProduct={currentProduct}
                  adminCurrentProd={activeAdminOrPublicProduct}
                  filteredFormatProducts={filteredFormatProducts}
                  allowedPapersForCurrentProduct={allowedPapersForCurrentProduct}
                  allowedCoverPapersForCurrentProduct={allowedCoverPapersForCurrentProduct}
                  allowedLaminationsForCurrentProduct={allowedLaminationsForCurrentProduct}
                  usableLimits={usableLimits}
                  mainCategoryId={
                    currentMainCategoryObj?.id ||
                    currentSubcategoryObj?.parent_id ||
                    selectedMainCategory ||
                    'polygraphy'
                  }
                  categoryMarkupTiers={
                    isAdminUnlocked
                      ? settings.category_markups?.[currentProduct.category]
                      : undefined
                  }
                  categoryQtyTiers={publicCategoryQtyTiers[currentProduct.category]}
                  activeImageIndex={activeImageIndex}
                  setActiveImageIndex={setActiveImageIndex}
                  setLightboxUrl={setLightboxUrl}
                  customWidth={customWidth}
                  setCustomWidth={setCustomWidth}
                  customHeight={customHeight}
                  setCustomHeight={setCustomHeight}
                  pagesCount={pagesCount}
                  setPagesCount={setPagesCount}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  selectedPaperId={selectedPaperId}
                  setSelectedPaperId={setSelectedPaperId}
                  selectedCoverPaperId={selectedCoverPaperId}
                  setSelectedCoverPaperId={setSelectedCoverPaperId}
                  printSides={printSides}
                  setPrintSides={setPrintSides}
                  blockPrintMode={blockPrintMode}
                  setBlockPrintMode={setBlockPrintMode}
                  coverPrintMode={coverPrintMode}
                  setCoverPrintMode={setCoverPrintMode}
                  selectedLaminationId={selectedLaminationId}
                  setSelectedLaminationId={setSelectedLaminationId}
                  laminationSides={laminationSides}
                  setLaminationSides={setLaminationSides}
                  selectedClientParams={selectedClientParams}
                  setSelectedClientParams={setSelectedClientParams}
                  disabledInternalParamIds={disabledInternalParamIds}
                  setDisabledInternalParamIds={setDisabledInternalParamIds}
                  calcResult={calcResult}
                  isCalculating={isCalculating}
                  handleProductChange={handleProductChange}
                  categoryName={currentSubcategoryObj?.name}
                  onAddEstimateItem={handleAddEstimateItem}
                  showToast={showToast}
                  isDark={isDark}
                  theme={t}
                  inputStyle={inputStyle}
                />
              ) : (
                <div style={{ padding: 20, color: t.subText }}>
                  В этой подкатегории пока нет доступных для заказа товаров.
                </div>
              )}
            </>
          )}
          </div>

          {estimateItems.length > 0 &&
            parsedCurrentRoute.type !== 'cart' &&
            parsedCurrentRoute.type !== 'manager' &&
            parsedCurrentRoute.type !== 'crm' &&
            parsedCurrentRoute.type !== 'orders' &&
            parsedCurrentRoute.type !== 'auth' &&
            parsedCurrentRoute.type !== 'forbidden' && (
            <aside className="ui-estimate-sidebar" aria-label="Корзина">
              <div className="ui-sidebar-sticky-inner">
                <EstimatePanel
                  mode="sidebar"
                  isAdminUnlocked={canManageKp}
                  canManageKp={canManageKp}
                  currentUser={currentUser}
                  items={estimateItems}
                  onRemoveItem={handleRemoveEstimateItem}
                  onDuplicateItem={handleDuplicateEstimateItem}
                  onUpdateItemNote={handleUpdateEstimateItemNote}
                  onClearAll={handleClearEstimate}
                  onCopySuccess={showToast}
                  isDark={isDark}
                  theme={t}
                  isHighlighted={isEstimateHighlighted}
                  onOpenCartPage={() => navigateTo(buildCartPath())}
                />
              </div>
            </aside>
          )}
        </div>
      )}

      {isAdminRoute && (
        !isAdminUnlocked ? (
          isAuthChecking ? (
            <RouteLoading theme={t} />
          ) : (
            <ForbiddenPage
              mainCategories={publicMainCategories}
              currentUser={currentUser}
              isDark={isDark}
              theme={t}
              onResetToHome={resetToHome}
              onSelectMainCategory={(mainCatId) =>
                handleMainCategorySelect(mainCatId, false, true)
              }
              onNavigateToLogin={() => navigateTo('/login')}
              onNavigateToProfile={() => navigateTo('/orders?tab=profile')}
            />
          )
        ) : (
          <Suspense
            fallback={
              <div style={{ padding: 40, textAlign: 'center', color: t.subText }}>
                Загрузка панели управления...
              </div>
            }
          >
            <AdminPanel
              authToken={authToken}
              onNavigateToLogin={() => navigateTo('/login')}
              isAdminUnlocked={isAdminUnlocked}
              adminSection={adminSection}
              setAdminSection={setAdminSection}
              navigateTo={navigateTo}
              loadAdminData={loadAdminData}
              fetchCatalog={fetchCatalog}
              showToast={showToast}
              setLightboxUrl={setLightboxUrl}
              setUsableLimits={setUsableLimits}
              adminMainCategories={adminMainCategories}
              setAdminMainCategories={setAdminMainCategories}
              adminCategories={adminCategories}
              setAdminCategories={setAdminCategories}
              adminMaterialCategories={adminMaterialCategories}
              setAdminMaterialCategories={setAdminMaterialCategories}
              adminItems={adminItems}
              setAdminItems={setAdminItems}
              adminProducts={adminProducts}
              setAdminProducts={setAdminProducts}
              adminUsers={adminUsers}
              setAdminUsers={setAdminUsers}
              adminOrders={adminOrders}
              settings={settings}
              setSettings={setSettings}
              activeAdminProductCategory={activeAdminProductCategory}
              setActiveAdminProductCategory={setActiveAdminProductCategory}
              activeMarkupCategory={activeMarkupCategory}
              setActiveMarkupCategory={setActiveMarkupCategory}
              newMatEnabledCats={newMatEnabledCats}
              setNewMatEnabledCats={setNewMatEnabledCats}
              isDark={isDark}
              theme={t}
              inputStyle={inputStyle}
              smallInputStyle={smallInputStyle}
            />
          </Suspense>
        )
      )}
      </div>
      </AppShell>
  );
}
