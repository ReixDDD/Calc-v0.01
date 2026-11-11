import React from 'react';
import { ProductItem, SchematicType } from '../types';
import { SCHEMATIC_TYPE_LABELS } from '../constants';
import {
  computeWideFormatStripBreakdown,
  EyeletSpacingOptionId,
  formatMmAsCm,
  formatWideFormatStripsBreakdown,
  isWideFormatSectionOrCategory,
  MAX_WIDE_FORMAT_PRINT_WIDTH_MM,
  resolveEyeletSpacing,
} from '../calculatorUtils';

export { MAX_WIDE_FORMAT_PRINT_WIDTH_MM, SCHEMATIC_TYPE_LABELS };

export interface GrommetPoint {
  cx: number;
  cy: number;
  isCorner: boolean;
}

export interface BannerGrommetStepSegment {
  axis: 'x' | 'y';
  startPx: number;
  endPx: number;
  anchorPx: number;
  stepCm: number;
}

export interface BannerGrommetLayout {
  points: GrommetPoint[];
  radius: number;
  strokeWidth: number;
  stepSegment: BannerGrommetStepSegment | null;
}

function computeCenteredStepOffsetsMm(
  lengthMm: number,
  stepMm: number,
  maxInterior: number
): { offsetsMm: number[]; isCapped: boolean } {
  const safeLen = Math.max(1, lengthMm);
  const rawSegments = Math.max(1, Math.round(safeLen / stepMm));
  const cappedSegments = Math.min(Math.max(1, maxInterior + 1), rawSegments);
  const interiorCount = Math.max(0, cappedSegments - 1);

  if (interiorCount === 0) {
    return { offsetsMm: [], isCapped: false };
  }

  if (cappedSegments < rawSegments) {
    const fallbackOffsets: number[] = [];
    for (let k = 1; k <= interiorCount; k += 1) {
      fallbackOffsets.push((safeLen * k) / (interiorCount + 1));
    }
    return { offsetsMm: fallbackOffsets, isCapped: true };
  }

  if (interiorCount === 1) {
    return { offsetsMm: [safeLen / 2], isCapped: false };
  }

  const interiorSpan = (interiorCount - 1) * stepMm;
  const cornerOffset = (safeLen - interiorSpan) / 2;
  const offsetsMm: number[] = [];
  for (let k = 0; k < interiorCount; k += 1) {
    offsetsMm.push(cornerOffset + k * stepMm);
  }
  return { offsetsMm, isCapped: false };
}

export function computeBannerGrommetLayout(args: {
  x0: number;
  y0: number;
  rectW: number;
  rectH: number;
  widthMm: number;
  heightMm: number;
  eyeletsEnabled: boolean;
  spacingMode: EyeletSpacingOptionId;
  hemCenterInset?: number;
}): BannerGrommetLayout {
  const {
    x0,
    y0,
    rectW,
    rectH,
    widthMm,
    heightMm,
    eyeletsEnabled,
    spacingMode,
    hemCenterInset = 5,
  } = args;

  const BASE_GROMMET_RADIUS = 1.75;
  const BASE_GROMMET_STROKE = 1.15;

  if (!eyeletsEnabled) {
    return {
      points: [],
      radius: BASE_GROMMET_RADIUS,
      strokeWidth: BASE_GROMMET_STROKE,
      stepSegment: null,
    };
  }

  const leftX = Math.round((x0 + hemCenterInset) * 100) / 100;
  const rightX =
    Math.round((x0 + Math.max(hemCenterInset * 2, rectW - hemCenterInset)) * 100) / 100;
  const topY = Math.round((y0 + hemCenterInset) * 100) / 100;
  const botY =
    Math.round((y0 + Math.max(hemCenterInset * 2, rectH - hemCenterInset)) * 100) / 100;

  const corners: GrommetPoint[] = [
    { cx: leftX, cy: topY, isCorner: true },
    { cx: rightX, cy: topY, isCorner: true },
    { cx: leftX, cy: botY, isCorner: true },
    { cx: rightX, cy: botY, isCorner: true },
  ];

  if (spacingMode === 'corners') {
    return {
      points: corners,
      radius: BASE_GROMMET_RADIUS,
      strokeWidth: BASE_GROMMET_STROKE,
      stepSegment: null,
    };
  }

  const stepCm = Math.max(1, Number(spacingMode));
  const stepMm = stepCm * 10;
  const safeW = Math.max(1, widthMm);
  const safeH = Math.max(1, heightMm);
  const spanX = Math.max(1, rightX - leftX);
  const spanY = Math.max(1, botY - topY);

  const maxInteriorX = Math.max(0, Math.floor(spanX / 2.6) - 1);
  const maxInteriorY = Math.max(0, Math.floor(spanY / 2.6) - 1);

  const { offsetsMm: xOffsetsMm, isCapped: xCapped } = computeCenteredStepOffsetsMm(
    safeW,
    stepMm,
    maxInteriorX
  );
  const { offsetsMm: yOffsetsMm, isCapped: yCapped } = computeCenteredStepOffsetsMm(
    safeH,
    stepMm,
    maxInteriorY
  );

  const points: GrommetPoint[] = [...corners];
  const interiorXs: number[] = [];
  const interiorYs: number[] = [];

  for (const dxMm of xOffsetsMm) {
    const gx = Math.round((leftX + (dxMm / safeW) * spanX) * 100) / 100;
    interiorXs.push(gx);
    points.push({ cx: gx, cy: topY, isCorner: false });
    points.push({ cx: gx, cy: botY, isCorner: false });
  }

  for (const dyMm of yOffsetsMm) {
    const gy = Math.round((topY + (dyMm / safeH) * spanY) * 100) / 100;
    interiorYs.push(gy);
    points.push({ cx: leftX, cy: gy, isCorner: false });
    points.push({ cx: rightX, cy: gy, isCorner: false });
  }

  const allXs = [leftX, ...interiorXs, rightX];
  const allYs = [topY, ...interiorYs, botY];

  let minGapPx = Infinity;
  for (let i = 1; i < allXs.length; i += 1) {
    minGapPx = Math.min(minGapPx, Math.abs(allXs[i] - allXs[i - 1]));
  }
  for (let j = 1; j < allYs.length; j += 1) {
    minGapPx = Math.min(minGapPx, Math.abs(allYs[j] - allYs[j - 1]));
  }

  let radius = BASE_GROMMET_RADIUS;
  let strokeWidth = BASE_GROMMET_STROKE;
  if (Number.isFinite(minGapPx) && minGapPx < 7.3) {
    radius = Math.max(0.75, Math.round(minGapPx * 0.24 * 100) / 100);
    strokeWidth = Math.max(0.55, Math.round(radius * 0.65 * 100) / 100);
  }

  let stepSegment: BannerGrommetStepSegment | null = null;
  if (!xCapped && xOffsetsMm.length >= 2) {
    const firstIsExactStep = Math.abs(xOffsetsMm[0] - stepMm) < 0.5;
    stepSegment = {
      axis: 'x',
      startPx: firstIsExactStep ? allXs[0] : allXs[1],
      endPx: firstIsExactStep ? allXs[1] : allXs[2],
      anchorPx: botY,
      stepCm,
    };
  } else if (!xCapped && xOffsetsMm.length === 1 && Math.abs(xOffsetsMm[0] - stepMm) < 0.5) {
    stepSegment = {
      axis: 'x',
      startPx: allXs[0],
      endPx: allXs[1],
      anchorPx: botY,
      stepCm,
    };
  } else if (!yCapped && yOffsetsMm.length >= 2) {
    const firstIsExactStep = Math.abs(yOffsetsMm[0] - stepMm) < 0.5;
    stepSegment = {
      axis: 'y',
      startPx: firstIsExactStep ? allYs[0] : allYs[1],
      endPx: firstIsExactStep ? allYs[1] : allYs[2],
      anchorPx: rightX,
      stepCm,
    };
  } else if (!yCapped && yOffsetsMm.length === 1 && Math.abs(yOffsetsMm[0] - stepMm) < 0.5) {
    stepSegment = {
      axis: 'y',
      startPx: allYs[0],
      endPx: allYs[1],
      anchorPx: rightX,
      stepCm,
    };
  }

  return { points, radius, strokeWidth, stepSegment };
}

export function computeBannerGrommetPoints(args: {
  x0: number;
  y0: number;
  rectW: number;
  rectH: number;
  widthMm: number;
  heightMm: number;
  eyeletsEnabled: boolean;
  spacingMode: EyeletSpacingOptionId;
  hemCenterInset?: number;
}): GrommetPoint[] {
  return computeBannerGrommetLayout(args).points;
}

export interface BannerSeamLayout {
  hasSeams: boolean;
  orientation: 'vertical' | 'horizontal' | null;
  stripsCount: number;
  seamsCount: number;
  seamPositionsPx: number[];
  stripSizesCm: number[];
  lastStripSizeCm: number;
}

export function formatBannerStripsNoun(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 19) return 'полотен';
  if (mod10 === 1) return 'полотно';
  if (mod10 >= 2 && mod10 <= 4) return 'полотна';
  return 'полотен';
}

export function computeBannerSeamLayout(args: {
  x0: number;
  y0: number;
  rectW: number;
  rectH: number;
  widthMm: number;
  heightMm: number;
  maxPrintWidthMm?: number;
}): BannerSeamLayout {
  const {
    x0,
    y0,
    rectW,
    rectH,
    widthMm,
    heightMm,
    maxPrintWidthMm = MAX_WIDE_FORMAT_PRINT_WIDTH_MM,
  } = args;

  const breakdown = computeWideFormatStripBreakdown(widthMm, heightMm, maxPrintWidthMm);
  if (!breakdown.hasSeams || !breakdown.orientation) {
    const singleCm = breakdown.stripSizesCm[0] ?? 0;
    return {
      hasSeams: false,
      orientation: null,
      stripsCount: 1,
      seamsCount: 0,
      seamPositionsPx: [],
      stripSizesCm: breakdown.stripSizesCm,
      lastStripSizeCm: singleCm,
    };
  }

  const chooseVertical = breakdown.orientation === 'vertical';
  const spanPx = Math.max(24, chooseVertical ? rectW : rectH);
  const originPx = chooseVertical ? x0 : y0;

  const rawPositions: number[] = [];
  let cumMm = 0;
  for (let i = 0; i < breakdown.seamsCount; i += 1) {
    cumMm += breakdown.stripSizesMm[i];
    rawPositions.push(originPx + (cumMm / breakdown.splitDimMm) * spanPx);
  }

  // Keep narrow remainder strip visibly inside the 10px perimeter hem & grommets
  const minEdgeClearance = Math.min(16, Math.max(12, Math.round(spanPx * 0.1)));
  const minSeamGap = Math.min(6, Math.max(3, Math.floor((spanPx - minEdgeClearance * 2) / Math.max(1, breakdown.seamsCount))));
  const clamped = [...rawPositions];
  const maxLastPx = originPx + spanPx - minEdgeClearance;
  const minFirstPx = originPx + minEdgeClearance;

  if (clamped.length > 0) {
    clamped[clamped.length - 1] = Math.min(clamped[clamped.length - 1], maxLastPx);
    for (let i = clamped.length - 2; i >= 0; i -= 1) {
      clamped[i] = Math.min(clamped[i], clamped[i + 1] - minSeamGap);
    }
    clamped[0] = Math.max(clamped[0], minFirstPx);
    for (let i = 1; i < clamped.length; i += 1) {
      clamped[i] = Math.max(clamped[i], clamped[i - 1] + minSeamGap);
    }
  }

  const seamPositionsPx = clamped.map((px) => Math.round(px * 100) / 100);
  const lastStripSizeCm =
    breakdown.stripSizesCm[breakdown.stripSizesCm.length - 1] ?? 0;

  return {
    hasSeams: true,
    orientation: breakdown.orientation,
    stripsCount: breakdown.stripsCount,
    seamsCount: breakdown.seamsCount,
    seamPositionsPx,
    stripSizesCm: breakdown.stripSizesCm,
    lastStripSizeCm,
  };
}

const VALID_SCHEMATIC_SET = new Set<Exclude<SchematicType, 'auto'>>([
  'flat',
  'booklet_1fold',
  'booklet_2fold',
  'calendar_house',
  'calendar_wall',
  'pocket_calendar',
  'catalog',
  'notepad_spiral',
  'folder',
  'box',
  'card_deck',
  'sticker_pack',
  'certificate',
  'banner',
  'mug',
  'tshirt',
  'stamp_round',
]);

export function resolveSchematicType(
  prod: ProductItem,
  selectedParams?: Record<string, string | number | boolean>
): Exclude<SchematicType, 'auto'> {
  if (selectedParams) {
    if (selectedParams.creasing_menu === 'two') {
      return 'booklet_2fold';
    }
    if (selectedParams.creasing_menu === 'half') {
      return 'booklet_1fold';
    }
  }

  const rawType = String(prod.schematic_type || 'auto').trim();
  if (rawType === 'booklet_1_fold') return 'booklet_1fold';
  if (rawType === 'booklet_2_folds') return 'booklet_2fold';

  const name = prod.name.toLowerCase();
  const cat = prod.category.toLowerCase();
  const kindStr = (prod.product_kind || '').toLowerCase();

  // Тематические чертежи для новых разделов (широкоформат, сувениры, печати)
  if (
    rawType === 'banner' ||
    cat === 'wf_banners_cat' ||
    name.includes('баннер') ||
    name.includes('растяжк') ||
    name.includes('пресс-волл') ||
    name.includes('ролл-ап')
  ) {
    return 'banner';
  }
  if (rawType === 'mug' || cat === 'souv_mugs_cat' || name.includes('кружк')) {
    return 'mug';
  }
  if (
    rawType === 'tshirt' ||
    cat === 'souv_textile_cat' ||
    name.includes('футболк') ||
    name.includes('толстовк') ||
    name.includes('шоппер')
  ) {
    return 'tshirt';
  }
  if (
    rawType === 'stamp_round' ||
    (cat === 'stamps_orgs_cat' &&
      Math.round(Number(prod.width_mm) || 0) === Math.round(Number(prod.height_mm) || 0)) ||
    name.includes('круглая печать')
  ) {
    return 'stamp_round';
  }

  if (
    rawType &&
    rawType !== 'auto' &&
    rawType !== 'single_sheet' &&
    VALID_SCHEMATIC_SET.has(rawType as Exclude<SchematicType, 'auto'>)
  ) {
    return rawType as Exclude<SchematicType, 'auto'>;
  }

  if (cat === 'notepads' || cat === 'planners' || name.includes('блокнот') || name.includes('планер')) {
    return 'notepad_spiral';
  }
  if (
    cat === 'menus' &&
    (prod.multi_page_mode === 'pages' ||
      name.includes('многостранич') ||
      name.includes('пружин') ||
      name.includes('кольц') ||
      name.includes('карта'))
  ) {
    return 'catalog';
  }
  if (
    cat === 'catalogs' ||
    prod.multi_page_mode === 'pages' ||
    name.includes('каталог') ||
    name.includes('брошюр') ||
    name.includes('журнал')
  ) {
    return 'catalog';
  }
  if (cat === 'table_tents') {
    if (name.includes('вкладыш') || kindStr.includes('вкладыш')) return 'flat';
    if (name.includes('призма') || name.includes('треугольн')) return 'booklet_2fold';
    return 'calendar_house';
  }
  if (name.includes('домик') || kindStr.includes('домик') || name.includes('тейбл-тент')) {
    return 'calendar_house';
  }
  if (cat === 'folders' || name.includes('папк')) {
    return 'folder';
  }
  if (cat === 'packaging_boxes' || name.includes('коробк') || name.includes('шубер')) {
    return 'box';
  }
  if (cat === 'card_decks' || name.includes('колод')) {
    return 'card_deck';
  }
  if (cat === 'stickers' || cat === 'stickers_3d' || name.includes('стикер') || name.includes('наклейк')) {
    return 'sticker_pack';
  }
  if (
    cat === 'certificates' ||
    cat === 'blanks' ||
    name.includes('сертификат') ||
    name.includes('диплом') ||
    name.includes('грамот') ||
    name.includes('бланк')
  ) {
    return 'certificate';
  }
  if (cat === 'calendars') {
    if (
      prod.multi_page_mode === 'sheets' ||
      name.includes('перекид') ||
      name.includes('трио') ||
      name.includes('квартал') ||
      kindStr.includes('трио') ||
      kindStr.includes('перекид')
    ) {
      return 'calendar_wall';
    }
    if (name.includes('карман')) {
      return 'pocket_calendar';
    }
    return 'flat';
  }
  if (cat === 'booklets' || name.includes('буклет')) {
    if (name.includes('2 сгиб') || name.includes('евро') || kindStr.includes('2 сгиб')) {
      return 'booklet_2fold';
    }
    return 'booklet_1fold';
  }
  if (name.includes('двойн') || name.includes('сгиб') || name.includes('сложен')) {
    return 'booklet_1fold';
  }
  return 'flat';
}

export type ResolvedBindingType =
  | 'staple'
  | 'spiral_side'
  | 'spiral_top'
  | 'kbs'
  | 'bolts'
  | 'rings'
  | 'cord';

export function resolveBindingType(
  prod: ProductItem,
  selectedParams?: Record<string, string | number | boolean>
): ResolvedBindingType {
  const params = selectedParams || {};
  const rawBindValues: string[] = [];

  for (const key of ['notepad_bind', 'mag_binding', 'menu_fastener', 'binding', 'fastener', 'cal_bind']) {
    if (typeof params[key] === 'string' && params[key]) {
      rawBindValues.push(String(params[key]).toLowerCase());
    }
  }
  for (const val of Object.values(params)) {
    if (typeof val === 'string' && val) {
      rawBindValues.push(val.toLowerCase());
    }
  }

  for (const v of rawBindValues) {
    if (v === 'wire_top' || v === 'spiral_top') return 'spiral_top';
    if (v === 'wire_side' || v === 'spiral' || v === 'spiral_side') return 'spiral_side';
    if (v === 'glue_kbs' || v === 'pur' || v === 'kbs') return 'kbs';
    if (v === 'staple' || v === 'staples') return 'staple';
    if (v === 'bolts' || v === 'screws') return 'bolts';
    if (v === 'rings') return 'rings';
    if (v === 'cord' || v === 'ribbon') return 'cord';
  }

  // Фолбэк по значениям по умолчанию в cost_params товара
  for (const cp of prod.cost_params || []) {
    if (cp.is_client_facing && cp.input_type === 'select') {
      const defVal = String(cp.default_value || cp.options?.[0]?.id || '').toLowerCase();
      if (defVal === 'wire_top' || defVal === 'spiral_top') return 'spiral_top';
      if (defVal === 'wire_side' || defVal === 'spiral' || defVal === 'spiral_side') return 'spiral_side';
      if (defVal === 'glue_kbs' || defVal === 'pur' || defVal === 'kbs') return 'kbs';
      if (defVal === 'staple' || defVal === 'staples') return 'staple';
      if (defVal === 'bolts') return 'bolts';
      if (defVal === 'rings') return 'rings';
      if (defVal === 'cord') return 'cord';
    }
  }

  const nameLower = prod.name.toLowerCase();
  const catLower = prod.category.toLowerCase();
  if (nameLower.includes('кбс') || nameLower.includes('клеев')) return 'kbs';
  if (nameLower.includes('болт') || nameLower.includes('винт')) return 'bolts';
  if (nameLower.includes('кольц')) return 'rings';
  if (nameLower.includes('шнур') || nameLower.includes('тесьм')) return 'cord';
  if (catLower === 'notepads') return 'spiral_top';
  if (catLower === 'planners') return 'spiral_side';
  if (nameLower.includes('пружин')) return 'spiral_side';
  return 'staple';
}

interface ProductSchematicSVGProps {
  prod: ProductItem;
  widthMm: number;
  heightMm: number;
  pagesCount: number;
  isDark: boolean;
  selectedParams?: Record<string, string | number | boolean>;
  hideDimensions?: boolean;
  dimensionUnit?: 'mm' | 'cm';
}

export function ProductSchematicSVG({
  prod,
  widthMm,
  heightMm,
  pagesCount,
  isDark,
  selectedParams,
  hideDimensions = false,
  dimensionUnit,
}: ProductSchematicSVGProps) {
  const wMm = Math.max(1, Math.round(widthMm * 10) / 10);
  const hMm = Math.max(1, Math.round(heightMm * 10) / 10);
  const resolvedKind = resolveSchematicType(prod, selectedParams);
  const kind: Exclude<SchematicType, 'auto'> =
    prod.category.toLowerCase() === 'stamps_orgs_cat'
      ? Math.round(wMm) === Math.round(hMm)
        ? 'stamp_round'
        : resolvedKind === 'stamp_round'
        ? 'flat'
        : resolvedKind
      : resolvedKind;
  const effectiveDimensionUnit: 'mm' | 'cm' =
    dimensionUnit ??
    (isWideFormatSectionOrCategory(undefined, prod.category) || kind === 'banner' ? 'cm' : 'mm');
  const wDimLabel =
    effectiveDimensionUnit === 'cm' ? `${formatMmAsCm(wMm)} см` : `${wMm} мм`;
  const hDimLabel =
    effectiveDimensionUnit === 'cm' ? `${formatMmAsCm(hMm)} см` : `${hMm} мм`;
  const bindingType = resolveBindingType(prod, selectedParams);
  const params = selectedParams || {};
  const baseMm = Math.max(5, Math.min(Math.floor(hMm / 3), prod.base_mm || 35));

  const svgW = 320;
  const svgH = 260;

  const marginL = hideDimensions ? 22 : 46;
  const marginR = hideDimensions ? 22 : kind === 'calendar_house' ? 46 : 26;
  const marginT = hideDimensions ? 16 : 40;
  const marginB = hideDimensions ? 16 : kind === 'booklet_1fold' || kind === 'booklet_2fold' ? 42 : 24;

  const availW = svgW - marginL - marginR;
  const availH = svgH - marginT - marginB;

  const rawRatio = wMm / hMm;
  const clampedRatio =
    kind === 'banner'
      ? Math.max(0.35, Math.min(4.2, rawRatio))
      : Math.max(0.55, Math.min(1.9, rawRatio));

  let rectW: number;
  let rectH: number;
  if (kind === 'banner') {
    const hemInset = 5;
    const availSpanW = Math.max(44, availW - hemInset * 2);
    const availSpanH = Math.max(36, availH - hemInset * 2);
    let spanW: number;
    let spanH: number;
    if (availSpanW / availSpanH > clampedRatio) {
      spanH = availSpanH;
      spanW = Math.max(44, Math.round(availSpanH * clampedRatio));
    } else {
      spanW = availSpanW;
      spanH = Math.max(36, Math.round(availSpanW / clampedRatio));
    }
    rectW = spanW + hemInset * 2;
    rectH = spanH + hemInset * 2;
  } else if (availW / availH > clampedRatio) {
    rectH = availH;
    rectW = Math.max(104, Math.round(availH * clampedRatio));
  } else {
    rectW = availW;
    rectH = Math.max(76, Math.round(availW / clampedRatio));
  }

  const x0 = Math.round(marginL + (availW - rectW) / 2);
  const y0 = Math.round(marginT + (availH - rectH) / 2);
  const clipId = 'schematic-rect-clip';

  const bgColor = isDark ? '#1E2024' : '#F8FAFC';
  const strokeBlue = isDark ? '#E54D47' : '#C02721';
  const fillBlue = isDark ? '#25282E' : '#FFFFFF';
  const fillAccent = isDark ? 'rgba(229, 77, 71, 0.15)' : 'rgba(192, 39, 33, 0.08)';
  const fillGrey = isDark ? '#32363E' : '#E2E8F0';
  const dimColor = isDark ? '#94A3B8' : '#64748B';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const subTextColor = isDark ? '#94A3B8' : '#475569';
  const baseTextColor = isDark ? '#F1F5F9' : '#0F172A';
  const stackFill1 = isDark ? '#282B30' : '#F1F5F9';
  const stackFill2 = isDark ? '#32363E' : '#CBD5E1';
  const stackStroke = isDark ? '#454A54' : '#94A3B8';
  const goldColor = strokeBlue;

  const renderBoundedText = (
    x: number,
    y: number,
    maxW: number,
    label: string,
    baseFontSize = 10.5,
    fill = textColor,
    fontWeight: number | string = 600
  ) => {
    const safeMaxW = Math.max(24, Math.round(maxW * 10) / 10);
    const estBaseW = label.length * baseFontSize * 0.58;
    const scaledFontSize =
      estBaseW > safeMaxW ? Math.max(8.5, Math.round((safeMaxW / (label.length * 0.58)) * 10) / 10) : baseFontSize;
    const estFinalW = label.length * scaledFontSize * 0.58;
    const needsCompression = estFinalW > safeMaxW;

    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fill={fill}
        fontSize={scaledFontSize}
        fontWeight={fontWeight}
        clipPath={`url(#${clipId})`}
        {...(needsCompression
          ? {
              textLength: safeMaxW,
              lengthAdjust: 'spacingAndGlyphs' as const,
            }
          : {})}
      >
        {label}
      </text>
    );
  };

  const renderMaskedBoundedText = (
    x: number,
    y: number,
    maxW: number,
    label: string,
    maskFill: string,
    baseFontSize = 10.5,
    fill = textColor,
    fontWeight: number | string = 600
  ) => {
    const safeMaxW = Math.max(24, Math.round(maxW * 10) / 10);
    const estBaseW = label.length * baseFontSize * 0.58;
    const scaledFontSize =
      estBaseW > safeMaxW
        ? Math.max(8.5, Math.round((safeMaxW / (label.length * 0.58)) * 10) / 10)
        : baseFontSize;
    const maskW = Math.min(
      safeMaxW + 8,
      Math.max(28, Math.round(label.length * scaledFontSize * 0.58 + 10))
    );
    const maskH = Math.round(scaledFontSize + 5);
    return (
      <g>
        <rect
          x={Math.round((x - maskW / 2) * 10) / 10}
          y={Math.round((y - scaledFontSize * 0.82 - 2) * 10) / 10}
          width={maskW}
          height={maskH}
          rx={2}
          fill={maskFill}
          opacity={0.94}
          clipPath={`url(#${clipId})`}
        />
        {renderBoundedText(x, y, maxW, label, baseFontSize, fill, fontWeight)}
      </g>
    );
  };

  const renderSeamLines = (seamLayout: BannerSeamLayout) => {
    if (!seamLayout.hasSeams || !seamLayout.orientation) return null;
    const seamBandFill = isDark ? 'rgba(229, 77, 71, 0.18)' : 'rgba(192, 39, 33, 0.12)';
    const fullSpanPx = seamLayout.orientation === 'vertical' ? rectW : rectH;
    const originPx = seamLayout.orientation === 'vertical' ? x0 : y0;
    const boundaries = [originPx, ...seamLayout.seamPositionsPx, originPx + fullSpanPx];
    let minStripPx = fullSpanPx;
    for (let i = 1; i < boundaries.length; i += 1) {
      minStripPx = Math.min(minStripPx, Math.abs(boundaries[i] - boundaries[i - 1]));
    }
    const bandThickness = Math.min(5, Math.max(2, Math.round(minStripPx * 0.22 * 10) / 10));
    const halfBand = Math.round((bandThickness / 2) * 100) / 100;

    return (
      <g data-banner-seams-group="true">
        {seamLayout.seamPositionsPx.map((posPx, idx) =>
          seamLayout.orientation === 'vertical' ? (
            <g key={`seam-v-${idx}`}>
              <rect
                x={posPx - halfBand}
                y={y0 + 1.5}
                width={bandThickness}
                height={Math.max(4, rectH - 3)}
                fill={seamBandFill}
              />
              <line
                data-banner-seam="true"
                data-seam-orientation="vertical"
                x1={posPx}
                y1={y0 + 1.5}
                x2={posPx}
                y2={y0 + rectH - 1.5}
                stroke={strokeBlue}
                strokeWidth={1.35}
                strokeDasharray="6 3 1.5 3"
                opacity={0.9}
              />
            </g>
          ) : (
            <g key={`seam-h-${idx}`}>
              <rect
                x={x0 + 1.5}
                y={posPx - halfBand}
                width={Math.max(4, rectW - 3)}
                height={bandThickness}
                fill={seamBandFill}
              />
              <line
                data-banner-seam="true"
                data-seam-orientation="horizontal"
                x1={x0 + 1.5}
                y1={posPx}
                x2={x0 + rectW - 1.5}
                y2={posPx}
                stroke={strokeBlue}
                strokeWidth={1.35}
                strokeDasharray="6 3 1.5 3"
                opacity={0.9}
              />
            </g>
          )
        )}
      </g>
    );
  };

  const renderHDim = (
    xStart: number,
    xEnd: number,
    yLine: number,
    yAnchorStart: number,
    yAnchorEnd: number,
    label: string,
    fontSize = 11.5
  ) => {
    if (hideDimensions) return null;
    const segW = Math.abs(xEnd - xStart);
    const isNarrow = segW < 48;
    const effFontSize = segW < 38 ? Math.min(fontSize, 8.5) : isNarrow ? Math.min(fontSize, 9.2) : fontSize;
    const midX = (xStart + xEnd) / 2;
    const arrowLen = isNarrow ? 5 : 7.5;
    const arrowHalfH = isNarrow ? 2.4 : 3.4;
    const arrowL = `${xStart},${yLine} ${xStart + arrowLen},${yLine - arrowHalfH} ${xStart + arrowLen},${yLine + arrowHalfH}`;
    const arrowR = `${xEnd},${yLine} ${xEnd - arrowLen},${yLine - arrowHalfH} ${xEnd - arrowLen},${yLine + arrowHalfH}`;
    const rawPillW = label.length * (effFontSize * 0.6) + (isNarrow ? 4 : 8);
    const pillW = isNarrow ? Math.min(Math.max(18, segW - 10), Math.max(20, rawPillW)) : Math.max(36, rawPillW);
    return (
      <g>
        <line
          x1={xStart}
          y1={yAnchorStart}
          x2={xStart}
          y2={yLine + (yLine < yAnchorStart ? -7 : 7)}
          stroke={dimColor}
          strokeWidth={1.1}
        />
        <line
          x1={xEnd}
          y1={yAnchorEnd}
          x2={xEnd}
          y2={yLine + (yLine < yAnchorEnd ? -7 : 7)}
          stroke={dimColor}
          strokeWidth={1.1}
        />
        <line x1={xStart} y1={yLine} x2={xEnd} y2={yLine} stroke={dimColor} strokeWidth={1.1} />
        <polygon points={arrowL} fill={dimColor} />
        <polygon points={arrowR} fill={dimColor} />
        <rect x={midX - pillW / 2} y={yLine - 8.5} width={pillW} height={17} rx={2} fill={bgColor} />
        <text
          x={midX}
          y={yLine + 3.8}
          textAnchor="middle"
          fill={textColor}
          fontSize={effFontSize}
          fontWeight={600}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {label}
        </text>
      </g>
    );
  };

  const renderVDim = (
    yStart: number,
    yEnd: number,
    xLine: number,
    xAnchorStart: number,
    xAnchorEnd: number,
    label: string,
    outsideArrows = false,
    fontSize = 11.5
  ) => {
    if (hideDimensions) return null;
    const segH = Math.abs(yEnd - yStart);
    const useOutside = outsideArrows || segH < 42;
    const effFontSize = useOutside ? Math.min(fontSize, 9.5) : fontSize;
    const midY = (yStart + yEnd) / 2;
    const pillH = Math.max(useOutside ? 26 : 34, label.length * (effFontSize * 0.58) + 6);
    const extOffset = xLine < xAnchorStart ? -7 : 7;
    const textX =
      useOutside && segH < pillH + 6 ? xLine + (xLine < xAnchorStart ? -11 : 11) : xLine;

    return (
      <g>
        <line
          x1={xAnchorStart}
          y1={yStart}
          x2={xLine + extOffset}
          y2={yStart}
          stroke={dimColor}
          strokeWidth={1.1}
        />
        <line
          x1={xAnchorEnd}
          y1={yEnd}
          x2={xLine + extOffset}
          y2={yEnd}
          stroke={dimColor}
          strokeWidth={1.1}
        />
        {!useOutside ? (
          <>
            <line x1={xLine} y1={yStart} x2={xLine} y2={yEnd} stroke={dimColor} strokeWidth={1.1} />
            <polygon
              points={`${xLine},${yStart} ${xLine - 3.4},${yStart + 7.5} ${xLine + 3.4},${yStart + 7.5}`}
              fill={dimColor}
            />
            <polygon
              points={`${xLine},${yEnd} ${xLine - 3.4},${yEnd - 7.5} ${xLine + 3.4},${yEnd - 7.5}`}
              fill={dimColor}
            />
          </>
        ) : (
          <>
            <line x1={xLine} y1={yStart} x2={xLine} y2={yEnd} stroke={dimColor} strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
            <line x1={xLine} y1={yStart - 13} x2={xLine} y2={yStart} stroke={dimColor} strokeWidth={1.1} />
            <polygon
              points={`${xLine},${yStart} ${xLine - 3.2},${yStart - 7} ${xLine + 3.2},${yStart - 7}`}
              fill={dimColor}
            />
            <line x1={xLine} y1={yEnd + 13} x2={xLine} y2={yEnd} stroke={dimColor} strokeWidth={1.1} />
            <polygon
              points={`${xLine},${yEnd} ${xLine - 3.2},${yEnd + 7} ${xLine + 3.2},${yEnd + 7}`}
              fill={dimColor}
            />
          </>
        )}
        <rect x={textX - 8} y={midY - pillH / 2} width={16} height={pillH} rx={2} fill={bgColor} />
        <text
          x={textX}
          y={midY + 3.8}
          textAnchor="middle"
          fill={textColor}
          fontSize={effFontSize}
          fontWeight={600}
          transform={`rotate(-90, ${textX}, ${midY})`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {label}
        </text>
      </g>
    );
  };

  // Отрисовка динамического узла скрепления для каталогов, журналов, блокнотов, планеров и меню
  const renderBindingElements = (mode: ResolvedBindingType) => {
    if (mode === 'spiral_top') {
      return (
        <g data-binding="spiral_top">
          {Array.from({ length: 9 }).map((_, idx) => {
            const loopX = x0 + 14 + (idx * (rectW - 28)) / 8;
            return (
              <g key={idx}>
                <circle cx={loopX} cy={y0 + 5.5} r={2} fill={bgColor} stroke={strokeBlue} strokeWidth={1} />
                <rect x={loopX - 2.2} y={y0 - 6} width={4.4} height={10.5} rx={2} fill={dimColor} />
              </g>
            );
          })}
        </g>
      );
    }

    if (mode === 'spiral_side') {
      return (
        <g data-binding="spiral_side">
          {Array.from({ length: 9 }).map((_, idx) => {
            const loopY = y0 + 14 + (idx * (rectH - 28)) / 8;
            return (
              <g key={idx}>
                <circle cx={x0 + 5.5} cy={loopY} r={2} fill={bgColor} stroke={strokeBlue} strokeWidth={1} />
                <rect x={x0 - 6} y={loopY - 2.2} width={10.5} height={4.4} rx={2} fill={dimColor} />
              </g>
            );
          })}
        </g>
      );
    }

    if (mode === 'kbs') {
      return (
        <g data-binding="kbs">
          {/* Проклеенный квадратный корешок КБС / ПУР */}
          <rect
            x={x0}
            y={y0}
            width={11}
            height={rectH}
            fill={fillGrey}
            stroke={strokeBlue}
            strokeWidth={1.6}
          />
          <line
            x1={x0 + 15}
            y1={y0}
            x2={x0 + 15}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.75}
          />
          {Array.from({ length: 7 }).map((_, idx) => {
            const hy = y0 + 14 + (idx * (rectH - 28)) / 6;
            return (
              <line
                key={idx}
                x1={x0 + 2}
                y1={hy - 3}
                x2={x0 + 9}
                y2={hy + 3}
                stroke={strokeBlue}
                strokeWidth={1.2}
                opacity={0.75}
              />
            );
          })}
        </g>
      );
    }

    if (mode === 'bolts') {
      return (
        <g data-binding="bolts">
          {/* Прижимная планка и полиграфические болты (винты) */}
          <rect
            x={x0}
            y={y0}
            width={18}
            height={rectH}
            fill={fillAccent}
            stroke={strokeBlue}
            strokeWidth={1.4}
          />
          <line
            x1={x0 + 21}
            y1={y0}
            x2={x0 + 21}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.1}
            strokeDasharray="4 3"
          />
          {[0.24, 0.76].map((pos, idx) => {
            const cy = y0 + rectH * pos;
            return (
              <g key={idx}>
                <circle
                  cx={x0 + 9}
                  cy={cy}
                  r={5}
                  fill={fillGrey}
                  stroke={strokeBlue}
                  strokeWidth={1.6}
                />
                <line
                  x1={x0 + 6}
                  y1={cy - 2}
                  x2={x0 + 12}
                  y2={cy + 2}
                  stroke={textColor}
                  strokeWidth={1.4}
                />
              </g>
            );
          })}
        </g>
      );
    }

    if (mode === 'rings') {
      return (
        <g data-binding="rings">
          {/* Разъемные металлические кольца */}
          {[0.22, 0.5, 0.78].map((pos, idx) => {
            const cy = y0 + rectH * pos;
            return (
              <g key={idx}>
                <circle
                  cx={x0 + 7}
                  cy={cy}
                  r={2.5}
                  fill={bgColor}
                  stroke={strokeBlue}
                  strokeWidth={1.2}
                />
                <circle
                  cx={x0}
                  cy={cy}
                  r={8.5}
                  fill="none"
                  stroke={dimColor}
                  strokeWidth={2.4}
                />
              </g>
            );
          })}
        </g>
      );
    }

    if (mode === 'cord') {
      const yTopHole = y0 + rectH * 0.28;
      const yBotHole = y0 + rectH * 0.72;
      const yMid = y0 + rectH * 0.5;
      return (
        <g data-binding="cord">
          {/* Шнурок / декоративная тесьма с бантиком */}
          <line
            x1={x0 + 14}
            y1={y0}
            x2={x0 + 14}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
          <circle cx={x0 + 6} cy={yTopHole} r={2.5} fill={bgColor} stroke={strokeBlue} strokeWidth={1.3} />
          <circle cx={x0 + 6} cy={yBotHole} r={2.5} fill={bgColor} stroke={strokeBlue} strokeWidth={1.3} />
          <path
            d={`M ${x0 + 6} ${yTopHole} C ${x0 - 5} ${yTopHole + 10}, ${x0 - 5} ${yBotHole - 10}, ${x0 + 6} ${yBotHole}`}
            fill="none"
            stroke={goldColor}
            strokeWidth={2.2}
          />
          <ellipse
            cx={x0 - 5}
            cy={yMid - 4}
            rx={5}
            ry={3}
            transform={`rotate(-25 ${x0 - 5} ${yMid - 4})`}
            fill="none"
            stroke={goldColor}
            strokeWidth={1.8}
          />
          <ellipse
            cx={x0 - 5}
            cy={yMid + 4}
            rx={5}
            ry={3}
            transform={`rotate(25 ${x0 - 5} ${yMid + 4})`}
            fill="none"
            stroke={goldColor}
            strokeWidth={1.8}
          />
        </g>
      );
    }

    // По умолчанию: 2 металлические скрепки (скобы)
    return (
      <g data-binding="staple">
        <line
          x1={x0 + 10}
          y1={y0}
          x2={x0 + 10}
          y2={y0 + rectH}
          stroke={strokeBlue}
          strokeWidth={1.5}
        />
        <rect x={x0 - 2.5} y={y0 + rectH * 0.25 - 6} width={5.5} height={12} rx={1.5} fill={dimColor} />
        <rect x={x0 - 2.5} y={y0 + rectH * 0.75 - 6} width={5.5} height={12} rx={1.5} fill={dimColor} />
      </g>
    );
  };

  const getBindingLabel = (mode: ResolvedBindingType): string => {
    switch (mode) {
      case 'spiral_top':
        return 'На пружине сверху';
      case 'spiral_side':
        return 'На пружине сбоку';
      case 'kbs':
        return 'КБС (клеевой корешок)';
      case 'bolts':
        return 'На полиграфических болтах';
      case 'rings':
        return 'На разъемных кольцах';
      case 'cord':
        return 'На шнурке / тесьме';
      case 'staple':
      default:
        return 'На 2 скрепках (скобах)';
    }
  };

  const housePanelMm = Math.max(10, Math.round(((hMm - baseMm * 2) / 2) * 10) / 10);
  const baseRatio = Math.max(0.12, Math.min(0.22, baseMm / hMm));
  const basePx = Math.round(rectH * baseRatio);
  const midTotalPx = rectH - basePx * 2;
  const halfMidPx = Math.round(midTotalPx / 2);

  const catLower = prod.category.toLowerCase();
  const nameLower = prod.name.toLowerCase();
  const kindLower = (prod.product_kind || '').toLowerCase();
  const isTrioCalendar =
    catLower === 'calendars' &&
    (nameLower.includes('трио') || nameLower.includes('квартал') || kindLower.includes('трио'));

  const hasEnvelope =
    (typeof params.envelope_c6 === 'string' && params.envelope_c6 !== 'none') ||
    (typeof params.envelope_e65 === 'string' && params.envelope_e65 !== 'none') ||
    (typeof params.cert_env === 'string' && params.cert_env !== 'none') ||
    (params.envelope_c6 !== 'none' &&
      params.envelope_e65 !== 'none' &&
      params.cert_env !== 'none' &&
      (nameLower.includes('конверт') || kindLower.includes('конверт')));

  const vbX = hideDimensions ? x0 - 16 : 0;
  const vbY = hideDimensions ? y0 - 16 : 0;
  const vbW = hideDimensions ? rectW + 32 : svgW;
  const vbH = hideDimensions ? rectH + 32 : svgH;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        background: hideDimensions ? 'transparent' : bgColor,
        userSelect: 'none',
        fontFamily: "'Open Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={x0 + 2} y={y0 + 2} width={Math.max(1, rectW - 4)} height={Math.max(1, rectH - 4)} rx={2} />
        </clipPath>
      </defs>

      {/* Верхняя размерная стрелка (Ширина) */}
      {renderHDim(x0, x0 + rectW, y0 - 20, y0, y0, wDimLabel)}

      {/* Левая размерная стрелка (Высота) */}
      {renderVDim(y0, y0 + rectH, x0 - 22, x0, x0, hDimLabel)}

      {/* ВАРИАНТ 1: НАСТОЛЬНЫЙ «ДОМИК» / ТЕЙБЛ-ТЕНТ */}
      {kind === 'calendar_house' && (
        <g>
          <rect x={x0} y={y0} width={rectW} height={basePx} fill={fillGrey} stroke={strokeBlue} strokeWidth={2} />
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + basePx / 2 + 3.5,
            rectW - 12,
            `Дно ${wMm}×${baseMm}`,
            10,
            baseTextColor,
            600
          )}

          <rect
            x={x0}
            y={y0 + basePx}
            width={rectW}
            height={halfMidPx}
            fill={fillBlue}
            stroke={strokeBlue}
            strokeWidth={2}
          />
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + basePx + halfMidPx / 2 + 4,
            rectW - 12,
            'Сторона А',
            10.5,
            subTextColor,
            500
          )}

          <rect
            x={x0}
            y={y0 + basePx + halfMidPx}
            width={rectW}
            height={midTotalPx - halfMidPx}
            fill={fillBlue}
            stroke={strokeBlue}
            strokeWidth={2}
          />
          {/* Если у домика перекидной блок на пружине или выбрано скрепление на пружине */}
          {(pagesCount > 1 || nameLower.includes('перекид')) &&
            Array.from({ length: 9 }).map((_, idx) => {
              const lx = x0 + 16 + (idx * (rectW - 32)) / 8;
              return (
                <rect
                  key={idx}
                  x={lx - 2}
                  y={y0 + basePx + halfMidPx - 4}
                  width={4}
                  height={8}
                  rx={1.5}
                  fill={dimColor}
                />
              );
            })}
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + basePx + halfMidPx + (midTotalPx - halfMidPx) / 2 + 4,
            rectW - 12,
            pagesCount > 1 ? `Сторона Б + блок (${pagesCount} л.)` : 'Сторона Б',
            10.5,
            subTextColor,
            500
          )}

          <rect
            x={x0}
            y={y0 + rectH - basePx}
            width={rectW}
            height={basePx}
            fill={fillGrey}
            stroke={strokeBlue}
            strokeWidth={2}
          />
          {params.tt_assembly === 'tape' ? (
            <line
              x1={x0 + 10}
              y1={y0 + rectH - 3.5}
              x2={x0 + rectW - 10}
              y2={y0 + rectH - 3.5}
              stroke="#ef4444"
              strokeWidth={2.2}
              strokeDasharray="6 3"
            />
          ) : (
            <path
              d={`M ${x0 + rectW * 0.36} ${y0 + rectH} L ${x0 + rectW * 0.4} ${y0 + rectH - 4.5} L ${x0 + rectW * 0.6} ${y0 + rectH - 4.5} L ${x0 + rectW * 0.64} ${y0 + rectH}`}
              fill="none"
              stroke={strokeBlue}
              strokeWidth={1.5}
            />
          )}
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + rectH - basePx / 2 + 1.5,
            rectW - 12,
            params.tt_assembly === 'tape'
              ? rectW < 150
                ? `Скотч ${wMm}×${baseMm}`
                : `Клеевой клапан (скотч) ${wMm}×${baseMm}`
              : rectW < 150
              ? `Замок ${wMm}×${baseMm}`
              : `Дно / вырубной замок ${wMm}×${baseMm}`,
            9.5,
            baseTextColor,
            600
          )}

          {renderVDim(
            y0 + basePx,
            y0 + basePx + halfMidPx,
            x0 + rectW + 20,
            x0 + rectW,
            x0 + rectW,
            `${housePanelMm} мм`,
            false,
            11
          )}
          {renderVDim(
            y0 + rectH - basePx,
            y0 + rectH,
            x0 + rectW + 20,
            x0 + rectW,
            x0 + rectW,
            `${baseMm} мм`,
            true,
            10
          )}
        </g>
      )}

      {/* ВАРИАНТ 2: ЕВРОБУКЛЕТ / ПРИЗМА (2 СГИБА / 3 ПОЛОСЫ) */}
      {kind === 'booklet_2fold' && (
        <g>
          <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />
          <line
            x1={x0 + rectW / 3}
            y1={y0}
            x2={x0 + rectW / 3}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.8}
            strokeDasharray="5 3"
          />
          <line
            x1={x0 + (rectW * 2) / 3}
            y1={y0}
            x2={x0 + (rectW * 2) / 3}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.8}
            strokeDasharray="5 3"
          />
          {[0, 1, 2].map((idx) => {
            const partW = Math.round((wMm / 3) * 10) / 10;
            const pxStart = x0 + (rectW * idx) / 3;
            const pxEnd = x0 + (rectW * (idx + 1)) / 3;
            const midPanelX = (pxStart + pxEnd) / 2;
            return (
              <g key={idx}>
                <rect
                  x={pxStart + 8}
                  y={y0 + 14}
                  width={Math.max(12, rectW / 3 - 16)}
                  height={16}
                  rx={2}
                  fill={fillAccent}
                />
                {renderBoundedText(
                  midPanelX,
                  y0 + rectH / 2 + 4,
                  rectW / 3 - 8,
                  catLower === 'table_tents' ? `Грань ${idx + 1}` : `Полоса ${idx + 1}`,
                  10.5,
                  textColor,
                  600
                )}
                {renderHDim(pxStart, pxEnd, y0 + rectH + 20, y0 + rectH, y0 + rectH, `${partW}`, 10)}
              </g>
            );
          })}
        </g>
      )}

      {/* ВАРИАНТ 3: БУКЛЕТ С 1 СГИБОМ / ДВОЙНАЯ ОТКРЫТКА */}
      {kind === 'booklet_1fold' && (
        <g>
          {hasEnvelope && (
            <g opacity={0.85}>
              <rect
                x={x0 + 8}
                y={y0 - 8}
                width={rectW}
                height={rectH}
                rx={3}
                fill={stackFill2}
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              <polyline
                points={`${x0 + 8},${y0 - 8} ${x0 + 8 + rectW / 2},${y0 + 18} ${x0 + 8 + rectW},${y0 - 8}`}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
            </g>
          )}
          <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />
          <line
            x1={x0 + rectW / 2}
            y1={y0}
            x2={x0 + rectW / 2}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.8}
            strokeDasharray="5 3"
          />
          <rect
            x={x0 + 12}
            y={y0 + 14}
            width={Math.max(18, rectW / 2 - 24)}
            height={rectH - 28}
            rx={3}
            fill="none"
            stroke={strokeBlue}
            strokeWidth={1}
            opacity={0.45}
          />
          <rect
            x={x0 + rectW / 2 + 12}
            y={y0 + 14}
            width={Math.max(18, rectW / 2 - 24)}
            height={rectH - 28}
            rx={3}
            fill="none"
            stroke={strokeBlue}
            strokeWidth={1}
            opacity={0.45}
          />
          {renderBoundedText(x0 + rectW / 4, y0 + rectH / 2 + 4, rectW / 2 - 12, 'Створка 1', 11, textColor, 600)}
          {renderBoundedText(
            x0 + (rectW * 3) / 4,
            y0 + rectH / 2 + 4,
            rectW / 2 - 12,
            'Створка 2',
            11,
            textColor,
            600
          )}
          {renderHDim(
            x0,
            x0 + rectW / 2,
            y0 + rectH + 20,
            y0 + rectH,
            y0 + rectH,
            `${Math.round((wMm / 2) * 10) / 10} мм`,
            10.5
          )}
          {renderHDim(
            x0 + rectW / 2,
            x0 + rectW,
            y0 + rectH + 20,
            y0 + rectH,
            y0 + rectH,
            `${Math.round((wMm / 2) * 10) / 10} мм`,
            10.5
          )}
        </g>
      )}

      {/* ВАРИАНТ 4: ПЕРЕКИДНОЙ НАСТЕННЫЙ КАЛЕНДАРЬ И КАЛЕНДАРЬ «ТРИО» */}
      {kind === 'calendar_wall' && (
        <g>
          {isTrioCalendar ? (
            <>
              {/* Квартальный календарь «Трио» (Шпигель + 3 блока на 3 пружинах + курсор) */}
              <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />
              {/* Люверс сверху */}
              <circle
                cx={x0 + rectW / 2}
                cy={y0 + 7}
                r={3.2}
                fill={bgColor}
                stroke={dimColor}
                strokeWidth={1.8}
              />
              {/* Верхний шпигель */}
              <rect
                x={x0 + 6}
                y={y0 + 13}
                width={rectW - 12}
                height={rectH * 0.22}
                rx={2}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.1}
              />
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + 13 + rectH * 0.13,
                rectW - 18,
                'Шпигель (шапка)',
                9.5,
                textColor,
                600
              )}
              {/* 3 пружины и 3 квартальных численника */}
              {[0, 1, 2].map((bIdx) => {
                const springY = y0 + rectH * (0.39 + bIdx * 0.2);
                const blockY = springY + 3;
                const blockH = rectH * 0.15;
                return (
                  <g key={bIdx}>
                    {Array.from({ length: 9 }).map((_, sIdx) => {
                      const sx = x0 + 10 + (sIdx * (rectW - 20)) / 8;
                      return (
                        <rect
                          key={sIdx}
                          x={sx - 1.5}
                          y={springY - 2.5}
                          width={3}
                          height={5}
                          rx={1}
                          fill={dimColor}
                        />
                      );
                    })}
                    <rect
                      x={x0 + 8}
                      y={blockY}
                      width={rectW - 16}
                      height={blockH}
                      rx={2}
                      fill={isDark ? 'rgba(15, 23, 42, 0.55)' : '#ffffff'}
                      stroke={strokeBlue}
                      strokeWidth={1}
                    />
                    {bIdx === 1 && (
                      <>
                        <line
                          x1={x0 + 2}
                          y1={blockY + blockH / 2}
                          x2={x0 + rectW - 2}
                          y2={blockY + blockH / 2}
                          stroke="#ef4444"
                          strokeWidth={1.1}
                        />
                        <rect
                          x={x0 + rectW / 2 - 8}
                          y={blockY + blockH / 2 - 4.5}
                          width={16}
                          height={9}
                          rx={1.5}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth={1.6}
                        />
                      </>
                    )}
                  </g>
                );
              })}
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH - 5,
                rectW - 12,
                'Трио: 3 блока + курсор',
                9.5,
                textColor,
                600
              )}
            </>
          ) : (
            <>
              <rect
                x={x0 + 4}
                y={y0 + 4}
                width={rectW}
                height={rectH}
                fill={stackFill1}
                stroke={stackStroke}
                strokeWidth={1.2}
              />
              <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />

              {Array.from({ length: 11 }).map((_, idx) => {
                const loopX = x0 + 14 + (idx * (rectW - 28)) / 10;
                return (
                  <rect
                    key={idx}
                    x={loopX - 2.5}
                    y={y0 - 5.5}
                    width={5}
                    height={10}
                    rx={2}
                    fill={dimColor}
                  />
                );
              })}
              <path
                d={`M ${x0 + rectW / 2 - 14} ${y0} A 14 14 0 0 0 ${x0 + rectW / 2 + 14} ${y0}`}
                fill={bgColor}
                stroke={strokeBlue}
                strokeWidth={1.5}
              />
              <path
                d={`M ${x0 + rectW / 2 - 8} ${y0} A 8 8 0 0 1 ${x0 + rectW / 2 + 8} ${y0}`}
                fill="none"
                stroke={dimColor}
                strokeWidth={1.8}
              />

              <rect
                x={x0 + 14}
                y={y0 + rectH * 0.52}
                width={rectW - 28}
                height={rectH * 0.35}
                fill={isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.7)'}
                stroke={strokeBlue}
                strokeWidth={1}
                rx={4}
              />
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH * 0.3,
                rectW - 16,
                'Перекидной блок',
                12,
                textColor,
                600
              )}
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH * 0.41,
                rectW - 16,
                `${pagesCount} листов + ригель`,
                11,
                subTextColor,
                500
              )}
            </>
          )}
        </g>
      )}

      {/* ВАРИАНТ 5: МНОГОСТРАНИЧНЫЙ КАТАЛОГ / ЖУРНАЛ / БРОШЮРА / МНОГОСТРАНИЧНОЕ МЕНЮ */}
      {kind === 'catalog' && (
        <g>
          <rect
            x={x0 + 6}
            y={y0 + 5}
            width={rectW}
            height={rectH}
            fill={stackFill2}
            stroke={stackStroke}
            strokeWidth={1.2}
          />
          <rect
            x={x0 + 3}
            y={y0 + 2.5}
            width={rectW}
            height={rectH}
            fill={stackFill1}
            stroke={stackStroke}
            strokeWidth={1.2}
          />
          <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />

          {/* Динамическая отрисовка выбранного типа скрепления (скрепка, пружина, КБС, болты, кольца, шнурок) */}
          {renderBindingElements(bindingType)}

          <rect
            x={x0 + 24}
            y={y0 + 16}
            width={Math.max(24, rectW - 36)}
            height={Math.max(18, rectH * 0.2)}
            rx={3}
            fill={fillAccent}
            stroke={strokeBlue}
            strokeWidth={1}
          />

          {renderBoundedText(
            x0 + rectW / 2 + 6,
            y0 + rectH * 0.54,
            rectW - 24,
            catLower === 'menus'
              ? 'Многостраничное меню'
              : nameLower.includes('журнал') || kindLower.includes('журнал')
              ? 'Журнал'
              : 'Каталог / Брошюра',
            11.5,
            textColor,
            600
          )}
          {renderBoundedText(
            x0 + rectW / 2 + 6,
            y0 + rectH * 0.54 + 15,
            rectW - 24,
            getBindingLabel(bindingType),
            10.5,
            subTextColor,
            600
          )}
          {renderBoundedText(
            x0 + rectW / 2 + 6,
            y0 + rectH * 0.54 + 30,
            rectW - 24,
            `Обложка + ${pagesCount} стр.`,
            10,
            subTextColor,
            500
          )}
        </g>
      )}

      {/* ВАРИАНТ 6: БЛОКНОТ / ПЛАНЕР (ДИНАМИЧЕСКАЯ ПРУЖИНА СВЕРХУ / СБОКУ / КБС / РЕЗИНКА) */}
      {kind === 'notepad_spiral' && (
        <g>
          <rect
            x={x0 + 5}
            y={y0 + 5}
            width={rectW}
            height={rectH}
            rx={3}
            fill={stackFill2}
            stroke={stackStroke}
            strokeWidth={1.2}
          />
          <rect
            x={x0 + 2.5}
            y={y0 + 2.5}
            width={rectW}
            height={rectH}
            rx={3}
            fill={stackFill1}
            stroke={stackStroke}
            strokeWidth={1.2}
          />
          {params.planner_opts === 'hard' && (
            <rect
              x={x0 - 2}
              y={y0 - 2}
              width={rectW + 4}
              height={rectH + 4}
              rx={4}
              fill="none"
              stroke={strokeBlue}
              strokeWidth={2.2}
            />
          )}
          <rect x={x0} y={y0} width={rectW} height={rectH} rx={3} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />

          {/* Динамическое скрепление блокнота / планера */}
          {renderBindingElements(bindingType)}

          {/* Эластичная резинка для планера, если выбрана */}
          {params.planner_opts === 'elastic' && (
            <rect
              x={x0 + rectW * 0.83}
              y={y0 - 2}
              width={7}
              height={rectH + 4}
              rx={2}
              fill={strokeBlue}
              opacity={0.85}
            />
          )}

          {[0.44, 0.56, 0.68, 0.8].map((r, i) => (
            <line
              key={i}
              x1={x0 + 18}
              y1={y0 + rectH * r}
              x2={x0 + rectW - (params.planner_opts === 'elastic' ? 24 : 14)}
              y2={y0 + rectH * r}
              stroke={strokeBlue}
              strokeWidth={1.1}
              strokeDasharray="3 3"
              opacity={0.65}
            />
          ))}
          {renderBoundedText(
            x0 + rectW / 2 + 4,
            y0 + rectH * 0.22,
            rectW - 22,
            `${catLower === 'planners' ? 'Планер' : 'Блокнот'} (${pagesCount} стр.)`,
            11.5,
            textColor,
            600
          )}
          {renderBoundedText(
            x0 + rectW / 2 + 4,
            y0 + rectH * 0.22 + 14,
            rectW - 22,
            params.planner_opts === 'elastic'
              ? `${getBindingLabel(bindingType)} + резинка`
              : params.planner_opts === 'hard'
              ? `Твёрдая обложка • ${getBindingLabel(bindingType)}`
              : getBindingLabel(bindingType),
            10,
            subTextColor,
            600
          )}
        </g>
      )}

      {/* ВАРИАНТ 7: ВЫРУБНАЯ ПАПКА С КАРМАНОМ ПОД А4 */}
      {kind === 'folder' && (
        <g>
          <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />
          <line
            x1={x0 + rectW * 0.48}
            y1={y0}
            x2={x0 + rectW * 0.48}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <line
            x1={x0 + rectW * 0.52}
            y1={y0}
            x2={x0 + rectW * 0.52}
            y2={y0 + rectH}
            stroke={strokeBlue}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <polygon
            points={`${x0 + rectW * 0.52},${y0 + rectH * 0.62} ${x0 + rectW},${y0 + rectH * 0.5} ${x0 + rectW},${y0 + rectH} ${x0 + rectW * 0.52},${y0 + rectH}`}
            fill={fillGrey}
            stroke={strokeBlue}
            strokeWidth={1.6}
          />
          <rect
            x={x0 + rectW * 0.64}
            y={y0 + rectH * 0.73}
            width={rectW * 0.24}
            height={rectH * 0.16}
            rx={2}
            fill={bgColor}
            stroke={strokeBlue}
            strokeWidth={1.1}
          />
          {Boolean(params.foil_title) && (
            <g>
              <rect
                x={x0 + rectW * 0.1}
                y={y0 + rectH * 0.2}
                width={rectW * 0.28}
                height={18}
                rx={3}
                fill={fillAccent}
                stroke={goldColor}
                strokeWidth={1.4}
              />
              {renderBoundedText(
                x0 + rectW * 0.24,
                y0 + rectH * 0.2 + 12,
                rectW * 0.28 - 6,
                '★ ФОЛЬГА',
                9.5,
                goldColor,
                700
              )}
            </g>
          )}
          {renderBoundedText(
            x0 + rectW * 0.24,
            y0 + rectH * 0.5,
            rectW * 0.44 - 8,
            'Лицевая сторона',
            10.5,
            textColor,
            600
          )}
          {renderBoundedText(
            x0 + rectW * 0.76,
            y0 + rectH * 0.34,
            rectW * 0.44 - 8,
            'Карман + визитка',
            10.5,
            subTextColor,
            500
          )}
        </g>
      )}

      {/* ВАРИАНТ 8: КОРОБКА УПАКОВОЧНАЯ (ШТАНЦФОРМА С КЛАПАНАМИ) */}
      {kind === 'box' && (
        <g>
          <rect x={x0} y={y0} width={rectW} height={rectH} rx={3} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />
          <rect
            x={x0 + rectW * 0.18}
            y={y0 + rectH * 0.18}
            width={rectW * 0.64}
            height={rectH * 0.64}
            fill={fillAccent}
            stroke={strokeBlue}
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />
          <line x1={x0} y1={y0 + rectH * 0.18} x2={x0 + rectW} y2={y0 + rectH * 0.18} stroke={strokeBlue} strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1={x0} y1={y0 + rectH * 0.82} x2={x0 + rectW} y2={y0 + rectH * 0.82} stroke={strokeBlue} strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1={x0 + rectW * 0.18} y1={y0} x2={x0 + rectW * 0.18} y2={y0 + rectH} stroke={strokeBlue} strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1={x0 + rectW * 0.82} y1={y0} x2={x0 + rectW * 0.82} y2={y0 + rectH} stroke={strokeBlue} strokeWidth={1.2} strokeDasharray="4 3" />
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + rectH / 2 - 3,
            rectW - 16,
            'Развёртка коробки',
            11.5,
            textColor,
            600
          )}
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + rectH / 2 + 13,
            rectW - 16,
            params.box_gluing === '3pt' ? 'Склейка в 3 точках' : 'Вырубка + биговка',
            10.5,
            subTextColor,
            500
          )}
        </g>
      )}

      {/* ВАРИАНТ 9: КОЛОДА КАРТ */}
      {kind === 'card_deck' && (
        <g>
          <rect
            x={x0 + 8}
            y={y0 + 6}
            width={rectW}
            height={rectH}
            rx={12}
            fill={stackFill2}
            stroke={stackStroke}
            strokeWidth={1.2}
          />
          <rect
            x={x0 + 4}
            y={y0 + 3}
            width={rectW}
            height={rectH}
            rx={12}
            fill={stackFill1}
            stroke={stackStroke}
            strokeWidth={1.2}
          />
          <rect
            x={x0}
            y={y0}
            width={rectW}
            height={rectH}
            rx={12}
            fill={fillBlue}
            stroke={strokeBlue}
            strokeWidth={2}
          />
          <rect
            x={x0 + 8}
            y={y0 + 8}
            width={rectW - 16}
            height={rectH - 16}
            rx={8}
            fill="none"
            stroke={strokeBlue}
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
          <polygon
            points={`${x0 + rectW / 2},${y0 + 18} ${x0 + rectW / 2 + 10},${y0 + 32} ${x0 + rectW / 2},${y0 + 46} ${x0 + rectW / 2 - 10},${y0 + 32}`}
            fill={fillAccent}
            stroke={strokeBlue}
            strokeWidth={1.3}
          />
          {renderBoundedText(x0 + rectW / 2, y0 + rectH * 0.6, rectW - 20, 'Колода карт', 12, textColor, 600)}
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + rectH * 0.6 + 15,
            rectW - 20,
            pagesCount > 1 ? `${pagesCount} карт • R5` : 'Скругление углов R5',
            10.5,
            subTextColor,
            500
          )}
          {renderBoundedText(
            x0 + rectW / 2,
            y0 + rectH * 0.6 + 29,
            rectW - 20,
            params.deck_box === 'tuckbox'
              ? '+ Коробка с клапаном'
              : params.deck_box === 'lid_bottom'
              ? '+ Коробка крышка-дно'
              : params.deck_box === 'pouch'
              ? '+ Бархатный мешочек'
              : 'Упаковка в термопленку',
            9.5,
            subTextColor,
            600
          )}
        </g>
      )}

      {/* ВАРИАНТ 10: НАКЛЕЙКИ, СТИКЕРПАКИ И 3D СТИКЕРЫ */}
      {kind === 'sticker_pack' && (
        <g>
          {nameLower.includes('стикерпак') || nameLower.includes('набор') || kindLower.includes('стикерпак') ? (
            <>
              <rect
                x={x0}
                y={y0}
                width={rectW}
                height={rectH}
                rx={8}
                fill={fillBlue}
                stroke={strokeBlue}
                strokeWidth={2}
              />
              {params.kiss_cut_complexity === 'high' ? (
                /* 9 контуров стикеров (сетка 3×3) */
                [0.2, 0.46, 0.72].map((ry, rIdx) =>
                  [0.22, 0.5, 0.78].map((cxRatio, cIdx) => (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={x0 + rectW * cxRatio - rectW * 0.1}
                      y={y0 + rectH * ry - rectH * 0.08}
                      width={rectW * 0.2}
                      height={rectH * 0.16}
                      rx={5}
                      fill={fillAccent}
                      stroke={strokeBlue}
                      strokeWidth={1.4}
                      strokeDasharray="3 2"
                    />
                  ))
                )
              ) : params.kiss_cut_complexity === 'med' ? (
                /* 6 контуров стикеров (сетка 3×2) */
                [0.28, 0.62].map((ry, rIdx) =>
                  [0.22, 0.5, 0.78].map((cxRatio, cIdx) => (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={x0 + rectW * cxRatio - rectW * 0.11}
                      y={y0 + rectH * ry - rectH * 0.1}
                      width={rectW * 0.22}
                      height={rectH * 0.2}
                      rx={6}
                      fill={fillAccent}
                      stroke={strokeBlue}
                      strokeWidth={1.4}
                      strokeDasharray="3 2"
                    />
                  ))
                )
              ) : (
                /* Стандартно: 4 контура стикеров на листе (Kiss-Cut) */
                <>
                  <circle
                    cx={x0 + rectW * 0.3}
                    cy={y0 + rectH * 0.28}
                    r={Math.min(rectW, rectH) * 0.16}
                    fill={fillAccent}
                    stroke={strokeBlue}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                  <rect
                    x={x0 + rectW * 0.54}
                    y={y0 + rectH * 0.15}
                    width={rectW * 0.34}
                    height={rectH * 0.25}
                    rx={6}
                    fill={fillAccent}
                    stroke={strokeBlue}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                  <rect
                    x={x0 + rectW * 0.14}
                    y={y0 + rectH * 0.52}
                    width={rectW * 0.36}
                    height={rectH * 0.24}
                    rx={8}
                    fill={fillAccent}
                    stroke={strokeBlue}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                  <circle
                    cx={x0 + rectW * 0.7}
                    cy={y0 + rectH * 0.64}
                    r={Math.min(rectW, rectH) * 0.15}
                    fill={fillAccent}
                    stroke={strokeBlue}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                </>
              )}
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH - 10,
                rectW - 16,
                params.kiss_cut_complexity === 'high'
                  ? 'Стикерпак (11+ контуров Kiss-Cut)'
                  : params.kiss_cut_complexity === 'med'
                  ? 'Стикерпак (6–10 контуров Kiss-Cut)'
                  : 'Стикерпак (Kiss-Cut)',
                10.5,
                textColor,
                600
              )}
            </>
          ) : (
            <>
              {params.cut_mode === 'sheets' && (
                <rect
                  x={x0 - 4}
                  y={y0 - 4}
                  width={rectW + 8}
                  height={rectH + 8}
                  rx={4}
                  fill="none"
                  stroke={dimColor}
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                />
              )}
              <rect
                x={x0}
                y={y0}
                width={rectW}
                height={rectH}
                rx={18}
                fill={fillBlue}
                stroke={strokeBlue}
                strokeWidth={2}
              />
              <rect
                x={x0 + 7}
                y={y0 + 7}
                width={rectW - 14}
                height={rectH - 14}
                rx={13}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.4}
                strokeDasharray="4 3"
              />
              <path
                d={`M ${x0 + 18} ${y0 + 20} Q ${x0 + rectW / 2} ${y0 + 9} ${x0 + rectW - 18} ${y0 + 20}`}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.85}
              />
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH / 2 - 2,
                rectW - 20,
                catLower === 'stickers_3d' || nameLower.includes('3d')
                  ? '3D-стикер (смола)'
                  : 'Наклейка / Стикер',
                11.5,
                textColor,
                600
              )}
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH / 2 + 14,
                rectW - 20,
                catLower === 'stickers_3d' || nameLower.includes('3d')
                  ? 'Объемная линза'
                  : params.cut_mode === 'diecut'
                  ? 'Поштучная вырубка Die-Cut'
                  : 'Надсечка на листах Kiss-Cut',
                10.5,
                subTextColor,
                500
              )}
            </>
          )}
        </g>
      )}

      {/* ВАРИАНТ 11: СЕРТИФИКАТ / ДИПЛОМ / ФИРМЕННЫЙ БЛАНК */}
      {kind === 'certificate' && (
        <g>
          {hasEnvelope && (
            <g opacity={0.85}>
              <rect
                x={x0 + 8}
                y={y0 - 8}
                width={rectW}
                height={rectH}
                rx={3}
                fill={stackFill2}
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              <polyline
                points={`${x0 + 8},${y0 - 8} ${x0 + 8 + rectW / 2},${y0 + 16} ${x0 + 8 + rectW},${y0 - 8}`}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
            </g>
          )}
          <rect x={x0} y={y0} width={rectW} height={rectH} fill={fillBlue} stroke={strokeBlue} strokeWidth={2} />
          {catLower === 'blanks' || nameLower.includes('бланк') ? (
            <>
              {/* Если включена проклейка в отрывные книжки (блоки) */}
              {Boolean(params.blank_gluing) && (
                <rect
                  x={x0}
                  y={y0}
                  width={rectW}
                  height={7}
                  fill={fillGrey}
                  stroke={strokeBlue}
                  strokeWidth={1.5}
                />
              )}
              {/* Шапка фирменного бланка */}
              <rect
                x={x0 + 12}
                y={y0 + 12}
                width={22}
                height={14}
                rx={2.5}
                fill={strokeBlue}
              />
              <line
                x1={x0 + 40}
                y1={y0 + 16}
                x2={x0 + rectW - 14}
                y2={y0 + 16}
                stroke={strokeBlue}
                strokeWidth={2}
              />
              <line
                x1={x0 + 40}
                y1={y0 + 23}
                x2={x0 + rectW - 28}
                y2={y0 + 23}
                stroke={strokeBlue}
                strokeWidth={1.2}
                opacity={0.7}
              />
              <line
                x1={x0 + 12}
                y1={y0 + 33}
                x2={x0 + rectW - 12}
                y2={y0 + 33}
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              {Boolean(params.blank_numbering) && (
                <text
                  x={x0 + rectW - 12}
                  y={y0 + 45}
                  textAnchor="end"
                  fill="#ef4444"
                  fontSize={9.5}
                  fontWeight={700}
                >
                  № 000125
                </text>
              )}
              {[0.46, 0.56, 0.66, 0.76].map((r, idx) => (
                <line
                  key={idx}
                  x1={x0 + 14}
                  y1={y0 + rectH * r}
                  x2={x0 + rectW - 18}
                  y2={y0 + rectH * r}
                  stroke={strokeBlue}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.6}
                />
              ))}
              {Boolean(params.blank_perf) && (
                <line
                  x1={x0}
                  y1={y0 + rectH * 0.82}
                  x2={x0 + rectW}
                  y2={y0 + rectH * 0.82}
                  stroke="#ef4444"
                  strokeWidth={1.6}
                  strokeDasharray="4 2"
                />
              )}
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH - 10,
                rectW - 16,
                params.blank_gluing
                  ? 'Самокопирующийся / отрывной блок'
                  : params.blank_perf
                  ? 'Фирменный бланк с перфорацией'
                  : 'Фирменный бланк',
                10,
                textColor,
                600
              )}
            </>
          ) : (
            <>
              <rect
                x={x0 + 7}
                y={y0 + 7}
                width={rectW - 14}
                height={rectH - 14}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              <rect
                x={x0 + 11}
                y={y0 + 11}
                width={rectW - 22}
                height={rectH - 22}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={0.9}
                strokeDasharray="3 2"
              />
              <line
                x1={x0 + 22}
                y1={y0 + rectH * 0.28}
                x2={x0 + rectW - 22}
                y2={y0 + rectH * 0.28}
                stroke={strokeBlue}
                strokeWidth={2}
              />
              <line
                x1={x0 + 26}
                y1={y0 + rectH * 0.44}
                x2={x0 + rectW - 26}
                y2={y0 + rectH * 0.44}
                stroke={strokeBlue}
                strokeWidth={1.1}
                strokeDasharray="4 3"
              />
              <line
                x1={x0 + 26}
                y1={y0 + rectH * 0.56}
                x2={x0 + rectW - 36}
                y2={y0 + rectH * 0.56}
                stroke={strokeBlue}
                strokeWidth={1.1}
                strokeDasharray="4 3"
              />
              <circle
                cx={x0 + rectW - 26}
                cy={y0 + rectH - 24}
                r={8}
                fill={fillAccent}
                stroke={params.cert_finish === 'foil' ? goldColor : strokeBlue}
                strokeWidth={1.6}
              />
              {params.cert_finish === 'numbering' && (
                <text
                  x={x0 + 18}
                  y={y0 + 24}
                  fill="#ef4444"
                  fontSize={9.5}
                  fontWeight={700}
                >
                  № 000125
                </text>
              )}
              {renderBoundedText(
                x0 + rectW / 2 - 6,
                y0 + rectH - 18,
                rectW - 36,
                params.cert_finish === 'foil'
                  ? 'Сертификат + фольга'
                  : hasEnvelope
                  ? 'Сертификат + конверт'
                  : 'Сертификат / Диплом',
                10.5,
                textColor,
                600
              )}
            </>
          )}
        </g>
      )}

      {/* ВАРИАНТ 12: КАРМАННЫЙ КАЛЕНДАРЬ (СКРУГЛЕННЫЕ УГЛЫ) */}
      {kind === 'pocket_calendar' && (
        <g>
          <rect
            x={x0}
            y={y0}
            width={rectW}
            height={rectH}
            rx={14}
            fill={fillBlue}
            stroke={strokeBlue}
            strokeWidth={2}
          />
          <rect
            x={x0 + 7}
            y={y0 + 7}
            width={rectW - 14}
            height={rectH - 14}
            rx={9}
            fill="none"
            stroke={strokeBlue}
            strokeWidth={1.1}
            strokeDasharray="4 3"
            opacity={0.75}
          />
          {renderBoundedText(x0 + rectW / 2, y0 + rectH / 2 + 4, rectW - 18, 'Карманный календарь', 11, textColor, 600)}
        </g>
      )}

      {/* ВАРИАНТ 13: ЛИСТОВЫЕ ИЗДЕЛИЯ (ВИЗИТКИ, ЛИСТОВКИ, МЕНЮ, ОТКРЫТКИ, ПЛАКАТЫ) */}
      {kind === 'flat' && (
        <g>
          {hasEnvelope && (
            <g opacity={0.85}>
              <rect
                x={x0 + 8}
                y={y0 - 8}
                width={rectW}
                height={rectH}
                rx={3}
                fill={stackFill2}
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              <polyline
                points={`${x0 + 8},${y0 - 8} ${x0 + 8 + rectW / 2},${y0 + 16} ${x0 + 8 + rectW},${y0 - 8}`}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
            </g>
          )}
          <rect
            x={x0}
            y={y0}
            width={rectW}
            height={rectH}
            rx={params.corner_round ? 12 : 0}
            fill={fillBlue}
            stroke={strokeBlue}
            strokeWidth={2}
          />
          <rect
            x={x0 + 7}
            y={y0 + 7}
            width={rectW - 14}
            height={rectH - 14}
            rx={params.corner_round ? 8 : 0}
            fill="none"
            stroke={strokeBlue}
            strokeWidth={1.1}
            strokeDasharray="4 3"
            opacity={0.75}
          />

          {catLower === 'menus' ? (
            <>
              <rect
                x={x0 + rectW * 0.25}
                y={y0 + 16}
                width={rectW * 0.5}
                height={10}
                rx={2}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.2}
              />
              {[0.36, 0.48, 0.6].map((r, idx) => (
                <g key={idx}>
                  <line
                    x1={x0 + 16}
                    y1={y0 + rectH * r}
                    x2={x0 + rectW - 36}
                    y2={y0 + rectH * r}
                    stroke={strokeBlue}
                    strokeWidth={1.2}
                    strokeDasharray="2 2"
                  />
                  <rect
                    x={x0 + rectW - 30}
                    y={y0 + rectH * r - 3}
                    width={14}
                    height={6}
                    rx={1.5}
                    fill={strokeBlue}
                  />
                </g>
              ))}
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH - 14,
                rectW - 18,
                params.corner_round ? 'Листовое меню (скругл. углы)' : 'Листовое меню',
                11,
                textColor,
                600
              )}
            </>
          ) : catLower === 'postcards' ? (
            <>
              <circle
                cx={x0 + rectW / 2}
                cy={y0 + rectH * 0.36}
                r={Math.min(rectW, rectH) * 0.14}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              <line
                x1={x0 + 22}
                y1={y0 + rectH * 0.62}
                x2={x0 + rectW - 22}
                y2={y0 + rectH * 0.62}
                stroke={strokeBlue}
                strokeWidth={1.4}
              />
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH - 14,
                rectW - 18,
                hasEnvelope ? 'Открытка + конверт' : 'Открытка / Приглашение',
                10.5,
                textColor,
                600
              )}
            </>
          ) : catLower === 'posters' ? (
            <>
              {Boolean(params.poster_tape) && (
                <g stroke="#ef4444" strokeWidth={2.5}>
                  <line x1={x0 + 4} y1={y0 + 12} x2={x0 + 12} y2={y0 + 4} />
                  <line x1={x0 + rectW - 12} y1={y0 + 4} x2={x0 + rectW - 4} y2={y0 + 12} />
                  <line x1={x0 + 4} y1={y0 + rectH - 12} x2={x0 + 12} y2={y0 + rectH - 4} />
                  <line x1={x0 + rectW - 12} y1={y0 + rectH - 4} x2={x0 + rectW - 4} y2={y0 + rectH - 12} />
                </g>
              )}
              <rect
                x={x0 + 14}
                y={y0 + 14}
                width={rectW - 28}
                height={rectH * 0.48}
                rx={3}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.2}
              />
              <circle
                cx={x0 + rectW * 0.38}
                cy={y0 + rectH * 0.32}
                r={Math.min(rectW, rectH) * 0.08}
                fill={strokeBlue}
                opacity={0.75}
              />
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH * 0.78,
                rectW - 18,
                params.poster_tape ? 'Плакат + скотч по углам' : 'Плакат / Афиша',
                11,
                textColor,
                600
              )}
            </>
          ) : catLower === 'business_cards' ? (
            <>
              <rect
                x={x0 + 16}
                y={y0 + 16}
                width={22}
                height={14}
                rx={2.5}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.2}
              />
              <line
                x1={x0 + 16}
                y1={y0 + rectH * 0.56}
                x2={x0 + rectW * 0.68}
                y2={y0 + rectH * 0.56}
                stroke={strokeBlue}
                strokeWidth={1.6}
              />
              <line
                x1={x0 + 16}
                y1={y0 + rectH * 0.7}
                x2={x0 + rectW * 0.52}
                y2={y0 + rectH * 0.7}
                stroke={strokeBlue}
                strokeWidth={1.1}
                opacity={0.7}
              />
              {renderBoundedText(x0 + rectW / 2, y0 + rectH - 12, rectW - 18, 'Визитка', 10.5, subTextColor, 600)}
            </>
          ) : isWideFormatSectionOrCategory(undefined, prod.category) ? (
            (() => {
              const wfFlatSeamLayout = computeBannerSeamLayout({
                x0,
                y0,
                rectW,
                rectH,
                widthMm: wMm,
                heightMm: hMm,
              });
              const defaultFlatCaptionY = y0 + rectH - 13;
              let flatSeamLabelY =
                y0 +
                Math.max(
                  24,
                  Math.min(defaultFlatCaptionY - y0 - 18, Math.round(rectH * 0.42))
                );
              let flatCaptionY = defaultFlatCaptionY;
              if (
                wfFlatSeamLayout.hasSeams &&
                wfFlatSeamLayout.orientation === 'horizontal' &&
                wfFlatSeamLayout.seamPositionsPx.length > 0
              ) {
                const topInner = y0 + 8;
                const botInner = y0 + rectH - 8;
                const firstSeam = wfFlatSeamLayout.seamPositionsPx[0];
                if (wfFlatSeamLayout.seamPositionsPx.length === 1) {
                  if (botInner - firstSeam >= 24) {
                    flatSeamLabelY = Math.round((topInner + firstSeam) / 2) + 3;
                    flatCaptionY = Math.round((firstSeam + botInner) / 2) + 3;
                  } else {
                    const mid0 = Math.round((topInner + firstSeam) / 2);
                    flatSeamLabelY = mid0 - 8;
                    flatCaptionY = mid0 + 11;
                  }
                } else {
                  const secondSeam = wfFlatSeamLayout.seamPositionsPx[1];
                  if (firstSeam - topInner >= 18 && secondSeam - firstSeam >= 18) {
                    flatSeamLabelY = Math.round((topInner + firstSeam) / 2) + 3;
                    flatCaptionY = Math.round((firstSeam + secondSeam) / 2) + 3;
                  }
                }
              }
              const seamLabelText = `Склейка: ${formatWideFormatStripsBreakdown(
                wfFlatSeamLayout.stripSizesCm
              )}`;
              return wfFlatSeamLayout.hasSeams ? (
                <>
                  {renderSeamLines(wfFlatSeamLayout)}
                  {renderMaskedBoundedText(
                    x0 + rectW / 2,
                    flatSeamLabelY,
                    rectW - 22,
                    seamLabelText,
                    fillBlue,
                    10,
                    strokeBlue,
                    600
                  )}
                  {renderMaskedBoundedText(
                    x0 + rectW / 2,
                    flatCaptionY,
                    rectW - 18,
                    'Линия реза и вылеты',
                    fillBlue,
                    10.5,
                    subTextColor,
                    600
                  )}
                </>
              ) : (
                <>
                  <rect
                    x={x0 + 14}
                    y={y0 + 14}
                    width={rectW - 28}
                    height={rectH * 0.34}
                    rx={3}
                    fill={fillAccent}
                    stroke={strokeBlue}
                    strokeWidth={1.1}
                  />
                  <line
                    x1={x0 + 16}
                    y1={y0 + rectH * 0.58}
                    x2={x0 + rectW - 16}
                    y2={y0 + rectH * 0.58}
                    stroke={strokeBlue}
                    strokeWidth={1.3}
                  />
                  <line
                    x1={x0 + 16}
                    y1={y0 + rectH * 0.68}
                    x2={x0 + rectW - 28}
                    y2={y0 + rectH * 0.68}
                    stroke={strokeBlue}
                    strokeWidth={1.1}
                    opacity={0.7}
                  />
                  {renderBoundedText(
                    x0 + rectW / 2,
                    flatCaptionY,
                    rectW - 18,
                    'Линия реза и вылеты',
                    10.5,
                    subTextColor,
                    600
                  )}
                </>
              );
            })()
          ) : (
            <>
              <rect
                x={x0 + 14}
                y={y0 + 14}
                width={rectW - 28}
                height={rectH * 0.34}
                rx={3}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.1}
              />
              <line
                x1={x0 + 16}
                y1={y0 + rectH * 0.58}
                x2={x0 + rectW - 16}
                y2={y0 + rectH * 0.58}
                stroke={strokeBlue}
                strokeWidth={1.3}
              />
              <line
                x1={x0 + 16}
                y1={y0 + rectH * 0.68}
                x2={x0 + rectW - 28}
                y2={y0 + rectH * 0.68}
                stroke={strokeBlue}
                strokeWidth={1.1}
                opacity={0.7}
              />
              {renderBoundedText(
                x0 + rectW / 2,
                y0 + rectH - 13,
                rectW - 18,
                'Линия реза и вылеты',
                10.5,
                subTextColor,
                600
              )}
            </>
          )}
        </g>
      )}

      {/* ВАРИАНТ 14: ШИРОКОФОРМАТНЫЙ БАННЕР С ЛЮВЕРСАМИ */}
      {kind === 'banner' &&
        (() => {
          const rawEyeletVal =
            params.eyelets !== undefined
              ? params.eyelets
              : params.wf_eyelets !== undefined
              ? params.wf_eyelets
              : undefined;
          const hasExplicitEyeletsToggle = rawEyeletVal !== undefined;
          const eyeletsEnabled = hasExplicitEyeletsToggle
            ? Boolean(rawEyeletVal) &&
              String(rawEyeletVal).toLowerCase() !== 'false' &&
              String(rawEyeletVal).toLowerCase() !== 'none' &&
              String(rawEyeletVal).toLowerCase() !== '0'
            : true;
          const spacingMode = resolveEyeletSpacing(params);
          const hasExplicitSpacing = params.eyelets_step !== undefined;

          let bannerCaption = 'Баннер + люверсы по периметру';
          if (!eyeletsEnabled) {
            bannerCaption = 'Баннер без люверсов';
          } else if (spacingMode === 'corners') {
            bannerCaption = 'Баннер + люверсы по углам';
          } else if (hasExplicitSpacing) {
            bannerCaption = `Баннер + люверсы (шаг ${spacingMode} см)`;
          }

          const grommetLayout = computeBannerGrommetLayout({
            x0,
            y0,
            rectW,
            rectH,
            widthMm: wMm,
            heightMm: hMm,
            eyeletsEnabled,
            spacingMode,
            hemCenterInset: 5,
          });
          const seamLayout = computeBannerSeamLayout({
            x0,
            y0,
            rectW,
            rectH,
            widthMm: wMm,
            heightMm: hMm,
          });
          const innerBoxInsetX = Math.min(22, Math.max(14, Math.round(rectW * 0.16)));
          const innerBoxOffsetY = Math.max(13, Math.round(rectH * 0.23));
          const innerBoxY = y0 + innerBoxOffsetY;
          const innerBoxH = Math.max(12, Math.min(Math.round(rectH * 0.28), rectH - 38));
          const defaultCaptionY =
            y0 +
            Math.min(
              rectH - 15,
              Math.max(Math.round(rectH * 0.74), innerBoxOffsetY + innerBoxH + 15)
            );
          let captionY = defaultCaptionY;
          let seamLabelY =
            y0 +
            Math.max(
              25,
              Math.min(defaultCaptionY - y0 - 18, Math.round(rectH * 0.42))
            );
          if (
            seamLayout.hasSeams &&
            seamLayout.orientation === 'horizontal' &&
            seamLayout.seamPositionsPx.length > 0
          ) {
            const topInner = y0 + 10;
            const botInner = y0 + rectH - 10;
            const firstSeam = seamLayout.seamPositionsPx[0];
            if (seamLayout.seamPositionsPx.length === 1) {
              if (botInner - firstSeam >= 26) {
                seamLabelY = Math.round((topInner + firstSeam) / 2) + 3;
                captionY = Math.round((firstSeam + botInner) / 2) + 3;
              } else {
                const mid0 = Math.round((topInner + firstSeam) / 2);
                seamLabelY = mid0 - 8;
                captionY = mid0 + 12;
              }
            } else {
              const secondSeam = seamLayout.seamPositionsPx[1];
              if (firstSeam - topInner >= 20 && secondSeam - firstSeam >= 20) {
                seamLabelY = Math.round((topInner + firstSeam) / 2) + 3;
                captionY = Math.round((firstSeam + secondSeam) / 2) + 3;
              }
            }
          }
          const seamLabelText = `Склейка: ${formatWideFormatStripsBreakdown(
            seamLayout.stripSizesCm
          )}`;

          return (
            <g data-schematic="banner">
              <rect
                x={x0}
                y={y0}
                width={rectW}
                height={rectH}
                rx={3}
                fill={fillBlue}
                stroke={strokeBlue}
                strokeWidth={2}
              />
              {/* Швы склейки полотен при превышении ширины печати 300 см */}
              {renderSeamLines(seamLayout)}
              {/* Контур проварки края по периметру */}
              <rect
                x={x0 + 10}
                y={y0 + 10}
                width={Math.max(20, rectW - 20)}
                height={Math.max(20, rectH - 20)}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.1}
                strokeDasharray="4 3"
                opacity={0.75}
              />
              {/* Люверсы (4 угла всегда + промежуточные на точном выбранном расстоянии) */}
              {grommetLayout.points.map((pt, idx) => (
                <circle
                  key={`grommet-${idx}`}
                  data-corner-grommet={pt.isCorner ? 'true' : undefined}
                  cx={pt.cx}
                  cy={pt.cy}
                  r={grommetLayout.radius}
                  fill={bgColor}
                  stroke={strokeBlue}
                  strokeWidth={grommetLayout.strokeWidth}
                />
              ))}
              {seamLayout.hasSeams ? (
                <>
                  {renderMaskedBoundedText(
                    x0 + rectW / 2,
                    seamLabelY,
                    rectW - 26,
                    seamLabelText,
                    fillBlue,
                    10,
                    strokeBlue,
                    600
                  )}
                  {renderMaskedBoundedText(
                    x0 + rectW / 2,
                    captionY,
                    rectW - 22,
                    bannerCaption,
                    fillBlue,
                    10.5,
                    textColor,
                    600
                  )}
                </>
              ) : (
                <>
                  <rect
                    x={x0 + innerBoxInsetX}
                    y={innerBoxY}
                    width={Math.max(16, rectW - innerBoxInsetX * 2)}
                    height={innerBoxH}
                    rx={3}
                    fill={fillAccent}
                    stroke={strokeBlue}
                    strokeWidth={1.1}
                  />
                  {renderBoundedText(
                    x0 + rectW / 2,
                    captionY,
                    rectW - 22,
                    bannerCaption,
                    10.5,
                    textColor,
                    600
                  )}
                </>
              )}
            </g>
          );
        })()}

      {/* ВАРИАНТ 15: КРУЖКА С РУЧКОЙ И ОБЛАСТЬЮ ЗАПЕЧАТКИ 200×95 ММ */}
      {kind === 'mug' &&
        (() => {
          const mugW = Math.min(rectW * 0.72, 136);
          const mugH = Math.min(rectH * 0.88, 146);
          const mugX = Math.round(x0 + (rectW - mugW) / 2 - 10);
          const mugY = Math.round(y0 + (rectH - mugH) / 2 + 4);
          const printW = Math.round(mugW * 0.82);
          const printH = Math.round(mugH * 0.56);
          const printX = Math.round(mugX + (mugW - printW) / 2);
          const printY = Math.round(mugY + (mugH - printH) / 2 + 2);
          return (
            <g data-schematic="mug">
              {/* Ручка кружки справа */}
              <path
                d={`M ${mugX + mugW} ${mugY + mugH * 0.22} C ${mugX + mugW + 34} ${mugY + mugH * 0.18}, ${mugX + mugW + 34} ${mugY + mugH * 0.82}, ${mugX + mugW} ${mugY + mugH * 0.78}`}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={8}
                strokeLinecap="round"
              />
              <path
                d={`M ${mugX + mugW} ${mugY + mugH * 0.22} C ${mugX + mugW + 34} ${mugY + mugH * 0.18}, ${mugX + mugW + 34} ${mugY + mugH * 0.82}, ${mugX + mugW} ${mugY + mugH * 0.78}`}
                fill="none"
                stroke={fillBlue}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {/* Корпус кружки */}
              <rect
                x={mugX}
                y={mugY}
                width={mugW}
                height={mugH}
                rx={10}
                fill={fillBlue}
                stroke={strokeBlue}
                strokeWidth={2}
              />
              {/* Верхний ободок кружки */}
              <ellipse
                cx={mugX + mugW / 2}
                cy={mugY + 4}
                rx={mugW / 2 - 2}
                ry={5}
                fill={bgColor}
                stroke={strokeBlue}
                strokeWidth={1.5}
              />
              {/* Выделенная область запечатки 200×95 мм */}
              <rect
                x={printX}
                y={printY}
                width={printW}
                height={printH}
                rx={4}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              {renderBoundedText(
                mugX + mugW / 2,
                printY + printH / 2 - 3,
                printW - 8,
                'Зона запечатки',
                10.5,
                textColor,
                700
              )}
              {renderBoundedText(
                mugX + mugW / 2,
                printY + printH / 2 + 12,
                printW - 8,
                '200×95 мм',
                11,
                strokeBlue,
                700
              )}
            </g>
          );
        })()}

      {/* ВАРИАНТ 16: ФУТБОЛКА С ВЫДЕЛЕННОЙ ЗОНОЙ ПРИНТА НА ГРУДИ */}
      {kind === 'tshirt' &&
        (() => {
          const cx = x0 + rectW / 2;
          const topY = y0 + 6;
          const botY = y0 + rectH - 6;
          const halfW = Math.min(rectW * 0.48, 88);
          const bodyHalfW = halfW * 0.64;
          const sleeveBottomY = topY + (botY - topY) * 0.42;
          const sleeveTopY = topY + (botY - topY) * 0.16;
          const printZoneW = Math.max(46, bodyHalfW * 1.18);
          const printZoneH = Math.max(48, (botY - topY) * 0.42);
          const printZoneX = cx - printZoneW / 2;
          const printZoneY = topY + (botY - topY) * 0.25;

          return (
            <g data-schematic="tshirt">
              {/* Силуэт футболки */}
              <path
                d={`M ${cx - 22} ${topY}
                    Q ${cx} ${topY + 14} ${cx + 22} ${topY}
                    L ${cx + halfW} ${sleeveTopY}
                    L ${cx + halfW - 10} ${sleeveBottomY}
                    L ${cx + bodyHalfW} ${sleeveBottomY - 6}
                    L ${cx + bodyHalfW} ${botY}
                    L ${cx - bodyHalfW} ${botY}
                    L ${cx - bodyHalfW} ${sleeveBottomY - 6}
                    L ${cx - halfW + 10} ${sleeveBottomY}
                    L ${cx - halfW} ${sleeveTopY}
                    Z`}
                fill={fillBlue}
                stroke={strokeBlue}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {/* Воротник */}
              <path
                d={`M ${cx - 22} ${topY} Q ${cx} ${topY + 20} ${cx + 22} ${topY}`}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.6}
              />
              {/* Выделенная зона принта на груди */}
              <rect
                x={printZoneX}
                y={printZoneY}
                width={printZoneW}
                height={printZoneH}
                rx={4}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              {renderBoundedText(
                cx,
                printZoneY + printZoneH / 2 - 4,
                printZoneW - 6,
                'Принт на груди',
                10,
                textColor,
                700
              )}
              {renderBoundedText(
                cx,
                printZoneY + printZoneH / 2 + 11,
                printZoneW - 6,
                `${wMm}×${hMm} мм`,
                10.5,
                strokeBlue,
                700
              )}
            </g>
          );
        })()}

      {/* ВАРИАНТ 17: КРУГЛАЯ ПЕЧАТЬ (КОНЦЕНТРИЧЕСКИЕ КРУГИ Ø 40 ММ С МАКЕТОМ ОТТИСКА) */}
      {kind === 'stamp_round' &&
        (() => {
          const cx = x0 + rectW / 2;
          const cy = y0 + rectH / 2;
          const outerR = Math.min(rectW, rectH) * 0.46;
          const midR = outerR * 0.86;
          const innerR = outerR * 0.54;
          return (
            <g data-schematic="stamp_round">
              {/* Внешний контур оттиска */}
              <circle
                cx={cx}
                cy={cy}
                r={outerR}
                fill={fillBlue}
                stroke={strokeBlue}
                strokeWidth={2.4}
              />
              {/* Второе концентрическое кольцо */}
              <circle
                cx={cx}
                cy={cy}
                r={midR}
                fill="none"
                stroke={strokeBlue}
                strokeWidth={1.3}
                strokeDasharray="3 2"
              />
              {/* Внутреннее кольцо с макетом оттиска */}
              <circle
                cx={cx}
                cy={cy}
                r={innerR}
                fill={fillAccent}
                stroke={strokeBlue}
                strokeWidth={1.5}
              />
              {renderBoundedText(cx, cy - 4, innerR * 1.8, 'ПЕЧАТЬ ОРГАНИЗАЦИИ', 10, textColor, 700)}
              {renderBoundedText(cx, cy + 11, innerR * 1.8, `Ø ${wMm} мм`, 11.5, strokeBlue, 800)}
            </g>
          );
        })()}
    </svg>
  );
}
