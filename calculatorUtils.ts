import {
  BlockPrintModeType,
  CalculationResult,
  CatalogItemPublic,
  CoverPrintModeType,
  EstimateHeaderMeta,
  EstimateItem,
  MarkupTier,
  ProductCostParam,
  ProductItem,
} from './types';

export const STANDARD_QUICK_TIERS: readonly number[] = [50, 100, 250, 500, 1000, 2500];
export const POLYGRAPHY_UNIT_TIERS: readonly number[] = [1, 5, 10, 25, 50, 100, 250];
export const WIDE_FORMAT_TIERS: readonly number[] = [1, 2, 5, 10, 25, 50];
export const SOUVENIRS_TIERS: readonly number[] = [1, 5, 10, 25, 50, 100];
export const STAMPS_TIERS: readonly number[] = [1, 2, 3, 5, 10, 25];
export const DESIGN_TIERS: readonly number[] = [1, 2, 3, 5, 10];

const POLYGRAPHY_UNIT_CATEGORIES = new Set<string>([
  'calendars',
  'catalogs',
  'notepads',
  'planners',
  'menus',
  'card_decks',
  'stickers_3d',
]);

export function isWideFormatSectionOrCategory(
  mainCategoryId?: string,
  categoryId?: string
): boolean {
  const mainCat = (mainCategoryId || '').trim().toLowerCase();
  const cat = (categoryId || '').trim().toLowerCase();
  return mainCat === 'wide_format' || cat.startsWith('wf_');
}

export function mmToCm(mm: number): number {
  if (!Number.isFinite(mm)) return 0;
  return Math.round((mm / 10) * 100) / 100;
}

export function cmToMm(cm: number): number {
  if (!Number.isFinite(cm)) return 0;
  return Math.round(cm * 10 * 100) / 100;
}

export function formatMmAsCm(mm: number): string {
  return String(mmToCm(mm));
}

export function formatDimensionsTextInCm(text: string): string {
  if (!text) return '';
  return text.replace(
    /(\d+(?:[.,]\d+)?)\s*[×xх*]\s*(\d+(?:[.,]\d+)?)\s*мм/gi,
    (_match, rawW: string, rawH: string) => {
      const wMm = Number(rawW.replace(',', '.'));
      const hMm = Number(rawH.replace(',', '.'));
      if (!Number.isFinite(wMm) || !Number.isFinite(hMm)) {
        return _match;
      }
      return `${formatMmAsCm(wMm)} × ${formatMmAsCm(hMm)} см`;
    }
  );
}

export type EyeletSpacingOptionId = '15' | '20' | '25' | '30' | '50' | 'corners';

export interface EyeletSpacingOption {
  id: EyeletSpacingOptionId;
  label: string;
  stepCm: number | null;
}

export const DEFAULT_EYELET_SPACING: EyeletSpacingOptionId = '30';

export const EYELET_SPACING_OPTIONS: readonly EyeletSpacingOption[] = [
  { id: '15', label: '15 см', stepCm: 15 },
  { id: '20', label: '20 см', stepCm: 20 },
  { id: '25', label: '25 см', stepCm: 25 },
  { id: '30', label: '30 см', stepCm: 30 },
  { id: '50', label: '50 см', stepCm: 50 },
  { id: 'corners', label: 'По углам', stepCm: null },
];

export function isEyeletCostParam(
  cp: Pick<ProductCostParam, 'id' | 'name' | 'input_type'>,
  mainCategoryId?: string,
  categoryId?: string
): boolean {
  if (!isWideFormatSectionOrCategory(mainCategoryId, categoryId)) {
    return false;
  }
  const inputType = cp.input_type || 'checkbox';
  if (inputType !== 'checkbox') {
    return false;
  }
  const pid = (cp.id || '').trim().toLowerCase();
  const pname = (cp.name || '').trim().toLowerCase();
  return pid === 'eyelets' || pid === 'wf_eyelets' || pname.includes('люверс');
}

export function resolveEyeletSpacing(
  selectedParams?: Record<string, string | number | boolean>
): EyeletSpacingOptionId {
  const raw = selectedParams?.eyelets_step;
  if (raw === undefined || raw === null) {
    return DEFAULT_EYELET_SPACING;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'corners' || normalized === 'по углам') {
    return 'corners';
  }
  if (
    normalized === '15' ||
    normalized === '20' ||
    normalized === '25' ||
    normalized === '30' ||
    normalized === '50'
  ) {
    return normalized;
  }
  return DEFAULT_EYELET_SPACING;
}

export function computeEyeletsCountPerUnit(
  widthMm: number,
  heightMm: number,
  spacing: EyeletSpacingOptionId
): number {
  if (spacing === 'corners') {
    return 4;
  }
  const stepMm = Math.max(10, Number(spacing) * 10);
  const perimeterMm = 2 * (Math.max(1, widthMm) + Math.max(1, heightMm));
  return Math.max(4, Math.ceil(perimeterMm / stepMm));
}

export function formatEyeletParamLabel(
  baseName: string,
  spacing: EyeletSpacingOptionId
): string {
  const cleanedBase =
    (baseName || 'Установка люверсов')
      .replace(/\s+по\s+периметру\s*$/i, '')
      .trim() || 'Установка люверсов';
  if (spacing === 'corners') {
    return `${cleanedBase} (по углам)`;
  }
  return `${cleanedBase} (шаг ${spacing} см)`;
}

export type BannerMarginOptionId = '5' | '10' | '15' | '20';

export interface BannerMarginOption {
  id: BannerMarginOptionId;
  label: string;
  marginCm: number;
}

export const MAX_WIDE_FORMAT_PRINT_WIDTH_MM = 3000;
export const BANNER_LARGE_THRESHOLD_MM = 3000;

export interface WideFormatStripBreakdown {
  hasSeams: boolean;
  orientation: 'vertical' | 'horizontal' | null;
  stripsCount: number;
  seamsCount: number;
  stripSizesMm: number[];
  stripSizesCm: number[];
  splitDimMm: number;
}

export function computeWideFormatStripBreakdown(
  widthMm: number,
  heightMm: number,
  maxPrintWidthMm: number = MAX_WIDE_FORMAT_PRINT_WIDTH_MM
): WideFormatStripBreakdown {
  const safeW = Math.max(1, widthMm);
  const safeH = Math.max(1, heightMm);
  const capMm = Math.max(100, maxPrintWidthMm);

  if (safeW <= capMm || safeH <= capMm) {
    const minDimMm = Math.min(safeW, safeH);
    return {
      hasSeams: false,
      orientation: null,
      stripsCount: 1,
      seamsCount: 0,
      stripSizesMm: [minDimMm],
      stripSizesCm: [mmToCm(minDimMm)],
      splitDimMm: minDimMm,
    };
  }

  const cols = Math.ceil(safeW / capMm);
  const rows = Math.ceil(safeH / capMm);
  const rollFeedV = cols * safeH;
  const rollFeedH = rows * safeW;

  const chooseVertical =
    rollFeedV < rollFeedH ||
    (rollFeedV === rollFeedH && (cols < rows || (cols === rows && safeH <= safeW)));

  const orientation: 'vertical' | 'horizontal' = chooseVertical ? 'vertical' : 'horizontal';
  const splitDimMm = chooseVertical ? safeW : safeH;

  const fullStrips = Math.floor(splitDimMm / capMm);
  const remainderMm = Math.round((splitDimMm - fullStrips * capMm) * 100) / 100;
  const stripSizesMm: number[] = [];
  for (let i = 0; i < fullStrips; i += 1) {
    stripSizesMm.push(capMm);
  }
  if (remainderMm > 0.01) {
    stripSizesMm.push(remainderMm);
  }

  const stripSizesCm = stripSizesMm.map((mm) => mmToCm(mm));
  const stripsCount = stripSizesMm.length;
  const seamsCount = Math.max(0, stripsCount - 1);

  return {
    hasSeams: seamsCount > 0,
    orientation,
    stripsCount,
    seamsCount,
    stripSizesMm,
    stripSizesCm,
    splitDimMm,
  };
}

export function formatWideFormatStripsBreakdown(
  stripSizesCm: readonly number[],
  maxPrintWidthCm = 300
): string {
  if (stripSizesCm.length <= 1) return '';
  if (stripSizesCm.length <= 3) {
    return `${stripSizesCm.join(' + ')} см`;
  }
  const fullCount = stripSizesCm.filter((v) => Math.abs(v - maxPrintWidthCm) < 0.01).length;
  const lastCm = stripSizesCm[stripSizesCm.length - 1];
  if (fullCount === stripSizesCm.length) {
    return `${fullCount}×${maxPrintWidthCm} см`;
  }
  if (fullCount === stripSizesCm.length - 1) {
    return `${fullCount}×${maxPrintWidthCm} + ${lastCm} см`;
  }
  return `${stripSizesCm.join(' + ')} см`;
}

export const BANNER_MARGIN_OPTIONS: readonly BannerMarginOption[] = [
  { id: '5', label: '5 см', marginCm: 5 },
  { id: '10', label: '10 см', marginCm: 10 },
  { id: '15', label: '15 см', marginCm: 15 },
  { id: '20', label: '20 см', marginCm: 20 },
];

export function isBannerProduct(
  prod: Pick<ProductItem, 'category' | 'name' | 'schematic_type'>,
  mainCategoryId?: string
): boolean {
  if (!isWideFormatSectionOrCategory(mainCategoryId, prod.category)) {
    return false;
  }
  const cat = (prod.category || '').trim().toLowerCase();
  const name = (prod.name || '').trim().toLowerCase();
  const schematic = String(prod.schematic_type || '').trim().toLowerCase();
  return (
    cat === 'wf_banners_cat' ||
    schematic === 'banner' ||
    name.includes('баннер') ||
    name.includes('растяжк')
  );
}

export function getDefaultBannerMarginCm(
  widthMm: number,
  heightMm: number
): BannerMarginOptionId {
  const safeW = Number.isFinite(widthMm) ? widthMm : 0;
  const safeH = Number.isFinite(heightMm) ? heightMm : 0;
  return Math.max(safeW, safeH) > BANNER_LARGE_THRESHOLD_MM ? '10' : '5';
}

export function resolveBannerMarginCm(
  selectedParams?: Record<string, string | number | boolean>,
  widthMm = 2000,
  heightMm = 1000
): BannerMarginOptionId {
  const raw = selectedParams?.banner_margin_cm;
  if (raw !== undefined && raw !== null) {
    const normalized = String(raw).trim();
    if (
      normalized === '5' ||
      normalized === '10' ||
      normalized === '15' ||
      normalized === '20'
    ) {
      return normalized;
    }
  }
  return getDefaultBannerMarginCm(widthMm, heightMm);
}

export function getQuickQuantityTiers(
  category?: string,
  customTiers?: ReadonlyArray<MarkupTier | number>,
  mainCategoryId?: string
): number[] {
  const cat = (category || '').trim().toLowerCase();
  const mainCat = (mainCategoryId || '').trim().toLowerCase();
  const isUnitCategory =
    mainCat === 'wide_format' ||
    mainCat === 'souvenirs' ||
    mainCat === 'stamps' ||
    mainCat === 'design' ||
    cat.startsWith('wf_') ||
    cat.startsWith('souv_') ||
    cat.startsWith('stamps_') ||
    cat.startsWith('design_') ||
    POLYGRAPHY_UNIT_CATEGORIES.has(cat);

  if (Array.isArray(customTiers) && customTiers.length > 0) {
    const minAllowed = isUnitCategory ? 1 : 2;
    const minRequiredCount = isUnitCategory ? 3 : 4;
    const valid = Array.from(
      new Set(
        customTiers
          .map((t) =>
            typeof t === 'number'
              ? Math.round(Number(t))
              : Math.round(Number((t as MarkupTier).min_qty))
          )
          .filter((n) => Number.isFinite(n) && n >= minAllowed)
      )
    ).sort((a, b) => a - b);

    if (valid.length >= minRequiredCount) {
      return valid.slice(0, 8);
    }
  }

  if (mainCat === 'wide_format' || cat.startsWith('wf_')) {
    return [...WIDE_FORMAT_TIERS];
  }
  if (mainCat === 'souvenirs' || cat.startsWith('souv_')) {
    return [...SOUVENIRS_TIERS];
  }
  if (mainCat === 'stamps' || cat.startsWith('stamps_')) {
    return [...STAMPS_TIERS];
  }
  if (mainCat === 'design' || cat.startsWith('design_')) {
    return [...DESIGN_TIERS];
  }
  if (POLYGRAPHY_UNIT_CATEGORIES.has(cat)) {
    return [...POLYGRAPHY_UNIT_TIERS];
  }

  return [...STANDARD_QUICK_TIERS];
}

export interface MaterialFieldMeta {
  label: string;
  placeholder: string;
  quoteTitle: string;
}

export function getMaterialFieldMeta(mainCategoryId?: string): MaterialFieldMeta {
  switch ((mainCategoryId || '').trim().toLowerCase()) {
    case 'wide_format':
      return {
        label: 'Материал (баннер / плёнка / холст)',
        placeholder: 'Выберите материал...',
        quoteTitle: 'Материал',
      };
    case 'souvenirs':
      return {
        label: 'Заготовка / Изделие',
        placeholder: 'Выберите заготовку...',
        quoteTitle: 'Заготовка',
      };
    case 'stamps':
      return {
        label: 'Оснастка',
        placeholder: 'Выберите оснастку...',
        quoteTitle: 'Оснастка',
      };
    case 'polygraphy':
      return {
        label: 'Бумага',
        placeholder: 'Выберите бумагу...',
        quoteTitle: 'Бумага',
      };
    default:
      return {
        label: 'Бумага',
        placeholder: 'Выберите бумагу...',
        quoteTitle: 'Бумага/Материал',
      };
  }
}

export interface PagesStepConfig {
  step: number;
  min: number;
  isStaple: boolean;
}

export function getPagesStepAndMin(
  multiPageMode: string,
  bindingType: string
): PagesStepConfig {
  if (multiPageMode !== 'pages') {
    return { step: 1, min: 1, isStaple: false };
  }
  const isStaple = bindingType === 'staple';
  if (isStaple) {
    return { step: 4, min: 8, isStaple: true };
  }
  return { step: 2, min: 4, isStaple: false };
}

export function normalizePagesForBinding(
  rawPages: number,
  multiPageMode: string,
  bindingType: string
): { normalized: number; wasAdjusted: boolean } {
  const safeVal = Number.isFinite(rawPages) ? Math.max(1, Math.round(rawPages)) : 1;
  const { step, min, isStaple } = getPagesStepAndMin(multiPageMode, bindingType);

  if (multiPageMode !== 'pages') {
    return { normalized: safeVal, wasAdjusted: safeVal !== rawPages };
  }

  if (isStaple) {
    const clamped = Math.max(min, safeVal);
    const rem = clamped % step;
    const normalized = rem === 0 ? clamped : clamped + (step - rem);
    return {
      normalized,
      wasAdjusted: normalized !== safeVal,
    };
  }

  const clamped = Math.max(min, safeVal);
  const rem = clamped % step;
  const normalized = rem === 0 ? clamped : clamped + (step - rem);
  return {
    normalized,
    wasAdjusted: normalized !== safeVal,
  };
}

export interface Sra3PlacedRect {
  index: number;
  col: number;
  row: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  trimXMm: number;
  trimYMm: number;
  trimWidthMm: number;
  trimHeightMm: number;
}

export interface Sra3LayoutResult {
  sra3WidthMm: number;
  sra3HeightMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  usableOffsetXMm: number;
  usableOffsetYMm: number;
  bleedMm: number;
  itemWidthMm: number;
  itemHeightMm: number;
  cellWidthMm: number;
  cellHeightMm: number;
  cols: number;
  rows: number;
  itemsPerSheet: number;
  rotated: boolean;
  oversized: boolean;
  usedWidthMm: number;
  usedHeightMm: number;
  utilizationPercent: number;
  rects: Sra3PlacedRect[];
}

export function computeSra3Layout(
  widthMm: number,
  heightMm: number,
  options?: {
    sra3WidthMm?: number;
    sra3HeightMm?: number;
    usableWidthMm?: number;
    usableHeightMm?: number;
    bleedMm?: number;
  }
): Sra3LayoutResult {
  const sra3WidthMm = Math.max(50, Number(options?.sra3WidthMm) || 320);
  const sra3HeightMm = Math.max(50, Number(options?.sra3HeightMm) || 450);
  const usableWidthMm = Math.min(
    sra3WidthMm,
    Math.max(10, Number(options?.usableWidthMm) || 310)
  );
  const usableHeightMm = Math.min(
    sra3HeightMm,
    Math.max(10, Number(options?.usableHeightMm) || 440)
  );
  const bleedMm = Math.max(0, Number(options?.bleedMm ?? 4));

  const safeW = Math.max(1, Number(widthMm) || 90);
  const safeH = Math.max(1, Number(heightMm) || 50);

  const usableOffsetXMm = (sra3WidthMm - usableWidthMm) / 2;
  const usableOffsetYMm = (sra3HeightMm - usableHeightMm) / 2;

  const itemWWithBleed = safeW + bleedMm;
  const itemHWithBleed = safeH + bleedMm;

  const cols1 = Math.floor(usableWidthMm / itemWWithBleed);
  const rows1 = Math.floor(usableHeightMm / itemHWithBleed);
  const fit1 = cols1 * rows1;

  const cols2 = Math.floor(usableWidthMm / itemHWithBleed);
  const rows2 = Math.floor(usableHeightMm / itemWWithBleed);
  const fit2 = cols2 * rows2;

  let cols = cols1;
  let rows = rows1;
  let rotated = false;
  let cellWidthMm = itemWWithBleed;
  let cellHeightMm = itemHWithBleed;
  let trimWidthMm = safeW;
  let trimHeightMm = safeH;
  let effectiveBleed = bleedMm;
  let oversized = false;

  if (fit2 > fit1) {
    cols = cols2;
    rows = rows2;
    rotated = true;
    cellWidthMm = itemHWithBleed;
    cellHeightMm = itemWWithBleed;
    trimWidthMm = safeH;
    trimHeightMm = safeW;
  }

  if (Math.max(fit1, fit2) < 1) {
    const fullCols1 = Math.floor(sra3WidthMm / safeW);
    const fullRows1 = Math.floor(sra3HeightMm / safeH);
    const fullFit1 = fullCols1 * fullRows1;

    const fullCols2 = Math.floor(sra3WidthMm / safeH);
    const fullRows2 = Math.floor(sra3HeightMm / safeW);
    const fullFit2 = fullCols2 * fullRows2;

    if (Math.max(fullFit1, fullFit2) >= 1) {
      effectiveBleed = 0;
      if (fullFit2 > fullFit1) {
        cols = fullCols2;
        rows = fullRows2;
        rotated = true;
        cellWidthMm = safeH;
        cellHeightMm = safeW;
        trimWidthMm = safeH;
        trimHeightMm = safeW;
      } else {
        cols = fullCols1;
        rows = fullRows1;
        rotated = false;
        cellWidthMm = safeW;
        cellHeightMm = safeH;
        trimWidthMm = safeW;
        trimHeightMm = safeH;
      }
    } else {
      oversized = true;
      cols = 1;
      rows = 1;
      rotated = safeW > safeH && sra3WidthMm < sra3HeightMm;
      cellWidthMm = Math.min(usableWidthMm, rotated ? safeH : safeW);
      cellHeightMm = Math.min(usableHeightMm, rotated ? safeW : safeH);
      trimWidthMm = cellWidthMm;
      trimHeightMm = cellHeightMm;
      effectiveBleed = 0;
    }
  }

  const itemsPerSheet = Math.max(1, cols * rows);
  const usedWidthMm = cols * cellWidthMm;
  const usedHeightMm = rows * cellHeightMm;

  const startXMm = usableOffsetXMm + Math.max(0, (usableWidthMm - usedWidthMm) / 2);
  const startYMm = usableOffsetYMm + Math.max(0, (usableHeightMm - usedHeightMm) / 2);

  const rects: Sra3PlacedRect[] = [];
  const halfBleed = effectiveBleed / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xMm = startXMm + c * cellWidthMm;
      const yMm = startYMm + r * cellHeightMm;
      rects.push({
        index: r * cols + c,
        col: c,
        row: r,
        xMm,
        yMm,
        widthMm: cellWidthMm,
        heightMm: cellHeightMm,
        trimXMm: xMm + halfBleed,
        trimYMm: yMm + halfBleed,
        trimWidthMm,
        trimHeightMm,
      });
    }
  }

  const totalItemArea = itemsPerSheet * (cellWidthMm * cellHeightMm);
  const sheetArea = usableWidthMm * usableHeightMm;
  const utilizationPercent = Math.min(
    100,
    Math.round((totalItemArea / Math.max(1, sheetArea)) * 100)
  );

  return {
    sra3WidthMm,
    sra3HeightMm,
    usableWidthMm,
    usableHeightMm,
    usableOffsetXMm,
    usableOffsetYMm,
    bleedMm: effectiveBleed,
    itemWidthMm: safeW,
    itemHeightMm: safeH,
    cellWidthMm,
    cellHeightMm,
    cols,
    rows,
    itemsPerSheet,
    rotated,
    oversized,
    usedWidthMm,
    usedHeightMm,
    utilizationPercent,
    rects,
  };
}

export interface BuildEstimateDraftArgs {
  mainCategoryId?: string;
  categoryName?: string;
  currentProduct: ProductItem;
  adminCurrentProd?: ProductItem;
  effectiveW: number;
  effectiveH: number;
  pagesCount: number;
  quantity: number;
  selectedPaperId: number;
  selectedCoverPaperId: number;
  allowedPapers: CatalogItemPublic[];
  allowedCoverPapers: CatalogItemPublic[];
  printSides: number;
  blockPrintMode: BlockPrintModeType;
  coverPrintMode: CoverPrintModeType;
  laminationSides: number;
  selectedLaminationId: number | null;
  allowedLaminations: CatalogItemPublic[];
  selectedClientParams: Record<string, string | number | boolean>;
  calcResult: CalculationResult | null;
}

export function buildEstimateDraftFromSelection(
  args: BuildEstimateDraftArgs
): Omit<EstimateItem, 'id' | 'createdAt'> {
  const {
    mainCategoryId,
    categoryName,
    currentProduct,
    adminCurrentProd,
    effectiveW,
    effectiveH,
    pagesCount,
    quantity,
    selectedPaperId,
    selectedCoverPaperId,
    allowedPapers,
    allowedCoverPapers,
    printSides,
    blockPrintMode,
    coverPrintMode,
    laminationSides,
    selectedLaminationId,
    allowedLaminations,
    selectedClientParams,
    calcResult,
  } = args;

  const prodCfg = adminCurrentProd || currentProduct;
  const hasCoverBlock = Boolean(
    prodCfg.has_cover_block ??
      (currentProduct.category === 'catalogs' || currentProduct.multi_page_mode === 'pages')
  );

  const isWideFormat = isWideFormatSectionOrCategory(mainCategoryId, currentProduct.category);
  const formatLabel = isWideFormat
    ? `${formatMmAsCm(effectiveW)} × ${formatMmAsCm(effectiveH)} см`
    : `${effectiveW} × ${effectiveH} мм`;
  const showPaper = prodCfg.show_paper_select !== false;
  const showPrint = prodCfg.show_print_sides !== false;
  const showLamination =
    prodCfg.show_lamination_select !== false && allowedLaminations.length > 0;

  // Бумага / Материал / Заготовка / Оснастка
  let paperLabel = '';
  if (showPaper) {
    const mainPaper = allowedPapers.find((p) => p.id === selectedPaperId);
    if (hasCoverBlock) {
      const covPaper =
        allowedCoverPapers.find((p) => p.id === (selectedCoverPaperId || selectedPaperId)) ||
        mainPaper;
      paperLabel = `Блок: ${mainPaper?.name || 'Не выбрана'} / Обложка: ${
        covPaper?.name || 'Не выбрана'
      }`;
    } else if (mainPaper) {
      paperLabel = mainPaper.name;
    } else {
      paperLabel = 'Стандартный материал';
    }
  }

  // Печать / Нанесение
  let printLabel = '';
  if (showPrint) {
    if (hasCoverBlock) {
      printLabel = `Блок ${blockPrintMode}, Обложка ${coverPrintMode}`;
    } else {
      const sides =
        currentProduct.allowed_sides === 'single_only'
          ? 1
          : currentProduct.allowed_sides === 'duplex_only' ||
            currentProduct.multi_page_mode === 'pages'
          ? 2
          : printSides === 2
          ? 2
          : 1;
      if (mainCategoryId === 'souvenirs') {
        printLabel = sides === 2 ? 'С двух сторон (1+1)' : 'С одной стороны (1+0)';
      } else {
        printLabel = sides === 2 ? 'Двусторонняя (4+4)' : 'Односторонняя (4+0)';
      }
    }
  }

  // Ламинация
  let laminationLabel = '';
  if (showLamination) {
    if (laminationSides > 0) {
      const lamObj = allowedLaminations.find((l) => l.id === selectedLaminationId);
      const sidesText = laminationSides === 2 ? 'Двусторонняя (1+1)' : 'Односторонняя (1+0)';
      laminationLabel = lamObj ? `${sidesText}, ${lamObj.name}` : sidesText;
    } else {
      laminationLabel = 'Нет';
    }
  }

  // Страницы / Листы
  let pagesLabel: string | undefined;
  if (currentProduct.multi_page_mode === 'pages') {
    pagesLabel = `${pagesCount} стр. (полос)`;
  } else if (currentProduct.multi_page_mode === 'sheets') {
    pagesLabel =
      currentProduct.category === 'card_decks'
        ? `${pagesCount} карт`
        : `${pagesCount} л.`;
  }

  // Доп. работы (клиентские параметры)
  const activeCostParams: ProductCostParam[] =
    prodCfg.cost_params || currentProduct.cost_params || [];
  const clientFacingParams = activeCostParams.filter(
    (cp) => cp.is_client_facing && cp.is_enabled !== false
  );
  const extraParts: string[] = [];

  if (
    isBannerProduct(currentProduct, mainCategoryId) &&
    selectedClientParams.banner_margin_cm !== undefined
  ) {
    const marginCm = resolveBannerMarginCm(selectedClientParams, effectiveW, effectiveH);
    extraParts.push(`Поля: ${marginCm} см`);
  }

  for (const cp of clientFacingParams) {
    const inputType = cp.input_type || 'checkbox';
    const rawVal = selectedClientParams[cp.id];
    if (inputType === 'select') {
      const opts = cp.options || [];
      const selectedOptId = rawVal !== undefined ? String(rawVal) : opts[0]?.id || '';
      const chosen = opts.find((o) => o.id === selectedOptId) || opts[0];
      if (chosen) {
        extraParts.push(`${cp.name}: ${chosen.label}`);
      }
    } else if (inputType === 'number') {
      const numVal = rawVal !== undefined ? Number(rawVal) : 0;
      if (numVal > 0) {
        extraParts.push(`${cp.name}: ${numVal}`);
      }
    } else {
      if (Boolean(rawVal)) {
        if (isEyeletCostParam(cp, mainCategoryId, currentProduct.category)) {
          extraParts.push(
            formatEyeletParamLabel(cp.name, resolveEyeletSpacing(selectedClientParams))
          );
        } else {
          extraParts.push(cp.name);
        }
      }
    }
  }

  const extraParamsLabel = extraParts.length > 0 ? extraParts.join('; ') : 'Нет';
  const safeQty = calcResult ? calcResult.quantity : Math.max(1, quantity);
  const unitPrice = calcResult ? Math.round(calcResult.unit_price) : 0;
  const totalPrice = calcResult ? Math.round(calcResult.client_price) : 0;

  const layout = computeSra3Layout(effectiveW, effectiveH);
  const itemsPerSheet =
    calcResult?.internal?.items_per_sheet || Math.max(1, layout.itemsPerSheet);
  const sheetsPerUnit =
    currentProduct.multi_page_mode === 'pages'
      ? Math.max(1, Math.ceil(pagesCount / 2))
      : currentProduct.multi_page_mode === 'sheets'
      ? Math.max(1, pagesCount)
      : 1;
  const sheetsNeeded =
    calcResult?.internal?.sheets_needed ||
    Math.max(1, Math.ceil((safeQty * sheetsPerUnit) / itemsPerSheet));

  return {
    productId: currentProduct.id,
    paperId: selectedPaperId,
    coverPaperId: selectedCoverPaperId || selectedPaperId,
    printSides,
    blockPrintMode,
    coverPrintMode,
    laminationId: laminationSides > 0 ? selectedLaminationId : null,
    laminationSides,
    widthMm: effectiveW,
    heightMm: effectiveH,
    pagesCount,
    selectedParams: { ...selectedClientParams },
    sheetsNeeded,
    itemsPerSheet,
    sheets_needed: sheetsNeeded,
    items_per_sheet: itemsPerSheet,
    mainCategoryId,
    categoryName: categoryName || '',
    productName: isWideFormat
      ? formatDimensionsTextInCm(currentProduct.name)
      : currentProduct.name,
    formatLabel,
    paperLabel,
    printLabel,
    laminationLabel,
    pagesLabel,
    extraParamsLabel,
    showPaper,
    showPrint,
    showLamination,
    quantity: safeQty,
    unitPrice,
    totalPrice,
  };
}

export function formatSingleQuoteText(
  item: Omit<EstimateItem, 'id' | 'createdAt'>
): string {
  const title = item.categoryName
    ? `${item.categoryName} — ${item.productName}`
    : item.productName;
  const lines: string[] = [
    '📋 Расчёт стоимости заказа',
    `• Изделие: ${title}`,
    `• Формат: ${item.formatLabel}`,
  ];
  if (item.pagesLabel) {
    lines.push(`• Объём блока: ${item.pagesLabel}`);
  }

  const matMeta = getMaterialFieldMeta(item.mainCategoryId);
  if (
    item.showPaper !== false &&
    item.paperLabel &&
    item.paperLabel !== 'По спецификации изделия'
  ) {
    lines.push(`• ${matMeta.quoteTitle}: ${item.paperLabel}`);
  }

  if (item.showPrint !== false && item.printLabel && item.printLabel !== 'Без печати') {
    const printTitle = item.mainCategoryId === 'souvenirs' ? 'Нанесение принта' : 'Печать';
    lines.push(`• ${printTitle}: ${item.printLabel}`);
  }

  if (item.showLamination !== false && item.laminationLabel) {
    lines.push(`• Ламинация: ${item.laminationLabel}`);
  }

  if (item.extraParamsLabel && (item.extraParamsLabel !== 'Нет' || item.showPaper !== false)) {
    lines.push(`• Доп. работы: ${item.extraParamsLabel || 'Нет'}`);
  }

  lines.push(
    `• Тираж: ${item.quantity.toLocaleString('ru-RU')} шт.`,
    `• Цена за шт.: ${item.unitPrice.toLocaleString('ru-RU')} ₽/шт.`,
    `💰 Итоговая стоимость: ${item.totalPrice.toLocaleString('ru-RU')} ₽`
  );
  return lines.join('\n');
}

export interface EstimatePricingSummary {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  finalTotal: number;
}

export function calculateEstimatePricing(
  items: EstimateItem[],
  discountPercent?: number
): EstimatePricingSummary {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
  const rawPct = Number(discountPercent) || 0;
  const clampedPct = Math.max(0, Math.min(100, rawPct));
  const discountAmount = Math.round((subtotal * clampedPct) / 100);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  return {
    subtotal,
    discountPercent: clampedPct,
    discountAmount,
    finalTotal,
  };
}

export function calculateEstimateTotal(items: EstimateItem[], discountPercent?: number): number {
  return calculateEstimatePricing(items, discountPercent).finalTotal;
}

export function formatFullEstimateText(
  items: EstimateItem[],
  meta?: EstimateHeaderMeta,
  shareUrl?: string
): string {
  if (items.length === 0) {
    return 'Коммерческое предложение (смета пуста)';
  }

  const blocks: string[] = ['📄 КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ'];
  const customer = (meta?.customerName || '').trim();
  const comment = (meta?.comment || '').trim();
  if (customer) {
    blocks.push(`Заказчик: ${customer}`);
  }
  if (comment) {
    blocks.push(`Условия / комментарий: ${comment}`);
  }
  blocks.push('');

  items.forEach((item, idx) => {
    const title = item.categoryName
      ? `${item.categoryName} — ${item.productName}`
      : item.productName;
    const matMeta = getMaterialFieldMeta(item.mainCategoryId);
    blocks.push(`${idx + 1}. ${title}`);
    if (item.customNote && item.customNote.trim()) {
      blocks.push(`   • Примечание: ${item.customNote.trim()}`);
    }
    blocks.push(`   • Формат: ${item.formatLabel}${item.pagesLabel ? ` (${item.pagesLabel})` : ''}`);
    if (
      item.showPaper !== false &&
      item.paperLabel &&
      item.paperLabel !== 'По спецификации изделия'
    ) {
      blocks.push(`   • ${matMeta.quoteTitle}: ${item.paperLabel}`);
    }
    if (item.showPrint !== false && item.printLabel && item.printLabel !== 'Без печати') {
      const printTitle = item.mainCategoryId === 'souvenirs' ? 'Нанесение принта' : 'Печать';
      blocks.push(`   • ${printTitle}: ${item.printLabel}`);
    }
    if (
      item.showLamination !== false &&
      item.laminationLabel &&
      item.laminationLabel !== 'Нет'
    ) {
      blocks.push(`   • Ламинация: ${item.laminationLabel}`);
    }
    if (item.extraParamsLabel && item.extraParamsLabel !== 'Нет') {
      blocks.push(`   • Доп. работы: ${item.extraParamsLabel}`);
    }
    blocks.push(
      `   • Тираж: ${item.quantity.toLocaleString('ru-RU')} шт. × ${item.unitPrice.toLocaleString('ru-RU')} ₽/шт. = ${item.totalPrice.toLocaleString('ru-RU')} ₽`
    );
    blocks.push('');
  });

  const pricing = calculateEstimatePricing(items, meta?.discountPercent);
  if (pricing.discountPercent > 0) {
    blocks.push(`Сумма без скидки: ${pricing.subtotal.toLocaleString('ru-RU')} ₽`);
    blocks.push(
      `Скидка (${pricing.discountPercent}%): −${pricing.discountAmount.toLocaleString('ru-RU')} ₽`
    );
    blocks.push(
      `💰 ИТОГО К ОПЛАТЕ (${items.length} поз.): ${pricing.finalTotal.toLocaleString('ru-RU')} ₽`
    );
  } else {
    blocks.push(
      `💰 ИТОГО ПО СМЕТЕ (${items.length} поз.): ${pricing.finalTotal.toLocaleString('ru-RU')} ₽`
    );
  }

  const mgrName = (meta?.managerName || '').trim();
  const mgrPhone = (meta?.managerPhone || '').trim();
  const mgrEmail = (meta?.managerEmail || '').trim();
  if (mgrName || mgrPhone || mgrEmail) {
    blocks.push('');
    blocks.push(`👤 Ваш менеджер: ${mgrName || '—'}`);
    blocks.push(`📞 Тел.: ${mgrPhone || '—'} | ✉️ Email: ${mgrEmail || '—'}`);
  }

  if (shareUrl && shareUrl.trim()) {
    return `${blocks.join('\n')}\n🔗 Ссылка на корзину: ${shareUrl.trim()}`;
  }

  return blocks.join('\n');
}

