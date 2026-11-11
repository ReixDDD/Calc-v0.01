import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AllowedSidesType,
  CostItem,
  MainCategory,
  MultiPageModeType,
  ProductCategory,
  ProductCostParam,
  ProductItem,
  SchematicType,
  SubcategoryBadgeType,
} from '../types';
import { apiFetch } from '../apiClient';
import {
  isSecureAssetUrl,
  resolveImageUrl,
  SCHEMATIC_TYPE_LABELS,
} from '../constants';
import { ProductSchematicSVG, resolveSchematicType } from './ProductSchematicSVG';
import {
  MainCategoryIllustration,
  SubcategoryCardIllustration,
} from './CatalogIllustrations';
import AdminMaterialMatrix from './AdminMaterialMatrix';
import ProductCalcParamsEditor from './ProductCalcParamsEditor';
import { ConfirmRequestOptions } from './ConfirmDialog';
import {
  buildMainCategoryPath,
  buildProductPath,
  buildSubcategoryPath,
  reorderItemsById,
  reorderSubsetInGlobalList,
} from '../routing';

export interface AdminProductsSectionProps {
  authToken: string;
  navigateTo: (path: string) => void;
  loadAdminData: (tokenToUse?: string, silent?: boolean) => Promise<void>;
  fetchCatalog: () => Promise<void>;
  showToast: (msg: string) => void;
  setLightboxUrl: (url: string | null) => void;
  requestConfirm: (options: ConfirmRequestOptions) => Promise<boolean>;
  adminMainCategories: MainCategory[];
  setAdminMainCategories?: React.Dispatch<React.SetStateAction<MainCategory[]>>;
  adminCategories: ProductCategory[];
  setAdminCategories?: React.Dispatch<React.SetStateAction<ProductCategory[]>>;
  adminItems: CostItem[];
  adminProducts: ProductItem[];
  setAdminProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  activeAdminProductCategory: string;
  setActiveAdminProductCategory: (catId: string) => void;
  isDark: boolean;
  theme: Record<string, string>;
  inputStyle: React.CSSProperties;
  smallInputStyle: React.CSSProperties;
}

type SortableListType = 'main' | 'sub' | 'prod';

export default function AdminProductsSection({
  authToken,
  navigateTo,
  loadAdminData,
  fetchCatalog,
  showToast,
  setLightboxUrl,
  requestConfirm,
  adminMainCategories,
  setAdminMainCategories,
  adminCategories,
  setAdminCategories,
  adminItems,
  adminProducts,
  setAdminProducts,
  activeAdminProductCategory,
  setActiveAdminProductCategory,
  isDark,
  theme: t,
  inputStyle,
  smallInputStyle,
}: AdminProductsSectionProps) {
  const [expandedProductIds, setExpandedProductIds] = useState<number[]>([]);
  const [dirtyProductIds, setDirtyProductIds] = useState<number[]>([]);
  const [adminCatalogSearch, setAdminCatalogSearch] = useState<string>('');
  const [expandedProductSections, setExpandedProductSections] = useState<Record<string, boolean>>(
    {}
  );
  const isProdSectionOpen = (prodId: number, sec: string) =>
    Boolean(expandedProductSections[`${prodId}:${sec}`]);
  const toggleProdSection = (prodId: number, sec: string) => {
    const key = `${prodId}:${sec}`;
    setExpandedProductSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [imageUrlInputs, setImageUrlInputs] = useState<Record<number, string>>({});
  const [uploadingProdId, setUploadingProdId] = useState<number | null>(null);

  const [openedMainCatId, setOpenedMainCatId] = useState<string | null>(null);
  const [openedSubCatId, setOpenedSubCatId] = useState<string | null>(null);
  const [expandedMainCategoryIds, setExpandedMainCategoryIds] = useState<string[]>([]);
  const [expandedSubcategoryIds, setExpandedSubcategoryIds] = useState<string[]>([]);

  const toggleMainCategoryExpanded = (mainCatId: string) => {
    setExpandedMainCategoryIds((prev) =>
      prev.includes(mainCatId) ? prev.filter((id) => id !== mainCatId) : [...prev, mainCatId]
    );
  };

  const toggleSubcategoryExpanded = (catId: string) => {
    setExpandedSubcategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // --- ПЕРЕТАСКИВАНИЕ (DRAG & DROP С ПРИМАГНИЧИВАНИЕМ К КУРСОРУ И FLIP-АНИМАЦИЕЙ) ---
  const [activeDragItem, setActiveDragItem] = useState<{
    listType: SortableListType;
    itemId: string | number;
  } | null>(null);
  const sortDragRef = useRef<{
    listType: SortableListType;
    itemId: string | number;
    startX: number;
    startY: number;
    lastClientX: number;
    lastClientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    isDragging: boolean;
    didReorder: boolean;
  } | null>(null);
  const flipPrevTopsRef = useRef<{
    listType: SortableListType;
    tops: Map<string, number>;
  } | null>(null);
  const suppressClickAfterDragRef = useRef<boolean>(false);

  const mainCatsRef = useRef(adminMainCategories);
  mainCatsRef.current = adminMainCategories;
  const catsRef = useRef(adminCategories);
  catsRef.current = adminCategories;
  const prodsRef = useRef(adminProducts);
  prodsRef.current = adminProducts;
  const openedMainCatIdRef = useRef(openedMainCatId);
  openedMainCatIdRef.current = openedMainCatId;
  const activeAdminProductCategoryRef = useRef(activeAdminProductCategory);
  activeAdminProductCategoryRef.current = activeAdminProductCategory;
  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;
  const fetchCatalogRef = useRef(fetchCatalog);
  fetchCatalogRef.current = fetchCatalog;
  const loadAdminDataRef = useRef(loadAdminData);
  loadAdminDataRef.current = loadAdminData;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const getNaturalRect = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const tf = window.getComputedStyle(el).transform;
    let tx = 0;
    let ty = 0;
    if (tf && tf !== 'none') {
      try {
        const m = new DOMMatrixReadOnly(tf);
        tx = m.m41;
        ty = m.m42;
      } catch {
        // fallback if DOMMatrixReadOnly fails
      }
    }
    const scaleOffsetX = (rect.width - el.offsetWidth) / 2;
    const scaleOffsetY = (rect.height - el.offsetHeight) / 2;
    const top = rect.top - ty + scaleOffsetY;
    const left = rect.left - tx + scaleOffsetX;
    return {
      top,
      left,
      bottom: top + el.offsetHeight,
      height: el.offsetHeight,
      width: el.offsetWidth,
    };
  };

  const applyMagneticCursorTransform = (drag: NonNullable<typeof sortDragRef.current>) => {
    const draggedEl = document.querySelector<HTMLElement>(
      `[data-sortable-list="${drag.listType}"][data-sortable-id="${String(drag.itemId)}"]`
    );
    if (!draggedEl) return;
    const nat = getNaturalRect(draggedEl);
    const nextTx = (drag.lastClientX - drag.grabOffsetX - nat.left) * 0.16;
    const nextTy = drag.lastClientY - drag.grabOffsetY - nat.top;
    draggedEl.style.transition =
      'box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s ease';
    draggedEl.style.transform = `translate3d(${nextTx.toFixed(1)}px, ${nextTy.toFixed(1)}px, 0) scale(1.016)`;
    draggedEl.style.willChange = 'transform';
  };

  const handleSortMouseDown = (
    e: React.MouseEvent,
    listType: SortableListType,
    itemId: string | number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rowEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-sortable-list]');
    const rect = rowEl
      ? rowEl.getBoundingClientRect()
      : (e.currentTarget as HTMLElement).getBoundingClientRect();

    const nextDrag = {
      listType,
      itemId,
      startX: e.clientX,
      startY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      grabOffsetX: e.clientX - rect.left,
      grabOffsetY: e.clientY - rect.top,
      isDragging: true,
      didReorder: false,
    };
    sortDragRef.current = nextDrag;
    setActiveDragItem({ listType, itemId });
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    applyMagneticCursorTransform(nextDrag);
  };

  useLayoutEffect(() => {
    const drag = sortDragRef.current;
    if (drag && drag.isDragging) {
      applyMagneticCursorTransform(drag);
    }

    const flip = flipPrevTopsRef.current;
    if (!flip) return;
    flipPrevTopsRef.current = null;

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-sortable-list="${flip.listType}"]`)
    );
    rows.forEach((row) => {
      const sid = row.getAttribute('data-sortable-id');
      if (!sid) return;
      if (drag && drag.isDragging && sid === String(drag.itemId)) {
        return;
      }
      const prevVisualTop = flip.tops.get(sid);
      if (prevVisualTop === undefined) return;
      const nat = getNaturalRect(row);
      const deltaY = prevVisualTop - nat.top;
      if (Math.abs(deltaY) > 0.5) {
        row.style.transition = 'none';
        row.style.transform = `translate3d(0, ${deltaY.toFixed(1)}px, 0)`;
        void row.offsetHeight;
        row.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
        row.style.transform = 'translate3d(0, 0, 0)';
      }
    });
  }, [adminMainCategories, adminCategories, adminProducts]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = sortDragRef.current;
      if (!drag) return;

      drag.lastClientX = e.clientX;
      drag.lastClientY = e.clientY;

      if (!drag.isDragging) {
        const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (dist < 2) return;
        drag.isDragging = true;
        setActiveDragItem({ listType: drag.listType, itemId: drag.itemId });
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }

      applyMagneticCursorTransform(drag);

      const rows = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-sortable-list="${drag.listType}"]`)
      );
      const draggedIdx = rows.findIndex(
        (el) => el.getAttribute('data-sortable-id') === String(drag.itemId)
      );
      if (draggedIdx === -1) return;

      const draggedEl = rows[draggedIdx];
      const draggedVisualTop = e.clientY - drag.grabOffsetY;
      const draggedVisualCenterY = draggedVisualTop + draggedEl.offsetHeight / 2;
      const probeY = (draggedVisualCenterY + e.clientY) * 0.5;

      let targetIdStr: string | null = null;
      for (let i = 0; i < rows.length; i++) {
        if (i === draggedIdx) continue;
        const rNat = getNaturalRect(rows[i]);
        if (draggedIdx < i) {
          if (probeY >= rNat.top + rNat.height * 0.32 && probeY <= rNat.bottom + 24) {
            targetIdStr = rows[i].getAttribute('data-sortable-id');
          }
        } else {
          if (probeY <= rNat.bottom - rNat.height * 0.32 && probeY >= rNat.top - 24) {
            targetIdStr = rows[i].getAttribute('data-sortable-id');
            break;
          }
        }
      }

      if (!targetIdStr || targetIdStr === String(drag.itemId)) return;

      const captureFlipSnapshot = () => {
        const tops = new Map<string, number>();
        rows.forEach((r) => {
          const sid = r.getAttribute('data-sortable-id');
          if (sid) {
            tops.set(sid, r.getBoundingClientRect().top);
          }
        });
        flipPrevTopsRef.current = { listType: drag.listType, tops };
      };

      if (drag.listType === 'main') {
        const next = reorderItemsById(mainCatsRef.current, String(drag.itemId), targetIdStr);
        if (next !== mainCatsRef.current) {
          captureFlipSnapshot();
          mainCatsRef.current = next;
          drag.didReorder = true;
          setAdminMainCategories?.(next);
        }
      } else if (drag.listType === 'sub') {
        const defMainId = mainCatsRef.current[0]?.id || 'polygraphy';
        const activeMainId = openedMainCatIdRef.current || defMainId;
        const next = reorderSubsetInGlobalList(
          catsRef.current,
          (c) => (c.parent_id || defMainId) === activeMainId,
          String(drag.itemId),
          targetIdStr
        );
        if (next !== catsRef.current) {
          captureFlipSnapshot();
          catsRef.current = next;
          drag.didReorder = true;
          setAdminCategories?.(next);
        }
      } else if (drag.listType === 'prod') {
        const activeSubId = activeAdminProductCategoryRef.current;
        const next = reorderSubsetInGlobalList(
          prodsRef.current,
          (p) => p.category === activeSubId,
          Number(drag.itemId),
          Number(targetIdStr)
        );
        if (next !== prodsRef.current) {
          captureFlipSnapshot();
          prodsRef.current = next;
          drag.didReorder = true;
          setAdminProducts(next);
        }
      }
    };

    const onMouseUp = () => {
      const drag = sortDragRef.current;
      if (!drag) return;
      sortDragRef.current = null;
      setActiveDragItem(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (drag.isDragging) {
        const draggedEl = document.querySelector<HTMLElement>(
          `[data-sortable-list="${drag.listType}"][data-sortable-id="${String(drag.itemId)}"]`
        );
        if (draggedEl) {
          draggedEl.style.transition =
            'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease, border-color 240ms ease';
          draggedEl.style.transform = 'translate3d(0, 0, 0) scale(1)';
          window.setTimeout(() => {
            if (!sortDragRef.current || sortDragRef.current.itemId !== drag.itemId) {
              draggedEl.style.transition = '';
              draggedEl.style.transform = '';
              draggedEl.style.willChange = '';
            }
          }, 250);
        }

        suppressClickAfterDragRef.current = true;
        window.setTimeout(() => {
          suppressClickAfterDragRef.current = false;
        }, 120);

        if (drag.didReorder) {
          const payload: Record<string, unknown> = {};
          if (drag.listType === 'main') {
            payload.main_category_ids = mainCatsRef.current.map((m) => m.id);
          } else if (drag.listType === 'sub') {
            payload.category_ids = catsRef.current.map((c) => c.id);
          } else if (drag.listType === 'prod') {
            payload.product_ids = prodsRef.current.map((p) => p.id);
          }

          void apiFetch('/admin/reorder', {
            method: 'PUT',
            token: authTokenRef.current,
            json: payload,
          }).then(async (res) => {
            if (res.ok) {
              await fetchCatalogRef.current();
              showToastRef.current(
                drag.listType === 'main'
                  ? 'Порядок главных категорий обновлён'
                  : drag.listType === 'sub'
                  ? 'Порядок подкатегорий обновлён'
                  : 'Порядок товаров обновлён'
              );
            } else {
              await loadAdminDataRef.current(authTokenRef.current, true);
            }
          });
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [setAdminMainCategories, setAdminCategories, setAdminProducts]);

  const renderDragGrip = (
    listType: SortableListType,
    itemId: string | number,
    isBeingDragged: boolean
  ) => (
    <span
      className="ui-drag-handle"
      onMouseDown={(e) => handleSortMouseDown(e, listType, itemId)}
      onClick={(e) => e.stopPropagation()}
      title="Зажмите левую кнопку мыши и перетащите для изменения порядка"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 28,
        borderRadius: 2,
        color: isBeingDragged ? t.selectedBorder : t.subText,
        opacity: isBeingDragged ? 1 : 0.72,
        cursor: isBeingDragged ? 'grabbing' : 'grab',
        flexShrink: 0,
      }}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
        <circle cx="3.5" cy="3" r="1.4" />
        <circle cx="8.5" cy="3" r="1.4" />
        <circle cx="3.5" cy="8" r="1.4" />
        <circle cx="8.5" cy="8" r="1.4" />
        <circle cx="3.5" cy="13" r="1.4" />
        <circle cx="8.5" cy="13" r="1.4" />
      </svg>
    </span>
  );

  const [newMainCatName, setNewMainCatName] = useState<string>('');
  const [newMainCatIsAccent, setNewMainCatIsAccent] = useState<boolean>(false);
  const [showAddMainCategoryForm, setShowAddMainCategoryForm] = useState<boolean>(false);
  const [mainCatImageUrlInputs, setMainCatImageUrlInputs] = useState<Record<string, string>>({});

  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatIcon] = useState<string>('📦');
  const [newCatBadge, setNewCatBadge] = useState<SubcategoryBadgeType>('');
  const [newCatIsFeatured, setNewCatIsFeatured] = useState<boolean>(false);
  const [showAddSubcategoryForm, setShowAddSubcategoryForm] = useState<boolean>(false);
  const [subcatImageUrlInputs, setSubcatImageUrlInputs] = useState<Record<string, string>>({});

  const [showAddProductForm, setShowAddProductForm] = useState<boolean>(false);
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdKind, setNewProdKind] = useState<string>('');
  const [newProdWidth, setNewProdWidth] = useState<number>(210);
  const [newProdHeight, setNewProdHeight] = useState<number>(297);
  const [newProdAllowCustom, setNewProdAllowCustom] = useState<boolean>(false);
  const [newProdMultiPage, setNewProdMultiPage] = useState<MultiPageModeType>('none');
  const [newProdDefaultPages, setNewProdDefaultPages] = useState<number>(1);
  const [newProdAllowedSides, setNewProdAllowedSides] = useState<AllowedSidesType>('both');
  const [newProdDefectPercent, setNewProdDefectPercent] = useState<number>(0);
  const [newProdImages, setNewProdImages] = useState<string[]>([]);
  const [newProdImageUrlInput, setNewProdImageUrlInput] = useState<string>('');
  const [newProdCostParams, setNewProdCostParams] = useState<ProductCostParam[]>([]);

  const handleLocalProductChange = (prodId: number, changes: Partial<ProductItem>) => {
    setAdminProducts((prev) => prev.map((p) => (p.id === prodId ? { ...p, ...changes } : p)));
    setDirtyProductIds((prev) => (prev.includes(prodId) ? prev : [...prev, prodId]));
  };

  // --- ЗАГРУЗКА И УПРАВЛЕНИЕ КАРТИНКАМИ ТОВАРОВ ---
  const uploadFilesToServer = async (fileList: FileList | null): Promise<string[]> => {
    if (!fileList || fileList.length === 0) return [];
    const formData = new FormData();
    Array.from(fileList).forEach((file) => {
      formData.append('files', file);
    });
    const res = await apiFetch('/admin/upload', {
      method: 'POST',
      token: authToken,
      body: formData,
    });
    if (!res.ok) {
      showToast('Ошибка при загрузке изображений (разрешены только PNG, JPG, WEBP, GIF)');
      return [];
    }
    const data = await res.json();
    return data.urls || [];
  };

  const saveProductImages = async (prod: ProductItem, nextImages: string[]) => {
    const updatedProduct = { ...prod, images: nextImages };
    handleLocalProductChange(prod.id, { images: nextImages });
    const res = await apiFetch(`/admin/products/${prod.id}`, {
      method: 'PUT',
      token: authToken,
      json: updatedProduct,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
    }
  };

  const handleUploadProductFiles = async (prod: ProductItem, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingProdId(prod.id);
    try {
      const uploadedUrls = await uploadFilesToServer(fileList);
      if (uploadedUrls.length > 0) {
        const nextImages = [...(prod.images || []), ...uploadedUrls];
        await saveProductImages(prod, nextImages);
      }
    } finally {
      setUploadingProdId(null);
    }
  };

  const handleAddProductImageUrl = async (prod: ProductItem) => {
    const rawUrl = (imageUrlInputs[prod.id] || '').trim();
    if (!rawUrl) return;
    if (!isSecureAssetUrl(rawUrl)) {
      showToast('Ссылка на изображение должна начинаться с https://');
      return;
    }
    const nextImages = [...(prod.images || []), rawUrl];
    setImageUrlInputs((prev) => ({ ...prev, [prod.id]: '' }));
    await saveProductImages(prod, nextImages);
  };

  const handleRemoveProductImage = async (prod: ProductItem, imgIndex: number) => {
    const nextImages = (prod.images || []).filter((_, i) => i !== imgIndex);
    await saveProductImages(prod, nextImages);
  };

  const handleMakeProductImageMain = async (prod: ProductItem, imgIndex: number) => {
    const current = [...(prod.images || [])];
    if (imgIndex <= 0 || imgIndex >= current.length) return;
    const [picked] = current.splice(imgIndex, 1);
    const nextImages = [picked, ...current];
    await saveProductImages(prod, nextImages);
  };

  const handleUploadNewProductFiles = async (fileList: FileList | null) => {
    const uploadedUrls = await uploadFilesToServer(fileList);
    if (uploadedUrls.length > 0) {
      setNewProdImages((prev) => [...prev, ...uploadedUrls]);
    }
  };

  const handleAddNewProductImageUrl = () => {
    const raw = newProdImageUrlInput.trim();
    if (!raw) return;
    if (!isSecureAssetUrl(raw)) {
      showToast('Ссылка на изображение должна начинаться с https://');
      return;
    }
    setNewProdImages((prev) => [...prev, raw]);
    setNewProdImageUrlInput('');
  };

  // --- УПРАВЛЕНИЕ ГЛАВНЫМИ КАТЕГОРИЯМИ И ПОДКАТЕГОРИЯМИ ---
  const handleAddMainCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMainCatName.trim()) return;
    const res = await apiFetch('/admin/main-categories', {
      method: 'POST',
      token: authToken,
      json: {
        name: newMainCatName.trim(),
        is_hidden: false,
        is_accent: newMainCatIsAccent,
      },
    });
    if (res.ok) {
      const created: MainCategory = await res.json();
      setNewMainCatName('');
      setNewMainCatIsAccent(false);
      setShowAddMainCategoryForm(false);
      await loadAdminData(authToken, true);
      showToast(`Раздел «${created.name}» добавлен (${buildMainCategoryPath(created.id)})`);
    }
  };

  const handleUpdateMainCategory = async (mc: MainCategory, changes: Partial<MainCategory>) => {
    const res = await apiFetch(`/admin/main-categories/${mc.id}`, {
      method: 'PUT',
      token: authToken,
      json: changes,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
      showToast('Категория обновлена');
    }
  };

  const handleDeleteMainCategory = async (mc: MainCategory) => {
    if (adminMainCategories.length <= 1) {
      showToast('Нельзя удалить последнюю категорию');
      return;
    }
    const confirmed = await requestConfirm({
      title: 'Удаление главной категории',
      message: `Удалить категорию «${mc.name}»? (Входящие подкатегории перенесутся в первую категорию)`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    const res = await apiFetch(`/admin/main-categories/${mc.id}`, {
      method: 'DELETE',
      token: authToken,
    });
    if (res.ok) {
      if (openedMainCatId === mc.id) {
        setOpenedMainCatId(null);
        setOpenedSubCatId(null);
      }
      await loadAdminData(authToken, true);
      showToast('Категория удалена');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const targetParentId = openedMainCatId || adminMainCategories[0]?.id || 'polygraphy';

    const res = await apiFetch('/admin/categories', {
      method: 'POST',
      token: authToken,
      json: {
        name: newCatName.trim(),
        icon: newCatIcon.trim() || '📦',
        parent_id: targetParentId,
        badge: newCatBadge,
        is_featured: newCatIsFeatured,
        is_hidden: false,
      },
    });
    if (res.ok) {
      const created: ProductCategory = await res.json();
      setNewCatName('');
      setNewCatBadge('');
      setNewCatIsFeatured(false);
      setShowAddSubcategoryForm(false);
      await loadAdminData(authToken, true);
      setActiveAdminProductCategory(created.id);
      const pId = created.parent_id || adminMainCategories[0]?.id || 'polygraphy';
      showToast(`Подкатегория «${created.name}» создана (${buildSubcategoryPath(pId, created.id)})`);
    }
  };

  const handleUpdateSubcategoryFields = async (
    cat: ProductCategory,
    changes: Partial<ProductCategory>
  ) => {
    const res = await apiFetch(`/admin/categories/${cat.id}`, {
      method: 'PUT',
      token: authToken,
      json: changes,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
      showToast('Подкатегория обновлена');
    }
  };

  const handleUploadSubcategoryCardImage = async (
    cat: ProductCategory,
    fileList: FileList | null
  ) => {
    if (!fileList || fileList.length === 0) return;
    const urls = await uploadFilesToServer(fileList);
    if (urls.length > 0) {
      await handleUpdateSubcategoryFields(cat, { image_url: urls[0], is_featured: true });
    }
  };

  const handleToggleCategoryHidden = async (cat: ProductCategory) => {
    await handleUpdateSubcategoryFields(cat, { is_hidden: !cat.is_hidden });
  };

  const handleDeleteCategory = async (cat: ProductCategory) => {
    if (adminCategories.length <= 1) {
      showToast('Нельзя удалить последнюю подкатегорию');
      return;
    }
    const confirmed = await requestConfirm({
      title: 'Удаление подкатегории',
      message: `Удалить подкатегорию «${cat.name}» и все входящие в неё продукты?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    const res = await apiFetch(`/admin/categories/${cat.id}`, {
      method: 'DELETE',
      token: authToken,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
      showToast('Подкатегория удалена');
    }
  };

  // --- УПРАВЛЕНИЕ ПРОДУКТАМИ ---
  const toggleProductExpanded = (prodId: number) => {
    setExpandedProductIds((prev) =>
      prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId]
    );
  };

  const handleQuickToggleProductHidden = async (prod: ProductItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...prod, is_hidden: !prod.is_hidden };
    const res = await apiFetch(`/admin/products/${prod.id}`, {
      method: 'PUT',
      token: authToken,
      json: updated,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
    }
  };

  const handleApplyMaterialsToCategory = async (
    catId: string,
    paperIds: number[],
    lamIds: number[],
    coverPaperIds?: number[]
  ) => {
    const catName = adminCategories.find((c) => c.id === catId)?.name || catId;
    const confirmed = await requestConfirm({
      title: 'Применить набор материалов',
      message: `Применить этот набор бумаг (${paperIds.length} шт.) и ламинации (${lamIds.length} шт.) сразу ко всем продуктам в категории «${catName}»?`,
      confirmLabel: 'Применить ко всем',
      danger: false,
    });
    if (!confirmed) {
      return;
    }
    const res = await apiFetch(`/admin/categories/${catId}/apply-materials`, {
      method: 'POST',
      token: authToken,
      json: {
        allowed_paper_ids: paperIds,
        allowed_cover_paper_ids: coverPaperIds || paperIds,
        allowed_lamination_ids: lamIds,
      },
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
      showToast(`Набор материалов применён к категории «${catName}»`);
    }
  };

  const handleApplyParamsToCategory = async (prod: ProductItem) => {
    const catName = adminCategories.find((c) => c.id === prod.category)?.name || prod.category;
    const res = await apiFetch(`/admin/categories/${prod.category}/apply-params`, {
      method: 'POST',
      token: authToken,
      json: {
        cost_params: prod.cost_params || [],
        show_format_select: prod.show_format_select !== false,
        show_print_sides: prod.show_print_sides !== false,
        show_paper_select: prod.show_paper_select !== false,
        show_lamination_select: prod.show_lamination_select !== false,
        allow_custom_size: Boolean(prod.allow_custom_size),
        has_cover_block: Boolean(
          prod.has_cover_block ?? (prod.category === 'catalogs' || prod.multi_page_mode === 'pages')
        ),
        allowed_block_print_modes: prod.allowed_block_print_modes || 'both',
        allowed_cover_print_modes: prod.allowed_cover_print_modes || 'both',
        allowed_cover_paper_ids: prod.allowed_cover_paper_ids || prod.allowed_paper_ids || [],
        include_paper_cost: prod.include_paper_cost !== false,
        include_print_cost: prod.include_print_cost !== false,
        include_toner_cost: prod.include_toner_cost !== false,
        include_components_cost: prod.include_components_cost !== false,
        include_lamination_cost: prod.include_lamination_cost !== false,
        include_extra_params_cost: prod.include_extra_params_cost !== false,
        include_defect_cost: prod.include_defect_cost !== false,
        excluded_equipment_ids: prod.excluded_equipment_ids || [],
        enabled_equipment_ids: prod.enabled_equipment_ids || [],
      },
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
      showToast(`Параметры подсчета применены ко всем товарам подкатегории «${catName}»`);
    }
  };

  const handleSaveProduct = async (prod: ProductItem) => {
    const res = await apiFetch(`/admin/products/${prod.id}`, {
      method: 'PUT',
      token: authToken,
      json: prod,
    });
    if (res.ok) {
      setDirtyProductIds((prev) => prev.filter((id) => id !== prod.id));
      await loadAdminData(authToken, true);
      showToast(`Продукт «${prod.name}» сохранён`);
    }
  };

  const handleDuplicateProduct = async (prod: ProductItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const copyName = `${prod.name} (копия)`;
    const payload = {
      category: prod.category,
      name: copyName,
      product_kind: prod.product_kind || '',
      width_mm: prod.width_mm,
      height_mm: prod.height_mm,
      allow_custom_size: Boolean(prod.allow_custom_size),
      multi_page_mode: prod.multi_page_mode || 'none',
      default_pages: prod.default_pages || 1,
      allowed_sides: prod.allowed_sides || 'both',
      has_cover_block: Boolean(prod.has_cover_block),
      allowed_block_print_modes: prod.allowed_block_print_modes || 'both',
      allowed_cover_print_modes: prod.allowed_cover_print_modes || 'both',
      allowed_cover_paper_ids: Array.isArray(prod.allowed_cover_paper_ids)
        ? [...prod.allowed_cover_paper_ids]
        : [...(prod.allowed_paper_ids || [])],
      defect_percent: prod.defect_percent ?? 0,
      is_hidden: Boolean(prod.is_hidden),
      schematic_type: prod.schematic_type || 'auto',
      base_mm: prod.base_mm ?? 35,
      images: Array.isArray(prod.images) ? [...prod.images] : [],
      cost_params: Array.isArray(prod.cost_params)
        ? JSON.parse(JSON.stringify(prod.cost_params))
        : [],
      show_format_select: prod.show_format_select !== false,
      show_print_sides: prod.show_print_sides !== false,
      show_paper_select: prod.show_paper_select !== false,
      show_lamination_select: prod.show_lamination_select !== false,
      include_paper_cost: prod.include_paper_cost !== false,
      include_print_cost: prod.include_print_cost !== false,
      include_toner_cost: prod.include_toner_cost !== false,
      include_components_cost: prod.include_components_cost !== false,
      include_lamination_cost: prod.include_lamination_cost !== false,
      include_extra_params_cost: prod.include_extra_params_cost !== false,
      include_defect_cost: prod.include_defect_cost !== false,
      excluded_equipment_ids: Array.isArray(prod.excluded_equipment_ids)
        ? [...prod.excluded_equipment_ids]
        : [],
      enabled_equipment_ids: Array.isArray(prod.enabled_equipment_ids)
        ? [...prod.enabled_equipment_ids]
        : [],
      allowed_paper_ids: Array.isArray(prod.allowed_paper_ids) ? [...prod.allowed_paper_ids] : [],
      allowed_lamination_ids: Array.isArray(prod.allowed_lamination_ids)
        ? [...prod.allowed_lamination_ids]
        : [],
    };
    const res = await apiFetch('/admin/products', {
      method: 'POST',
      token: authToken,
      json: payload,
    });
    if (res.ok) {
      const createdProd: ProductItem = await res.json();
      await loadAdminData(authToken, true);
      setExpandedProductIds((prev) =>
        prev.includes(createdProd.id) ? prev : [...prev, createdProd.id]
      );
      showToast(`Создана копия: «${createdProd.name}»`);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    const allPaperIds = adminItems.filter((i) => i.category === 'papers').map((i) => i.id);
    const allLamIds = adminItems.filter((i) => i.category === 'laminations').map((i) => i.id);

    const res = await apiFetch('/admin/products', {
      method: 'POST',
      token: authToken,
      json: {
        category: activeAdminProductCategory,
        name: newProdName.trim(),
        product_kind: newProdKind.trim(),
        width_mm: newProdWidth,
        height_mm: newProdHeight,
        allow_custom_size: newProdAllowCustom,
        multi_page_mode: newProdMultiPage,
        default_pages: newProdDefaultPages,
        allowed_sides: newProdAllowedSides,
        defect_percent: newProdDefectPercent,
        is_hidden: false,
        images: newProdImages,
        cost_params: newProdCostParams,
        allowed_paper_ids: allPaperIds,
        allowed_lamination_ids: allLamIds,
      },
    });
    if (res.ok) {
      const createdProd: ProductItem = await res.json();
      setNewProdName('');
      setNewProdKind('');
      setNewProdDefectPercent(0);
      setNewProdImages([]);
      setNewProdImageUrlInput('');
      setNewProdCostParams([]);
      setShowAddProductForm(false);
      await loadAdminData(authToken, true);
      const catObj = adminCategories.find((c) => c.id === createdProd.category);
      const mainId = catObj?.parent_id || adminMainCategories[0]?.id || 'polygraphy';
      showToast(
        `Продукт «${createdProd.name}» создан (${buildProductPath(mainId, createdProd.category, createdProd.id)})`
      );
    }
  };

  const handleDeleteProduct = async (prodId: number) => {
    const confirmed = await requestConfirm({
      title: 'Удаление продукта',
      message: 'Удалить этот продукт из категории?',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    const res = await apiFetch(`/admin/products/${prodId}`, {
      method: 'DELETE',
      token: authToken,
    });
    if (res.ok) {
      await loadAdminData(authToken, true);
    }
  };

  const currentAdminCatObj = useMemo(
    () => adminCategories.find((c) => c.id === activeAdminProductCategory),
    [adminCategories, activeAdminProductCategory]
  );
  const productsInAdminCategory = useMemo(
    () => adminProducts.filter((p) => p.category === activeAdminProductCategory),
    [adminProducts, activeAdminProductCategory]
  );

  const existingKindsInAdminCategory = useMemo(() => {
    const s = new Set<string>();
    productsInAdminCategory.forEach((p) => {
      const k = (p.product_kind || '').trim();
      if (k) s.add(k);
    });
    return Array.from(s);
  }, [productsInAdminCategory]);

  return (
    <div>
      {/* Сквозной быстрый поиск по товарам и подкатегориям */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: t.subCardBg,
          borderRadius: 3,
          border: `1px solid ${t.softBorder}`,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          data-testid="admin-catalog-search"
          placeholder="🔍 Быстрый сквозной поиск товара или подкатегории по названию, виду или ID..."
          value={adminCatalogSearch}
          onChange={(e) => setAdminCatalogSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 240, padding: '8px 12px', fontSize: 13.5 }}
        />
        {adminCatalogSearch.trim() && (
          <button
            type="button"
            data-testid="admin-catalog-search-clear"
            onClick={() => setAdminCatalogSearch('')}
            style={{
              padding: '7px 12px',
              borderRadius: 2,
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              color: t.text,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12.5,
            }}
          >
            ✕ Сбросить поиск
          </button>
        )}
      </div>

      {adminCatalogSearch.trim() &&
        (() => {
          const q = adminCatalogSearch.trim().toLowerCase();
          const matchedSubcats = adminCategories.filter(
            (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
          );
          const matchedProds = adminProducts.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              String(p.id).includes(q) ||
              (p.product_kind || '').toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q)
          );
          return (
            <div
              data-testid="admin-catalog-search-results"
              style={{
                padding: 14,
                borderRadius: 3,
                background: t.cardBg,
                border: `1px solid ${t.selectedBorder}`,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>
                  Результаты поиска «{adminCatalogSearch.trim()}»: найдено подкатегорий —{' '}
                  {matchedSubcats.length}, товаров — {matchedProds.length}
                </span>
              </div>

              {matchedSubcats.length > 0 && (
                <div style={{ marginBottom: matchedProds.length > 0 ? 14 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.subText, marginBottom: 6 }}>
                    Подкатегории:
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {matchedSubcats.map((sc) => {
                      const parentMc = adminMainCategories.find(
                        (m) => m.id === (sc.parent_id || adminMainCategories[0]?.id)
                      );
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          data-testid={`search-subcat-${sc.id}`}
                          onClick={() => {
                            const mainId =
                              sc.parent_id || adminMainCategories[0]?.id || 'polygraphy';
                            setOpenedMainCatId(mainId);
                            setOpenedSubCatId(sc.id);
                            setActiveAdminProductCategory(sc.id);
                            setAdminCatalogSearch('');
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 2,
                            border: `1px solid ${t.selectedBorder}`,
                            background: t.selectedBg,
                            color: t.selectedText,
                            cursor: 'pointer',
                            fontSize: 12.5,
                            fontWeight: 600,
                          }}
                        >
                          {parentMc ? `${parentMc.name} → ` : ''}
                          {sc.name} <span style={{ opacity: 0.75 }}>({sc.id})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {matchedProds.length > 0 ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.subText, marginBottom: 6 }}>
                    Найденные товары (кликните «Настроить в подкатегории», чтобы перейти к полному
                    редактированию, или используйте быстрые действия):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchedProds.map((prod) => {
                      const sc = adminCategories.find((c) => c.id === prod.category);
                      const mc = adminMainCategories.find(
                        (m) => m.id === (sc?.parent_id || adminMainCategories[0]?.id)
                      );
                      const isDirty = dirtyProductIds.includes(prod.id);
                      return (
                        <div
                          key={prod.id}
                          data-testid={`search-product-row-${prod.id}`}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 3,
                            background: t.subCardBg,
                            border: `1px solid ${isDirty ? '#F59E0B' : t.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                          >
                            <span
                              style={{
                                fontSize: 11.5,
                                padding: '2px 7px',
                                borderRadius: 2,
                                background: t.cardBg,
                                border: `1px solid ${t.border}`,
                                color: t.subText,
                                fontWeight: 600,
                              }}
                            >
                              ID: {prod.id}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>
                              {prod.name}
                            </span>
                            {prod.product_kind && (
                              <span
                                style={{
                                  fontSize: 11.5,
                                  padding: '2px 7px',
                                  borderRadius: 2,
                                  background: t.selectedBg,
                                  color: t.selectedText,
                                  fontWeight: 600,
                                }}
                              >
                                {prod.product_kind}
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: t.mutedText }}>
                              {prod.width_mm} × {prod.height_mm} мм
                            </span>
                            <span
                              style={{
                                fontSize: 11.5,
                                padding: '2px 8px',
                                borderRadius: 2,
                                background: t.cardBg,
                                color: t.subText,
                              }}
                            >
                              {mc ? `${mc.name} → ` : ''}
                              {sc?.name || prod.category}
                            </span>
                            {isDirty && (
                              <span
                                data-testid={`unsaved-product-badge-${prod.id}`}
                                style={{
                                  fontSize: 11.5,
                                  padding: '2px 8px',
                                  borderRadius: 2,
                                  background: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                                  border: '1px solid #F59E0B',
                                  color: isDark ? '#FBBF24' : '#B45309',
                                  fontWeight: 700,
                                }}
                              >
                                Есть несохраненные изменения
                              </span>
                            )}
                          </div>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                          >
                            <button
                              type="button"
                              data-testid={`search-open-product-btn-${prod.id}`}
                              onClick={() => {
                                const mainId =
                                  sc?.parent_id || adminMainCategories[0]?.id || 'polygraphy';
                                setOpenedMainCatId(mainId);
                                setOpenedSubCatId(prod.category);
                                setActiveAdminProductCategory(prod.category);
                                setExpandedProductIds((prev) =>
                                  prev.includes(prod.id) ? prev : [...prev, prod.id]
                                );
                                setAdminCatalogSearch('');
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 2,
                                border: 'none',
                                background: t.brandPrimary,
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Настроить в подкатегории
                            </button>
                            <button
                              type="button"
                              data-testid={`search-duplicate-product-btn-${prod.id}`}
                              onClick={(e) => handleDuplicateProduct(prod, e)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 2,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg,
                                color: t.text,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Копировать
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const mainId =
                                  sc?.parent_id || adminMainCategories[0]?.id || 'polygraphy';
                                navigateTo(buildProductPath(mainId, prod.category, prod.id));
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 2,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg,
                                color: t.selectedText,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Страница
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                matchedSubcats.length === 0 && (
                  <div style={{ fontSize: 13, color: t.subText }}>
                    По запросу «{adminCatalogSearch.trim()}» ничего не найдено.
                  </div>
                )
              )}
            </div>
          );
        })()}

      {/* Навигационная цепочка (хлебные крошки) внутри управления каталогом */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: t.subCardBg,
          borderRadius: 3,
          border: `1px solid ${t.softBorder}`,
          marginBottom: 16,
          fontSize: 13.5,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setOpenedMainCatId(null);
            setOpenedSubCatId(null);
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 2,
            border: `1px solid ${!openedMainCatId ? '#C02721' : t.border}`,
            background: !openedMainCatId ? '#C02721' : t.cardBg,
            color: !openedMainCatId ? '#fff' : t.text,
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          1. Все категории ({adminMainCategories.length})
        </button>

        {openedMainCatId &&
          (() => {
            const openedMc = adminMainCategories.find((m) => m.id === openedMainCatId);
            if (!openedMc) return null;
            const subCount = adminCategories.filter(
              (c) => (c.parent_id || adminMainCategories[0]?.id) === openedMc.id
            ).length;
            return (
              <>
                <span style={{ color: t.mutedText, fontWeight: 700 }}>→</span>
                <button
                  type="button"
                  onClick={() => setOpenedSubCatId(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 2,
                    border: `1px solid ${!openedSubCatId ? '#C02721' : t.border}`,
                    background: !openedSubCatId ? '#C02721' : t.cardBg,
                    color: !openedSubCatId ? '#fff' : t.text,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  2. Категория: {openedMc.name} ({subCount} подкат.)
                </button>
              </>
            );
          })()}

        {openedMainCatId && openedSubCatId && currentAdminCatObj && (
          <>
            <span style={{ color: t.mutedText, fontWeight: 700 }}>→</span>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 2,
                background: '#C02721',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              3. Подкатегория: {currentAdminCatObj.name} ({productsInAdminCategory.length} тов.)
            </span>
          </>
        )}
      </div>

      {/* ==================== УРОВЕНЬ 1: СПИСОК ВСЕХ ГЛАВНЫХ КАТЕГОРИЙ ==================== */}
      {!openedMainCatId && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              Главные категории ({adminMainCategories.length})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddMainCategoryForm(!showAddMainCategoryForm)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 2,
                  border: 'none',
                  background: '#C02721',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {showAddMainCategoryForm ? '✕ Закрыть' : '+ Добавить категорию'}
              </button>
              {expandedMainCategoryIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedMainCategoryIds([])}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 2,
                    border: `1px solid ${t.border}`,
                    background: t.subCardBg,
                    color: t.text,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Свернуть все
                </button>
              )}
            </div>
          </div>

          {showAddMainCategoryForm && (
            <form
              onSubmit={handleAddMainCategory}
              style={{
                background: t.infoBoxBg,
                padding: 14,
                borderRadius: 3,
                border: `1px solid ${t.infoBoxBorder}`,
                marginBottom: 16,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                placeholder="Название новой категории..."
                value={newMainCatName}
                onChange={(e) => setNewMainCatName(e.target.value)}
                style={{ ...smallInputStyle, width: 280 }}
                autoFocus
              />
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={newMainCatIsAccent}
                  onChange={(e) => setNewMainCatIsAccent(e.target.checked)}
                />
                <span>Акцент в шапке</span>
              </label>
              <button
                type="submit"
                style={{
                  padding: '7px 14px',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Создать
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {adminMainCategories.map((mc) => {
              const subcats = adminCategories.filter(
                (c) => (c.parent_id || adminMainCategories[0]?.id) === mc.id
              );
              const prodCount = adminProducts.filter((p) =>
                subcats.some((sc) => sc.id === p.category)
              ).length;
              const isMainExpanded = expandedMainCategoryIds.includes(mc.id);
              const mainThumb = mc.image_url ? resolveImageUrl(mc.image_url) : '';
              const mainImgInputVal = mainCatImageUrlInputs[mc.id] || '';

              const isMainDragging =
                activeDragItem?.listType === 'main' && activeDragItem.itemId === mc.id;

              return (
                <div
                  key={mc.id}
                  data-sortable-list="main"
                  data-sortable-id={mc.id}
                  style={{
                    border: isMainDragging
                      ? `2px solid ${t.selectedBorder}`
                      : `1px solid ${mc.is_hidden ? '#ef4444' : t.border}`,
                    borderRadius: 3,
                    background: t.subCardBg,
                    overflow: 'hidden',
                    boxShadow: 'none',
                    position: 'relative',
                    zIndex: isMainDragging ? 50 : 1,
                  }}
                >
                  <div
                    onClick={() => {
                      if (suppressClickAfterDragRef.current) {
                        suppressClickAfterDragRef.current = false;
                        return;
                      }
                      setOpenedMainCatId(mc.id);
                      setOpenedSubCatId(null);
                    }}
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isMainExpanded ? t.tableHeaderBg : 'transparent',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                    >
                      {renderDragGrip('main', mc.id, isMainDragging)}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressClickAfterDragRef.current) return;
                          toggleMainCategoryExpanded(mc.id);
                        }}
                        style={{ fontSize: 14, color: t.subText, cursor: 'pointer' }}
                      >
                        {isMainExpanded ? '▼' : '▶'}
                      </span>

                      {mainThumb ? (
                        <img
                          src={mainThumb}
                          alt={mc.name}
                          draggable={false}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 2,
                            objectFit: 'cover',
                            border: `1px solid ${t.border}`,
                            background: '#fff',
                          }}
                        />
                      ) : (
                        <div
                          className="ui-studio-stage"
                          style={{
                            width: 56,
                            height: 34,
                            borderRadius: 2.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          <MainCategoryIllustration
                            category={mc}
                            isDark={isDark}
                            compact
                          />
                        </div>
                      )}

                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          textDecoration: mc.is_hidden ? 'line-through' : 'none',
                          opacity: mc.is_hidden ? 0.7 : 1,
                        }}
                      >
                        {mc.name}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 2,
                          background: t.cardBg,
                          border: `1px solid ${t.border}`,
                          color: t.mutedText,
                        }}
                      >
                        {subcats.length} подкат. • {prodCount} тов.
                      </span>
                      {mc.is_accent && (
                        <span
                          style={{
                            fontSize: 12,
                            background: t.selectedBg,
                            color: t.selectedText,
                            padding: '2px 8px',
                            borderRadius: 2,
                            fontWeight: 500,
                          }}
                        >
                          Акцент
                        </span>
                      )}
                      {mc.is_hidden && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 2,
                            background: '#ef4444',
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          Скрыта
                        </span>
                      )}
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <button
                        type="button"
                        onClick={() => navigateTo(buildMainCategoryPath(mc.id))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: t.cardBg,
                          color: t.selectedText,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Страница
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateMainCategory(mc, {
                            is_hidden: !mc.is_hidden,
                          })
                        }
                        style={{
                          padding: '6px 10px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: mc.is_hidden ? '#16a34a' : t.cardBg,
                          color: mc.is_hidden ? '#fff' : t.text,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {mc.is_hidden ? 'Показать' : 'Скрыть'}
                      </button>
                      <span
                        onClick={() => toggleMainCategoryExpanded(mc.id)}
                        style={{
                          fontSize: 12,
                          color: t.selectedText,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {isMainExpanded ? 'Свернуть' : 'Настроить'}
                      </span>
                    </div>
                  </div>

                  {isMainExpanded && (
                    <div
                      className="ui-admin-maincat-grid"
                      style={{
                        padding: '12px 16px',
                        borderTop: `1px solid ${t.border}`,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: t.mutedText,
                            marginBottom: 4,
                          }}
                        >
                          Название категории:
                        </label>
                        <input
                          type="text"
                          defaultValue={mc.name}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== mc.name) {
                              void handleUpdateMainCategory(mc, { name: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          style={{ ...smallInputStyle, fontWeight: 600 }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: t.mutedText,
                            marginBottom: 4,
                          }}
                        >
                          Отображение в шапке:
                        </label>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12.5,
                            cursor: 'pointer',
                            fontWeight: 500,
                            height: 34,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(mc.is_accent)}
                            onChange={(e) =>
                              void handleUpdateMainCategory(mc, {
                                is_accent: e.target.checked,
                              })
                            }
                          />
                          <span>Синяя кнопка-акцент</span>
                        </label>
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: t.mutedText,
                            marginBottom: 4,
                          }}
                        >
                          Картинка категории:
                        </label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <label
                            style={{
                              padding: '6px 10px',
                              background: t.brandPrimary || 'var(--brand-primary)',
                              color: '#fff',
                              borderRadius: 2,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Загрузить
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                if (!e.target.files || e.target.files.length === 0) return;
                                const urls = await uploadFilesToServer(e.target.files);
                                if (urls.length > 0) {
                                  await handleUpdateMainCategory(mc, { image_url: urls[0] });
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <input
                            type="text"
                            placeholder="или https:// URL картинки..."
                            value={mainImgInputVal}
                            onChange={(e) =>
                              setMainCatImageUrlInputs((prev) => ({
                                ...prev,
                                [mc.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && mainImgInputVal.trim()) {
                                e.preventDefault();
                                const trimmedUrl = mainImgInputVal.trim();
                                if (!isSecureAssetUrl(trimmedUrl)) {
                                  showToast('Ссылка на изображение должна начинаться с https://');
                                  return;
                                }
                                void handleUpdateMainCategory(mc, {
                                  image_url: trimmedUrl,
                                });
                                setMainCatImageUrlInputs((prev) => ({
                                  ...prev,
                                  [mc.id]: '',
                                }));
                              }
                            }}
                            style={{ ...smallInputStyle, padding: '5px 8px', fontSize: 12 }}
                          />
                          {mc.image_url && (
                            <button
                              type="button"
                              onClick={() => void handleUpdateMainCategory(mc, { image_url: '' })}
                              style={{
                                padding: '5px 8px',
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 2,
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                              title="Сбросить картинку категории"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDeleteMainCategory(mc)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 2,
                          border: 'none',
                          background: '#ef4444',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== УРОВЕНЬ 2: ПОДКАТЕГОРИИ ОТКРЫТОЙ КАТЕГОРИИ ==================== */}
      {openedMainCatId &&
        !openedSubCatId &&
        (() => {
          const activeMc = adminMainCategories.find((m) => m.id === openedMainCatId);
          if (!activeMc) return null;
          const subcatsOfMain = adminCategories.filter(
            (c) => (c.parent_id || adminMainCategories[0]?.id) === activeMc.id
          );

          return (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Подкатегории «{activeMc.name}» ({subcatsOfMain.length})
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddSubcategoryForm(!showAddSubcategoryForm)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 2,
                      border: 'none',
                      background: '#C02721',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {showAddSubcategoryForm ? '✕ Закрыть' : '+ Добавить подкатегорию'}
                  </button>
                  {expandedSubcategoryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedSubcategoryIds([])}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 2,
                        border: `1px solid ${t.border}`,
                        background: t.subCardBg,
                        color: t.text,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Свернуть все
                    </button>
                  )}
                </div>
              </div>

              {showAddSubcategoryForm && (
                <form
                  onSubmit={handleAddCategory}
                  style={{
                    background: t.infoBoxBg,
                    padding: 14,
                    borderRadius: 3,
                    border: `1px solid ${t.infoBoxBorder}`,
                    marginBottom: 16,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Название новой подкатегории..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ ...smallInputStyle, width: 260 }}
                    autoFocus
                  />
                  <select
                    value={newCatBadge}
                    onChange={(e) => setNewCatBadge(e.target.value as SubcategoryBadgeType)}
                    style={{ ...smallInputStyle, width: 140 }}
                  >
                    <option value="">Без бейджа</option>
                    <option value="hit">★ ХИТ</option>
                    <option value="new">NEW</option>
                  </select>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newCatIsFeatured}
                      onChange={(e) => setNewCatIsFeatured(e.target.checked)}
                    />
                    <span>Крупная карточка</span>
                  </label>
                  <button
                    type="submit"
                    style={{
                      padding: '7px 14px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 2,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Создать
                  </button>
                </form>
              )}

              {subcatsOfMain.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: t.mutedText,
                    background: t.subCardBg,
                    borderRadius: 3,
                    border: `1px dashed ${t.border}`,
                  }}
                >
                  В категории «{activeMc.name}» пока нет подкатегорий.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {subcatsOfMain.map((cat) => {
                    const prodsInSub = adminProducts.filter((p) => p.category === cat.id);
                    const imgInputVal = subcatImageUrlInputs[cat.id] || '';
                    const isSubExpanded = expandedSubcategoryIds.includes(cat.id);
                    const subThumb = cat.image_url ? resolveImageUrl(cat.image_url) : '';

                    const isSubDragging =
                      activeDragItem?.listType === 'sub' && activeDragItem.itemId === cat.id;

                    return (
                      <div
                        key={cat.id}
                        data-sortable-list="sub"
                        data-sortable-id={cat.id}
                        style={{
                          border: isSubDragging
                            ? `2px solid ${t.selectedBorder}`
                            : `1px solid ${cat.is_hidden ? '#ef4444' : t.border}`,
                          borderRadius: 3,
                          background: t.subCardBg,
                          overflow: 'hidden',
                          boxShadow: 'none',
                          position: 'relative',
                          zIndex: isSubDragging ? 50 : 1,
                        }}
                      >
                        <div
                          onClick={() => {
                            if (suppressClickAfterDragRef.current) {
                              suppressClickAfterDragRef.current = false;
                              return;
                            }
                            setActiveAdminProductCategory(cat.id);
                            setOpenedSubCatId(cat.id);
                          }}
                          style={{
                            padding: '10px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: isSubExpanded ? t.tableHeaderBg : 'transparent',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              flexWrap: 'wrap',
                            }}
                          >
                            {renderDragGrip('sub', cat.id, isSubDragging)}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (suppressClickAfterDragRef.current) return;
                                toggleSubcategoryExpanded(cat.id);
                              }}
                              style={{ fontSize: 14, color: t.subText, cursor: 'pointer' }}
                            >
                              {isSubExpanded ? '▼' : '▶'}
                            </span>

                            {subThumb ? (
                              <img
                                src={subThumb}
                                alt={cat.name}
                                draggable={false}
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 2,
                                  objectFit: 'cover',
                                  border: `1px solid ${t.border}`,
                                  background: '#fff',
                                }}
                              />
                            ) : (
                              <div
                                className="ui-studio-stage"
                                style={{
                                  width: 52,
                                  height: 38,
                                  borderRadius: 2.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                }}
                              >
                                <div
                                  style={{
                                    transform: 'scale(0.56)',
                                    transformOrigin: 'center',
                                    display: 'flex',
                                  }}
                                >
                                  <SubcategoryCardIllustration
                                    cat={cat}
                                    isDark={isDark}
                                    compact
                                  />
                                </div>
                              </div>
                            )}

                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 15,
                                textDecoration: cat.is_hidden ? 'line-through' : 'none',
                                opacity: cat.is_hidden ? 0.7 : 1,
                              }}
                            >
                              {cat.name}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 2,
                                background: t.cardBg,
                                border: `1px solid ${t.border}`,
                                color: t.mutedText,
                              }}
                            >
                              {prodsInSub.length} тов.
                            </span>
                            {Boolean(cat.is_featured) && (
                              <span
                                style={{
                                  fontSize: 11.5,
                                  background: t.selectedBg,
                                  color: t.selectedText,
                                  border: `1px solid ${t.selectedBorder}`,
                                  padding: '1px 7px',
                                  borderRadius: 2,
                                  fontWeight: 600,
                                }}
                                title="Отображается крупным блоком с картинкой в выпадающем меню"
                              >
                                Крупная
                              </span>
                            )}
                            {cat.badge === 'hit' && (
                              <span
                                style={{
                                  fontSize: 12,
                                  background: '#C02721',
                                  color: '#fff',
                                  padding: '2px 8px',
                                  borderRadius: 2,
                                  fontWeight: 600,
                                }}
                              >
                                ★ ХИТ
                              </span>
                            )}
                            {cat.badge === 'new' && (
                              <span
                                style={{
                                  fontSize: 12,
                                  background: '#10b981',
                                  color: '#fff',
                                  padding: '2px 8px',
                                  borderRadius: 2,
                                  fontWeight: 600,
                                }}
                              >
                                NEW
                              </span>
                            )}
                            {cat.is_hidden && (
                              <span
                                style={{
                                  fontSize: 12,
                                  padding: '2px 8px',
                                  borderRadius: 2,
                                  background: '#ef4444',
                                  color: '#fff',
                                  fontWeight: 600,
                                }}
                              >
                                Скрыта
                              </span>
                            )}
                          </div>

                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                          >
                            <button
                              type="button"
                              onClick={() => navigateTo(buildSubcategoryPath(activeMc.id, cat.id))}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 2,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg,
                                color: t.selectedText,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Страница
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleCategoryHidden(cat)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 2,
                                border: `1px solid ${t.border}`,
                                background: cat.is_hidden ? '#16a34a' : t.cardBg,
                                color: cat.is_hidden ? '#fff' : t.text,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {cat.is_hidden ? 'Показать' : 'Скрыть'}
                            </button>
                            <span
                              onClick={() => toggleSubcategoryExpanded(cat.id)}
                              style={{
                                fontSize: 12,
                                color: t.selectedText,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              {isSubExpanded ? 'Свернуть' : 'Настроить'}
                            </span>
                          </div>
                        </div>

                        {isSubExpanded && (
                          <div
                            className="ui-admin-subcat-grid"
                            style={{
                              padding: '12px 16px',
                              borderTop: `1px solid ${t.border}`,
                            }}
                          >
                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: 11.5,
                                  color: t.mutedText,
                                  marginBottom: 4,
                                }}
                              >
                                Название подкатегории:
                              </label>
                              <input
                                type="text"
                                defaultValue={cat.name}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val && val !== cat.name) {
                                    void handleUpdateSubcategoryFields(cat, { name: val });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                style={{ ...smallInputStyle, fontWeight: 600 }}
                              />
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: 11.5,
                                  color: t.mutedText,
                                  marginBottom: 4,
                                }}
                              >
                                Раздел:
                              </label>
                              <select
                                value={cat.parent_id || adminMainCategories[0]?.id || 'polygraphy'}
                                onChange={(e) =>
                                  void handleUpdateSubcategoryFields(cat, {
                                    parent_id: e.target.value,
                                  })
                                }
                                style={smallInputStyle}
                              >
                                {adminMainCategories.map((mcItem) => (
                                  <option key={mcItem.id} value={mcItem.id}>
                                    {mcItem.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: 11.5,
                                  color: t.mutedText,
                                  marginBottom: 4,
                                }}
                              >
                                Бейдж:
                              </label>
                              <select
                                value={cat.badge || ''}
                                onChange={(e) =>
                                  void handleUpdateSubcategoryFields(cat, {
                                    badge: e.target.value as SubcategoryBadgeType,
                                  })
                                }
                                style={smallInputStyle}
                              >
                                <option value="">Нет</option>
                                <option value="hit">★ ХИТ</option>
                                <option value="new">NEW</option>
                              </select>
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: 11.5,
                                  color: t.mutedText,
                                  marginBottom: 4,
                                }}
                              >
                                Вид карточки:
                              </label>
                              <label
                                title="Если включено — крупная карточка с картинкой в выпадающем меню; если выключено — текстовая ссылка без картинки"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  height: 34,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(cat.is_featured)}
                                  onChange={(e) =>
                                    void handleUpdateSubcategoryFields(cat, {
                                      is_featured: e.target.checked,
                                    })
                                  }
                                />
                                <span>Крупная</span>
                              </label>
                            </div>

                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: 11.5,
                                  color: t.mutedText,
                                  marginBottom: 4,
                                }}
                              >
                                Картинка карточки:
                              </label>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <label
                                  style={{
                                    padding: '6px 10px',
                                    background: t.brandPrimary || 'var(--brand-primary)',
                                    color: '#fff',
                                    borderRadius: 2,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Загрузить
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) =>
                                      void handleUploadSubcategoryCardImage(cat, e.target.files)
                                    }
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="или URL картинки..."
                                  value={imgInputVal}
                                  onChange={(e) =>
                                    setSubcatImageUrlInputs((prev) => ({
                                      ...prev,
                                      [cat.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && imgInputVal.trim()) {
                                      e.preventDefault();
                                      const trimmedUrl = imgInputVal.trim();
                                      if (!isSecureAssetUrl(trimmedUrl)) {
                                        showToast(
                                          'Ссылка на изображение должна начинаться с https://'
                                        );
                                        return;
                                      }
                                      void handleUpdateSubcategoryFields(cat, {
                                        image_url: trimmedUrl,
                                        is_featured: true,
                                      });
                                      setSubcatImageUrlInputs((prev) => ({
                                        ...prev,
                                        [cat.id]: '',
                                      }));
                                    }
                                  }}
                                  style={{ ...smallInputStyle, padding: '5px 8px', fontSize: 12 }}
                                />
                                {cat.image_url && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateSubcategoryFields(cat, {
                                        image_url: '',
                                      })
                                    }
                                    style={{
                                      padding: '5px 8px',
                                      background: '#ef4444',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 2,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                    }}
                                    title="Удалить картинку карточки"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleDeleteCategory(cat)}
                              style={{
                                padding: '7px 12px',
                                borderRadius: 2,
                                border: 'none',
                                background: '#ef4444',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

      {/* ==================== УРОВЕНЬ 3: ТОВАРЫ ОТКРЫТОЙ ПОДКАТЕГОРИИ ==================== */}
      {openedMainCatId && openedSubCatId && currentAdminCatObj && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              Товары «{currentAdminCatObj.name}» ({productsInAdminCategory.length})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddProductForm(!showAddProductForm)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 2,
                  border: 'none',
                  background: '#C02721',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {showAddProductForm ? '✕ Закрыть' : '+ Добавить продукт'}
              </button>
              {expandedProductIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedProductIds([])}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 2,
                    border: `1px solid ${t.border}`,
                    background: t.subCardBg,
                    color: t.text,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Свернуть все
                </button>
              )}
            </div>
          </div>

          {showAddProductForm && (
            <form
              onSubmit={handleAddProduct}
              style={{
                background: t.infoBoxBg,
                padding: 18,
                borderRadius: 3,
                border: `1px solid ${t.infoBoxBorder}`,
                marginBottom: 20,
              }}
            >
              <h4 style={{ marginTop: 0, marginBottom: 12 }}>
                Новый продукт в категорию «{currentAdminCatObj?.name}»
              </h4>
              <datalist id="admin-product-kinds-datalist">
                {existingKindsInAdminCategory.map((kName) => (
                  <option key={kName} value={kName} />
                ))}
              </datalist>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.3fr 0.7fr 0.7fr',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Название продукта / формата:
                  </label>
                  <input
                    type="text"
                    placeholder="Напр. Трио Стандарт (297×790 мм)"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    style={smallInputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Вид изделия (необязательно):
                  </label>
                  <input
                    type="text"
                    list="admin-product-kinds-datalist"
                    placeholder="Напр. Календарь «Трио»"
                    value={newProdKind}
                    onChange={(e) => setNewProdKind(e.target.value)}
                    style={smallInputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Ширина (мм):
                  </label>
                  <input
                    type="number"
                    value={newProdWidth}
                    onChange={(e) => setNewProdWidth(Number(e.target.value))}
                    style={smallInputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Высота (мм):
                  </label>
                  <input
                    type="number"
                    value={newProdHeight}
                    onChange={(e) => setNewProdHeight(Number(e.target.value))}
                    style={smallInputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.3fr 1fr 1.2fr',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Режим страниц / листов:
                  </label>
                  <select
                    value={newProdMultiPage}
                    onChange={(e) => setNewProdMultiPage(e.target.value as MultiPageModeType)}
                    style={smallInputStyle}
                  >
                    <option value="none">1 лист (обычное изделие)</option>
                    <option value="sheets">Многолистовое (ввод кол-ва листов)</option>
                    <option value="pages">Многостраничное (ввод кол-ва полос)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Листов/полос по умолч.:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newProdDefaultPages}
                    onChange={(e) => setNewProdDefaultPages(Number(e.target.value))}
                    style={smallInputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Доступная красочность:
                  </label>
                  <select
                    value={newProdAllowedSides}
                    onChange={(e) => setNewProdAllowedSides(e.target.value as AllowedSidesType)}
                    style={smallInputStyle}
                  >
                    <option value="both">Односторонняя и двусторонняя</option>
                    <option value="single_only">Только односторонняя (4+0)</option>
                    <option value="duplex_only">Только двусторонняя (4+4)</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  background: t.cardBg,
                  padding: 12,
                  borderRadius: 3,
                  border: `1px solid ${t.border}`,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Картинки нового товара:
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label
                    style={{
                      padding: '7px 14px',
                      background: t.brandPrimary || 'var(--brand-primary)',
                      color: '#fff',
                      borderRadius: 2,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Загрузить с компьютера
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => void handleUploadNewProductFiles(e.target.files)}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 240 }}>
                    <input
                      type="text"
                      placeholder="Или вставьте ссылку на картинку (https://...)"
                      value={newProdImageUrlInput}
                      onChange={(e) => setNewProdImageUrlInput(e.target.value)}
                      style={smallInputStyle}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewProductImageUrl}
                      style={{
                        padding: '7px 12px',
                        background: t.secondaryBtnBg,
                        color: t.secondaryBtnText,
                        border: `1px solid ${t.border}`,
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Добавить URL
                    </button>
                  </div>
                </div>

                {newProdImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    {newProdImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: 72,
                          height: 72,
                          borderRadius: 3,
                          overflow: 'hidden',
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        <img
                          src={resolveImageUrl(imgUrl)}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNewProdImages((prev) => prev.filter((_, i) => i !== idx))
                          }
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 2,
                            fontSize: 10,
                            padding: '2px 5px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={newProdAllowCustom}
                    onChange={(e) => setNewProdAllowCustom(e.target.checked)}
                  />
                  <span>Разрешить клиенту вводить произвольные размеры (Ширина × Высота)</span>
                </label>

                <button
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 2,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Создать продукт
                </button>
              </div>
            </form>
          )}

          {/* Аккордеон продуктов */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {productsInAdminCategory.map((prod) => {
              const isExpanded = expandedProductIds.includes(prod.id);
              const paramsCount = (prod.cost_params || []).length;
              const prodImages = prod.images || [];
              const mainThumb = prodImages.length > 0 ? resolveImageUrl(prodImages[0]) : '';

              const isProdDragging =
                activeDragItem?.listType === 'prod' && activeDragItem.itemId === prod.id;

              return (
                <div
                  key={prod.id}
                  data-sortable-list="prod"
                  data-sortable-id={String(prod.id)}
                  style={{
                    border: isProdDragging
                      ? `2px solid ${t.selectedBorder}`
                      : `1px solid ${prod.is_hidden ? '#ef4444' : t.border}`,
                    borderRadius: 3,
                    background: t.subCardBg,
                    overflow: 'hidden',
                    boxShadow: 'none',
                    position: 'relative',
                    zIndex: isProdDragging ? 50 : 1,
                  }}
                >
                  <div
                    onClick={() => {
                      if (suppressClickAfterDragRef.current) {
                        suppressClickAfterDragRef.current = false;
                        return;
                      }
                      toggleProductExpanded(prod.id);
                    }}
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isExpanded ? t.tableHeaderBg : 'transparent',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                    >
                      {renderDragGrip('prod', prod.id, isProdDragging)}
                      <span style={{ fontSize: 14, color: t.subText }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>

                      {mainThumb ? (
                        <img
                          src={mainThumb}
                          alt={prod.name}
                          draggable={false}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 2,
                            objectFit: 'cover',
                            border: `1px solid ${t.border}`,
                            background: '#fff',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 38,
                            borderRadius: 2,
                            border: `1px solid ${t.border}`,
                            overflow: 'hidden',
                            background: isDark ? '#0f172a' : '#f8fafc',
                            flexShrink: 0,
                          }}
                          title="Авто-схема изделия"
                        >
                          <ProductSchematicSVG
                            prod={prod}
                            widthMm={prod.width_mm}
                            heightMm={prod.height_mm}
                            pagesCount={prod.default_pages || 1}
                            isDark={isDark}
                          />
                        </div>
                      )}

                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          textDecoration: prod.is_hidden ? 'line-through' : 'none',
                          opacity: prod.is_hidden ? 0.7 : 1,
                        }}
                      >
                        {prod.name}
                      </span>
                      {prod.product_kind && prod.product_kind.trim() && (
                        <span
                          style={{
                            fontSize: 11.5,
                            padding: '2px 8px',
                            borderRadius: 2,
                            background: t.selectedBg,
                            border: `1px solid ${t.selectedBorder}`,
                            color: t.selectedText,
                            fontWeight: 600,
                          }}
                          title="Вид изделия (группа внутри подкатегории)"
                        >
                          {prod.product_kind}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 2,
                          background: t.cardBg,
                          border: `1px solid ${t.border}`,
                          color: t.mutedText,
                        }}
                      >
                        {prod.width_mm} × {prod.height_mm} мм
                      </span>
                      {prodImages.length > 0 && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 2,
                            background: t.selectedBg,
                            color: t.selectedText,
                            fontWeight: 500,
                          }}
                        >
                          Фото: {prodImages.length}
                        </span>
                      )}
                      {paramsCount > 0 && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 2,
                            background: t.selectedBg,
                            color: t.selectedText,
                            fontWeight: 500,
                          }}
                        >
                          Параметров: {paramsCount}
                        </span>
                      )}
                      {prod.is_hidden && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 2,
                            background: '#ef4444',
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          Скрыт
                        </span>
                      )}
                      {dirtyProductIds.includes(prod.id) && (
                        <span
                          data-testid={`unsaved-product-badge-${prod.id}`}
                          className="ui-unsaved-product-badge"
                          style={{
                            fontSize: 12,
                            padding: '2px 9px',
                            borderRadius: 2,
                            background: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF3C7',
                            border: '1px solid #F59E0B',
                            color: isDark ? '#FBBF24' : '#B45309',
                            fontWeight: 700,
                          }}
                        >
                          Есть несохраненные изменения
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        data-testid={`duplicate-product-btn-${prod.id}`}
                        onClick={(e) => void handleDuplicateProduct(prod, e)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: t.cardBg,
                          color: t.text,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        title="Создать копию этого товара со всеми бумагами, ламинациями и параметрами"
                      >
                        Копировать
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const mainId =
                            currentAdminCatObj?.parent_id ||
                            adminMainCategories[0]?.id ||
                            'polygraphy';
                          navigateTo(buildProductPath(mainId, prod.category, prod.id));
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: t.cardBg,
                          color: t.selectedText,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        title="Перейти на страницу этого товара"
                      >
                        Страница
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleQuickToggleProductHidden(prod, e)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 2,
                          border: `1px solid ${t.border}`,
                          background: prod.is_hidden ? '#16a34a' : t.cardBg,
                          color: prod.is_hidden ? '#fff' : t.text,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {prod.is_hidden ? 'Показать' : 'Скрыть'}
                      </button>
                      <span style={{ fontSize: 12, color: t.selectedText, fontWeight: 500 }}>
                        {isExpanded ? 'Свернуть' : 'Настроить'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: 16,
                        borderTop: `1px solid ${t.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      {/* БЛОК 1: КАРТИНКИ / ФОТОГРАФИИ ТОВАРА */}
                      <div
                        style={{
                          background: t.cardBg,
                          borderRadius: 3,
                          border: `1px solid ${t.softBorder}`,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          onClick={() => toggleProdSection(prod.id, 'images')}
                          style={{
                            padding: '11px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: isProdSectionOpen(prod.id, 'images')
                              ? t.tableHeaderBg
                              : 'transparent',
                          }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                          >
                            <span style={{ fontSize: 13, color: t.subText }}>
                              {isProdSectionOpen(prod.id, 'images') ? '▼' : '▶'}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                              Картинки / Фотографии этого товара ({prodImages.length} шт.)
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: t.selectedText, fontWeight: 500 }}>
                            {isProdSectionOpen(prod.id, 'images') ? 'Свернуть' : 'Развернуть'}
                          </span>
                        </div>

                        {isProdSectionOpen(prod.id, 'images') && (
                          <div style={{ padding: 14, borderTop: `1px solid ${t.softBorder}` }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 10,
                                marginBottom: 12,
                              }}
                            >
                              <div style={{ fontSize: 12, color: t.subText }}>
                                Можно загрузить файлы с компьютера или вставить прямую ссылку на
                                изображение
                              </div>

                              <label
                                style={{
                                  padding: '8px 14px',
                                  background: t.brandPrimary || 'var(--brand-primary)',
                                  color: '#fff',
                                  borderRadius: 2,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span>
                                  {uploadingProdId === prod.id
                                    ? 'Загрузка...'
                                    : 'Загрузить фото с компьютера'}
                                </span>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => void handleUploadProductFiles(prod, e.target.files)}
                                />
                              </label>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                marginBottom: prodImages.length > 0 ? 14 : 0,
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Или вставьте ссылку на картинку (https://...)"
                                value={imageUrlInputs[prod.id] || ''}
                                onChange={(e) =>
                                  setImageUrlInputs((prev) => ({
                                    ...prev,
                                    [prod.id]: e.target.value,
                                  }))
                                }
                                style={smallInputStyle}
                              />
                              <button
                                type="button"
                                onClick={() => void handleAddProductImageUrl(prod)}
                                style={{
                                  padding: '8px 14px',
                                  background: t.secondaryBtnBg,
                                  color: t.secondaryBtnText,
                                  border: `1px solid ${t.border}`,
                                  borderRadius: 2,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  fontSize: 13,
                                }}
                              >
                                + Добавить по ссылке
                              </button>
                            </div>

                            {prodImages.length > 0 && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
                                  gap: 12,
                                }}
                              >
                                {prodImages.map((imgUrl, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      border:
                                        idx === 0
                                          ? `2px solid ${t.selectedBorder}`
                                          : `1px solid ${t.border}`,
                                      borderRadius: 3,
                                      padding: 6,
                                      background: t.subCardBg,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                    }}
                                  >
                                    <div
                                      onClick={() => setLightboxUrl(imgUrl)}
                                      style={{
                                        width: '100%',
                                        height: 95,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        background: '#fff',
                                        cursor: 'zoom-in',
                                      }}
                                    >
                                      <img
                                        src={resolveImageUrl(imgUrl)}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    </div>

                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      {idx === 0 ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: t.selectedText,
                                          }}
                                        >
                                          ★ Главная
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => void handleMakeProductImageMain(prod, idx)}
                                          style={{
                                            fontSize: 11,
                                            padding: '3px 6px',
                                            borderRadius: 2,
                                            border: `1px solid ${t.border}`,
                                            background: t.cardBg,
                                            color: t.text,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Сделать главной
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => void handleRemoveProductImage(prod, idx)}
                                        style={{
                                          fontSize: 11,
                                          padding: '3px 7px',
                                          borderRadius: 2,
                                          border: 'none',
                                          background: '#ef4444',
                                          color: '#fff',
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* БЛОК 2: ОСНОВНЫЕ ПАРАМЕТРЫ И РАЗМЕРЫ ТОВАРА */}
                      <div
                        style={{
                          background: t.cardBg,
                          borderRadius: 3,
                          border: `1px solid ${t.softBorder}`,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          onClick={() => toggleProdSection(prod.id, 'basic')}
                          style={{
                            padding: '11px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: isProdSectionOpen(prod.id, 'basic')
                              ? t.tableHeaderBg
                              : 'transparent',
                          }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                          >
                            <span style={{ fontSize: 13, color: t.subText }}>
                              {isProdSectionOpen(prod.id, 'basic') ? '▼' : '▶'}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                              Основные параметры, размеры и авто-схема ({prod.width_mm} ×{' '}
                              {prod.height_mm} мм)
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: t.selectedText, fontWeight: 500 }}>
                            {isProdSectionOpen(prod.id, 'basic') ? 'Свернуть' : 'Развернуть'}
                          </span>
                        </div>

                        {isProdSectionOpen(prod.id, 'basic') && (
                          <div style={{ padding: 14, borderTop: `1px solid ${t.softBorder}` }}>
                            <datalist id={`prod-kinds-datalist-${prod.id}`}>
                              {existingKindsInAdminCategory.map((kName) => (
                                <option key={kName} value={kName} />
                              ))}
                            </datalist>
                            <div
                              className="ui-admin-prod-grid-1"
                              style={{
                                marginBottom: 12,
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Название продукта / формата:
                                </label>
                                <input
                                  type="text"
                                  value={prod.name}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, { name: e.target.value })
                                  }
                                  style={{ ...smallInputStyle, fontWeight: 600 }}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Вид изделия (группа в подкатегории):
                                </label>
                                <input
                                  type="text"
                                  list={`prod-kinds-datalist-${prod.id}`}
                                  placeholder="Без разделения на виды"
                                  value={prod.product_kind || ''}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, {
                                      product_kind: e.target.value,
                                    })
                                  }
                                  style={smallInputStyle}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Ширина (мм):
                                </label>
                                <input
                                  type="number"
                                  value={prod.width_mm}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, {
                                      width_mm: Number(e.target.value),
                                    })
                                  }
                                  style={smallInputStyle}
                                />
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Высота (мм):
                                </label>
                                <input
                                  type="number"
                                  value={prod.height_mm}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, {
                                      height_mm: Number(e.target.value),
                                    })
                                  }
                                  style={smallInputStyle}
                                />
                              </div>
                            </div>

                            <div className="ui-admin-prod-grid-2">
                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Режим страниц / листов:
                                </label>
                                <select
                                  value={prod.multi_page_mode}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, {
                                      multi_page_mode: e.target.value as MultiPageModeType,
                                    })
                                  }
                                  style={smallInputStyle}
                                >
                                  <option value="none">Одиночное изделие (1 лист)</option>
                                  <option value="sheets">Ввод кол-ва листов (календари)</option>
                                  <option value="pages">Ввод кол-ва полос (каталоги)</option>
                                </select>
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Листов/полос по умолч.:
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={prod.default_pages}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, {
                                      default_pages: Number(e.target.value),
                                    })
                                  }
                                  style={smallInputStyle}
                                />
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Доступная красочность:
                                </label>
                                <select
                                  value={prod.allowed_sides}
                                  onChange={(e) =>
                                    handleLocalProductChange(prod.id, {
                                      allowed_sides: e.target.value as AllowedSidesType,
                                    })
                                  }
                                  style={smallInputStyle}
                                >
                                  <option value="both">Односторонняя и двусторонняя</option>
                                  <option value="single_only">Только односторонняя (4+0)</option>
                                  <option value="duplex_only">Только двусторонняя (4+4)</option>
                                </select>
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: t.mutedText,
                                    marginBottom: 4,
                                  }}
                                >
                                  Вид авто-схемы (чертежа):
                                </label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <select
                                    value={prod.schematic_type || 'auto'}
                                    onChange={(e) =>
                                      handleLocalProductChange(prod.id, {
                                        schematic_type: e.target.value as SchematicType,
                                      })
                                    }
                                    style={{ ...smallInputStyle, flex: 1 }}
                                  >
                                    {(Object.keys(SCHEMATIC_TYPE_LABELS) as SchematicType[]).map(
                                      (st) => (
                                        <option key={st} value={st}>
                                          {SCHEMATIC_TYPE_LABELS[st]}
                                        </option>
                                      )
                                    )}
                                  </select>
                                  {resolveSchematicType(prod) === 'calendar_house' && (
                                    <input
                                      type="number"
                                      min={10}
                                      max={100}
                                      value={prod.base_mm ?? 35}
                                      onChange={(e) =>
                                        handleLocalProductChange(prod.id, {
                                          base_mm: Math.max(5, Number(e.target.value)),
                                        })
                                      }
                                      style={{ ...smallInputStyle, width: 74 }}
                                      title="Высота основания календаря-домика (мм), по умолчанию 35 мм"
                                      placeholder="Осн. мм"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* БЛОК 3: ПАРАМЕТРЫ ПОДСЧЕТА */}
                      <div>
                        <ProductCalcParamsEditor
                          prod={prod}
                          onChange={(changes) => handleLocalProductChange(prod.id, changes)}
                          onApplyToSubcategory={() => void handleApplyParamsToCategory(prod)}
                          subcategoryName={currentAdminCatObj?.name}
                          theme={t}
                          allItems={adminItems}
                        />
                      </div>

                      {/* БЛОК 4: БУМАГА И ЛАМИНАЦИЯ */}
                      <div
                        style={{
                          background: t.cardBg,
                          borderRadius: 3,
                          border: `1px solid ${t.softBorder}`,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          onClick={() => toggleProdSection(prod.id, 'materials')}
                          style={{
                            padding: '11px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                            cursor: 'pointer',
                            userSelect: 'none',
                            background: isProdSectionOpen(prod.id, 'materials')
                              ? t.tableHeaderBg
                              : 'transparent',
                          }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                          >
                            <span style={{ fontSize: 13, color: t.subText }}>
                              {isProdSectionOpen(prod.id, 'materials') ? '▼' : '▶'}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                              Доступная бумага и ламинация
                            </span>
                            <span
                              style={{
                                fontSize: 11.5,
                                padding: '2px 8px',
                                borderRadius: 2,
                                background: t.subCardBg,
                                border: `1px solid ${t.border}`,
                                color: t.subText,
                                fontWeight: 600,
                              }}
                            >
                              Бумага: {prod.allowed_paper_ids.length} • Ламинация:{' '}
                              {prod.allowed_lamination_ids.length}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: t.selectedText, fontWeight: 500 }}>
                            {isProdSectionOpen(prod.id, 'materials') ? 'Свернуть' : 'Развернуть'}
                          </span>
                        </div>

                        {isProdSectionOpen(prod.id, 'materials') && (
                          <div style={{ padding: 14, borderTop: `1px solid ${t.softBorder}` }}>
                            <AdminMaterialMatrix
                              prod={prod}
                              allItems={adminItems}
                              categoryName={currentAdminCatObj?.name || ''}
                              onUpdateAllowed={(paperIds, lamIds, coverPaperIds) =>
                                handleLocalProductChange(prod.id, {
                                  allowed_paper_ids: paperIds,
                                  allowed_lamination_ids: lamIds,
                                  ...(coverPaperIds ? { allowed_cover_paper_ids: coverPaperIds } : {}),
                                })
                              }
                              onApplyToEntireCategory={(paperIds, lamIds, coverPaperIds) =>
                                void handleApplyMaterialsToCategory(
                                  prod.category,
                                  paperIds,
                                  lamIds,
                                  coverPaperIds
                                )
                              }
                              theme={t}
                            />
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 10,
                          marginTop: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        {dirtyProductIds.includes(prod.id) && (
                          <span
                            data-testid={`unsaved-footer-badge-${prod.id}`}
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 2,
                              background: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF3C7',
                              border: '1px solid #F59E0B',
                              color: isDark ? '#FBBF24' : '#B45309',
                              fontWeight: 700,
                            }}
                          >
                            ● Есть несохраненные изменения
                          </span>
                        )}
                        <button
                          type="button"
                          data-testid={`save-product-btn-${prod.id}`}
                          onClick={() => void handleSaveProduct(prod)}
                          style={{
                            padding: dirtyProductIds.includes(prod.id) ? '7px 14px' : '5px 10px',
                            fontSize: 12.5,
                            background: dirtyProductIds.includes(prod.id) ? '#15803d' : '#16a34a',
                            color: '#fff',
                            border: dirtyProductIds.includes(prod.id)
                              ? '2px solid #4ade80'
                              : 'none',
                            borderRadius: 2,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: 'none',
                            transition: 'all 0.18s ease',
                          }}
                        >
                          Сохранить изменения продукта
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProduct(prod.id)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 2,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Удалить продукт
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
